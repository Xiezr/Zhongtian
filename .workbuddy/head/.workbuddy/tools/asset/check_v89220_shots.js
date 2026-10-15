/* v89.220 像素体检：四张实机图（基因实验室 / 政务厅按钮 / 调运不限 / 拆后升级）
   判据先量后定（均值/亮占比走暗色基线；面板图在弹窗遮罩下）。
   node .workbuddy/tools/asset/check_v89220_shots.js > .workbuddy/tmp/check220shots.txt 2>&1 */
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
function stats(png) {
  var s = 0, n = 0, bright = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    s += L; n++; if (L > 140) bright++;
  }
  return { avg: s / n, brightPct: bright * 100 / n };
}
/* 金色像素（暖金标题/按钮 —— 暗色主题下弹窗标题与主键都是金色） */
function gold(png, x0, x1, y0, y1) {
  var c = 0;
  for (var y = y0; y < Math.min(y1, png.height); y++) {
    for (var x = x0; x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 190 && g > 150 && b < 130 && (r - b) > 60) c++;
    }
  }
  return c;
}
var A = read('v89220-build.png'), B = read('v89220-move.png'), C = read('v89220-farm.png'), D = read('v89220-gov.png');
chk('① 四张图都非空', !!A && !!B && !!C && !!D,
  [A, B, C, D].map(function (x) { return x ? x.width + 'x' + x.height : 'null'; }).join(' / '));
if (A && B && C && D) {
  [['拆后升级', A], ['调运', B], ['基因实验室', C], ['政务厅', D]].forEach(function (pair) {
    var s = stats(pair[1]);
    chk('②' + pair[0] + ' 暗色基线（均亮 15~95 · 亮像素 0.3%~45%）',
      s.avg >= 15 && s.avg <= 95 && s.brightPct >= 0.3 && s.brightPct <= 45,
      'avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(1) + '%');
  });
  /* ③ 弹窗金色（标题/主键）在带内出现 —— 四张图都应有面板（弹窗带 y 120~900） */
  [['拆后升级', A], ['调运', B], ['基因实验室', C], ['政务厅', D]].forEach(function (pair) {
    var g = gold(pair[1], 300, 1300, 100, 950);
    chk('③' + pair[0] + ' 弹窗带金像素 ≥ 300（面板真的画出来了）', g >= 300, 'gold=' + g);
  });
  /* ④ 对照：调运图（不设上限）不得含"红警"字样区域——用暗带差异不可行，改量四图两两不同 */
  var same = 0;
  [['build', A], ['move', B], ['farm', C], ['gov', D]].forEach(function (x, i) {
    [['build', A], ['move', B], ['farm', C], ['gov', D]].forEach(function (y, j) {
      if (i < j) {
        var n = 0, d = 0;
        for (var k = 0; k < Math.min(A.data.length, x[1].data.length); k += 97 * 4) { n++; if (x[1].data[k] !== y[1].data[k]) d++; }
        if (d / n < 0.05) same++;
      }
    });
  });
  chk('④ 四图两两不相同（各截各的场景）', same === 0, '相似对数=' + same);
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
