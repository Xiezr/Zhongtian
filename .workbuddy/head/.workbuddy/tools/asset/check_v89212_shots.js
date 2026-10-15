/* v89.212 像素体检：四图（资源悬停 / 仓库面板 / 城外面板 / 出征面板）
   判据先量后定（源数据见交付文档「像素基线」表）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) {
  try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; }
}
function stats(png, x0, y0, x1, y1) {
  var n = 0, s = 0, bright = 0, gold = 0;
  for (var y = Math.max(0, y0); y < Math.min(y1, png.height); y++) {
    for (var x = Math.max(0, x0); x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      s += L; n++;
      if (L > 90) bright++;
      if (r > 150 && g > 110 && b < 130 && r - b > 40) gold++;
    }
  }
  return { avg: s / n, bpct: bright / n * 100, gold: gold };
}
function textRows(png, x0, y0, x1, y1) {
  var rows = 0, inRow = false;
  for (var y = y0; y < Math.min(y1, png.height); y++) {
    var c = 0;
    for (var x = x0; x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    var t = c > (x1 - x0) * 0.004;
    if (t && !inRow) { rows++; inRow = true; }
    if (!t) inRow = false;
  }
  return rows;
}

/* ① 资源悬停图（侧栏出文本 + tip 浮层） */
(function () {
  var png = read('v89212-res.png');
  if (!png) return chk('① 资源悬停（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 30, 300, 260, 990);
  console.log('    [res] 均亮=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2) + ' 侧栏带行=' + rows);
  chk('①a 资源悬停：画面正常（暗色基线 + 侧栏文本）',
    all.avg > 30 && all.avg < 70 && all.bpct > 3 && all.bpct < 16, 'avg=' + all.avg.toFixed(1));
  chk('①b 侧栏资源区文本行 ≥10（18 实测 · 含 tip 浮层）', rows >= 10, 'rows=' + rows);
})();

/* ② 仓库面板（四行各显各的上限） */
(function () {
  var png = read('v89212-store.png');
  if (!png) return chk('② 仓库面板（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 300, 100, 1300, 950);
  console.log('    [store] 均亮=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2) + ' 中央带行=' + rows + ' 金=' + all.gold);
  chk('②a 仓库面板：暗色基线（面板真的渲染了）',
    all.avg > 18 && all.avg < 55 && all.bpct > 0.8 && all.bpct < 6, 'avg=' + all.avg.toFixed(1));
  chk('②b 中央带文本行 ≥8（14 实测 · 标题/四行/提示）', rows >= 8, 'rows=' + rows);
})();

/* ③ 城外面板（按归属资源） */
(function () {
  var png = read('v89212-ext.png');
  if (!png) return chk('③ 城外面板（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 300, 100, 1300, 950);
  console.log('    [ext] 均亮=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2) + ' 中央带行=' + rows + ' 金=' + all.gold);
  chk('③a 城外面板：画面正常 + 金色要素在册（金 ≥4000 · 实测 32995）',
    all.avg > 20 && all.avg < 55 && all.gold >= 4000, 'avg=' + all.avg.toFixed(1) + ' gold=' + all.gold);
  chk('③b 中央带文本行 ≥6（12 实测）', rows >= 6, 'rows=' + rows);
})();

/* ④ 出征面板（行序重排后） */
(function () {
  var png = read('v89212-exp.png');
  if (!png) return chk('④ 出征面板（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 250, 100, 1350, 950);
  console.log('    [exp] 均亮=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2) + ' 中央带行=' + rows);
  chk('④a 出征面板：画面正常（左列七行 + 右列兵种表）',
    all.avg > 28 && all.avg < 65 && all.bpct > 1.5 && all.bpct < 8, 'avg=' + all.avg.toFixed(1));
  chk('④b 中央带文本行 ≥15（30 实测 · 七模块行 + 兵种表）', rows >= 15, 'rows=' + rows);
})();

console.log('');
console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
