# -*- coding: utf-8 -*-
"""v89.94 Patch B —— js/domain.js：围攻守备值核心 + 战法唯一出口。
幂等：命中标记即跳过。"""
import io

P = 'js/domain.js'
src = io.open(P, encoding='utf-8').read()
orig = src

MARK = 'GAME.siegeScopeOf = function'
ANCHOR = """  GAME.fortLabelOf = function (fort) {
    if (!fort) return '';
    var rg = GAME.regionOf(fort.x, fort.y);
    return (rg && rg.county ? GAME.countyNameOf(rg.county) + ' · ' : '') + fort.name;
  };
"""

BLOCK = u"""  GAME.fortLabelOf = function (fort) {
    if (!fort) return '';
    var rg = GAME.regionOf(fort.x, fort.y);
    return (rg && rg.county ? GAME.countyNameOf(rg.county) + ' · ' : '') + fort.name;
  };

  /* ============================================================
   * v89.94（B2 · E1 围攻战）：据点/县城的**守备值** —— 唯一出口五件套
   * ------------------------------------------------------------
   * 存储：`s.sieges['f:x,y' | 'c:城id'] = { hold: 0~100, waves, day }`（懒初始化，随档走）。
   * 读＝算（按日恢复只发生在读取时 —— 不需要定时器，也不会随存档膨胀：
   * 同一格只有一行，攻下即清、恢复满即删）。
   * ⚠️ 全部上层（战斗 / 界面 / 探针）只读这五个出口，不许各自摸 s.sieges。
   * ============================================================ */
  GAME.siegeScopeOf = function (t) {
    if (!t) return false;
    var scope = (DATA.SIEGE && DATA.SIEGE.scope) || ['fort', 'county'];
    if (t.kind === 'fort') return scope.indexOf('fort') >= 0;
    if (t.kind === 'city' && t.cityType) return scope.indexOf(t.cityType) >= 0;
    return false;
  };
  GAME.siegeKeyOf = function (t) {
    if (!t) return '';
    if (t.kind === 'city') return 'c:' + ((t.npc && t.npc.id) || t.id || (t.x + ',' + t.y));
    return 'f:' + t.x + ',' + t.y;
  };
  GAME.siegeDayIdx = function () {
    return GAME.questDayIndex ? GAME.questDayIndex() : 0;
  };
  /* 读守备状态（含**按日恢复**）：整日未攻 → 恢复 repairPerDay/日；满 100 直接清档 */
  GAME.siegeStateOf = function (t) {
    var s = GAME.state;
    if (!s || !GAME.siegeScopeOf(t)) return null;
    s.sieges = s.sieges || {};
    var key = GAME.siegeKeyOf(t);
    var day = GAME.siegeDayIdx();
    var st = s.sieges[key];
    if (!st) return { key: key, hold: 100, waves: 0, day: day, fresh: true };
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (st.day == null ? day : st.day));
    if (rep > 0) {
      st.hold = Math.min(100, (st.hold == null ? 100 : st.hold) + rep);
      st.day = day;
      if (st.hold >= 100) {                       /* 恢复满 = 围解 → 不留空档 */
        delete s.sieges[key];
        return { key: key, hold: 100, waves: st.waves || 0, day: day, fresh: true };
      }
    }
    return st;
  };
  GAME.siegeHoldOf = function (t) {
    var st = GAME.siegeStateOf(t);
    return st ? st.hold : 100;
  };
  /* 守备 → 战斗入参缩放：守军 / 城防随破防同步衰减（保底见 DATA.SIEGE） */
  GAME.siegeScaleOf = function (t) {
    var st = GAME.siegeStateOf(t);
    var hold = st ? (st.hold == null ? 100 : st.hold) : 100;
    var cfg = DATA.SIEGE || {};
    var f = Math.max(0, Math.min(1, hold / 100));
    var gs = cfg.defScale == null ? 0.35 : cfg.defScale;
    var dt = cfg.defThr == null ? 0.30 : cfg.defThr;
    return { hold: hold, holdF: f,
      garrison: gs + (1 - gs) * f,      /* 守军缩放：守备 0% → 35% */
      def: dt + (1 - dt) * f };         /* 城防缩放：守备 0% → 30% */
  };
  /* 单波破防（%）：chipBase × 战力比，夹在 [chipMin, chipMax]；围困 ×1.5 */
  GAME.siegeChipOf = function (ratio, ops) {
    var cfg = DATA.SIEGE || {};
    var base = cfg.chipBase == null ? 45 : cfg.chipBase;
    var lo = cfg.chipMin == null ? 8 : cfg.chipMin;
    var hi = cfg.chipMax == null ? 55 : cfg.chipMax;
    var r = Number(ratio);
    if (!isFinite(r) || r <= 0) r = 0;
    var chip = Math.max(lo, Math.min(hi, Math.round(base * r)));
    if (ops === 'encircle') chip = Math.round(chip * (((cfg.encircle) || {}).chipMul == null ? 1.5 : cfg.encircle.chipMul));
    return Math.max(1, Math.min(100, chip));
  };
  /* 落账：扣守备、记波次。返回 { hold, waves, broke }（broke = 守备归零，下一胜即可下城） */
  GAME.siegeChipApply = function (t, chip) {
    if (!GAME.siegeScopeOf(t)) return null;
    var s = GAME.state;
    s.sieges = s.sieges || {};
    var key = GAME.siegeKeyOf(t);
    var day = GAME.siegeDayIdx();
    var rec = s.sieges[key] || { hold: 100, waves: 0, day: day };
    /* 先补结算"隔日恢复"（与 siegeStateOf 同一口径，避免跳过恢复直接打折） */
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (rec.day == null ? day : rec.day));
    rec.hold = Math.min(100, (rec.hold == null ? 100 : rec.hold) + rep);
    var chipUse = Math.max(0, Math.round(chip || 0));
    rec.hold = Math.max(0, rec.hold - chipUse);
    rec.waves = (rec.waves || 0) + 1;
    rec.day = day;
    s.sieges[key] = rec;
    return { key: key, hold: rec.hold, waves: rec.waves, broke: rec.hold <= 0, chip: chipUse };
  };
  /* 攻下 / 目标消失：清掉围攻档（不留孤儿行） */
  GAME.siegeClear = function (t) {
    var s = GAME.state;
    if (!s || !s.sieges || !GAME.siegeScopeOf(t)) return;
    delete s.sieges[GAME.siegeKeyOf(t)];
  };
  /* 一句话状态（界面/日志共用，不许各拼一遍） */
  GAME.siegeTextOf = function (t) {
    var st = GAME.siegeStateOf(t);
    if (!st) return '';
    var cfg = DATA.SIEGE || {};
    return '守备 ' + Math.round(st.hold) + '%'
      + (st.waves ? '（已围攻 ' + st.waves + ' 波）' : '（未动干戈）')
      + ' · 每整日恢复 ' + (cfg.repairPerDay || 0) + '%';
  };

  /* ============================================================
   * v89.94（B2 · E2）：战法（强攻/围困/奇袭）—— 唯一出口
   * ------------------------------------------------------------
   * `opsIdOf` 收敛非法值（任何脏输入 → assault）；`opsOf` 给名字/图标/说明；
   * `opsConfigIssueOf` 承载"目标/计略是否满足"的校验（prepare 与界面共用同一判据）。
   * ============================================================ */
  GAME.opsIdOf = function (id) {
    return (id === 'encircle' || id === 'surprise') ? id : 'assault';
  };
  GAME.opsOf = function (id) {
    var list = DATA.OPS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: 'assault', name: '强攻', icon: '⚔️', desc: '' };
  };
  /* 返回 null = 可用；否则返回"不可用原因"（文案直接给玩家看） */
  GAME.opsConfigIssueOf = function (id, t, schemeId) {
    var o = GAME.opsOf(id);
    if (o.require === 'scheme' && !schemeId) return '奇袭须先选定一门计略';
    if (o.scope && t && o.scope.indexOf(t.kind) < 0) return o.name + '只适用于据点与城池';
    return null;
  };
"""

if MARK in src:
    print('SKIP: siege 核心已存在')
elif ANCHOR in src:
    src = src.replace(ANCHOR, BLOCK, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    print('PATCHED domain.js  (+%d bytes)' % (len(src.encode('utf-8')) - len(orig.encode('utf-8'))))
else:
    raise SystemExit('ANCHOR MISSING in domain.js')
