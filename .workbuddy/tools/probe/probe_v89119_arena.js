'use strict';
/* ============================================================
 * probe_v89119_arena.js — 为实机截图选靶子（v89.119）
 * ------------------------------------------------------------
 * 目的：找一场"打得久 + 有反击 + 我方胜"的战斗，供截图脚本用。
 *   · 扫描同 seed 的野地等级分布（≥4 级才有远程与规模）；
 *   · 对候选逐个试不同兵力配比，量 rounds / winner / counter 次数；
 *   · 打印可直接抄进 shot_v89119.js 的坐标与兵力。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, U = G.utils;

var SEED = 20260925;
var st = G.newGame({ name: '北', cityName: '许都', mapSeed: SEED });
G.state = st;
G.map.generate();
var c = G.currentCity() || st.cities[0];
console.log('城：' + c.name + ' @ ' + c.x + ',' + c.y);

/* 扫野地等级分布 */
var byLv = {}, CMAX = G.COORD_MAX || 499;
var spots = [];
for (var dx = -30; dx <= 30; dx++) {
  for (var dy = -30; dy <= 30; dy++) {
    var xx = c.x + dx, yy = c.y + dy;
    if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
    var tl = G.map.tile(xx, yy);
    if (!tl || tl.terrain === 'city') continue;
    var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
    byLv[lv] = (byLv[lv] || 0) + 1;
    if (lv >= 4) spots.push({ x: xx, y: yy, lv: lv });
  }
}
console.log('等级分布：' + Object.keys(byLv).sort(function (a, b) { return a - b; })
  .map(function (k) { return 'L' + k + ':' + byLv[k]; }).join(' '));
console.log('≥L4 野地 ' + spots.length + ' 格');

/* 取 lv 最高的几格，量守军 + 试配比 */
spots.sort(function (a, b) { return b.lv - a.lv; });
var cand = spots.slice(0, 6);
cand.forEach(function (s) {
  var d = G.wildDefenseAt(s.x, s.y, s.lv);
  var parts = Object.keys(d.army).map(function (k) { return (G.DATA.TROOPS[k] || {}).name + '×' + d.army[k]; });
  console.log('\n【候选 L' + s.lv + ' @' + s.x + ',' + s.y + '】守军 ' + U.fmt(d.total) + '　' + parts.join('、')
    + (d.gen ? '　守将 ' + d.gen.name : ''));
  /* 试三种配比（都按守军总人数折算） */
  var T = d.total;
  var tries = [
    ['纯长枪 ×' + Math.round(T * 0.55), { changqiang: Math.round(T * 0.55) }],
    ['义兵+长枪（×0.75）', { yibing: Math.round(T * 0.45), changqiang: Math.round(T * 0.30) }],
    ['枪盾混编（×0.7）', { changqiang: Math.round(T * 0.28), daodun: Math.round(T * 0.22), yibing: Math.round(T * 0.20) }],
  ];
  tries.forEach(function (t) {
    var r = G.tactic.simulate(t[1], null, JSON.parse(JSON.stringify(d.army)), 0, d.gen || null, { kind: 'wild' });
    var ctr = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'counter') ctr++; });
    });
    console.log('   ' + t[0] + ' → ' + (r.winner === 'atk' ? '胜' : '败')
      + '　回合 ' + r.rounds + '　反击 ' + ctr + ' 次　我损 ' + U.fmt(r.atkLoss) + ' / 敌损 ' + U.fmt(r.defLoss));
  });
});

/* 也看一下据点与 NPC 城（备选靶子） */
console.log('\n【备选】据点 / NPC 城');
(st.map && st.map.forts || []).slice(0, 4).forEach(function (f) {
  console.log('  据点 @' + f.x + ',' + f.y + ' Lv' + (f.lv || '?'));
});
(st.map && st.map.cities || []).slice(0, 4).forEach(function (n) {
  console.log('  NPC 城 ' + n.name + ' @' + n.x + ',' + n.y + ' type=' + n.type);
});
process.exit(0);
