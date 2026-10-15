/* v89.195 截图像素体检（5 张：总览 / 确认窗 / 放手后地图 / 面板 / 升档）
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
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;      /* 金色（标题/按钮/价格） */
    if (r > 130 && r - g > 50 && r - b > 40) red++;                  /* 朱红（红键/危险区） */
    if (g > 160 && (g - r) > 16 && (g - b) > 18) greenRing++;        /* 雷达圈亮绿 */
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, red: red, greenRing: greenRing });
}
var shots = [
  /* ① 总览：档位一览表 + 前哨列表（金色标题/按钮量少，主判据=文字行密度） */
  ['v89195-outposts.png', '总览弹窗（档位一览表在屏）', function (s) {
    console.log('    [outposts] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 10 && s.brightPct > 3 && s.gold >= 100;
  }],
  /* ② 确认窗：小弹窗居中（红键 + 文字） */
  ['v89195-abandon-ask.png', '放手确认窗（红键 + 三件套）', function (s) {
    console.log('    [ask] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 0.5 && s.red >= 80;
  }],
  /* ③ 放手后地图：其余前哨雷达圈仍在（亮绿描边） */
  ['v89195-after-abandon.png', '放手后地图（雷达圈仍在渲染）', function (s) {
    console.log('    [after] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.greenRing >= 300;
  }],
  /* ④ 前哨面板：危险区红框 + 按钮 */
  ['v89195-panel.png', '前哨面板（危险区 + 放手按钮）', function (s) {
    console.log('    [panel] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 1 && s.red >= 100;
  }],
  /* ⑤ 升档：将领视图（金框/按钮 + toast） */
  ['v89195-rankup.png', '资质升档（将领视图 + toast）', function (s) {
    console.log('    [rankup] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' red=' + s.red + ' green=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 1 && s.gold >= 400;
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
