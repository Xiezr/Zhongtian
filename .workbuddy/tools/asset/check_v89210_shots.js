/* v89.210 像素体检：键盘流 / 状态条 / 战前推演 / 睡眠等价
   ------------------------------------------------------------
   判据全部按"先量后定"（改前已 dump 五图分布，阈值留余量 · 护目的不赌精确）：
   · sky（#nav-sky 元素图）：chips 有真色块（红 ≥120 · 金 ≥120 = 民心/来犯 chip 真画出来）
   · kbd（存档弹窗）：暗色面板基线 + 金（按钮）+ 文字行 ≥6
   · sim（推演弹窗 · 遮罩态）：中央带文字行 ≥4 + 金（标题/数值）
   · back（弹栈回出兵面板）：文字行 ≥15（大面板回来了）
   · 对照：back 均亮 − sim 均亮 ≥ 8（关预览 = 遮罩消失）
   · night（离线纪要弹窗）：中央带文字行 ≥3 + 金在册
   ------------------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
function read(f) {
  try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; }
}
function stats(png, x0, y0, x1, y1) {
  var n = 0, s = 0, bright = 0, gold = 0, red = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (y * png.width + x) * 4;
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    s += L; n++;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 130 && r - b > 40) gold++;
    if (r > 140 && r - g > 55 && r - b > 55) red++;
  }
  return { avg: s / n, brightPct: bright / n * 100, gold: gold, red: red };
}
function textRows(png, x0, y0, x1, y1) {
  var rows = 0, inRow = false;
  for (var y = y0; y < y1; y++) {
    var c = 0;
    for (var x = x0; x < x1; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    var isText = c > (x1 - x0) * 0.004;
    if (isText && !inRow) { rows++; inRow = true; }
    if (!isText) inRow = false;
  }
  return rows;
}

/* ① 状态条（#nav-sky 元素图） */
(function () {
  var png = read('v89210-sky.png');
  if (!png) return chk('① 状态条（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  console.log('    [sky] ' + png.width + 'x' + png.height + ' avg=' + all.avg.toFixed(1)
    + ' 金=' + all.gold + ' 红=' + all.red);
  chk('①a 状态条元素图非空（' + png.width + 'x' + png.height + ' 均亮 ' + all.avg.toFixed(1) + '）',
    png.width >= 300 && png.height >= 28 && all.avg > 30 && all.avg < 80);
  chk('①b chips 真画出来（民心红 ≥120 · 来犯金 ≥120）', all.red >= 120 && all.gold >= 120,
    '红=' + all.red + ' 金=' + all.gold);
})();

/* ② 键盘流弹窗（存档面板 · 焦点在册） */
(function () {
  var png = read('v89210-kbd.png');
  if (!png) return chk('② 键盘流弹窗（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 20, 20, png.width - 20, png.height - 20);
  console.log('    [kbd] ' + png.width + 'x' + png.height + ' avg=' + all.avg.toFixed(1)
    + ' 金=' + all.gold + ' rows=' + rows);
  chk('② 存档面板真渲染（暗色基线 + 金按钮 + 文字行 ' + rows + '）',
    all.avg > 30 && all.avg < 70 && all.brightPct > 1 && all.gold >= 1500 && rows >= 6);
})();

/* ③ 推演弹窗（遮罩态） */
var simAvg = null;
(function () {
  var png = read('v89210-sim.png');
  if (!png) return chk('③ 推演弹窗（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  simAvg = all.avg;
  var rows = textRows(png, 550, 250, 1050, 800);
  console.log('    [sim] avg=' + all.avg.toFixed(1) + ' 金=' + all.gold + ' rows=' + rows);
  chk('③ 推演弹窗真渲染（中央带文字行 ' + rows + ' · 金 ' + all.gold + '）',
    all.avg > 15 && all.avg < 45 && rows >= 4 && all.gold >= 150);
})();

/* ④ 弹栈回出兵面板 */
var backAvg = null;
(function () {
  var png = read('v89210-back.png');
  if (!png) return chk('④ 弹栈回面板（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  backAvg = all.avg;
  var rows = textRows(png, 200, 150, 1400, 900);
  console.log('    [back] avg=' + all.avg.toFixed(1) + ' 金=' + all.gold + ' rows=' + rows);
  chk('④ 弹栈回出兵面板（大面板回来 · 文字行 ' + rows + '）',
    all.avg > 30 && all.avg < 60 && rows >= 15);
})();

/* ⑤ 对照：关预览 = 遮罩消失 */
if (simAvg != null && backAvg != null) {
  chk('⑤ 掩饰态对照：back 均亮 − sim 均亮 = ' + (backAvg - simAvg).toFixed(1) + '（≥8 · 遮罩真的关了）',
    (backAvg - simAvg) >= 8);
}

/* ⑥ 睡眠等价（离线纪要弹窗） */
(function () {
  var png = read('v89210-night.png');
  if (!png) return chk('⑥ 离线纪要（缺图）', false);
  var all = stats(png, 0, 0, png.width, png.height);
  var rows = textRows(png, 550, 250, 1050, 800);
  console.log('    [night] avg=' + all.avg.toFixed(1) + ' 金=' + all.gold + ' 红=' + all.red + ' rows=' + rows);
  chk('⑥ 离线纪要弹窗真渲染（文字行 ' + rows + ' · 金 ' + all.gold + '）',
    all.avg > 15 && all.avg < 45 && rows >= 3 && all.gold >= 300);
})();

console.log('\n===== 像素体检：' + PASS + ' 通过 / ' + FAIL + ' 失败 =====');
process.exit(FAIL ? 1 : 0);
