/* ============================================================
 * veteran.js — 老兵（v95 · 不可逆的那一半）
 * ------------------------------------------------------------
 * ⚠️ 先说清一件事：**伤兵系统本来就有**。
 *   `s.wounded`（数字）+ `s.woundedArmy`（兵种构成）+ `GAME.battle.heal()`。
 *   我第一版又造了一个"分城伤兵池"，把 `s.wounded` 当成对象用，
 *   直接把既有那套冲垮 —— smoke §193② 当场红了（队列推不完、军队数不对）。
 *
 *   所以这个模块**只做一件既有系统没做的事**：给部队记"打过多少仗"。
 *   教训已写进 AGENTS.md：新模块动 state 字段前，先 grep 这个字段名。
 *
 * 老兵怎么起作用（不碰战斗引擎）：
 *   · 按（城 × 兵种）记经验，参战存活就涨，上限 5 级；
 *   · 打赢得 0.5、打输得 0.15 × 存活比例 —— **输也长经验**，这才叫"活着回来"；
 *   · 等级高 → 同一场仗**抢得更多**（战利品 +3%/级），战报里点名。
 *
 * 为什么这算"不可逆"：等级只涨不跌，但**兵是会死的**。
 *   老兵死一场就少一批，新补的兵从 0 级开始 ——
 *   你损失的是一支部队的经验，而不是一个 2 小时就能补满的数字。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var VT = GAME.veteran = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.VETERAN) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.vet || typeof s.vet !== 'object') s.vet = {};
    return s;
  }

  VT.vetOf = function (cityId) {
    var s = st0();
    if (!s) return {};
    return s.vet[cityId] || {};
  };

  VT.avgLvlOf = function (cityId) {
    var v = VT.vetOf(cityId), n = 0, sum = 0;
    var cap = D().maxLvl || 5;
    for (var k in v) { sum += Math.min(cap, v[k] || 0); n++; }
    return n ? sum / n : 0;
  };

  /* ============================================================
   * afterBattle —— 只记经验，不动伤亡（伤亡归既有 applyWounded / heal）
   * ============================================================ */
  VT.afterBattle = function (rec, result, ctx) {
    var s = st0();
    if (!s || !rec || !result || !rec.cityId) return null;
    var d = D();
    var myLoss = result.atkLoss || 0, myKeep = result.atkRemain || 0;
    var myTotal = myLoss + myKeep;
    if (myTotal <= 0) return null;

    var keepRatio = myKeep / myTotal;
    var gain = ((ctx && ctx.win) ? (d.expPerWin == null ? 0.5 : d.expPerWin)
      : (d.expPerLose == null ? 0.15 : d.expPerLose)) * keepRatio;
    if (gain <= 0) return null;

    var v = (s.vet[rec.cityId] = s.vet[rec.cityId] || {});
    var atk = rec.atkArmy || {}, keys = Object.keys(atk);
    var maxLvl = d.maxLvl || 5;
    if (!keys.length) v.__any = Math.min(maxLvl, (v.__any || 0) + gain);
    else keys.forEach(function (k) {
      if ((atk[k] || 0) <= 0) return;
      v[k] = Math.min(maxLvl, (v[k] || 0) + gain);
    });

    /* 老兵加成：同一场仗抢得更多（"活下来的人"唯一被看见的地方） */
    var avg = VT.avgLvlOf(rec.cityId);
    return {
      lootBonus: avg * (d.atkPerLvl == null ? 0.03 : d.atkPerLvl),
      exp: gain,
      note: avg >= 0.5 ? ('老兵 Lv' + (Math.round(avg * 10) / 10)) : null
    };
  };

  /* ---------- 伤兵：直接复用既有系统，不另立一套 ---------- */
  VT.totalWounded = function () {
    var s = GAME.state;
    return (s && (s.wounded | 0)) || 0;
  };

  VT.treat = function (cityId) {
    if (!GAME.battle || !GAME.battle.heal) return { ok: false, msg: '治疗入口未就绪' };
    return GAME.battle.heal(cityId);
  };

  VT.lineOf = function () {
    var n = VT.totalWounded();
    if (!n) return '';
    return '🩹 伤兵营 ' + U.numText(n, 0) + ' 人（治疗 10 旧币/人，治完才回队）';
  };
})();
