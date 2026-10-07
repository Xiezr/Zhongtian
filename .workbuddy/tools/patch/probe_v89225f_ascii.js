var fs = require('fs');
var PNG = require('pngjs').PNG;
var R = 'E:/Deepseekdb/';
var names = ['ai_kezhan', 'ai_zhaoxianguan', 'ai_junying', 'ai_xiaochang', 'ai_guanfu', 'ai_minfang', 'ai_shichang'];

function hueOf(r, g, b) {
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return -1;
  var h;
  if (mx === r) h = 60 * (((g - b) / d) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return h;
}
function satLit(r, g, b) {
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var l = (mx + mn) / 2 / 255;
  var s = mx === mn ? 0 : (l < 0.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (510 - mx - mn));
  return [s, l];
}

function ascii(file, tag) {
  var png = PNG.sync.read(fs.readFileSync(file));
  // 找主色相（s>0.45）
  var bins = new Array(36).fill(0);
  for (var i = 0; i < png.data.length; i += 4) {
    var a = png.data[i + 3]; if (a < 40) continue;
    var sl = satLit(png.data[i], png.data[i + 1], png.data[i + 2]);
    if (sl[0] > 0.45 && sl[1] > 0.2 && sl[1] < 0.85) {
      var h = hueOf(png.data[i], png.data[i + 1], png.data[i + 2]);
      if (h >= 0) bins[Math.floor(h / 10) % 36]++;
    }
  }
  var mainBin = bins.indexOf(Math.max.apply(null, bins));
  var W = 64, H = 32;
  var grid = [];
  var bbox = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 };
  for (var gy = 0; gy < H; gy++) {
    var row = '';
    for (var gx = 0; gx < W; gx++) {
      var hit = 0, tot = 0;
      for (var yy = 0; yy < 16; yy++) for (var xx = 0; xx < 8; xx++) {
        var X = gx * 8 + xx, Y = gy * 16 + yy;
        if (X >= png.width || Y >= png.height) continue;
        var i = (png.width * Y + X) << 2;
        var a = png.data[i + 3]; if (a < 40) continue;
        tot++;
        var sl = satLit(png.data[i], png.data[i + 1], png.data[i + 2]);
        if (sl[0] > 0.45 && sl[1] > 0.2 && sl[1] < 0.85) {
          var h = hueOf(png.data[i], png.data[i + 1], png.data[i + 2]);
          var bin = h >= 0 ? Math.floor(h / 10) % 36 : -1;
          if (bin === mainBin) {
            hit++;
            if (X < bbox.x0) bbox.x0 = X; if (X > bbox.x1) bbox.x1 = X;
            if (Y < bbox.y0) bbox.y0 = Y; if (Y > bbox.y1) bbox.y1 = Y;
            bbox.n++;
          }
        }
      }
      row += hit > 3 ? '#' : (hit > 0 ? '.' : ' ');
    }
    grid.push(row);
  }
  console.log('===== ' + tag + ' 主色相=' + (mainBin * 10) + '° bbox=' + JSON.stringify(bbox) + ' =====');
  grid.forEach(function (r) { console.log('|' + r + '|'); });
}

names.forEach(function (nm) {
  var cur = R + 'assets/icons/ui/' + nm + '.png';
  var old = R + '.workbuddy/tmp/oldicons/' + nm + '.png';
  if (fs.existsSync(old)) ascii(old, nm + ' [OLD]');
  if (fs.existsSync(cur)) ascii(cur, nm + ' [CUR]');
});
process.exit(0);
