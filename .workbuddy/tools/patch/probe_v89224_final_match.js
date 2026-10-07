/* probe_v89224_final_match.js — 16 象限 × 全资产匹配（v89.224 · 终局判定）
   输出每象限 top-3 最相似资产（36×36 白底合成 · 平均绝对差）。 */
var fs = require('fs'), path = require('path');
var PNG = require('pngjs').PNG;
var RAW = 'E:/Deepseekdb/assets/icons/raw/';
var N = 36;

function loadVec(file) {
  var im;
  try { im = PNG.sync.read(fs.readFileSync(file)); } catch (e) { return null; }
  var v = new Float64Array(N * N * 3);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var sx = Math.min(im.width - 1, Math.floor(x * im.width / N)), sy = Math.min(im.height - 1, Math.floor(y * im.height / N));
    var i = (im.width * sy + sx) << 2, a = im.data[i + 3] / 255;
    var o = (y * N + x);
    v[o * 3] = im.data[i] * a + 255 * (1 - a);
    v[o * 3 + 1] = im.data[i + 1] * a + 255 * (1 - a);
    v[o * 3 + 2] = im.data[i + 2] * a + 255 * (1 - a);
  }
  return v;
}
/* 象限向量：从大图裁剪象限后降采样 */
function loadQuad(file, qx, qy) {
  var im = PNG.sync.read(fs.readFileSync(file));
  var hw = im.width / 2, hh = im.height / 2, ox = qx * hw, oy = qy * hh;
  var v = new Float64Array(N * N * 3);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var sx = ox + Math.min(hw - 1, Math.floor(x * hw / N)), sy = oy + Math.min(hh - 1, Math.floor(y * hh / N));
    var i = (im.width * sy + sx) << 2, a = im.data[i + 3] / 255;
    var o = (y * N + x);
    v[o * 3] = im.data[i] * a + 255 * (1 - a);
    v[o * 3 + 1] = im.data[i + 1] * a + 255 * (1 - a);
    v[o * 3 + 2] = im.data[i + 2] * a + 255 * (1 - a);
  }
  return v;
}
function mad(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }

/* 参考池 */
var refs = [];
['assets/icons/ui', 'assets/icons/ui/_gold_backup', 'assets/icons/ui_normalized'].forEach(function (d) {
  var dir = 'E:/Deepseekdb/' + d;
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(function (f) { return /\.png$/i.test(f); }).forEach(function (f) {
    var v = loadVec(path.join(dir, f));
    if (v) refs.push({ name: d.split('/').pop() + '/' + f, v: v });
  });
});
console.log('参考池: ' + refs.length + ' 张\n');

fs.readdirSync(RAW).filter(function (f) { return /^A_2x2.*\.png$/i.test(f); }).sort().forEach(function (f) {
  console.log('########## ' + f + ' ##########');
  [['左上', 0, 0], ['右上', 1, 0], ['左下', 0, 1], ['右下', 1, 1]].forEach(function (q) {
    var v = loadQuad(RAW + f, q[1], q[2]);
    var top = refs.map(function (r) { return { n: r.name, d: mad(v, r.v) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
    console.log('  ' + q[0] + ' → ' + top.map(function (t) { return t.n + ' (' + t.d.toFixed(1) + ')'; }).join('  ·  '));
  });
});
process.exit(0);
