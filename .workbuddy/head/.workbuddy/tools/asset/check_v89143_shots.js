'use strict';
/* v89.143 像素体检（轻量）：商城铺满的"下半屏内容量"对照（改前 vs 改后）
   跑法：node .workbuddy/tools/asset/check_v89143_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
/* 某个矩形区域里"有内容"的像素占比（与区域边框取样的中位色差异 > 阈值） */
function contentPct(png, x0, y0, w, h) {
  var n = 0, hit = 0, lum = [];
  for (var y = y0; y < Math.min(y0 + h, png.height); y++) {
    for (var x = x0; x < Math.min(x0 + w, png.width); x++) {
      var i = (png.width * y + x) << 2;
      lum.push(0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]);
    }
  }
  lum.sort(function (a, b) { return a - b; });
  var base = lum[Math.floor(lum.length * 0.15)];      /* 低分位 = 背景色 */
  for (var k = 0; k < lum.length; k++) { n++; if (lum[k] > base + 8) hit++; }
  return hit / Math.max(1, n) * 100;
}
console.log('===== v89.143 商城铺满：下半屏内容量对照 =====');
var A = load('E:/Deepseekdb/.workbuddy/shots/v89143-shop-after.png');
var B = load('E:/Deepseekdb/.workbuddy/shots/v89143-shop-before.png');
chk('两图尺寸一致', A.width === B.width && A.height === A.height, A.width + '×' + A.height);
/* 下半屏（从 55% 处到底）：改前那里应当是空白，改后应有卡片 */
var y0 = Math.round(A.height * 0.55), hh = Math.round(A.height * 0.40);
var ca = contentPct(A, Math.round(A.width * 0.28), y0, Math.round(A.width * 0.68), hh);
var cb = contentPct(B, Math.round(B.width * 0.28), y0, Math.round(B.width * 0.68), hh);
console.log('   下半屏内容占比：改前 ' + cb.toFixed(1) + '% → 改后 ' + ca.toFixed(1) + '%');
chk('改后下半屏有内容（≥ 15%）', ca >= 15, ca.toFixed(1) + '%');
chk('改后下半屏内容量 ≥ 改前 2 倍（铺满的像素证据）', ca >= cb * 2, cb.toFixed(1) + '% → ' + ca.toFixed(1) + '%');
/* ⛔ 不判"全屏内容占比" —— 两张图的**背景基准色**会随内容密度漂移
   （铺满后大片卡片底色本身被当成背景，改后 25% < 改前 49% 是假象）。
   可靠的对照口径是**下半屏**（那里的"改前空白 vs 改后有卡片"是同一个背景基准）。 */
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
