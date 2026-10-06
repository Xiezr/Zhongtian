/* v89.209 像素体检：三张实机图（先量后定 —— 判据来自 dump209pix 实测）
   ① 三图非空 + 暗色基线（项目 §12.5 基线：avg 20~60 · bright 0.8%~6%）
   ② toast 带（y130~180 · x300~1300）真的有文字亮像素（≥800 —— 实测 2312/2312/2603）
   ③ 对照：ok 版面板头带（y160~200）亮像素 ≥ reject 版 ×1.8（实测 ≈3.3×）——
     证明"导入成功（槽位摘要重绘）"与"拒绝（粘贴框保留）"是两种可区分的终态 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function band(png, y0, y1, x0, x1) {
  var c = 0, n = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (y * png.width + x) * 4;
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    n++; if (L > 90) c++;
  }
  return { bright: c, n: n };
}
function stats(png) {
  var s = 0, n = 0, b = 0;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
    var i = (y * png.width + x) * 4;
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    s += L; n++; if (L > 90) b++;
  }
  return { avg: s / n, brightPct: b / n * 100 };
}

var files = ['v89209-import-reject.png', 'v89209-import-ok.png', 'v89209-load-reject.png'];
var all = {};
files.forEach(function (f) {
  var png = read(f);
  if (!png) { chk('① ' + f + ' 在册（非空图）', false, '缺图'); return; }
  var st = stats(png);
  all[f] = { png: png, st: st, toast: band(png, 130, 180, 300, 1300), head: band(png, 160, 200, 300, 1300) };
  chk('① ' + f + '：非空 + 暗色基线（avg=' + st.avg.toFixed(1) + ' · bright=' + st.brightPct.toFixed(2) + '%）',
    st.avg > 20 && st.avg < 60 && st.brightPct > 0.8 && st.brightPct < 6);
});
Object.keys(all).forEach(function (f) {
  chk('② ' + f + '：toast 带真画出来（亮=' + all[f].toast.bright + ' ≥ 800）',
    all[f].toast.bright >= 800);
});
if (all['v89209-import-ok.png'] && all['v89209-import-reject.png']) {
  var okB = all['v89209-import-ok.png'].head.bright;
  var rjB = all['v89209-import-reject.png'].head.bright;
  chk('③ ok vs reject 面板头带可区分（' + okB + ' ≥ ' + rjB + '×1.8 · 实测比 '
    + (okB / Math.max(1, rjB)).toFixed(2) + '×）',
    okB >= rjB * 1.8);
}

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
