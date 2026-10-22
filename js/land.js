/* ============================================================
 * land.js — 只有连成一片的，才算你的（v94.1 · 构想 A1）
 * ------------------------------------------------------------
 * 提案原文：「只有与主城连成一片的亮格才算领地；断链的部队掉补给」。
 *
 * 现状：这也是个"全图都算我的"的游戏 ——
 *   只要打下了，隔着一片海、隔着半个星球，那座城照样满产出。
 *   于是"打哪儿"没有地理成本，"守补给线"这个概念根本不存在。
 *
 * 这个模块做的第一件事只有一件：**把连通性算出来**。
 *   · 从每座主城出发，沿陆地 BFS，标出"和老家连着的陆地格"；
 *   · 城 / 前哨 / 野地按自己那格看是否在连通区里，以及离主城多少跳；
 *   · 断链 → 补给系数按跳数递减（暂不落地，见下）。
 *
 * ⚠️ **第一版只算不罚**（`DATA.LAND.apply = false`）。
 *   理由不是保守，是这个项目踩过太多次"新系统一上来就改老数值，
 *   结果分不清是玩法不成立还是老系统被弄坏"。
 *   先把连通性算准、显示对，确认它与真实地理一致，
 *   再打开那一个开关（`apply`）让它真扣 —— 那时只需要改一行。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var LD = GAME.land = {};

  function D() { return (GAME.DATA && GAME.DATA.LAND) || {}; }
  function SP() { return (GAME.sphereOf ? GAME.sphereOf()
    : (GAME.mapSphere || GAME.sphere))   /* v98.6：`GAME.sphereOf()` 是**既有**出口（state.js：按 pid 取那颗星球的球面，
      默认当前星球 → 返回有 cells 的 GAME.sphere）。
      原来的 `GAME.mapSphere || GAME.sphere` 在玩家**还没打开地图**时是致命的：
      mapSphere 对象存在但没 build，`||` 不生效 → 拿到空球 → 村社/遗迹/势力/竞争者全空。 */; }
  /* 主城判定：走**既有**出口 `isMainCity`（`city.isMain` 是另一套、口径不同）。
     v94.1 踩过：用 city.isMain 判主城，结果自家唯一那座城被算成"断链"。 */
  function isMain(c) {
    if (!c) return false;
    if (GAME.isMainCity) return !!GAME.isMainCity(c);
    return !!(c && (c.isMain || c.id === 1));
  }

  /* 连通区缓存：城市集合或星球变了才重算 */
  var _sig = '', _map = null, _main = null;

  function sigNow() {
    var s = SP();
    if (!s || !s.cells) return '';
    var n = s.cells.length;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    var ids = [];
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (c && c.ci != null && isMain(c)) ids.push(c.ci);
    });
    return sd + ':' + n + ':' + ids.sort().join(',');
  }

  /* ============================================================
   * build —— 从所有主城同时 BFS（多源，一次遍历）
   * ------------------------------------------------------------
   * 为什么多源：玩家可能已经有好几座"主城级"的城（占了名城），
   * 分别 BFS 会重复走同一片陆地；多源一次就够，得到的是
   * "到最近一座主城的跳数"，正是补给线要的那个数。
   * ============================================================ */
  function build() {
    var s = SP();
    if (!s || !s.cells) return { dist: null, n: 0 };
    var n = s.cells.length;
    var dist = new Int32Array(n);
    for (var i = 0; i < n; i++) dist[i] = -1;
    var mains = [], _all = (GAME.city && GAME.city.all ? GAME.city.all() : []);
    _all.forEach(function (c) {
      if (c && c.ci != null && c.ci >= 0 && c.ci < n && isMain(c)) mains.push(c.ci);
    });
    /* ⚠️ 兜底：主城标记可能对不上（`mainCityId` 与实际城 id 不是一路；
       还有"占了名城改名主城"之类）。找不到主城时用**第一座城**当老家 ——
       宁可把连通性算得宽一点，也不要让玩家看到"我唯一的城断链了"。 */
    if (!mains.length && _all[0] && _all[0].ci >= 0 && _all[0].ci < n) mains.push(_all[0].ci);
    if (!mains.length) return { dist: dist, n: 0, mains: [] };
    var maxH = D().maxHops || 14;
    var q = mains.slice(), head = 0;
    mains.forEach(function (ci) { dist[ci] = 0; });
    while (head < q.length) {
      var cur = q[head++], d = dist[cur] + 1;
      if (d > maxH) break;
      var nb = (s.adj && s.adj[cur]) || [];
      for (var j = 0; j < nb.length; j++) {
        var x = nb[j];
        if (dist[x] >= 0) continue;
        var cell = s.cells[x];
        if (!cell || cell.type === 'lake') continue;      /* ⚠️ 海是 'lake'，不是 'sea' */
        dist[x] = d;
        q.push(x);
      }
    }
    return { dist: dist, n: n, mains: mains };
  }

  LD.ensure = function (force) {
    var sg = sigNow();
    if (!force && _map && _sig === sg) return _map;
    _sig = sg;
    _map = build();
    return _map;
  };

  LD.reset = function () { _sig = ''; _map = null; };

  /* ============================================================
   * statusOf —— 这一格/这座城的补给状态
   * ------------------------------------------------------------
   * hops = 到最近主城的陆地跳数（-1 = 断链，隔着海或太远）。
   * mul  = 补给系数。`apply` 关着的时候恒为 1（只显示不扣）。
   * ============================================================ */
  LD.statusOf = function (entity) {
    var m = LD.ensure();
    if (!m || !m.dist) return { linked: true, hops: 0, mul: 1, apply: false };
    var ci = (entity && entity.ci != null) ? entity.ci : -1;
    var hops = (ci >= 0 && ci < m.dist.length) ? m.dist[ci] : -1;
    /* 主城自己没有"断链"这回事 */
    if (isMain(entity)) hops = 0;
    var linked = hops >= 0;
    var mul = 1;
    if (linked && hops > 0) {
      mul = Math.max(D().minMul == null ? 0.35 : D().minMul,
        1 - hops * (D().hopPenalty == null ? 0.10 : D().hopPenalty) * 0.1);
      /* 每跳扣 1%（hopPenalty 的十分之一），14 跳才到 0.86 —— 淡，
         因为"断链"才是重点，"远"只是次要的补给摩擦。 */
    }
    if (!linked) mul = D().minMul == null ? 0.35 : D().minMul;
    if (!D().apply) mul = 1;
    return { linked: linked, hops: hops, mul: mul, apply: !!D().apply };
  };

  /* 全境补给体检：给行政页一行 */
  LD.stats = function () {
    var out = { total: 0, cut: 0, far: 0, worst: null };
    var s = SP();
    if (!s) return out;
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      out.total++;
      var st = LD.statusOf(c);
      if (!st.linked) {
        out.cut++;
        if (!out.worst) out.worst = { name: c.name, hops: -1 };
      } else if (st.hops > 0) {
        out.far++;
        if (!out.worst || out.worst.hops < st.hops) out.worst = { name: c.name, hops: st.hops };
      }
    });
    return out;
  };

  LD.lineOf = function () {
    var a = LD.stats();
    if (!a.total) return '';
    if (!a.cut && !a.far) return '🛣 全境补给：都连着老家';
    if (!a.cut) return '🛣 全境补给：' + a.total + ' 城都连着（最远 ' + a.worst.hops + ' 跳）';
    return '🛣 全境补给：' + a.cut + ' 城与老家断了陆路'
      + (a.worst && a.worst.hops < 0 ? '（最近的断点：' + a.worst.name + '）' : '');
  };

  /* 单城一行（城面板用） */
  LD.cityLine = function (city) {
    var st = LD.statusOf(city);
    if (!city) return '';
    /* 返回值**不带图标**：调用方已经在 key 栏放了 🛣（城面板）。 */
    if (st.linked && st.hops === 0) return '老家';
    if (st.linked) return '连着老家（' + st.hops + ' 跳）';
    return '<span style="color:var(--red-light);">断链</span>（隔着水或太远，走不过去）';
  };
})();
