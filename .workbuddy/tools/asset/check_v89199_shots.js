/* v89.199 截图像素体检（2 张：自动征兵修复后 / 设置页版本行）
   先量后定：首跑打印全量数字，据实测定阈值。 */
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
  /* v89.199 专用：底部横带亮像素（横向滚动条会在 .view-box 底部产生浅色条） */
  var botBand = 0, botN = 0;
  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var i = (y * png.width + x) * 4;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += L;
      if (L > 90) bright++;
      if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
      /* 视口底部 60px 带内、中部 900~1500 x 区的"中亮"像素（滚动条 17px 浅灰） */
      if (y > png.height - 60 && x > 900 && x < 1500) {
        botN++;
        if (L > 120 && L < 220) botBand++;
      }
    }
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, botPct: botN ? (botBand / botN * 100) : -1 });
}
var shots = [
  ['v89199-zoom-fixed.png', '自动征兵面板（全量输入后 · 页面不被撑宽）', function (s) {
    console.log('    [zoom] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' botPct=' + s.botPct.toFixed(2) + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89199-settings.png', '设置页（运行版本行 + Ctrl+F5 指引）', function (s) {
    console.log('    [settings] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 100;
  }],
];
(function next(i) {
  if (i >= shots.length) {
    console.log('\n像素体检：' + PASS + ' 通过 / ' + FAIL + ' 失败');
    process.exit(FAIL ? 1 : 0);
    return;
  }
  var s = shots[i];
  scan(s[0], function (e, st) {
    if (st.err) { chk(s[1] + '（缺图 ' + s[0] + '）', false); return next(i + 1); }
    chk(s[1], s[2](st));
    next(i + 1);
  });
})(0);
