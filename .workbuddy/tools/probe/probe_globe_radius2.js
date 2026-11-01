'use strict';
/* v156.34 探针：**轮廓半径的帧间抖动**（固定球心，按方向逐条算 std）
   ------------------------------------------------------------
   为什么这样量：
     球体半径在画面上 ≈ 350px；大气雾/云/星空杂物会让射线打到更远的地方。
     所以先把"明显不是球面"的读数（r 超出 300~430）剔掉，再看**同一方向**的半径
     跨帧抖动 std。自转本身不改变圆，若 std 明显，就一定是边缘那块几何/雾在动。
   ------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var path = require('path');
var { PNG } = require('pngjs');

var DIR = process.argv[2] || '.workbuddy/shots/flick';
var TH = 26, NRAY = 72, LO = 300, HI = 430;

function lumAt(png, x, y) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return 0;
  var i = (y * png.width + x) * 4;
  return 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
}
function centroid(png) {
  var sx = 0, sy = 0, n = 0;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
    if (lumAt(png, x, y) > 40) { sx += x; sy += y; n++; }
  }
  return { x: sx / n, y: sy / n };
}
/* 单帧：每个方向的"最外层亮像素"半径 */
function radii(png, C) {
  var out = [];
  var maxR = HI + 40;
  for (var k = 0; k < NRAY; k++) {
    var a = (k / NRAY) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    var found = null;
    for (var r = maxR; r > LO - 40; r -= 1) {
      if (lumAt(png, Math.round(C.x + dx * r), Math.round(C.y + dy * r)) > TH
        && lumAt(png, Math.round(C.x + dx * (r - 2)), Math.round(C.y + dy * (r - 2))) > TH
        && lumAt(png, Math.round(C.x + dx * (r - 4)), Math.round(C.y + dy * (r - 4))) > TH) { found = r; break; }
    }
    out.push(found);
  }
  return out;
}

var files = fs.readdirSync(DIR).filter(function (f) { return /^f\d+\.png$/.test(f); }).sort();
var pngs = files.map(function (f) { return PNG.sync.read(fs.readFileSync(path.join(DIR, f))); });
var C = centroid(pngs[0]);
var series = pngs.map(function (p) { return radii(p, C); });

var stds = [], used = 0;
for (var k = 0; k < NRAY; k++) {
  var vs = [];
  for (var i = 0; i < series.length; i++) {
    var v = series[i][k];
    if (v != null && v >= LO && v <= HI) vs.push(v);
  }
  if (vs.length < Math.max(3, series.length - 1)) continue;   /* 这条路大多帧没量到 → 不做统计 */
  used++;
  var m = vs.reduce(function (s, x) { return s + x; }, 0) / vs.length;
  var sd = Math.sqrt(vs.reduce(function (s, x) { return s + Math.pow(x - m, 2); }, 0) / vs.length);
  stds.push({ k: k, deg: Math.round(k * 360 / NRAY), mean: m, sd: sd, min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) });
}
stds.sort(function (a, b) { return b.sd - a.sd; });
console.log('帧数 ' + series.length + '   有效方向 ' + used + '/' + NRAY + '   球心 ('
  + C.x.toFixed(0) + ',' + C.y.toFixed(0) + ')');
console.log('\n抖动最大的 10 个方向（std 单位 px）：');
console.log('  角度    均值半径    std    最小   最大');
stds.slice(0, 10).forEach(function (s) {
  console.log('  ' + String(s.deg).padStart(4) + '°  ' + s.mean.toFixed(1).padStart(8)
    + '  ' + s.sd.toFixed(2).padStart(6) + '  ' + String(s.min).padStart(5) + '  ' + String(s.max).padStart(5));
});
var allStd = stds.map(function (s) { return s.sd; });
var avg = allStd.reduce(function (a, b) { return a + b; }, 0) / (allStd.length || 1);
var bad = stds.filter(function (s) { return s.sd >= 1.5; }).length;
console.log('\n平均 std ' + avg.toFixed(2) + 'px   std≥1.5px 的方向 ' + bad + '/' + stds.length);
console.log(bad ? '→ 轮廓**确实在抖**（同一方向半径逐帧不同）' : '→ 轮廓稳定（抖动在亚像素级，属正常抗锯齿）');
