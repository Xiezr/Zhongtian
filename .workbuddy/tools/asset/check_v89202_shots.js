/* v89.202 截图像素体检（4 张：蕴养同款 / 侦查单页 / 侦查极端屏 / 收藏峰值）
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
  ['v89202-ling.png', '蕴养同款（网格卡 + 筛选 + 底键 · 不溢出）', function (s) {
    console.log('    [ling] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89202-scout.png', '侦查单页（20 兵种极端 · 四板块 · 零滚动）', function (s) {
    console.log('    [scout] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 25 && s.avg < 60 && s.brightPct > 0.8 && s.gold >= 100;
  }],
  ['v89202-scout-scroll.png', '侦查极端屏（app-h=620 · 可下拉态）', function (s) {
    console.log('    [scout-scroll] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 25 && s.avg < 60 && s.brightPct > 0.8 && s.gold >= 60;
  }],
  ['v89202-collect.png', '收藏峰值（回落保持解锁 · 卡非锁）', function (s) {
    console.log('    [collect] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 20 && s.avg < 70 && s.brightPct > 1 && s.gold >= 100;
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
