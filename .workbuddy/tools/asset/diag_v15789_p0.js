/* v15789 P0 诊断：改前/改后分块差异热区 + 陆地ROI局部对比度
   目的：判断"起伏明暗"到底作用在哪些像素上，是否只在水面/云层噪声上打转。 */
const fs = require('fs');
const { PNG } = require('pngjs');
const DIR = '.workbuddy/tmp/';
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
const B = {}, A = {};
['a', 'b', 'c'].forEach(t => { B[t] = load(DIR + 'v15789_p0_before_' + t + '.png'); A[t] = load(DIR + 'v15789_p0_after_' + t + '.png'); });

const t = 'b', W = B[t].width;
const X0 = 300, X1 = 800, Y0 = 90, Y1 = 540, BLK = 50;
console.log('=== 分块平均|差|（view b · 数值×10）===');
for (let y = Y0; y < Y1; y += BLK) {
  let row = '';
  for (let x = X0; x < X1; x += BLK) {
    let s = 0, n = 0;
    for (let yy = y; yy < Math.min(y + BLK, Y1); yy++) for (let xx = x; xx < Math.min(x + BLK, X1); xx++) {
      const o = (yy * W + xx) * 4;
      const lb = 0.2126 * B[t].data[o] + 0.7152 * B[t].data[o + 1] + 0.0722 * B[t].data[o + 2];
      const la = 0.2126 * A[t].data[o] + 0.7152 * A[t].data[o + 1] + 0.0722 * A[t].data[o + 2];
      s += Math.abs(la - lb); n++;
    }
    const v = Math.round(s / n * 10);
    row += (v < 10 ? '  ' + v : v < 100 ? ' ' + v : '' + v) + ' ';
  }
  console.log('y=' + String(y).padStart(3) + ' ' + row);
}

/* 陆地 ROI：高原/山地（view b 的北部大陆）· 只比"局部对比度" */
function grad(png, x0, x1, y0, y1) {
  let g = 0, n = 0;
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const o = (y * png.width + x) * 4, orr = o + 4, ol = o - 4, od = o + png.width * 4, ou = o - png.width * 4;
    const L = i => 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    g += Math.abs(L(orr) - L(ol)) + Math.abs(L(od) - L(ou)); n++;
  }
  return g / n;
}
function sd(png, x0, x1, y0, y1) {
  let s = 0, s2 = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = (y * png.width + x) * 4;
    const L = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
    s += L; s2 += L * L; n++;
  }
  const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m));
}
const ROIS = [
  ['北部大陆(山地)', 400, 690, 120, 250],
  ['东南大陆(沙漠)', 600, 740, 270, 400],
  ['全陆块(粗)', 350, 760, 110, 460]
];
console.log('\n=== 陆地 ROI：grad（局部对比度）· sd（明暗离散度）===');
ROIS.forEach(([nm, x0, x1, y0, y1]) => {
  const gb = grad(B[t], x0, x1, y0, y1), ga = grad(A[t], x0, x1, y0, y1);
  const sb = sd(B[t], x0, x1, y0, y1), sa = sd(A[t], x0, x1, y0, y1);
  console.log(nm.padEnd(18) + ' grad ' + gb.toFixed(2) + ' → ' + ga.toFixed(2) +
    ' (' + (((ga - gb) / gb) * 100).toFixed(1) + '%)   sd ' + sb.toFixed(2) + ' → ' + sa.toFixed(2) +
    ' (' + (((sa - sb) / sb) * 100).toFixed(1) + '%)');
});
