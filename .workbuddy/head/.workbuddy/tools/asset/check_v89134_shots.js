/* ============================================================
 * check_v89134_shots.js — v89.134 截图体检（像素统计当眼睛）
 *   本轮为重构型交付 —— 判据聚焦「页面照常且内容丰富」：
 *     ① 两图非空（>1200×700 · >20KB）+ 暗色主题亮度基线（18~80 · 亮像素 0.4%~32%）
 *     ② 城内图：**左侧栏区域**有内容（资源行/统计在画）
 *     ③ 出征页图：**中部主区**有内容（页签行 + 容量行 + 目标下拉）
 * 用法：node .workbuddy/tools/asset/check_v89134_shots.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) {
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}
function load(f) {
  var p = path.join(R, '.workbuddy/shots', f);
  if (!fs.existsSync(p)) return null;
  return { png: PNG.sync.read(fs.readFileSync(p)), bytes: fs.statSync(p).size };
}
function stat(png, x0, x1, y0, y1) {
  var lum = 0, bright = 0, tot = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += L; tot++; if (L > 90) bright++;
    }
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot), tot: tot };
}

console.log('== ① 主图基线（非空 / 亮度）==');
[['v89134-main.png', '城内主界面'],
 ['v89134-act.png', '军务·出征页']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) { chk(it[1] + ' 图存在', false, '缺 ' + it[0]); return; }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk(it[1] + '：非空 + 暗色主题亮度基线', L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000
    && s.lum > 18 && s.lum < 80 && s.brightPct > 0.4 && s.brightPct < 32,
    L.png.width + 'x' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮度 ' + s.lum.toFixed(1)
    + ' · 亮像素 ' + s.brightPct.toFixed(1) + '%');
});

console.log('== ② 城内图：左侧栏有内容（资源行在画）==');
(function () {
  var L = load('v89134-main.png');
  if (!L) return;
  var W = L.png.width, H = L.png.height;
  var s = stat(L.png, 0, Math.round(W * 0.16), Math.round(H * 0.1), Math.round(H * 0.9));
  chk('左侧栏区域有亮像素（统计/资源行）', s.brightPct > 0.8,
    '亮度 ' + s.lum.toFixed(1) + ' · 亮像素 ' + s.brightPct.toFixed(2) + '%');
})();

console.log('== ③ 出征页图：中部主区有内容（页签/容量/下拉）==');
(function () {
  var L = load('v89134-act.png');
  if (!L) return;
  var W = L.png.width, H = L.png.height;
  var s = stat(L.png, Math.round(W * 0.2), Math.round(W * 0.85), Math.round(H * 0.08), Math.round(H * 0.92));
  chk('主区有亮像素（页签行 + 容量行 + 目标下拉）', s.brightPct > 0.8,
    '亮度 ' + s.lum.toFixed(1) + ' · 亮像素 ' + s.brightPct.toFixed(2) + '%');
})();

console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 像素体检全项达标');
process.exit(FAIL ? 1 : 0);
