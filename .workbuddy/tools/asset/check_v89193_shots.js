/* v89.193 截图像素体检（5 张：跳变补算 / 总览空态 / 总览行 / 前哨面板 / 满员受阻）
   先量后定：首跑据实测定阈值。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function scan(file, cb) {
  var f = OUT + file;
  if (!fs.existsSync(f)) return cb(null, { err: 'missing' });
  var png = PNG.sync.read(fs.readFileSync(f));
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
  }
  function region(x0, y0, x1, y1) {
    var cnt = 0, lit = 0;
    for (var y = Math.max(0, y0); y < Math.min(png.height, y1); y++) {
      for (var x = Math.max(0, x0); x < Math.min(png.width, x1); x++) {
        var i = (y * png.width + x) * 4;
        var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
        cnt++; if (L > 90) lit++;
      }
    }
    return cnt ? lit / cnt * 100 : 0;
  }
  function textRows(y0, y1, x0, x1) {
    var rows = 0;
    for (var y = Math.max(0, y0); y < Math.min(png.height, y1); y++) {
      var lit = 0;
      for (var x = Math.max(0, x0); x < Math.min(png.width, x1); x++) {
        var i = (y * png.width + x) * 4;
        var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
        if (L > 90) lit++;
      }
      if (lit > (Math.min(png.width, x1) - x0) * 0.004) rows++;
    }
    return rows;
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, region: region, textRows: textRows });
}
var shots = [
  /* ① 跳变补算后的主界面（toast 在屏）——主界面正常 + 有金色 UI 元素 */
  ['v89193-gap.png', '跳变补算后的主界面（含 toast）', function (s) {
    return s.avg > 12 && s.brightPct > 0.5 && s.gold > 100;
  }],
  /* ② 总览空态弹窗（矮弹窗居中：文字行存在 —— 先量后定：实测 rows=13（区间与打印一致）） */
  ['v89193-outposts-empty.png', '总览空态弹窗（标题+空态行）', function (s) {
    return s.avg > 10 && s.brightPct > 0.5 && s.textRows(150, 900, 350, 1250) >= 3;
  }],
  /* ③ 总览有行（3 行表格：文字行显著多于空态） */
  ['v89193-outposts.png', '总览 3 行表格（文字行 ≥5：标题/副题/表头/3行/小结）', function (s) {
    return s.avg > 10 && s.textRows(150, 900, 350, 1250) >= 5 && s.gold > 40;
  }],
  /* ④ 前哨面板（护持 5 行 + 概况 2 行 + 按钮） */
  ['v89193-outpost-panel.png', '前哨面板（护持区多行文字）', function (s) {
    return s.avg > 10 && s.textRows(150, 900, 350, 1250) >= 6;
  }],
  /* ⑤ 满员受阻的据点面板（含按钮带） */
  ['v89193-full.png', '满员受阻据点面板（按钮带 + 多行）', function (s) {
    return s.avg > 10 && s.textRows(150, 950, 300, 1300) >= 5 && s.gold > 30;
  }],
];
var i = 0;
(function next() {
  if (i >= shots.length) {
    console.log('════ 合计：' + (FAIL ? ('❌ ' + FAIL + ' 项失败') : '✅ ' + PASS + ' 项全过') + ' ════');
    process.exit(FAIL ? 1 : 0);
  }
  var pair = shots[i++];
  scan(pair[0], function (e, s) {
    if (e || s.err) { chk(pair[1], false, 'missing'); return next(); }
    var ok = false;
    try { ok = pair[2](s); } catch (err) { ok = false; }
    chk(pair[1], ok, s.w + 'x' + s.h + ' avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(2)
      + '% gold=' + s.gold + ' midLit=' + s.region(350, 200, 1250, 800).toFixed(2) + '%'
      + ' rows=' + s.textRows(150, 900, 350, 1250));
    next();
  });
})();
