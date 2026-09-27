'use strict';
/* v89.145 像素体检：3 张实机图 —— 非空 + 关键区域真有色（模型读不了图，用统计当眼睛）
   跑法：node .workbuddy/tools/asset/check_v89145_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
function load(p) { return PNG.sync.read(fs.readFileSync(p)); }
function region(png, x0, y0, x1, y1) {
  var bright = 0, gold = 0, n = 0;
  for (var y = Math.max(0, y0 | 0); y < Math.min(png.height, y1 | 0); y++) {
    for (var x = Math.max(0, x0 | 0); x < Math.min(png.width, x1 | 0); x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      n++;
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 90) bright++;
      if (r > 190 && g > 150 && b < 150 && (r - b) > 60) gold++;
    }
  }
  return { pct: n ? (bright / n * 100) : 0, gold: gold };
}
var S = 'E:/Deepseekdb/.workbuddy/shots/';

console.log('===== ① 背包：顶部冻结 + 物品区滚动（bag-scroll）=====');
var A = load(S + 'v89145-bag-scroll.png');
console.log('  尺寸 ' + A.width + '×' + A.height);
var aAll = region(A, 0, 0, A.width, A.height);
var aTop = region(A, 0, 80, A.width, 200);       /* 页签/分类/排序条带 */
var aBody = region(A, 0, 220, A.width, A.height); /* 物品区 */
console.log('  全图亮 ' + aAll.pct.toFixed(1) + '% · 顶部带 ' + aTop.pct.toFixed(2) + '% · 物品区 ' + aBody.pct.toFixed(2) + '%');
chk('① 非空 + 有内容', aAll.pct > 1 && aAll.pct < 60, aAll.pct.toFixed(1) + '%');
chk('① 顶部带（分类/排序）有内容（可见 = 冻结区还在画面上）', aTop.pct > 1.5, aTop.pct.toFixed(2) + '%');
chk('① 物品区有内容', aBody.pct > 1.5, aBody.pct.toFixed(2) + '%');

console.log('===== ② 商城：少件分类撑满（shop-fill · 1 件巨卡）=====');
var B = load(S + 'v89145-shop-fill.png');
var bAll = region(B, 0, 0, B.width, B.height);
/* 元素截图（整卡 337×**165**，v89.146 口径修正后）+ 逐行量过（实测）：
   三段结构 = 名称/meta（y 20-50）· 图标（y ~90）· 操作行（钉卡底 y 120-160）。
   ⛔ v89.146 起这**不是**巨卡：165 = 满页 4 行的均分行高（"按 4 行均分高度"口径），
   少件分类的卡片高度与满页一致 —— 不再"把单个商品高度拉满"。 */
var bTop = region(B, 0, 0, B.width, 60);
var bFoot = region(B, 0, 115, B.width, B.height);
console.log('  整卡 ' + B.width + '×' + B.height + '（满页均分行高口径）· 整卡亮 ' + bAll.pct.toFixed(1)
  + '% · 名称带 ' + bTop.pct.toFixed(1) + '% · 操作行带 ' + bFoot.pct.toFixed(1) + '%');
chk('② 卡片高 = ' + B.height + 'px（= "按 4 行均分"的行高 · ≥116 且远小于旧巨卡 684）',
  B.height >= 116 && B.height <= 300, B.height + 'px');
/* ⚠️ 不判"图标带"：彩色图标亮度信号时高时低（实测单行 16%、30px 带只 1%），易碎；
   用"整卡亮 + 首尾两段"表达"卡片真画出来了"更稳。 */
chk('② 整卡有内容（整卡亮 >2% 且首尾两段齐：名称带 >3% · 操作行带 >8%）',
  bAll.pct > 2 && bTop.pct > 3 && bFoot.pct > 8,
  bAll.pct.toFixed(1) + '% / ' + bTop.pct.toFixed(1) + '% / ' + bFoot.pct.toFixed(1) + '%');

console.log('===== ③ 商城：满件分类物品区滚动（shop-scroll）=====');
var C = load(S + 'v89145-shop-scroll.png');
var cAll = region(C, 0, 0, C.width, C.height);
var cCats = region(C, 0, 85, C.width, 135);     /* 分类条带（冻结） */
console.log('  尺寸 ' + C.width + '×' + C.height + ' · 全图亮 ' + cAll.pct.toFixed(1) + '% · 分类带 ' + cCats.pct.toFixed(2) + '%');
chk('③ 非空 + 有内容', cAll.pct > 1 && cAll.pct < 60, cAll.pct.toFixed(1) + '%');
chk('③ 分类条带（冻结）有内容', cCats.pct > 1.5, cCats.pct.toFixed(2) + '%');

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
