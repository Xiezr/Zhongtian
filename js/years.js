/* ============================================================
 * years.js — 年景面板（v101 · B5 细化的界面部分）
 * ------------------------------------------------------------
 * 年景的**逻辑**在 `domain.js`（`GAME.yearOf / yearModsOf`，v92.8 起就有），
 * 这一版补的是：它原来只影响新系统（营地/势力/视野/遗迹），
 * 玩家在主界面感觉不到"今年是什么年"。
 *
 * 所以：
 *   · 数据层给 6 个年景加了 `yearMods`（粮产 / 征兵时长）；
 *   · 产量走 `prodFactors`、征兵走 `GAME.train` 的时长 —— 都是既有出口；
 *   · 这里只负责**把今年是什么、影响了什么写清楚**。
 *
 * ⚠️ 不重复定义 `yearOf` —— 那是 domain.js 的出口，这里只读。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var YR = GAME.years = {};
  var U = GAME.utils;

  /* 一句话摘要（面板副标题用） */
  YR.lineOf = function () {
    var y = GAME.yearOf ? GAME.yearOf() : null;
    if (!y) return '';
    var m = (GAME.yearModsOf ? GAME.yearModsOf() : {}) || {};
    var bits = [];
    if (m.prod) {
      for (var k in m.prod) {
        var v = m.prod[k];
        if (!v) continue;
        bits.push(({ grain: '粮', iron: '铁', wood: '木', stone: '石', gold: '旧币' }[k] || k)
          + ' ' + (v > 0 ? '+' : '') + Math.round(v * 100) + '%');
      }
    }
    if (m.train) bits.push('征兵 ' + (m.train > 0 ? '慢 ' : '快 ')
      + Math.abs(Math.round(m.train * 100)) + '%');
    return '📅 ' + y.name + (bits.length ? ('　' + bits.join('　')) : '　没有特别的加成或代价');
  };

  /* 正文：给"这个年景到底改变了什么"一句实话，不写成散文 */
  YR.bodyHTML = function () {
    var y = GAME.yearOf ? GAME.yearOf() : null;
    if (!y) return '';
    var more = [];
    if (y.campMul && y.campMul !== 1) more.push('营地招募 ×' + y.campMul);
    if (y.factionMul && y.factionMul !== 1) more.push('军阀推进 ×' + y.factionMul);
    if (y.fogPlus) more.push('视野 +' + y.fogPlus);
    if (y.ruinMul && y.ruinMul !== 1) more.push('遗迹产出 ×' + y.ruinMul);
    return '<div class="ui-sub" style="margin-top:4px;">' + U.escape(y.note || '')
      + (more.length ? ('　·　' + U.escape(more.join('　·　'))) : '') + '</div>';
  };
})();

/* ============================================================
 * 自注册（可插拔 —— 见 registry.js）
 * order 5：比「人从哪来（10）」还靠前 —— 它是今年整年的背景板。
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'years',
    order: 5,
    panel: function (ctx) {
      var sec = ctx.sec;
      var y = GAME.yearOf ? GAME.yearOf() : null;
      if (!y) return '';
      return sec('📅 今年', GAME.years.lineOf(), GAME.years.bodyHTML());
    }
  });
}
