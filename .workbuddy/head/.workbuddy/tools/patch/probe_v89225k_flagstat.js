var fs = require('fs');
var PNG = require('pngjs').PNG;
var R = 'E:/Deepseekdb/';

function flagStat(file, want) {
  var png = PNG.sync.read(fs.readFileSync(file));
  var W = png.width, H = png.height;
  var x0 = Math.round(W * 0.62), x1 = Math.round(W * 0.87);
  var y0 = Math.round(H * 0.58), y1 = Math.round(H * 0.78);
  var e60 = 0, e30 = 0, e12 = 0, solid = 0;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (W * y + x) << 2;
    if (png.data[i + 3] < 200) continue;
    solid++;
    var d = Math.hypot(png.data[i] - want[0], png.data[i + 1] - want[1], png.data[i + 2] - want[2]);
    if (d <= 60) e60++;
    if (d <= 30) e30++;
    if (d <= 12) e12++;
  }
  return { solid: solid, e60: e60, e30: e30, e12: e12 };
}

/* 对比：stage（重切后）vs UI（带旗现行）+ 备份 icons（重切前带旗） */
var CASES = [
  ['junying', [43, 82, 136]],
  ['zhaoxianguan', [44, 125, 100]],
  ['guanfu', [205, 160, 55]],
  ['kezhan', [231, 227, 213]]
];
CASES.forEach(function (c) {
  var nm = c[0], want = c[1];
  var stage = R + '.workbuddy/tmp/wasteland/W-B1/ai_' + nm + '.png';
  var ui = R + 'assets/icons/ui/ai_' + nm + '.png';
  var bak = R + '.workbuddy/backup/v89225/icons/ai_' + nm + '.png';
  console.log('===== ' + nm + ' =====');
  [['stage(重切后·无旗)', stage], ['UI(现行·无旗)', ui], ['backup(v89225 备份·带旗版)', bak]].forEach(function (t) {
    if (!fs.existsSync(t[1])) { console.log('  ' + t[0] + ': 缺失'); return; }
    var s = flagStat(t[1], want);
    console.log('  ' + t[0] + ': solid=' + s.solid + '  e60=' + s.e60 + '  e30=' + s.e30 + '  e12=' + s.e12);
  });
});
process.exit(0);
