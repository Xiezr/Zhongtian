/* ============================================================
 * founding.js — 开城（v103 · 老板 2026-10-22）
 * ------------------------------------------------------------
 * 老板原话：
 *   「有没有想过一开始甚至没有尝试，只是君主挑战升级，然后到了某个阶段，
 *     突然想到了要开一座城来庇护天下人？」
 *
 * 现状正好相反：开局 200 人、五仓各 20000、五块地、一座城 ——
 * 玩家从第一秒就是城主，「庇护天下人」是默认前提，而不是一个念头。
 *
 * 全盘推翻开局不现实（55 个模块都假设 cities[0] 存在）。所以这里只补**那个时刻**：
 *
 *   城外的棚户（growth.js v93.5）挤到居所上限的六成半时，
 *   这批人本来会自己走远搭个村子 —— 变成**别人的**村子。
 *   现在先问你一句：让他们走，还是带他们去开一座城？
 *
 *   · 你说"带他们去" → 附近找一块能筑城的平原，落一座新城，人搬过去。
 *     花的是木石铁（比纯花钱筑城便宜 —— 人就是本钱）。
 *   · 你说"让他们走" → 什么都不做，growth 的既有逻辑照旧把他们变成 NPC 村。
 *
 * 为什么这个时刻值得有：
 *   玩家按下去之前，"庇护"这个词对他没有对象；按下去之后，
 *   城里有一批**因为他决定才活下来**的人。这个念头是他自己长出来的，
 *   不是开局旁白派给他的。
 *
 * ⚠️ 刻意不动的东西：
 *   · 不改开局人口/资源/城数（那会推翻几十条断言，且不是本模块要解决的问题）。
 *   · 不改 growth.js 的自动行为（不开这个口子，世界照旧自己开垦）。
 *   · 不写任何"你要守护他们"之类的话 —— 老板：玩家不要背负太多。
 *     面板只写人数、价钱、去哪儿。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var FD = GAME.found = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.FOUND) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.found || typeof s.found !== 'object') s.found = { offer: null, done: 0 };
    if (!Array.isArray(s.found.history)) s.found.history = [];
    return s.found;
  }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  function SP() {
    return (GAME.sphereOf ? GAME.sphereOf() : GAME.sphere);
  }

  /* ============================================================
   * 一、该不该问这一句
   * ------------------------------------------------------------
   * 条件只有两条：棚户挤到六成半以上、人数够走（60 人以下走不了多远）。
   * 加一条冷却：同一座城问过一次，六个月内不再问 —— 否则玩家说"让他们走"，
   * 下个月同样的问题又弹一次，那就不叫选择，叫骚扰。
   * ============================================================ */
  FD.offerOf = function (city, m) {
    if (!city || !GAME.growth) return null;
    var d = D();
    var sh = GAME.growth.shantyOf(city);
    var cap = GAME.growth.shantyCapOf(city);
    if (!cap) return null;
    var need = cap * (d.atShanty == null ? 0.65 : d.atShanty);
    if (sh < need) return null;
    if (sh < (d.minMovers == null ? 60 : d.minMovers)) return null;
    var mm = (m == null ? monthNow() : m);
    if (city._foundAt != null && mm - city._foundAt < 6) return null;
    var share = d.moverShare == null ? 0.6 : d.moverShare;
    return {
      cid: city.id,
      name: city.name,
      shanty: sh,
      cap: cap,
      movers: Math.max(20, Math.round(sh * share)),
      month: mm
    };
  };

  /* ============================================================
   * 二、找地
   * ------------------------------------------------------------
   * **遍历自己的野地**，不在全图上抽样：
   * 40962 格里我方野地可能只有十几块，抽样 2000 次命中不到两次
   * （village v93.5 在球面环带上踩过同一个坑）。
   * 地理判据只有一份：`GAME.canBuildCityGeo`（domain.js v103 新抽出来的）。
   * ============================================================ */
  FD.spotNear = function (fromCi) {
    var st = GAME.state, d = D();
    if (!st || !GAME.canBuildCityGeo) return null;
    var s = SP();
    var list = st.wilds || [];
    var minD = d.minDist == null ? 2 : d.minDist;
    var maxD = d.maxDist == null ? 14 : d.maxDist;
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (!w || w.ci == null) continue;
      if (!GAME.canBuildCityGeo(w.ci).ok) continue;
      var dist = (s && s.distOf && fromCi != null) ? s.distOf({ ci: fromCi }, { ci: w.ci }) : 1;
      if (dist < minD || dist > maxD) continue;
      if (!best || dist < best.dist) best = { ci: w.ci, dist: dist };
    }
    return best;
  };

  /* ============================================================
   * 三、带他们去开城
   * ------------------------------------------------------------
   * 复用 `GAME.buildCityAt(ci, cost)`（v103 起它能吃自定义价钱）——
   * 落城、入库、清野地、写日志全走同一份逻辑，这里不复制。
   * ============================================================ */
  FD.take = function (city) {
    var st = GAME.state, d = D();
    if (!st || !city) return { ok: false, msg: '没有城' };
    var of = FD.offerOf(city);
    if (!of) return { ok: false, msg: '现在没有要走的人' };
    var spot = FD.spotNear(city.ci);
    if (!spot) {
      return { ok: false, msg: '周围没有能筑城的平原 —— 先去占一块空地（野地 · 平原）' };
    }
    var cost = d.cost || GAME.BUILD_CITY_COST;
    var r = GAME.buildCityAt(spot.ci, cost);
    if (!r.ok) return r;
    var nc = r.city;

    /* 人搬进新城 —— 但新城刚落地，居所装不下就装不下。
       装不下的留在老家棚户里（他们至少还活着），不硬塞、不蒸发。 */
    var movers = of.movers;
    var room = 0;
    if (nc) {
      var capN = GAME.effPopCapOf ? GAME.effPopCapOf(nc) : (GAME.maxPopOf ? GAME.maxPopOf(nc) : 0);
      room = Math.max(0, capN - ((nc.res && nc.res.pop) || 0));
    }
    var inN = Math.min(movers, room);
    if (nc && inN > 0) GAME.city.add(nc, 'pop', inN);
    city.shanty = Math.max(0, (city.shanty | 0) - inN);
    city.shantyAt = 0;
    city._foundAt = monthNow();

    var bag = st0();
    if (bag) {
      bag.offer = null;
      bag.done = (bag.done | 0) + 1;
      bag.history.push({ at: monthNow(), from: city.id, to: nc ? nc.id : null, n: inN, dist: spot.dist });
      if (bag.history.length > 20) bag.history = bag.history.slice(-20);
    }

    if (GAME.log && GAME.log.war) {
      GAME.log.war('🏯 ' + U.numText(inN, 0) + ' 人跟着你离开' + city.name
        + '城外的棚户区，在 ' + spot.dist + ' 格外扎了「' + (nc ? nc.name : '新城') + '」。'
        + (movers > inN ? '还有 ' + U.numText(movers - inN, 0) + ' 人没挤进去，先留在原地。' : ''));
    }
    return {
      ok: true,
      msg: '开城了：' + (nc ? nc.name : '新城') + '（搬过去 ' + U.numText(inN, 0) + ' 人）',
      city: nc, moved: inN
    };
  };

  /* 让他们自己走：不做事，只把这一句压下去（growth 的既有逻辑接手）。 */
  FD.release = function (city) {
    if (!city) return { ok: false, msg: '没有城' };
    city._foundAt = monthNow();
    var bag = st0();
    if (bag && bag.offer && bag.offer.cid === city.id) bag.offer = null;
    return { ok: true, msg: '你没有留他们。他们要往哪走，就是他们自己的事了。' };
  };

  /* ============================================================
   * 四、每月一次：谁家该问了
   * ------------------------------------------------------------
   * 只维护一个 offer（最挤的那座城）—— 面板上同时挂三座城的"要不要开城"
   * 是噪音，不是选择。
   * ============================================================ */
  FD.tick = function () {
    var st = GAME.state;
    if (!st) return;
    var bag = st0();
    if (!bag) return;
    var m = monthNow();
    var cities = st.cities || [];
    var best = null;
    for (var i = 0; i < cities.length; i++) {
      var of = FD.offerOf(cities[i], m);
      if (!of) continue;
      if (!best || of.shanty > best.shanty) { best = of; best.cid = cities[i].id; best.city = cities[i]; }
    }
    if (best) {
      bag.offer = { cid: best.cid, name: best.name, shanty: best.shanty, cap: best.cap,
        movers: best.movers, month: m };
    } else if (bag.offer) {
      /* 人散了/搬回去了/已经开了城 —— 清掉，别留一个指向空气的按钮 */
      var cur = null;
      for (var j = 0; j < cities.length; j++) if (cities[j].id === bag.offer.cid) cur = cities[j];
      if (!cur || !FD.offerOf(cur, m)) bag.offer = null;
    }
  };

  FD.offer = function () {
    var bag = st0();
    return bag ? bag.offer : null;
  };
  FD.monthNow = monthNow;
  FD.cityOfOffer = function () {
    var of = FD.offer();
    if (!of || !GAME.city || !GAME.city.byId) return null;
    return GAME.city.byId(of.cid) || null;
  };
  FD.costText = function () {
    var c = D().cost || {};
    return ['wood', 'stone', 'iron', 'gold', 'grain'].filter(function (k) { return c[k] > 0; })
      .map(function (k) { return (GAME.resName ? GAME.resName(k) : k) + ' ' + U.fmt(c[k]); })
      .join(' · ');
  };

/* ============================================================
 * v100 注册表（可插拔）：界面块 + 动作都从模块自己声明
 * ctx = { sec, U, cities, c0, toast, refresh }
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'founding',
    order: 15,
    tick: function () { FD.tick(); },
    panel: function (ctx) {
      /* ⚠️ sec 是 ui.js 的局部函数 —— 模块里必须从 ctx 取 */
      var sec = ctx.sec;
      var of = FD.offer();
      if (!of) return '';
      return sec('🏯 该不该开一座城', '城外的人已经挤到放不下了',
        '<div style="margin-top:2px;"><b>' + U.escape(of.name) + '</b> 城外的棚户 '
        + U.numText(of.shanty, 0) + ' / ' + U.numText(of.cap, 0) + ' 人 —— 再挤下去，'
        + '他们会自己走远搭个村子（那就是**别人的**村子了）。</div>'
        + '<div class="ui-sub" style="margin-top:4px;">带走 '
        + U.numText(of.movers, 0) + ' 人开一座城，要 ' + FD.costText() + '</div>'
        + '<div class="chips" style="margin-top:5px;">'
        + '<span class="chip" data-action="found-take">带他们去开一座城</span>'
        + '<span class="chip" data-action="found-wait">让他们自己走</span></div>');
    },
    actions: {
      'found-take': function (el, ctx) {
        var r = FD.take(FD.cityOfOffer());
        ctx.toast(r.msg); ctx.refresh();
      },
      'found-wait': function (el, ctx) {
        var r = FD.release(FD.cityOfOffer());
        ctx.toast(r.msg); ctx.refresh();
      }
    }
  });
}

})();
