'use strict';
/* v89.142 像素体检：城外地块 12×8 棋盘 —— 用**亮度矩阵**当眼睛
   （模型读不了图；把棋盘按 12×8 切格，量每格亮度，直接看"可用地块是否从中心扩散"）
   色阶实测（v89142 图）：暗格 ≈ 33~38（黑色 14% 遮罩）/ 空地 ≈ 46（透明面 + ＋号）/
   建筑 ≈ 80~112（图标）—— 判"是否暗格"取阈值 42。
   跑法：node .workbuddy/tools/asset/check_v89142_board.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }

var COLS = 12, ROWS = 8, PAD = 26, DARK_THR = 42;
function lumAt(png, x, y) {
  var i = (png.width * y + x) << 2;
  return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
}
function matrix(p) {
  var png = PNG.sync.read(fs.readFileSync(p));
  var cw = (png.width - PAD * 2) / COLS, ch = (png.height - PAD * 2) / ROWS;
  var out = [];
  for (var r = 0; r < ROWS; r++) {
    var row = [];
    for (var c = 0; c < COLS; c++) {
      var sx = Math.round(PAD + c * cw + cw * 0.3), sy = Math.round(PAD + r * ch + ch * 0.3);
      var ex = Math.round(PAD + c * cw + cw * 0.7), ey = Math.round(PAD + r * ch + ch * 0.7);
      var sum = 0, n = 0;
      for (var y = sy; y < ey; y++) for (var x = sx; x < ex; x++) { sum += lumAt(png, x, y); n++; }
      row.push(sum / Math.max(1, n));
    }
    out.push(row);
  }
  return { png: png, m: out, cw: cw, ch: ch };
}
function show(m, tag) {
  console.log('  ' + tag + '（每格亮度 · 行=8 北→南 · 列=12 西→东）：');
  m.forEach(function (row) {
    console.log('    ' + row.map(function (v) { return String(Math.round(v)).padStart(4); }).join(' '));
  });
}
function litCells(m) {
  var out = [];
  m.forEach(function (row, r) { row.forEach(function (v, c) { if (v > DARK_THR) out.push([r, c]); }); });
  return out;
}
var cr = (ROWS - 1) / 2, cc = (COLS - 1) / 2;
function ringOf(rc) { return Math.max(Math.abs(rc[0] - cr), Math.abs(rc[1] - cc)); }

console.log('===== ① Lv1（12 可用块 · 应集中在中部）=====');
var L1 = matrix('E:/Deepseekdb/.workbuddy/shots/v89142-board-lv1.png');
show(L1.m, 'Lv1');
var lit1 = litCells(L1.m);
var maxRing1 = Math.max.apply(null, lit1.map(ringOf));
console.log('    可用格 ' + lit1.length + ' 个 · 最外环 ' + maxRing1 + '（环 0.5=中心 2×2）');
chk('① Lv1：可用格 = 12（与 DOM 断言一致）', lit1.length === 12, 'n=' + lit1.length);
chk('① 可用格全部落在中心区（最外环 ≤ 1.5 = 中心 4×4）', maxRing1 <= 1.51, 'maxRing=' + maxRing1);
chk('① 四角为暗格', [[0, 0], [0, 11], [7, 0], [7, 11]].every(function (rc) { return L1.m[rc[0]][rc[1]] <= DARK_THR; }),
  JSON.stringify([[0, 0], [0, 11], [7, 0], [7, 11]].map(function (rc) { return Math.round(L1.m[rc[0]][rc[1]]); })));

console.log('===== ② Lv12（48 可用块 · 半铺）=====');
var L12 = matrix('E:/Deepseekdb/.workbuddy/shots/v89142-board-lv12.png');
show(L12.m, 'Lv12');
var lit2 = litCells(L12.m);
var maxRing2 = Math.max.apply(null, lit2.map(ringOf));
console.log('    可用格 ' + lit2.length + ' 个 · 最外环 ' + maxRing2);
chk('② Lv12 可用格 = 48（±2 像素噪声容差）', Math.abs(lit2.length - 48) <= 2, 'n=' + lit2.length);
chk('② Lv12 可用格仍不外扩到最角（最外环 ≤ 3.5）', maxRing2 <= 3.51, 'maxRing=' + maxRing2);

console.log('===== ③ 满级（96 块 · 整网格铺满）=====');
var FU = matrix('E:/Deepseekdb/.workbuddy/shots/v89142-board-full.png');
show(FU.m, '满级');
var lit3 = litCells(FU.m);
chk('③ 满级：96 格全部可用（零暗格）', lit3.length === 96, 'n=' + lit3.length);
chk('③ 满级：棋盘宽高比 ≈ 12:8（12×8 整网格）',
  Math.abs(FU.png.width / FU.png.height - 12 / 8) < 0.06, FU.png.width + '×' + FU.png.height);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
