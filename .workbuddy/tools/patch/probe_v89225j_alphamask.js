var fs = require('fs');
var PNG = require('pngjs').PNG;
var R = 'E:/Deepseekdb/';

function asciiAlpha(f, tag) {
  var png = PNG.sync.read(fs.readFileSync(f));
  var W = png.width, H = png.height;
  var CW = 64, CH = 32, sx = W / CW, sy = H / CH;
  console.log('===== ' + tag + ' (' + W + 'x' + H + ') =====');
  for (var gy = 0; gy < CH; gy++) {
    var row = '';
    for (var gx = 0; gx < CW; gx++) {
      var op = 0, tot = 0;
      for (var yy = 0; yy < 4; yy++) for (var xx = 0; xx < 2; xx++) {
        var X = Math.floor(gx * sx + xx * sx / 2), Y = Math.floor(gy * sy + yy * sy / 4);
        if (X >= W || Y >= H) continue;
        tot++;
        if (png.data[((W * Y + X) << 2) + 3] > 60) op++;
      }
      row += op >= 3 ? '#' : (op >= 1 ? '+' : ' ');
    }
    console.log('|' + row + '|');
  }
}

/* 当前版 vs 无旗版 */
['ai_zhaoxianguan', 'ai_junying'].forEach(function (nm) {
  asciiAlpha(R + 'assets/icons/ui/' + nm + '.png', nm + ' [CUR 带旗]');
  var old = R + '.workbuddy/tmp/atlas/icons/' + nm + '.png';
  if (fs.existsSync(old)) asciiAlpha(old, nm + ' [无旗版 atlas/icons]');
});
process.exit(0);
