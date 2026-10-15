/* ============================================================
 * play_600x.js — v89.90 「600× × 6h 全权限推演」驾驶舱
 * ------------------------------------------------------------
 * 目标：以游戏原生最高速档 600× 实跑 6 现实小时（= 225 游戏年），
 *       由一个「种田流玩家脑」驱动：建造 / 募兵 / 采集 / 秘境种田 /
 *       任务 / 门派 / 扩张 / 自动出征 / 战斗观战（一键自动）。
 *
 * 关键口径（与真人游玩一致）：
 *   · 1 tick = 现实 1 秒；每 tick 时间倍率 600×（tickOnce 内读 settings）
 *   · U.now / Date.now 重写为 **SIM 时钟**（+1s/tick）——使「按现实时间节流」
 *     的系统（自动出征 5 分钟、客栈批次、每日任务、岁贡）与真人 6 小时
 *     在线时一致地流逝
 *   · 地图 seed 固定（20260921）· 天气/掉落等保持真随机（真实游玩）
 *   · 战斗：观战挂起 → 让它在表上自然走数十秒 → 一键自动（真人点「自动战斗」）
 *
 * 用法：node play_600x.js [ticks] [tag]
 *   默认 21600 ticks（6h×600×=225 游戏年）；输出 .workbuddy/tmp/playtest600/<tag>/
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

var ARGV = process.argv.slice(2);
var MAXT = Math.max(96, Number(ARGV[0] || 21600));
var TAG  = ARGV[1] || 'main';
var OUT  = path.join(R, '.workbuddy/tmp/playtest600', TAG);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'checkpoints'), { recursive: true });

/* ---------- 0. SIM 时钟（先捕获原始计时器，再重写 Date.now） ---------- */
var _RealNow = Date.now.bind(Date);
var SIM_START_MS = Date.UTC(2026, 8, 21, 1, 0, 0);   /* 2026-09-21 09:00 +08:00 */
var simMs = SIM_START_MS;
Date.now = function () { return simMs; };
var TZ = 8 * 3600 * 1000;
function simClock() { return new Date(simMs + TZ).toISOString().replace('T', ' ').slice(0, 19); }

var tNow = 0;
var runBuf = [];
function RUN(s) {
  var line = '[sim ' + simClock() + ' | +' + (tNow / 60).toFixed(0) + 'min] ' + s;
  console.log(line); runBuf.push(line);
  if (runBuf.length >= 60) flushRun();
}
function flushRun() { if (runBuf.length) { fs.appendFileSync(path.join(OUT, 'run.log'), runBuf.join('\n') + '\n'); runBuf = []; } }

/* ---------- 1. 环境（DOM 桩）+ 模块加载 ---------- */
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
fs.readdirSync(path.join(R, 'story')).filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(path.join(R, 'story', f)); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils;

/* ---------- 2. 采集器：全量日志 / 错误 / 战报 / 快照 ---------- */
var SNAPS = path.join(OUT, 'snapshots.jsonl');
var BATTLES = path.join(OUT, 'battles.jsonl');
var EV = [], EVFLUSHED = 0;
G.onLog = function (msg) { EV.push({ t: tNow, gt: (G.state && G.state.world && G.state.world.elapsed) || 0, msg: msg }); };
function flushEv() {
  if (EV.length) {
    var buf = '';
    for (var i = 0; i < EV.length; i++) buf += JSON.stringify(EV[i]) + '\n';
    fs.appendFileSync(path.join(OUT, 'events.jsonl'), buf);
    EVFLUSHED += EV.length; EV = [];
  }
}
var ERRS = {}, ERRLIST = [], ERRN = 0;
function noteErr(tag, e) {
  ERRN++;
  var m = String((e && e.message) || e);
  var key = tag + ' | ' + m.slice(0, 140);
  if (!ERRS[key]) {
    ERRS[key] = { n: 0, first: tNow };
    if (ERRLIST.length < 300) ERRLIST.push({ tag: tag, msg: m, t: tNow, stack: String((e && e.stack) || '').split('\n').slice(1, 4).join(' | ') });
  }
  ERRS[key].n++;
}
function safeCall(tag, fn) { try { return fn(); } catch (e) { noteErr(tag, e); return null; } }
var SOFT = {};
function noteSoft(tag, msg) {
  var key = tag + '|' + String(msg).slice(0, 90);
  var rec = SOFT[key] || (SOFT[key] = { n: 0, last: -1e9 });
  rec.n++;
  if (tNow - rec.last > 1800 || rec.n <= 2) { rec.last = tNow; RUN('· ' + tag + '：' + msg + (rec.n > 2 ? '（第' + rec.n + '次）' : '')); }
}
/* 低频结构窥探（供分析时确认真实字段名） */
var DUMPED = {};
function dumpOnce(tag, obj, n) {
  if (DUMPED[tag]) return; DUMPED[tag] = 1;
  try { RUN('DUMP[' + tag + '] ' + JSON.stringify(Object.keys(obj || {}).slice(0, n || 40))); } catch (e) { noteErr('dump.' + tag, e); }
}
function fmtNum(v) {
  v = Number(v) || 0;
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return String(Math.round(v));
}

/* ---------- 3. 建局（固定地图 seed；其余保持真随机） ---------- */
var st = G.newGame({ name: '北辰', cityName: '灰岗', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var city0 = st.cities[0];
st.settings.timeScale = 600;
st.settings.autoUpgrade = true;
st.settings.autoResearch = true;
st.settings.battleWatch = true;
st.settings.innAuto = { on: true, min: 'liang' };
G.ui = G.ui || {}; G.ui._cityId = city0.id;

var amc = G.autoMarchCfg();
amc.on = true; amc.genId = null; amc.troops = 500; amc.target = 'wild'; amc.maxLevel = 2;
amc.mode = 'raid'; amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;

RUN('=== v89.90 600× 推演开始（HARNESS v2） ===');
RUN('建局：北辰 · 「灰岗」· 碎垣 · mapSeed=20260921 · 600× · 目标 ' + MAXT + ' tick（' + (MAXT / 96).toFixed(1) + ' 游戏年）');
RUN('城坐标 (' + city0.x + ',' + city0.y + ') · 初始将 ' + st.generals.map(function (g) { return g.name; }).join('、'));
RUN('初始资源 粮木石铁金各 2 万 · 人口 200 · 城外预设 2田1木1石1铁');

/* ---------- 4. 工具函数 ---------- */
function yNow() { return (st.world.elapsed || 0) / 57600; }
function cellOf(city, bid) {
  for (var i = 0; i < city.cells.length; i++) {
    var c = city.cells[i];
    if (c && c.build && c.build.id === bid) return { idx: i, cell: c };
  }
  return null;
}
function countBuild(city, bid) {
  var n = 0; city.cells.forEach(function (c) { if (c && c.build && c.build.id === bid) n++; });
  return n;
}
function emptyCell(city) {
  for (var i = 0; i < city.cells.length; i++) {
    var c = city.cells[i];
    if (c && !c.build && !c.official) return i;
  }
  return -1;
}
function armyAll(a) { var t = 0; for (var k in (a || {})) t += a[k] || 0; return t; }
function totalArmy() {
  var t = 0;
  st.cities.forEach(function (c) { t += armyAll(c.army); });
  (st.marches || []).forEach(function (m) { t += armyAll(m.army); });
  (G.gatherList() || []).forEach(function (g) { t += armyAll(g.army); });
  return t;
}
function idleGen(skipLord) {
  var out = null;
  (st.generals || []).forEach(function (g) {
    if (out) return;
    if (skipLord && g.isLord) return;
    if (g.status && g.status !== 'idle') return;
    if (G.gatherByGen && G.gatherByGen(g.id)) return;
    out = g;
  });
  return out;
}
function findWildSpot(maxLv, forGather) {
  var c0 = st.cities[0];
  var resOf = (DATA.GATHER && DATA.GATHER.resOf) || {};
  for (var rr = 2; rr <= 14; rr++) {
    for (var dy = -rr; dy <= rr; dy++) {
      for (var dx = -rr; dx <= rr; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
        var x = c0.x + dx, y = c0.y + dy;
        if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
        if (G.map.wildAt(x, y)) continue;   /* v4：已是我方野地（跳过，否则永远命中同一块） */
        if (forGather && !resOf[tl.terrain]) continue;
        var lv = G.map.wildLevelNow(x, y);
        if (lv == null || lv < 1 || lv > maxLv) continue;
        return { x: x, y: y, lv: lv, terrain: tl.terrain };
      }
    }
  }
  return null;
}
/* v3：只采**自家**野地（实测 '需先占领该野地，方可派军采集'） */
function findOwnGatherSpot() {
  var resOf = (DATA.GATHER && DATA.GATHER.resOf) || {};
  var busyList = G.gatherList() || [];
  var best = null;
  (st.wilds || []).forEach(function (w) {
    if (best) return;
    var tl = G.map.tile(w.x, w.y);
    if (!tl || !resOf[tl.terrain]) return;
    var busy = busyList.some(function (g) { return g.x === w.x && g.y === w.y; });
    if (busy) return;
    best = { x: w.x, y: w.y, lv: w.level || 1 };
  });
  return best;
}
/* v4：找一块**无主平原**（筑城用；先占后筑） */
function findPlainSpot() {
  var c0 = st.cities[0];
  for (var rr = 3; rr <= 20; rr++) {
    for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      var x = c0.x + dx, y = c0.y + dy;
      if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain !== 'plain') continue;
      if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
      return { x: x, y: y };
    }
  }
  return null;
}
var MILE_TS = {};
/* 筑城准备：有自家平原 → 直接用；没有 → 遣军占一块平原（带冷却） */
function ensurePlainForCity(tag) {
  var plain = null;
  (st.wilds || []).forEach(function (w) { if (!plain && w.type === 'plain') plain = w; });
  if (plain) return { have: true, w: plain };
  if (tNow - (MILE_TS['occ_' + tag] || 0) < 600) return { have: false };
  var gen = idleGen(true); if (!gen) return { have: false };
  var spot = findPlainSpot(); if (!spot) return { have: false };
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return { have: false };
  var r = safeCall(tag + '.occ', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });
  MILE_TS['occ_' + tag] = tNow;
  if (r && r.ok) RUN('🏯 为筑城先占平原 @' + spot.x + ',' + spot.y + '（' + tag + '）');
  if (r && !r.ok) noteSoft(tag + '.occ', r.msg);
  return { have: false };
}
function findFortSpot(maxLv, radius) {
  var c0 = st.cities[0];
  for (var rr = 3; rr <= (radius || 20); rr++) {
    for (var dy = -rr; dy <= rr; dy++) {
      for (var dx = -rr; dx <= rr; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
        var x = c0.x + dx, y = c0.y + dy;
        if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
        var f = G.map.fortAt(x, y);
        if (!f) continue;
        var lvf = (f.level != null ? f.level : f.lv) || 1;
        if (lvf >= 1 && lvf <= maxLv) return { x: x, y: y, lv: lvf, name: f.name };
      }
    }
  }
  return null;
}
function setCity(c) { G.ui._cityId = c.id; }

/* ---------- 5. 玩家脑：各系统动作 ---------- */
/* 5.1 建造（空位 → 关键建筑）*/
var BUILD_PRIO = [
  /* v2：顺序按依赖链修正 —— v1 实测「招贤馆 需客栈 Lv2」，客栈必须先建 */
  { bid: 'junying', want: 1 }, { bid: 'shuyuan', want: 1 }, { bid: 'kezhan', want: 1 },
  { bid: 'zhaoxianguan', want: 1 }, { bid: 'cangku', want: 1 }, { bid: 'shichang', want: 1 },
  { bid: 'honglusi', want: 1 }, { bid: 'fenghuotai', want: 1 }, { bid: 'yizhan', want: 1 },
  { bid: 'minfang', want: 6 }, { bid: 'majiu', want: 1 }, { bid: 'tiejiangpu', want: 1 },
  { bid: 'gongjiangzuofang', want: 1 }
];
function tryBuildNew() {
  var city = st.cities[0];
  var slots = G.buildSlots(city);
  for (var i = 0; i < BUILD_PRIO.length; i++) {
    var it = BUILD_PRIO[i];
    if (countBuild(city, it.bid) >= it.want) continue;
    if ((st.queues.build || []).length >= slots) return;
    var idx = emptyCell(city);
    if (idx < 0) return;
    setCity(city);
    var r = safeCall('build.' + it.bid, function () { return G.buildAt(city.id, idx, it.bid); });
    if (r && r.ok) { RUN('🏗 开建：' + it.bid + ' @格' + idx + '（队列 ' + st.queues.build.length + '/' + slots + '）'); continue; }
    if (r && !r.ok) {
      noteSoft('build.' + it.bid, r.msg);
      if (/同时只能|队列/.test(r.msg || '')) return;   /* 队列满 → 本轮停 */
      continue;                                        /* 前置/资源不符 → 试下一个（真人也是先建能建的） */
    }
  }
}
/* 5.2 城外资源地块扩建 */
function tryBuildExt() {
  var city = st.cities[0];
  var grid = G.extGridOf(city) || [];
  var want = { farm: 4, forest: 3, quarry: 3, mine: 3 };
  var cnt = {};
  grid.forEach(function (e) { if (e.type) cnt[e.type] = (cnt[e.type] || 0) + 1; });
  var need = null;
  for (var k in want) { if ((cnt[k] || 0) < want[k]) { need = k; break; } }
  if (!need) return;
  var used = grid.filter(function (e) { return !!e.type; }).length;
  var cap = (G.extCap ? G.extCap(city) : grid.length) || grid.length;
  if (used >= cap) return;
  for (var i = 0; i < grid.length; i++) {
    if (grid[i].type) continue;
    setCity(city);
    var r = safeCall('ext.' + need, function () { return G.buildExt(i, need); });
    if (r && r.ok) { RUN('🌾 城外扩建：' + need + ' @e' + i); }
    if (r && !r.ok) noteSoft('ext.' + need, r.msg);
    return;
  }
}
/* 5.3 城墙 */
function tryWall() {
  var city = st.cities[0];
  /* v89.126 跟随：城墙并入建筑体系，wallPendingOf/buildWall/wallLv 退役 */
  var lv = G.buildingLevel(city, 'chengqiang') || 0;
  if (city.wall && city.wall.pending) return;
  if (lv >= G.buildCapOf(city, 'chengqiang')) return;
  var r = safeCall('wall', function () {
    return lv > 0 ? G.upgradeAt(city.id, 'wall') : G.buildAt(city.id, 'wall', 'chengqiang');
  });
  if (r && r.ok) RUN('🧱 城墙 → Lv' + (lv + 1) + ' 开建');
  if (r && !r.ok) noteSoft('wall', r.msg);
}
/* 5.4 募兵 */
var TROOP_ORDER = ['zhuzhan', 'fujiche', 'buxingji', 'dunwei', 'daodanche'];
function armyTarget() {
  var y = yNow();
  if (y < 0.25) return 300;
  if (y < 1) return 1200;
  if (y < 3) return 5000;
  if (y < 8) return 15000;
  if (y < 20) return 40000;
  if (y < 50) return 100000;
  return 300000;
}
function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */
  var target = armyTarget(), cur = totalArmy();
  if (cur >= target) return;
  var lack = target - cur;
  st.cities.forEach(function (city) {
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    setCity(city);
    /* v2：从精锐到基础逐个尝试 —— **未解锁的兵种要跳过继续试后面的**
       （v1 在第一个失败处 return —— 永远试不到民兵，五年一兵未募的根因） */
    var lastFail = '';
    for (var i = 0; i < TROOP_ORDER.length; i++) {
      var tid = TROOP_ORDER[i];
      var mc = safeCall('maxTrain.' + tid, function () { return G.maxTrainCount(tid, city.id, jy.idx); });
      var mcn = (typeof mc === 'number') ? mc : Number(mc && (mc.n || mc.count || mc.max) || 0);
      if (!(mcn > 0)) continue;
      var n = Math.min(mcn, Math.max(20, Math.floor(lack)));
      var r = safeCall('train.' + tid, function () { return G.train(tid, n, city.id, jy.idx); });
      if (r && r.ok) { noteSoft('train.ok', '募兵 ' + tid + ' ×' + n); return; }
      if (r && !r.ok) { lastFail = r.msg || ''; continue; }
    }
    if (lastFail) noteSoft('train.fail', lastFail);
  });
}
/* v2：编队取兵 —— 按 prefer 顺序从城内抽 n 名（不超实有） */
function takeArmy(city, n, order) {
  order = order || ['zhuzhan', 'fujiche', 'buxingji', 'dunwei', 'daodanche'];
  var out = {}, need = n;
  order.forEach(function (tid) {
    if (need <= 0) return;
    var have = city.army[tid] || 0;
    var use = Math.min(have, need);
    if (use > 0) { out[tid] = use; need -= use; }
  });
  var tot = 0; for (var k in out) tot += out[k];
  return { army: out, total: tot };
}
/* 5.5 采集 */
var GATHER_LAST = -1e9;
function tryGather() {
  var list = G.gatherList() || [];
  if (list.length >= 3) return;
  if (tNow - GATHER_LAST < 90) return;
  var gen = idleGen(false);
  if (!gen) return;
  var spot = findOwnGatherSpot();
  if (!spot) { noteSoft('gather.spot', '暂无自家野地可采（待占领）'); return; }
  var c0 = st.cities[0];
  setCity(c0);
  var tkG = takeArmy(c0, 300, ['banche', 'buxingji', 'dunwei', 'daodanche', 'fujiche']);
  if (tkG.total < 50) { noteSoft('gather.noarmy', '城内取不出采集兵（清点各兵种）'); return; }
  var army = tkG.army;
  var r = safeCall('gather.dispatch', function () { return G.dispatchGather(spot.x, spot.y, gen.id, army); });
  GATHER_LAST = tNow;
  if (r && r.ok) RUN('🚚 采集队出发：' + gen.name + '（' + spot.terrain + ' Lv' + spot.lv + ' @' + spot.x + ',' + spot.y + '）');
  if (r && !r.ok) noteSoft('gather.dispatch', r.msg);
}
function finishRipeGathers() {
  var list = G.gatherList() || [];
  list.forEach(function (g) {
    var th = (list.length >= 3) ? 8 * 3600 : 21 * 3600;
    if (g.elapsed >= th) {
      var r = safeCall('gather.finish', function () { return G.finishGather(g.id); });
      if (r && r.ok) noteSoft('gather.done', r.msg);
    }
  });
}
/* 5.5b 持续占领**可采地形**野地（采集的前置；v4：平原留给筑城，见 city2/city3） */
var OCCUPY_LAST = -1e9;
function ownedGatherable() {
  var resOf = (DATA.GATHER && DATA.GATHER.resOf) || {};
  return (st.wilds || []).filter(function (w) {
    var tl = G.map.tile(w.x, w.y);
    return tl && resOf[tl.terrain];
  });
}
function keepOccupying() {
  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;
  var gen = idleGen(true); if (!gen) return;
  var spot = findWildSpot(4, true);
  if (!spot) return;
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return;
  var r = safeCall('occupy.auto', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });
  OCCUPY_LAST = tNow;
  if (r && r.ok) noteSoft('occupy.ok', '占领可采野地 Lv' + spot.lv + '（' + spot.terrain + '）@' + spot.x + ',' + spot.y);
  if (r && !r.ok) noteSoft('occupy.auto', r.msg);
}

/* 5.5c 驻军回城（占领后留守的兵撤回，否则兵力沉在野地） */
var WD_LAST = -1e9;
function tryWithdraw() {
  if (tNow - WD_LAST < 480) return;
  (st.wilds || []).slice().forEach(function (w) {
    if (!w.garrison || !G.wildGarrisonTotal(w.garrison)) return;
    var r = safeCall('withdraw', function () { return G.doWildWithdraw(w.x, w.y); });
    WD_LAST = tNow;
    if (r && r.ok) noteSoft('withdraw.ok', r.msg);
    if (r && !r.ok) noteSoft('withdraw', r.msg);
  });
}

/* 5.5c2 新城增援：以旧城之兵，补新城之虚（transfer 统一行军通道） */
var REINF_LAST = -1e9;
function tryReinforce() {
  if (st.cities.length < 2) return;
  if (tNow - REINF_LAST < 480) return;
  var main = st.cities[0];
  for (var i = 1; i < st.cities.length; i++) {
    var c = st.cities[i];
    if (armyAll(c.army) >= 400) continue;
    if (armyAll(main.army) < 900) return;
    var gen = idleGen(true); if (!gen) return;
    setCity(main);
    var tk = takeArmy(main, 500);
    if (tk.total < 300) return;
    var r = safeCall('reinforce', function () { return G.march.dispatch({ kind: 'owncity', id: c.id }, 'transfer', tk.army, gen.id); });
    REINF_LAST = tNow;
    if (r && r.ok) noteSoft('reinforce.ok', '调兵 ' + tk.total + ' → ' + c.name);
    if (r && !r.ok) noteSoft('reinforce', r.msg);
    return;
  }
}

/* 5.5d 市场售粮换金（设计内的黄金入口：粮→金，平价恒定 ≈ 1 金 / 6.7 粮） */
var SELL_LAST = -1e9;
function tryMarketSell() {
  if (tNow - SELL_LAST < 240) return;
  var gold = st.res.gold || 0;
  if (gold > 150000) return;                 /* 金够用就不卖 */
  var grain = st.res.grain || 0;
  if (grain < 900000) return;                /* 先保 60 万粮底 */
  var amount = Math.min(grain - 600000, 800000);
  if (amount < 10000) return;
  var r = safeCall('market.sell', function () { return G.marketSell('grain', amount); });
  SELL_LAST = tNow;
  if (r && r.ok) noteSoft('market.sell', r.msg);
  if (r && !r.ok) noteSoft('market.sellfail', r.msg);
}

/* 5.6 秘境种田 */
var FARM_ROT = 0;
function tryFarm() {
  var hr = safeCall('farm.harvestAll', function () { return G.farmHarvestAll(); });
  if (hr && hr.ok) noteSoft('farm.harvest', hr.msg);
  var f = G.farmOf();
  var seedsOrder = ['seed_tianshou', 'seed_hualong', 'seed_xisui', 'seed_yunling', 'seed_fan'];
  var cropsBySeed = {
    seed_fan: ['yunjinsang', 'yusuihua', 'jiaojinteng', 'xipiteng', 'tanxiangshu', 'tieying'],
    seed_yunling: ['yunlingcao'], seed_xisui: ['xisuizhi'],
    seed_hualong: ['hualongshen'], seed_tianshou: ['tianshouguo']
  };
  for (var i = 0; i < f.plots.length; i++) {
    if (f.plots[i]) continue;
    var planted = false;
    for (var s = 0; s < seedsOrder.length; s++) {
      var sid = seedsOrder[s];
      if ((st.items[sid] || 0) > 0) {
        var cr = cropsBySeed[sid];
        FARM_ROT = (FARM_ROT + 1) % cr.length;
        var r = safeCall('farm.plant', function () { return G.farmPlant(i, cr[FARM_ROT]); });
        if (r && r.ok) { planted = true; }
        else if (r && !r.ok) noteSoft('farm.plant', r.msg);
        break;
      }
    }
    if (!planted) break;
  }
}
/* 5.7 商城（种子快购） */
function tryShop() {
  if ((st.items.seed_fan || 0) < 2 && (st.res.gold || 0) > 120000 && G.farmOf().plots.some(function (p) { return !p; })) {
    var r = safeCall('shop.seed', function () { return G.doShopping('seed_fan', 4); });
    if (r && r.ok) noteSoft('shop.seed', r.msg);
    else if (r && !r.ok) noteSoft('shop.seed', r.msg);
  }
}
/* 5.8 门派 */
var SECT_CHORE_MAXED = false;
function trySect() {
  if (!cellOf(st.cities[0], 'honglusi')) return;
  var ss = G.sectState();
  if (!ss.id) {
    if (yNow() >= 0.4) {
      var r = safeCall('sect.join', function () { return G.doSectJoin('muyun'); });
      if (r && r.ok) RUN('☁️ 入派：牧云庄（' + r.msg + '）');
      if (r && !r.ok) noteSoft('sect.join', r.msg);
    }
    return;
  }
  if (!SECT_CHORE_MAXED) {
    var r2 = safeCall('sect.chores', function () { return G.doSectTaskBulk('chores', 8); });
    if (r2 && r2.ok) noteSoft('sect.chores', r2.msg);
    if (r2 && !r2.ok) { SECT_CHORE_MAXED = true; RUN('☁️ 门派杂役今日已满：' + r2.msg); }
  }
  /* 偶尔捐资测试出口（金 > 40 万一次） */
  if (!DUMPED.sectDonate && (st.res.gold || 0) > 400000 && yNow() > 2) {
    DUMPED.sectDonate = 1;
    var r3 = safeCall('sect.donate', function () { return G.doSectTask('donate'); });
    if (r3) RUN('☁️ 捐资修葺测试：' + r3.msg);
  }
}
/* 5.9 任务领取 */
function tryQuests() {
  (DATA.QUESTS || []).forEach(function (q) {
    if (st.quests.done[q.id]) return;
    var amt = safeCall('qa.' + q.id, function () { return G.questAmount(q); }) || 0;
    if (amt >= G.questGoal(q)) {
      var r = safeCall('claim.' + q.id, function () { return G.claimQuest(q.id); });
      if (r && r.ok) noteSoft('quest.done', q.title + '（' + r.msg + '）');
    }
  });
  (st.quests.pool || []).slice().forEach(function (e) {
    var def = G.randomQuestDef(e.id);
    if (!def) return;
    var amt = safeCall('rqam.' + e.id, function () { return G.randQuestAmount(e); });
    if (amt != null && amt >= (def.goal || 1)) {
      var r2 = safeCall('claimR.' + e.id, function () { return G.claimRandomQuest(e.id); });
      if (r2 && r2.ok) noteSoft('rquest.done', def.title + '（' + r2.msg + '）');
    }
  });
}
/* 5.10 自动出征管理（借力的将 / 等级 / 兵力） */
function manageAutoMarch() {
  var y = yNow();
  var wantLv = y < 2 ? 2 : y < 5 ? 3 : y < 15 ? 4 : y < 40 ? 5 : 6;
  var wantTroops = y < 0.5 ? 500 : y < 2 ? 2000 : y < 5 ? 5000 : y < 20 ? 10000 : y < 60 ? 20000 : 50000;
  if (amc.maxLevel !== wantLv) amc.maxLevel = wantLv;
  if (amc.troops !== wantTroops) amc.troops = wantTroops;
  var cur = null;
  (st.generals || []).forEach(function (g) { if (g.id === amc.genId) cur = g; });
  if (!cur) {
    var pick = null;
    (st.generals || []).forEach(function (g) {
      if (!pick && !g.isLord && g.status === 'idle') pick = g;
    });
    if (pick) { amc.genId = pick.id; noteSoft('automarch.gen', '自动出征执行将 → ' + pick.name); }
  }
}

/* ---------- 6. 里程碑（可延后重试） ---------- */
var MILE = [
  { id: 'raid1', at: 240, done: false, retries: 0, fn: function () {
      if (totalArmy() < 280) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk1 = takeArmy(st.cities[0], 280);
      if (tk1.total < 120) return 'wait';
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', tk1.army, gen.id);
      if (r && r.ok) { RUN('⚔️ 首次出征（Lv' + spot.lv + ' 野地 @' + spot.x + ',' + spot.y + '）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('raid1', r.msg); return 'wait'; }
  } },
  { id: 'occupy1', at: 900, done: false, retries: 0, fn: function () {
      if (totalArmy() < 500) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk2 = takeArmy(st.cities[0], 600);
      if (tk2.total < 350) return 'wait';
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk2.army, gen.id);
      if (r && r.ok) { RUN('🚩 首次占领（Lv' + spot.lv + ' 野地 @' + spot.x + ',' + spot.y + '）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('occupy1', r.msg); return 'wait'; }
  } },
  { id: 'fort1', at: 2400, done: false, retries: 0, fn: function () {
      if (totalArmy() < 2500) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findFortSpot(2, 22); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk3 = takeArmy(st.cities[0], 2500);
      if (tk3.total < 1200) return 'wait';
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid', tk3.army, gen.id);
      if (r && r.ok) { RUN('🏕 首次攻据点（Lv' + spot.lv + ' ' + spot.name + ' @' + spot.x + ',' + spot.y + '）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('fort1', r.msg); return 'wait'; }
  } },
  { id: 'scout1', at: 2400, done: false, retries: 0, fn: function () {
      var chk = safeCall('scout.train', function () { return G.maxTrainCount('zhencha', st.cities[0].id, (cellOf(st.cities[0], 'junying') || {}).idx); });
      var n = (typeof chk === 'number') ? chk : Number(chk && (chk.n || chk.count || chk.max) || 0);
      if (n <= 0) return 'wait';
      var jy = cellOf(st.cities[0], 'junying');
      setCity(st.cities[0]);
      var c0 = st.cities[0];
      if (!c0.army.zhencha || c0.army.zhencha < 10) {
        var t = safeCall('scout.tr', function () { return G.train('zhencha', 10, c0.id, jy.idx); });
        if (t && !t.ok) { noteSoft('scout.tr', t.msg); return 'wait'; }
      }
      if ((c0.army.zhencha || 0) < 10) return 'wait';
      /* 找最近名城 */
      var npc = null;
      for (var rr = 5; rr <= 30 && !npc; rr++) {
        for (var dy = -rr; dy <= rr && !npc; dy++) for (var dx = -rr; dx <= rr && !npc; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var f = G.map.npcAt(c0.x + dx, c0.y + dy);
          if (f) npc = f;
        }
      }
      if (!npc) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var r = G.march.dispatch({ kind: 'city', id: npc.id, npc: npc }, 'scout', { zhencha: 10 }, gen.id);
      if (r && r.ok) { RUN('🦅 侦查名城：' + npc.name + '（' + r.msg + '）'); return 'ok'; }
      if (r && !r.ok) { noteSoft('scout1', r.msg); return 'wait'; }
  } },
  { id: 'city2', at: 1400, done: false, retries: 0, fn: function () {
      if (st.cities.length >= 2) return 'ok';
      if (yNow() < 1.2) return 'wait';
      var g2 = ensurePlainForCity('city2');
      if (!g2.have) return 'wait';
      setCity(st.cities[0]);
      var r2r = safeCall('city2', function () { return G.buildCityAt(g2.w.x, g2.w.y); });
      if (r2r && r2r.ok) { RUN('🏯 筑第二城 @' + g2.w.x + ',' + g2.w.y + '：' + r2r.msg); return 'ok'; }
      if (r2r && !r2r.ok) { noteSoft('city2', r2r.msg); return 'wait'; }
      return 'wait';
    } },
  { id: 'fort2', at: 9000, done: false, retries: 0, fn: function () {
      if (totalArmy() < 10000) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findFortSpot(4, 26); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk4 = takeArmy(st.cities[0], Math.min(8000, Math.floor(totalArmy() * 0.5)));
      if (tk4.total < 3000) return 'wait';
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid', tk4.army, gen.id);
      if (r && r.ok) { RUN('🏕 攻据点 Lv' + spot.lv + '（' + spot.name + '）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('fort2', r.msg); return 'wait'; }
    } },
  { id: 'city3', at: 4800, done: false, retries: 0, fn: function () {
      if (st.cities.length >= 3) return 'ok';
      var g3 = ensurePlainForCity('city3');
      if (!g3.have) return 'wait';
      setCity(st.cities[0]);
      var r3r = safeCall('city3', function () { return G.buildCityAt(g3.w.x, g3.w.y); });
      if (r3r && r3r.ok) { RUN('🏯 筑第三城 @' + g3.w.x + ',' + g3.w.y + '：' + r3r.msg); return 'ok'; }
      if (r3r && !r3r.ok) { noteSoft('city3', r3r.msg); return 'wait'; }
      return 'wait';
    } },
  { id: 'npcIntel', at: 9600, done: false, retries: 0, fn: function () {
      var c0 = st.cities[0], npc = null;
      for (var rr = 5; rr <= 30 && !npc; rr++) {
        for (var dy = -rr; dy <= rr && !npc; dy++) for (var dx = -rr; dx <= rr && !npc; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var f = G.map.npcAt(c0.x + dx, c0.y + dy);
          if (f) npc = f;
        }
      }
      if (!npc) return 'ok';
      var g = null;
      try { g = G.map.fortGarrison ? G.map.fortGarrison(12) : null; } catch (e) {}
      RUN('📋 名城情报：最近名城「' + npc.name + '」（' + (npc.type || '?') + ' · Lv' + (npc.level || '?') + '）· 我方可动员兵力 ' + fmtNum(totalArmy()) + ' · 同级据点守军基准 ' + fmtNum(g));
      return 'ok';
    } },
  { id: 'npcAtk', at: 19200, done: false, retries: 0, fn: function () {
      if (totalArmy() < 150000) { RUN('📋 名城攻坚评估：兵力 ' + fmtNum(totalArmy()) + ' 不足以挑战名城（跳过实攻，作为内容深度结论）'); return 'ok'; }
      var c0 = st.cities[0], npc = null;
      for (var rr = 5; rr <= 30 && !npc; rr++) {
        for (var dy = -rr; dy <= rr && !npc; dy++) for (var dx = -rr; dx <= rr && !npc; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var f = G.map.npcAt(c0.x + dx, c0.y + dy);
          if (f) npc = f;
        }
      }
      if (!npc) return 'ok';
      var gen = idleGen(true); if (!gen) return 'wait';
      setCity(c0);
      var tk5 = takeArmy(c0, Math.floor(totalArmy() * 0.8));
      var r = G.march.dispatch({ kind: 'city', id: npc.id, npc: npc }, 'raid', tk5.army, gen.id);
      if (r && r.ok) { RUN('⚔️ 挑战名城「' + npc.name + '」（全权限实测）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('npcAtk', r.msg); return 'wait'; }
    } }
];
function execMilestones() {
  for (var i = 0; i < MILE.length; i++) {
    var m = MILE[i];
    if (m.done) continue;
    if (tNow < m.at) continue;   /* v3：数组非严格按 at 排序，break 会挡住后面的里程碑 */
    m.retries++;
    var r = safeCall('mile.' + m.id, m.fn);
    if (r === 'ok') { m.done = true; }
    else if (m.retries > 60) { m.done = true; RUN('⏭ 里程碑 ' + m.id + ' 放弃（重试 ' + m.retries + ' 次未达成）'); }
  }
}

/* ---------- 7. 战斗：观战挂起 → 自然走表 → 一键自动 ---------- */
var BATTLE_SEEN = 0;
function handleBattles() {
  (st.battles || []).slice().forEach(function (rec) {
    if (rec.state !== 'live') return;
    rec._seen = (rec._seen || 0) + 1;
    if (rec._seen === 1) {
      BATTLE_SEEN++;
      var tn = rec.target && (rec.target.name || ('(' + rec.target.x + ',' + rec.target.y + ')'));
      if (BATTLE_SEEN <= 30) RUN('⚔ 战斗挂起 #' + BATTLE_SEEN + '：' + tn + ' · ' + rec.modeId + '（观战 60s/回合，稍后一键结算）');
      if (BATTLE_SEEN === 1) dumpOnce('battleRec', rec, 40);
    }
    var enough = rec._seen >= 4 || (rec.round || 0) >= 1;
    if (enough) {
      safeCall('autoBattle', function () { return G.battle.autoBattle(rec.id); });
      var d = G._battleJustDone || {};
      var row = {
        t: tNow, gt: Math.round((st.world.elapsed || 0)), y: +(yNow().toFixed(2)),
        target: (rec.target && (rec.target.name || ('(' + rec.target.x + ',' + rec.target.y + ')'))) || '',
        mode: rec.modeId, rounds: d.rounds, winner: d.winner,
        atkLoss: d.atkLoss, defLoss: d.defLoss, ok: !!d.ok, waited: rec._seen * 10
      };
      fs.appendFileSync(BATTLES, JSON.stringify(row) + '\n');
      if (BATTLE_SEEN <= 80) RUN('⚔ 战果：' + row.target + ' · ' + row.mode + ' · ' + (row.winner === 'atk' ? '胜' : '败') + ' · ' + row.rounds + ' 回合 · 损 ' + row.atkLoss + ' vs 敌损 ' + row.defLoss);
    }
  });
}

/* ---------- 8. 快照 ---------- */
function snapshot() {
  try {
    var o = { t: tNow, y: +(yNow().toFixed(3)), rm: +(tNow / 60).toFixed(1) };
    var res = {}, pop = 0, popCap = 0, army = 0;
    G.RES_KEYS.forEach(function (k) { res[k] = 0; });
    st.cities.forEach(function (c) {
      var Rr = G.res(c) || {};
      G.RES_KEYS.forEach(function (k) { res[k] += (Rr[k] || 0); });
      pop += Rr.pop || 0; popCap += G.maxPopOf(c);
      army += armyAll(c.army);
    });
    o.res = res; o.pop = Math.round(pop); o.popCap = Math.round(popCap);
    o.army = army; o.wounded = Math.round(st.wounded || 0);
    o.marchArmy = 0; (st.marches || []).forEach(function (m) { o.marchArmy += armyAll(m.army); });
    o.marches = (st.marches || []).length;
    o.gathers = (G.gatherList() || []).length;
    o.cities = st.cities.length;
    var bl = {}, wall = {}, ext = {};
    st.cities.forEach(function (c, ci) {
      var tag = ci === 0 ? '' : ('c' + ci + ':');
      var seen = {};
      c.cells.forEach(function (cc) {
        if (!cc || !cc.build) return;
        var id = cc.build.id;
        if (id === 'guanfu' && seen.guanfu) return;
        seen[id] = 1;
        bl[tag + id] = Math.max(bl[tag + id] || 0, cc.build.lvl);
      });
      wall[c.id] = G.buildingLevel(c, 'chengqiang') || 0;
      (G.extGridOf(c) || []).forEach(function (e) { if (e.type) ext[tag + e.type] = (ext[tag + e.type] || 0) + e.lv; });
    });
    o.bl = bl; o.wall = wall; o.ext = ext;
    var tech = {}, ts_ = 0;
    (DATA.TECH || []).forEach(function (t) { var l = st.techs[t.id] || 0; if (l) { tech[t.id] = l; ts_ += l; } });
    o.tech = tech; o.techSum = ts_;
    o.gens = (st.generals || []).length;
    o.genLv = (st.generals || []).reduce(function (s, g) { return s + (g.level || 1); }, 0);
    var ss = G.sectState() || {};
    o.sectRep = Math.round(ss.rep || 0); o.sectId = ss.id || null;
    o.rep = Math.round(st.rep || 0); o.hearts = Math.round(st.hearts || 0);
    o.qDone = Object.keys((st.quests && st.quests.done) || {}).length;
    o.qPool = ((st.quests && st.quests.pool) || []).length;
    o.reports = (st.reports || []).length;
    o.sgPending = (st.sgPending || []).length;
    o.chronicle = (st.chronicle || []).length;
    o.items = Object.keys(st.items || {}).length;
    o.seeds = { fan: st.items.seed_fan || 0, yunling: st.items.seed_yunling || 0, xisui: st.items.seed_xisui || 0, hualong: st.items.seed_hualong || 0, tianshou: st.items.seed_tianshou || 0 };
    o.auto = {
      up: (st.autoState && st.autoState.msg) || '', tech: (st.autoTechState && st.autoTechState.msg) || '',
      march: (st.autoMarchInfo && st.autoMarchInfo.msg) || ''
    };
    try {
      o.stats2 = { trained: (st.stats && st.stats.trained) || 0, wins: (st.stats && st.stats.wins) || 0,
        raid: (st.stats && st.stats.raidCount) || 0, conquer: (st.stats && st.stats.conquer) || 0,
        build: (st.stats && st.stats.buildDone) || 0, tech: (st.stats && st.stats.techDone) || 0,
        recruited: (st.stats && st.stats.recruited) || 0, trades: (st.stats && st.stats.trades) || 0 };
      o.garrison = (st.wilds || []).reduce(function (s2, w) { return s2 + (w.garrison ? G.wildGarrisonTotal(w.garrison) : 0); }, 0);
    } catch (e) {}
    if (tNow % 960 === 0) { try { o.saveBytes = G.savePayload().length; } catch (e) {} }
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\n');
  } catch (e) { noteErr('snapshot', e); }
}

/* ---------- 9. 主循环 ---------- */
var SNAP_EVERY = 96;
var BRAIN_LAST = -1e9;
var T0 = _RealNow();
RUN('主循环启动：每 tick = 1 现实秒 × 600 倍率；快照 1/游戏年；脑决策 ' + '40t(前10min)→120t');

for (tNow = 1; tNow <= MAXT; tNow++) {
  simMs += 1000;
  /* SIM 时钟的日期校验（第 100 tick 打印一次） */
  if (tNow === 100) {
    RUN('SIM 时钟校准：' + simClock() + '（应为 09:01:40 前后）· questDay=' + G.questDayIndex());
    dumpOnce('state', st, 80);
    dumpOnce('city', city0, 80);
    dumpOnce('settings', st.settings, 80);
    dumpOnce('extGrid', (G.extGridOf(city0) || [])[0], 20);
  }
  if (tNow === 600) {
    dumpOnce('quests', st.quests, 30);
    var gl0 = G.gatherList(); if (gl0 && gl0[0]) dumpOnce('gatherRec', gl0[0], 30);
    var mr0 = (st.marches || [])[0]; if (mr0) dumpOnce('marchRec', mr0, 30);
    var gd0 = st.generals[0]; if (gd0) dumpOnce('genRec', gd0, 40);
    var tq0 = (st.queues.train || [])[0]; if (tq0) dumpOnce('trainQ', tq0, 20);
    var qb0 = (st.queues.build || [])[0]; if (qb0) dumpOnce('buildQ', qb0, 20);
    dumpOnce('stats', st.stats, 40);
    dumpOnce('world', st.world, 40);
  }
  safeCall('tickOnce', function () { G.tickOnce(); });
  safeCall('battle.tick', function () { G.battle.tick(1); });
  if (tNow % 10 === 0) safeCall('handleBattles', handleBattles);
  var every = tNow < 600 ? 40 : 120;
  if (tNow - BRAIN_LAST >= every) {
    BRAIN_LAST = tNow;
    safeCall('b.quests', tryQuests);
    safeCall('b.build', tryBuildNew);
    safeCall('b.ext', tryBuildExt);
    safeCall('b.wall', tryWall);
    safeCall('b.train', tryTrain);
    safeCall('b.gather', tryGather);
    safeCall('b.gatherFin', finishRipeGathers);
    safeCall('b.occupy', keepOccupying);
    safeCall('b.withdraw', tryWithdraw);
    safeCall('b.reinforce', tryReinforce);
    safeCall('b.market', tryMarketSell);
    safeCall('b.farm', tryFarm);
    safeCall('b.shop', tryShop);
    safeCall('b.sect', trySect);
    safeCall('b.autoMarch', manageAutoMarch);
    safeCall('b.milestones', execMilestones);
  }
  if (tNow % SNAP_EVERY === 0) snapshot();
  if (tNow % 480 === 0) {
    flushEv();
    var perf = (_RealNow() - T0) / 1000;
    RUN('进度 ' + tNow + '/' + MAXT + ' · 第 ' + yNow().toFixed(1) + ' 游戏年 · 用时 ' + perf.toFixed(0) + 's'
      + ' · 城' + st.cities.length + ' · 军 ' + fmtNum(totalArmy()) + ' · 金 ' + fmtNum(st.res.gold)
      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
  }
  if (tNow % 2400 === 0) {
    try { fs.writeFileSync(path.join(OUT, 'checkpoints', 'y' + Math.round(tNow / 96) + '.json'), G.savePayload()); } catch (e) { noteErr('ckpt', e); }
  }
}

/* ---------- 10. 收尾 ---------- */
flushEv(); flushRun();
function errCount() { return ERRN; }
var finalOut = {};
try { finalOut.year = +yNow().toFixed(2); finalOut.army = totalArmy(); finalOut.gold = Math.round(st.res.gold); } catch (e) {}
try { fs.writeFileSync(path.join(OUT, 'final_state.json'), G.savePayload()); } catch (e) { noteErr('final.save', e); }
try { fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(ERRLIST, null, 1)); } catch (e) {}

var errTop = Object.keys(ERRS).map(function (k) { return { k: k, n: ERRS[k].n }; })
  .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
RUN('=== 推演结束 ===');
RUN('终态：第 ' + yNow().toFixed(1) + ' 游戏年 · 城 ' + st.cities.length + ' · 军 ' + fmtNum(totalArmy())
  + ' · 金 ' + fmtNum(st.res.gold) + ' · 将 ' + st.generals.length + ' · 战报 ' + (st.reports || []).length + ' 份');
RUN('错误合计 ' + ERRN + ' 次；Top: ' + errTop.map(function (x) { return x.k.slice(0, 60) + '×' + x.n; }).join(' || '));
RUN('输出目录：' + OUT);
flushRun();
console.log('DONE ' + TAG + ' ticks=' + MAXT + ' errs=' + ERRN);
