/* probe_v89224_cmp.js — 22-56-35 四象限 vs 现行/旧版地形 比色（v89.224）
   产出：每张图（整图或象限）的 HSV 直方图指纹 + 两两相似度。 */
var fs = require('fs');
var PNG = require('pngjs').PNG;

function fingerprint(im, ox, oy, w, h) {
  /* 返回 12 桶色相直方图（仅取饱和>0.12 的像素）+ 平均 HSL */
  var H = new Array(12).fill(0), n = 0, sr = 0, sg = 0, sb = 0, sat = 0, lum = 0;
  for (var y = oy; y < oy + h; y += 2) for (var x = ox; x < ox + w; x += 2) {
    var i = (im.width * y + x) << 2;
    var r = im.data[i], g = im.data[i + 1], b = im.data[i + 2], a = im.data[i + 3];
    if (a < 128) continue;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var s = mx === 0 ? 0 : (mx - mn) / mx, l = (mx + mn) / 510;
    sr += r; sg += g; sb += b; sat += s; lum += l; n++;
    if (s > 0.12 && mx > 0) {
      var hdeg;
      if (mx === r) hdeg = 60 * (((g - b) / (mx - mn)) % 6); else if (mx === g) hdeg = 60 * ((b - r) / (mx - mn) + 2); else hdeg = 60 * ((r - g) / (mx - mn) + 4);
      if (hdeg < 0) hdeg += 360;
      H[Math.floor(hdeg / 30) % 12]++;
    }
  }
  if (!n) return null;
  var tot = H.reduce(function (a, b) { return a + b; }, 0) || 1;
  return { hist: H.map(function (v) { return v / tot; }), avg: [sr / n, sg / n, sb / n], sat: sat / n, lum: lum / n, n: n };
}
function dist(a, b) {
  var d = 0;
  for (var i = 0; i < 12; i++) d += Math.abs(a.hist[i] - b.hist[i]);
  var c = 0;
  for (var k = 0; k < 3; k++) c += Math.abs(a.avg[k] - b.avg[k]);
  return { hist: (d / 2 * 100).toFixed(1), color: (c / 3).toFixed(1) };
}

var raw = PNG.sync.read(fs.readFileSync('E:/Deepseekdb/assets/icons/raw/A_2x2_grid_of_4_separate_game__2026-09-12T22-56-35.png'));
var hw = raw.width / 2, hh = raw.height / 2;
var quads = { 左上: fingerprint(raw, 0, 0, hw, hh), 右上: fingerprint(raw, hw, 0, hw, hh), 左下: fingerprint(raw, 0, hh, hw, hh), 右下: fingerprint(raw, hw, hh, hw, hh) };
console.log('===== 22-56-35 四象限指纹 =====');
Object.keys(quads).forEach(function (k) {
  var q = quads[k];
  console.log(k + ' 均色 rgb(' + q.avg.map(function (v) { return Math.round(v); }).join(',') + ') 饱和=' + q.sat.toFixed(2) + ' 亮度=' + q.lum.toFixed(2));
  console.log('   直方图(每30°): [' + q.hist.map(function (v) { return (v * 100).toFixed(0); }).join(',') + ']');
});

function scanDir(title, files) {
  console.log('\n===== ' + title + ' vs 四象限 相似度（直方图差% / 均色差 0-255）=====');
  files.forEach(function (f) {
    var name = f.replace(/^.*[\\/]/, '');
    var im;
    try { im = PNG.sync.read(fs.readFileSync(f)); } catch (e) { return; }
    var fp = fingerprint(im, 0, 0, im.width, im.height);
    if (!fp) { console.log(name + ': 全透明'); return; }
    var row = [name];
    Object.keys(quads).forEach(function (k) {
      var d = dist(fp, quads[k]);
      row.push(k + ': ' + d.hist + '%/' + d.color);
    });
    console.log(row.join('  |  '));
  });
}

var terrainNow = ['plain', 'caoyuan', 'forest', 'zhaoze', 'lake', 'desert', 'hill'].map(function (k) { return 'E:/Deepseekdb/assets/icons/ui/ai_terrain_' + k + '.png'; });
var terrainOld = ['plain', 'caoyuan', 'forest', 'zhaoze', 'lake', 'desert', 'hill'].map(function (k) { return 'E:/Deepseekdb/.workbuddy/tmp/terrain_v8942a/ai_terrain_' + k + '.png'; });
scanDir('现行 ai_terrain（v89.42b）', terrainNow);
scanDir('旧版 terrain_v8942a', terrainOld);
/* 另三张 A_2x2 也扫一遍（看它们是什么家族） */
var sibs = fs.readdirSync('E:/Deepseekdb/assets/icons/raw/').filter(function (f) { return /A_2x2.*\.png$/.test(f) && f.indexOf('22-56-35') < 0; }).map(function (f) { return 'E:/Deepseekdb/assets/icons/raw/' + f; });
scanDir('兄弟图（其余 3 张 A_2x2，整图指纹）', sibs);
process.exit(0);
