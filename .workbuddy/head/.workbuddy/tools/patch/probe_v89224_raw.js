/* probe_v89224_raw.js — 量化 raw/ 与 atlas 素材（像素统计当眼睛 · v89.224）
   用法：NODE_PATH=... node .workbuddy/tools/patch/probe_v89224_raw.js > out.txt 2>&1 */
var fs = require('fs'), path = require('path');
var PNG = require('pngjs').PNG;
var ROOT = 'E:/Deepseekdb/';

function charsOf(im) {
  var W = 44, H = 22;                       /* ASCII 缩影网格 */
  var out = [];
  for (var ry = 0; ry < H; ry++) {
    var line = '';
    for (var rx = 0; rx < W; rx++) {
      var x0 = Math.floor(rx * im.width / W), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * im.width / W));
      var y0 = Math.floor(ry * im.height / H), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * im.height / H));
      var a = 0, l = 0, n = 0, rs = 0, gs = 0, bs = 0;
      for (var y = y0; y < y1; y += Math.max(1, Math.floor((y1 - y0) / 6)))
        for (var x = x0; x < x1; x += Math.max(1, Math.floor((x1 - x0) / 6))) {
          var i = (im.width * y + x) << 2;
          var al = im.data[i + 3] / 255; a += al;
          var lum = (im.data[i] * 0.299 + im.data[i + 1] * 0.587 + im.data[i + 2] * 0.114) * al;
          l += lum; rs += im.data[i] * al; gs += im.data[i + 1] * al; bs += im.data[i + 2] * al; n++;
        }
      var av = n ? a / n : 0, lv = n && a ? l / a : 0;
      var ch = av < 0.08 ? ' ' : (lv > 150 ? '#' : (lv > 95 ? '*' : (lv > 50 ? '+' : '.')));
      line += ch;
    }
    out.push(line);
  }
  return out.join('\n');
}

function stat(f) {
  var buf = fs.readFileSync(f);
  var im;
  try { im = PNG.sync.read(buf); } catch (e) { console.log('  [无法解析] ' + e.message); return; }
  var opaque = 0, n = im.width * im.height, rs = 0, gs = 0, bs = 0;
  for (var i = 0; i < n; i++) {
    var al = im.data[(i << 2) + 3];
    if (al > 32) { opaque++; rs += im.data[i << 2]; gs += im.data[(i << 2) + 1]; bs += im.data[(i << 2) + 2]; }
  }
  var fr = n ? (opaque / n * 100).toFixed(1) : '0';
  var avg = opaque ? [Math.round(rs / opaque), Math.round(gs / opaque), Math.round(bs / opaque)] : [0, 0, 0];
  console.log('  ' + path.basename(f) + '  [' + im.width + 'x' + im.height + ' · ' + (buf.length / 1024).toFixed(0) + 'KB · 不透明 ' + fr + '% · 均色 rgb(' + avg.join(',') + ')]');
  console.log(charsOf(im).split('\n').map(function (l) { return '   |' + l + '|'; }).join('\n'));
}

function scanDir(title, dir) {
  console.log('\n========== ' + title + ' ==========');
  if (!fs.existsSync(dir)) { console.log('  (不存在)'); return; }
  fs.readdirSync(dir).filter(function (f) { return /\.png$/i.test(f); }).sort().forEach(function (f) { stat(path.join(dir, f)); });
}

scanDir('raw/', ROOT + 'assets/icons/raw');
scanDir('tmp/atlas（美术会话刚从 raw 移入）', ROOT + '.workbuddy/tmp/atlas');
/* 顶层散图（jimeng/AI 生成的大图）只列清单与尺寸，不打 ASCII（太大） */
console.log('\n========== assets/icons 顶层散图 ==========');
fs.readdirSync(ROOT + 'assets/icons').filter(function (f) { return /\.png$/i.test(f); }).sort().forEach(function (f) {
  try {
    var b = fs.readFileSync(path.join(ROOT, 'assets/icons', f));
    var im = PNG.sync.read(b);
    console.log('  ' + f + '  [' + im.width + 'x' + im.height + ' · ' + (b.length / 1024).toFixed(0) + 'KB]');
  } catch (e) { console.log('  ' + f + '  [解析失败]'); }
});
process.exit(0);
