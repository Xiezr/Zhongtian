/* v89.189 截图像素体检（3 张：受阻弹窗 ×2 / 城池视图）
   先量后定：判据据首跑实测定。 */
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
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, region: region });
}
var shots = [
  /* 受阻弹窗（深木底 + 少量浅色文字 → 区域亮度天然低，判据用"有内容即可" + 金色标题在） */
  ['v89189-why.png', '受阻弹窗（出征 · 居中弹窗）', function (s) {
    var mid = s.region(500, 300, 1100, 700);
    return s.avg > 12 && mid > 1 && s.gold > 50;
  }],
  ['v89189-train.png', '受阻弹窗（灰兵种卡）', function (s) {
    var mid = s.region(500, 300, 1100, 700);
    return s.avg > 12 && mid > 1.5 && s.gold > 200;
  }],
  ['v89189-city.png', '城池视图（侧栏在册）', function (s) {
    return s.avg > 15 && s.brightPct > 1.5;
  }],
];
var pending = shots.length;
shots.forEach(function (pair) {
  scan(pair[0], function (e, s) {
    if (s.err) { chk(pair[1], false, 'missing'); if (--pending === 0) done(); return; }
    var ok = s.w >= 200 && s.h >= 100 && pair[2](s);
    chk(pair[1], ok, s.w + 'x' + s.h + ' avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(2)
      + '% gold=' + s.gold
      + ' mid=' + s.region(500, 300, 1100, 700).toFixed(2));
    if (--pending === 0) done();
  });
});
function done() {
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
