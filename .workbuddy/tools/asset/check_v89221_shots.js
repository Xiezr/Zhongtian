/* v89.221 像素体检：创建 chip 标签 / 任务页签闪烁（两帧对照）/ 车库行 / 任务视图
   判据先量后定（实测值写在注释里）。 */
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
  var s = 0, n = 0, b = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    s += L; n++; if (L > 140) b++;
  }
  return { avg: s / n, brightPct: b * 100 / n };
}
/* 逐行投影数"文字行数"（该行亮像素 ≥ 行宽×0.4% 记一行） */
function textRows(png) {
  var rows = 0;
  for (var y = 0; y < png.height; y++) {
    var b = 0;
    for (var x = 0; x < png.width; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 140) b++;
    }
    if (b >= Math.max(6, png.width * 0.004)) rows++;
  }
  return rows;
}
var A = read('v89221-create.png'), B = read('v89221-nav1.png'), C = read('v89221-nav2.png');
var D = read('v89221-build.png'), F = read('v89221-tasks.png');

chk('① 五张图都非空', !!(A && B && C && D && F),
  [A, B, C, D, F].map(function (x) { return x ? x.width + 'x' + x.height : 'null'; }).join(' / '));

if (A && B && C && D && F) {
  /* ② 创建界面：暗色基线 + 有内容（实测 42.1 / 1.31%） */
  var sa = stats(A);
  chk('② 创建界面基线（均亮 20~90 · 亮 0.3%~40%）', sa.avg >= 20 && sa.avg <= 90 && sa.brightPct >= 0.3 && sa.brightPct <= 40,
    'avg=' + sa.avg.toFixed(1) + ' bright=' + sa.brightPct.toFixed(2) + '%');
  chk('②b 创建界面有文字行（chip/标题等 ≥ 5 行）', textRows(A) >= 5, 'rows=' + textRows(A));

  /* ③ 任务页签闪烁：两帧（0.76s 间隔，docBlink 周期 1.5s）应有可见差异 */
  var diff = 0;
  if (B.width === C.width && B.height === C.height) {
    for (var i = 0; i < B.data.length; i += 4) {
      var d = Math.abs(B.data[i] - C.data[i]) + Math.abs(B.data[i + 1] - C.data[i + 1]) + Math.abs(B.data[i + 2] - C.data[i + 2]);
      if (d > 60) diff++;
    }
  }
  chk('③ 任务页签两帧有差（闪烁的铁证 · 差异像素 ≥ 40）', diff >= 40, 'diff=' + diff + ' (' + B.width + 'x' + B.height + ')');

  /* ④ 车库解锁行：面板里有文字行（实测行投影） */
  chk('④ 建筑面板截图有文字行（车库解锁行在页面内 ≥ 5 行）', textRows(D) >= 5, 'rows=' + textRows(D));

  /* ⑤ 任务视图：暗色基线 + 文字行 */
  var sf = stats(F);
  chk('⑤ 任务视图基线（均亮 20~90 · 亮 0.3%~40%）', sf.avg >= 20 && sf.avg <= 90 && sf.brightPct >= 0.3 && sf.brightPct <= 40,
    'avg=' + sf.avg.toFixed(1) + ' bright=' + sf.brightPct.toFixed(2) + '%');
  chk('⑤b 任务视图有文字行（任务卡 ≥ 8 行）', textRows(F) >= 8, 'rows=' + textRows(F));
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
