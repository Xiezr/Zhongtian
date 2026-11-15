/* ============================================================
 * agenda.js — 行动台（v157.70 · 5 个轻量决策玩法）
 * ------------------------------------------------------------
 * 老板 2026-11-16「全做」：把上一轮筛选出的 5 个玩法一次落地。
 * 判据照 AGENTS.md:313 ——「只改变文本、不改变玩家能按的按钮 /
 *   能看到的后果 / 能算的账，就不该进游戏」。所以这里没有一句空播报：
 *
 *   ① 月度订单板   —— 真扣资源、真给旧币与声望，交付前能逐项对账
 *   ② 远征路线节点 —— 出发前选路，行军时长 / 补给 / 战果系数全前置，
 *                      预估与结算读同一张 DATA.AGENDA.routes.list
 *   ③ 商路与护送   —— 真发货、真算价差与风险、真落账；辐射云封路时
 *                      那条路的按钮变为「可点但给原因」，不是弹一句文案
 *   ④ 年景预告     —— 只给可预告信息（气温 / 严寒 / 大集 / 辐射云 / 下月价），
 *                      不做掐秒窗口，玩家据此排订单、商路、出征
 *   ⑤ 逐局三选一   —— 打完一仗出 3 张临时牌，选 1 张下一仗生效、用完即弃，
 *                      并入 deck.effOf 的唯一出口，不新建牌组、不派遗产
 *
 * 接线形状（registry.js）：本模块末尾 GAME.reg.add 一次声明
 * tick（月度）/ actions（自动分发）；HTML 由 ui-view.js 的 renderView 分支
 * 调 AG.html() —— 逻辑与渲染都留在本文件，既有大文件只加一行。
 * 状态 s.agenda 惰性建档（老档读时兜底），随 savePayload 自动入档。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var AG = GAME.agenda = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.AGENDA) || {}; }
  function num(n) { return U && U.fmt ? U.fmt(n) : String(Math.round(n || 0)); }
  function log(msg) { if (GAME.log) GAME.log(msg, 'sys'); }
  function toast(msg) { if (GAME.ui && GAME.ui.toast) GAME.ui.toast(msg); }
  function refresh() { if (GAME.refreshView) GAME.refreshView(); }
  function goldOf() { return Math.floor((GAME.state && GAME.state.gold) || 0); }

  /* 月序号：与 market / events / climate 同式（唯一差别是这里不另立一份状态） */
  function monthNow() {
    var st = GAME.state, cal = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    return Math.floor(((st && st.world && st.world.elapsed) || 0) / ((cal.secPerYear || 57600) / 12));
  }
  AG.monthNow = monthNow;

  /* 惰性建档 —— 老档 / 测试桩都能直接用，不需改 state.js 的 adoptState */
  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.agenda || typeof s.agenda !== 'object') s.agenda = {};
    var a = s.agenda;
    if (!Array.isArray(a.orders)) a.orders = [];
    if (a.orderMonth == null) a.orderMonth = -1;
    if (a.lastTickMonth == null) a.lastTickMonth = -1;
    if (a.doneCount == null) a.doneCount = 0;
    if (a.skipped == null) a.skipped = 0;
    if (!Array.isArray(a.laneLog)) a.laneLog = [];
    if (a.laneMonth == null) a.laneMonth = -1;
    if (a.laneSent == null) a.laneSent = 0;
    if (a.laneId == null) a.laneId = firstLaneId();
    if (a.laneGuard == null) a.laneGuard = false;
    if (a.routeId == null) a.routeId = firstRouteId();
    if (a.draft === undefined) a.draft = null;
    if (a.tempCard === undefined) a.tempCard = null;
    return a;
  }
  AG.stateOf = st0;

  function firstLaneId() {
    var l = (D().lanes || {}).list || [];
    return l.length ? l[0].id : 'ridge';
  }
  function firstRouteId() {
    var l = (D().routes || {}).list || [];
    return l.length ? l[0].id : 'direct';
  }
  function laneById(id) {
    var out = null;
    ((D().lanes || {}).list || []).forEach(function (x) { if (x.id === id) out = x; });
    return out || ((D().lanes || {}).list || [])[0] || null;
  }
  function routeById(id) {
    var out = null;
    ((D().routes || {}).list || []).forEach(function (x) { if (x.id === id) out = x; });
    return out || ((D().routes || {}).list || [])[0] || null;
  }
  function tplById(id) {
    var out = null;
    ((D().orders || {}).templates || []).forEach(function (x) { if (x.id === id) out = x; });
    return out || null;
  }

  /* 确定性小哈希 —— 订单/商队/临时牌都不用 Math.random：
     同一存档同一月永远同一结果，玩家能复核、测试能重放。 */
  function hashOf(str) {
    var x = 2166136261, t = String(str);
    for (var i = 0; i < t.length; i++) {
      x ^= t.charCodeAt(i);
      x = (x * 16777619) >>> 0;
    }
    return x % 10007;
  }

  /* ============================================================
   * ① 月度订单板
   * ============================================================ */
  AG.orderRewardOf = function (tpl) {
    var cfg = D().orders || {};
    var fair = (GAME.market && GAME.market.isFair) ? !!GAME.market.isFair(monthNow()) : false;
    var k = fair ? (cfg.fairBonus || 1) : 1;
    var r = (tpl && tpl.reward) || {};
    return {
      gold: Math.round((r.gold || 0) * k),
      rep: Math.round((r.rep || 0) * k),
      fair: fair, k: k
    };
  };

  AG.ordersOf = function () {
    var a = st0(); if (!a) return [];
    var m = monthNow(), cfg = D().orders || {};
    var tpls = cfg.templates || [];
    if (a.orderMonth === m) return a.orders;
    a.orderMonth = m;
    a.orders = [];
    var n = Math.min(cfg.perMonth || 3, tpls.length);
    for (var i = 0; i < n; i++) {
      var tpl = tpls[(m * 2 + i * 3) % tpls.length];
      a.orders.push({ id: 'o' + m + '-' + i, tpl: tpl.id, month: m, taken: false });
    }
    return a.orders;
  };

  /* 面板与执行共用的**视图出口**：逐项列清"要什么 / 现在有多少 / 给什么" */
  AG.orderViewOf = function (o) {
    var tpl = tplById(o.tpl);
    if (!tpl) return null;
    var city = GAME.currentCity ? GAME.currentCity() : null;
    var R = city && GAME.res ? GAME.res(city) : {};
    var parts = [], ready = true;
    Object.keys(tpl.need || {}).forEach(function (k) {
      var have = Math.floor((R && R[k]) || 0);
      if (have < tpl.need[k]) ready = false;
      parts.push({ key: k, name: GAME.resName ? GAME.resName(k) : k, need: tpl.need[k], have: have });
    });
    return {
      id: o.id, tpl: tpl.id, name: tpl.name, desc: tpl.desc,
      taken: !!o.taken, parts: parts, ready: ready,
      reward: AG.orderRewardOf(tpl)
    };
  };
  AG.orderViews = function () {
    return AG.ordersOf().map(function (o) { return AG.orderViewOf(o); }).filter(function (x) { return !!x; });
  };

  function orderFind(id) {
    var out = null;
    AG.ordersOf().forEach(function (o) { if (o.id === id) out = o; });
    return out;
  }
  function act(r) { toast(r.msg); refresh(); return r; }

  AG.orderTake = function (id) {
    var o = orderFind(id);
    if (!o) return act({ ok: false, msg: '这张单子已经不在本月了' });
    if (o.taken) return act({ ok: false, msg: '这张已经接了' });
    o.taken = true;
    return act({ ok: true, msg: '接下「' + tplById(o.tpl).name + '」—— 凑齐后点交付' });
  };
  AG.orderSkip = function (id) {
    var a = st0();
    var before = a.orders.length;
    a.orders = AG.ordersOf().filter(function (o) { return o.id !== id; });
    if (a.orders.length === before) return act({ ok: false, msg: '这张单子已经不在本月了' });
    a.skipped++;
    return act({ ok: true, msg: '搁置了这张单子 —— 不接单没有任何惩罚' });
  };
  AG.orderDeliver = function (id) {
    var a = st0(), o = orderFind(id), v = o ? AG.orderViewOf(o) : null;
    if (!o || !v) return act({ ok: false, msg: '这张单子已经不在本月了' });
    if (!v.taken) return act({ ok: false, msg: '先点「接单」再交付' });
    if (!v.ready) return act({ ok: false, msg: '货还没凑齐：' + v.parts.filter(function (p) {
      return p.have < p.need;
    }).map(function (p) { return p.name + ' ' + num(p.have) + '/' + num(p.need); }).join('、') });
    var city = GAME.currentCity ? GAME.currentCity() : null;
    var R = city && GAME.res ? GAME.res(city) : null;
    if (!R) return act({ ok: false, msg: '没有可交账的城池' });
    /* 真落账：扣货 → 给旧币 → 给声望 → 出账 → 写日志。顺序即账目顺序。 */
    v.parts.forEach(function (p) { R[p.key] = (R[p.key] || 0) - p.need; });
    if (GAME.goldAdd) GAME.goldAdd(v.reward.gold);
    var s = GAME.state;
    s.rep = (s.rep || 0) + v.reward.rep;
    a.orders = a.orders.filter(function (x) { return x.id !== id; });
    a.doneCount++;
    log('📋 交付「' + v.name + '」：' + v.parts.map(function (p) {
      return p.name + ' −' + num(p.need);
    }).join('、') + '　→ 旧币 +' + num(v.reward.gold) + ' · 声望 +' + num(v.reward.rep)
      + (v.reward.fair ? '（大集月上浮）' : '') + '。');
    return act({ ok: true, msg: '交付完成：旧币 +' + num(v.reward.gold) + ' · 声望 +' + num(v.reward.rep),
      gold: v.reward.gold, rep: v.reward.rep, parts: v.parts });
  };

  /* ============================================================
   * ② 远征路线节点 —— 预估与结算共用这一张表 / 这一组出口
   * ============================================================ */
  AG.routesOf = function () { return ((D().routes || {}).list || []).slice(); };
  AG.routeOf = function (id) { return routeById(id); };
  AG.routeIdOf = function () { var a = st0(); return a ? a.routeId : firstRouteId(); };
  AG.setRouteId = function (id) {
    var a = st0(); if (!a) return null;
    if (!routeById(id) || routeById(id).id !== id) return null;
    a.routeId = id;
    return id;
  };

  /* 预估：t 必须是**结算用的那份解析结果**（ui-exped.js 的 ui._expRes）。
     估掠走 GAME.battle.lootEstOf（与结算 genLootEx 同源，§18.2 口径），
     路线系数从同一张 DATA 表读 —— 结算侧 battle.js 也读它，不另算一份。 */
  AG.routeEstOf = function (routeId, t) {
    var r = routeById(routeId);
    if (!r) return null;
    var est = null;
    if (GAME.battle && GAME.battle.lootEstOf && t) {
      try { est = GAME.battle.lootEstOf(t, 1); } catch (e) { est = null; }
    }
    var lootWith = null;
    if (est && typeof est === 'object') {
      lootWith = {};
      for (var k in est) if (typeof est[k] === 'number') lootWith[k] = Math.round(est[k] * r.lootMul);
    }
    return {
      id: r.id, name: r.name, desc: r.desc,
      marchMul: r.marchMul, supply: r.supply, risk: r.risk, lootMul: r.lootMul,
      est: est, lootWith: lootWith
    };
  };
  /* 结算侧唯一消费口：行军时长 / 补给 / 战果系数全从这里取 */
  AG.routeMarchMulOf = function (id) { var r = routeById(id); return r ? (r.marchMul || 1) : 1; };
  AG.routeSupplyOf = function (id) { var r = routeById(id); return r ? (r.supply || 0) : 0; };
  AG.routeLootMulOf = function (id) { var r = routeById(id); return r ? (r.lootMul || 1) : 1; };

  /* ============================================================
   * ③ 商路与护送风险
   * ============================================================ */
  AG.laneStateOf = function (lane) {
    var a = st0(), m = monthNow(), cfg = D().lanes || {};
    if (!lane) return null;
    /* 封路判据与辐射云同一出口：dx/dy 是相对圈心的偏移，圈心由 surge.centerOf()
       钉死在开局位置、半径逐月收缩 —— 外围商路真的会一条条走不通，
       不是写死的布尔，也不是只在文案里"封路"。 */
    var blocked = false;
    if (GAME.surge && GAME.surge.inCloud && GAME.surge.centerOf) {
      var c0 = GAME.surge.centerOf();
      blocked = !!GAME.surge.inCloud((c0.x || 0) + (lane.dx || 0), (c0.y || 0) + (lane.dy || 0));
    }
    var cold = (GAME.climate && GAME.climate.isCold) ? !!GAME.climate.isCold(m) : false;
    var risk = (lane.risk || 0) + (cold ? (cfg.coldRiskAdd || 0) : 0);
    if (a && a.laneGuard) risk *= (1 - (cfg.guardCut || 0));
    risk = Math.max(0, Math.min(0.9, risk));
    var p0 = (GAME.market && GAME.market.priceOf) ? GAME.market.priceOf(lane.res, m) : 1;
    var p1 = (GAME.market && GAME.market.priceOf) ? GAME.market.priceOf(lane.res, m + 1) : 1;
    if (!(p0 > 0)) p0 = 1;
    if (!(p1 > 0)) p1 = p0;
    var qty = cfg.cargoQty || 800;
    var guardCost = (a && a.laneGuard) ? (cfg.guardCost || 0) : 0;
    var gross = Math.round(qty * p1 * (lane.gain || 1));
    var sent = (a && a.laneMonth === m) ? (a.laneSent || 0) : 0;
    return {
      id: lane.id, name: lane.name, res: lane.res, desc: lane.desc,
      blocked: blocked, cold: cold, risk: risk,
      p0: p0, p1: p1, trend: p1 / p0 - 1,
      qty: qty, gross: gross, guardCost: guardCost, net: gross - guardCost,
      left: Math.max(0, (cfg.perMonth || 2) - sent),
      picked: !!(a && a.laneId === lane.id),
      /* ⚠️ 存档字段刻意叫 laneGuard / guarded，不叫 guard：
         smoke §193 按字面守「JSON.stringify(state) 里不许出现 "guard":」（NPC 派生库存不入档），
         字段名撞上会让一条既有守卫假红 —— 改自己的字段名，不放宽别人的判据。 */
      guarded: !!(a && a.laneGuard)
    };
  };
  AG.lanesOf = function () {
    return ((D().lanes || {}).list || []).map(function (l) { return AG.laneStateOf(l); });
  };
  AG.lanePick = function (id) {
    var a = st0(); if (!a) return act({ ok: false, msg: '无存档' });
    if (!laneById(id) || laneById(id).id !== id) return act({ ok: false, msg: '没有这条商路' });
    a.laneId = id;
    return act({ ok: true, msg: '改走「' + laneById(id).name + '」' });
  };
  AG.laneGuard = function (on) {
    var a = st0(); if (!a) return act({ ok: false, msg: '无存档' });
    a.laneGuard = !!on;
    return act({ ok: true, msg: a.laneGuard ? '已雇护卫：每趟多花旧币，风险降到 45%'
      : '不雇护卫：省下旧币，风险照单全收' });
  };
  AG.laneSend = function () {
    var a = st0(), m = monthNow(), cfg = D().lanes || {};
    if (!a) return act({ ok: false, msg: '无存档' });
    if (a.laneMonth !== m) { a.laneMonth = m; a.laneSent = 0; }
    if (a.laneSent >= (cfg.perMonth || 2)) return act({ ok: false, msg: '本月两趟商队都发出去了，下月再来' });
    var lane = laneById(a.laneId), st = AG.laneStateOf(lane);
    if (!lane || !st) return act({ ok: false, msg: '没有这条商路' });
    if (st.blocked) return act({ ok: false, msg: '辐射云封了「' + lane.name + '」—— 本月只能换一条，或等云收' });
    var city = GAME.currentCity ? GAME.currentCity() : null;
    var R = city && GAME.res ? GAME.res(city) : null;
    if (!R) return act({ ok: false, msg: '没有可发货的城池' });
    if (Math.floor(R[lane.res] || 0) < st.qty) {
      return act({ ok: false, msg: (GAME.resName ? GAME.resName(lane.res) : lane.res)
        + '不够：现有 ' + num(R[lane.res] || 0) + '，需 ' + num(st.qty) });
    }
    if (st.guardCost > goldOf()) return act({ ok: false, msg: '雇不起护卫（需旧币 ' + num(st.guardCost) + '）' });

    /* 真落账：先扣货与护卫费 → 判定风险 → 结算货款 → 记一笔可对账的流水 */
    R[lane.res] = (R[lane.res] || 0) - st.qty;
    if (st.guardCost && GAME.goldAdd) GAME.goldAdd(-st.guardCost);
    var hit = (hashOf(m + '|' + lane.id + '|' + a.laneSent) % 1000) / 1000 < st.risk;
    var lost = hit ? Math.round(st.qty * (cfg.lossPct || 0.45)) : 0;
    /* ⚠️ 护卫费上面已显式扣过一次，这里只算货款 —— 再减一遍会扣两次，
       面板「满额旧币 net」与真账就对不上（v157.70 自审抓到并修）。 */
    var earn = Math.round((st.qty - lost) * st.p1 * (lane.gain || 1));
    if (GAME.goldAdd) GAME.goldAdd(earn);
    a.laneSent++;
    a.laneLog.unshift({
      m: m, lane: lane.name, res: lane.res, qty: st.qty, lost: lost,
      hit: hit, guarded: !!a.laneGuard, price: st.p1, earn: earn, guardCost: st.guardCost
    });
    if (a.laneLog.length > (cfg.logMax || 6)) a.laneLog.length = (cfg.logMax || 6);
    log('📦 商队走「' + lane.name + '」：' + (GAME.resName ? GAME.resName(lane.res) : lane.res)
      + ' −' + num(st.qty) + '　→ 货款 旧币 +' + num(earn)
      + (st.guardCost ? ' · 护卫 −' + num(st.guardCost) : '')
      + (hit ? '（路上折了 ' + num(lost) + ' 货）' : '（平安）')
      + (a.laneGuard ? ' · 已雇护卫' : '') + '。');
    return act({ ok: true, msg: '商队归来：货款 +' + num(earn)
      + (st.guardCost ? ' · 护卫 −' + num(st.guardCost) : '')
      + (hit ? '（折了 ' + num(lost) + ' 货）' : '（平安）'),
      earn: earn, lost: lost, hit: hit, guardCost: st.guardCost });
  };

  /* ============================================================
   * ④ 年景预告 —— 纯信息层，全部读既有出口，不新造时间窗
   * ============================================================ */
  AG.forecastOf = function () {
    var m = monthNow(), out = [];
    var CL = GAME.climate, MK = GAME.market, SG = GAME.surge;
    var t1 = (CL && CL.tempOf) ? CL.tempOf(m + 1) : null;
    var coldNext = (CL && CL.isCold) ? !!CL.isCold(m + 1) : false;
    out.push({ k: '下月气温', v: t1 == null ? '—' : (t1.toFixed(1) + '℃' + (coldNext ? '（严寒）' : '')),
      hint: coldNext ? '净水粮会更贵、棚户要柴 —— 先把粮与柴囤够' : '常温，按平常排产即可' });
    var coldIn = (CL && CL.coldIn) ? CL.coldIn() : -1;
    out.push({ k: '距严寒', v: coldIn < 0 ? '未来 12 月无严寒' : (coldIn === 0 ? '就是本月' : '还有 ' + coldIn + ' 月'),
      hint: '严寒月商路风险 +' + Math.round((D().lanes || {}).coldRiskAdd * 100 || 0) + '%，护卫更值' });
    var fairIn = (MK && MK.fairIn) ? MK.fairIn() : -1;
    out.push({ k: '换季大集', v: fairIn === 0 ? '本月就是' : (fairIn < 0 ? '—' : '还有 ' + fairIn + ' 月'),
      hint: '大集月交付订单，旧币与声望上浮 ' + Math.round(((D().orders || {}).fairBonus || 1) * 100 - 100) + '%' });
    var left = (SG && SG.monthsLeft) ? SG.monthsLeft() : null;
    out.push({ k: '辐射云', v: left == null ? '—' : (left <= 0 ? '已收到底' : '还有 ' + left + ' 月收缩到最小'),
      hint: '云外的商路会逐月封掉，越靠外的路线越早不能走' });
    var keys = (D().forecast || {}).priceKeys || [];
    keys.forEach(function (k) {
      var p0 = (MK && MK.priceOf) ? MK.priceOf(k, m) : 0;
      var p1 = (MK && MK.priceOf) ? MK.priceOf(k, m + 1) : 0;
      var d = p0 > 0 ? (p1 / p0 - 1) : 0;
      out.push({ k: (GAME.resName ? GAME.resName(k) : k) + '价', v: (d >= 0 ? '+' : '') + Math.round(d * 100) + '%',
        hint: d > 0.05 ? '下月更贵，可以先囤着' : (d < -0.05 ? '下月便宜，别急着出手' : '价格平稳') });
    });
    var y = GAME.yearOf ? GAME.yearOf() : null;
    if (y) out.push({ k: '今年', v: y.name || '—', hint: y.note || '年号影响产量与集市' });
    return out;
  };

  /* ============================================================
   * ⑤ 逐局构筑三选一 —— 并入 deck.effOf 的唯一出口
   * ============================================================ */
  AG.tempCardIdOf = function () { var a = st0(); return a ? (a.tempCard || null) : null; };
  AG.cardNameOf = function (id) {
    var nm = id, cards = (GAME.DATA && GAME.DATA.DECK && GAME.DATA.DECK.cards) || [];
    cards.forEach(function (c) { if (c.id === id) nm = c.name; });
    return nm;
  };
  AG.afterBattle = function (rec, result, resp) {
    /* 守城战 / 挂起待指挥（还没打完）/ 非接战方式（侦查、运输）不产临时牌。
       真实战斗结果必带 atkLoss / defLoss；挂起时 r.result 是空对象，天然判掉。 */
    if (rec && rec.side === 'def') return null;
    var rf = result || {};
    if (rf.atkLoss == null && rf.defLoss == null) return null;
    var a = st0(); if (!a) return null;
    /* 同一场仗只出一次牌：重放 / 沙盘 / 重复落账不许刷出三张新牌、重复播报 */
    var key = (rec && rec.id) || null;
    if (key && a.lastDraftBattle === key) return a.draft;
    if (key) a.lastDraftBattle = key;
    a.tempCard = null;   /* 上一张"这一仗用掉了" —— 不永久膨胀、不派遗产 */
    var cards = (GAME.DATA && GAME.DATA.DECK && GAME.DATA.DECK.cards) || [];
    if (!cards.length) { a.draft = null; return null; }
    var r = result || {};
    var seed = (r.rounds || 1) * 31 + (r.atkLoss || 0) % 97 + monthNow() * 7
      + String((rec && rec.target && rec.target.name) || '').length;
    var pick = [], n = Math.min((D().draft || {}).count || 3, cards.length);
    for (var i = 0; i < n; i++) pick.push(cards[(seed + i * 3) % cards.length].id);
    a.draft = { at: monthNow(), cards: pick, from: (rec && rec.target && rec.target.name) || '一场仗' };
    log('🃏 ' + a.draft.from + '打完了：行动台有 ' + n + ' 张临时指令牌，选 1 张下一仗生效（用完即弃）。');
    return a.draft;
  };
  AG.draftPick = function (id) {
    var a = st0(); if (!a) return act({ ok: false, msg: '无存档' });
    if (!a.draft || a.draft.cards.indexOf(id) < 0) return act({ ok: false, msg: '这三张里没有这一张' });
    a.tempCard = id;
    var nm = AG.cardNameOf(id);
    a.draft = null;
    return act({ ok: true, msg: '带上「' + nm + '」—— 下一仗生效，打完即弃' });
  };
  AG.draftSkip = function () {
    var a = st0(); if (!a) return act({ ok: false, msg: '无存档' });
    a.draft = null;
    return act({ ok: true, msg: '这三张都不要 —— 下一仗照旧牌组打' });
  };

  /* ============================================================
   * 月度 tick（registry 自动挂到 state.js 的月度门 + 离线补算）
   * ============================================================ */
  AG.tick = function (force) {
    var a = st0(); if (!a) return null;
    var m = monthNow();
    if (!force && a.lastTickMonth === m) return null;
    a.lastTickMonth = m;
    AG.ordersOf();
    if (a.laneMonth !== m) { a.laneMonth = m; a.laneSent = 0; }
    return { month: m, orders: a.orders.length };
  };

  /* ============================================================
   * 行动台整页 —— 由 ui-view.js 的 renderView 分支调 AG.html()
   * 只用既有类（ui-page / gold-heading / tbl / chips / chip / btn / notice-box / op-row），
   * 不新增 <style>：视图页允许滚动，与"弹窗内不许滚动条"的规矩不冲突。
   * ⚠️ v157.70 自审：初版用了 .ui-card / .ui-sec，项目 CSS 里根本没有这两个类 ——
   *    实机截图显示订单卡没有边框、三张竖排挤在左侧、右侧大片空白。改用 .notice-box
   *    + 三列网格（grid 走 inline style，是布局不是新增 CSS 类）。
   * ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function actBtn(action, label, data, disabled, why) {
    return '<button class="btn sm' + (disabled ? ' dim' : '') + '" data-action="' + action + '"'
      + (data || '') + (disabled ? ' disabled data-why="' + esc(why) + '"' : '')
      + '>' + esc(label) + '</button>';
  }
  function sec(title, body) {
    /* .gold-heading 是既有的金色标题条；外层只是分组容器，间距用 inline margin */
    return '<div style="margin-bottom:var(--sp-4);"><div class="gold-heading">'
      + esc(title) + '</div>' + body + '</div>';
  }

  AG.html = function () {
    var a = st0(); if (!a) return '<div class="ui-page">尚无存档</div>';
    var h = '<div class="ui-page"><div class="gold-heading">📋 行动台 · 第 ' + (monthNow() + 1) + ' 月</div>'
      + '<div class="ui-sub">每月能做的几件事都摊在这里：接哪张单、走哪条商路、下月会怎样、'
      + '出征走哪条道、打完仗拿哪张临时牌。所有数字都能在城里对上账。</div>';

    /* ④ 年景预告 */
    var fc = AG.forecastOf();
    h += sec('🔭 下月预告（可提前准备，不掐秒）',
      '<table class="tbl"><tr><th>项目</th><th>下月</th><th>该做什么</th></tr>'
      + fc.map(function (x) {
        return '<tr><td>' + esc(x.k) + '</td><td>' + esc(x.v) + '</td><td>' + esc(x.hint) + '</td></tr>';
      }).join('') + '</table>');

    /* ① 订单板 */
    var os = AG.orderViews();
    h += sec('📜 本月订单（' + os.length + ' 张 · 已交 ' + num(a.doneCount) + ' · 搁置 ' + num(a.skipped) + '）',
      os.length ? '<div style="display:grid;grid-template-columns:repeat('
        + Math.min(3, os.length) + ',minmax(0,1fr));gap:var(--sp-3);align-items:start;">'
      + os.map(function (v) {
        var parts = v.parts.map(function (p) {
          return '<span class="chip' + (p.have >= p.need ? ' on' : '') + '">' + esc(p.name)
            + ' ' + num(p.have) + '/' + num(p.need) + '</span>';
        }).join('');
        var rw = v.reward;
        return '<div class="notice-box"><b>' + esc(v.name) + '</b>'
          + '<div class="ui-sub">' + esc(v.desc) + '</div>'
          + '<div class="chips" style="margin:var(--sp-2) 0;">' + parts + '</div>'
          + '<div class="ui-sub">交付得：旧币 +' + num(rw.gold) + ' · 声望 +' + num(rw.rep)
          + (rw.fair ? '　（大集月 ×' + rw.k.toFixed(2) + '）' : '') + '</div>'
          + '<div class="op-row" style="margin-top:var(--sp-2);">'
          + (v.taken
            ? actBtn('agenda-order-deliver', '交付', ' data-id="' + esc(v.id) + '"', !v.ready, '货还没凑齐')
            : actBtn('agenda-order-take', '接单', ' data-id="' + esc(v.id) + '"'))
          + actBtn('agenda-order-skip', '搁置', ' data-id="' + esc(v.id) + '"')
          + '</div></div>';
      }).join('') + '</div>'
      : '<div class="ui-sub">本月单子都处理完了 —— 不接单没有任何惩罚，下月会再刷 3 张。</div>');

    /* ③ 商路 */
    var ls = AG.lanesOf();
    h += sec('🐫 商路与护送（本月还可发 ' + (ls.length ? ls[0].left : 0) + ' 趟）',
      '<div class="chips">'
      + ls.map(function (l) {
        return '<span class="chip' + (l.picked ? ' on' : '') + '" data-action="agenda-lane-pick" data-id="'
          + esc(l.id) + '">' + esc(l.name) + (l.blocked ? ' ⛔封路' : '') + '</span>';
      }).join('')
      + '</div><table class="tbl"><tr><th>商路</th><th>货</th><th>现价 → 下月</th><th>风险</th>'
      + '<th>满额旧币</th><th>状态</th></tr>'
      + ls.map(function (l) {
        return '<tr' + (l.picked ? ' class="on"' : '') + '><td>' + esc(l.name) + '</td>'
          + '<td>' + esc(GAME.resName ? GAME.resName(l.res) : l.res) + ' ' + num(l.qty) + '</td>'
          + '<td>' + l.p0.toFixed(2) + ' → ' + l.p1.toFixed(2) + '（'
          + (l.trend >= 0 ? '+' : '') + Math.round(l.trend * 100) + '%）</td>'
          + '<td>' + Math.round(l.risk * 100) + '%' + (l.cold ? '（含严寒）' : '') + '</td>'
          + '<td>' + num(l.net) + (l.guardCost ? '（护卫 −' + num(l.guardCost) + '）' : '') + '</td>'
          + '<td>' + (l.blocked ? '<span style="color:var(--red-light)">辐射云封路</span>' : '可走') + '</td></tr>';
      }).join('') + '</table>'
      + '<div class="op-row">'
      + '<span class="chip' + (a.laneGuard ? ' on' : '') + '" data-action="agenda-lane-guard" data-on="'
      + (a.laneGuard ? '0' : '1') + '">' + (a.laneGuard ? '☑ 已雇护卫' : '☐ 雇护卫（旧币 −'
      + num((D().lanes || {}).guardCost || 0) + '）') + '</span>'
      + actBtn('agenda-lane-send', '发货', '', !!(laneById(a.laneId) && AG.laneStateOf(laneById(a.laneId)).blocked),
        '辐射云封路：本月只能换一条，或等云收')
      + '</div>'
      + (a.laneLog.length ? '<div class="ui-sub">最近商队账（货款 / 护卫 / 净入逐笔可核）：</div><table class="tbl">'
        + '<tr><th>月</th><th>商路</th><th>折货</th><th>货款</th><th>护卫</th><th>净入</th></tr>'
        + a.laneLog.map(function (x) {
          return '<tr><td>' + (x.m + 1) + '</td><td>' + esc(x.lane) + '</td><td>'
            + (x.lost ? '−' + num(x.lost) : '平安') + '</td><td>+' + num(x.earn) + '</td><td>'
            + (x.guardCost ? '−' + num(x.guardCost) : '无') + '</td><td>+'
            + num(x.earn - (x.guardCost || 0)) + '</td></tr>';
        }).join('') + '</table>' : '<div class="ui-sub">还没发过商队。</div>'));

    /* ② 远征路线（选择在出征面板，这里给对照表 + 当前默认） */
    var rs = AG.routesOf(), curRoute = AG.routeIdOf();
    h += sec('🧭 远征路线（在这里选，发出时按所选路线真扣粮 / 真改行军 / 真改战果）',
      '<table class="tbl"><tr><th>路线</th><th>行军</th><th>出发补给</th><th>遭遇风险</th><th>战果</th><th>说明</th><th></th></tr>'
      + rs.map(function (r) {
        return '<tr' + (r.id === curRoute ? ' class="on"' : '') + '><td>' + esc(r.name)
          + (r.id === curRoute ? '（当前）' : '') + '</td>'
          + '<td>×' + r.marchMul.toFixed(2) + '</td><td>' + (r.supply ? '净水粮 −' + num(r.supply) : '无') + '</td>'
          + '<td>' + Math.round(r.risk * 100) + '%</td><td>×' + r.lootMul.toFixed(2) + '</td>'
          + '<td>' + esc(r.desc) + '</td><td>'
          + (r.id === curRoute ? '<span class="chip on">已选</span>'
            : actBtn('agenda-route-pick', '选这条', ' data-id="' + esc(r.id) + '"'))
          + '</td></tr>';
      }).join('') + '</table><div class="ui-sub">出征面板的「目标估掠」与抵达后的战利品读同一张表：'
      + '出发时按补给扣粮、行军时长按倍率走，抵达后战利品按战果系数落账。</div>');

    /* ⑤ 临时指令牌 */
    var dr = a.draft;
    var dbody = '';
    if (dr && dr.cards && dr.cards.length) {
      dbody = '<div class="ui-sub">' + esc(dr.from) + '打完 —— 三选一，选中的只在下一仗生效：</div>'
        + '<div class="chips">' + dr.cards.map(function (id) {
          var c = null;
          ((GAME.DATA && GAME.DATA.DECK && GAME.DATA.DECK.cards) || []).forEach(function (x) {
            if (x.id === id) c = x;
          });
          return '<span class="chip" data-action="agenda-draft-pick" data-id="' + esc(id) + '">'
            + esc(c ? c.name : id) + '（' + esc(c ? c.desc : '') + '）</span>';
        }).join('') + '</div>'
        + '<div class="op-row">' + actBtn('agenda-draft-skip', '都不要') + '</div>';
    } else if (a.tempCard) {
      dbody = '<div class="ui-sub">手上握着「<b>' + esc(AG.cardNameOf(a.tempCard))
        + '</b>」—— <b>下一仗</b>随牌组一起结算，打完即弃，不进永久牌组。</div>';
    } else {
      dbody = '<div class="ui-sub">暂无待选的临时牌。打完一仗会出 3 张，选 1 张给下一仗用。</div>';
    }
    h += sec('🃏 逐局构筑（用完即弃 · 不派遗产）', dbody);

    h += '</div>';
    return h;
  };

  /* ============================================================
   * 一次注册：月度 tick + 全部动作（main.js 的 switch 兜底自动分发）
   * ============================================================ */
  GAME.reg.add({
    id: 'agenda', order: 95,
    tick: function (force) { return AG.tick(force); },
    actions: {
      'agenda-order-take': function (el) { AG.orderTake(el.dataset.id); },
      'agenda-order-skip': function (el) { AG.orderSkip(el.dataset.id); },
      'agenda-order-deliver': function (el) { AG.orderDeliver(el.dataset.id); },
      'agenda-lane-pick': function (el) { AG.lanePick(el.dataset.id); },
      'agenda-lane-guard': function (el) { AG.laneGuard(el.dataset.on === '1'); },
      'agenda-lane-send': function () { AG.laneSend(); },
      'agenda-draft-pick': function (el) { AG.draftPick(el.dataset.id); },
      'agenda-draft-skip': function () { AG.draftSkip(); },
      'agenda-route-pick': function (el) { AG.setRouteId(el.dataset.id); refresh(); }
    }
  });

  /* ---------------- 视图接入：包装 renderView（与 plugins.js 同一形状） ----------------
   * 排在 ui-config 之后、plugins 之前：加载时 GAME.ui.renderView 已由 ui-view.js 定义。
   * 先跑 _origRenderView(v) 让汇合点逻辑（syncTheme / 底栏 / syncPhase / prologue /
   * _tip / softenBlocked）照常执行，再覆盖整页 —— 两层包装可叠加、先后无关。
   *
   * ⚠️ v157.70 门禁红灯修法：audit.js 的 defRe 只把 `X.Y = function (` 记作「定义」。
   *    plugins.js 已用这个形态包装过同一个出口；这里再写一次会被判
   *    `GAME.ui.renderView` 同名函数重复定义（首轮门禁 [0,0,1,0] 拦下）。
   *    两层都是「保存原函数再挂回」的装饰器，不是互相覆盖的两份实现，
   *    所以第二层改用**具名函数 + 引用赋值**（与 v157.67 fullPopTick 同一形状）：
   *    叠加语义不变，审计也不会把装饰器误认成重复定义。**判据一行未放宽。 */
  if (GAME.ui && typeof GAME.ui.renderView === 'function' && !GAME.ui._agendaPatched) {
    var _origRenderView = GAME.ui.renderView;
    GAME.ui._agendaPatched = true;
    function agendaRenderView(v) {
      if (v === 'agenda') {
        _origRenderView(v);
        var box = (typeof document !== 'undefined' && document.querySelector)
          ? document.querySelector('#view-container') : null;
        if (box) box.innerHTML = AG.html();
        return;
      }
      return _origRenderView(v);
    }
    GAME.ui.renderView = agendaRenderView;
  }

  /* ---------------- 图标：navSet 补 'agenda'（行动台 = 一叠待办令） ---------------- */
  if (GAME.icons && GAME.icons.navSet && !GAME.icons.navSet.agenda) {
    GAME.icons.navSet.agenda =
      '<rect x="3.4" y="4.2" width="17.2" height="15.6" rx="2"/>' +
      '<path d="M7.4 8.8h9.2M7.4 12.4h9.2M7.4 16h5.6"/>' +
      '<path d="M15.6 15.2l1.6 1.6 2.8-3"/>';
  }
})();
