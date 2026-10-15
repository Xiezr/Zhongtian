/* ============================================================
 * check_v89137_shots.js — v89.137 截图体检（像素统计当眼睛）
 *   ① 七张主图非空（>1200×700 · >20KB）+ 暗色主题亮度基线
 *   ② 战场图（bt16）：**下方 1/3 区域**有内容（回合记录贴底）——改前那片是空面板
 *   ③ 大地图图（map-green）：**绿色像素**（采集标记 #3ad07a）真的画出来了
 *   ④ 官府图 改前 vs 改后：都非空 + 尺寸/内容差异（规格统一另有实机数值佐证）
 *   ⑤ 附属野地 / 出征 / 建筑面板：中区有内容
 * 用法：node .workbuddy/tools/asset/check_v89137_shots.js
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
/* 文字行数：逐行投影数"有多少条水平文字带"（比亮点百分比更能说明"这片不是空白"） */
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

/* 绿色标记（#3ad07a 附近）：g 明显压过 r/b */
function greenCount(png) {
  var n = 0;
  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (g > 160 && g - r > 60 && g - b > 40) n++;
    }
  }
  return n;
}

console.log('=== v89.137 截图体检 ===');
var files = ['v89137-guanfu.png', 'v89137-bt16.png', 'v89137-wildops.png',
  'v89137-exp-station.png', 'v89137-pane-tier.png', 'v89137-map-green.png',
  'v89137before-guanfu.png'];
files.forEach(function (f) {
  var L = load(f);
  var ok = !!L && L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000;
  var all = L ? stat(L.png, 0, L.png.width, 0, L.png.height) : { lum: 0, brightPct: 0 };
  chk('① ' + f + ' 非空 + 尺寸 + 体积', ok,
    L ? (L.png.width + '×' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮 ' + all.lum.toFixed(1) +
      ' · 亮点 ' + all.brightPct.toFixed(2) + '%') : '缺失');
});

/* ② 战场：下方 1/3（回合记录区）—— 改前该区留白 295px（几乎无文字像素） */
var bt = load('v89137-bt16.png');
if (bt) {
  var y0 = Math.round(bt.png.height * 0.62), y1 = bt.png.height - 20;
  var s = stat(bt.png, Math.round(bt.png.width * 0.2), Math.round(bt.png.width * 0.8), y0, y1);
  var tr = textRows(bt.png, Math.round(bt.png.width * 0.2), Math.round(bt.png.width * 0.8), y0, y1);
  /* 判据用"文字行数"：改前该区 295px 全空（0 行）——比亮点百分比更能说明"真的贴底了" */
  chk('② 战场图下方 1/3 有回合记录（≥6 条文字行）', tr >= 6,
    tr + ' 行 · 亮 ' + s.lum.toFixed(1) + ' · 亮点 ' + s.brightPct.toFixed(2) + '%');
}

/* ③ 大地图：采集绿点 */
var mp = load('v89137-map-green.png');
if (mp) {
  var gn = greenCount(mp.png);
  chk('③ 大地图有采集标记绿色像素（≥ 30 像素）', gn >= 30, gn + ' 像素');
  var ml = stat(mp.png, 0, mp.png.width, 0, mp.png.height);
  chk('③ 大地图非空白（亮点 > 3%）', ml.brightPct > 3, '亮点 ' + ml.brightPct.toFixed(2) + '%');
}

/* ④ 官府 改前/改后 对照 */
var gb = load('v89137before-guanfu.png'), ga = load('v89137-guanfu.png');
if (gb && ga) {
  chk('④ 官府改前/改后都存在（对照可用）', gb.bytes > 20000 && ga.bytes > 20000,
    '前 ' + Math.round(gb.bytes / 1024) + 'KB → 后 ' + Math.round(ga.bytes / 1024) + 'KB');
}

/* ⑤ 三张面板图：中区有内容 */
[['v89137-wildops.png', '附属野地（操作列）'],
 ['v89137-exp-station.png', '出征（驻守·增援）'],
 ['v89137-pane-tier.png', '建筑面板（专精三档）']].forEach(function (pair) {
  var L = load(pair[0]);
  if (!L) { chk('⑤ ' + pair[1] + ' 中区有内容', false, '缺图'); return; }
  var s = stat(L.png, Math.round(L.png.width * 0.2), Math.round(L.png.width * 0.8),
    Math.round(L.png.height * 0.25), Math.round(L.png.height * 0.75));
  chk('⑤ ' + pair[1] + ' 中区有内容（亮点 > 1%）', s.brightPct > 1,
    '亮 ' + s.lum.toFixed(1) + ' · 亮点 ' + s.brightPct.toFixed(2) + '%');
});

console.log('\n===== 像素体检：' + (FAIL ? (FAIL + ' 项失败') : '全部通过') + ' =====');
process.exit(FAIL ? 1 : 0);
