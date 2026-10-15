/* probe_v89224_style.js — 22-56-35 画风判定 + 高保真 ASCII（v89.224） */
var fs = require('fs');
var PNG = require('pngjs').PNG;
var im = PNG.sync.read(fs.readFileSync('E:/Deepseekdb/assets/icons/raw/A_2x2_grid_of_4_separate_game__2026-09-12T22-56-35.png'));
var hw = im.width / 2, hh = im.height / 2;

function styleCheck(name, ox, oy, w, h) {
  /* ① 唯一色数（量化到 4bit/通道）② 相邻像素锐变比例（判断像素风/平滑风） */
  var q = {}, n = 0, sharp = 0, total = 0, maxd = 0;
  for (var y = oy; y < oy + h; y += 1) {
    for (var x = ox; x < ox + w; x += 1) {
      var i = (im.width * y + x) << 2;
      var key = (im.data[i] >> 4) + ',' + (im.data[i + 1] >> 4) + ',' + (im.data[i + 2] >> 4);
      q[key] = 1; n++;
      if (x + 1 < ox + w) {
        var j = i + 4;
        var d = Math.abs(im.data[i] - im.data[j]) + Math.abs(im.data[i + 1] - im.data[j + 1]) + Math.abs(im.data[i + 2] - im.data[j + 2]);
        total++; if (d > 60) sharp++; if (d > maxd) maxd = d;
      }
    }
  }
  console.log(name + ': 量化色数=' + Object.keys(q).length + '（' + n + 'px）· 锐变像素比例=' + (sharp / total * 100).toFixed(1) + '% · 最大邻差=' + maxd);
}

/* 高保真 ASCII：72 宽，精细调色板 */
function hiRes(name, ox, oy, w, h) {
  var W = 72, H = 30, out = [];
  function cls(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 510, s = mx ? d / mx : 0;
    if (r > 235 && g > 235 && b > 235) return '.';
    if (l < 0.25) return 'K';
    if (s < 0.10) return l > 0.7 ? ':' : (l > 0.42 ? '=' : '%');
    var h;
    if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    if (h < 30 || h >= 330) return l > 0.5 ? 'R' : 'r';
    if (h < 65) return l > 0.5 ? 'Y' : 'y';
    if (h < 150) return l > 0.5 ? 'G' : 'g';
    if (h < 260) return l > 0.5 ? 'C' : 'c';
    return 'P';
  }
  for (var ry = 0; ry < H; ry++) {
    var line = '';
    for (var rx = 0; rx < W; rx++) {
      var s = 0, cnt = 0, r = 0, g = 0, b = 0;
      var x0 = ox + Math.floor(rx * w / W), x1 = ox + Math.max(Math.floor(rx * w / W) + 1, Math.floor((rx + 1) * w / W));
      var y0 = oy + Math.floor(ry * h / H), y1 = oy + Math.max(Math.floor(ry * h / H) + 1, Math.floor((ry + 1) * h / H));
      for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { var i2 = (im.width * y + x) << 2; r += im.data[i2]; g += im.data[i2 + 1]; b += im.data[i2 + 2]; cnt++; }
      line += cls(r / cnt, g / cnt, b / cnt);
    }
    out.push(line);
  }
  console.log('\n--- ' + name + ' ---');
  console.log(out.map(function (l) { return '  ' + l; }).join('\n'));
}

['左上|0|0', '右上|hw|0', '左下|0|hh', '右下|hw|hh'].forEach(function (s) {
  var p = s.split('|'), nm = p[0], ox = p[1] === 'hw' ? hw : 0, oy = p[2] === 'hh' ? hh : 0;
  styleCheck(nm, ox, oy, hw, hh);
});
hiRes('左上（水+绿）', 0, 0, hw, hh);
hiRes('右上（暖色平原）', hw, 0, hw, hh);
hiRes('左下（绿野）', 0, hh, hw, hh);
hiRes('右下（混地）', hw, hh, hw, hh);
process.exit(0);
