/* ============================================================
 * surge.js — 会收缩的圈（v94.1 · 构想 E「大逃杀收缩圈」）
 * ------------------------------------------------------------
 * 提案原文：「辐射云收缩，被迫向中心迁移 —— 给扩张一个时间压力」。
 *
 * 现状：这个游戏**没有时间压力**。
 *   你可以一百万年后再去打那座城，地图上的东西一个都不会少。
 *   所以"什么时候动手"不是决策 —— 因为它没有代价。
 *
 * 这个模块给的是一件事：**外围会慢慢变得不能住人**。
 *   · 圈心 = 你所有城的重心（不是球心：玩家在哪，"文明"就在哪）；
 *   · 半径按月往回收，收到 minR 就停（不把人逼死）；
 *   · 每收缩 12 个月停 3 个月 —— 有节奏，玩家能预见下一次收缩；
 *   · 留在云里的城：棚户死、人口慢慢流失；村社整村迁走。
 *
 * ⚠️ 这是"压力"不是"失败条件"：没有全灭、没有读秒，
 *   只是**离中心越远，越难维持**。玩家可以选择不搬，代价是慢慢变少。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var SG = GAME.surge = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.SURGE) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  }

  /* ============================================================
   * centerOf —— 圈心
   * ------------------------------------------------------------
   * 用所有己方城的世界坐标重心。没有城时退回地图原点。
   * 为什么不用球心：球心在海上也没关系，但"文明的中心"是玩家自己定的 ——
   * 你把家搬到哪，圈就围着哪收。这让"搬家"变成一个有意义的选择。
   * ============================================================ */
  SG.centerOf = function () {
    /* ⛔ v157.41（设定深挖发现的死设定）：原来这里每次返回**所有城的质心** ——
       圈永远以你自己为中心收缩，所以无论 minR 调多少都追不上你。
       实测：快进 25 年，圈缩到 minR=14 就停，而首城距圈心恒为 0，`inCloud` 永远 false。
       改成：**圈心在第一次计算时钉死**（= 开局时你家的位置），之后不再移动。
       于是"守中心 vs 扩张"第一次成为真选择：跑到 55 格外就会被云追上。 */
    var st = GAME.state;
    if (st && st.surgeCenter && st.surgeCenter.n) return st.surgeCenter;
    var arr = (GAME.city && GAME.city.all ? GAME.city.all() : []);
    var n = 0, sx = 0, sy = 0;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c || c.x == null || c.y == null) continue;
      sx += c.x; sy += c.y; n++;
    }
    if (!n) return { x: 0, y: 0, n: 0 };
    var got = { x: sx / n, y: sy / n, n: n };
    if (st) st.surgeCenter = { x: got.x, y: got.y, n: got.n };
    return got;
  };

  /* 当前收缩进度：已经收缩了几个月（跳过停歇期） */
  SG.shrinkMonths = function (m) {
    var d = D();
    var on = Math.max(1, d.pauseMonths || 12);
    var off = Math.max(0, d.pauseFor == null ? 3 : d.pauseFor);
    var cycle = on + off;
    var mm = Math.max(0, m == null ? monthNow() : m);
    return Math.floor(mm / cycle) * on + Math.min(on, mm % cycle);
  };

  SG.rOf = function (m) {
    var d = D();
    var r = (d.startR == null ? 55 : d.startR) - SG.shrinkMonths(m) * (d.shrinkPerMonth == null ? 0.9 : d.shrinkPerMonth);
    return Math.max(d.minR == null ? 14 : d.minR, Math.round(r * 10) / 10);
  };

  SG.rNow = function () { return SG.rOf(monthNow()); };

  /* 某点离圈心多远（格）
     ⚠️ 用世界格坐标的切比雪夫距离，不用 `sphere.hexDistAt`：
        后者是一次 BFS，这里要按月对**每座城 + 每处村社**算一遍，
        100 城 + 250 村的月度结算会直接把 tickOnce 顶穿（实测 271ms）。
        圈是"慢慢收的大圈"，±1 格的误差对它没有意义。 */
  SG.distOfPoint = function (x, y) {
    var c = SG.centerOf();
    if (!c.n) return 0;
    return Math.max(Math.abs((x || 0) - c.x), Math.abs((y || 0) - c.y));
  };

  SG.inCloud = function (x, y) { return SG.distOfPoint(x, y) > SG.rNow(); };

  SG.cityInCloud = function (city) {
    if (!city || city.x == null) return false;
    return SG.inCloud(city.x, city.y);
  };

  /* 还有多少个月就收到底（给玩家一个"还能在外围待多久"的数） */
  SG.monthsLeft = function () {
    var d = D();
    var cur = SG.rNow(), min = d.minR == null ? 14 : d.minR;
    var per = d.shrinkPerMonth == null ? 0.9 : d.shrinkPerMonth;
    if (per <= 0 || cur <= min) return 0;
    return Math.ceil((cur - min) / per);
  };

  /* ============================================================
   * tick —— 每月：云里的城交账
   * ============================================================ */
  SG.tick = function (force) {
    var st = GAME.state;
    if (!st) return null;
    var m = monthNow();
    if (!force && st.surgeMonth === m) return null;
    if (st.surgeMonth == null) { st.surgeMonth = m; return { first: true, month: m }; }
    st.surgeMonth = m;

    var d = D();
    var r = SG.rOf(m);
    var out = { month: m, r: r, cities: 0, died: 0, fled: 0, popLost: 0 };

    /* ① 云里的城 */
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      if (!SG.cityInCloud(c)) {
        /* 离开云 → 清掉"已公告"标记，下次再进云会重新提示一次（不跨城共享） */
        if (st.surgeAnnounced) delete st.surgeAnnounced[c.id];
        return;
      }
      out.cities++;

      /* 棚户先死（外面没有遮蔽，也没有人给他们送水） */
      var sh = (GAME.growth && GAME.growth.shantyOf) ? GAME.growth.shantyOf(c) : 0;
      if (sh > 0) {
        var die = Math.round(sh * (d.shantyLoss == null ? 0.10 : d.shantyLoss));
        c.shanty = Math.max(0, sh - die);
        out.died += die;
      }
      /* 人口慢慢流失：走的人比死的人多（他们要往圈里搬） */
      var R = GAME.res(c);
      var pop = R.pop || 0;
      if (pop > 1) {
        var lose = Math.max(0, Math.round(pop * (d.popLoss == null ? 0.002 : d.popLoss)));
        if (lose > 0) { R.pop = Math.max(1, pop - lose); out.popLost += lose; }
      }
      /* v157.62：公告只在「首次进云」触发一次。
         原写法：每条城每月重发同一条 → 永久在云里的城每月刷一条系统消息
         （GAME.log 自带的 1 游戏日去重窗口远小于 1 月，拦不住 → 这就是"重复发布"）。
         月度掉人 / 掉棚户照常发生，但不再刷屏；玩家仍可在辐射云面板看到「N 座城已在云里」。
         若某城 id 缺失则回退到名字键，避免多城共享同一标记而漏提示。 */
      if (GAME.log && GAME.log.war) {
        if (!st.surgeAnnounced) st.surgeAnnounced = {};
        var _key = (c.id != null) ? c.id : ('_' + (c.name || '?'));
        if (!st.surgeAnnounced[_key]) {
          st.surgeAnnounced[_key] = 1;
          GAME.log.war('☁ ' + c.name + '已经落在辐射云里（离圈心 ' + Math.round(SG.distOfPoint(c.x, c.y))
            + ' 格 > 圈 ' + r + ' 格）—— 人会一点一点往里搬。');
        }
      }
    });

    /* ② 云里的村社整村迁走 */
    if (GAME.village && GAME.village.listAll && GAME.sphere) {
      var list = GAME.village.listAll();
      for (var i = 0; i < list.length; i++) {
        var vci = list[i];
        var pos = null;
        if (GAME.map && GAME.map.cellPos) pos = GAME.map.cellPos(vci);
        if (!pos) {
          /* 没有坐标出口就用球面经纬度换算（村社本来就有 ci） */
          var cell = GAME.sphere.cellOf ? GAME.sphere.cellOf(vci) : null;
          if (cell && cell.lon != null && GAME.sphere.xyOfLonLat) {
            var xy = GAME.sphere.xyOfLonLat(cell.lon, cell.lat);
            pos = xy ? { x: xy.x, y: xy.y } : null;
          }
        }
        if (!pos) continue;
        if (!SG.inCloud(pos.x, pos.y)) continue;
        var rec = GAME.village.peek ? GAME.village.peek(vci) : null;
        if (!rec || rec.dead || rec.heldBy) continue;
        var n = Math.max(1, Math.round((rec.pop || 0) * (d.villageLoss == null ? 0.05 : d.villageLoss)));
        rec.pop = Math.max(0, (rec.pop || 0) - n);
        if (rec.pop <= 0) rec.dead = 'surge';
        out.fled += n;
      }
    }
    return out;
  };

  /* ---------- 只读出口 ---------- */
  SG.lineOf = function () {
    var r = SG.rNow();
    var left = SG.monthsLeft();
    var n = 0;
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (SG.cityInCloud(c)) n++;
    });
    return '☁ 辐射云：圈 ' + r + ' 格'
      + (n ? '　<span style="color:var(--red-light);">' + n + ' 座城已在云里</span>' : '')
      + (left > 0 ? '　<span style="color:var(--text-dim);">还会继续收（约 ' + left + ' 个月到最紧）</span>'
        : '　<span style="color:var(--gold-light);">已收到最紧，不再收</span>');
  };
})();
