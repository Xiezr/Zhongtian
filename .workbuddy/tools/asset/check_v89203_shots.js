/* v89.203 截图像素体检（3 张：toast 中上 / 占领后城池一览 / 爵位管理城池列）
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
  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var i = (y * png.width + x) * 4;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += L;
      if (L > 90) bright++;
      if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    }
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100, gold: gold });
}
var shots = [
  ['v89203-toast.png', '弹窗内 toast 中上（蕴养面板 + 提示条 · 不挡底键）', function (s) {
    console.log('    [toast] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89203-occupy.png', '占领名城后「城池一览」（许都 + 洛阳）', function (s) {
    console.log('    [occupy] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89203-rank.png', '爵位页（管理城池列 + 平民 9 座说明）', function (s) {
    console.log('    [rank] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 20 && s.avg < 70 && s.brightPct > 1 && s.gold >= 60;
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
