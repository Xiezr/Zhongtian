/* ============================================================
 * check_v89117_shots.js — v89.117 截图体检（**用像素统计当眼睛**）
 * 判据（不赌观感，只挡"空白图 / 分区没画出来"）：
 *   ① 每张图非空（尺寸 > 1200×700、文件 > 20KB）
 *   ② 亮度 18~75 & 亮像素占比 0.4%~30%（暗色主题基线）
 *   ③ **分区**：战场图三列（左/中/右）与播报区各有内容；
 *      军务图上下半（两营卡区）各有内容
 * 用法：node .workbuddy/tools/asset/check_v89117_shots.js
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
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      lum += L; tot++; if (L > 90) bright++;
    }
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot) };
}
var FILES = ['marches-two-camps', 'forge-single-key', 'forge-set-filter',
  'bag-equip-worn', 'modal-stack', 'battle-lanes', 'exp-gen-disabled'];
var bad = [];
FILES.forEach(function (n) {
  var f = 'v89117-' + n + '.png';
  var png = load(f);
  if (!png) { bad.push(f + ' 缺图'); console.log('  ❌ ' + f + ' 缺图'); return; }
  var bytes = fs.statSync(path.join(R, '.workbuddy/shots', f)).size;
  var s = stat(png, 0, png.width, 0, png.height);
  var ok = png.width > 1200 && png.height > 700 && bytes > 20000
    && s.lum > 18 && s.lum < 75 && s.brightPct > 0.4 && s.brightPct < 30;
  console.log((ok ? '  ✅ ' : '  ❌ ') + f + '　' + png.width + '×' + png.height + '　'
    + (bytes / 1024).toFixed(0) + 'KB　亮度 ' + s.lum.toFixed(1) + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
  if (!ok) bad.push(f);
});
/* 分区：战场三列 + 播报区；军务卡区 */
(function () {
  var png = load('v89117-battle-lanes.png');
  if (png) {
    var W = png.width, H = png.height;
    var zones = [[['我军列', 0.06, 0.16], ['战场中列', 0.30, 0.70], ['敌军列', 0.84, 0.94]]];
    zones[0].forEach(function (z) {
      var s = stat(png, Math.round(W * z[1]), Math.round(W * z[2]),
        Math.round(H * 0.18), Math.round(H * 0.60));
      var ok = s.brightPct > 0.3;
      console.log((ok ? '  ✅ ' : '  ❌ ') + '战场分区 ' + z[0] + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
      if (!ok) bad.push('battle-zone-' + z[0]);
    });
    var sLog = stat(png, Math.round(W * 0.16), Math.round(W * 0.84),
      Math.round(H * 0.70), Math.round(H * 0.93));
    var okLog = sLog.brightPct > 0.25;
    console.log((okLog ? '  ✅ ' : '  ❌ ') + '战场**回合播报区**（下部）　亮像素 ' + sLog.brightPct.toFixed(2) + '%');
    if (!okLog) bad.push('battle-log-band');
  }
  var png2 = load('v89117-marches-two-camps.png');
  if (png2) {
    var s2 = stat(png2, Math.round(png2.width * 0.08), Math.round(png2.width * 0.92),
      Math.round(png2.height * 0.55), Math.round(png2.height * 0.95));
    var ok2 = s2.brightPct > 0.3;
    console.log((ok2 ? '  ✅ ' : '  ❌ ') + '军务图**下半（两营卡区）**　亮像素 ' + s2.brightPct.toFixed(2) + '%');
    if (!ok2) bad.push('marches-lower-half');
  }
})();
console.log(bad.length ? ('\n⚠ 未过：' + bad.join('、')) : '\n截图体检通过');
process.exit(bad.length ? 1 : 0);
