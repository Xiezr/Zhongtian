/* ============================================================
 * risk.js — 危险梯度（v101 · 构想 A5，复核里唯一真缺的一项）
 * ------------------------------------------------------------
 * 提案原话：「**危险梯度**：迷雾边缘最危险，越往中心越安全」。
 *
 * 之前 `sphere.report()` 里有个 danger 数字，但那是**星球的属性**，
 * 跟"你去哪儿"没有关系 —— 去门口打野地和去三十格外的废墟，战损一样。
 * 于是"往外推"是纯赚（远处的东西更肥），没有对应的疼。
 *
 * 这一版把它变成**按格子的危险度**，两个来源相加：
 *   ① 你熟不熟：迷雾探明度（0 未探明 / 1 只见地形 / 2 全见）
 *   ② 离家多远：离最近一座自己的城越远，补给与后送越差
 *
 * 它只做一件事：**削攻方的血**（`goalMod.hp`）。
 * 不加新数值通道（见 v98.5 定下的规矩：战场加成只有 goalMod 一条）。
 *
 * ⚠️ 和 v98.2 一样的边界：只在 `opts.playerAtk && !opts.playerDef`
 *    时生效 —— NPC 互打与测试模拟不受影响。
 * ⚠️ 上限刻意压到 −12%：危险梯度是"有点疼"，不是"不让你去"。
 *    真正劝退的应该是守军，不是地形。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var RK = GAME.risk = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.RISK) || {}; }

  /* 探明度三档 → 基础危险 */
  var FOG_BASE = [0.55, 0.30, 0.10];

  function fogOf(ci) {
    if (!GAME.fog || !GAME.fog.get) return 0;
    try { return GAME.fog.get(ci) | 0; } catch (e) { return 0; }
  }

  /* 离最近一座自家的城多远（格）—— 用 rough 版本，别对每次出征做 BFS */
  function distToHome(ci) {
    var sp = (GAME.sphereOf ? GAME.sphereOf() : (GAME.mapSphere || GAME.sphere));
    if (!sp || !sp.roughDistOf) return 0;
    var all = (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : [];
    var best = 1e9;
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (!c || c.ci == null || c.ci < 0) continue;
      var d = sp.roughDistOf({ ci: c.ci }, { ci: ci });
      if (d < best) best = d;
    }
    return best === 1e9 ? 0 : best;
  }

  /* ============================================================
   * dangerAt —— 0（家门口、熟得不能再熟）→ 1（深在迷雾里、离谁都远）
   * ============================================================ */
  RK.dangerAt = function (ci) {
    if (ci == null || ci < 0) return 0;
    var d = D();
    var base = FOG_BASE[Math.max(0, Math.min(2, fogOf(ci)))];
    if (d.fogBase && d.fogBase.length === 3) base = d.fogBase[Math.max(0, Math.min(2, fogOf(ci)))];
    var far = Math.min(d.farCap == null ? 0.45 : d.farCap,
      distToHome(ci) / (d.farEvery == null ? 40 : d.farEvery));
    var v = base + far;
    return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  };

  /* 文字档位（UI 用；不搞百分比堆砌，三档够用） */
  RK.tierOf = function (dg) {
    var d = D();
    if (dg >= (d.highAt == null ? 0.66 : d.highAt)) return { id: 'high', name: '险地', color: 'var(--red-light)' };
    if (dg >= (d.midAt == null ? 0.33 : d.midAt)) return { id: 'mid', name: '生疏', color: 'var(--gold, #d9a441)' };
    return { id: 'low', name: '熟地', color: 'var(--text-dim)' };
  };

  /* ============================================================
   * 只读出口（界面）
   * ============================================================ */
  RK.lineOf = function () {
    var all = (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : [];
    var c = (GAME.currentCity && GAME.currentCity()) || all[0] || null;
    if (!c || c.ci == null) return '';
    /* 取一个"有代表性"的目标：离城 12 格左右的一格（往外推的典型距离） */
    var sp = (GAME.sphereOf ? GAME.sphereOf() : GAME.sphere);
    var probe = null;
    if (sp && sp.cells) {
      for (var i = 0; i < 200 && probe == null; i++) {
        var ci = (c.ci + 907 * (i + 1)) % sp.cells.length;
        if (!sp.cells[ci] || sp.cells[ci].type === 'lake') continue;
        probe = ci;
      }
    }
    if (probe == null) return '';
    var near = { ci: c.ci };
    var dgHome = RK.dangerAt(c.ci);
    var dgFar = RK.dangerAt(probe);
    var far = Math.round(distToHome(probe));
    return '家门口 ' + Math.round(dgHome * 100) + '%（' + RK.tierOf(dgHome).name + '）'
      + '　·　往外 ' + far + ' 格 ' + Math.round(dgFar * 100) + '%（' + RK.tierOf(dgFar).name + '）';
  };

  /* 面板正文用：一句话讲清它管什么 */
  RK.helpText = function () {
    var d = D();
    return '越往没探过的地方走，伤得越重（最多 −' + Math.round((d.hpAtFull == null ? 0.12 : d.hpAtFull) * 100)
      + '% 生命）。它只削你的血，不减你抢到的东西 —— 远处仍然更肥，只是更疼。';
  };

  void U;

/* ============================================================
 * v101：自注册（可插拔 —— 见 registry.js）
 * 只用一块面板，没有动作、没有月度结算。
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'risk',
    order: 15,          /* 紧跟在「人从哪来（10）」之后：出门前先看这一带危不危险 */
    panel: function (ctx) {
      var sec = ctx.sec;
      return sec('⚠ 危险梯度', GAME.risk.lineOf() || '这一带还没测过',
        '<div class="ui-sub" style="margin-top:4px;">' + GAME.risk.helpText() + '</div>');
    }
  });
}

})();
