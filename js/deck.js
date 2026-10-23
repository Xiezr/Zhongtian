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
  /* ============================================================
   * v107（D3 补完）：牌与风格冲突 → 这一仗打不出去
   * ------------------------------------------------------------
   * v95 写这一块时明确不做"战场抗命"：「玩家只会看到一句'某将不听指挥'，
   * 除了生气没有别的反应」。这个判断仍然成立 —— 所以这里不做随机，
   * 做**可预见、可应对**的那一版：
   *
   *   · 每张牌有风格归属（war 猛将 / wis 智将 / gov 贤才），没标签的是通用牌；
   *   · 带队的将风格对不上 → 那张牌这一仗**用不了**（不是随机失效，是根本不存在）；
   *   · 均衡型（balance）不受限 —— 带个老好人，什么牌都能打。
   *
   * 于是"带谁去"第一次有了编成取舍：要打血勇，就得带猛将；
   * 要带智将，就得换牌。
   * ============================================================ */
  /* ⚠️ v121 修：真实英雄对象上的字段叫 **`style`**，不是 `styleId`
     （`generals.js` 造出来的对象是 style:'balance'）。
     我 v107 写成 styleId，于是**真实游戏里永远返回 'balance'，
     那张牌与风格的冲突从来没生效过** —— 而 §327 用自己造的
     `{styleId:'war'}` 去测，全绿。断言测了假对象，门禁就变成了帮凶。
     现在两个字段都认（老存档可能存的是 styleId）。 */
  DK.styleOf = function (gen) {
    if (!gen) return 'balance';
    return gen.style || gen.styleId || 'balance';
  };

  /* 这张牌这一仗能不能用（gen 缺省 = 不过滤，向后兼容旧调用）*/
  DK.usableOf = function (cardId, gen) {
    if (!gen) return true;
    var st = DK.styleOf(gen);
    if (st === 'balance') return true;       /* 均衡：全都能用 */
    var card = null;
    cards().forEach(function (c) { if (c.id === cardId) card = c; });
    if (!card) return false;
    if (!card.style) return true;            /* 通用牌 */
    return card.style === st;
  };

  /* 这一仗哪些牌用不了（界面要灰掉的那几张）*/
  DK.refusedOf = function (gen) {
    if (!gen) return [];
    var st = DK.styleOf(gen);
    if (st === 'balance') return [];
    var out = [];
    DK.chosen().forEach(function (id) {
      if (DK.usableOf(id, gen)) return;
      cards().forEach(function (c) {
        if (c.id !== id) return;
        var need = '';
        ((GAME.DATA && GAME.DATA.GEN_STYLES) || []).forEach(function (s) {
          if (s.id === c.style) need = s.name;
        });
        out.push({ id: id, name: c.name, why: need + '才用得动' });
      });
    });
    return out;
  };

  DK.effOf = function (gen) {
    var out = { atk: 0, def: 0, loot: 0, rep: 0, loss: 0, wall: 0, wound: 0, note: '', refused: [] };
    var arr = DK.chosen();
    if (!arr.length) return out;
    var names = [];
    arr.forEach(function (id) {
      /* v107：风格对不上的牌**不生效** —— 但它仍然占着牌位（选牌时就要想清楚）*/
      if (!DK.usableOf(id, gen)) {
        cards().forEach(function (c) {
          if (c.id === id) out.refused.push(c.name);
        });
        return;
      }
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
    out.note = '🃏 ' + names.join('·')
      + (out.refused.length ? '（' + out.refused.join('·') + ' 用不了）' : '');
    return out;
  };

  DK.lineOf = function (gen) {
    var n = DK.chosen().length;
    if (!n) return '🃏 指令牌：还没配（' + DK.pickLimit() + ' 个位置）';
    var bad = gen ? DK.refusedOf(gen) : [];
    return '🃏 指令牌 ' + n + '/' + DK.pickLimit() + '：' + DK.chosen().map(function (id) {
      var nm = id;
      cards().forEach(function (c) { if (c.id === id) nm = c.name; });
      var out = bad.some(function (b) { return b.id === id; });
      return nm + (out ? '✗' : '');
    }).join('·') + (bad.length ? '　（✗ = 带队的将用不了）' : '');
  };
})();
