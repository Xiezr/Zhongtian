'use strict';
/* v157.68 像素取证：老板截图 vs 各候选视图的颜色构成 + 放大中央块。
 * 模型读图有限时，用直方图与"浅灰蓝斑块在深蓝底内的分布"当眼睛。
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var PNG = require('pngjs').PNG;
var fs = require('fs');
var path = require('path');
var ROOT = 'E:/Deepseekdb';
var OUT = path.join(ROOT, '.workbuddy/tmp/shot_v15768_pixel.log');
var lines = [];
function log(s) { lines.push(String(s)); console.log(s); }

function classify(r, g, b) {
  if (r < 26 && g < 26 && b < 36) return 'black';
  if (b > r + 18 && b > g + 4 && r < 95 && b < 165) return 'deepblue';       /* 深蓝雾/海 */
  if (r >= 95 && r <= 205 && g >= 100 && g <= 210 && b >= 115 && b <= 225
      && Math.abs(r - g) < 45 && b >= r - 12) return 'paleblue';              /* 浅灰蓝碎斑 */
  if (g > r * 1.22 && g > b * 1.12 && g > 65) return 'green';
  if (r > 145 && g > 85 && b < 115 && r > b + 55) return 'orange';            /* 橙黄小点/沙 */
  if (r > 115 && g > 100 && b < 145 && r >= g) return 'tan';
  return 'other';
}

function stat(file, label, crop) {
  var buf = fs.readFileSync(file);
  var png = PNG.sync.read(buf);
  var x0 = crop ? crop[0] : 0, y0 = crop ? crop[1] : 0;
  var x1 = crop ? Math.min(png.width, crop[2]) : png.width;
  var y1 = crop ? Math.min(png.height, crop[3]) : png.height;
  var c = {}, total = 0;
  /* 浅灰蓝像素的空间聚集度：把图分 16x12 网格，统计"含灰蓝的格子"数量 */
  var gx = 16, gy = 12, hit = {}, hits = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (png.width * y + x) << 2;
    var k = classify(png.data[i], png.data[i + 1], png.data[i + 2]);
    c[k] = (c[k] || 0) + 1; total++;
    if (k === 'paleblue') {
      var bx = Math.floor((x - x0) / Math.max(1, (x1 - x0) / gx));
      var by = Math.floor((y - y0) / Math.max(1, (y1 - y0) / gy));
      var key = bx + ',' + by;
      if (!hit[key]) { hit[key] = 1; hits++; }
    }
  }
  var pct = {};
  Object.keys(c).forEach(function (k) { pct[k] = +(c[k] * 100 / total).toFixed(1); });
  log(label + ' | ' + png.width + 'x' + png.height + ' | ' + JSON.stringify(pct) + ' | paleblueCells=' + hits + '/' + (gx * gy));
  return { png: png, pct: pct, hits: hits };
}

var boss = 'C:/Users/18811/.workbuddy/clipboard-images/clipboard-2026-11-15T13-08-41-476Z-6938fe4e.png';
log('=== BOSS ===');
stat(boss, 'BOSS 原图');
/* 放大 3 倍供肉眼复核结构（最近邻，不插值，避免糊掉碎斑边缘） */
var b0 = PNG.sync.read(fs.readFileSync(boss));
var up = new PNG({ width: b0.width * 3, height: b0.height * 3 });
for (var y = 0; y < up.height; y++) for (var x = 0; x < up.width; x++) {
  var si = (b0.width * Math.floor(y / 3) + Math.floor(x / 3)) << 2;
  var di = (up.width * y + x) << 2;
  up.data[di] = b0.data[si]; up.data[di + 1] = b0.data[si + 1];
  up.data[di + 2] = b0.data[si + 2]; up.data[di + 3] = 255;
}
fs.writeFileSync(path.join(ROOT, '.workbuddy/shots/v15768-BOSS-x3.png'), PNG.sync.write(up));
log('放大图 -> .workbuddy/shots/v15768-BOSS-x3.png');

log('=== 候选视图（只统计画布中间区域，排除顶栏/底栏 UI）===');
var S = path.join(ROOT, '.workbuddy/shots');
var list = [
  ['A-3d-now', 'A 3D 现状'], ['B-3d-alllit', 'B 3D 全明'],
  ['C-3d-nofogmesh', 'C 3D 隐藏层'], ['D-2d-now', 'D 2D 方格图'],
  ['E-ground-now', 'E 贴地现状'], ['F-ground-nosky', 'F 贴地无云'],
  ['J-fogmix-now', 'J 混合分档'], ['K-fogmix-noadd', 'K 无加亮层'],
  ['L-fogmix-clean', 'L 无加亮无云'], ['M-alllit-clean', 'M 全明干净']
];
list.forEach(function (it) {
  var f = path.join(S, 'v15768-' + it[0] + '.png');
  if (fs.existsSync(f)) stat(f, it[1], [240, 90, 1030, 690]);
});
fs.writeFileSync(OUT, lines.join('\n') + '\n');
