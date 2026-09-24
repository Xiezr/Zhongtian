/* ============================================================
 * check_v89118_shots.js — v89.118 截图体检（像素统计当眼睛）
 * 判据：
 *   ① 非空（尺寸 / 体积 / 亮度 / 亮像素占比在暗色主题基线内）
 *   ② 分区内容：俘虏营明细区 / 外敌来犯规则区 / 烽火预警表区 各有内容
 * 用法：node .workbuddy/tools/asset/check_v89118_shots.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) {
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}
function load(f) {
  var p = path.join(R, '.workbuddy/shots', f);
  if (!fs.existsSync(p)) return null;
  return PNG.sync.read(fs.readFileSync(p));
}
function stat(png, x0, x1, y0, y1) {
  var lum = 0, bright = 0, tot = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (png.width * y + x) << 2;
    var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    lum += L; tot++; if (L > 90) bright++;
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot) };
}
var FILES = ['v89118-captive-camp', 'v89118-auto-invasion', 'v89118-beacon-slim', 'v89118-elephant-card'];
var bad = [];
FILES.forEach(function (n) {
  var f = n + '.png';
  var png = load(f);
  if (!png) { bad.push(f + ' 缺图'); return; }
  var bytes = fs.statSync(path.join(R, '.workbuddy/shots', f)).size;
  var s = stat(png, 0, png.width, 0, png.height);
  var ok = png.width > 1200 && png.height > 700 && bytes > 20000
    && s.lum > 18 && s.lum < 75 && s.brightPct > 0.4 && s.brightPct < 30;
  console.log((ok ? '  ✅ ' : '  ❌ ') + f + '　' + png.width + '×' + png.height + '　' + (bytes / 1024).toFixed(0)
    + 'KB　亮度 ' + s.lum.toFixed(1) + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
  if (!ok) bad.push(f);
});
/* 分区：三张图的主内容区（正文中带）必须有内容 */
[['v89118-captive-camp.png', '俘虏营明细带', 0.05, 0.45, 0.25, 0.55],
 ['v89118-auto-invasion.png', '外敌来犯规则带', 0.40, 0.72, 0.35, 0.85],
 ['v89118-beacon-slim.png', '烽火预警表带', 0.10, 0.90, 0.30, 0.75]].forEach(function (z) {
  var png = load(z[0]);
  if (!png) return;
  var s = stat(png, Math.round(png.width * z[2]), Math.round(png.width * z[3]),
    Math.round(png.height * z[4]), Math.round(png.height * z[5]));
  var ok = s.brightPct > 0.25 || s.lum > 22;
  console.log((ok ? '  ✅ ' : '  ❌ ') + z[1] + '　亮度 ' + s.lum.toFixed(1) + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
  if (!ok) bad.push(z[1]);
});
console.log(bad.length ? ('\n⚠ 未过：' + bad.join('、')) : '\n截图体检通过');
process.exit(bad.length ? 1 : 0);
