'use strict';
/* v89.139 像素体检（轻量）：图非空 + 关键区域有内容
   跑法：NODE_PATH="..." node .workbuddy/tools/asset/check_v89139_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
function stat(png, x0, y0, w, h) {
  var sum = 0, bright = 0, n = 0;
  for (var y = y0; y < y0 + h && y < png.height; y++) for (var x = x0; x < x0 + w && x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    sum += L; if (L > 90) bright++; n++;
  }
  return { lum: sum / Math.max(1, n), brightPct: bright / Math.max(1, n) * 100 };
}
var SHOTS = [
  ['v89139-map-1920.png', '大屏地图（1920×1080 铺满）'],
  ['v89139-map-corner.png', '地图角落（无箭头）'],
  ['v89139-mini-default.png', '缩略图（默认只当前城）'],
  ['v89139-mini-mine.png', '缩略图（我城档）'],
  ['v89139-land.png', '己方野地面板'],
  ['v89139-bt2col.png', '战场 2 列'],
  ['v89139-arrow-before.png', '箭头对照·改前'],
  ['v89139-arrow-after.png', '箭头对照·改后'],
];
console.log('===== v89.139 像素体检 =====');
SHOTS.forEach(function (v) {
  var p = 'E:/Deepseekdb/.workbuddy/shots/' + v[0];
  if (!fs.existsSync(p)) { chk(v[1] + '（图存在）', false, '缺文件'); return; }
  var png = load(p);
  var s = stat(png, 0, 0, png.width, png.height);
  chk(v[1] + '：非空且有内容', png.width > 100 && png.height > 100 && s.lum > 10 && s.brightPct > 0.3,
    png.width + '×' + png.height + ' · 均亮 ' + s.lum.toFixed(1) + ' · 亮像素 ' + s.brightPct.toFixed(2) + '%');
});
/* 地图角落图：下缘应有内容（城池/地形），但不能是"整片箭头" */
var mc = load('E:/Deepseekdb/.workbuddy/shots/v89139-map-corner.png');
var bot = stat(mc, 0, mc.height - 40, mc.width, 40);
chk('角落图下缘有地形内容（非空白）', bot.brightPct > 1, '亮像素 ' + bot.brightPct.toFixed(2) + '%');
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
