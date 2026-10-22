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

  /* 这座城的老兵给战斗加多少攻击（tactic 读它） */
  VT.atkPctOf = function (cityId) {
    var per = D().atkPerLvl == null ? 0.03 : D().atkPerLvl;
    return VT.avgLvlOf(cityId) * per;
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

    /* v98.4：**伤兵堆太多，老兵会走**（`deserterAt`）。
       以前带残兵硬打没有任何长期代价 —— 现在会掉经验。
       判据用"伤兵 / （手上有的人 + 伤兵）"，超过三成开始走。 */
    var absent = 0;
    if (s.wounded) {
      var myCity = (GAME.city && GAME.city.byId) ? GAME.city.byId(rec.cityId) : null;
      var here = myCity && GAME.city.armyTotal ? GAME.city.armyTotal(myCity) : 0;
      var denom = here + (s.wounded | 0);
      absent = denom > 0 ? ((s.wounded | 0) / denom) : 0;
    }
    var arid = d.deserterAt == null ? 0.35 : d.deserterAt;
    var left = 0;
    if (absent > arid) {
      var dec = Math.min(1, 0.5 + (absent - arid));
      keys.forEach(function (k) {
        if (!(v[k] > 0)) return;
        v[k] = Math.max(0, Math.round((v[k] - dec) * 10) / 10);
        left++;
      });
      /* 没有兵种记录时，压一下通用经验 */
      if (!keys.length && v.__any) v.__any = Math.max(0, Math.round((v.__any - dec) * 10) / 10);
    }

    /* 老兵加成：**战场上的攻击**（`atkPerLvl` = "每级老兵：战力 +3%"）。
       ⚠️ 这里原来返回的是 `lootBonus`（战利品加成）—— 字段名写着 atk、用法却是抢得多，
          战场上一个数都没加（和 v98.2/v98.3 同一类错位，第四例）。
       现在改成真攻击：由 `tactic` 折进 goalMod，战报里能看到。 */
    var avg = VT.avgLvlOf(rec.cityId);
    var per = d.atkPerLvl == null ? 0.03 : d.atkPerLvl;
    return {
      atkPct: avg * per,
      exp: gain,
      note: avg >= 0.5 ? ('老兵 Lv' + (Math.round(avg * 10) / 10)
        + '（攻 +' + Math.round(avg * per * 100) + '%）') : null
    };
  };

  /* ============================================================
   * v98.4 tick —— 伤兵每月自愈（UI 上早就写着"每月自愈 10%"，
   *                 但代码里一行都没有 —— 界面在骗人）
   * ------------------------------------------------------------
   * 自愈的是"不用花钱的那一档"：伤兵营里每月有一成人自己好起来，
   * 按 `s.woundedArmy` 的兵种构成逐个归队到当前城。
   * 想一次治完还是走既有 `battle.heal`（花旧币）。
   * ============================================================ */
  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  VT.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.vetMonth === m) return null;
    if (s.vetMonth == null) { s.vetMonth = m; return { first: true }; }
    s.vetMonth = m;

    var n = s.wounded | 0;
    if (n <= 0) return { month: m, healed: 0 };

    var per = D().healPerMonth == null ? 0.10 : D().healPerMonth;
    var city = (GAME.currentCity && GAME.currentCity()) || (s.cities || [])[0] || null;
    var comp = s.woundedArmy || {};
    var gave = {}, total = 0;

    for (var id in comp) {
      var c = comp[id] | 0;
      if (c <= 0) continue;
      var take = Math.floor(c * per);
      if (take <= 0) take = 1;            /* 每月至少好一个：不然小伤兵营永远不动 */
      take = Math.min(c, take);
      if (!take) continue;
      comp[id] = c - take;
      if (comp[id] <= 0) delete comp[id];
      total += take;
      gave[id] = take;
      if (city && GAME.city && GAME.city.armyAdd) {
        var one = {};
        one[id] = take;
        GAME.city.armyAdd(city, one);
      }
    }
    /* 没有兵种构成的历史存档：只能把数字减下去（无从还原） */
    if (!total) {
      total = Math.min(n, Math.max(1, Math.floor(n * per)));
    }
    s.wounded = Math.max(0, n - total);
    if (total > 0 && GAME.log && GAME.log.war) {
      GAME.log.war('🩹 伤兵营里 ' + U.numText(total, 0) + ' 人自己好了（每月自愈 '
        + Math.round(per * 100) + '%），回' + (city ? city.name : '城里') + '归队。');
    }
    return { month: m, healed: total, by: gave };
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
