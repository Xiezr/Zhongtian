/* ============================================================
 * check_v89135_shots.js — v89.135 截图体检（像素统计当眼睛）
 *   ① 六张主图非空（>1200×700 · >20KB）+ 暗色主题亮度基线
 *   ② 野地面板图：中区有内容（驻军板块 + 操作区）
 *   ③ 采集面板图：中区有内容
 *   ④ 官府面板图：中区有内容
 * 用法：node .workbuddy/tools/asset/check_v89135_shots.js
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
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot) };
}

console.log('== ① 六图基线 ==');
[['v89135-land.png', '野地面板（驻军板块）'],
 ['v89135-gathers.png', '采集面板'],
 ['v89135-gov.png', '官府建筑面板'],
 ['v89135-upgrade.png', '建筑升级键'],
 ['v89135-pane.png', '将领面板（精力行）'],
 ['v89135-farm.png', '秘境（若在）']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) {
    if (it[0] === 'v89135-farm.png') { console.log('  · ' + it[1] + '：未出图（可选）'); return; }
    chk(it[1] + ' 图存在', false, '缺 ' + it[0]); return;
  }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk(it[1] + '：非空 + 暗色基线', L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000
    && s.lum > 18 && s.lum < 80 && s.brightPct > 0.4 && s.brightPct < 32,
    L.png.width + 'x' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮度 ' + s.lum.toFixed(1)
    + ' · 亮像素 ' + s.brightPct.toFixed(1) + '%');
});

console.log('== ② 面板中区有内容 ==');
[['v89135-land.png', '野地面板'], ['v89135-gathers.png', '采集面板'],
 ['v89135-gov.png', '官府面板']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) return;
  var W = L.png.width, H = L.png.height;
  var s = stat(L.png, Math.round(W * 0.2), Math.round(W * 0.8), Math.round(H * 0.15), Math.round(H * 0.9));
  chk(it[1] + '：弹窗主体亮像素达标', s.brightPct > 0.6,
    '亮度 ' + s.lum.toFixed(1) + ' · 亮像素 ' + s.brightPct.toFixed(2) + '%');
});

console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 像素体检全项达标');
process.exit(FAIL ? 1 : 0);
