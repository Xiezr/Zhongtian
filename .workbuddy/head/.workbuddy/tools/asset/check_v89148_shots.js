'use strict';
/* v89.148 像素体检：战斗界面（v89148-bt-after.png）——
   非空 + 上半（战场示意图带）与下半（播报带）都有内容 + 顶部**没有**斗将行金带
   跑法：node .workbuddy/tools/asset/check_v89148_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) { if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); } }
var png = PNG.sync.read(fs.readFileSync('E:/Deepseekdb/.workbuddy/shots/v89148-bt-after.png'));
function band(y0, y1) {
  var bright = 0, gold = 0, n = 0;
  for (var y = Math.max(0, y0); y < Math.min(png.height, y1); y++) {
    for (var x = 0; x < png.width; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      n++;
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 90) bright++;
      if (r > 190 && g > 150 && b < 150 && (r - b) > 60) gold++;
    }
  }
  return { pct: n ? bright / n * 100 : 0, gold: gold };
}
console.log('尺寸 ' + png.width + '×' + png.height);
/* 实机量到：wrap 766 · top 38 · board 339 · log 383 —— 弹窗标题在 y≈40-80 一带 */
var head = band(30, 85);                 /* 弹窗标题带 */
var board = band(90, 420);               /* 上半：战场示意图 + 两侧列表 */
var log = band(430, 860);                /* 下半：回合播报（底部 1/2） */
console.log('  标题带 ' + head.pct.toFixed(2) + '% · 上半（战场）' + board.pct.toFixed(2)
  + '% · 下半（播报）' + log.pct.toFixed(2) + '%');
chk('非空 + 有内容', head.pct > 0.3 && board.pct > 0.5 && log.pct > 0.5);
chk('上半（战场示意图 + 列表）有内容', board.pct > 0.5, board.pct.toFixed(2) + '%');
chk('下半（回合播报 · 底部二分之一）有内容', log.pct > 0.5, log.pct.toFixed(2) + '%');
/* 顶部斗将行已退役：y 88-135 那条"金色左条+金文字"的带，金色应远低于旧值（旧实测 1832） */
var oldBar = band(88, 138);
console.log('  旧斗将行位置（y88-138）金色 ' + oldBar.gold + '（v89.144 旧实测 1832）');
/* ⚠️ 这个位置现在是**战场上半区**（列表表头/将领行/数字都带金）——
   残留金色 516 属正常；判据取"显著低于旧值"（< 1/2 = 916），真正的"无斗将行"由
   实机脚本的 DOM 判据（.bt-duelbar 不存在）保证。 */
chk('顶部**无**斗将金带（金色像素 < 旧值一半 916）', oldBar.gold < 916, 'gold=' + oldBar.gold);
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
