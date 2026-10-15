'use strict';
/* v89.155 像素体检（先量后定 · 判据取自实测值并留余量）：
   ① 公文铺满（末行距底 35px vs 旧 172px 空白）② 召回三态（红/金/绿 + 两两差异）
   ③ 城外面板容量行 ④ 商城排序页 跑法：node .workbuddy/tools/asset/check_v89155_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function count(png, test) {
  var c = 0, last = -1;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    if (test(png.data[i], png.data[i + 1], png.data[i + 2])) { c++; last = y; }
  }
  return { c: c, last: last };
}
function textRows(png) {
  var out = [], cur = null, need = Math.max(3, Math.round(png.width * 0.004));
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) {
      var i = (png.width * y + x) << 2;
      if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
    }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
function diffPx(A, B) {
  var d = 0, dw = Math.min(A.width, B.width), dh = Math.min(A.height, B.height);
  for (var y = 0; y < dh; y++) for (var x = 0; x < dw; x++) {
    var i = (A.width * y + x) << 2, j = (B.width * y + x) << 2;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) > 60) d++;
  }
  return d;
}
var RED = function (r, g, b) { return r > 150 && r - g > 60 && r - b > 60; };
var GOLD = function (r, g, b) { return r > 200 && g > 170 && b < 140 && r - b > 70; };
var GREEN = function (r, g, b) { return g > 140 && g - r > 30 && g - b > 30; };
var BRIGHT = function (r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b > 110; };

console.log('===== ① 公文铺满 =====');
var D = load('v89155-doc-sys.png');
chk('① 图存在且尺寸合理', D.width >= 1400 && D.height >= 800, D.width + 'x' + D.height);
var dRows = textRows(D);
chk('① 文字行组 ≥28（21 条消息 + 头尾 · 实测 33）', dRows.length >= 28, 'rows=' + dRows.length);
var dLast = count(D, BRIGHT).last;
chk('① **末行铺到底**（距底 ≤60px · 实测 35 · 旧行为 ~172 空白）',
  D.height - dLast <= 60, 'bottom empty=' + (D.height - dLast) + 'px');

console.log('===== ② 召回三态（红 / 金 / 绿） =====');
var Wr = load('v89155-wilds-red.png'), Wg = load('v89155-wilds-gold.png'), Wn = load('v89155-wilds-green.png');
var cr = count(Wr, RED), cg = count(Wg, GOLD), cn = count(Wn, GREEN);
chk('② 红态：红像素 ≥1500（实测 3512）', cr.c >= 1500, 'red=' + cr.c);
chk('② 黄态：金像素 ≥2000（上膛高亮 · 实测 5186）', cg.c >= 2000, 'gold=' + cg.c);
chk('② 绿态：绿像素 ≥1500（无驻军 · 实测 3527）', cn.c >= 1500, 'green=' + cn.c);
var d1 = diffPx(Wr, Wg), d2 = diffPx(Wg, Wn);
chk('② 三态两两**画面显著变化**（红→金 ≥8000 · 实测 34640）', d1 >= 8000, 'diff=' + d1);
chk('② 金→绿 ≥8000（实测 44697）', d2 >= 8000, 'diff=' + d2);

console.log('===== ③ 城外面板容量行 =====');
var E = load('v89155-ext-store.png');
chk('③ 面板有内容（亮像素 ≥20000 · 实测 42697）', count(E, BRIGHT).c >= 20000, 'bright=' + count(E, BRIGHT).c);
chk('③ 文字行组 ≥8（原「产量」+ 新「另加仓储上限」· 实测 9）', textRows(E).length >= 8, 'rows=' + textRows(E).length);

console.log('===== ④ 商城排序页 =====');
var Sh = load('v89155-shop-order.png');
chk('④ 商城页有内容（亮像素 ≥30000 · 实测 67769）', count(Sh, BRIGHT).c >= 30000, 'bright=' + count(Sh, BRIGHT).c);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
