/* ============================================================
 * probe_v89101_explore.js — 四维漏洞雷达（兵 / 将 / 位 / 世）
 * ------------------------------------------------------------------
 * 老板：「轻骑兵是事实，铁骑兵是不是？开拓四维，用寻找漏洞的方式
 *   寻求跨越式的、不可逆的发展。事实太多了，你太局限，无限探索」
 *
 * 本探针不再验证单一假设，而是把四个维度一次扫穿：
 *   A 兵维：全兵种矩阵（解锁链 / 批量上限 / 金提速 / 同成本对撞）
 *   B 将维：不可逆资产（丹药 / 内功 / 资质链）——买穿清单与实测
 *   C 位维：爵位链（城数门控）与节钺来源
 *   D 世维：城流（平原普查 / 占平原→即时筑城 / 据点与名城守军当量）
 * 富国沙盘：资源 5000 万 / 人口 6 万（"有粮有钱"的形态）
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];
function ap(s) { OUT.push(s); }

var simMs = Date.UTC(2026, 8, 22, 9, 0, 0);
Date.now = function () { return simMs; };
Math.random = function () { return 0.42; };
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
fs.readdirSync(R + 'story').filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(R + 'story/' + f); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils, T = G.tactic;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0];
st.settings.battleWatch = false;

function setCity(c) { try { if (G.setCity) G.setCity(c.id); } catch (e) {} G.ui._cityId = c.id; }
setCity(c0);

/* 富国沙盘 */
var RICH = 50000000;
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c0.res[k] = RICH; });
c0.res.pop = 60000;

function mkGen(name, rankId, level) {
  var g = G.makeGeneral(name, level || 1, 'idle', c0.id, false, rankId);
  for (var i = 1; i < (level || 1); i++) G.applyLevelGrowth(g);
  if (g.freePts) { g.yw += g.freePts; g.freePts = 0; }
  g.stamina = 900;
  st.generals.push(g);
  return g;
}
var gMid = mkGen('中游将', 'ying', 60);
var hero = mkGen('远征将', 'ying', 200);
st.generals.pop(); st.generals.pop();   /* 从城市列表里去掉（探针只用手动调度） */

function tp(tid) { try { return G.story.troopPower(DATA.TROOPS[tid]); } catch (e) { return null; } }
function powOf(dict) {
  var s = 0;
  for (var k in dict) { var p = tp(k); if (p) s += dict[k] * p; }
  return Math.round(s);
}
function fmtM(v) { v = Number(v) || 0; if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'; return '' + Math.round(v); }
function yrs(sec) { return +(sec / 57600).toFixed(2); }
function sim(atk, def, defVal, opts) { return T.simulate(atk, gMid, def, defVal || 0, null, opts || { kind: 'wild' }); }
function line(tag, r, extra) {
  return '  ' + tag + ' → ' + r.rounds + '回合 w=' + r.winner + ' · 我损 ' + r.atkLoss + ' / 敌损 ' + r.defLoss
    + (extra ? ' · ' + extra : '');
}
function resolveAll() {
  (st.battles || []).forEach(function (rec) { if (rec.state === 'live') { try { G.battle.autoBattle(rec.id); } catch (e) {} } });
}

ap('===== 0. 环境 =====');
ap('  troopPower = ' + (typeof (G.story && G.story.troopPower)) + '｜city=' + c0.name
  + '｜res=' + fmtM(c0.res.grain) + '｜pop=' + c0.res.pop + '｜gold=' + fmtM(c0.res.gold));

/* ============================================================
 * A. 兵维（全兵种矩阵）
 * ============================================================ */
ap('');
ap('===== A. 兵维 · 全兵种矩阵（富国沙盘） =====');
var ids = Object.keys(DATA.TROOPS);
ap('  兵种共 ' + ids.length + ' 个：' + ids.join(' '));
ap('  [解锁链] [单兵成本/pop/时] [富国上限] [1000 件套自然时长/金提速]');
ids.forEach(function (tid) {
  var t = DATA.TROOPS[tid];
  var lo = G.trainLimitOf(tid);
  var costU = 0; for (var k in (t.cost || {})) costU += t.cost[k];
  var unlockTxt = '';
  for (var b in (t.unlock || {})) unlockTxt += b + '≥' + t.unlock[b] + ' ';
  var batch = Math.min(lo.cap || 0, 1000);
  var rushGold = Math.ceil(1000 * costU * 0.2);
  ap('   · ' + (t.icon || '') + t.name + '(' + tid + ')｜{' + unlockTxt.trim() + '}'
    + '｜pop' + t.pop + ' 资' + fmtM(costU) + ' 时' + t.time + 's'
    + '｜上限 ' + fmtM(lo.cap) + '（popB ' + fmtM(lo.popBound) + ' / resB ' + fmtM(lo.resBound) + '）'
    + '｜1000 件: ' + yrs(1000 * t.time) + ' 年 / 金 ' + fmtM(rushGold));
});
ap('');
ap('  —— 50 万金「立即成军」批量（0.2×资源价值） ——');
ids.forEach(function (tid) {
  var t = DATA.TROOPS[tid];
  var costU = 0; for (var k in (t.cost || {})) costU += t.cost[k];
  var per = Math.ceil(costU * 0.2);
  var n = Math.min(Math.floor(500000 / per), G.trainLimitOf(tid).cap || 0);
  ap('   ' + t.name + ' ×' + fmtM(n) + '（自然训练 ' + yrs(n * t.time) + ' 年 → 金提速 = 0 年）');
});

ap('');
ap('===== A2. 轻骑兵 vs 铁骑兵（同成本 615 万资源对照） =====');
(function () {
  var budget = 6150000;
  var nQ = Math.floor(budget / 4100), nT = Math.floor(budget / 9000);
  ap('  同预算：轻骑 ' + nQ + '（pop ' + (nQ * 2) + '）｜铁骑 ' + nT + '（pop ' + (nT * 3) + '）');
  var fg4 = G.map.fortGarrison(4);
  ap('  据点 Lv4 守军：' + JSON.stringify(fg4) + ' → 战力 ' + fmtM(powOf(fg4)));
  [['轻骑 ' + nQ + ' vs 据点Lv4', { qingji: nQ }],
   ['铁骑 ' + nT + ' vs 据点Lv4', { tieji: nT }],
   ['枪 ' + Math.floor(budget / 1050) + ' vs 据点Lv4', { changqiang: Math.floor(budget / 1050) }],
   ['弓 ' + Math.floor(budget / 1550) + ' vs 据点Lv4', { gongjian: Math.floor(budget / 1550) }]].forEach(function (p) {
    var r = sim(p[1], fg4, 0, { kind: 'fort', sieging: true, fortLv: 4 });
    ap(line(p[0], r));
  });
  var rMirror = sim({ qingji: nQ }, { tieji: nT });
  ap(line('对撞 · 轻骑 ' + nQ + ' vs 铁骑 ' + nT, rMirror));
  var rAlt = sim({ qingji: Math.floor(budget / 4100) }, { gongjian: Math.floor(budget / 1550) });
  ap(line('对撞 · 轻骑 vs 同成本弓', rAlt));
})();

/* ============================================================
 * B. 将维（不可逆资产）
 * ============================================================ */
ap('');
ap('===== B. 将维 · 不可逆资产（买穿清单 + 实测） =====');
ap('  B1 丹药（永久 +1/颗，每将每维上限 50）：');
(DATA.ITEMS || []).filter(function (x) { return x.type === 'perm'; }).forEach(function (p) {
  ap('   · ' + p.name + '（' + p.attr + '）' + fmtM(p.price * 100) + ' 金/颗 → 单维买满（+50）'
    + fmtM(p.price * 100 * 50) + ' 金');
});
(function () {
  var gP = mkGen('丹药试验', 'liang', 10);
  var t0 = Math.round(G.genAttrs(gP).tong || 0);
  st.items['fengwang_migao'] = 60;
  var ok = 0, lastMsg = '';
  for (var i = 0; i < 55; i++) { var rU = G.systems.useItem('fengwang_migao', gP.id); if (rU && rU.ok) ok++; else lastMsg = (rU && rU.msg) || ''; }
  var t1 = Math.round(G.genAttrs(gP).tong || 0);
  ap('   实测：投 55 颗 → 成功 ' + ok + ' 次 · 统率 ' + t0 + '→' + t1 + '（净 +' + (t1 - t0) + '）· 末次拒绝：' + lastMsg);
})();
ap('');
ap('  B2 内功（每将一门；绝学 +6/重 ×10 重）：');
(DATA.ITEMS || []).filter(function (x) { return x.type === 'neigong'; }).forEach(function (n) {
  ap('   · ' + n.name + ' ' + fmtM(n.price * 100) + ' 金｜' + n.desc);
});
try { ap('   NEIGONG 表：' + JSON.stringify(DATA.NEIGONG).slice(0, 500)); } catch (e) {}
(function () {
  var gN = mkGen('内功试验', 'liang', 10);
  var z0 = Math.round(G.genAttrs(gN).zm || 0);
  st.items['book_wuzi'] = 12;
  var ok = 0, lastMsg = '';
  for (var i = 0; i < 11; i++) { var rN = G.systems.useItem('book_wuzi', gN.id); if (rN && rN.ok) ok++; else lastMsg = (rN && rN.msg) || ''; }
  var z1 = Math.round(G.genAttrs(gN).zm || 0);
  ap('   实测：投 11 本《吴子》→ 成功 ' + ok + ' 次 · 智谋 ' + z0 + '→' + z1 + '（净 +' + (z1 - z0) + '）· 末次拒绝：' + lastMsg);
})();
ap('');
ap('  B3 资质链（凡→良→英→名→天）：');
(DATA.ITEMS || []).filter(function (x) { return x.type === 'seed' || /yunlingcao|xisuizhi|hualongshen|tianshouguo/.test(x.id); }).forEach(function (x) {
  ap('   · ' + x.name + ' ' + fmtM(x.price * 100) + ' 金｜' + (x.desc || '').slice(0, 60));
});
ap('');
ap('  B4 爵位链（每档：城池 N + 声望 + 金 + 珠宝；每 4 档 +1 节钺）：');
DATA.RANK.slice(0, 8).forEach(function (rk, idx) {
  var jewelTxt = '';
  for (var j in (rk.jewel || {})) {
    var it = (DATA.ITEMS || []).filter(function (x) { return x.id === j; })[0];
    jewelTxt += (it ? it.name : j) + '×' + rk.jewel[j] + ' ';
  }
  ap('   ' + (idx === 0 ? ' ' : idx) + '→ ' + rk.name + '：城 ' + rk.city + ' · 声望 ' + fmtM(rk.rep)
    + ' · 金 ' + fmtM(rk.gold) + ' · 珠宝 ' + (jewelTxt || '无'));
});
ap('  节钺：黄金买不到 —— 首占名城 县+1/郡+2/州+3/都+5（jieyueClaim）；爵位每 4 档 +1。');

/* ============================================================
 * C. 世维（城流 / 据点 / 名城）
 * ============================================================ */
ap('');
ap('===== C. 世维 · 城流与守军当量 =====');
var plains = [], forts = [];
for (var dy = -30; dy <= 30; dy++) {
  for (var dx = -30; dx <= 30; dx++) {
    var x = c0.x + dx, y = c0.y + dy;
    var w = G.map.wildAt(x, y);
    if (w && w.type === 'plain') {
      var owned = (st.wilds || []).some(function (ww) { return ww.x === x && ww.y === y; });
      if (!owned) plains.push({ x: x, y: y, lv: w.level || w.lv || 1, d: Math.abs(dx) + Math.abs(dy) });
    }
    var f = G.map.fortAt(x, y);
    if (f && f.level <= 5) forts.push({ x: x, y: y, name: f.name, level: f.level, d: Math.abs(dx) + Math.abs(dy) });
  }
}
plains.sort(function (a, b) { return a.d - b.d; });
forts.sort(function (a, b) { return a.d - b.d; });
ap('  附近 61×61 格：未占平原 ' + plains.length + ' 块（城流的第一约束）；据点(Lv≤5) ' + forts.length + ' 座');
ap('  最近平原 5 块：' + plains.slice(0, 5).map(function (p) { return '(' + p.x + ',' + p.y + ')Lv' + p.lv; }).join(' '));
ap('  最近据点 5 座：' + forts.slice(0, 5).map(function (f) { return f.name + 'Lv' + f.level; }).join(' '));

function occupyPlain(p) {
  setCity(c0);
  c0.army = { yibing: 4000, changqiang: 3000 };
  hero.stamina = 900; hero.status = 'idle';
  var d = G.march.dispatch({ kind: 'wild', x: p.x, y: p.y }, 'occupy', { yibing: 4000 }, hero.id);
  if (!d || !d.ok) return { ok: false, msg: (d && d.msg) || '' };
  var mm = null;
  (st.marches || []).forEach(function (m) { if (!mm && m.target && m.target.x === p.x && m.target.y === p.y) mm = m; });
  if (mm) { mm.elapsed = mm.totalTime; try { G.march.tick(); } catch (e) {} }
  resolveAll();
  var w2 = G.map.wildAt(p.x, p.y);
  var own = (st.wilds || []).some(function (ww) { return ww.x === p.x && ww.y === p.y; });
  return { ok: own, msg: 'owned=' + own + ' type=' + ((w2 && w2.type) || '?') };
}

ap('');
ap('  —— C1 占平原 → 即时筑城（连做 3 座，验证"上限/耗时/成本"） ——');
for (var ci = 0; ci < Math.min(3, plains.length); ci++) {
  var pp = plains[ci];
  var occ = occupyPlain(pp);
  setCity(c0);
  var rb = null;
  try { rb = G.buildCityAt(pp.x, pp.y); } catch (e) { rb = { ok: false, msg: e.message }; }
  ap('   [' + ci + '] 占 (' + pp.x + ',' + pp.y + ') → ' + occ.msg + ' → 筑城 ' + JSON.stringify({ ok: rb.ok, msg: rb.msg }));
  if (rb && rb.ok && rb.city) {
    var nc = rb.city;
    ap('       新城市「' + nc.name + '」等级 ' + nc.level + ' · cells ' + (nc.cells || []).length
      + ' · extGrid ' + ((nc.extGrid || []).length) + ' · 建造位 ' + G.buildSlots(nc)
      + ' · 民房上限 ' + G.maxPopOf(nc));
  }
}
var slotSum = 0; st.cities.forEach(function (cc) { slotSum += G.buildSlots(cc); });
ap('   城数 = ' + st.cities.length + '（初始 1）· 建造并行度合计 = ' + slotSum + ' 条队列');
ap('   逐城：' + st.cities.map(function (cc) { return cc.name + '×' + G.buildSlots(cc) + '位'; }).join(' | '));

ap('');
ap('  —— C2 守军当量：据点 Lv1~7 与名城 ——');
for (var lv = 1; lv <= 7; lv++) {
  var g = G.map.fortGarrison(lv);
  ap('   据点Lv' + lv + '：' + JSON.stringify(g) + ' → 战力 ' + fmtM(powOf(g)));
}
var ncities = (st.map.cities || []).filter(function (c) { return c.owner === 'npc'; });
ap('   名城共 ' + ncities.length + ' 座（县/郡/州/都）');
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  var c = ncities.filter(function (x) { return x.type === ty; })[0];
  if (!c) { ap('   ' + ty + '：未找到'); return; }
  var g2 = G.genGarrison(c);
  ap('   ' + c.name + '（' + ty + ' Lv' + G.cityLvOf(c) + '）：' + JSON.stringify(g2)
    + ' → 战力 ' + fmtM(powOf(g2)) + ' · def=' + c.def);
});

ap('');
ap('  —— C3 县城围攻可行性（磨城波数 + 决战需求） ——');
(function () {
  var cty = ncities.filter(function (x) { return x.type === 'county'; })[0];
  if (!cty) { ap('   未找到县城'); return; }
  var gC = G.genGarrison(cty);
  var defPow = powOf(gC);
  var myPow = 1500 * tp('qingji');
  var ratio = defPow > 0 ? myPow / defPow : 0;
  var chip = null; try { chip = G.siegeChipOf(ratio, 'encircle'); } catch (e) {}
  ap('   以 1500 轻骑（' + fmtM(myPow) + '）压县城（' + fmtM(defPow) + '）：比 ' + ratio.toFixed(4)
    + ' → 单波破防 ' + chip + '%（围困×1.5）→ 磨到 0 需 ' + (chip ? Math.ceil(100 / chip) : '?') + ' 波');
  ap('   磨到 0 后的决战对手：守军×35%（残兵）×0.88（围困）≈ ' + fmtM(defPow * 0.35 * 0.88) + ' 战力');
  var rc = null;
  try { rc = G.battle.expedition({ kind: 'city', id: cty.id, x: cty.x, y: cty.y }, 'occupy', { qingji: 3000 }, hero.id); } catch (e) { ap('   实攻 err ' + e.message); }
  if (rc) ap('   实攻样本（3000 轻骑）：ok=' + rc.ok + ' msg=' + String(rc.msg).slice(0, 90)
    + ' result=' + (rc.result ? JSON.stringify({ w: rc.result.winner, sg: rc.result.siege }) : 'null'));
})();

ap('');
ap('  —— C4 据点横扫样本（真实兵力 · 掠夺奖励） ——');
(function () {
  var f0 = forts[0];
  if (!f0) { ap('   无据点样本'); return; }
  setCity(c0);
  c0.army = { qingji: 3000 };
  hero.stamina = 900; hero.status = 'idle';
  var rep0 = st.rep || 0;
  var items0 = {}; Object.keys(st.items || {}).forEach(function (k) { items0[k] = st.items[k]; });
  var rF = null;
  try { rF = G.battle.expedition({ kind: 'fort', x: f0.x, y: f0.y }, 'raid', { qingji: 3000 }, hero.id); } catch (e) { ap('   err ' + e.message); }
  if (rF) {
    ap('   攻 ' + f0.name + 'Lv' + f0.level + '：ok=' + rF.ok + ' ' + (rF.result ? JSON.stringify({ w: rF.result.winner, rounds: rF.result.rounds, atkLoss: rF.result.atkLoss, defLoss: rF.result.defLoss }) : rF.msg));
  }
  ap('   声望 ' + rep0 + ' → ' + (st.rep || 0) + '（+' + ((st.rep || 0) - rep0) + '）');
  var gained = [];
  Object.keys(st.items || {}).forEach(function (k) { var d = (st.items[k] || 0) - (items0[k] || 0); if (d > 0) gained.push(k + '+' + d); });
  ap('   战利品：' + (gained.length ? gained.join(' ') : '无'));
  c0.army = { qingji: 3000 };
})();

/* ============================================================
 * 汇总
 * ============================================================ */
ap('');
ap('===== 汇总（数字见上；以下是目录） =====');
ap('  A 兵维：全 ' + ids.length + ' 兵种矩阵 + 50万金成军表 + 同成本对撞（含铁骑）');
ap('  B 将维：丹药/内功/资质/爵位 —— 买穿清单与实测（上限行为）');
ap('  C 世维：平原普查 + 即时筑城 ' + (st.cities.length - 1) + ' 座 + 守军当量 + 磨城数学 + 据点样本');
fs.writeFileSync(R + '.workbuddy/tmp/probe_v89101_explore.txt', OUT.join('\n'), 'utf8');
console.log('EXPLORE PROBE DONE · lines=' + OUT.length);
