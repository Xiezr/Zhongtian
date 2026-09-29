/* v89.192 截图像素体检（3 张：地图导航 / 战场回合记录 / 沙盘铺满）
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
  /* 逐行亮度投影：数"文字行"（该行亮像素 ≥ 行宽×0.4%）—— §51.4 的手法 */
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
  /* 地图页 + 底部导航条（含「回本城」按钮） */
  ['v89192-map.png', '地图导航条（回本城按钮在册）', function (s) {
    var bar = s.region(0, 880, 1600, 1000);          /* 底部导航带 */
    return s.avg > 15 && s.brightPct > 0.8 && bar > 0.8 && s.gold > 60;
  }],
  /* 战场界面（含回合记录区 —— 补历史后下部应有文字行） */
  ['v89192-watch.png', '战场界面（回合记录区有内容）', function (s) {
    var rows = s.textRows(640, 960, 200, 1500);
    return s.avg > 15 && s.brightPct > 0.8 && rows >= 6 && s.gold > 80;
  }],
  /* 沙盘铺满（board 吃余高 + 帧流加大） —— 上下都有内容 */
  ['v89192-sandbox.png', '沙盘铺满（board 令牌 + 帧流区）', function (s) {
    var midRows = s.textRows(150, 730, 150, 1550);   /* board 带 */
    return s.avg > 12 && midRows >= 4 && s.gold > 40;
  }],
];
var pending = shots.length;
shots.forEach(function (pair) {
  scan(pair[0], function (e, s) {
    if (s.err) { chk(pair[1], false, 'missing'); if (--pending === 0) done(); return; }
    var ok = s.w >= 200 && s.h >= 100 && pair[2](s);
    chk(pair[1], ok, s.w + 'x' + s.h + ' avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(2)
      + '% gold=' + s.gold);
    if (--pending === 0) done();
  });
});
function done() {
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
