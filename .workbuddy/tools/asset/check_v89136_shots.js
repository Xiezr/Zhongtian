/* ============================================================
 * check_v89136_shots.js — v89.136 截图体检（像素统计当眼睛）
 *   ① 四张主图非空（>1200×700 · >20KB）+ 暗色主题亮度基线
 *   ② 地块采集图：中区有内容（采集区 + 进度条）
 *   ③ 将领面板图：中区有内容（三行）
 *   ④ 战场图：中区有内容（将领行 + 播报窗）
 *   ⑤ 战术页图：中区有内容（两小页）
 * 用法：node .workbuddy/tools/asset/check_v89136_shots.js
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

console.log('== ① 四图基线 ==');
[['v89136-gather.png', '地块采集区'],
 ['v89136-pane3.png', '将领面板（三行）'],
 ['v89136-bt.png', '战场（将领行 + 播报）'],
 ['v89136-tac.png', '出征战术（两小页）']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) { chk(it[1] + ' 图存在', false, '缺 ' + it[0]); return; }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk(it[1] + '：非空 + 暗色基线', L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000
    && s.lum > 18 && s.lum < 80 && s.brightPct > 0.4 && s.brightPct < 32,
    L.png.width + 'x' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮度 ' + s.lum.toFixed(1)
    + ' · 亮像素 ' + s.brightPct.toFixed(1) + '%');
});

console.log('== ② 中区有内容（中央 60%×60% 区亮像素 > 基线） ==');
[['v89136-gather.png', '地块采集区'],
 ['v89136-pane3.png', '将领面板三行'],
 ['v89136-bt.png', '战场界面'],
 ['v89136-tac.png', '出征战术页']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) return;
  var x0 = Math.round(L.png.width * 0.2), x1 = Math.round(L.png.width * 0.8);
  var y0 = Math.round(L.png.height * 0.2), y1 = Math.round(L.png.height * 0.8);
  var s = stat(L.png, x0, x1, y0, y1);
  chk(it[1] + '：中区非空', s.brightPct > 0.6, '中区亮像素 ' + s.brightPct.toFixed(1) + '%');
});

console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 像素体检全项达标');
process.exit(FAIL ? 1 : 0);
