/* ============================================================
 * check_v89138_shots.js — v89.138 截图体检（像素统计当眼睛）
 *   ① 五张主图非空（>1200×700 · >20KB）+ 暗色主题亮度基线
 *   ② 地图图：画布区域内容密度（铺满后地图占屏比例高）
 *   ③ 12 兵种战场图：下方 1/3 有记录（≥4 条文字行 —— 极端载荷下记录区压到 140px）
 *   ④ 城池菜单图：底栏区域有按钮（亮点 > 3%）
 *   ⑤ 建筑面板图：中区有内容
 * 用法：node .workbuddy/tools/asset/check_v89138_shots.js
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
/* 文字行数：逐行投影 */
function textRows(png, x0, x1, y0, y1) {
  var rows = 0, inRow = false, need = (x1 - x0) * 0.004;
  for (var y = y0; y < y1; y++) {
    var bright = 0;
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      if (L > 90) bright++;
    }
    var has = bright > need;
    if (has && !inRow) { rows++; inRow = true; }
    if (!has) inRow = false;
  }
  return rows;
}

console.log('=== v89.138 截图体检 ===');
var files = ['v89138-map.png', 'v89138-citymenu.png', 'v89138-exp-dispatch.png',
  'v89138-pane.png', 'v89138-bt12.png'];
files.forEach(function (f) {
  var L = load(f);
  var ok = !!L && L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000;
  var all = L ? stat(L.png, 0, L.png.width, 0, L.png.height) : { lum: 0, brightPct: 0 };
  chk('① ' + f + ' 非空 + 尺寸 + 体积', ok,
    L ? (L.png.width + '×' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮 ' + all.lum.toFixed(1) +
      ' · 亮点 ' + all.brightPct.toFixed(2) + '%') : '缺失');
});

/* ② 地图：画面中段（地图区）内容密度 —— 铺满后地图应占屏 <95% 宽，中段亮点 > 5% */
var mp = load('v89138-map.png');
if (mp) {
  var s = stat(mp.png, Math.round(mp.png.width * 0.22), Math.round(mp.png.width * 0.78),
    Math.round(mp.png.height * 0.2), Math.round(mp.png.height * 0.8));
  chk('② 地图图：中段地图区有内容（亮点 > 5%）', s.brightPct > 5,
    '亮 ' + s.lum.toFixed(1) + ' · 亮点 ' + s.brightPct.toFixed(2) + '%');
}

/* ③ 12 兵种战场图：下方 1/3 有记录（≥4 条文字行） */
var bt = load('v89138-bt12.png');
if (bt) {
  var tr = textRows(bt.png, Math.round(bt.png.width * 0.2), Math.round(bt.png.width * 0.8),
    Math.round(bt.png.height * 0.62), bt.png.height - 20);
  chk('③ 12 兵种战场图：下方 1/3 有记录（≥4 条文字行）', tr >= 4, tr + ' 行');
}

/* ④ 城池菜单图：底栏按钮区有内容 */
var cm = load('v89138-citymenu.png');
if (cm) {
  var sb = stat(cm.png, Math.round(cm.png.width * 0.25), Math.round(cm.png.width * 0.75),
    Math.round(cm.png.height * 0.72), Math.round(cm.png.height * 0.9));
  chk('④ 城池菜单图：底栏按钮区有内容（亮点 > 3%）', sb.brightPct > 3,
    '亮 ' + sb.lum.toFixed(1) + ' · 亮点 ' + sb.brightPct.toFixed(2) + '%');
}

/* ⑤ 建筑面板图：中区有内容 */
var pn = load('v89138-pane.png');
if (pn) {
  var sp = stat(pn.png, Math.round(pn.png.width * 0.2), Math.round(pn.png.width * 0.8),
    Math.round(pn.png.height * 0.25), Math.round(pn.png.height * 0.75));
  chk('⑤ 建筑面板图：中区有内容（亮点 > 1%）', sp.brightPct > 1,
    '亮 ' + sp.lum.toFixed(1) + ' · 亮点 ' + sp.brightPct.toFixed(2) + '%');
}

console.log('\n===== 像素体检：' + (FAIL ? (FAIL + ' 项失败') : '全部通过') + ' =====');
process.exit(FAIL ? 1 : 0);
