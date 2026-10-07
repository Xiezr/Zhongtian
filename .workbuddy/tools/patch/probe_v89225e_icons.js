var fs = require('fs'), path = require('path');
var { execSync } = require('child_process');
var PNG = require('pngjs').PNG;

var R = 'E:/Deepseekdb/';
var names = ['ai_kezhan', 'ai_jiuguan', 'ai_zhaoxianguan', 'ai_junying', 'ai_xiaochang', 'ai_guanfu', 'ai_minfang', 'ai_shichang'];

function stats(file) {
  var png = PNG.sync.read(fs.readFileSync(file));
  var n = png.width * png.height;
  var sSum = 0, lSum = 0, opaque = 0;
  var hues = new Array(36).fill(0);
  var hiSatPix = 0;
  var cx = 0, cy = 0, cw = 0;
  var hiSatCX = 0, hiSatCY = 0;
  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
      if (a < 40) continue;
      opaque++;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var l = (mx + mn) / 2 / 255;
      var s = mx === mn ? 0 : (l < 0.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (510 - mx - mn));
      sSum += s; lSum += l;
      if (s > 0.45 && l > 0.2 && l < 0.85) {
        hiSatPix++;
        hiSatCX += x; hiSatCY += y;
        // hue
        var d = mx - mn;
        var h;
        if (mx === r) h = 60 * (((g - b) / d) % 6);
        else if (mx === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
        hues[Math.floor(h / 10) % 36]++;
      }
    }
  }
  var top3 = hues.map(function (v, k) { return [k * 10, v]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
  return {
    size: png.width + 'x' + png.height,
    opaque: opaque,
    avgSat: (sSum / opaque).toFixed(3),
    avgLit: (lSum / opaque).toFixed(3),
    hiSatPix: hiSatPix,
    hiSatPct: (hiSatPix / opaque * 100).toFixed(2),
    hiSatCentroid: hiSatPix ? [(hiSatCX / hiSatPix).toFixed(0), (hiSatCY / hiSatPix).toFixed(0)].join(',') : '-',
    topHues: top3.map(function (t) { return t[0] + '°:' + t[1]; }).join(' ')
  };
}

names.forEach(function (nm) {
  var cur = R + 'assets/icons/ui/' + nm + '.png';
  if (!fs.existsSync(cur)) { console.log(nm, 'NOT FOUND'); return; }
  var out = {};
  try {
    var oldBuf = execSync('git show HEAD:assets/icons/ui/' + nm + '.png', { cwd: R, maxBuffer: 20 * 1024 * 1024 });
    var tmp = R + '.workbuddy/tmp/old_' + nm + '.png';
    fs.writeFileSync(tmp, oldBuf);
    out.old = stats(tmp);
  } catch (e) { out.old = { err: e.message.slice(0, 60) }; }
  out.cur = stats(cur);
  console.log('===== ' + nm + ' =====');
  console.log('  OLD:', JSON.stringify(out.old));
  console.log('  CUR:', JSON.stringify(out.cur));
});
process.exit(0);
