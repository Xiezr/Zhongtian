/* ============================================================
 * bond.js — 带错人是要付代价的（v95 · D 羁绊）
 * ------------------------------------------------------------
 * 提案原话：「将领关系网：一起出战有加成，也可能意见不合不听指挥」。
 *
 * 现状：将领之间只有"羁绊加成"（后台静默），没有一次负面的关系。
 *   于是"带谁"没有代价 —— 挑战力最高的那个就行。
 *
 * 这个模块给一条**能预见的**负面关系：
 *   派去打仗的主将，和守在家里的守将/城主**风格不合**（猛将 vs 智将/贤才），
 *   这一仗全军战力 −10%。
 *
 * 为什么用"风格"而不是随机性格：
 *   · 风格是招募时就能看见的（面板上有），所以玩家**能提前避**；
 *   · 避的办法不止一个：换个将去、换个城出发、或者带一个"均衡"型的做和事佬。
 *   这就从"随机惩罚"变成了"编成决策"——而随机惩罚是我明确不做的。
 *
 * ⚠️ 不做"战场上抗命"：那要改指令层，而且玩家只会看到一句"某将不听指挥"，
 *    除了生气没有别的反应。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var BD = GAME.bond = {};

  function D() { return (GAME.DATA && GAME.DATA.BOND) || {}; }

  function styleName(id) {
    var nm = id || '均衡';
    ((GAME.DATA && GAME.DATA.GEN_STYLES) || []).forEach(function (s) { if (s.id === id) nm = s.name; });
    return nm;
  }

  /* 两人合不合（返回 null = 合，否则 {why, penalty}） */
  BD.clashOf = function (a, b) {
    if (!a || !b) return null;
    if (!a.styleId || !b.styleId) return null;
    var sa = a.styleId, sb = b.styleId;
    var hits = ((D().pairs) || []).filter(function (p) {
      return (p.a === sa && p.b === sb) || (p.a === sb && p.b === sa);
    });
    if (!hits.length) return null;
    return { why: hits[0].why, penalty: D().penalty == null ? 0.10 : D().penalty };
  };

  /* ============================================================
   * penaltyOf —— 这次出征带的人合不合
   * ------------------------------------------------------------
   * 比较对象：出征主将 × 出发城的守将 / 城主（谁在城里、谁跟他不对付）。
   * 只看一个最严重的冲突（不叠加：两个不合不该变成 −20%，那太苛刻）。
   * ============================================================ */
  BD.penaltyOf = function (city, gen) {
    if (!city || !gen) return null;
    var others = [];
    if (GAME.guardGeneralOf) { var g = GAME.guardGeneralOf(city); if (g && g.id !== gen.id) others.push({ g: g, role: '守将' }); }
    if (GAME.mayorGeneralOf) { var m = GAME.mayorGeneralOf(city); if (m && m.id !== gen.id) others.push({ g: m, role: '城主' }); }
    for (var i = 0; i < others.length; i++) {
      var c = BD.clashOf(gen, others[i].g);
      if (c) {
        return {
          penalty: c.penalty, why: c.why,
          a: gen.name, b: others[i].g.name, role: others[i].role,
          line: '⚡ ' + gen.name + '（' + styleName(gen.styleId) + '）与' + others[i].role
            + others[i].g.name + '（' + styleName(others[i].g.styleId) + '）不合：'
            + c.why + '，全军战力 −' + Math.round(c.penalty * 100) + '%'
        };
      }
    }
    return null;
  };

  /* 一行摘要（出征面板/城面板） */
  BD.lineOf = function (city, gen) {
    var p = BD.penaltyOf(city, gen);
    return p ? p.line : '';
  };
})();
