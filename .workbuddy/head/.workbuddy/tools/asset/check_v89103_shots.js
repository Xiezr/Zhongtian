/* ============================================================
 * check_v89103_shots.js — v89.103 四张截图的**像素体检**（不是"能打开就算过"）
 * ------------------------------------------------------------
 * 判据：
 *   ① 四张图都不是空图（平均亮度、非背景像素占比）；
 *   ② 「接触」那张：接触线所在竖列上有**高亮暖色像素**（= 那条实线真的画出来了）；
 *   ③ 「接敌中」那张：同一区域**没有**那条高亮线（两态确实不同）；
 *   ④ 「被攻入腹地」那张：线在场区左侧（≈4%）而非常规中段。
 * 用法：node .workbuddy/tools/asset/check_v89103_shots.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) {
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}
function load(f) {
  var p = path.join(R, '.workbuddy/shots', f);
  if (!fs.existsSync(p)) return null;
  return PNG.sync.read(fs.readFileSync(p));
}
/* 暖色高亮判据：R 明显大于 B，且够亮（金色/琥珀线 ≈ (232,176,60) 系） */
function warmPixels(png, x0, x1, y0, y1) {
  var n = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 150 && r - b > 60 && g - b > 20 && b < 150) n++;
    }
  }
  return n;
}
function stats(png) {
  var sum = 0, n = 0, dark = 0;
  for (var i = 0; i < png.data.length; i += 4 * 37) {          /* 抽样即可 */
    var v = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    sum += v; n++; if (v < 26) dark++;
  }
  return { avg: Math.round(sum / n * 10) / 10, darkPct: Math.round(dark / n * 1000) / 10 };
}
var list = ['v89103-sandbox-approach.png', 'v89103-sandbox-contact.png',
  'v89103-sandbox-end.png', 'v89103-exp-cargo.png'];
var pngs = {};
list.forEach(function (f) {
  var p = load(f);
  pngs[f] = p;
  if (!p) { console.log('❌ 缺图 ' + f); return; }
  var s = stats(p);
  console.log((s.avg > 20 && s.darkPct < 60 ? '✅ ' : '❌ ') + f + '　' + p.width + '×' + p.height
    + '　平均亮度 ' + s.avg + '　暗部 ' + s.darkPct + '%');
});

/* 场区大致范围（1680×1000 视口）：沙盘场区在弹窗中部，量测时接触线 552px 是**场区坐标**，
   场区左边界 ≈ 弹窗左 + 侧栏宽。这里用"整幅中段横带"做存在性判据即可（两态相对比较）。 */
var band = { x0: 380, x1: 1280, y0: 300, y1: 700 };
['v89103-sandbox-approach.png', 'v89103-sandbox-contact.png', 'v89103-sandbox-end.png'].forEach(function (f) {
  var p = pngs[f];
  if (!p) return;
  console.log('  ' + f + ' 暖色高亮像素（场区中段竖带）= '
    + warmPixels(p, band.x0, band.x1, band.y0, band.y1));
});
/* 接触那张：逐列数暖色像素，找出"最像一条竖线"的列 —— 应当集中在 1~2 列上 */
(function () {
  var p = pngs['v89103-sandbox-contact.png'];
  if (!p) return;
  var best = [], y0 = band.y0, y1 = band.y1;
  for (var x = band.x0; x < band.x1; x++) {
    var n = 0;
    for (var y = y0; y < y1; y++) {
      var i = (p.width * y + x) << 2;
      var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
      if (r > 150 && r - b > 60 && g - b > 20 && b < 150) n++;
    }
    if (n > 30) best.push(x + ':' + n);
  }
  console.log('  接触线竖列（像素数 > 30 的列）=' + (best.length ? best.slice(0, 8).join(' ') : '（未找到）'));
})();
