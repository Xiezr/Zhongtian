'use strict';
/* v156.34 探针：两帧差异的**空间分布** —— 判断"闪"发生在轮廓还是在面上。
   输出：① 差异总量 ② 按"到球心距离/R"分桶的差异像素占比 ③ 一张放大差异图。
   判据：差异集中在 r/R ∈ [0.95, 1.15] → 轮廓/大气边缘在闪（不是地表）；
        分散在 r/R < 0.9 → 地表明暗在闪（着色/排序）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var { PNG } = require('pngjs');

var A = process.argv[2] || '.workbuddy/shots/flick/f01.png';
var B = process.argv[3] || '.workbuddy/shots/flick/f02.png';
var OUT = process.argv[4] || '.workbuddy/shots/flick/diff.png';
var TH = Number(process.argv[5] || 18);

var pa = PNG.sync.read(fs.readFileSync(A));
var pb = PNG.sync.read(fs.readFileSync(B));
if (pa.width !== pb.width || pa.height !== pb.height) { console.log('尺寸不一致'); process.exit(1); }
var w = pa.width, h = pa.height;

/* 球心：用"够亮"的像素重心近似（星空很暗，几乎不影响） */
var sx = 0, sy = 0, n = 0;
for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
  var i = (y * w + x) * 4;
  var lum = 0.299 * pa.data[i] + 0.587 * pa.data[i + 1] + 0.114 * pa.data[i + 2];
  if (lum > 40) { sx += x; sy += y; n++; }
}
var cx = sx / n, cy = sy / n;
/* R：亮像素到球心的 98 分位（避开零星噪点） */
var ds = [];
for (var y2 = 0; y2 < h; y2 += 2) for (var x2 = 0; x2 < w; x2 += 2) {
  var i2 = (y2 * w + x2) * 4;
  var l2 = 0.299 * pa.data[i2] + 0.587 * pa.data[i2 + 1] + 0.114 * pa.data[i2 + 2];
  if (l2 > 40) ds.push(Math.hypot(x2 - cx, y2 - cy));
}
ds.sort(function (a, b) { return a - b; });
var R98 = ds[Math.floor(ds.length * 0.98)] || 1;

var diff = new PNG({ width: w, height: h });
var total = 0;
var buckets = { '<0.80': 0, '0.80-0.95': 0, '0.95-1.00': 0, '1.00-1.08': 0, '1.08-1.20': 0, '>1.20': 0 };
for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
  var k = (yy * w + xx) * 4;
  var d = Math.max(
    Math.abs(pa.data[k] - pb.data[k]),
    Math.abs(pa.data[k + 1] - pb.data[k + 1]),
    Math.abs(pa.data[k + 2] - pb.data[k + 2]));
  if (d > TH) {
    total++;
    var rr = Math.hypot(xx - cx, yy - cy) / R98;
    if (rr < 0.80) buckets['<0.80']++;
    else if (rr < 0.95) buckets['0.80-0.95']++;
    else if (rr < 1.00) buckets['0.95-1.00']++;
    else if (rr < 1.08) buckets['1.00-1.08']++;
    else if (rr < 1.20) buckets['1.08-1.20']++;
    else buckets['>1.20']++;
    diff.data[k] = 255; diff.data[k + 1] = 40; diff.data[k + 2] = 40; diff.data[k + 3] = 255;
  } else {
    var g = Math.round(0.299 * pb.data[k] + 0.587 * pb.data[k + 1] + 0.114 * pb.data[k + 2]) * 0.30;
    diff.data[k] = diff.data[k + 1] = diff.data[k + 2] = g; diff.data[k + 3] = 255;
  }
}
fs.writeFileSync(OUT, PNG.sync.write(diff));

console.log('帧 ' + A.split(/[\\/]/).pop() + ' → ' + B.split(/[\\/]/).pop() + '   阈值 ' + TH);
console.log('球心 (' + cx.toFixed(0) + ', ' + cy.toFixed(0) + ')   R98=' + R98.toFixed(1) + 'px');
console.log('差异像素 ' + total + ' / ' + (w * h) + ' = ' + (total / (w * h) * 100).toFixed(2) + '%');
Object.keys(buckets).forEach(function (k) {
  var v = buckets[k];
  console.log('  r/R ' + k.padEnd(10) + ' ' + String(v).padStart(7)
    + '  ' + (total ? (v / total * 100).toFixed(1).padStart(5) : '  0.0') + '%');
});
console.log('差异图 ' + OUT);
