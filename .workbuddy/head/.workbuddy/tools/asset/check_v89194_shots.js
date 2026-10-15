/* v89.194 截图像素体检（3 张：雷达圈 / 藏珍阁 / 将领详情）
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
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0, greenRing = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    /* 圈描边色 rgba(168,235,188,~.5) 压在地形上：亮绿 —— 与地形绿（暗）区分 */
    if (g > 160 && (g - r) > 16 && (g - b) > 18) greenRing++;
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, greenRing: greenRing });
}
var shots = [
  /* ① 地图雷达圈：亮绿描边像素（Lv10 弧 + Lv3 整圈） */
  ['v89194-radar.png', '地图雷达圈（亮绿描边像素 + 主界面正常）', function (s) {
    console.log('    [radar] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' greenRing=' + s.greenRing + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 10 && s.brightPct > 1 && s.greenRing >= 800;
  }],
  /* ② 藏珍阁：卡片底部金色价格 + ✓ 已藏金框（金色像素显著） */
  ['v89194-collect.png', '藏珍阁视图（卡片 + 金色价格/已藏框）', function (s) {
    console.log('    [collect] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' greenRing=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 1.5 && s.gold >= 1500;
  }],
  /* ③ 将领详情：金色标题/按钮 + 主界面正常 */
  ['v89194-gp.png', '将领详情（面板在屏）', function (s) {
    console.log('    [gp] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' greenRing=' + s.greenRing);
    return s.avg > 10 && s.brightPct > 1 && s.gold >= 800;
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
