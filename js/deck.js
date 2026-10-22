/* ============================================================
 * deck.js — 指令牌：战前带 5 张（v95 · E 卡牌构筑的最小形态）
 * ------------------------------------------------------------
 * 提案原话：「战前选 5 张指令牌组成牌组 —— 把 417 装备/246 道具变成
 *   「构筑」而非堆属性」。
 *
 * 这一版只做"构筑"里**唯一真正有意思的那一半**：从 8 张里选 5 张。
 *   · 8 张牌各有代价（狂怒攻 +15% 但战损 +6%）；
 *   · 只能带 5 张 —— 想要全都要？不行，这就是构筑；
 *   · 换牌免费、随时可换（不做"打牌"，先让"配牌"成立）。
 *
 * ⚠️ 不做回合抽牌：那要改 simulate 的回合循环，是下一版的事。
 *    先让"出征前看一眼牌组"成为习惯，再谈在战场上打出去。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var DK = GAME.deck = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.DECK) || {}; }
  function cards() { return D().cards || []; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!Array.isArray(s.deck)) s.deck = [];
    return s.deck;
  }

  DK.pickLimit = function () { return D().pick || 5; };

  DK.chosen = function () { var a = st0(); return a ? a.slice() : []; };

  DK.has = function (id) { return DK.chosen().indexOf(id) >= 0; };

  /* 加一张 / 去掉一张（超上限就不给加） */
  DK.toggle = function (id) {
    var a = st0();
    if (!a) return { ok: false, msg: '无存档' };
    var def = null;
    cards().forEach(function (c) { if (c.id === id) def = c; });
    if (!def) return { ok: false, msg: '没有这张牌' };
    var i = a.indexOf(id);
    if (i >= 0) { a.splice(i, 1); return { ok: true, msg: '取下了「' + def.name + '」' }; }
    if (a.length >= DK.pickLimit()) {
      return { ok: false, msg: '只能带 ' + DK.pickLimit() + ' 张 —— 先取下一张' };
    }
    a.push(id);
    return { ok: true, msg: '带上了「' + def.name + '」' };
  };

  /* ============================================================
   * effOf —— 牌组汇总（战果层读它）
   * ------------------------------------------------------------
   * 返回：{atk, def, loot, rep, loss, wall, wound, note}
   * ⚠️ 全部是**比例**，由 goals 乘上去；这里不做任何"百分比转数值"。
   * ============================================================ */
  DK.effOf = function () {
    var out = { atk: 0, def: 0, loot: 0, rep: 0, loss: 0, wall: 0, wound: 0, note: '' };
    var arr = DK.chosen();
    if (!arr.length) return out;
    var names = [];
    arr.forEach(function (id) {
      cards().forEach(function (c) {
        if (c.id !== id) return;
        if (c.eff === 'atk') out.atk += c.mul;
        else if (c.eff === 'def') out.def += c.mul;
        else if (c.eff === 'loot') out.loot += c.mul;
        else if (c.eff === 'pop') out.loot += c.mul * 0.5;
        else if (c.eff === 'loss') out.loss += c.mul;
        else if (c.eff === 'wall') out.wall += c.mul;
        else if (c.eff === 'wound') out.wound += c.mul;
        if (c.loss) out.loss -= c.loss;       /* 狂怒这类"有代价的牌" */
        names.push(c.name);
      });
    });
    out.note = '🃏 ' + names.join('·');
    return out;
  };

  DK.lineOf = function () {
    var n = DK.chosen().length;
    if (!n) return '🃏 指令牌：还没配（' + DK.pickLimit() + ' 个位置）';
    return '🃏 指令牌 ' + n + '/' + DK.pickLimit() + '：' + DK.chosen().map(function (id) {
      var nm = id;
      cards().forEach(function (c) { if (c.id === id) nm = c.name; });
      return nm;
    }).join('·');
  };
})();
