/* v89.191 截图像素体检（5 张：数值框面板 / 将领错开 / 科技面板 / 宝具入口 / 宝具选择窗）
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
  cb(null, { w: png.width, h: png.height, avg: sum / n, brightPct: bright / n * 100,
    gold: gold, region: region });
}
var shots = [
  /* 自动征兵面板（右详情 = 表格 + 数值框 + 说明；左名单在册） */
  ['v89191-input.png', '自动征兵面板（数值框可填 · 表格在册）', function (s) {
    return s.avg > 15 && s.brightPct > 0.6
      && s.region(500, 120, 1600, 900) > 0.8
      && s.region(0, 100, 480, 900) > 0.5;
  }],
  /* 将领界面（行高对齐 + 袖珍按钮 + 晋升错开；金色=标题/按钮在） */
  ['v89191-gen.png', '将领界面（解雇/晋升错开 · 同排）', function (s) {
    return s.avg > 20 && s.brightPct > 0.8 && s.gold > 300
      && s.region(320, 100, 1600, 420) > 1;
  }],
  /* 科技面板（标题 + 上限提示 + 表格） */
  ['v89191-tech.png', '科技面板（按城上限 + 24 项表格）', function (s) {
    return s.avg > 15 && s.region(300, 90, 1600, 400) > 0.7 && s.gold > 80;
  }],
  /* 宝具入口（将领界面 · 装备栏行；与 gen 同场景） */
  ['v89191-bao.png', '装备栏「🔮 宝具」入口（军中/宝具并列）', function (s) {
    return s.avg > 20 && s.gold > 300
      && s.region(320, 100, 1600, 420) > 1;
  }],
  /* 宝具选择窗（暗木弹窗：标题 + 合成区 + 空态文案） */
  ['v89191-baopick.png', '宝具选择窗（合成区 + 库存态）', function (s) {
    var mid = s.region(450, 250, 1250, 800);
    return s.avg > 12 && mid > 1 && s.gold > 50;
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
  console.log('\n像素体检：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
