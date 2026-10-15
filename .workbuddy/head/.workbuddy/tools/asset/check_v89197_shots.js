/* v89.197 截图像素体检（4 张：出征面板 / 悬停浮层 / 围困估算 / 战法行特写）
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
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0, chip = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    /* 高亮 chip（选中态）：金色描边+半透明金底 —— 用"暖金带"计数 */
    if (r > 120 && g > 90 && b < 100 && (r - b) > 45) chip++;
  }
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, chip: chip });
}
var shots = [
  ['v89197-exp-panel.png', '出征面板全窗（统一行布局 · 金色名称列在）', function (s) {
    console.log('    [panel] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' chip=' + s.chip + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89197-hover-tip.png', '悬停浮层（#tip-layer 深色卡 + 文字）', function (s) {
    console.log('    [hover] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' chip=' + s.chip);
    return s.avg > 8 && s.brightPct > 0.8 && s.gold >= 300;
  }],
  ['v89197-est-encircle.png', '围困估算态（估算行 + 已计入提示 · 绿色文字）', function (s) {
    console.log('    [est] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' chip=' + s.chip);
    return s.avg > 8 && s.brightPct > 0.8;
  }],
  ['v89197-ops-chips.png', '战法行特写（三 chip · 选中高亮）', function (s) {
    console.log('    [chips] avg=' + s.avg.toFixed(1) + ' bright%=' + s.brightPct.toFixed(2)
      + ' gold=' + s.gold + ' chip=' + s.chip + ' 尺寸 ' + s.w + 'x' + s.h);
    return s.w > 100 && s.h > 10 && s.chip >= 60;
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
