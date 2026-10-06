'use strict';
/* v89.142 探针 A（逻辑层）：斗将触发链 / 收编现状 / 兵力上限口径 / 目标候选矩阵 / 城外地块
   跑法：node .workbuddy/tools/probe/probe_v89142a_base.js > .workbuddy/tmp/p142a.txt 2>&1 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260942 });
if (!st.map.grid) G.map.generate();
var c = st.cities[0];

console.log('=== ① 斗将：概率打表（invasionRoll 分布）===');
var hit = 0, N = 2000;
for (var i = 0; i < N; i++) {
  var r = G.invasionRoll('duel|g1|g2|' + i + ',0@' + (1234567 + i));
  if (r < (DATA.DUEL.chance || 0.5)) hit++;
}
console.log('chance=' + DATA.DUEL.chance + ' · 2000 个种子命中 ' + hit + ' (' + (hit / N * 100).toFixed(1) + '%)');

console.log('\n=== ② 斗将：rollDuel 直接调用 ===');
var gA = st.generals[0], gB = st.generals[st.generals.length - 1];
var d1 = G.battle.rollDuel(gA, gB, 'seedA');
console.log('rollDuel(A,B,"seedA") = ' + JSON.stringify(d1 && { done: d1.done, winner: d1.winner, wa: d1.wa, wb: d1.wb }));
var d2 = G.battle.rollDuel(gA, gB, 'seedB');
console.log('rollDuel(A,B,"seedB") = ' + JSON.stringify(d2 && { done: d2.done, winner: d2.winner, wa: d2.wa, wb: d2.wb }));
console.log('gA=' + gA.name + ' yw=' + gA.yw + ' · gB=' + gB.name + ' yw=' + gB.yw);

console.log('\n=== ③ 斗将：全链路实测（我方出征有名城/据点的守将目标）===');
/* 造一个据点（带守将）作为目标 —— fortAt / makeFort 出口 */
var FX = c.x + 3, FY = c.y + 3;
if (!G.map.fortAt(FX, FY)) {
  if (G.map.makeFort) G.map.makeFort(FX, FY);
}
var fort = G.map.fortAt ? G.map.fortAt(FX, FY) : null;
console.log('据点：' + (fort ? ('Lv' + fort.level + ' guard=' + (fort.guard ? fort.guard.name : '无')) : '无'));
/* 配兵（用本城军队） */
var city = c;
city.army = city.army || {};
city.army.changqiang = (city.army.changqiang || 0) + 20000;
if (fort) {
  var res = G.battle.expedition({ kind: 'fort', x: FX, y: FY }, 'occupy', { changqiang: 8000 }, gA.id, { auto: true });
  console.log('征服结果 ok=' + res.ok + (res.msg ? ' msg=' + res.msg : ''));
  if (res.result) {
    console.log('result.duel = ' + JSON.stringify(res.result.duel));
    console.log('result.events 里有 duel 事件吗：' +
      JSON.stringify(!!((res.result.events || []).some(function (e) { return e && e.kind === 'duel'; }))));
  }
  /* 战报里有没有【斗将】 */
  var rep = (G.state.reports || [])[0];
  if (rep) console.log('战报正文含【斗将】：' + (rep.body || '').indexOf('【斗将】') >= 0);
}
console.log('日志近 2 条：');
(G.state.log || []).slice(-2).forEach(function (l) { console.log('  ' + (l.text || l.msg || JSON.stringify(l))); });

console.log('\n=== ④ 收编现状（captiveGain / doConscriptCaptives）===');
G.state.captives = { changqiang: 500, gongjian: 300 };
console.log('俘虏：' + JSON.stringify(G.state.captives) + ' · 总人口=' + G.captivePopOf(G.state.captives));
var rcon = G.doConscriptCaptives(c.id);
console.log('收编结果：' + JSON.stringify(rcon));
console.log('收编后 army=' + JSON.stringify(c.army) + ' 人口=' + G.res(c).pop);
console.log('DATA.CAPTIVE = ' + JSON.stringify(DATA.CAPTIVE));

console.log('\n=== ⑤ 兵力上限口径 ===');
console.log('marchCapOf(city) = ' + G.battle.marchCapOf(city) + '（校场 Lv' + (G.buildingLevel(city, 'xiaochang') || 0) + '）');
console.log('wildGarrisonCap(8) = ' + G.wildGarrisonCap(8) + '（perLevel=' + DATA.WILD_GARRISON.perLevel + '）');
console.log('本城 army 拥有：' + JSON.stringify(city.army));

console.log('\n=== ⑥ 目标候选矩阵（现状：expTargetCandidates + actTargetsOf）===');
var cand = G.ui.expTargetCandidates(city, null) || [];
var byKind = {};
cand.forEach(function (tg) { byKind[tg.kind] = (byKind[tg.kind] || 0) + 1; });
console.log('expTargetCandidates 共 ' + cand.length + ' 个：' + JSON.stringify(byKind));
console.log('样例：' + cand.slice(0, 6).map(function (tg) { return G.ui.expTargetLabel(tg); }).join(' | '));
var all = G.ui.actTargetsOf(city) || [];
console.log('actTargetsOf 共 ' + all.length + '：' + all.slice(0, 5).map(function (o) { return o.label; }).join(' | '));
/* 地图上的名城 / 中立野地 / 据点 数量与距离分布 */
var npcN = 0, npcList = [];
(G.state.map.cities || []).forEach(function (nc) {
  npcN++;
  npcList.push({ n: nc.name, t: nc.type, d: Math.max(Math.abs(nc.x - city.x), Math.abs(nc.y - city.y)) });
});
npcList.sort(function (a, b) { return a.d - b.d; });
console.log('NPC 城 ' + npcN + ' 座，最近 8 座：' + npcList.slice(0, 8).map(function (x) { return x.n + '(' + x.t + ',d' + x.d + ')'; }).join(' '));
var fortN = 0, fortNear = 0;
(G.map.forts || []).forEach(function (f) { fortN++; if (Math.max(Math.abs(f.x - city.x), Math.abs(f.y - city.y)) <= 14) fortNear++; });
console.log('全图据点 ' + fortN + ' · 本城 14 格内 ' + fortNear);
/* 中立野地：范围内多少 */
var wildNear = 0;
for (var dy = -14; dy <= 14; dy++) for (var dx = -14; dx <= 14; dx++) {
  var x = city.x + dx, y = city.y + dy;
  if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
  if (G.map.wildAt(x, y)) continue;
  var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 0;
  if (lv > 0) wildNear++;
}
console.log('本城 14 格内中立野地（有野怪等级） ' + wildNear + ' 处');
console.log('当前我方野地 ' + (st.wilds || []).length + ' 处');

console.log('\n=== ⑦ 城外地块 ===');
console.log('EXT_CAP_MAX = ' + DATA.EXT_CAP_MAX);
console.log('EXT_CAP_BY_LV = ' + JSON.stringify(DATA.EXT_CAP_BY_LV));
console.log('EXT_PLAN_BY_LV 末 3 档 = ' + JSON.stringify(DATA.EXT_PLAN_BY_LV.slice(-3)));
console.log('extCap(Lv1 城) = ' + G.extCap(city) + ' · 当前 grid 长度 = ' + G.ensureExtGrid(city).length);
/* 满级形态：造一个 Lv27 官府（直接改等级） */
var _bkGrid = city.extGrid, _bkCells = city.cells.slice();
city.cells = city.cells.map(function (x) { return U.deep(x); });
var guanfuCell = city.cells.filter(function (x) { return x && x.b === 'guanfu'; })[0];
if (guanfuCell) guanfuCell.lv = 27;
console.log('官府 Lv27 → extCap = ' + G.extCap(city) + '（满级 grid 长度 ' + G.ensureExtGrid(city).length + '）');
city.cells = _bkCells;

console.log('\n=== ⑧ 野外据点守将（v89.129 的 guard） ===');
if (fort) console.log('fort.guard = ' + JSON.stringify(fort.guard && { name: fort.guard.name, lv: fort.guard.level, rank: fort.guard.rank }));
console.log('WILD_GEN_CHANCE = ' + JSON.stringify(DATA.WILD_GEN_CHANCE));

process.exit(0);
