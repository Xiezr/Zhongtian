/* ============================================================
 * expose.js — 你点亮一格，别人也就看见你了（v95 · A7）
 * ------------------------------------------------------------
 * 提案原话：「点亮即暴露：你点亮一格，附近的东西也会注意到你」。
 *
 * 审计时判过"不做"，理由是"NPC 不侦查，单独做只能做成随机事件"。
 * 现在不同了：`rival.js` 有了真的在地图上走的人。
 *   · 他们的位置**一旦被你探明**，就说明你看见他们了 —— 他们也知道自己被发现；
 *   · 被发现之后他们会改主意：本来往远处的村子走，现在**往你最近的城走**
 *     （"既然被你盯上了，那就抢你的"）；
 *   · 于是探索第一次有了反面：你点亮的每一格，都在告诉别人你在哪。
 *
 * ⚠️ 不做"点一格扣一次侦察值"那种计价 —— 那是把暴露变成又一根进度条。
 *    这里只有一个后果：探明到他们，他们就转向你。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var EX = GAME.expose = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.EXPOSE) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  /* 玩家最近的城（他们转向的目标） */
  function nearestCityOf(ci) {
    var best = null, bestD = 1e9;
    var sp = (GAME.sphereOf ? GAME.sphereOf()
    : (GAME.mapSphere || GAME.sphere))   /* v98.6：`GAME.sphereOf()` 是**既有**出口（state.js：按 pid 取那颗星球的球面，
      默认当前星球 → 返回有 cells 的 GAME.sphere）。
      原来的 `GAME.mapSphere || GAME.sphere` 在玩家**还没打开地图**时是致命的：
      mapSphere 对象存在但没 build，`||` 不生效 → 拿到空球 → 村社/遗迹/势力/竞争者全空。 */;
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c || c.ci == null || !sp) return;
      var d = sp.distOf ? sp.distOf({ ci: ci }, { ci: c.ci }) : 999;
      if (d < bestD) { bestD = d; best = c; }
    });
    return best ? { city: best, dist: bestD } : null;
  }

  /* ============================================================
   * tick —— 每月：谁被看见了
   * ============================================================ */
  EX.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.exposeMonth === m) return null;
    if (s.exposeMonth == null) { s.exposeMonth = m; return { first: true }; }
    s.exposeMonth = m;

    if (!GAME.rival) return null;
    var out = { spotted: 0, turned: 0 };
    GAME.rival.arr().forEach(function (t) {
      if (!t || t.dead) return;
      var known = GAME.fog ? GAME.fog.isKnown(t.ci) : false;
      if (!known) { t.spotted = false; return; }
      if (!t.spotted) {
        t.spotted = true;
        out.spotted++;
        if (GAME.log && GAME.log.war) {
          GAME.log.war('👁 你看见了' + t.name + '（他们也知道自己被看见了）。');
        }
      }
      /* 被发现后：往你最近的城靠（不再是"抢远处的村子"，而是"来抢你的"） */
      var near = nearestCityOf(t.ci);
      if (near && near.city && near.dist <= 12) {
        var roll = GAME.invasionRoll ? GAME.invasionRoll('expose|' + t.id + '|' + m) : Math.random();
        if (roll < (D().rivalChance == null ? 0.35 : D().rivalChance)) {
          t.dest = { ci: near.city.ci, kind: 'city' };
          t.aggr = true;
          out.turned++;
        }
      }
    });
    return out;
  };

  /* 一行摘要 */
  EX.lineOf = function () {
    if (!GAME.rival) return '';
    var n = 0;
    GAME.rival.arr().forEach(function (t) { if (t && !t.dead && t.spotted) n++; });
    if (!n) return '';
    return '👁 ' + n + ' 支队伍已经知道你在哪（探明他们 = 他们也看见你）';
  };

  /* ============================================================
   * v144.4（A7 落地）：**被谁盯上，持续可见 + 到城倒计时**
   * ------------------------------------------------------------
   * 原版只有一行"有 N 支看见你了"，玩家不知道是谁、还有几个月到、
   * 该往哪座城补防 —— 于是"暴露"这个后果在界面上是空心的。
   * 这里逐队给出：名字 / 人数 / 目标城 / 到城倒计时（按两格/月粗估）。
   * ============================================================ */
  EX.watchersOf = function () {
    var out = [];
    if (!GAME.rival) return out;
    var sp = (GAME.sphereOf ? GAME.sphereOf() : (GAME.mapSphere || GAME.sphere));
    GAME.rival.arr().forEach(function (t) {
      if (!t || t.dead || !t.spotted) return;
      var near = nearestCityOf(t.ci);
      var dest = t.dest && t.dest.kind === 'city' ? (GAME.city && GAME.city.byId ? GAME.city.byId(t.dest.ci) : null) : null;
      /* dest.ci 存的是格号（见 rival.js），按格找城 */
      if (!dest && t.dest && t.dest.kind === 'city' && GAME.city && GAME.city.all) {
        GAME.city.all().forEach(function (c) { if (!dest && c.ci === t.dest.ci) dest = c; });
      }
      var dist = near ? near.dist : null;
      if (dest && sp && sp.distOf) dist = sp.distOf({ ci: t.ci }, { ci: dest.ci });
      var eta = (dist == null) ? null : Math.max(0, Math.ceil(dist / 2));   /* 竞争者约 2 格/月 */
      out.push({ id: t.id, name: t.name, pop: t.pop || 0, aggr: !!t.aggr,
        target: dest ? dest.name : null, eta: eta });
    });
    out.sort(function (a, b) { return (a.eta == null ? 999 : a.eta) - (b.eta == null ? 999 : b.eta); });
    return out;
  };

  EX.watchTextOf = function () {
    var list = EX.watchersOf();
    if (!list.length) return '';
    return list.slice(0, 3).map(function (w) {
      return w.name + '（' + U.numText(w.pop, 0) + ' 人）'
        + (w.target ? (' → ' + w.target + (w.eta != null ? '（约 ' + w.eta + ' 月后）' : '')) : '（还在游荡）');
    }).join('　·　') + (list.length > 3 ? '　…共 ' + list.length + ' 支' : '');
  };
})();
