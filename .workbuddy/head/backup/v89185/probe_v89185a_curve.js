/* v89.185（老板 1）：六维→内政"不封口"曲线设计 —— 新旧逐点对照 + 尾段边际。
   旧（v89.164）：分段减半（r0, r0/2, r0/4, r0/8…）→ 收敛 2×r0×seg（内政极限 +300%）。
   新（候选）：前两段原样 + 第三段起恒定 r0/4（不再减半、不封口）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: 'curve', avatar: '🧔', gender: 'male', region: '豫州' });

var SEG = (DATA.MAYOR_CURVE || {}).seg || 150;
console.log('=== 旧曲线现状（GAME.curveBonusOf · 分段减半 · seg=' + SEG + '）===');
console.log('内政（r0=1%/点）· 智谋（r0=0.5%/点）逐点：');
console.log('  pts    旧内政     旧智谋   | 新内政     新智谋    | 新-旧内政');
function oldC(pts, r0, seg) { return G.curveBonusOf(pts, r0, seg); }
function newC(pts, r0, seg) {
  var p1 = Math.min(pts, seg);
  var p2 = Math.min(Math.max(0, pts - seg), seg);
  var p3 = Math.max(0, pts - seg * 2);
  return p1 * r0 + p2 * (r0 / 2) + p3 * (r0 / 4);
}
[100, 150, 200, 300, 360, 450, 500, 600, 800, 1000, 1200, 1400, 1600].forEach(function (p) {
  var o1 = oldC(p, 0.01, SEG), o2 = oldC(p, 0.005, SEG);
  var n1 = newC(p, 0.01, SEG), n2 = newC(p, 0.005, SEG);
  console.log('  ' + String(p).padEnd(7)
    + ('+' + (o1 * 100).toFixed(1) + '%').padEnd(11) + ('+' + (o2 * 100).toFixed(1) + '%').padEnd(9)
    + '| ' + ('+' + (n1 * 100).toFixed(1) + '%').padEnd(11) + ('+' + (n2 * 100).toFixed(1) + '%').padEnd(9)
    + '| ' + ((n1 - o1) * 100).toFixed(1) + 'pt');
});
console.log('');
console.log('=== 尾段边际（每 100 点增量）===');
[[1500, 1600], [1900, 2000], [2900, 3000], [3900, 4000]].forEach(function (r) {
  var o = (oldC(r[1], 0.01, SEG) - oldC(r[0], 0.01, SEG)) * 100;
  var n = (newC(r[1], 0.01, SEG) - newC(r[0], 0.01, SEG)) * 100;
  console.log('  ' + r[0] + '→' + r[1] + '：旧 +' + o.toFixed(2) + 'pt · 新 +' + n.toFixed(2) + 'pt');
});
console.log('');
console.log('=== 满配（四维 1400）对照 ===');
var nzF = 1400;
console.log('  满配 nz=1400：旧 +' + (oldC(nzF, 0.01, SEG) * 100).toFixed(1) + '% → 新 +' + (newC(nzF, 0.01, SEG) * 100).toFixed(1) + '%');
console.log('  满配 zm=1400：旧 +' + (oldC(nzF, 0.005, SEG) * 100).toFixed(1) + '% → 新 +' + (newC(nzF, 0.005, SEG) * 100).toFixed(1) + '%');
console.log('');
console.log('=== 关键断点核对（新曲线应与旧在前 450 点逐点相同）===');
var allSame = true;
[0, 50, 100, 150, 200, 250, 300, 350, 400, 450].forEach(function (p) {
  var same = Math.abs(oldC(p, 0.01, SEG) - newC(p, 0.01, SEG)) < 1e-9;
  if (!same) allSame = false;
});
console.log('  0~450 逐点相同: ' + (allSame ? '✓' : '✗'));
/* 老档安全：老档将领四维一般多少？扫一遍现有将领（新局无）——用资质中值参考 */
console.log('');
console.log('=== 参考：按资质满级（资质等级上限）的六维 ==');
DATA.GEN_RANKS.forEach(function (rk) {
  var base = (rk.base[0] + rk.base[1]) / 2;
  var up = rk.lvCap - 1;
  var mid = base + up * (rk.grow || 1);   /* 简化：每级 +grow（真实=自动加点+自由点，量级一致） */
  console.log('  ' + rk.name + ' Lv' + rk.lvCap + '：四维中值 ≈ ' + Math.round(mid)
    + ' → 内政 ' + (newC(mid, 0.01, SEG) * 100).toFixed(0) + '% · 智谋 ' + (newC(mid, 0.005, SEG) * 100).toFixed(0) + '%');
});
process.exit(0);
