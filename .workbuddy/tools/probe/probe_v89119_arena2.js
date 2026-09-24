'use strict';
/* probe_v89119_arena2.js — 选靶子（第二版：L5~L7 档 + 多倍兵力） */
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

/* 找 lv 在 5~7 的、**离城最近**的若干格 */
var cand = [], CMAX = G.COORD_MAX || 499;
for (var dx = -14; dx <= 14; dx++) {
  for (var dy = -14; dy <= 14; dy++) {
    var xx = c.x + dx, yy = c.y + dy;
    if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
    var tl = G.map.tile(xx, yy);
    if (!tl || tl.terrain === 'city') continue;
    var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
    if (lv >= 5 && lv <= 7) cand.push({ x: xx, y: yy, lv: lv, d: Math.abs(dx) + Math.abs(dy) });
  }
}
cand.sort(function (a, b) { return a.d - b.d; });
console.log('城 ' + c.name + ' @' + c.x + ',' + c.y + '　L5~L7 候选 ' + cand.length + ' 格');

var picked = [];
cand.slice(0, 8).forEach(function (s) {
  var d = G.wildDefenseAt(s.x, s.y, s.lv);
  var T = d.total;
  var parts = Object.keys(d.army).map(function (k) { return (G.DATA.TROOPS[k] || {}).name + '×' + d.army[k]; });
  console.log('\n【L' + s.lv + ' @' + s.x + ',' + s.y + '（距 ' + s.d + '）】守军 ' + U.fmt(T)
    + '　' + parts.join('、') + (d.gen ? '　守将 ' + d.gen.name : ''));
  [1.2, 1.5, 2.0].forEach(function (mul) {
    var n = Math.round(T * mul);
    var army = { changqiang: Math.round(n * 0.55), daodun: Math.round(n * 0.25), yibing: Math.round(n * 0.20) };
    var r = G.tactic.simulate(army, null, JSON.parse(JSON.stringify(d.army)), 0, d.gen || null, { kind: 'wild' });
    var ctr = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'counter') ctr++; });
    });
    var ok = r.winner === 'atk' && r.rounds >= 4 && ctr >= 3;
    console.log('   ×' + mul + '（' + U.fmt(n) + ' 人）→ ' + (r.winner === 'atk' ? '胜' : '败')
      + '　回合 ' + r.rounds + '　反击 ' + ctr + (ok ? '　✅ 可用' : ''));
    if (ok && picked.length < 3) {
      picked.push({ x: s.x, y: s.y, lv: s.lv, army: army, rounds: r.rounds, ctr: ctr });
    }
  });
});

console.log('\n===== 可抄进截图脚本的靶子 =====');
picked.slice(0, 3).forEach(function (p) {
  console.log('  {x:' + p.x + ',y:' + p.y + ',lv:' + p.lv + ',army:' + JSON.stringify(p.army)
    + '}  // 回合 ' + p.rounds + ' · 反击 ' + p.ctr);
});
process.exit(0);
