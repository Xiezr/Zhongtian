# -*- coding: utf-8 -*-
"""第 2 期 · 防守（定期被攻打）—— 核心机制落地。

为什么做这个（两条，都有证据）：
  ① **修一个空转系统**：防线全套零件都已建好（城墙 / 箭塔 / 城防值 / 驻军 / 守将加成），
     但 `cityDefense()` 的战斗消费点只有一处且被 `t.npc` 门控（只对 NPC 城生效）——
     **玩家掏资源修的城墙箭塔，当前只进一个显示数字，不进任何战斗计算**。
  ② 它让「烽火台」「驿站」这两个建筑有真实用途（预警提前量）。

设计要点（每条都是刻意的）：
  · **时间基准用 `s.world.elapsed`（游戏秒）**，不用现实日 —— 否则 600× 速度下被攻打频率会错。
  · **在线/离线共用 `GAME.invasionTick(gameHours)`**（照 `starveStep` 的先例，不许各写一套）。
  · **来袭规模按"玩家全境战力 × 比例"** 而不是固定值 —— 自动随游戏阶段缩放，
    且产生一个真实取舍：**兵收拢则守得住，兵分散则挨打**。
  · **城墙/箭塔给守备力乘区加成** —— 这就是"让空转系统转起来"的接口，可被破坏测试翻转。
  · **`loseCity = false`**：输了掉资源/兵/城墙等级，**不丢城**（体验红线，可调常量）。
  · **随机数走 `invasionRoll(seed)` 可复现**，否则断言无法稳定。

幂等：每处替换带锚点唯一性断言；已替换过则跳过；落盘后重读核验。
行尾：两个文件都是纯 LF，一律 newline=''。
用法：python patch_invasion.py
"""
import io, os, sys

ROOT = r'E:\Deepseekdb'
DATA = os.path.join(ROOT, 'js', 'data.js')
STATE = os.path.join(ROOT, 'js', 'state.js')

# ─────────────────────────── ① data.js：DATA.INVASION ───────────────────────────
DATA_ANCHOR = '  DATA.WILD_GARRISON = { perLevel: 10000 };\n'

DATA_BLOCK = '''
  /* ============================================================
   * 定期来袭（第 2 期 · 防守玩法）
   * ------------------------------------------------------------
   * 动机：防线零件（城墙 / 箭塔 / 城防值 / 驻军 / 守将）全都建好了，
   * 但**没有任何东西会来打玩家** —— `cityDefense()` 的战斗消费点只有一处
   * 且被 `t.npc` 门控（只对 NPC 城生效）。玩家修城墙只改变一个显示数字。
   * 本表让那套零件真正转起来。
   *
   * 口径（改这里务必同步 MEMORY 与备忘「十一、单一出口全量清单」）：
   *   · 来袭规模 = **玩家全境战力 × ratio**（不是固定值）→ 自动随阶段缩放，
   *     且产生真实取舍：**兵收拢则守得住，兵分散则挨打**。
   *   · 守备力 = **本城兵力战力 ×（1 + 城防/defDivisor）** → 城墙/箭塔在这里被真正消费。
   *   · `loseCity:false` 是**体验红线**：输了掉资源/兵/城墙等级，不丢城。
   *   · 时间基准用 `world.elapsed`（游戏秒），不用现实日。
   * ============================================================ */
  DATA.INVASION = {
    enabled: true,
    unlockCities: 2,          // 玩家达到几座城才开始有人来打（别一开局就挨打）
    baseDays: 4,              // 基础间隔（游戏日）
    minDays: 2,               // 间隔下限（城越多越紧）
    tightenPerCity: 0.12,     // 每多一座城，间隔缩短 12%
    warnHours: 12,            // 基础预警提前量（游戏小时）
    beaconBonusHours: 12,     // 每级烽火台额外提前（小时）
    warnBeaconMax: 3,         // 烽火台记级上限（超过按此算）
    ratioMin: 0.28,           // 来袭战力 ÷ 玩家全境战力 —— 下界
    ratioMax: 0.45,           // 上界（<0.5 保证"兵收拢就守得住"是可达的）
    defDivisor: 480,          // 城防换算守备力乘区的除数：城防 240 → +50%
    loseCity: false,          // ⛔ 体验红线：输了不丢城
    loss: { resPct: 0.15, troopPct: 0.10, wallDrop: 1, repDrop: 5 },
    sources: ['流寇', '郡国游兵', '坞堡私兵'],
  };

  DATA.WILD_GARRISON = { perLevel: 10000 };
'''

# ─────────────────────────── ② state.js：机制本体 ───────────────────────────
STATE_ANCHOR = '  /* 建造完成 */\n  GAME.applyBuildDone = function (q) {\n'

STATE_BLOCK = '''  /* ============================================================
   * 定期来袭（第 2 期 · 防守）—— 全部唯一出口
   * ------------------------------------------------------------
   *   invasionTick(gameHours)   时间轮推进（**在线 tickOnce 与离线 simulateBulk 共用**）
   *   invasionDueAt(city)       下次来袭时间（游戏秒；供界面读）
   *   armyPowerOf(city)         本城兵力战力（单兵战力复用 story.troopPower，不另造出口）
   *   defensePowerOf(city)      本城守备力 —— **城防在这里被真正消费**
   *   invasionPowerOf(city)     本次来袭规模
   *   invasionResolve(city)     结算
   * 状态存在 `city.inv = { nextAt, warned }` —— 跨时间且会被修改，**必须入存档**。
   * ============================================================ */

  /* 可复现随机：同一个 seed 永远同一个数（否则断言没法稳定，破坏测试也没法翻转） */
  GAME.invasionRoll = function (seed) {
    var h = 2166136261 >>> 0;
    var str = String(seed);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 100000) / 100000;
  };

  /* 本城兵力战力 —— 单兵战力复用 story.troopPower（**不另造第二个出口**） */
  GAME.armyPowerOf = function (city) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var total = 0;
    var army = (city && city.army) || {};
    for (var k in army) total += (tp ? tp(k) : 1) * (army[k] || 0);
    return Math.round(total);
  };

  /* 本城守备力 = 兵力战力 ×（1 + 城防/defDivisor）
     ⚠️ 这一行就是"让城墙/箭塔真正生效"的接口：`GAME.cityDefense` 已含
     城墙等级 ×20、箭塔 homeDef、守将智谋、羁绊守御、满级专精 +25%。 */
  GAME.defensePowerOf = function (city) {
    if (!city) return 0;
    var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
    var wallPct = (GAME.cityDefense(city) || 0) / div;
    return Math.round(GAME.armyPowerOf(city) * (1 + wallPct));
  };

  /* 来袭规模 = 玩家全境战力 × ratio（按城与周期取可复现的 ratio） */
  GAME.invasionPowerOf = function (city, cycle) {
    var s = GAME.state, I = DATA.INVASION || {};
    var total = 0;
    (s.cities || []).forEach(function (c) { total += GAME.armyPowerOf(c); });
    var r0 = GAME.invasionRoll('inv|' + (city && city.id) + '|' + (cycle == null ? 0 : cycle));
    var lo = (I.ratioMin == null ? 0.28 : I.ratioMin), hi = (I.ratioMax == null ? 0.45 : I.ratioMax);
    return Math.max(1, Math.round(total * (lo + r0 * (hi - lo))));
  };

  /* 下次来袭时间（游戏秒）。首次进入解锁条件时排期，之后按间隔滚动。 */
  GAME.invasionDueAt = function (city) {
    var I = DATA.INVASION || {};
    if (!city) return 0;
    var s = GAME.state;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || s.settings.invasion === false) return 0;
    if ((s.cities || []).length < need) return 0;
    if (!city.inv) return 0;
    return city.inv.nextAt || 0;
  };

  /* 间隔（游戏秒）：城越多越紧，但不低于 minDays */
  GAME.invasionIntervalSec = function () {
    var I = DATA.INVASION || {};
    var s = GAME.state;
    var n = (s.cities || []).length;
    var days = (I.baseDays || 4) - Math.max(0, n - 1) * (I.tightenPerCity || 0);
    days = Math.max(I.minDays || 2, days);
    return Math.round(days * 86400);
  };

  /* 结算：按 攻/守 比值算战损。返回明细供日志与断言读。 */
  GAME.invasionResolve = function (city) {
    var I = DATA.INVASION || {};
    var now = (GAME.state.world && GAME.state.world.elapsed) || 0;
    var cycle = Math.floor(now / 86400);
    var atk = GAME.invasionPowerOf(city, cycle);
    var def = GAME.defensePowerOf(city);
    /* ratio ∈ (0,1)：越接近 0 说明守方越强 */
    var ratio = atk / (atk + def || 1);
    var held = ratio <= 0.5;
    var severity = Math.max(0, (ratio - 0.5) * 2);     // 0..1，只有 ratio>0.5（被破）才有
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0 };

    var R = GAME.res(city);
    if (held) {
      /* 守住了：也折损一点（但不是零代价，否则"堆兵"变成无脑解） */
      severity = ratio * 0.35;
    }
    for (var k in { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1 }) {
      var pct = severity * (L.resPct || 0.15);
      var lost = Math.floor((R[k] || 0) * pct);
      if (lost > 0) { R[k] -= lost; out.resLost[k] = lost; }
    }
    /* 损兵：按各兵种等比减少，向下取整（不出现负数） */
    var tpct = severity * (L.troopPct || 0.10);
    for (var t in (city.army || {})) {
      var lose = Math.floor((city.army[t] || 0) * tpct);
      if (lose > 0) { city.army[t] -= lose; out.troopsLost += lose; }
    }
    /* 城墙掉级：只有被破（severity 高）才掉，且不丢城 */
    if (!held && severity > 0.5 && (L.wallDrop || 0) > 0) {
      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) {
        city.wallLv = wl - (L.wallDrop || 1);
        out.wallDrop = L.wallDrop || 1;
      }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }
    return out;
  };

  /* 时间轮推进 —— **在线 tickOnce 与离线 simulateBulk 共用这一处**。
     gameHours：本次推进经过的游戏小时数（离线补算会传一大段）。 */
  GAME.invasionTick = function (gameHours) {
    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (s.settings && s.settings.invasion === false) return 0;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if ((s.cities || []).length < need) return 0;
    var now = (s.world && s.world.elapsed) || 0;
    var fired = 0;

    s.cities.forEach(function (city) {
      if (!city.inv) city.inv = { nextAt: now + GAME.invasionIntervalSec(), warned: false };
      /* 离线可能一次跨过多个周期 —— 用 while 逐个结算，不许只判一次 */
      var guard = 0;
      while (city.inv.nextAt <= now && guard++ < 50) {
        var detail = GAME.invasionResolve(city);
        fired++;
        var src = (I.sources || ['敌军'])[Math.floor(GAME.invasionRoll('src|' + city.id + '|' + city.inv.nextAt) * (I.sources || ['敌军']).length)];
        var head = detail.held
          ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）';
        var bits = [];
        for (var rk in detail.resLost) bits.push((DATA.RESOURCES[rk] && DATA.RESOURCES[rk].name || rk) + ' −' + U.fmt(detail.resLost[rk]));
        if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
        if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
        if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
        GAME.log(head + (bits.length ? '：' + bits.join('、') : ''));
        city.inv.nextAt += GAME.invasionIntervalSec();
        city.inv.warned = false;
      }
      /* 预警：到点前 warnHours（有烽火台再加）先报一次 */
      var bc = Math.min(I.warnBeaconMax || 3, GAME.buildingLevel(city, 'fenghuotai') || 0);
      var warnSec = ((I.warnHours || 12) + bc * (I.beaconBonusHours || 12)) * 3600;
      if (!city.inv.warned && city.inv.nextAt - now <= warnSec && city.inv.nextAt > now) {
        city.inv.warned = true;
        var hrs = Math.max(1, Math.round((city.inv.nextAt - now) / 3600));
        GAME.log('🔥 烽火：' + city.name + ' 约 ' + hrs + ' 游戏时后将有兵马犯境'
          + (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警较迟）'));
      }
    });
    return fired;
  };

'''

# ─────────────────────────── ③ 两处时间轮挂钩 ───────────────────────────
TICK_ANCHOR = '    var dtReal = 1; // 现实秒\n'
TICK_HOOK = ('    var dtReal = 1; // 现实秒\n'
             '\n'
             '    /* 定期来袭（第 2 期）—— 唯一出口 GAME.invasionTick，'
             '离线补算走同一个函数 */\n'
             '    GAME.invasionTick(GAME.timeScale() / 3600);\n')

BULK_ANCHOR = '  GAME.simulateBulk = function (secReal) {\n    var s = GAME.state, ts = GAME.timeScale();\n'
BULK_HOOK = ('  GAME.simulateBulk = function (secReal) {\n'
             '    var s = GAME.state, ts = GAME.timeScale();\n'
             '\n'
             '    /* 定期来袭：离线也要照打（**与在线同一个 invasionTick**）——\n'
             '       长时间离线会一次跨过多个周期，函数内部用 while 逐个结算。 */\n'
             '    GAME.invasionTick(ts / 3600 * secReal);\n')


def patch(path, edits):
    src = io.open(path, encoding='utf-8', newline='').read()
    applied, skipped, failed = [], [], []
    for desc, old, new in edits:
        if new in src:
            skipped.append(desc)
            continue
        n = src.count(old)
        if n != 1:
            failed.append((desc, f'锚点出现 {n} 次（要求恰好 1 次）'))
            continue
        src = src.replace(old, new, 1)
        applied.append(desc)
    return src, applied, skipped, failed


def main():
    ok = True
    for path, edits, label in (
        (DATA, [('DATA.INVASION 表', DATA_ANCHOR, DATA_BLOCK)], 'data.js'),
        (STATE, [
            ('机制本体（6 个唯一出口）', STATE_ANCHOR, STATE_BLOCK + STATE_ANCHOR),
            ('tickOnce 挂钩', TICK_ANCHOR, TICK_HOOK),
            ('simulateBulk 挂钩', BULK_ANCHOR, BULK_HOOK),
        ], 'state.js'),
    ):
        before = io.open(path, encoding='utf-8', newline='').read()
        after, applied, skipped, failed = patch(path, edits)
        print(f'── {label} ──')
        for d in applied:
            print(f'  ✅ {d}')
        for d in skipped:
            print(f'  ·  {d}（已是最新，跳过）')
        for d, why in failed:
            print(f'  ❌ {d} —— {why}')
            ok = False
        if failed:
            print('  ✗ 有锚点未命中，**本文件未写盘**')
            continue
        if not applied:
            print('  无改动')
            continue
        io.open(path, 'w', encoding='utf-8', newline='').write(after)
        back = io.open(path, encoding='utf-8', newline='').read()
        same = back == after
        crlf = back.count('\r\n')
        print(f'  已写盘 {len(before)} → {len(after)} 字符（{len(after)-len(before):+d}）'
              f'  落盘核验{"✅一致" if same else "❌不一致"}  CRLF={crlf}')
        if not same:
            ok = False
        print()

    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
