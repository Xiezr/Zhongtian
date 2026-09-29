/* v89.186 截图像素体检：非空 + 暗色主题基线（均亮/亮像素）+ 各图关键色带。
   跑法：NODE_PATH=... node .workbuddy/tools/asset/check_v89186_shots.js */
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
    if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;      /* 金色（按钮/高亮） */
    if (g > 130 && (g - r) > 30 && (g - b) > 20) green++;            /* 绿色（"确凿"文字） */
  }
  cb(null, { w: png.width, h: png.height, n: n, avg: sum / n, brightPct: bright / n * 100, gold: gold, green: green });
}
var shots = [
  ['v89186-wounded.png', '军务·两营（伤兵营 75%）', function (s) { return s.avg > 20 && s.brightPct > 0.3; }],
  ['v89186-exp.png', '出征面板（伤兵提示行）', function (s) { return s.avg > 15 && s.brightPct > 1 && s.gold > 200; }],
  ['v89186-qb.png', '快购兵书（伤兵专用）', function (s) { return s.avg > 15 && s.gold > 300; }],
  ['v89186-bao.png', '将领面板（宝具行）', function (s) { return s.avg > 15 && s.brightPct > 0.5; }],
  ['v89186-fort.png', '据点面板（前哨文案）', function (s) { return s.avg > 15 && s.gold > 300; }],
  ['v89186-aura.png', '情报站（情报确凿·绿字）', function (s) { return s.avg > 15 && s.green > 20; }],
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
