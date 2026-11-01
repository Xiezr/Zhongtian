/* 架构体检：一次性量化「清爽度」的五个维度，输出可核对的数据。
 *
 *   ① 模块规模分布（巨石指数：最大文件 / 中位）
 *   ② 模块间循环依赖（近似：A 用 B 的导出 && B 用 A 的导出）
 *   ③ 全局单例耦合（GAME.xxx 的直接引用密度）
 *   ④ 分层收敛（球面摆位 / 资产标定 是否真的各只有一处出口）
 *   ⑤ 测试独立性（同 seed 重建世界的成本 —— 决定能否按段跑/并行）
 *
 * 用法：node .workbuddy/tools/prof/audit_arch.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var JS = path.join(ROOT, 'js');

var files = fs.readdirSync(JS).filter(function (f) {
  return /\.js$/.test(f) && f.indexOf('bundle-') !== 0;
}).sort();

var src = {}, lines = {};
files.forEach(function (f) {
  var s = fs.readFileSync(path.join(JS, f), 'utf8');
  src['js/' + f] = s;
  lines['js/' + f] = s.split('\n').length;
});

var keys = Object.keys(lines).sort(function (a, b) { return lines[b] - lines[a]; });
var total = keys.reduce(function (s, k) { return s + lines[k]; }, 0);
var sortedN = keys.map(function (k) { return lines[k]; }).sort(function (a, b) { return a - b; });
var median = sortedN[Math.floor(sortedN.length / 2)];

console.log('══ ① 模块规模 ══');
console.log('  模块数 ' + keys.length + ' · 总行数 ' + total + ' · 中位 ' + median + ' 行');
console.log('  最大 ' + keys[0] + ' (' + lines[keys[0]] + ' 行) = 中位的 ' + (lines[keys[0]] / median).toFixed(0) + ' 倍');
var big = keys.filter(function (k) { return lines[k] > 3000; });
console.log('  超 3000 行的巨石 ' + big.length + ' 个，占全部代码 '
  + (big.reduce(function (s, k) { return s + lines[k]; }, 0) / total * 100).toFixed(1) + '%：');
big.forEach(function (k) { console.log('    · ' + k + '  ' + lines[k]); });

console.log('\n══ ② 模块间循环依赖（近似）══');
var defines = {}, uses = {};
Object.keys(src).forEach(function (f) {
  var s = src[f], d = {}, u = {};
  var m;
  var reDef = /(?:^|\s)(?:GAME|DATA|SP)\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = reDef.exec(s))) d[m[1]] = 1;
  var reUse = /\bGAME\.([A-Za-z_$][\w$]*)/g;
  while ((m = reUse.exec(s))) u[m[1]] = 1;
  defines[f] = d; uses[f] = u;
});
var cycles = [];
for (var i = 0; i < keys.length; i++) {
  for (var j = i + 1; j < keys.length; j++) {
    var a = keys[i], b = keys[j];
    var ab = Object.keys(defines[b]).some(function (k) { return uses[a][k]; });
    var ba = Object.keys(defines[a]).some(function (k) { return uses[b][k]; });
    if (ab && ba) cycles.push([a, b]);
  }
}
console.log('  双向依赖对：' + cycles.length);
cycles.slice(0, 8).forEach(function (p) { console.log('    ↺ ' + p[0] + ' ⇄ ' + p[1]); });
if (cycles.length > 8) console.log('    … 另 ' + (cycles.length - 8) + ' 对');

console.log('\n══ ③ 全局单例耦合 ══');
var hot = {};
Object.keys(src).forEach(function (f) {
  var m, re = /\bGAME\.([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(src[f]))) hot[m[1]] = (hot[m[1]] || 0) + 1;
});
var hotTop = Object.keys(hot).sort(function (a, b) { return hot[b] - hot[a]; }).slice(0, 6);
console.log('  被直接引用最多的全局入口：');
hotTop.forEach(function (k) { console.log('    · GAME.' + k + '  ' + hot[k] + ' 次'); });
var totalUse = Object.keys(hot).reduce(function (s, k) { return s + hot[k]; }, 0);
console.log('  GAME.* 引用总计 ' + totalUse + ' 次（平均每 100 行 '
  + (totalUse / total * 100).toFixed(1) + ' 次）');

console.log('\n══ ④ 分层收敛（上一轮的成果是否还在）══');
var md = src['js/map3d.js'] || '';
var gl = src['js/gltf.js'] || '';
function has(s, t) { return s.indexOf(t) >= 0; }
console.log('  球面摆位唯一出口 surfaceQuad      ' + (has(md, 'M.surfaceQuad = surfaceQuad') || has(md, 'surfaceQuad: surfaceQuad') ? '✓' : '✗'));
console.log('  切平面基 surfaceFrame              ' + (has(md, 'surfaceFrame') ? '✓' : '✗'));
console.log('  该出口覆盖四个调用点（城镇/小人/奇观/行走）'
  + ((md.match(/applyQuad\(/g) || []).length + ' 处 applyQuad'));
console.log('  资产标定表 GTF.FIT                 ' + (has(gl, 'GTF.FIT = {') ? '✓' : '✗'));
console.log('  服装→每个资产一行（立姿/缩放/贴地） ' + ((gl.match(/stand:\s*\[/g) || []).length + ' 个资产已标定'));
console.log('  seatProp 与 surfaceQuad 等价（局部轴）'
  + (has(md, 'v156.25') ? '✓ 已在注释里固化判据' : '? 未见判据注释'));

console.log('\n══ ⑤ 算法与渲染是否还同居 ══');
['genSettlements', 'sphereKmeans', 'weightedNearest', 'repairConn'].forEach(function (fn) {
  var where = keys.filter(function (f) { return has(src[f], 'function ' + fn + '('); });
  console.log('  ' + fn + ' 住在 ' + (where.join(',') || '（找不到）'));
});

console.log('\n══ 汇总 ══');
console.log('  工程侧（门禁/基线/复跑）：见 gate.py + gate-baseline.json');
console.log('  游戏侧：' + keys.length + ' 模块 / ' + total + ' 行 / 循环依赖 ' + cycles.length + ' 对');
