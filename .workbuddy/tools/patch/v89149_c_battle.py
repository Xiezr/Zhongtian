# -*- coding: utf-8 -*-
"""v89.149 批 C：battle.js —— ① 战斗声望唯一出口（repGainOf / battleRepView / grantBattleRep）
② 出征落账段发声望 ③ 战报正文写声望行"""
import io

P = 'E:/Deepseekdb/js/battle.js'
BAK = 'E:/Deepseekdb/backup/v89149/battle.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 唯一出口（插在 battleExp 之后、expPenalty 之前） ----------
A1 = """  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，按「每 12 级一个台阶」给经验打折（唯一出口）。"""

N1 = """  /* ============================================================
   * v89.149（老板 1）：「战斗可获得声望，**根据军师估算的军力对比设定系数，
   *   根据消灭的军力为基础**，设定声望获得量，**不要太泛滥**」
   * ------------------------------------------------------------
   * **唯一出口**（表在 `DATA.REP_RULE`；出征与守城两条落账路径都走这里，
   * 别处不许直接写 `s.rep`）：
   *   · 基础 = **歼灭的军力**（敌军开局 − 残余），用 `story.troopPower` 折算
   *     —— 与「军师估算 / 来袭强度 / 家底」同一把尺，不另造第二把；
   *   · 系数 = 军力对比 `foeStart / myStart` 的**平方根**（夹 coefLo~coefHi）：
   *     以少打多系数高、以多打少系数低（平方根 = 不让"人多"把声望一次打到地板）；
   *   · **视角必须显式传**（v89.149 沿用 v89.116 的教训：`captiveGain` 靠 target 猜
   *     攻守视角，防御战里读错字段）。`battleRepView(result, mySide, win)` 一处转换：
   *       攻方视角 → 我 = atkStartBy / 敌 = defStartBy / 歼灭 = defLossBy；
   *       守方视角 → 我 = defStartBy / 敌 = atkStartBy / 歼灭 = atkLossBy。
   * ============================================================ */
  GAME.battle.repGainOf = function (view) {
    var R = DATA.REP_RULE || {};
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    function sum(m) {
      var t = 0;
      for (var k in (m || {})) t += (tp ? tp(k) : 1) * (m[k] || 0);
      return t;
    }
    var myStart = sum(view && view.mine);
    var foeStart = sum(view && view.foe);
    var lost = sum(view && view.foeLoss);          /* 歼灭的军力 */
    var ratio = myStart > 0 ? (foeStart / myStart) : 0;
    var lo = (R.coefLo == null) ? 0.4 : R.coefLo;
    var hi = (R.coefHi == null) ? 2 : R.coefHi;
    var coef = Math.max(lo, Math.min(hi, Math.sqrt(ratio || 0)));
    var mul = (view && view.win) ? (R.winMul == null ? 1 : R.winMul)
      : (R.loseMul == null ? 0.35 : R.loseMul);
    var raw = lost / (R.perPower || 30000) * coef * mul;
    var cap = R.cap || 0;
    var gain = Math.max(0, Math.round(raw));
    var capped = cap > 0 && gain > cap;
    if (capped) gain = cap;
    return { gain: gain, raw: Math.round(raw * 100) / 100, cap: cap, capped: capped,
      lost: Math.round(lost), mine: Math.round(myStart), foe: Math.round(foeStart),
      ratio: Math.round(ratio * 100) / 100, coef: Math.round(coef * 100) / 100,
      win: !!(view && view.win) };
  };
  /* 视角转换（唯一一处把 result 的四个逐兵种表映射成"我/敌/歼灭"） */
  GAME.battle.battleRepView = function (result, mySide, win) {
    var meDef = (mySide === 'def');
    return {
      win: !!win,
      mine: meDef ? (result && result.defStartBy) : (result && result.atkStartBy),
      foe: meDef ? (result && result.atkStartBy) : (result && result.defStartBy),
      foeLoss: meDef ? (result && result.atkLossBy) : (result && result.defLossBy),
    };
  };
  /* 记一笔战功声望：写账 + 日志 + 挂到 `result.repGain`（战报 / 结算界面读同一份） */
  GAME.battle.grantBattleRep = function (result, mySide, win, why) {
    var g = GAME.battle.repGainOf(GAME.battle.battleRepView(result, mySide, win));
    if (result) result.repGain = g;
    if (!g || g.gain <= 0) return g;
    GAME.state.rep = (GAME.state.rep || 0) + g.gain;
    GAME.log.war('🏅 ' + ((why ? why + ' ' : '')) + '战功：歼灭军力 ' + U.fmt(g.lost)
      + '（兵比 ' + g.ratio.toFixed(2) + ' ×' + g.coef.toFixed(2) + '）→ 声望 +' + g.gain
      + (g.capped ? '（单场封顶）' : ''));
    return g;
  };

  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，按「每 12 级一个台阶」给经验打折（唯一出口）。"""

rep(A1, N1, 'repGainOf')

# ---------- ② 出征落账段发声望（放在 win/else 之后、"归队"之前 —— 败仗也有斩获） ----------
A2 = """    /* 归队 —— 「派出去的兵能回来」的唯一路径。
       之前 expedition 扣了兵却从不归还 `result.atkRemain`，伤兵也只是个计数，
       等于每次出征都在凭空蒸发军队、治疗是纯金币消耗。 */"""

N2 = """    /* v89.149（老板 1）：**出征视角**落一笔战功声望（我方 = 攻方）——
       基础 = 歼灭的军力（defLossBy），系数 = 军力对比（与军师估算同尺）。
       败仗也有斩获，但威望折损（DATA.REP_RULE.loseMul）；口径全在 grantBattleRep 一处。 */
    GAME.battle.grantBattleRep(result, 'atk', win, t.name);

    /* 归队 —— 「派出去的兵能回来」的唯一路径。
       之前 expedition 扣了兵却从不归还 `result.atkRemain`，伤兵也只是个计数，
       等于每次出征都在凭空蒸发军队、治疗是纯金币消耗。 */"""

rep(A2, N2, 'expedition-发声望')

# ---------- ③ 战报正文：经验行后补一行声望 ----------
A3 = """    } else if (result.expNone && gen) {
      line4 = '<br><span style="color:var(--text-dim);">战败无功，未获经验。</span>';
    }
    return line1 + '<br>' + line2 + '<br>' + line3 + line4;"""

N3 = """    } else if (result.expNone && gen) {
      line4 = '<br><span style="color:var(--text-dim);">战败无功，未获经验。</span>';
    }
    /* v89.149（老板 1）：战功声望也写进战报正文 —— 与经验同一位置、同一原则
       （"玩家唯一会认真看战报的地方"）；口径用悬停解释，不占正文篇幅。 */
    var line5 = '';
    if (result.repGain && result.repGain.gain > 0) {
      var rg = result.repGain;
      line5 = '<br><span style="cursor:help;" title="声望 = 歼灭军力 ÷ '
        + U.numText(rg.cap ? (DATA.REP_RULE || {}).perPower || 30000 : (DATA.REP_RULE || {}).perPower || 30000, 0)
        + ' × 兵力对比系数（平方根，'
        + ((DATA.REP_RULE || {}).coefLo == null ? 0.4 : DATA.REP_RULE.coefLo) + '~'
        + ((DATA.REP_RULE || {}).coefHi == null ? 2 : DATA.REP_RULE.coefHi)
        + ' 夹取）">声望</span> +' + U.numText(rg.gain, 0)
        + '<span style="color:var(--text-dim);">（歼灭军力 ' + U.numText(rg.lost, 0)
        + ' · 兵比 ' + rg.ratio.toFixed(2) + ' ×' + rg.coef.toFixed(2)
        + (rg.capped ? ' · 单场封顶' : '') + '）</span>';
    }
    return line1 + '<br>' + line2 + '<br>' + line3 + line4 + line5;"""

rep(A3, N3, 'reportText-声望行')

# 写后哨兵
assert s.count('GAME.battle.repGainOf = function') == 1
assert s.count('GAME.battle.battleRepView = function') == 1
assert s.count('GAME.battle.grantBattleRep = function') == 1
assert 'GAME.log(' not in s.replace('GAME.log.war(', '').replace('GAME.log.sys(', '').replace('GAME.log.beacon(', ''), 'battle.js 里出现裸 GAME.log('
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('battle.js 落盘 · len=' + str(len(s)))
