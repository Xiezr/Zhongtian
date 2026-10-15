module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'); var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
function grid(f) {
  var png = PNG.sync.read(fs.readFileSync(OUT + f));
  var W = 34, H = 14, out = [];
  for (var ry = 0; ry < H; ry++) {
    var row = '';
    for (var rx = 0; rx < W; rx++) {
      var s = 0, n = 0;
      var x0 = Math.floor(rx * png.width / W), x1 = Math.floor((rx + 1) * png.width / W);
      var y0 = Math.floor(ry * png.height / H), y1 = Math.floor((ry + 1) * png.height / H);
      for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) {
        var i = (y * png.width + x) * 4;
        s += 0.299 * png.data[i] + 0.587 * png.data[i+1] + 0.114 * png.data[i+2]; n++;
      }
      var L = s / n;
      row += L > 150 ? '#' : L > 90 ? '+' : L > 45 ? ':' : L > 18 ? '.' : ' ';
    }
    out.push(row);
  }
  return f + '  (' + png.width + 'x' + png.height + ')\n' + out.join('\n');
}
['v89214-troops.png','v89214-rank.png','v89214-city.png'].forEach(function (f) {
  console.log(grid(f) + '\n');
});
