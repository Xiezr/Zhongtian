'use strict';
/* v89.144 像素体检：4 张实机图 —— ① 非空 ② 关键区域真有色
   （模型读不了图，用程序化统计当眼睛：全图亮像素占比 + 目标区域金色像素计数）
   跑法：node .workbuddy/tools/asset/check_v89144_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
function px(png, x, y) { var i = (png.width * y + x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2]]; }
function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
/* 区域统计：亮像素占比 + 金色像素数（金 ≈ r 高 / g 中高 / b 低） */
function region(png, x0, y0, x1, y1) {
  var bright = 0, gold = 0, n = 0;
  for (var y = Math.max(0, y0 | 0); y < Math.min(png.height, y1 | 0); y++) {
    for (var x = Math.max(0, x0 | 0); x < Math.min(png.width, x1 | 0); x++) {
      var c = px(png, x, y); n++;
      if (lum(c) > 90) bright++;
      if (c[0] > 190 && c[1] > 150 && c[2] < 150 && (c[0] - c[2]) > 60) gold++;
    }
  }
  return { pct: n ? (bright / n * 100) : 0, gold: gold, n: n };
}

var S = 'E:/Deepseekdb/.workbuddy/shots/';

console.log('===== ① 军队练兵场扩容页（march-expand）=====');
var A = load(S + 'v89144-march-expand.png');
console.log('  尺寸 ' + A.width + '×' + A.height);
var aAll = region(A, 0, 0, A.width, A.height);
console.log('  全图亮像素 ' + aAll.pct.toFixed(1) + '%');
chk('非空 + 有内容（亮像素 1%~60%）', aAll.pct > 1 && aAll.pct < 60, aAll.pct.toFixed(1) + '%');
/* 页签条（顶部 ~120px）应有金色选中项 */
var aTab = region(A, 0, 60, A.width, 150);
chk('顶部页签条有金色元素（选中态）', aTab.gold > 30, 'gold=' + aTab.gold);

console.log('===== ② 出征页（march-act）=====');
var B = load(S + 'v89144-march-act.png');
var bAll = region(B, 0, 0, B.width, B.height);
console.log('  尺寸 ' + B.width + '×' + B.height + ' · 亮像素 ' + bAll.pct.toFixed(1) + '%');
chk('非空 + 有内容', bAll.pct > 1 && bAll.pct < 60, bAll.pct.toFixed(1) + '%');
/* 下拉行区域（中部）应有边框/文本像素 */
var bMid = region(B, 100, 300, B.width - 100, 620);
chk('正文区（目标 5 行）有内容', bMid.pct > 1.5, bMid.pct.toFixed(1) + '%');

console.log('===== ③ 出征面板行内 [上限][清空]（exp-rows）=====');
var C = load(S + 'v89144-exp-rows.png');
var cAll = region(C, 0, 0, C.width, C.height);
console.log('  尺寸 ' + C.width + '×' + C.height + ' · 亮像素 ' + cAll.pct.toFixed(1) + '%');
chk('非空 + 有内容', cAll.pct > 1 && cAll.pct < 60, cAll.pct.toFixed(1) + '%');
/* 右列（兵种表）应有按钮/边框像素 */
var cR = region(C, Math.round(C.width * 0.62), 200, C.width, C.height - 100);
chk('右侧兵种表区域有内容', cR.pct > 1.5, cR.pct.toFixed(1) + '%');

console.log('===== ④ 战场斗将顶部行（bt-duel）=====');
var D = load(S + 'v89144-bt-duel.png');
var dAll = region(D, 0, 0, D.width, D.height);
console.log('  尺寸 ' + D.width + '×' + D.height + ' · 亮像素 ' + dAll.pct.toFixed(1) + '%');
chk('非空 + 有内容', dAll.pct > 1 && dAll.pct < 60, dAll.pct.toFixed(1) + '%');
/* 顶部条（实机量到 bar 顶 ≈ 104px；取 90~135 一条）应含金色（斗将行金文字 + 左金条） */
var dBand = region(D, 0, 88, D.width, 138);
console.log('  顶部斗将带（y 88~138）金色像素 ' + dBand.gold + ' · 亮 ' + dBand.pct.toFixed(2) + '%');
chk('顶部斗将带真的画出来了（金色像素 ≥ 60）', dBand.gold >= 60, 'gold=' + dBand.gold);
/* 对照：斗将带上方（标题区）金色也应存在（标题本身是金色）—— 只要不是全黑 */
var dHead = region(D, 0, 40, D.width, 88);
chk('弹窗标题区非空', dHead.pct > 0.4, dHead.pct.toFixed(2) + '%');

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
