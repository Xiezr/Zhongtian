'use strict';
/* v157.68 前/后同状态对照的像素证据：三档 → 两态后，
 * 「中间亮度带」占比应显著下降（旧 0.78 中间档 / 0.10 半强加亮层消失）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var PNG = require('pngjs').PNG;
var fs = require('fs');
var path = require('path');
var S = 'E:/Deepseekdb/.workbuddy/shots';

function stat(file, label) {
  var png = PNG.sync.read(fs.readFileSync(path.join(S, file)));
  /* 只取画布中央地表区，排除顶栏/底栏/左右球缘 */
  var x0 = 300, x1 = 980, y0 = 130, y1 = 660;
  var lum = [], n = 0, dark = 0, mid = 0, bright = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (png.width * y + x) << 2;
    var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    lum.push(L); n++;
    if (L < 70) dark++; else if (L < 125) mid++; else bright++;
  }
  var mean = lum.reduce(function (a, b) { return a + b; }, 0) / n;
  var sd = Math.sqrt(lum.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n);
  /* 16 档直方图 */
  var h = new Array(16).fill(0);
  lum.forEach(function (L) { h[Math.min(15, Math.floor(L / 16))]++; });
  console.log(label + ' | n=' + n + ' mean=' + mean.toFixed(1) + ' sd=' + sd.toFixed(1)
    + ' | dark(<70)=' + (dark * 100 / n).toFixed(1) + '%'
    + ' mid(70-125)=' + (mid * 100 / n).toFixed(1) + '%'
    + ' bright(>=125)=' + (bright * 100 / n).toFixed(1) + '%');
  console.log(label + ' hist16=' + h.map(function (v) { return (v * 100 / n).toFixed(1); }).join(','));
  return { mid: mid * 100 / n, sd: sd };
}
var b = stat('v15768-BEFORE-fogclean.png', 'BEFORE');
var a = stat('v15768-AFTER-fogclean.png', 'AFTER ');
console.log('DELTA mid=' + (a.mid - b.mid).toFixed(1) + 'pp  sd=' + (a.sd - b.sd).toFixed(1));
