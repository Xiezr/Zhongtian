/* RUSH v1 (v89.98) —— 1× 300h 全系统极限流 */
/* 生成自 play_strat_600x.js（v89.98 RUSH fork）；禁止手改生成物 —— 改 patch_v8998_rush.py。 */
/* ============================================================
 * v89.98「1× 300h 极限流测评」驾驶舱（老板令：重复利用所有板块和道具，走捷径）
 * 口径：1 tick = 现实 1 秒；timeScale = TS（默认 1× 严格 1:1）
 *   默认 1,080,000 ticks = 300 现实小时 = 18.75 游戏年
 *   对照跑：TS=120 → 9,000 ticks（2.5h 现实）/ TS=600 → 1,800 ticks（0.5h 现实）
 * 新增链：围攻打据点（occupy+围困）/ 爵位晋升 / 节钺扩编 / 通商券 / 丹药
 * ============================================================ */
/* ============================================================
 * play_gold_600x.js — v89.91 「黄金流对照推演」驾驶舱
 * （由 play_600x.js 基线 fork；唯一差异 = 新增 GOLD 策略脑：
 *   金换批招英杰 / 金买经验书喂将 / 用光自由点 / 金提速建造·科技·募兵 /
 *   全资源套现。其余段（建造/扩张/里程碑/战斗）与基线逐字一致。）
 * ------------------------------------------------------------
 * 目标：以 1× 实跑 300 现实小时（= 18.75 游戏年 · 全系统极限流），
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
 * 用法：node play_gold_600x.js [ticks] [tag]
 *   默认 21600 ticks（6h×600×=225 游戏年）；输出 .workbuddy/tmp/playtest600/<tag>/
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

var ARGV = process.argv.slice(2);
var MAXT = Math.max(96, Number(ARGV[0] || 1080000));   /* v89.98：默认 1× 300h = 1,080,000 ticks */
var TAG  = ARGV[1] || 'rush_1x';
var MODE = ARGV[2] || 'rush';   /* gold | buff | equip | all | rush | econ（v89.100：纯经济，军事全停）
                                    | loot（v89.100：rush 全行为 + 战利品寄售变现 75%）
                                    | lootx（对照：寄售空转=只调用不卖，用于分离"寄售效果"与"路径分叉"） */
var TS   = Math.max(1, Number(ARGV[3] || 1));   /* v89.98：timeScale（1 = 严格 1×） */
var T_YEAR = 57600, T_HALF = 28800, T_QUARTER = 14400;   /* 模块加载后按 TS 重算 */
/* v89.98：固定随机种子（三倍速对照跑对齐运气 —— 让差异只来自倍率机制本身） */
var _RNG_SEED = Number(ARGV[4] || 20260922);
var _rngS = _RNG_SEED >>> 0;
Math.random = function () {
  _rngS = (_rngS + 0x6D2B79F5) >>> 0;
  var _t = _rngS;
  _t = Math.imul(_t ^ (_t >>> 15), _t | 1);
  _t ^= _t + Math.imul(_t ^ (_t >>> 7), _t | 61);
  return ((_t ^ (_t >>> 14)) >>> 0) / 4294967296;
};
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
/* v89.98：按 timeScale 重算时间刻度（1× 下 57,600 ticks = 1 游戏年） */
T_YEAR = Math.max(1, Math.round(((DATA.CALENDAR && DATA.CALENDAR.secPerYear) || 57600) / TS));
T_HALF = Math.max(1, Math.round(T_YEAR / 2));
T_QUARTER = Math.max(1, Math.round(T_YEAR / 4));

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
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var city0 = st.cities[0];
st.settings.timeScale = TS;   /* v89.98：1× 默认（1 游戏秒 / 现实秒） */
st.settings.autoUpgrade = true;
st.settings.autoResearch = true;
st.settings.battleWatch = true;
st.settings.innAuto = { on: true, min: 'ying' };
G.ui = G.ui || {}; G.ui._cityId = city0.id;

var amc = G.autoMarchCfg();
amc.on = false;   /* v89.98b：**停掉自动出征**！出征改由脑按「体力优先」调度
                     （keepOccupying / siegeBrain / 建城占平原）——不再有引擎级体力黑洞。 */
amc.genId = null; amc.troops = 500; amc.target = 'wild'; amc.maxLevel = 2;
amc.mode = 'occupy';   /* v89.98a：直接**占领**野地（原来只掠夺 —— 家里永远"无自家野地可采"，
                          采集线整局饿死；占领同时把 occupy1 里程碑一并做掉） */
amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;
/* v89.99（老板「代码岂能钉死」）：amc.on **不再钉死** ——
   由 applyPolicies() 按阶段与条件动态翻转：军力有余量就放出去收割资源，
   吃紧或没有采集将可用就收回。执行将与围攻将**分班**（见 pickAmcGen）。 */

RUN('=== v89.92 多策略对照推演开始（STRAT v1 · MODE=' + MODE + '） ===');
RUN('建局：北辰 · 「许都」· 豫州 · mapSeed=20260921 · ' + TS + '× · 目标 ' + MAXT + ' tick（'
  + (MAXT * TS / 57600).toFixed(2) + ' 游戏年 = ' + (MAXT / 3600).toFixed(1) + ' 现实小时）');
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
  /* v89.98b：占平原是筑城的门票（1× 里 city2 卡死的直接原因）—— 一样体力优先 */
  var gen = pickSiegeGen(); if (!gen) return { have: false };
  if (!staminaFix(gen, 30)) return { have: false };
  var spot = findPlainSpot(); if (!spot) return { have: false };
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 100);
  if (tk.total < 60) return { have: false };   /* v89.98b：280 → 60 */
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
  { bid: 'minfang', want: 8 }, { bid: 'majiu', want: 1 }, { bid: 'tiejiangpu', want: 1 },
  { bid: 'gongjiangzuofang', want: 1 }
];
function tryBuildNew() {
  /* v89.100：econ 排除军事建筑（兵营 / 烽火台）—— 不发展军事，连建造都不碰 */
  var _prio = BUILD_PRIO;
  if (MODE === 'econ') _prio = BUILD_PRIO.filter(function (x) { return x.bid !== 'junying' && x.bid !== 'fenghuotai' && x.bid !== 'majiu'; });   /* 马厩前置=军营Lv3（econ 无军营 → 永远够不着，首测刷屏 7900+ 次） */
  st.cities.forEach(function (city) {
    var slots = G.buildSlots(city);
    for (var i = 0; i < _prio.length; i++) {
      var it = _prio[i];
      if (countBuild(city, it.bid) >= it.want) continue;
      if (G.buildQueueUsed(city.id) >= slots) return;
      var idx = emptyCell(city);
      if (idx < 0) return;
      setCity(city);
      var r = safeCall('build.' + city.name + '.' + it.bid, function () { return G.buildAt(city.id, idx, it.bid); });
      if (r && r.ok) { RUN('🏗 开建：' + city.name + ' ' + it.bid + ' @格' + idx); continue; }
      if (r && !r.ok) { noteSoft('build.' + city.name + '.' + it.bid, r.msg); continue; }
    }
  });
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
  /* ⛔ v89.141（复核修复 · 工具跟随）：`G.wallPendingOf` / `city.wallLv` / `G.buildWall`
     在 v89.126「城墙并入建筑体系」时整条退役（城墙走**环城槽** `city.wall`，
     建造/升级走通用 buildAt/upgradeAt）—— 原调用每拍 TypeError
     （96h 跑出 **2890 次**错误，城墙线整条停摆）。改为新形态。 */
  var lv = G.buildingLevel(city, 'chengqiang') || 0;
  if (city.wall && city.wall.pending) return;                    /* 施工中不重排 */
  if (lv >= G.buildCapOf(city, 'chengqiang')) return;
  var r = safeCall('wall', function () {
    return lv > 0 ? G.upgradeAt(city.id, 'wall') : G.buildAt(city.id, 'wall', 'chengqiang');
  });
  if (r && r.ok) RUN('🧱 城墙 → Lv' + (lv + 1) + ' 开建');
  if (r && !r.ok) noteSoft('wall', r.msg);
}
/* 5.4 募兵 */
var TROOP_ORDER = ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'];
if (MODE === 'span') TROOP_ORDER = ['qingji', 'tieji', 'changqiang', 'daodun', 'gongjian', 'yibing'];   /* v89.101：城流跨越以轻骑为主力 */
if (MODE === 'span') RUN('🧪 SPAN 模式：城流跨越（筑城无上限 + 轻骑批量成军 + 军链抢建）');
function armyTarget() {
  var y = yNow();
  /* v89.98b：目标下调 —— 原 5000/15000/40000 远超 18.75 年的人口供给（人口=民房唯一来源），
     会导致"永远征兵中"把人口抽干（城 2 因此建不起来）。 */
  if (y < 0.25) return 300;
  if (y < 1) return 1000;
  if (y < 3) return 3000;
  if (y < 8) return 8000;
  if (y < 20) return 15000;
  if (y < 50) return 100000;
  return 300000;
}
function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */
  /* v89.99：募兵缺人而人口银行有货 → 先解散义兵放人（"要特定兵种时解散改募"） */
  if (!(((G.res(st.cities[0]) || {}).pop) >= 60) && tNow - REL_LAST > 300) {
    REL_LAST = tNow;
    releaseBank(150, '募兵缺人');       /* v89.99：5 分钟一次上限 —— 放人是桥，不是常态 */
  }
  /* v89.98b：**筑城前保住人口**（筑城要 100 人）。阈值 110：既保住建城底线，
     又留 90+ 兵力给"占平原"（150 会死锁：兵太少连平原都占不下）。城 3 前同样保护。 */
  if (st.cities.length < 3 && ((G.res(st.cities[0]) || {}).pop || 0) < 110) return;
  var target = armyTarget(), cur = totalArmy();
  if (cur >= target) return;
  var lack = target - cur;
  st.cities.forEach(function (city) {
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    setCity(city);
    /* v2：从精锐到基础逐个尝试 —— **未解锁的兵种要跳过继续试后面的**
       （v1 在第一个失败处 return —— 永远试不到义兵，五年一兵未募的根因） */
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
  order = order || ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'];
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
  var tkG = takeArmy(c0, 300, ['minfu', 'yibing', 'changqiang', 'daodun', 'gongjian', 'qingji']);
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
  if (totalArmy() < 80) return;          /* v89.98b：400 → 80（人口增长 4~9 人/游戏小时 · 开局仅 ~90 兵可用） */
  /* v89.98b：体力优先 —— 选体力最高空闲将；不足 30 先嗑药/等待（不再空转撞墙） */
  var gen = pickSiegeGen(); if (!gen) return;
  if (!staminaFix(gen, 30)) return;
  var spot = findWildSpot(4, true);
  if (!spot) return;
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 100);
  if (tk.total < 60) return;             /* v89.98b：280 → 60 */
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
  /* v89.100：econ 金主要花在经验书（大宗 40 万/本）→ 卖出阈值抬到 25 万；其余模式照旧 */
  if (gold > (MODE === 'econ' ? 250000 : 150000)) return;
  var grain = st.res.grain || 0;
  if (grain < 900000) return;                /* 先保 60 万粮底 */
  /* v89.98b：同 goldSell —— 折价区不卖（保资源建设） */
  var _slip3 = null; try { _slip3 = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  if (_slip3 && _slip3.mul < 0.85) {
    var _capC = 0; try { _capC = G.storeCapOf ? G.storeCapOf(st.cities[0]) : 0; } catch (e) {}
    if (!(_capC > 0 && grain > _capC * 0.7)) return;   /* v89.98c：同 goldSell 淤积兜底 */
  }
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
  var wantLv = y < 2 ? 2 : y < 5 ? 4 : y < 15 ? 6 : y < 40 ? 7 : 8;
  var wantTroops = y < 0.5 ? 500 : y < 2 ? 2000 : y < 5 ? 5000 : y < 20 ? 10000 : y < 60 ? 20000 : 50000;
  if (amc.maxLevel !== wantLv) amc.maxLevel = wantLv;
  if (amc.troops !== wantTroops) amc.troops = wantTroops;
  /* v89.99：执行将不再"随便抓一个空闲的"（那是 RUSH v89.98 的体力黑洞根源）——
     交给 applyPolicies 的两班分权：围攻将 / 采集将分开，互不抢体力。 */
}

/* ============================================================
 * v89.91 GOLD 策略脑（黄金流对照）—— 与种田基线 play_600x.js 的唯一差异
 * ------------------------------------------------------------
 * 老板假说：金换批招高资质 → 金买经验书升将 → 用光自由点 →
 *           金提速（建造/生产/募兵）→ 增长应是指数级。
 * 本段如实实现该策略，全部走游戏既有出口（不新增任何游戏规则）：
 *   goldSell   全资源溢出套现（基线只卖粮）     → GAME.marketSell
 *   goldInn    客栈花金换批直到出英杰           → GAME.innReroll + innAuto（门槛=英杰）
 *   goldBooks  最优档经验书喂「高潜将」         → GAME.doShopping + systems.useItemMany
 *   goldPoints 用光全部自由点                   → GAME.addFreePoint
 *   goldRush   建造/科技队列花金立成            → GAME.queueRushPay
 *   goldTrainRush 募兵队列花金买时间            → GAME.trainRush
 *   goldGuards 各城守将 = 本城最高内政者        → GAME.assignGeneral
 *   goldHerbs  灵草升档（给高潜将）             → systems.useItem（rank_up 分支）
 *   goldNeigong 守卫修内功（内政 +6/重）        → GAME.doShopping + systems.useItem
 *   goldLord   君主练功 + 突破                  → GAME.doLordTrain / doLordBreak
 * ============================================================ */
var GOLD = {
  version: 'GOLD v1',
  reserve: 300000,                                  /* 金保留下限（不动） */
  spends: { inn: 0, books: 0, build: 0, tech: 0, train: 0, neigong: 0 },
  rerolls: 0, recruits: 0, booksUsed: 0,
  salesCount: 0, goldSold: 0, freePts: 0,
  milestones: {}
};
function gml(id, s) { if (GOLD.milestones[id]) return; GOLD.milestones[id] = 1; RUN('🏆 ' + s); }
function maxGenLv() { var m = 0; (st.generals || []).forEach(function (g) { if ((g.level || 1) > m) m = g.level || 1; }); return m; }
function rankIdxOf(g) { return G.rankIndex(G.rankOf(g).id); }
function eliteCount() { var n = 0; (st.generals || []).forEach(function (g) { if (rankIdxOf(g) >= 2) n++; }); return n; }
function richCity() {
  var best = st.cities[0], bg = -1;
  st.cities.forEach(function (c) { var g = G.res(c).gold || 0; if (g > bg) { bg = g; best = c; } });
  setCity(best); return best;
}
function guardNzOf(g) { return Math.round((G.genAttrs(g) || {}).nz || 0); }

/* ---------- ① 全资源溢出套现（粮木石铁，基线只卖粮） ---------- */
var GS_LAST = -1e9;
function goldSell() {
  if (tNow - GS_LAST < 120) return;
  GS_LAST = tNow;
  var buf = { grain: 500000, wood: 250000, stone: 250000, iron: 350000 };
  st.cities.forEach(function (city) {
    setCity(city);
    ['grain', 'wood', 'stone', 'iron'].forEach(function (r) {
      var s0 = (G.res(city)[r] || 0);
      var over = s0 - buf[r];
      if (over < 60000) return;
      /* v89.98b：**只在保价区卖**（mul ≥ 0.85）—— 触底抛售正是 1× 建筑等级只有
         120× 三分之一的根因。资源优先留给建设。 */
      var _slip = null; try { _slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
      if (_slip && _slip.mul < 0.85) {
        /* v89.98c：折价区默认不卖（保资源建设）；**淤积 >70% 仓容时兜底**（高倍速无每日重置）。 */
        var _capB = 0; try { _capB = G.storeCapOf ? G.storeCapOf(city) : 0; } catch (e) {}
        if (!(_capB > 0 && s0 > _capB * 0.7)) return;
      }
      var amt = Math.min(over, 5000000);
      var gg = 0; try { gg = G.marketSellGold(r, amt); } catch (e) {}
      var rr = safeCall('gold.sell', function () { return G.marketSell(r, amt); });
      if (rr && rr.ok) { GOLD.salesCount++; GOLD.goldSold += gg; }
      else if (rr && !rr.ok) noteSoft('gold.sellfail', rr.msg);
    });
  });
  richCity();
}

/* ---------- ② 客栈：花金换批 → 自动招英杰 ---------- */
var GI_LAST = -1e9;
function goldInn() {
  if (tNow - GI_LAST < 90) return;
  GI_LAST = tNow;
  var cfg = G.innAutoCfg();
  cfg.on = true;
  cfg.min = (GOLD.recruits < 6 && yNow() < 120) ? 'ying' : 'liang';
  st.cities.slice().sort(function (a, b) { return (G.res(b).gold || 0) - (G.res(a).gold || 0); })
    .forEach(function (city) {
      if ((G.innLevel(city) || 0) < 6) return;        /* 客栈太低不出货，等升上来 */
      if (G.genFreeOf(city) <= 0) return;
      setCity(city);
      var budget = Math.min((G.res(city).gold || 0) - 200000, 450000);
      var guard = 0;
      while (guard++ < 80) {
        if (G.genFreeOf(city) <= 0) break;
        var cost = G.innRefreshCost();
        if (budget < cost || (G.res(city).gold || 0) < cost + 100000) break;
        var before = (st.stats && st.stats.recruited) || 0;
        var r = safeCall('gold.innReroll', function () { return G.innReroll(); });
        if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.inn.fail', r.msg); break; }
        GOLD.rerolls++; GOLD.spends.inn += cost; budget -= cost;
        if (((st.stats && st.stats.recruited) || 0) > before) {
          GOLD.recruits++;
          var ng = st.generals[st.generals.length - 1];
          if (ng) {
            noteSoft('gold.recruit', '客栈录用 ' + ng.name + '（' + G.rankOf(ng).name + '）');
            if (rankIdxOf(ng) >= 2) gml('firstElite', '客栈录得高资质：' + ng.name + '（' + G.rankOf(ng).name + '）');
          }
        }
      }
    });
  richCity();
}

/* ---------- ③ 经验书：喂「高潜将」（资质优先 → 守将 → 等级） ---------- */
var GB_LAST = -1e9;
function goldBookTarget() {
  var list = (st.generals || []).filter(function (g) { return !g.isLord; });
  list.sort(function (a, b) {
    var ra = rankIdxOf(a), rb = rankIdxOf(b);
    if (ra !== rb) return rb - ra;
    var ga = (a.status === 'guard') ? 1 : 0, gb = (b.status === 'guard') ? 1 : 0;
    if (ga !== gb) return gb - ga;
    return (b.level || 1) - (a.level || 1);
  });
  for (var i = 0; i < list.length; i++) {
    if (rankIdxOf(list[i]) < 1) continue;            /* 凡品不喂 */
    if (G.expBlocked(list[i])) continue;
    return list[i];
  }
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (lord && !G.expBlocked(lord)) return lord;
  return null;
}
function gmlLv(g, lv) {
  [{ l: 60, t: '首位 Lv60' }, { l: 100, t: '首位 Lv100' }, { l: 140, t: '首位 Lv140（英杰满级）' },
   { l: 180, t: '首位 Lv180（名世满级）' }, { l: 240, t: '首位 Lv240（天授满级）' }].forEach(function (x) {
    if (lv >= x.l) gml('lv' + x.l, x.t + '：' + g.name + '（' + G.rankOf(g).name + '）Lv' + lv);
  });
}
function goldBooks() {
  if (tNow - GB_LAST < 60) return;
  GB_LAST = tNow;
  var tgt = goldBookTarget();
  if (!tgt) return;
  /* 档位按「每金经验」效率从高到低；买得起哪档用哪档（大宗优惠口径） */
  var tiers = [['bingsheng', 400000], ['taigong_bingshu', 330000], ['bingxian_yipian', 240000],
    ['mingjiang_xinchuan', 156000], ['dudu_bingfa', 84000], ['jiangjun_zhanlu', 45000]];
  var guard = 0;
  while (guard++ < 60) {
    var rich = richCity();
    var budget = (G.res(rich).gold || 0) - GOLD.reserve;
    if (budget < 45000) break;
    var tier = null;
    for (var i = 0; i < tiers.length; i++) { if (budget >= tiers[i][1]) { tier = tiers[i]; break; } }
    if (!tier) break;
    /* v2 修 bug：**按需购买（一次一本）** —— v1 按预算买 120 本/次，超出目标上限
       的部分全堆进背包（实测终局积压 570 本千古兵圣 = 2.28 亿金存货，报表失真）。
       现在：背包有同档存货先用存货；否则买 1 本 → 用 1 本 → 循环。 */
    var use = null;
    var bagN = st.items[tier[0]] || 0;
    if (bagN > 0) {
      use = safeCall('gold.use', function () { return G.systems.useItemMany(tier[0], tgt.id, 1); });
    } else {
      var r = safeCall('gold.buy', function () { return G.doShopping(tier[0], 1); });
      if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.buyfail', r.msg); break; }
      var bought = r.bought || 0;
      if (bought <= 0) break;
      GOLD.spends.books += tier[1] * bought;
      use = safeCall('gold.use', function () { return G.systems.useItemMany(tier[0], tgt.id, bought); });
    }
    var used = (use && use.count) || 0;
    if (used <= 0) { if (use && !use.ok) noteSoft('gold.usefail', use.msg); break; }
    GOLD.booksUsed += used;
    gmlLv(tgt, tgt.level || 1);
    if (G.expBlocked(tgt)) break;                    /* 到顶 → 下一轮换人 */
  }
}

/* ---------- ④ 自由点：全部用光（守将/高潜 → 内政；其余 → 勇武） ---------- */
function goldPoints() {
  var list = (st.generals || []).filter(function (g) { return !g.isLord; });
  list.sort(function (a, b) {
    var ra = rankIdxOf(a), rb = rankIdxOf(b);
    if (ra !== rb) return rb - ra;
    return (b.level || 1) - (a.level || 1);
  });
  var groomed = {}, n = 0;
  for (var i = 0; i < list.length && n < 3; i++) {
    if (list[i].status !== 'guard') { groomed[list[i].id] = 1; n++; }
  }
  (st.generals || []).forEach(function (g) {
    var fp = Math.floor(g.freePts || 0);
    if (fp < 1) return;
    var stat = 'yw';
    if (!g.isLord && (g.status === 'guard' || groomed[g.id])) stat = 'nz';
    var r = safeCall('gold.pts', function () { return G.addFreePoint(g, stat, fp); });
    if (r && r.ok) GOLD.freePts += fp;
  });
}

/* ---------- ⑤ 队列金提速（建造 / 科技） ---------- */
function goldRush() {
  var rich = richCity();
  var minKeep = GOLD.reserve + 50000;   /* v89.98b：15 万 → 5 万（1× 里金买时间=省现实时间，值） */
  (st.queues.build || []).slice().forEach(function (q) {
    if ((G.res(rich).gold || 0) < minKeep) return;
    var c = 0; try { c = G.queueRushCost(q); } catch (e) {}
    if (!(c > 0)) return;
    var r = safeCall('gold.rush', function () { return G.queueRushPay(q, '工程'); });
    if (r && r.ok) GOLD.spends.build += c;
  });
  var tq = (st.queues.tech || [])[0];
  if (tq && (G.res(rich).gold || 0) >= minKeep) {
    var c2 = 0; try { c2 = G.queueRushCost(tq); } catch (e) {}
    if (c2 > 0) {
      var r2 = safeCall('gold.rusht', function () { return G.queueRushPay(tq, '研究'); });
      if (r2 && r2.ok) GOLD.spends.tech += c2;
    }
  }
}

/* ---------- ⑥ 募兵花金买时间（高水位才动 —— 大兵力批次很贵） ---------- */
function goldTrainRush() {
  var rich = richCity();
  var minKeep = GOLD.reserve + 100000;  /* v89.98b：60 万 → 10 万 */
  if (MODE === 'span') minKeep = GOLD.reserve + 15000;   /* v89.101c：骑兵批量不被保留线压住 */
  st.cities.forEach(function (city) {
    if ((G.res(rich).gold || 0) < minKeep) return;
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    var q = G.trainRunningOf(city.id, jy.idx, 'train');
    if (!q) return;
    var c = 0; try { c = G.trainRushCost(q, 1.0); } catch (e) {}
    if (!(c > 0)) return;
    var r = safeCall('gold.trush', function () { return G.trainRush(city.id, jy.idx, 1.0, 'train'); });
    if (r && r.ok) GOLD.spends.train += c;
  });
}

/* ---------- ⑦ 守将：本城最高内政者（带滞后带，防来回换） ---------- */
function goldGuards() {
  if ((st.generals || []).length < 3) return;
  st.cities.forEach(function (city) {
    var cur = G.guardGeneralOf(city);
    var best = null, bn = -1;
    (G.generalsIn(city) || []).forEach(function (g) {
      if (g.isLord) return;
      var okState = (g.status === 'idle') || (g.status === 'guard' && g.cityId === city.id);
      if (!okState) return;
      var nz = guardNzOf(g) * 1000 + (g.level || 1);
      if (nz > bn) { bn = nz; best = g; }
    });
    if (!best) return;
    if (cur && best.id === cur.id) return;
    var curScore = cur ? (guardNzOf(cur) * 1000 + (cur.level || 1)) : -1;
    if (cur && bn <= curScore + 5000) return;
    var r = safeCall('gold.guard', function () { return G.assignGeneral(best.id, 'guard', city.id); });
    if (r && r.ok) noteSoft('gold.guard', r.msg);
  });
}

/* ---------- ⑧ 灵草升档（秘境产；优先给守将/高等级） ---------- */
function goldHerbs() {
  ['tianshouguo', 'hualongshen', 'xisuizhi', 'yunlingcao'].forEach(function (hid) {
    var guard = 0;
    while ((st.items[hid] || 0) > 0 && guard++ < 20) {
      var item = G.systems.itemInfo(hid);
      if (!item) break;
      var tgt = null, bs = -1;
      (st.generals || []).forEach(function (g) {
        if (G.rankOf(g).id !== item.from) return;
        if (g.status === 'march' || g.status === 'gather') return;
        var sc = (g.level || 1) + ((g.status === 'guard') ? 1000 : 0);
        if (sc > bs) { bs = sc; tgt = g; }
      });
      if (!tgt) { noteSoft('gold.herbno', hid + '：无适用资质的将领（from=' + item.from + '）'); break; }
      var r = safeCall('gold.rankup', function () { return G.systems.useItem(hid, tgt.id); });
      if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.rankupfail', r.msg); break; }
      gml('rankup1', '🧬 灵草升档：' + r.msg);
    }
  });
}

/* ---------- ⑨ 内功（守卫修尉缭子·内政 +6/重；君主修三略·勇武 +6/重） ---------- */
var GNG_LAST = -1e9;
function goldNeigong() {
  if (tNow - GNG_LAST < 300) return;
  GNG_LAST = tNow;
  var pairs = [];
  st.cities.forEach(function (c) { var g = G.guardGeneralOf(c); if (g) pairs.push({ g: g, book: 'book_weiliu', ng: 'weiliu' }); });
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (lord) pairs.push({ g: lord, book: 'book_sanlue', ng: 'sanlue' });
  pairs.forEach(function (p) {
    var g = p.g;
    if (g.ng && g.ng.id && g.ng.id !== p.ng) return; /* 已修他门，不转修 */
    var lv = (g.ng && g.ng.id === p.ng) ? (g.ng.lv || 0) : 0;
    var steps = 0, before = lv;
    while (lv < 10 && steps++ < 12) {
      var rich = richCity();
      if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) break;   /* v89.98b：10 万 → 4 万 */
      var b = safeCall('gold.ngbuy', function () { return G.doShopping(p.book, 1); });
      if (!b || !b.ok) break;
      GOLD.spends.neigong += 16000;
      var u = safeCall('gold.nguse', function () { return G.systems.useItem(p.book, g.id); });
      if (!u || !u.ok) { if (u && !u.ok) noteSoft('gold.nguse', u.msg); break; }
      lv = (g.ng && g.ng.lv) || 0;
    }
    if (lv > before) noteSoft('gold.ng', '📖 ' + g.name + ' 内功「' + p.ng + '」→ ' + lv + ' 重');
  });
}

/* ---------- ⑩ 君主：练功 + 突破（段顶自动续升） ---------- */
var GL_LAST = -1e9;
function goldLord() {
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (!lord) return;
  if (tNow - GL_LAST >= 120) {
    GL_LAST = tNow;
    if (G.staNow(lord) > DATA.STAMINA.base * 0.4) {
      var r1 = safeCall('gold.lordTrain', function () { return G.doLordTrain(); });
      if (r1 && !r1.ok) noteSoft('gold.lordTrain', r1.msg);
    }
  }
  var need = G.lordCultivNeed(lord);
  if (need != null && (lord.cultiv || 0) >= need) {
    var r2 = safeCall('gold.lordBreak', function () { return G.doLordBreak(); });
    if (r2 && r2.ok) gml('lordBreak' + G.lordBreaksOf(lord), '👑 君主突破：' + r2.msg);
  }
}

/* ---------- ⑪ 状态行 ---------- */
function goldLine() {
  return '💰 黄金流：累卖 ' + fmtNum(GOLD.goldSold) + ' 金/' + GOLD.salesCount + ' 笔'
    + ' · 书耗 ' + fmtNum(GOLD.spends.books) + '（' + GOLD.booksUsed + ' 本）'
    + ' · 换批 ' + GOLD.rerolls + ' 次/招 ' + GOLD.recruits + ' 人（英杰 ' + eliteCount() + '）'
    + ' · 提速 建' + fmtNum(GOLD.spends.build) + '/科' + fmtNum(GOLD.spends.tech) + '/兵' + fmtNum(GOLD.spends.train) + '/内功' + fmtNum(GOLD.spends.neigong)
    + ' · 最高将 Lv' + maxGenLv();
}


/* ============================================================
 * v89.92 · 策略脑 A：BUFF（宝物流）
 * ------------------------------------------------------------
 * 探针实证（probe_v8992）：
 *   · 生产类宝物 3,000 金 = 产量 +100%，且 prodUntil **从不被消费**
 *     （死字段）→ 永不到期、叠加无上限 —— 游戏内最便宜的金→产量出口；
 *   · 符类（治粟+安民+玄德+文曲星）= 守将内政 ×6.56（24h，正常到期）；
 *   · 大役令 = 建造队列 +5（24h）。
 * 本段如实实现这条路线，全部走游戏既有出口（doShopping + useItem），
 * 不新增任何游戏规则。
 * ============================================================ */
var ITEM_PRICE = {}, MAT_PRICE = {};
(DATA.ITEMS || []).forEach(function (x) { if (x.price) ITEM_PRICE[x.id] = x.price * 100; });
(DATA.MATERIALS || []).forEach(function (m) { MAT_PRICE[m.id] = (m.price || 0) * 100; });

var BUFF = { spend: { prod: 0, attr: 0, corvee: 0 }, units: {}, flags: {}, tFirst: null };
/* ① 大役令：建造队列 +5（24h；一次） */
function buffCorvee() {
  if (BUFF.flags.corvee) return;
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) return;
  var b = safeCall('buff.cvBuy', function () { return G.doShopping('corvee5', 1); });
  if (!b || !b.ok) return;
  var u = safeCall('buff.cvUse', function () { return G.systems.useItem('corvee5', null); });
  if (u && u.ok) { BUFF.flags.corvee = 1; BUFF.spend.corvee += 20000; RUN('🎏 大役令：建造队列 → ' + G.buildSlots(rich)); }
}
/* ② 符类：各城守将四符叠加（内政 ×6.56；到期自动续） */
var BA_LAST = -1e9;
var ATTR_FU = [['zhisu', 28000], ['anmin', 20000], ['xuande', 13000], ['wenquxing', 6000]];
function buffAttr() {
  if (tNow - BA_LAST < 240) return;
  BA_LAST = tNow;
  ATTR_FU.forEach(function (pair) {
    var id = pair[0], price = pair[1];
    st.cities.forEach(function (city) {
      var g = G.guardGeneralOf(city);
      if (!g) return;
      var cur = (st.buffs && st.buffs.gens && st.buffs.gens[g.id]) || {};
      if (cur[id] && cur[id].until > U.now()) return;
      var rich = richCity();
      if ((G.res(rich).gold || 0) < price + GOLD.reserve) return;
      var b = safeCall('buff.fuBuy', function () { return G.doShopping(id, 1); });
      if (!b || !b.ok) return;
      var u = safeCall('buff.fuUse', function () { return G.systems.useItem(id, g.id); });
      if (u && u.ok) {
        BUFF.spend.attr += price;
        if (!BUFF.flags['fu' + id]) { BUFF.flags['fu' + id] = 1; RUN('🎏 符类叠起：' + g.name + ' ← ' + (DATA.ITEMS.filter(function (x) { return x.id === id; })[0] || {}).name + '（nz ' + guardNzOf(g) + '）'); }
      }
    });
  });
}
/* ③ 生产宝物：金 → 产量 直接兑换（v89.93 修复后：同类只取最强 + 24h 到期）
   —— 脑按游戏规则行动：同类已有**同级或更强**效果就不再买（钱留给别的线）。 */
var BP_LAST = -1e9;
var PROD_FLOOR = 50000;
var PROD_LIST = [['houji', 3000, 200], ['ganjianglu', 3000, 40], ['jumuling', 3000, 40], ['yugongling', 3000, 40], ['taozhu', 5000, 40]];
function prodItemOf(id) {
  var hit = null;
  (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) hit = x; });
  return hit;
}
function buffOkFor(id) {
  /* 返回 true = 值得买（当前无该资源效果，或现存效果弱于本品） */
  var it = prodItemOf(id);
  if (!it) return false;
  var prod = (st.buffs && st.buffs.prod) || {};
  var until = (st.buffs && st.buffs.prodUntil) || {};
  var cur = prod[it.res] || 0;
  var live = (until[it.res] || 0) > U.now();
  return !(live && cur >= (it.eff || 0));
}
function buffProd() {
  if (tNow - BP_LAST < 90) return;
  BP_LAST = tNow;
  var rich = richCity();
  var surplus = (G.res(rich).gold || 0) - PROD_FLOOR;
  if (surplus < 3000) return;
  var budget = Math.min(surplus * 0.55, 3000000);
  PROD_LIST.forEach(function (it) {
    if (budget < it[1]) return;
    if (!buffOkFor(it[0])) return;                   /* v89.93：已有同级/更强 → 不重复买 */
    var n = 1;                                       /* v89.93：买 1 个即可（刷新 24h） */
    var b = safeCall('buff.pbBuy', function () { return G.doShopping(it[0], n); });
    if (!b || !b.ok || !b.bought) return;
    var got = b.bought;
    var u = safeCall('buff.pbUse', function () { return G.systems.useItemMany(it[0], null, got); });
    var used = (u && u.count) || 0;
    BUFF.spend.prod += it[1] * got;
    BUFF.units[it[0]] = (BUFF.units[it[0]] || 0) + used;
    budget -= it[1] * got;
    if (!BUFF.tFirst && used > 0) { BUFF.tFirst = tNow; RUN('🎏 生产宝物线点火：首个「' + it[0] + '」（+100% 产量/个 · 3,000 金）'); }
  });
}

/* ============================================================
 * v89.92 · 策略脑 B：EQUIP（装备流）
 * ------------------------------------------------------------
 * 老板假说：「装备拉满 + 强化拉满 → 原始积累会更快？」
 * 本段如实实现这条路线：
 *   铁匠铺升 Lv7 → 买图纸 → 缺材料就买 → 打造 12 件倚天套
 *   → 百炼逐级升到 +10 → 整套装到主城守将。
 * 目标套装 = 倚天套（探针实测：+10 后内政 +861 —— 七套中唯一
 * 能显著抬内政的套装；全成本约 4,004 万金）。
 * ============================================================ */
var EQUIP = {
  spend: { bp: 0, mat: 0, craft: 0, enh: 0 },
  crafted: {}, wornCount: 0, wornGen: null,
  tCraft1: null, tCraft12: null, tEnh120: null, tWorn12: null
};
var YT_IDS = null;
function ytIds() {
  if (!YT_IDS) YT_IDS = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; });
  return YT_IDS;
}
function forgeCity() {
  var best = null;
  st.cities.forEach(function (c) {
    var lv = G.buildingLevel(c, 'tiejiangpu') || 0;
    if (lv > 0 && (!best || lv > best.lv)) best = { city: c, lv: lv };
  });
  return best;
}
/* ① 铁匠铺专职升级到 Lv7 */
var EF_LAST = -1e9;
function equipForgeUp() {
  if (tNow - EF_LAST < 60) return;
  EF_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv >= 7) return;
  var city = f.city;
  if (!G.checkBuildSlot(city.id).ok) return;
  var c = cellOf(city, 'tiejiangpu');
  if (!c) return;
  setCity(city);
  var r = safeCall('equip.forgeUp', function () { return G.upgradeAt(city.id, c.idx); });
  if (r && r.ok) { RUN('⚒ 装备流：铁匠铺 → Lv' + (f.lv + 1) + ' 开建'); EF_LAST = tNow + 240; }
  else if (r && !r.ok) noteSoft('equip.forgeUp', r.msg);
}
/* ② 打造（缺材料/图纸先买；每轮一件，大额支出留痕） */
var EC_LAST = -1e9;
function equipCraft() {
  if (tNow - EC_LAST < 60) return;
  EC_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv < 7) return;
  setCity(f.city);
  var ids = ytIds();
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (EQUIP.crafted[id]) continue;
    var cost = G.forgeCost(id) || {}, mats = G.forgeMaterials(id) || {};
    var need = (cost.gold || 0);
    var lacks = [];
    for (var k in mats) {
      var have = st.items[k] || 0;
      if (have < mats[k]) { lacks.push([k, mats[k] - have]); need += (mats[k] - have) * (MAT_PRICE[k] || 0); }
    }
    if (!(st.items.bp_yitian > 0)) need += 32000;
    if ((G.res(f.city).gold || 0) - GOLD.reserve < need) return;   /* 钱不够，等下一轮 */
    for (var li2 = 0; li2 < lacks.length; li2++) {
      var lackRow = lacks[li2];
      var b1 = safeCall('equip.matBuy', function () { return G.doShopping(lackRow[0], lackRow[1]); });
      if (b1 && b1.ok) EQUIP.spend.mat += lackRow[1] * (MAT_PRICE[lackRow[0]] || 0);
    }
    if (!(st.items.bp_yitian > 0)) {
      var b2 = safeCall('equip.bpBuy', function () { return G.doShopping('bp_yitian', 1); });
      if (b2 && b2.ok) EQUIP.spend.bp += 32000;
    }
    var r = safeCall('equip.forge', function () { return G.forge(id); });
    if (r && r.ok) {
      EQUIP.crafted[id] = 1; EQUIP.spend.craft += (cost.gold || 0);
      var cnum = Object.keys(EQUIP.crafted).length;
      if (!EQUIP.tCraft1) { EQUIP.tCraft1 = tNow; RUN('⚒ 装备流：首件打造 ' + r.msg + '（1/12）'); }
      else if (cnum % 4 === 0) RUN('⚒ 装备流：倚天套进度 ' + cnum + '/12');
      if (cnum >= 12 && !EQUIP.tCraft12) { EQUIP.tCraft12 = tNow; RUN('🏆 装备流：倚天套 12 件打造完成'); }
    } else if (r && !r.ok) { noteSoft('equip.forge', r.msg); }
    return;   /* 每轮只打造一件 */
  }
}
/* ③ 百炼 +10（逐级；钱/铁/石够就升一件） */
var EE_LAST = -1e9;
function equipEnhance() {
  if (tNow - EE_LAST < 40) return;
  EE_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv < 7) return;
  setCity(f.city);
  var ids = ytIds();
  for (var ii = 0; ii < ids.length; ii++) {
    var id = ids[ii];
    var inst = G.eqFind(id);
    if (!inst) continue;
    var lv = G.eqEnhOf(inst);
    if (lv >= 10) continue;
    var c = G.enhCost(inst) || {};
    if ((G.res(f.city).gold || 0) - GOLD.reserve < (c.gold || 0)) return;
    if ((st.res.iron || 0) < (c.iron || 0) || (st.res.stone || 0) < (c.stone || 0)) return;
    var r = safeCall('equip.enh', function () { return G.enhance(inst.u); });
    if (r && r.ok) {
      EQUIP.spend.enh += (c.gold || 0);
      if (G.eqEnhOf(inst) >= 10) {
        var all10 = ytIds().every(function (x) { var i2 = G.eqFind(x); return i2 && G.eqEnhOf(i2) >= 10; });
        RUN('⚒ 百炼：' + G.eqLabel(inst) + ' 满级（+10）' + (all10 ? ' —— 12 件全部 +10 达成' : ''));
        if (all10 && !EQUIP.tEnh120) EQUIP.tEnh120 = tNow;
      }
      return;
    }
    if (r && !r.ok) noteSoft('equip.enh', r.msg);
  }
}
/* ④ 穿戴：整套装到「主城守将」（守将变更则随迁） */
var EW_LAST = -1e9;
function equipWear() {
  if (tNow - EW_LAST < 120) return;
  EW_LAST = tNow;
  var g = G.guardGeneralOf(st.cities[0]);
  if (!g) {
    var best = null, bn = -1;
    (G.generalsIn(st.cities[0]) || []).forEach(function (x) { var nz = guardNzOf(x); if (nz > bn) { bn = nz; best = x; } });
    if (!best) return;
    safeCall('equip.guard', function () { return G.assignGeneral(best.id, 'guard', st.cities[0].id); });
    g = best;
  }
  var ids = ytIds(), n = 0;
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var cur = (g.equip || {})[DATA.EQUIP[id].slot];
    var inst = G.eqFind(id);
    if (!inst) continue;
    if (cur && G.eqId(cur) === id && G.eqUidOf(cur) === G.eqUidOf(inst)) { n++; continue; }
    var r = safeCall('equip.wear', function () { return G.systems.equipItem(g.id, inst.u); });
    if (r && r.ok) n++;
  }
  EQUIP.wornCount = n; EQUIP.wornGen = g.name;
  if (n >= 12 && !EQUIP.tWorn12) { EQUIP.tWorn12 = tNow; RUN('🏆 装备流：12 件倚天套全部上身（' + g.name + '，nz ' + guardNzOf(g) + '，产量 +' + Math.round(G.guardBonus(st.cities[0]).prod * 100) + '%）'); }
}
/* ⑤ 状态行 */
function stratLine() {
  var s = '';
  if (MODE === 'buff' || MODE === 'all' || MODE === 'rush') {
    var pf = G.prodFactors('grain', st.cities[0]) || [], fm = 1;
    pf.forEach(function (x) { fm *= (1 + x.d); });
    s += ' · 🎏宝物流：粮因子 ×' + (fm >= 1e4 ? (fm / 1e4).toFixed(2) + '万' : fm.toFixed(1))
      + ' · 犁 ' + (BUFF.units.houji || 0) + ' · 花 ' + fmtNum(BUFF.spend.prod + BUFF.spend.attr + BUFF.spend.corvee);
  }
  if (MODE === 'equip' || MODE === 'all' || MODE === 'rush') {
    var f = forgeCity();
    s += ' · ⚒装备流：炉 Lv' + (f ? f.lv : 0) + ' · 造 ' + Object.keys(EQUIP.crafted).length + '/12'
      + ' · 穿 ' + EQUIP.wornCount + '/12 · 花 ' + fmtNum(EQUIP.spend.bp + EQUIP.spend.mat + EQUIP.spend.craft + EQUIP.spend.enh);
  }
  return s;
}

/* ---------- 6. 里程碑（可延后重试） ---------- */
var MILE = [
  { id: 'raid1', at: 240, done: false, retries: 0, fn: function () {
      if (totalArmy() < 120) return 'wait';      /* v89.98b：280 → 60 */
      var gen = pickSiegeGen(); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk1 = takeArmy(st.cities[0], 150);
      if (tk1.total < 80) return 'wait';         /* v89.98b：120 → 80 */
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', tk1.army, gen.id);
      if (r && r.ok) { RUN('⚔️ 首次出征（Lv' + spot.lv + ' 野地 @' + spot.x + ',' + spot.y + '）：' + r.msg); return 'ok'; }
      if (r && !r.ok) { noteSoft('raid1', r.msg); return 'wait'; }
  } },
  { id: 'occupy1', at: 900, done: false, retries: 0, fn: function () {
      if (totalArmy() < 200) return 'wait';      /* v89.98b：500 → 200 */
      var gen = pickSiegeGen(); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk2 = takeArmy(st.cities[0], 300);
      if (tk2.total < 150) return 'wait';        /* v89.98b：350 → 150 */
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
      var chk = safeCall('scout.train', function () { return G.maxTrainCount('chihou', st.cities[0].id, (cellOf(st.cities[0], 'junying') || {}).idx); });
      var n = (typeof chk === 'number') ? chk : Number(chk && (chk.n || chk.count || chk.max) || 0);
      if (n <= 0) return 'wait';
      var jy = cellOf(st.cities[0], 'junying');
      if (!jy) return 'wait';                              /* v89.100：无兵营 → 等（此前 jy.idx 直接崩） */
      setCity(st.cities[0]);
      var c0 = st.cities[0];
      if (!c0.army.chihou || c0.army.chihou < 10) {
        var t = safeCall('scout.tr', function () { return G.train('chihou', 10, c0.id, jy.idx); });
        if (t && !t.ok) { noteSoft('scout.tr', t.msg); return 'wait'; }
      }
      if ((c0.army.chihou || 0) < 10) return 'wait';
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
      var r = G.march.dispatch({ kind: 'city', id: npc.id, npc: npc }, 'scout', { chihou: 10 }, gen.id);
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
  /* v89.100：econ 无军事 —— 跳过军事里程碑（首测：scout1 在无兵营时 jy.idx 崩溃）。
     npcIntel 是纯情报打印（只读地图），保留。 */
  var ECON_SKIP_MILE = { raid1: 1, occupy1: 1, fort1: 1, scout1: 1, city2: 1, fort2: 1, city3: 1, npcAtk: 1 };
  for (var i = 0; i < MILE.length; i++) {
    var m = MILE[i];
    if (m.done) continue;
    if (MODE === 'econ' && ECON_SKIP_MILE[m.id]) {
      m.done = true;
      RUN('⏭ 里程碑 ' + m.id + ' 跳过（econ：军事全停）');
      continue;
    }
    if (tNow < m.at) continue;   /* v3：数组非严格按 at 排序，break 会挡住后面的里程碑 */
    m.retries++;
    var r = safeCall('mile.' + m.id, m.fn);
    if (r === 'ok') { m.done = true; }
    /* v89.98b：改为按**游戏时间**兜底放弃 —— "重试 60 次"在 1× 下只覆盖 2 游戏小时
     （体力都回不满），在 120× 下却覆盖 15 游戏年。跑满 18.5 游戏年才允许放弃。 */
  else if (yNow() > 18.5 && m.retries > 60) { m.done = true; RUN('⏭ 里程碑 ' + m.id + ' 放弃（18.5 游戏年未达成）'); }
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

/* ============================================================
 * v89.98 · 策略脑 C：RUSH（1× 300h 全系统极限流）
 * ------------------------------------------------------------
 * 老板令：「以 1 倍速度测评 300h，重复利用所有板块和道具，走捷径」
 * 新增五链（全部走游戏既有出口，不新增任何规则）：
 *   ① 围攻打据点：occupy 多波次 + 围困战法（守军−12% / 破防×1.5）
 *   ② 爵位晋升：声望/城池/金/珠宝齐备即晋（每 4 档得节钺 ×1）
 *   ③ 节钺：≥2 枚时扩编（建造位 +1）；留 1 枚备天授
 *   ④ 通商券：折价张口（mul < 0.92）时开出免折窗（无券则买 1 张）
 *   ⑤ 丹药：君主勇武丹 + 主城守将内政丹（永久 +1，上限 50）
 * ============================================================ */
var RUSH = { siegeRep: 0, siegeWin: 0, siegeFail: 0, tSiege1: null,
  jieyueUsed: 0, promoteN: 0, couponN: 0, permN: 0, staUsed: 0 };
var SG_LAST = -1e9, PR_LAST = -1e9, JY_LAST = -1e9, CP_LAST = -1e9, PM_LAST = -1e9;
var SG_WATCH = null;

function fortGoingTo(x, y) {
  var going = false;
  (st.marches || []).forEach(function (m) {
    try {
      var tg = m.target || m.to || null;
      if (tg && tg.kind === 'fort' && tg.x === x && tg.y === y) going = true;
    } catch (e) {}
  });
  return going;
}
function siegeWatchCheck() {
  if (!SG_WATCH) return;
  if (!G.map.fortAt(SG_WATCH.x, SG_WATCH.y)) {
    RUSH.siegeWin++;
    RUN('🏕 据点已下：' + SG_WATCH.name + '（Lv' + SG_WATCH.lv + '）· 围攻累计下城 ' + RUSH.siegeWin + ' 座');
    SG_WATCH = null;
  } else {
    var h = null;
    try { h = G.siegeHoldOf({ kind: 'fort', x: SG_WATCH.x, y: SG_WATCH.y }); } catch (e) {}
    SG_WATCH.hold = (h == null ? 100 : Math.round(h));
  }
}
function pickSiegeSpot() {
  var c0 = st.cities[0], k, mt, x0, y0, ff;
  var reg = /^f:(-?\d+),(-?\d+)$/;
  for (k in (st.sieges || {})) {
    mt = reg.exec(k);
    if (!mt) continue;
    x0 = Number(mt[1]); y0 = Number(mt[2]);
    ff = G.map.fortAt(x0, y0);
    if (ff && ff.level <= 5) return { f: ff, resumed: true };
  }
  for (var rr = 4; rr <= 26; rr++) {
    for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      var f = G.map.fortAt(c0.x + dx, c0.y + dy);
      if (f && f.level <= 3) return { f: f, resumed: false };
    }
  }
  return null;
}
/* v89.98a：选「体力最高的空闲将」（原来 idleGen 不看体力 —— 1× 实测 1064 次派兵
   全被"体力不足"拦下：1× 下体力恢复仅 3 点/游戏小时，出征门槛 25 点）。 */
function pickSiegeGen() {
  var best = null, bs = -1;
  (st.generals || []).forEach(function (g) {
    if (g.isLord) return;                                    /* 君主不外出 */
    if (amc.genId && g.id === amc.genId) return;             /* v89.99：采集将不入围攻班（两班分权） */
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    var s = G.staNow ? G.staNow(g) : (g.stamina || 0);
    if (s > bs) { bs = s; best = g; }
  });
  return best;
}
/* 体力不足 → 金够就嗑「大还丹」（60%/3,000 金）；金不够就等（1× 经济紧张，门槛 6 万） */
function staminaFix(gen, need) {
  var sta = G.staNow ? G.staNow(gen) : (gen.stamina || 0);
  if (sta >= need) return true;
  var rich = richCity();
  /* v89.99：体力 = 围攻的燃料（1× 实测：波次上限被"药门槛"卡死 —— 全跑只买到 1 颗，
     围攻被自然再生压到 ~7 小时/波）。改**备弹制度**：
       · 金 ≥6 万 → 囤到 5 颗（每颗 3,000 金 = 8 波体力，效率远超任何别的花法）；
       · 否则金 ≥1.2 万 → 随用随买 1 颗（4 倍于药价的应急底，不再空转）。 */
  var havePill = st.items['dahuandan'] || 0;
  if (havePill <= 0) {
    if ((G.res(rich).gold || 0) < 12000) return false;
    var wantPill = (G.res(rich).gold || 0) >= 60000 ? 5 : 1;
    setCity(rich);
    var b = safeCall('rush.staBuy', function () { return G.doShopping('dahuandan', wantPill); });
    if (!b || !b.ok) return false;
  } else {
    setCity(rich);
  }
  var u = safeCall('rush.staUse', function () { return G.systems.useItem('dahuandan', gen.id); });
  if (u && u.ok) {
    RUSH.staUsed = (RUSH.staUsed || 0) + 1;
    RUN('💊 体力补给：' + gen.name + ' ← 大还丹（60% · 3,000 金）· 累计 ' + RUSH.staUsed + ' 颗');
    return true;
  }
  return false;
}
function siegeBrain() {
  if (tNow - SG_LAST < 300) return;          /* 每 5 现实分钟一波 */
  SG_LAST = tNow;
  siegeWatchCheck();
  var total = totalArmy();
  if (total < 600) return;
  var pick = pickSiegeSpot();
  if (!pick) return;
  var f = pick.f;
  if (fortGoingTo(f.x, f.y)) return;         /* 已有一支部队在路上 */
  var gen = pickSiegeGen();
  if (!gen) return;
  if (!staminaFix(gen, 30)) return;          /* v89.98a：体力 <30 → 嗑药或等待 */
  setCity(st.cities[0]);
  var take = Math.min(9000, Math.max(400, Math.floor(total * 0.45)));
  var tk = takeArmy(st.cities[0], take);
  if (!tk || tk.total < 350) return;
  var r = safeCall('rush.siege', function () {
    return G.march.dispatch({ kind: 'fort', x: f.x, y: f.y }, 'occupy', tk.army, gen.id, null, { ops: 'encircle' });
  });
  if (r && r.ok) {
    RUSH.siegeRep++;
    SG_WATCH = { x: f.x, y: f.y, name: f.name, lv: f.level, hold: 100 };
    if (!RUSH.tSiege1) { RUSH.tSiege1 = tNow; RUN('🏕 围攻线点火：' + f.name + ' Lv' + f.level + '（围困战法 · 守军−12% / 破防×1.5）'); }
  } else if (r && !r.ok) { RUSH.siegeFail++; noteSoft('rush.siege', r.msg); }
}

function promoteBrain() {
  if (tNow - PR_LAST < 600) return;
  PR_LAST = tNow;
  /* v89.98c：**先补晋爵珠宝**（硬门槛；珠宝=商城货，金够就该买齐）。 */
  var nextR = safeCall('rush.nextRank', function () { return G.systems.nextRank(); });
  if (nextR && nextR.jewel) {
    for (var jid in nextR.jewel) {
      var needJ = (nextR.jewel[jid] || 0) - (st.items[jid] || 0);
      if (needJ <= 0) continue;
      var infoJ = G.systems.itemInfo ? G.systems.itemInfo(jid) : null;
      var priceJ = (infoJ && infoJ.price ? infoJ.price : 0) * 100;
      if (!(priceJ > 0)) continue;
      var richJ = richCity();
      if ((G.res(richJ).gold || 0) < priceJ * needJ + GOLD.reserve) continue;
      setCity(richJ);
      var bJ = safeCall('rush.jewelBuy', function () { return G.doShopping(jid, needJ); });
      if (bJ && bJ.ok) RUN('💎 珠宝补齐：' + (infoJ ? infoJ.name : jid) + ' ×' + needJ + '（晋爵门槛）');
    }
  }
  var cp = safeCall('rush.canPromote', function () { return G.systems.canPromote(); });
  if (!cp || !cp.ok) return;
  var r = safeCall('rush.promote', function () { return G.systems.promote(); });
  if (r && r.ok) {
    RUSH.promoteN++;
    RUN('🏅 爵位晋升：' + (r.msg || ''));
    gml('rank' + RUSH.promoteN, '🎖 第 ' + RUSH.promoteN + ' 次晋爵：' + (r.msg || ''));
  }
}

function jieyueBrain() {
  if (tNow - JY_LAST < 600) return;
  JY_LAST = tNow;
  var have = G.jieyueOf ? G.jieyueOf() : 0;
  if (have < 2) return;                      /* 至少留 1 枚备天授 */
  var c = st.cities[0];
  var r = safeCall('rush.expand', function () { return G.jieyueExpandCity(c.id); });
  if (r && r.ok) {
    RUSH.jieyueUsed++;
    RUN('🪓 节钺扩编：' + c.name + ' 建造位 +1（余 ' + (G.jieyueOf ? G.jieyueOf() : '?') + ' 枚）');
  } else if (r && !r.ok) noteSoft('rush.expand', r.msg);
}

function couponBrain() {
  if (tNow - CP_LAST < 120) return;
  CP_LAST = tNow;
  var slip = null, fr = null;
  try { slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  try { fr = G.mktFreeOf ? G.mktFreeOf() : null; } catch (e) {}
  if (fr) return;                                    /* 免折窗已开 */
  if (!slip || !(slip.mul < 0.92)) return;           /* 折价未张口，不用 */
  if ((st.items.tongshang_quan || 0) > 0) {
    var u = safeCall('rush.couponUse', function () { return G.systems.useItem('tongshang_quan', null); });
    if (u && (u.ok || String(u.msg || '').indexOf('免折') >= 0)) { RUSH.couponN++; RUN('🎫 通商券启用（免折 30 分钟 / 50 万当量）'); }
    return;
  }
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) return;   /* v89.98b：20 万 → 4 万（折价窗口值得用券） */
  setCity(rich);
  var b = safeCall('rush.couponBuy', function () { return G.doShopping('tongshang_quan', 1); });
  if (!b || !b.ok) return;
  var u2 = safeCall('rush.couponUse2', function () { return G.systems.useItem('tongshang_quan', null); });
  if (u2 && (u2.ok || String(u2.msg || '').indexOf('免折') >= 0)) { RUSH.couponN++; RUN('🎫 通商券：买入并启用（免折 30 分钟）'); }
}

/* v89.99：**保留线 = 当前"在办目标"的下一笔开销**（条件驱动，不是年份档位）——
   建城期留筑城钱（含启动物资）；养将期留换书钱；两件都办完只剩应急底。
   金远超保留线时再压半 —— 避免"金多却被保留线锁住花不出去"（v89.98 的教训）。 */
function reserveNow() {
  var must = 20000;
  if (st.cities.length < 3) must = 40000;      /* 筑城金 1 万 + 珠宝/启动 + 缓冲 */
  else if (maxGenLv() < 140) must = 30000;
  /* v89.100：econ 保留线压低 —— 金的最大去处是经验书（买书预算 = 金 - 保留线） */
  if (MODE === 'econ') must = 12000;
  var gold = 0;
  try { gold = G.res(richCity()).gold || 0; } catch (e) {}
  if (gold > must * 3) must = Math.round(must * 0.5);
  return must;
}
/* ---------- 战利品寄售（v89.100 · 老板「以购买价 75% 出售」） ----------
   语义：把背包里可售道具（珠宝/材料/种子/图纸/宝箱…）按 75% 变金。
   保留：晋爵缺口珠宝（买了再卖白亏 25%）。出口：systems.consignAll。 */
var CSG_LAST = -1e9;
var CSG = { gold: 0, kinds: 0, pieces: 0, runs: 0, tFirst: 0 };
function consignBrain() {
  if (tNow - CSG_LAST < 120) return;
  CSG_LAST = tNow;
  if (!G.systems.consignAll) return;
  var keep = [];
  try {
    var nr = G.systems.nextRank();
    if (nr && nr.jewel) {
      /* v89.100 fix：**整类保留**下一档晋爵所需珠宝。
         ⚠️ 只保"缺口"会出死循环：promoteBrain 把缺口买齐（缺口归 0）→ 下一轮
         consignBrain 就把它们按 75% 卖掉 → promoteBrain 再买回 → 每轮白亏 25%。
         首测实测：珍珠×10 + 珊瑚×5（买 4000 金）→ 卖 3000 金，反复 6 次。 */
      for (var jid in nr.jewel) keep.push(jid);
    }
  } catch (e) {}
  /* v89.100c：**不再 setCity(richCity())** —— 首版每次寄售都切走"当前城"，
     一个副作用就让 18.75 年轨迹拐弯（配对差方向翻转：+151/+545/-928/-1387）。
     寄售按"当前城"入账（就地卖出语义）；轨迹与对照保持同一路径。 */
  /* v89.100b：**只卖攻击掉落类**（珠宝/材料/种子/图纸）—— 老板假设 = "攻击获得的道具"。
     首测无差别全卖把买来的投资品（生产宝物/体力药/加速）也变现了 → 产线断裂、
     全面慢于 rush（军 1059 vs 4198）。投资品是买来的，卖掉 = 自断供给。 */
  /* lootx = 对照：only 传空数组 → 什么都不卖（其余调用/副作用与 loot 完全一致） */
  var onlySet = (MODE === 'lootx') ? [] : ['jewel', 'material', 'seed', 'blueprint'];
  var r = safeCall('loot.consign', function () {
    return G.systems.consignAll({ keep: keep, only: onlySet });
  });
  if (r && r.ok) {
    if (!CSG.tFirst) CSG.tFirst = tNow;
    CSG.gold += r.gold; CSG.kinds += r.n; CSG.pieces += r.cnt; CSG.runs++;
    noteSoft('loot.consign', r.msg);
  }
}

function permBrain() {
  if (tNow - PM_LAST < 1800) return;
  PM_LAST = tNow;
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 60000) return;   /* v89.98b：30 万 → 6 万（丹药激活） */
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  var g0 = G.guardGeneralOf(st.cities[0]);
  var targets = [];
  if (lord) targets.push(['hugu_lingdan', lord.id]);
  if (g0 && (!lord || g0.id !== lord.id)) targets.push(['lingzhi_yulu', g0.id]);
  for (var i = 0; i < targets.length; i++) {
    var id = targets[i][0], gid = targets[i][1];
    var r = null;
    if ((st.items[id] || 0) > 0) {
      r = safeCall('rush.permUse', function () { return G.systems.useItem(id, gid); });
    } else {
      setCity(rich);
      var b = safeCall('rush.permBuy', function () { return G.doShopping(id, 1); });
      if (!b || !b.ok) continue;
      r = safeCall('rush.permUse', function () { return G.systems.useItem(id, gid); });
    }
    if (r && r.ok) { RUSH.permN++; }
    break;                                   /* 每轮只喂 1 颗 */
  }
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
    o.era = ERA.id; o.bankJ = BANK.joined; o.bankR = BANK.released;   /* v89.99：阶段与人口银行 */
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
      wall[c.id] = c.wallLv || 0;
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
    if (typeof GOLD !== 'undefined' && GOLD) {
      o.goldState = { rerolls: GOLD.rerolls, recruits: GOLD.recruits, books: GOLD.booksUsed,
        elites: eliteCount(), spend: GOLD.spends, sold: Math.round(GOLD.goldSold),
        sales: GOLD.salesCount, fp: Math.round(GOLD.freePts) };
      o.guards = st.cities.map(function (c) {
        var g = G.guardGeneralOf(c);
        return g ? { c: c.name, n: g.name, r: G.rankOf(g).name, lv: g.level, nz: guardNzOf(g) } : null;
      });
      o.genTop = (st.generals || []).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); })
        .slice(0, 6).map(function (g) {
          var a = G.genAttrs(g) || {};
          return { n: g.name, r: G.rankOf(g).name, lv: g.level || 1,
            nz: Math.round(a.nz || 0), yw: Math.round(a.yw || 0), zm: Math.round(a.zm || 0),
            f: Math.round(g.freePts || 0) };
        });
      var ph = { grain: 0, wood: 0, stone: 0, iron: 0 };
      st.cities.forEach(function (c) { var ps = G.cityProdPerSec(c) || {}; for (var kk in ph) ph[kk] += (ps[kk] || 0); });
      o.prodH = { grain: Math.round(ph.grain * 3600), wood: Math.round(ph.wood * 3600) };
    }
    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush' || MODE === 'econ') {   /* v89.100：econ 也要产量宝物（经济投资） */
      var pf2 = G.prodFactors('grain', st.cities[0]) || [], fm2 = 1;
      pf2.forEach(function (x) { fm2 *= (1 + x.d); });
      o.buff = { grainMult: +fm2.toFixed(2), units: { houji: BUFF.units.houji || 0, taozhu: BUFF.units.taozhu || 0 },
        spend: { prod: Math.round(BUFF.spend.prod), attr: Math.round(BUFF.spend.attr), corvee: Math.round(BUFF.spend.corvee) },
        gnz: (function () { var gg = G.guardGeneralOf(st.cities[0]); return gg ? guardNzOf(gg) : 0; })() };
    }
    if (MODE === 'equip' || MODE === 'all' || MODE === 'rush') {
      var fE = forgeCity();
      o.equip = { forge: fE ? fE.lv : 0, crafted: Object.keys(EQUIP.crafted).length, worn: EQUIP.wornCount,
        enhSum: ytIds().reduce(function (a2, x) { var i3 = G.eqFind(x); return a2 + (i3 ? G.eqEnhOf(i3) : 0); }, 0),
        spend: Math.round(EQUIP.spend.bp + EQUIP.spend.mat + EQUIP.spend.craft + EQUIP.spend.enh),
        gnz: (function () { var gg = G.guardGeneralOf(st.cities[0]); return gg ? guardNzOf(gg) : 0; })() };
    }
    if (typeof RUSH !== 'undefined') {
      o.rush = { sta: RUSH.staUsed, sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail,
        jy: (G.jieyueOf ? G.jieyueOf() : 0), jyUsed: RUSH.jieyueUsed,
        promo: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN,
        rank: st.rank || 0, rep: Math.round(st.rep || 0) };
    }
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\n');
  } catch (e) { noteErr('snapshot', e); }
}

/* ============================================================
 * v89.99 · 阶段自适应引擎（老板：「代码岂能钉死，条件会转换」）
 * ------------------------------------------------------------
 * 三张总资源各有一个**条件驱动**的调度器（不是按年份钉死的档位）：
 *   ① 体力：两班将（围攻将 / 采集将）分开 —— 采集只吃主攻将之外的余量；
 *      军力不足 margin 时自动收回，充足时放出去收割（会溢出的恢复 → 资源）。
 *   ② 金：保留线 = 在办目标的下一笔开销（建城期 / 养将期 / 应急底，见 reserveNow）。
 *   ③ 人口：贴顶的增长"存"进义兵（**人口银行**）；募兵缺人时解散归农再募
 *      —— 对应老板「有人口就征义兵，避免人口停在顶端；要特定兵种时解散改募」。
 * 阶段（ERA）由**条件**判定（城数/等级/战果），切换即换规则（税制/打法/掠夺模式）。
 * ============================================================ */
var ERA = { id: 'E0', n: 0, log: [] };
var BANK = { joined: 0, released: 0, peak: 0 };
var POPB_LAST = -1e9, TAX_LAST = -1e9, REL_LAST = -1e9;

function eraNow() {
  var cityN = st.cities.length;
  var lv = maxGenLv();
  var siege = RUSH.siegeWin || 0;
  if (cityN >= 3 && lv >= 120) return 'E4';        /* 鼎立：书养将 */
  if (cityN >= 3) return 'E3';                      /* 三城：围攻+晋爵 */
  if (cityN >= 2 || siege >= 1) return 'E2';        /* 双城/首胜：人口银行开张 */
  if (yNow() >= 1.5) return 'E1b';                  /* 拓野 */
  return 'E1a';                                     /* 立足 */
}
function eraRuleOf(id) {
  var T = {
    E1a: { mode: 'occupy', tax: 0.35, bank: 0, note: '立足：占野地/换将；税轻聚人' },
    E1b: { mode: 'occupy', tax: 0.35, bank: 0, note: '拓野：围攻试点；自动出征只吃余量' },
    E2:  { mode: 'occupy', tax: 0.35, bank: 1, note: '奠基：双城/首胜；人口银行开张' },
    E3:  { mode: 'raid',   tax: 0.35, bank: 1, note: '三城：围攻+晋爵；转掠夺收割' },
    E4:  { mode: 'raid',   tax: 0.5,  bank: 1, note: '鼎立：书养将；财政转常规' },
  };
  return T[id] || T.E1a;
}
function bestSta(g) { return g ? (G.staNow ? G.staNow(g) : (g.stamina || 0)) : 0; }
/* 采集将：已指定的只要还能用就不换（避免两班将来回抢位）；否则挑一个非主攻将 */
function pickAmcGen(mg) {
  var cur = null;
  (st.generals || []).forEach(function (g) { if (g.id === amc.genId) cur = g; });
  if (cur && !cur.isLord && cur.status !== 'march' && cur.status !== 'guard'
    && (!mg || cur.id !== mg.id) && bestSta(cur) >= 20) return cur;
  var pick = null;
  (st.generals || []).forEach(function (g) {
    if (g.isLord) return;
    if (mg && g.id === mg.id) return;
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    if (!pick || bestSta(g) > bestSta(pick)) pick = g;
  });
  return (pick && bestSta(pick) >= 30) ? pick : null;
}
function applyPolicies() {
  var er = eraNow();
  if (er !== ERA.id) {
    ERA.n++; ERA.id = er; ERA.log.push({ t: tNow, y: +yNow().toFixed(2), id: er });
    RUN('🚩 阶段切换 → ' + er + '（' + eraRuleOf(er).note + '）');
  }
  var RP = eraRuleOf(er);

  /* ① 体力/军力调度：两班将 + margin 条件（不足收回、充足收割） */
  var mg = pickSiegeGen();
  var pick = pickAmcGen(mg);
  /* v89.99：收割队规模**随军力伸缩**（首测暴露：固定 troops 让门槛永远够不着 →
     自动出征全程 0 翻转）。规则：不超过年度档位、不超过军力 25%、至少 600 才出门；
     门槛 = 收割队 + 600 留守。 */
  var raidN = Math.min((amc.troops || 0), Math.max(600, Math.floor(totalArmy() * 0.25)));
  if (raidN > 0 && amc.troops !== raidN) amc.troops = raidN;
  var margin = raidN + 600;
  var wantAmc = !!pick && totalArmy() >= 1200 && totalArmy() >= margin;
  if (wantAmc && amc.genId !== pick.id) {
    amc.genId = pick.id;
    RUN('🤖 采集将定班 → ' + pick.name + '（与围攻将分权，互不抢体力）');
  }
  if (amc.on !== wantAmc) {
    amc.on = wantAmc;
    RUN((wantAmc ? '🟢' : '⚪') + ' 自动出征 ' + (wantAmc ? '开' : '关') + '（' + er + '：'
      + (wantAmc ? '收割队 ' + fmtNum(raidN) + '，军力余 ' + fmtNum(totalArmy() - margin) : '军力/将不足，收回保战事') + '）');
  }
  /* 打法定式与"条件翻转"：野地技能位占满 3 块后，占领变掠夺（占领是有限的） */
  amc.mode = (ownedGatherable().length >= 3) ? 'raid' : RP.mode;

  /* ② 税制：阶段 + 财政双条件（可双向翻转） */
  if (st.tax == null) st.tax = 0.5;
  var wantTax = RP.tax;
  var goldNow = 0;
  try { goldNow = G.res(richCity()).gold || 0; } catch (e) {}
  if (wantTax < 0.5 && goldNow < 8000) wantTax = 0.5;   /* 现金见底 → 先保财政（条件翻转） */
  if (tNow - TAX_LAST > 3600 && Math.abs(st.tax - wantTax) >= 0.1) {
    TAX_LAST = tNow;
    st.tax = wantTax;
    RUN('🧾 税制切至 ' + Math.round(wantTax * 100) + '%（' + (wantTax < 0.5 ? '轻徭薄赋·聚人口' : '常规·先保财政') + '）');
  }
}

/* 人口银行：贴顶的增长"存"进义兵（避免增长停在顶端被浪费） */
function bankPop() {
  var RP = eraRuleOf(ERA.id);
  if (!RP.bank) return;
  var c = st.cities[0];
  var cap = G.maxPopOf(c);
  var pop = (G.res(c).pop || 0);
  if (cap > 0) BANK.peak = Math.max(BANK.peak, pop);
  if (cap <= 0) return;
  if (pop < cap * 0.9) return;                          /* 没贴顶：先让 tryTrain 正常吃人 */
  if (totalArmy() < armyTarget()) return;               /* 军队有缺口：人口留给正经募兵 */
  if (((c.army || {}).yibing || 0) > 1500) return;      /* 银行上限（存太多是纯浪费军资） */
  var jy = cellOf(c, 'junying');
  if (!jy) return;
  if ((st.queues.train || []).length >= 4) return;
  var room = Math.floor(pop - cap * 0.6);
  var n = Math.min(room, 120);
  if (n < 10) return;
  var Rr = G.res(c);
  if ((Rr.grain || 0) < 40000 || (Rr.wood || 0) < 12000 || (Rr.iron || 0) < 6000) return;
  setCity(c);
  var r = safeCall('bank.train', function () { return G.train('yibing', n, c.id, jy.idx); });
  if (r && r.ok) {
    BANK.joined += n;
    if (BANK.joined <= 600) noteSoft('bank.join', '存人：义兵 ×' + n + '（人口银行）');
  }
}
/* 放人：募兵缺人时解散义兵归农（"要特定兵种时解散兵种、改募别的"） */
function releaseBank(needPop, why) {
  /* v89.99：**全城扫描** —— 义兵可能在任意一座城（首测里只扫主城，漏掉分城的存货） */
  var c = null, bank = 0;
  st.cities.forEach(function (cc) {
    var b = ((cc.army || {}).yibing) || 0;
    if (b > bank) { bank = b; c = cc; }
  });
  if (!c || bank <= 0) return 0;
  var Rr = G.res(c);
  var gap = Math.max(0, Math.ceil(needPop - (Rr.pop || 0)));
  if (gap <= 0) return 0;
  var n = Math.min(bank, gap, 400);
  if (n < 10) return 0;
  var r = safeCall('bank.release', function () { return G.disbandAt(c.id, 'yibing', n); });
  if (r && r.ok) {
    BANK.released += n;
    RUN('🕊 人口银行放人：解散义兵 ×' + n + ' → 归农 +' + r.pop + '（' + why + '）');
    return r.pop;
  }
  return 0;
}

/* 民生：增民令（金换增速；**人口是当前瓶颈时才买** —— 条件驱动） */
function popBrain() {
  if (tNow - POPB_LAST < 1500) return;
  POPB_LAST = tNow;
  if (G.popBoostMult() > 1) return;      /* 已有增民令效果：同类只取最强，重复=白花钱 */
  var rich = richCity();
  var gold = G.res(rich).gold || 0;
  /* 3000 金的道具：绝对可负担即可 —— **不挂保留线**（增速是复利型收益；
     保留线是给"必办大事"留的，不是给复利道具设的门）。 */
  if (gold < 15000) return;
  var popTight = st.cities.length < 3 || totalArmy() < armyTarget();
  if (!popTight) return;
  var have = st.items['zengminling'] || 0;
  if (have <= 0) {
    setCity(rich);
    var b = safeCall('popb.buy', function () { return G.doShopping('zengminling', 1); });
    if (!b || !b.ok) return;
  }
  var u = safeCall('popb.use', function () { return G.systems.useItem('zengminling', null); });
  if (u && u.ok) {
    RUSH.popUses = (RUSH.popUses || 0) + 1;
    RUN('👶 增民令：人口增速 ×3（24 游戏时）· 累计 ' + RUSH.popUses + ' 张');
  }
}

/* ============================================================
 * v89.101 · 城流跨越（span）—— 老板「轻骑兵是事实，铁骑兵是不是？
 *   开拓四维，用寻找漏洞的方式寻求跨越式的、不可逆的发展」
 * ① spanCities：占平原 → 即时筑城（实测无上限 · 附近 1233 块可筑平原）
 * ② spanCav：轻骑批量成军（选粮最厚的城，一次募到该城上限）
 * ③ spanMil：军链抢建（军营→5 / 马厩→3 / 书院→6，骑兵门票）
 * ============================================================ */
var SPAN = { maxCity: 9, cityLast: -1e9, cavLast: -1e9, milLast: -1e9 };
function spanCities() {
  if (st.cities.length >= SPAN.maxCity) return;
  if (tNow - SPAN.cityLast < 420) return;
  SPAN.cityLast = tNow;
  var busy = (st.marches || []).some(function (m) { return m.target && m.target.kind === 'wild'; });
  if (busy) return;
  var g = ensurePlainForCity('spanCity');
  if (!g.have) return;
  /* v89.101b：逐城试付 —— 首跑单城卡资源不足 85 次（石/铁见底） */
  var r = null;
  for (var i2 = 0; i2 < st.cities.length && !(r && r.ok); i2++) {
    setCity(st.cities[i2]);
    try { if (!G.canAfford(G.BUILD_CITY_COST)) continue; } catch (e) { continue; }
    r = safeCall('span.build.' + st.cities[i2].name, function () { return G.buildCityAt(g.w.x, g.w.y); });
  }
  if (r && r.ok) RUN('🏯 城流：筑「' + r.city.name + '」（第 ' + st.cities.length + ' 城 · 建造并行 ' + (st.cities.length * 3) + ' 条）');
  if (r && !r.ok) noteSoft('span.build', r.msg);
}
function spanCav() {
  if (tNow - SPAN.cavLast < 300) return;
  SPAN.cavLast = tNow;
  var best = null, bg = -1, bCap = 0, anyUnlocked = false;
  st.cities.forEach(function (c) {
    var jy = cellOf(c, 'junying');
    if (!jy) return;
    setCity(c);
    var okc = false;
    try { okc = (G.canTrain('qingji') || {}).ok; } catch (e) {}
    if (!okc) return;
    anyUnlocked = true;
    var cap = 0;
    try { cap = G.maxTrainCount('qingji', c.id, jy.idx) || 0; } catch (e) {}
    if (!(cap > 0)) return;
    var g = (G.res(c).grain || 0);
    if (g > bg) { bg = g; best = c; bCap = cap; }
  });
  if (!best || !(bCap > 0)) {
    /* v89.101b：骑兵解锁但缺人 → 解散义兵放人（要特定兵种时解散改募） */
    if (anyUnlocked) safeCall('span.cav.rel', function () { return releaseBank(500, '轻骑待募·放人'); });
    return;
  }
  var jy2 = cellOf(best, 'junying');
  var n = Math.min(bCap, 4000);
  setCity(best);
  var r = safeCall('span.cav', function () { return G.train('qingji', n, best.id, jy2.idx); });
  if (r && r.ok) RUN('🐎 轻骑成军：' + best.name + ' 一次 ×' + n + '（该城上限 ' + bCap + '）');
  else if (r && !r.ok) noteSoft('span.cav', r.msg);
}
function spanMil() {
  if (tNow - SPAN.milLast < 600) return;
  SPAN.milLast = tNow;
  var c = st.cities[0];
  /* v89.101d：**官府总闸优先**（实测 junying 被"建筑等级 ≤ 官府等级"卡了 9 年）；
     升级取**最高等级的那一格**（buildingLevel = 各格最大等级） */
  [['guanfu', 8], ['junying', 7], ['majiu', 3], ['shuyuan', 6]].forEach(function (p) {
    var bid = p[0], want = p[1];
    if (G.buildingLevel(c, bid) >= want) return;
    if (G.buildCapOf && G.buildCapOf(c, bid) <= G.buildingLevel(c, bid)) return;   /* 受官府闸：等官府先升 */
    var idx = -1, bl = -1;
    (c.cells || []).forEach(function (cc, i) { if (cc.build && cc.build.id === bid && cc.build.lvl > bl) { bl = cc.build.lvl; idx = i; } });
    if (idx < 0) return;
    setCity(c);
    var r = safeCall('span.mil.' + bid, function () { return G.upgradeAt(c.id, idx); });
    if (r && r.ok && (G.res(c).gold || 0) >= 12000) {
      /* v89.101c：军链金提速 —— 队列字段实测为 **gridIndex**（不是 idx）；单次仅 ~900 金 */
      var qb = null;
      (st.queues.build || []).forEach(function (x) { if (!qb && x.cityId === c.id && x.gridIndex === idx) qb = x; });
      if (qb) {
        var pay = safeCall('span.mil.pay', function () { return G.queueRushPay(qb, '工程'); });
        if (pay && pay.ok) RUN('军链提速：' + bid + ' 花金完工');
        else if (pay && !pay.ok) noteSoft('span.mil.pay', pay.msg);
      }
    }
    if (r && r.ok) RUN('⚔️ 军链抢建：' + bid + ' Lv' + G.buildingLevel(c, bid) + ' → 目标 Lv' + want);
  });
}

/* ---------- 9. 主循环 ---------- */
var SNAP_EVERY = T_QUARTER;   /* v89.98：每 1/4 游戏年（1× 下 = 14,400 ticks） */
var BRAIN_LAST = -1e9;
var T0 = _RealNow();
RUN('主循环启动：每 tick = 1 现实秒 × ' + TS + ' 倍率；快照 1/4 游戏年；脑决策 40t(前10min)→120t（现实秒语义）');
if (MODE === 'econ') RUN('🧪 ECON 模式：军事全停（征兵/采集/占领/出征/围攻/城墙/装备/存兵全跳过）——只看资源积累 + 商场经验道具');
if (MODE === 'loot') RUN('🧪 LOOT 模式：rush 全行为 + 战利品寄售（按购买价 75% 变现；保留晋爵缺口珠宝）');
if (MODE === 'lootx') RUN('🧪 LOOTX 对照：寄售**空转**（只调用不卖）——分离寄售效果与路径分叉');

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
    GOLD.reserve = reserveNow();          /* v89.99：按"在办目标"刷新的金保留线 */
    safeCall('b.policies', applyPolicies);/* v89.99：阶段自适应（体力/税制/自动出征条件翻转） */
    if (MODE !== 'econ') safeCall('b.bank', bankPop);   /* v89.100：econ 不存兵（银行=征兵的一种） */
    safeCall('b.popb', popBrain);         /* v89.99：增民令（人口瓶颈时才买） */
    safeCall('b.quests', tryQuests);
    safeCall('b.build', tryBuildNew);
    safeCall('b.ext', tryBuildExt);
    /* v89.100：econ（纯经济）——军事调用全跳过（城墙/征兵/采集/占领/撤援），
       只留"建设 + 市场 + 商城"这条线；其余模式照旧。 */
    if (MODE !== 'econ') {
      safeCall('b.wall', tryWall);
      safeCall('b.train', tryTrain);
      safeCall('b.gather', tryGather);
      safeCall('b.gatherFin', finishRipeGathers);
      safeCall('b.occupy', keepOccupying);
      safeCall('b.withdraw', tryWithdraw);
      safeCall('b.reinforce', tryReinforce);
    }
    safeCall('b.market', tryMarketSell);
    if (MODE === 'loot' || MODE === 'lootx') safeCall('b.consign', consignBrain);   /* v89.100：战利品寄售变现 */
    safeCall('b.farm', tryFarm);
    safeCall('b.shop', tryShop);
    safeCall('b.sect', trySect);
    if (MODE !== 'econ') safeCall('b.autoMarch', manageAutoMarch);   /* v89.100：econ 无军事 */
    /* v89.92：宝物流优先级 = 最先（这是它的打法本体 —— 金先换产量） */
    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush' || MODE === 'span') {
      safeCall('b.buffCorvee', buffCorvee);
      safeCall('b.buffAttr', buffAttr);
      safeCall('b.buffProd', buffProd);
    }
    safeCall('b.goldSell', goldSell);
    safeCall('b.goldInn', goldInn);
    safeCall('b.goldBooks', goldBooks);
    if (MODE !== 'econ') {
      safeCall('b.goldRush', goldRush);
      safeCall('b.goldTrainRush', goldTrainRush);
    }
    safeCall('b.goldPoints', goldPoints);
    safeCall('b.goldGuards', goldGuards);
    safeCall('b.goldHerbs', goldHerbs);
    safeCall('b.goldNeigong', goldNeigong);
    safeCall('b.goldLord', goldLord);
    if (MODE === 'equip' || MODE === 'all' || MODE === 'rush') {
      safeCall('b.equipForgeUp', equipForgeUp);
      safeCall('b.equipCraft', equipCraft);
      safeCall('b.equipEnhance', equipEnhance);
      safeCall('b.equipWear', equipWear);
    }
    safeCall('b.milestones', execMilestones);
    if (MODE === 'span') {
      safeCall('b.spanCity', spanCities);
      safeCall('b.spanCav', spanCav);
      safeCall('b.spanMil', spanMil);
    }
    /* v89.98：RUSH 五链（围攻 / 爵位 / 节钺 / 通商券 / 丹药）
       v89.100：econ 跳过围攻与节钺（军事），保留晋爵/通商券/丹药（经济养成）。 */
    if (MODE !== 'econ') {
      safeCall('b.siege', siegeBrain);
      safeCall('b.jieyue', jieyueBrain);
    }
    safeCall('b.promote', promoteBrain);
    safeCall('b.coupon', couponBrain);
    safeCall('b.perm', permBrain);
  }
  if (tNow % SNAP_EVERY === 0) snapshot();
  if (tNow % T_HALF === 0) {
    flushEv();
    var perf = (_RealNow() - T0) / 1000;
    RUN('进度 ' + tNow + '/' + MAXT + ' · 第 ' + yNow().toFixed(1) + ' 游戏年 · 用时 ' + perf.toFixed(0) + 's'
      + ' · 城' + st.cities.length + ' · 军 ' + fmtNum(totalArmy()) + ' · 金 ' + fmtNum(st.res.gold)
      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
    RUN(goldLine() + stratLine());
  }
  if (tNow % T_YEAR === 0) {
    try { fs.writeFileSync(path.join(OUT, 'checkpoints', 'y' + Math.round(tNow * TS / 57600) + '.json'), G.savePayload()); } catch (e) { noteErr('ckpt', e); }
  }
}

/* ---------- 10. 收尾 ---------- */
flushEv(); flushRun();
function errCount() { return ERRN; }
var finalOut = {};
try { finalOut.year = +yNow().toFixed(2); finalOut.army = totalArmy(); finalOut.gold = Math.round(st.res.gold); } catch (e) {}
try { fs.writeFileSync(path.join(OUT, 'final_state.json'), G.savePayload()); } catch (e) { noteErr('final.save', e); }
try { fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(ERRLIST, null, 1)); } catch (e) { noteErr('errors', e); }
try {
  fs.writeFileSync(path.join(OUT, 'gold_final.json'), JSON.stringify({
    gold: { spends: GOLD.spends, rerolls: GOLD.rerolls, recruits: GOLD.recruits, books: GOLD.booksUsed,
      sold: GOLD.goldSold, sales: GOLD.salesCount, freePts: GOLD.freePts, milestones: GOLD.milestones },
    guards: st.cities.map(function (c) { var g = G.guardGeneralOf(c); return g ? { c: c.name, g: g.name, r: G.rankOf(g).name, lv: g.level, nz: guardNzOf(g) } : null; }),
    gens: (st.generals || []).map(function (g) {
      var a = G.genAttrs(g) || {};
      return { n: g.name, r: G.rankOf(g).name, lv: g.level || 1, nz: Math.round(a.nz || 0), yw: Math.round(a.yw || 0),
        zm: Math.round(a.zm || 0), st: g.status || '', free: Math.round(g.freePts || 0), hero: !!g.hero };
    })
  }, null, 1));
} catch (e) { noteErr('gold.final', e); }
try {
  fs.writeFileSync(path.join(OUT, 'strat_final.json'), JSON.stringify({
    mode: MODE,
    buff: (MODE === 'buff' || MODE === 'all' || MODE === 'rush') ? { spend: BUFF.spend, units: BUFF.units, tFirst: BUFF.tFirst } : null,
    equip: (MODE === 'equip' || MODE === 'all' || MODE === 'rush') ? { spend: EQUIP.spend, crafted: Object.keys(EQUIP.crafted),
      worn: EQUIP.wornCount, wornGen: EQUIP.wornGen, tCraft1: EQUIP.tCraft1, tCraft12: EQUIP.tCraft12,
      tEnh120: EQUIP.tEnh120, tWorn12: EQUIP.tWorn12,
      enh: ytIds().map(function (x) { var i4 = G.eqFind(x); return { id: x, e: i4 ? G.eqEnhOf(i4) : -1 }; }) } : null,
    guards: st.cities.map(function (c) {
      var gg = G.guardGeneralOf(c);
      return gg ? { c: c.name, g: gg.name, r: G.rankOf(gg).name, lv: gg.level, nz: guardNzOf(gg) } : null;
    })
  }, null, 1));
} catch (e) { noteErr('strat.final', e); }

var errTop = Object.keys(ERRS).map(function (k) { return { k: k, n: ERRS[k].n }; })
  .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
RUN(goldLine() + stratLine());
RUN('👥 将领前十：' + (st.generals || []).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); }).slice(0, 10).map(function (g) {
  var a = G.genAttrs(g) || {};
  return g.name + '[' + G.rankOf(g).name + ']Lv' + g.level + '(nz' + Math.round(a.nz || 0) + '/yw' + Math.round(a.yw || 0) + ')';
}).join(' · '));
try {
  fs.writeFileSync(path.join(OUT, 'rush_final.json'), JSON.stringify({
    mode: MODE, TS: TS, ticks: MAXT, years: +(MAXT * TS / 57600).toFixed(2),
    rush: { sta: RUSH.staUsed, sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail, tSiege1: RUSH.tSiege1,
      jieyue: (G.jieyueOf ? G.jieyueOf() : 0), jieyueUsed: RUSH.jieyueUsed,
      promote: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN, rank: st.rank || 0,
      era: ERA.id, eras: ERA.log, popUses: (RUSH.popUses || 0), tax: (st.tax != null ? st.tax : null),
      bank: { join: BANK.joined, release: BANK.released, peak: BANK.peak },
      consign: (MODE === 'loot') ? { gold: Math.round(CSG.gold), kinds: CSG.kinds,
        pieces: CSG.pieces, runs: CSG.runs, tFirst: CSG.tFirst } : null },
    gold: { sold: Math.round(GOLD.goldSold), sales: GOLD.salesCount, spends: GOLD.spends,
      recruits: GOLD.recruits, rerolls: GOLD.rerolls, books: GOLD.booksUsed },
    cities: st.cities.map(function (c) { var Rr = G.res(c); return { name: c.name,
      grain: Math.round(Rr.grain || 0), gold: Math.round(Rr.gold || 0), pop: Math.round(Rr.pop || 0),
      army: armyAll(c.army), slots: G.buildSlots(c) }; }),
    rep: Math.round(st.rep || 0), rank: st.rank || 0
  }, null, 1));
} catch (e) { noteErr('rush.final', e); }
RUN('=== 推演结束 ===');
RUN('终态：第 ' + yNow().toFixed(1) + ' 游戏年 · 城 ' + st.cities.length + ' · 军 ' + fmtNum(totalArmy())
  + ' · 金 ' + fmtNum(st.res.gold) + ' · 将 ' + st.generals.length + ' · 战报 ' + (st.reports || []).length + ' 份'
  + ' · 阶段 ' + ERA.id + '（' + ERA.n + ' 次切换）· 银行 存' + BANK.joined + '/放' + BANK.released);
RUN('错误合计 ' + ERRN + ' 次；Top: ' + errTop.map(function (x) { return x.k.slice(0, 60) + '×' + x.n; }).join(' || '));
RUN('输出目录：' + OUT);
flushRun();
console.log('DONE ' + TAG + ' ticks=' + MAXT + ' errs=' + ERRN);
process.exit(0);   /* v89.91：跑完即退（游戏定时器会挂住事件循环） */
