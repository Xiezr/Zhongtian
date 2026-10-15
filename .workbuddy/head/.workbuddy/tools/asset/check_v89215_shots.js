/* v89.215 像素体检：驻军栏全兵种固定序（有兵城 / 空城全 0）
   判据先量后定：① 两图都非空；② 「有兵」图驻军带里金像素（有兵数量）与灰像素（零行）**同时存在**；
   ③ 「空城」图同带里灰像素显著多、金像素 ≈ 0（全 0 的正确形态）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function near(r, g, b, R, G, B, tol) { return Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol; }
/* 侧栏带：视口 x 20~300（283px 侧栏）· y 640~880（驻军栏区） */
function count(png, R, G, B, tol, x0, x1, y0, y1) {
  var c = 0;
  for (var y = y0; y < Math.min(y1, png.height); y++) {
    for (var x = x0; x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      if (near(png.data[i], png.data[i + 1], png.data[i + 2], R, G, B, tol)) c++;
    }
  }
  return c;
}
var a = read('v89215-garrison.png'), b = read('v89215-garrison-zero.png');
chk('① 两张图都非空', !!a && !!b, (a ? a.width + 'x' + a.height : 'null') + ' / ' + (b ? b.width + 'x' + b.height : 'null'));
if (a && b) {
  /* 金 = #edd08a（--gold-light 实机实测 rgb(237,208,138)）· 灰 = #a8a7af（--text-dim） */
  var goldA = count(a, 237, 208, 138, 22, 20, 300, 600, 900);
  var greyA = count(a, 168, 167, 175, 20, 20, 300, 600, 900);
  var goldB = count(b, 237, 208, 138, 22, 20, 300, 600, 900);
  var greyB = count(b, 168, 167, 175, 20, 20, 300, 600, 900);
  console.log('  有兵城：金=' + goldA + ' 灰=' + greyA + '　空城：金=' + goldB + ' 灰=' + greyB);
  chk('② 有兵城：金（有兵数量）与灰（零行）并存', goldA >= 120 && greyA >= 400, 'gold=' + goldA + ' grey=' + greyA);
  /* ⚠ 侧栏带里还有别的金色（「⚔ 驻军」标题本身是金色）—— 所以判据看**两图之差**：
     差 = 那 4 个有兵数字占的金像素（实测 A-B = 120 ≈ 4 数字 ×30）；空城应把这部分整块交出来。 */
  chk('③ 空城：有兵数字整块转灰（金比有兵城少 ≥60 · 灰更多）',
    (goldA - goldB) >= 60 && greyB > greyA, 'Δgold=' + (goldA - goldB) + ' Δgrey=' + (greyB - greyA));
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
