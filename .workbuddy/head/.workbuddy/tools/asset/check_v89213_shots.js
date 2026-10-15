/* v89.213 像素体检：分页条「整体居中」（底栏 + 弹窗）
   判据全部先量后定（改前/改后对照 · 源数据见交付文档）。
   对照图：v89213-pre-*.png = 改前（三栏分散 · 换备份法出图）· v89213-*.png = 改后。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) {
  try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; }
}
/* 区亮像素（底栏带 y950-1000 视口） */
function zone(png, x0, x1) {
  var c = 0;
  for (var y = 950; y < Math.min(1000, png.height); y++) {
    for (var x = x0; x < Math.min(x1, png.width); x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
  }
  return c;
}
/* 首/末内容列（给定带 · 列内亮 ≥ minC） */
function edges(png, x0, x1, y0, y1, thr, minC) {
  var first = -1, last = -1;
  for (var x = x0; x < Math.min(x1, png.width); x++) {
    var c = 0;
    for (var y = y0; y < Math.min(y1, png.height); y++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > thr) c++;
    }
    if (c >= (minC || 1)) { if (first < 0) first = x; last = x; }
  }
  return { first: first, last: last };
}

/* ① 底栏商场（改后）：内容集中在中部 · 左侧不再有分页内容 */
(function () {
  var png = read('v89213-shop.png');
  if (!png) return chk('① 底栏商场（缺图）', false);
  var L = zone(png, 200, 500), M = zone(png, 520, 1040);
  var e = edges(png, 232, 1480, 950, 1000, 90, 2);
  console.log('    [shop] 左区[200,500]=' + L + ' 中区[520,1040]=' + M + ' 首列=' + e.first + ' 末列=' + e.last);
  chk('①a 左区近乎清空（' + L + ' ≤ 150 · 改前 1797 → 分散消除）', L <= 150, 'L=' + L);
  chk('①b 内容集中中部（中区 ' + M + ' ≥ 2000 · 改前 359）', M >= 2000, 'M=' + M);
  chk('①c 内容左缘 ' + e.first + ' ≥ 550（不再侵入左侧 · 改前 244）', e.first >= 550, 'first=' + e.first);
})();

/* ② 底栏商场 · 对照（改前图）：确认"分散 + 重叠"的历史形态（防平凡解） */
(function () {
  var png = read('v89213-pre-shop.png');
  if (!png) return chk('② 改前对照图（缺图 · 对照判据跳过）', false);
  var L = zone(png, 200, 500), M = zone(png, 520, 1040);
  var e = edges(png, 232, 1480, 950, 1000, 90, 2);
  console.log('    [pre-shop] 左区=' + L + ' 中区=' + M + ' 首列=' + e.first);
  chk('②a 改前左区确实有内容（' + L + ' ≥ 1500 · 重叠实证 1797）', L >= 1500, 'L=' + L);
  chk('②b 改前内容贴左（首列 ' + e.first + ' ≤ 300）', e.first <= 300, 'first=' + e.first);
})();

/* ③ 底栏满数字页（改后）：最宽形态同样集中 · 对照改前满页 */
(function () {
  var png = read('v89213-full.png');
  var pre = read('v89213-pre-full.png');
  if (!png) return chk('③ 底栏满页（缺图）', false);
  var L = zone(png, 200, 500), M = zone(png, 520, 1040);
  var Lp = pre ? zone(pre, 200, 500) : -1;
  console.log('    [full] 左区=' + L + ' 中区=' + M + ' · [pre-full] 左区=' + Lp);
  chk('③a 满页左区清空（' + L + ' ≤ 150 · 改前 ' + Lp + '）', L <= 150, 'L=' + L);
  chk('③b 满页内容集中中部（' + M + ' ≥ 3000 · 改前 441）', M >= 3000, 'M=' + M);
  chk('③c 对照：改前满页左区有内容（' + Lp + ' ≥ 2000 · 3703）', Lp >= 2000, 'Lp=' + Lp);
})();

/* ④ 弹窗分页条（y205-240 带）：内容两端收进中部（改前 435 → 改后 585） */
(function () {
  var png = read('v89213-modal.png'), pre = read('v89213-pre-modal.png');
  if (!png) return chk('④ 弹窗图（缺图）', false);
  function bandBright(p, y0, y1) {
    var c = 0;
    for (var y = y0; y < y1; y++) {
      for (var x = 345; x < 1245; x++) {
        var i = (y * p.width + x) * 4;
        var L = 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
        if (L > 90) c++;
      }
    }
    return c;
  }
  var ea = edges(png, 345, 1245, 205, 240, 90, 2);
  var ep = pre ? edges(pre, 345, 1245, 205, 240, 90, 2) : { first: -1 };
  var ba = bandBright(png, 205, 240);
  console.log('    [modal] 首列=' + ea.first + ' 带亮=' + ba + ' · [pre-modal] 首列=' + ep.first);
  chk('④a 弹窗分页条渲染（带亮 ' + ba + ' ≥ 300）', ba >= 300, 'b=' + ba);
  chk('④b 弹窗内容左缘 ' + ea.first + ' ≥ 480（改前 ' + ep.first + ' · 两端收进中部）',
    ea.first >= 480 && (ep.first < 0 || ep.first <= 420), 'a=' + ea.first + ' p=' + ep.first);
})();

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
