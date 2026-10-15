/* probe_v89224_raw2.js — 四张 A_2x2 老图的四象限内容分析（v89.224）
   色彩分桶 ASCII：W=白底 ~=蓝(水/天) G=绿(植被) Y=暖黄(土石/沙) R=红棕(锈/木)
   = =灰(石/金属) #=深色(暗部)  . =混合/低饱和中亮 */
var fs = require('fs');
var PNG = require('pngjs').PNG;
var DIR = 'E:/Deepseekdb/assets/icons/raw/';
var files = fs.readdirSync(DIR).filter(function (f) { return /\.png$/i.test(f); }).sort();

function classify(r, g, b) {
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  var sat = mx === 0 ? 0 : (mx - mn) / mx;
  if (r > 238 && g > 238 && b > 238) return 'W';
  if (lum < 0.22) return '#';
  if (sat < 0.10) return lum > 0.72 ? 'w' : (lum > 0.45 ? '=' : '.');
  var h;
  if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
  else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
  else h = 60 * ((r - g) / (mx - mn) + 4);
  if (h < 0) h += 360;
  if (h < 25 || h >= 330) return 'R';
  if (h < 70) return 'Y';
  if (h < 165) return 'G';
  if (h < 260) return '~';
  return 'P';
}

files.forEach(function (f) {
  var im = PNG.sync.read(fs.readFileSync(DIR + f));
  console.log('\n########## ' + f + ' [' + im.width + 'x' + im.height + '] ##########');
  var hw = im.width / 2, hh = im.height / 2;
  [['左上', 0, 0], ['右上', hw, 0], ['左下', 0, hh], ['右下', hw, hh]].forEach(function (q) {
    var qn = q[0], x0 = q[1], y0 = q[2];
    var W = 40, H = 16, lines = [], cnt = {};
    for (var ry = 0; ry < H; ry++) {
      var line = '';
      for (var rx = 0; rx < W; rx++) {
        var px = Math.floor(x0 + (rx + 0.5) * hw / W), py = Math.floor(y0 + (ry + 0.5) * hh / H);
        var i = (im.width * py + px) << 2;
        var c = classify(im.data[i], im.data[i + 1], im.data[i + 2]);
        cnt[c] = (cnt[c] || 0) + 1; line += c;
      }
      lines.push(line);
    }
    var nonW = 0, n = 0;
    for (var y = y0; y < y0 + hh; y += 4) for (var x = x0; x < x0 + hw; x += 4) {
      var j = (im.width * y + x) << 2; n++;
      if (!(im.data[j] > 238 && im.data[j + 1] > 238 && im.data[j + 2] > 238)) nonW++;
    }
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 6).map(function (k) { return k + ':' + cnt[k]; }).join(' ');
    console.log('--- ' + qn + '（非白内容 ' + (nonW / n * 100).toFixed(1) + '%）主要色类：' + top);
    lines.forEach(function (l) { console.log('  |' + l + '|'); });
  });
});
process.exit(0);
