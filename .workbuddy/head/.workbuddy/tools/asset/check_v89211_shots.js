/* v89.211 像素体检：装备显示对照 / 占城视图 / 器械提交（先量后定）
   ------------------------------------------------------------
   判据来源（改前实测）：
     eq-plus10 亮%=3.43（中央 3.06）· eq-plus0 亮%=2.99（中央 2.40）——
     "+10" 标签与更宽数字带来可分辨的墨量差 → ①c 对照断言。
     city 亮%=7.25 中央 9.56 rows=13；train 亮%=1.54 中央 1.60 rows=25。
   ------------------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function stats(png, x0, y0, x1, y1) {
  var n = 0, s = 0, bright = 0, gold = 0;
  for (var y = y0; y < Math.min(y1, png.height); y++) for (var x = x0; x < Math.min(x1, png.width); x++) {
    var i = (y * png.width + x) * 4;
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    s += L; n++;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 130 && r - b > 40) gold++;
  }
  return { avg: s / n, bright: bright, bpct: bright / n * 100, gold: gold };
}
function textRows(png, x0, y0, x1, y1, thr) {
  var rows = 0, inRow = false;
  for (var y = y0; y < Math.min(y1, png.height); y++) {
    var c = 0;
    for (var x = x0; x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    var isText = c > (x1 - x0) * (thr || 0.004);
    if (isText && !inRow) { rows++; inRow = true; }
    if (!isText) inRow = false;
  }
  return rows;
}

/* ① 装备显示对照 */
(function () {
  var a = read('v89211-eq-plus10.png'), b = read('v89211-eq-plus0.png');
  if (!a || !b) return chk('① 装备图（缺图）', false);
  var aa = stats(a, 0, 0, a.width, a.height), bb = stats(b, 0, 0, b.width, b.height);
  console.log('    [+10] avg=' + aa.avg.toFixed(1) + ' 亮%=' + aa.bpct.toFixed(2)
    + '  [+0] avg=' + bb.avg.toFixed(1) + ' 亮%=' + bb.bpct.toFixed(2));
  chk('①a +10 面板渲染正常（暗色基线 + 内容在）',
    aa.avg > 25 && aa.avg < 75 && aa.bpct > 1 && aa.bpct < 8,
    'avg=' + aa.avg.toFixed(1) + ' bpct=' + aa.bpct.toFixed(2));
  chk('①b +0 面板渲染正常', bb.avg > 25 && bb.avg < 75 && bb.bpct > 1 && bb.bpct < 8,
    'avg=' + bb.avg.toFixed(1) + ' bpct=' + bb.bpct.toFixed(2));
  chk('①c 对照：+10 墨量多于 +0（+10 标签 + 更宽数值）',
    aa.bpct > bb.bpct * 1.05, '+' + (aa.bpct - bb.bpct).toFixed(2) + '%');
})();

/* ② 占城视图 */
(function () {
  var png = read('v89211-city.png');
  if (!png) return chk('② 城市图（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 300, 150, 1300, 900);
  console.log('    [city] avg=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2) + ' rows=' + rows);
  chk('②a 城市视图渲染（内容行 ≥ 8 · 亮域在带）',
    all.avg > 20 && all.avg < 80 && rows >= 8, 'rows=' + rows + ' avg=' + all.avg.toFixed(1));
})();

/* ③ 器械提交面板 */
(function () {
  var png = read('v89211-train.png');
  if (!png) return chk('③ 器械图（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 500, 200, 1100, 850);
  console.log('    [train] avg=' + all.avg.toFixed(1) + ' 亮%=' + all.bpct.toFixed(2)
    + ' 金=' + all.gold + ' rows=' + rows);
  chk('③a 器械面板渲染（行 ≥ 8 · 有金色 UI）',
    all.avg > 8 && all.avg < 80 && rows >= 8 && all.gold > 300,
    'rows=' + rows + ' gold=' + all.gold);
})();

/* ④ 尺寸 */
(function () {
  var ok = true, got = [];
  ['v89211-eq-plus10.png', 'v89211-eq-plus0.png', 'v89211-city.png', 'v89211-train.png'].forEach(function (f) {
    var png = read(f);
    if (!png || png.width !== 1600 || png.height !== 1000) ok = false;
    if (png) got.push(f.replace('v89211-', '').replace('.png', '') + ':' + png.width + 'x' + png.height);
  });
  chk('④ 四图尺寸 1600×1000', ok, got.join(' '));
})();

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
