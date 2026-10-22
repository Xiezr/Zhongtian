/* ============================================================
 * setskill.js — 凑齐一套，给一个「能按的按钮」（v95 · D 组件复用）
 * ------------------------------------------------------------
 * 提案原话：「装备套装：凑齐给属性 → 凑齐给**一个技能**（天罚套 19 件 →
 *   解锁「轨道轰炸」指令）」。
 *
 * 现状：`DATA.SETS` 只有逐档属性（3/5/7/11/15/19 件），凑齐还是属性。
 *   于是 417 件装备在玩家眼里只有一个维度：数值更高。
 *
 * 这个模块给每类套装（战 / 智 / 体）一个**指令**：
 *   · 达到 3 件就解锁（弱化版），7 件正常，19 件翻倍 —— 不逼玩家凑满；
 *   · 指令不是被动加成，是**一次性的、可选的**：出征时按不按，你自己决定；
 *   · 按了就进冷却（3 个月），所以"留到哪一仗用"是个决定。
 *
 * ⚠️ 效果仍然落在战果层（goals），不进战场 —— 这一版先把"按钮"存在感做出来。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var SK = GAME.setskill = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.SETSKILL) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.setskill || typeof s.setskill !== 'object') s.setskill = { cd: {}, armed: null };
    if (!s.setskill.cd) s.setskill.cd = {};
    return s.setskill;
  }

  /* 某套装的最高已达档位（读既有 setProgressOf，不另算一套） */
  function bestTierOf(g) {
    var best = null;
    if (!GAME.setProgressOf) return null;
    (GAME.setProgressOf(g) || []).forEach(function (p) {
      if (!p.reached || !p.reached.length) return;
      var t = p.reached[p.reached.length - 1];
      if (!best || t > best.tier) best = { set: p.set, tier: t, name: p.name };
    });
    return best;
  }

  /* ============================================================
   * unlockedOf —— 这个存档里已解锁的指令
   * ------------------------------------------------------------
   * 扫所有将领的套装进度（"谁穿着"不影响解锁 —— 你凑出来过就算）。
   * ============================================================ */
  SK.unlockedOf = function () {
    var s = GAME.state;
    if (!s) return [];
    var best = {};       /* match → {tier, set} */
    (s.generals || []).forEach(function (g) {
      var b = bestTierOf(g);
      if (!b) return;
      (D().list || []).forEach(function (def) {
        if (b.set.indexOf(def.match) < 0) return;
        if (!best[def.id] || best[def.id].tier < b.tier) {
          best[def.id] = { tier: b.tier, set: b.set, setName: b.name };
        }
      });
    });
    var out = [];
    (D().list || []).forEach(function (def) {
      var b = best[def.id];
      if (!b) return;
      var tm = (D().tierMul || {})[b.tier] || 0.5;
      out.push({
        id: def.id, name: def.name, effect: def.effect,
        mul: Math.round(def.mul * tm * 1000) / 1000,
        desc: def.desc, tier: b.tier, setName: b.setName,
        cdLeft: SK.cdLeftOf(def.id)
      });
    });
    return out;
  };

  SK.cdLeftOf = function (id) {
    var sk = st0();
    if (!sk) return 0;
    var m = (GAME.growth && GAME.growth.monthNow) ? GAME.growth.monthNow() : 0;
    var until = sk.cd[id] || 0;
    return Math.max(0, until - m);
  };

  /* 已装备（本次出征要用的那条） */
  SK.activeOf = function () {
    var sk = st0();
    if (!sk || !sk.armed) return null;
    var arr = SK.unlockedOf();
    for (var i = 0; i < arr.length; i++) if (arr[i].id === sk.armed) return arr[i];
    return null;
  };

  /* 装备 / 卸下（arm） */
  SK.arm = function (id) {
    var sk = st0();
    if (!sk) return { ok: false, msg: '无存档' };
    if (sk.armed === id) { sk.armed = null; return { ok: true, msg: '已卸下指令' }; }
    var arr = SK.unlockedOf();
    var hit = null;
    arr.forEach(function (x) { if (x.id === id) hit = x; });
    if (!hit) return { ok: false, msg: '还没凑齐这套' };
    if (SK.cdLeftOf(id) > 0) return { ok: false, msg: '还在冷却（' + SK.cdLeftOf(id) + ' 个月）' };
    sk.armed = id;
    return { ok: true, msg: '已备好「' + hit.name + '」，下一仗自动生效。' };
  };

  /* 用掉（goals 结算时调用） */
  SK.consume = function () {
    var sk = st0();
    if (!sk || !sk.armed) return;
    var m = (GAME.growth && GAME.growth.monthNow) ? GAME.growth.monthNow() : 0;
    sk.cd[sk.armed] = m + 3;
    sk.armed = null;
  };

  SK.lineOf = function () {
    var arr = SK.unlockedOf();
    if (!arr.length) return '';
    var armed = SK.activeOf();
    return '🧩 套装指令：' + arr.map(function (x) {
      return x.name + '（' + x.tier + '件 · ' + (x.cdLeft ? '冷却 ' + x.cdLeft + '月' : (armed && armed.id === x.id ? '已备' : '待命')) + '）';
    }).join('　');
  };
})();
