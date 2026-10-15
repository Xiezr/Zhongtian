# -*- coding: utf-8 -*-
# v89.200 批次 A：睡眠/离线期间自动打（挂起战斗自动打完）
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ── A1 data.js：LOOP_GAP 加 battleAutoSec ──
A1_OLD = u"""   * toastSec=300：缺口 ≥5 分钟才给轻提示（分钟级小跳变补完即静默）。
   * ============================================================ */
  DATA.LOOP_GAP = { gapSec: 5, toastSec: 300 };"""
A1_NEW = u"""   * toastSec=300：缺口 ≥5 分钟才给轻提示（分钟级小跳变补完即静默）。
   * battleAutoSec=300（v89.200 · 老板 2「睡眠、离线期间自动打」）：
   *   离开 ≥5 分钟视同"离线托管"——**挂起战斗（等指挥）在补算时自动打完**
   *   （战报/沙盘全程回看照常生成）；短离开（切标签/卡顿）不触发，
   *   玩家回来照旧亲临指挥。与 toastSec 同档对齐（同一件事的两种提示）。
   * ============================================================ */
  DATA.LOOP_GAP = { gapSec: 5, toastSec: 300, battleAutoSec: 300 };"""
rep('js/data.js', 'A1 LOOP_GAP.battleAutoSec', A1_OLD, A1_NEW, 'battleAutoSec: 300 }')

# ── A2 battle.js：autoFinishBattles 唯一出口（restoreBattles 之后插入） ──
A2_OLD = u"""    if (drop.length) s.battles = s.battles.filter(function (b) { return drop.indexOf(b.id) < 0; });
  };

  /* 待指挥战斗数（军务 / 徽标用） */"""
A2_NEW = u"""    if (drop.length) s.battles = s.battles.filter(function (b) { return drop.indexOf(b.id) < 0; });
  };

  /* ============================================================
   * v89.200（老板 2）：「睡眠、离线期间自动打」——挂起战斗**离线自动打完**。
   * ------------------------------------------------------------
   * 场景：战斗挂起（待指挥）后玩家入睡 / 关掉页面 —— 回来时不该还"等您指挥"。
   *   · 调用点唯一：GAME.offlineCatchup（时间跳变补偿与读档补算共用同一段，
   *     见 state.js 的门槛段 —— secReal ≥ DATA.LOOP_GAP.battleAutoSec 才打）；
   *   · 会话重建：真离线读档时 GAME._bsess 尚未重建（restoreBattles 晚于本调用）
   *     —— 缺会话就地按 history 重放重建（与 restoreBattles 同法）；
   *     单场失败只跳过（保持挂起、不删记录），绝不让一场坏数据阻断其余。
   *   · 打完 = 走 autoBattle 唯一推进路径（stepBattle 逐回合 → history/逐回合
   *     数据完整保留）→ 战报与沙盘配方照常生成（归来可「公文 → 战报」回看全程）。
   * ============================================================ */
  GAME.battle.autoFinishBattles = function () {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return { n: 0 };
    var before = s.battles.length;
    s.battles.slice().forEach(function (rec) {
      if (rec.state !== 'live') return;
      try {
        GAME._bsess = GAME._bsess || {};
        if (!GAME._bsess[rec.id]) GAME._bsess[rec.id] = GAME.battle._makeEnv(rec);
        GAME.battle.autoBattle(rec.id);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[autoFinishBattles] 跳过一场：', e);
      }
    });
    /* 计数 = 记录减少量（打完/落账折返都会移出 s.battles；失败的保持原数不误计） */
    return { n: before - ((GAME.state && GAME.state.battles) || []).length };
  };

  /* 待指挥战斗数（军务 / 徽标用） */"""
rep('js/battle.js', 'A2 autoFinishBattles', A2_OLD, A2_NEW, 'GAME.battle.autoFinishBattles = function')

# ── A3a state.js：offlineCatchup 加自动打段 ──
A3_OLD = u"""    var _marchMsg = '';
    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) { GAME.log('（离线期间）' + mr.msg); _marchMsg = mr.msg; }
    }
    if (GAME.story && GAME.story.recordOffline && !_silent193) GAME.story.recordOffline(secReal);"""
A3_NEW = u"""    var _marchMsg = '';
    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) { GAME.log('（离线期间）' + mr.msg); _marchMsg = mr.msg; }
    }
    /* v89.200（老板 2）：「睡眠、离线期间自动打」——挂起战斗在离开期间**自动打完**。
       门槛 = DATA.LOOP_GAP.battleAutoSec（与 toastSec 同档：离开超 5 分钟视为离线托管）——
       短离开（切标签/卡顿）不触发，玩家回来照旧亲临指挥。
       战斗是真结算（战报/沙盘/落账齐全）——"记录类静默"不适用于它：日志照写军情流水，
       与上段行军的"（离线期间）"日志同规。silent（在线跳变补算）同样执行。 */
    var _autoBN200 = 0;
    var _autoBGate200 = (DATA.LOOP_GAP || {}).battleAutoSec;
    if (_autoBGate200 == null) _autoBGate200 = 300;
    if (secReal >= _autoBGate200 && GAME.battle && GAME.battle.autoFinishBattles) {
      var _ab200 = GAME.battle.autoFinishBattles();
      _autoBN200 = _ab200.n || 0;
      if (_autoBN200 > 0) {
        GAME.log.war('（离线期间）' + _autoBN200 + ' 场战斗已自动打完 —— 战报与全程回看见「公文」');
      }
    }
    if (GAME.story && GAME.story.recordOffline && !_silent193) GAME.story.recordOffline(secReal);"""
rep('js/state.js', 'A3a offlineCatchup 自动打段', A3_OLD, A3_NEW, 'var _autoBN200 = 0;')

# ── A3b state.js：归来报告加 autoBattles 字段 ──
A3B_OLD = u"""      wounded: Math.round((_snapB.wounded || 0) - (_snapA.wounded || 0)),
      marchMsg: _marchMsg,
    };"""
A3B_NEW = u"""      wounded: Math.round((_snapB.wounded || 0) - (_snapA.wounded || 0)),
      marchMsg: _marchMsg,
      autoBattles: _autoBN200,   /* v89.200（老板 2）：离线期间自动打完的挂起战斗数 */
    };"""
rep('js/state.js', 'A3b 报告 autoBattles', A3B_OLD, A3B_NEW, 'autoBattles: _autoBN200,')

# ── A4 ui.js：归来报告「军务」段加一行 ──
A4_OLD = u"""    if (rp.marchMsg) mil.push('<div class="op-hint">🚩 ' + U.escape(rp.marchMsg) + '</div>');"""
A4_NEW = u"""    /* v89.200（老板 2）：睡眠/离线期间自动打完的挂起战斗（0 场不显示） */
    if (rp.autoBattles) mil.push('<div class="op-hint">⚔️ ' + rp.autoBattles
      + ' 场战斗已自动打完（全程回见「公文 → 战报」）</div>');
    if (rp.marchMsg) mil.push('<div class="op-hint">🚩 ' + U.escape(rp.marchMsg) + '</div>');"""
rep('js/ui.js', 'A4 归来报告自动打行', A4_OLD, A4_NEW, '场战斗已自动打完（全程回见')

print('批次A 完成')
