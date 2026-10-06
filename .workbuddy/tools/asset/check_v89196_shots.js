/* v89.196 截图像素体检（6 张：雷达折线 / 战场结束 / 沙盘回看 / 收藏锁 / 收藏解锁 / 升档）
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
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0, red = 0, greenRing = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    if (r > 130 && r - g > 50 && r - b > 40) red++;
    if (g > 160 && (g - r) > 16 && (g - b) > 18) greenRing++;
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, red: red, greenRing: greenRing });
}
var shots = [
  ['v89196-radar.png', '雷达圈折线（亮绿描边像素在）', function (s) {
    console.log('    [radar] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.greenRing >= 300;
  }],
  ['v89196-btend.png', '战场结束态（金按钮 + 界面正常）', function (s) {
    console.log('    [btend] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 8 && s.brightPct > 0.8;
  }],
  ['v89196-bt-replay.png', '沙盘回看（战场画面在屏）', function (s) {
    console.log('    [replay] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 8 && s.brightPct > 0.8;
  }],
  ['v89196-collect-locked.png', '藏珍阁全锁态（卡在 · 暗化）', function (s) {
    console.log('    [locked] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 8 && s.brightPct > 0.5;
  }],
  ['v89196-collect-unlocked.png', '藏珍阁解锁态（金按钮出现）', function (s) {
    console.log('    [unlocked] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 8 && s.gold >= 400;
  }],
  ['v89196-rankup2.png', '资质升档（将领视图 + toast）', function (s) {
    console.log('    [rankup] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 1 && s.gold >= 300;
  }],
];
var i = 0;
(function next() {
  if (i >= shots.length) {
    console.log((FAIL ? '❌ ' : '✅ ') + PASS + ' 通过 / ' + FAIL + ' 失败');
    process.exit(FAIL ? 1 : 0);
  }
  var s0 = shots[i++];
  scan(s0[0], function (e, st) {
    if (e || st.err) { chk(s0[1], false, 'missing'); return next(); }
    chk(s0[1], s0[2](st));
    next();
  });
})();
