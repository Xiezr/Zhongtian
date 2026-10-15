/* v89.188 截图像素体检（3 张：将领界面 / 官府民心段 / 改建面板）
   先量后定：本轮判据据首跑实测数字写。 */
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
  var n = png.width * png.height, sum = 0, bright = 0, gold = 0, green = 0, red = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += L;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
    if (g > 130 && (g - r) > 30 && (g - b) > 20) green++;
    if (r > 140 && (r - g) > 50 && (r - b) > 50) red++;
  }
  /* 区域亮度（百分比）：给"某块区域有没有内容"用 */
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
  cb(null, { w: png.width, h: png.height, n: n, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, green: green, red: red, region: region });
}
var shots = [
  /* ① 将领界面：详情区按钮带（解雇/晋升两枚袖珍按钮，视觉坐标 ≈ x569 起、y135/162 两行） */
  ['v89188-gen.png', '将领界面（列表 + 详情：解雇/晋升按钮带）', function (s) {
    var band = s.region(555, 120, 700, 200);            /* 详情区左部按钮带 */
    return s.avg > 12 && s.brightPct > 1 && band > 8;   /* 按钮带要有内容（两个小按钮+名字） */
  }],
  /* ② 官府面板：民心/民怨段（弹窗态·面板中部） */
  ['v89188-hearts.png', '官府面板（民心/民怨段在册）', function (s) {
    var mid = s.region(400, 300, 1200, 650);            /* 弹窗正文区 */
    return s.avg > 10 && s.brightPct > 0.8 && mid > 4;
  }],
  /* ③ 改建面板：目标列表（3 行 · 改建按钮列）——面板为 md 弹窗+遮罩，中部暗；
     判据取"非空 + 金标题/按钮真的画出来"（DOM 层 3 目标行由实机脚本断言） */
  ['v89188-convert.png', '改建选择面板（3 目标行）', function (s) {
    return s.avg > 12 && s.brightPct > 0.8 && s.gold > 200;
  }],
];
var pending = shots.length;
shots.forEach(function (pair) {
  scan(pair[0], function (e, s) {
    if (s.err) { chk(pair[1], false, 'missing'); if (--pending === 0) done(); return; }
    var ok = s.w >= 200 && s.h >= 100 && pair[2](s);
    chk(pair[1], ok, s.w + 'x' + s.h + ' avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(2)
      + '% gold=' + s.gold + ' red=' + s.red
      + ' mid=' + s.region(300, 250, 1300, 700).toFixed(2)
      + ' mid2=' + s.region(400, 300, 1200, 650).toFixed(2)
      + ' band=' + s.region(555, 120, 700, 200).toFixed(2));
    if (--pending === 0) done();
  });
});
function done() {
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
