/* probe_v89224_sib.js — ui vs ui_normalized 对比 + 3 张兄弟图高保真（v89.224） */
var fs = require('fs');
var PNG = require('pngjs').PNG;

function cls(r, g, b, a) {
  if (a < 100) return '~';
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  var l = (mx + mn) / 510, s = mx ? d / mx : 0;
  if (r > 235 && g > 235 && b > 235) return '.';
  if (l < 0.22) return 'K';
  if (s < 0.11) return l > 0.62 ? ':' : (l > 0.4 ? '=' : '%');
  var h;
  if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  if (h < 30 || h >= 330) return l > 0.5 ? 'R' : 'r';
  if (h < 65) return l > 0.5 ? 'Y' : 'y';
  if (h < 150) return l > 0.5 ? 'G' : 'g';
  if (h < 260) return l > 0.5 ? 'C' : 'c';
  return 'P';
}
function render(path, W, H, ox, oy, sw, sh) {
  var im = PNG.sync.read(fs.readFileSync(path));
  if (ox === undefined) { ox = 0; oy = 0; sw = im.width; sh = im.height; }
  var out = [];
  for (var ry = 0; ry < H; ry++) {
    var line = '';
    for (var rx = 0; rx < W; rx++) {
      var x0 = ox + Math.floor(rx * sw / W), x1 = ox + Math.max(1, Math.floor((rx + 1) * sw / W));
      var y0 = oy + Math.floor(ry * sh / H), y1 = oy + Math.max(1, Math.floor((ry + 1) * sh / H));
      var r = 0, g = 0, b = 0, a = 0, cnt = 0;
      for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { var i = (im.width * y + x) << 2; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; a += im.data[i + 3]; cnt++; }
      line += cls(r / cnt, g / cnt, b / cnt, a / cnt);
    }
    out.push(line);
  }
  return { lines: out, w: im.width, h: im.height };
}
function show(t, path) { var r = render(path, 48, 16); console.log('\n== ' + t + ' [' + r.w + 'x' + r.h + '] =='); r.lines.forEach(function (l) { console.log(l); }); }

console.log('############ ui vs ui_normalized（同名 ai_gold）############');
show('ui/ai_gold', 'E:/Deepseekdb/assets/icons/ui/ai_gold.png');
show('ui_normalized/ai_gold', 'E:/Deepseekdb/assets/icons/ui_normalized/ai_gold.png');

console.log('\n\n############ 3 张兄弟图 · 四象限 40×14 ############');
['22-31-13', '22-31-29', '22-31-45'].forEach(function (k) {
  var f = 'E:/Deepseekdb/assets/icons/raw/A_2x2_grid_of_4_separate_game__2026-09-12T' + k + '.png';
  var im = PNG.sync.read(fs.readFileSync(f));
  var hw = im.width / 2, hh = im.height / 2;
  console.log('\n########## ' + k + ' ##########');
  [['左上', 0, 0], ['右上', hw, 0], ['左下', 0, hh], ['右下', hw, hh]].forEach(function (q) {
    var r = render(f, 40, 14, q[1], q[2], hw, hh);
    console.log('--- ' + q[0] + ' ---');
    r.lines.forEach(function (l) { console.log('  ' + l); });
  });
});
process.exit(0);
