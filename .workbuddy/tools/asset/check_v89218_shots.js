/* v89.217/v89.218 像素体检：四张实机图（创建 / 顶栏 / 地图 / 城池）
   判据先量后定：暗色主题基线（均亮 20~90 · 亮像素 0.3%~40%）+ 内容行投影。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function stats(png) {
  var sum = 0, bright = 0, n = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    sum += L; n++;
    if (L > 120) bright++;
  }
  return { avg: sum / n, brightPct: bright * 100 / n };
}
/* 逐行投影：某行亮像素 ≥ 行宽×0.4% 记一"文字行" */
function textRows(png) {
  var rows = 0;
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 120) c++;
    }
    if (c > png.width * 0.004) rows++;
  }
  return rows;
}
var A = read('v89218-create.png'), B2 = read('v89218-nav.png'), C = read('v89218-map.png'), D = read('v89218-city.png');
chk('① 四张图都非空且 1600×1000',
  !!A && !!B2 && !!C && !!D
  && [A, B2, C, D].every(function (x) { return x.width === 1600 && x.height === 1000; }),
  [A, B2, C, D].map(function (x) { return x ? x.width + 'x' + x.height : 'null'; }).join(' / '));
if (A && B2 && C && D) {
  [['创建', A], ['顶栏', B2], ['地图', C], ['城池', D]].forEach(function (pair) {
    var s = stats(pair[1]);
    /* 先量后定：地图视图是**浅色调**画布（沙原/荒地配色 · 实测均亮 99.7 / 亮 41.2%）——
       UI 三图走暗色基线，地图单独放宽到 40~140 / ≤60%。 */
    var isMap = pair[0] === '地图';
    var ok = isMap
      ? (s.avg >= 40 && s.avg <= 140 && s.brightPct <= 60)
      : (s.avg >= 20 && s.avg <= 90 && s.brightPct >= 0.3 && s.brightPct <= 40);
    chk('②' + pair[0] + ' 图基线（' + (isMap ? '地图浅色 40~140 / ≤60%' : '暗色 20~90 / 0.3%~40%') + '）',
      ok, 'avg=' + s.avg.toFixed(1) + ' bright=' + s.brightPct.toFixed(1) + '%');
  });
  chk('③ 创建图有文字行（chip 行等 ≥ 8 行）', textRows(A) >= 8, textRows(A) + ' 行');
  chk('④ 地图图内容占比显著（≥ 25% · 地图铺满）', stats(C).brightPct >= 25, stats(C).brightPct.toFixed(1) + '%');
  chk('⑤ 城池图有文字行（侧栏/面板 ≥ 10 行）', textRows(D) >= 10, textRows(D) + ' 行');
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
