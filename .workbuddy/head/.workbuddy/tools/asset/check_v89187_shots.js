/* v89.187 截图像素体检（3 张：合成区 / 合成后 / 据点情报） */
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
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0, green = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    if (g > 130 && (g - r) > 30 && (g - b) > 20) green++;
  }
  cb(null, { w: png.width, h: png.height, n: n, avg: sum / n, brightPct: bright / n * 100, gold: gold, green: green });
}
var shots = [
  ['v89187-fuse.png', '挂件选择窗（品质徽标+合成区）', function (s) { return s.avg > 15 && s.brightPct > 0.5 && s.gold > 200; }],
  ['v89187-fuse2.png', '合成后（列表刷新）', function (s) { return s.avg > 15 && s.gold > 200; }],
  ['v89187-intel.png', '据点情报弹窗（守军明细）', function (s) { return s.avg > 15 && s.brightPct > 0.5; }],
];
var pending = shots.length;
shots.forEach(function (pair) {
  scan(pair[0], function (e, s) {
    if (s.err) { chk(pair[1], false, 'missing'); if (--pending === 0) done(); return; }
    var ok = s.w >= 200 && s.h >= 100 && pair[2](s);
    chk(pair[1], ok, s.w + 'x' + s.h + ' avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(2)
      + '% gold=' + s.gold + ' green=' + s.green);
    if (--pending === 0) done();
  });
});
function done() {
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
