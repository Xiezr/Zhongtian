'use strict';
/* v156.34 探针：沿 36 条射线量「球体轮廓半径」—— 专门抓"自转时半径闪烁"。
   ------------------------------------------------------------
   关键设计（否则测出来是自转的地表颜色变化，不是半径）：
     · 球心**固定**取第一帧的重心，后续帧沿用 → 只测半径，不测质心漂移
     · 沿射线由外向内找第一个"亮"像素（背景是星空，近黑）→ 得到该方向的轮廓半径
     · 输出每帧的均值 / 极差 / 与首帧的偏差
   用法：node probe_globe_radius.js <dir> [帧数]
   判据：均值跨帧偏差 > 1.5px → 半径真的在变；极差大但均值稳 → 边缘在"毛刺"（z-fight/雾边）
   ------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var path = require('path');
var { PNG } = require('pngjs');

var DIR = process.argv[2] || '.workbuddy/shots/flick';
var TH = 26;          /* 亮度阈值：高于它算"球（含大气雾）" */
var NRAY = 36;

function lumAt(png, x, y) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return 0;
  var i = (y * png.width + x) * 4;
  return 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
}

function probe(file, fixedC) {
  var png = PNG.sync.read(fs.readFileSync(file));
  var cx = fixedC.x, cy = fixedC.y;
  /* 若没给定球心：用亮像素重心（第一帧用） */
  if (cx == null) {
    var sx = 0, sy = 0, n = 0;
    for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
      if (lumAt(png, x, y) > 40) { sx += x; sy += y; n++; }
    }
    cx = sx / n; cy = sy / n;
  }
  var maxR = Math.min(png.width, png.height) * 0.75;
  var rad = [];
  for (var k = 0; k < NRAY; k++) {
    var a = (k / NRAY) * Math.PI * 2;
    var dx = Math.cos(a), dy = Math.sin(a);
    var found = null;
    /* 由外向内：连续 3 个像素都亮才算命中（躲开单点噪点/星空亮星） */
    for (var r = maxR; r > 12; r -= 1) {
      if (lumAt(png, Math.round(cx + dx * r), Math.round(cy + dy * r)) > TH
        && lumAt(png, Math.round(cx + dx * (r - 2)), Math.round(cy + dy * (r - 2))) > TH
        && lumAt(png, Math.round(cx + dx * (r - 4)), Math.round(cy + dy * (r - 4))) > TH) {
        found = r; break;
      }
    }
    if (found != null) rad.push(found);
  }
  var mean = rad.reduce(function (s, v) { return s + v; }, 0) / (rad.length || 1);
  return { cx: cx, cy: cy, mean: mean, min: Math.min.apply(null, rad), max: Math.max.apply(null, rad), n: rad.length };
}

var files = fs.readdirSync(DIR).filter(function (f) { return /^f\d+\.png$/.test(f); }).sort();
if (!files.length) { console.log('目录里没有 f*.png：' + DIR); process.exit(1); }
var first = probe(path.join(DIR, files[0]), { x: null, y: null });
var C = { x: first.cx, y: first.cy };
console.log('球心固定 (' + C.x.toFixed(0) + ', ' + C.y.toFixed(0) + ')   射线 ' + NRAY + ' 条   阈值 ' + TH);
console.log('\n帧    均值半径   最小   最大   极差   与首帧')
var means = [];
files.forEach(function (f, i) {
  var r = probe(path.join(DIR, f), C);
  means.push(r.mean);
  console.log(' ' + String(i + 1).padStart(2) + '   ' + r.mean.toFixed(1).padStart(7)
    + String(r.min).padStart(7) + String(r.max).padStart(7)
    + String(r.max - r.min).padStart(7)
    + (i === 0 ? '      —' : ('  ' + (r.mean - first.mean >= 0 ? '+' : '') + (r.mean - first.mean).toFixed(1))).padStart(9));
});
var mn = Math.min.apply(null, means), mx = Math.max.apply(null, means);
console.log('\n均值半径 ' + mn.toFixed(1) + ' ~ ' + mx.toFixed(1)
  + '（跨度 ' + (mx - mn).toFixed(1) + 'px = ' + ((mx - mn) / mn * 100).toFixed(2) + '%）');
