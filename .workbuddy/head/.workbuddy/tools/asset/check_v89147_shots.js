'use strict';
/* v89.147 像素体检：2 张实机图（装备页 / 宝物页）——
   非空 + 分类行带 + **排序条带在两张图的同一 y**（像素层复核"排序框同一位置"）
   跑法：node .workbuddy/tools/asset/check_v89147_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
function rowLum(png, y) {
  var bright = 0;
  for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    if (L > 90) bright++;
  }
  return bright / png.width * 100;
}
function band(png, y0, y1) {
  var sum = 0, n = 0;
  for (var y = y0; y < y1; y++) { sum += rowLum(png, y); n++; }
  return n ? sum / n : 0;
}
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var A = load(S + 'v89147-bag-equip.png');
var B = load(S + 'v89147-bag-treasure.png');
console.log('装备页 ' + A.width + '×' + A.height + ' · 宝物页 ' + B.width + '×' + B.height);

var aAll = band(A, 0, A.height), bAll = band(B, 0, B.height);
console.log('  全图平均亮：装备 ' + aAll.toFixed(2) + '% · 宝物 ' + bAll.toFixed(2) + '%');
chk('两张图非空（平均亮 0.5%~30%）', aAll > 0.5 && aAll < 30 && bAll > 0.5 && bAll < 30,
  aAll.toFixed(2) + '% / ' + bAll.toFixed(2) + '%');

/* 分类行带（实机量到 rowH=32；页顶约 y 78 起）→ 取 78~130 */
var aRow = band(A, 80, 130), bRow = band(B, 80, 130);
console.log('  分类行带（y80-130）：装备 ' + aRow.toFixed(2) + '% · 宝物 ' + bRow.toFixed(2) + '%');
chk('两页分类行带都有内容', aRow > 0.8 && bRow > 0.8, aRow.toFixed(2) + '% / ' + bRow.toFixed(2) + '%');

/* 排序条带：实机量到 top=178 → 取 170~215（含排序框自身高度） */
var aSort = band(A, 170, 215), bSort = band(B, 170, 215);
console.log('  排序条带（y170-215）：装备 ' + aSort.toFixed(2) + '% · 宝物 ' + bSort.toFixed(2) + '%');
chk('两页**排序条带**都有内容（像素层：同一 y 位置都画着排序框）',
  aSort > 0.8 && bSort > 0.8, aSort.toFixed(2) + '% / ' + bSort.toFixed(2) + '%');
/* 更强：在 165~225 扫一遍，找"最亮行"的 y —— 两页应几乎相同（排序框的边框/文字） */
function peakY(png) {
  var best = -1, bestV = -1;
  for (var y = 150; y < 240; y++) { var v = rowLum(png, y); if (v > bestV) { bestV = v; best = y; } }
  return { y: best, v: bestV };
}
var pa = peakY(A), pb = peakY(B);
console.log('  排序条带最亮行：装备 y=' + pa.y + '（' + pa.v.toFixed(2) + '%）· 宝物 y=' + pb.y + '（' + pb.v.toFixed(2) + '%）');
chk('两页排序条带最亮行 y 接近（≤ 4px · 像素层复核同位置）', Math.abs(pa.y - pb.y) <= 4,
  'Δ=' + Math.abs(pa.y - pb.y) + 'px');

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
