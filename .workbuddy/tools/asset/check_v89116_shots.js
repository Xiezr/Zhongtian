/* ============================================================
 * check_v89116_shots.js — v89.116 截图体检（**用像素统计当眼睛**）
 * 判据（不赌观感，只挡"空白图 / 没画出来"）：
 *   ① 每张图非空（尺寸 > 0、文件 > 20KB）
 *   ② 平均亮度在 20~70（暗色主题基线；全黑/全白即异常）
 *   ③ 亮像素占比 0.5%~25%（有内容、不是一片糊）
 *   ④ 分区亮像素：三张"分区明显"的图（战场 / 守城沙盘 / 军务处）各分区都要有内容
 * 用法：node .workbuddy/tools/asset/check_v89116_shots.js
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
  var n = 0, lum = 0, bright = 0, tot = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      lum += L; tot++; if (L > 90) bright++; n++;
    }
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot) };
}
var FILES = ['battle', 'def-sandbox', 'affairs', 'sg-pending', 'qbuy-train', 'zoom', 'auto-heal'];
var bad = [];
FILES.forEach(function (n) {
  var f = 'v89116-' + n + '.png';
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
/* 分区：战场三列（左/中/右）+ 守城沙盘右缘围墙带 必须各有内容 */
(function () {
  var png = load('v89116-battle.png');
  if (!png) return;
  var W = png.width, H = png.height;
  var y0 = Math.round(H * 0.18), y1 = Math.round(H * 0.72);
  var cols = [[0.06, 0.24], [0.30, 0.70], [0.76, 0.94]];
  cols.forEach(function (c, i) {
    var s = stat(png, Math.round(W * c[0]), Math.round(W * c[1]), y0, y1);
    var ok = s.brightPct > 0.3;
    console.log((ok ? '  ✅ ' : '  ❌ ') + '战场分区 ' + ['我军列', '战场中列', '敌军列'][i]
      + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
    if (!ok) bad.push('battle-zone' + i);
  });
  var png2 = load('v89116-def-sandbox.png');
  if (png2) {
    var s2 = stat(png2, Math.round(png2.width * 0.80), Math.round(png2.width * 0.98),
      Math.round(png2.height * 0.20), Math.round(png2.height * 0.70));
    var ok2 = s2.brightPct > 0.3;
    console.log((ok2 ? '  ✅ ' : '  ❌ ') + '守城沙盘**右缘围墙带**　亮像素 ' + s2.brightPct.toFixed(2) + '%');
    if (!ok2) bad.push('def-wall-band');
  }
})();
console.log(bad.length ? ('\n⚠ 未过：' + bad.join('、')) : '\n截图体检通过');
process.exit(bad.length ? 1 : 0);
