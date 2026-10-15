/* probe_v89224_match.js — 结构对照：四象限 vs 现行/旧版地形贴图（v89.224）
   同一调色板 48×20 渲染，肉眼（模型）比对结构相似性。 */
var fs = require('fs');
var PNG = require('pngjs').PNG;

function render(path, W, H) {
  var im = PNG.sync.read(fs.readFileSync(path));
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
  var out = [];
  for (var ry = 0; ry < H; ry++) {
    var line = '';
    for (var rx = 0; rx < W; rx++) {
      var x0 = Math.floor(rx * im.width / W), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * im.width / W));
      var y0 = Math.floor(ry * im.height / H), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * im.height / H));
      var r = 0, g = 0, b = 0, a = 0, cnt = 0;
      for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { var i = (im.width * y + x) << 2; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; a += im.data[i + 3]; cnt++; }
      line += cls(r / cnt, g / cnt, b / cnt, a / cnt);
    }
    out.push(line);
  }
  return out;
}

function show(title, lines) { console.log('\n===== ' + title + ' ====='); lines.forEach(function (l) { console.log(l); }); }

var RAW = 'E:/Deepseekdb/assets/icons/raw/A_2x2_grid_of_4_separate_game__2026-09-12T22-56-35.png';
var im = PNG.sync.read(fs.readFileSync(RAW));
var hw = im.width / 2, hh = im.height / 2;

/* 现行 + 旧版地形，各渲染 48×20 */
['plain', 'caoyuan', 'forest', 'zhaoze', 'lake', 'desert', 'hill'].forEach(function (k) {
  var cur = 'E:/Deepseekdb/assets/icons/ui/ai_terrain_' + k + '.png';
  var old = 'E:/Deepseekdb/.workbuddy/tmp/terrain_v8942a/ai_terrain_' + k + '.png';
  var a = fs.existsSync(cur) ? render(cur, 48, 20) : ['(缺)'];
  var b = fs.existsSync(old) ? render(old, 48, 20) : ['(缺)'];
  console.log('\n@@@@@@@@@@ 地形 ' + k + ' @@@@@@@@@@');
  for (var i = 0; i < Math.max(a.length, b.length); i++) console.log((a[i] || ' '.repeat(48)) + '   |   ' + (b[i] || ''));
});
console.log('\n（左=现行 v89.42b · 右=旧版 v89.42a）');

/* 四象限：裁剪保存为临时 png 再渲染不方便，直接内联渲染 */
function renderQuad(ox, oy, W, H) {
  function cls(r, g, b) {
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
  var out = [];
  for (var ry = 0; ry < H; ry++) {
    var line = '';
    for (var rx = 0; rx < W; rx++) {
      var x0 = ox + Math.floor(rx * hw / W), x1 = ox + Math.max(x0 - ox + 1, Math.floor((rx + 1) * hw / W));
      var y0 = oy + Math.floor(ry * hh / H), y1 = oy + Math.max(y0 - oy + 1, Math.floor((ry + 1) * hh / H));
      var r = 0, g = 0, b = 0, cnt = 0;
      for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { var i = (im.width * y + x) << 2; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; cnt++; }
      line += cls(r / cnt, g / cnt, b / cnt);
    }
    out.push(line);
  }
  return out;
}
console.log('\n\n############ 22-56-35 四象限 48×20 ############');
[['左上', 0, 0], ['右上', hw, 0], ['左下', 0, hh], ['右下', hw, hh]].forEach(function (q) {
  show(q[0], renderQuad(q[1], q[2], 48, 20));
});
process.exit(0);
