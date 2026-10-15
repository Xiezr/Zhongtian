'use strict';
/* v89.154 像素体检（先量后定 · 判据取自实测值并留余量）：
   wilds（排序 + 放弃按钮红）/ ask（确认窗红按钮）/ armed（上膛文案变化）
   / convert-open vs convert-back（遮罩态 25.8 → 回界面 43.6 的对照）
   跑法：node .workbuddy/tools/asset/check_v89154_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), path = require('path'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function count(png, test) {
  var c = 0, first = -1, last = -1;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    if (test(png.data[i], png.data[i + 1], png.data[i + 2])) { c++; if (first < 0) first = y; last = y; }
  }
  return { c: c, first: first, last: last };
}
function avgL(png) {
  var s = 0, n = 0;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x += 4) {
    var i = (png.width * y + x) << 2;
    s += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]; n++;
  }
  return s / n;
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
var RED = function (r, g, b) { return r > 150 && r - g > 60 && r - b > 60; };
var BRIGHT = function (r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b > 110; };

console.log('===== ① 附属野地面板（排序 + 放弃按钮） =====');
var W = load('v89154-wilds.png');
chk('① 图存在且尺寸合理', W.width >= 1200 && W.height >= 800, W.width + 'x' + W.height);
var redW = count(W, RED);
chk('① 红色像素 ≥1500（5 行「放弃」按钮·实测 3512）', redW.c >= 1500, 'red=' + redW.c);
chk('① 红色分布到末行（lastY ≥300·实测 344）', redW.last >= 300, 'red lastY=' + redW.last);
var bw = count(W, BRIGHT);
chk('① 亮像素 ≥15000（面板有内容·实测 23272）', bw.c >= 15000, 'bright=' + bw.c);
var rw = textRows(W);
chk('① 文字行组 ≥8（实测 10：标题/表头/5 行/合计）', rw.length >= 8, 'rows=' + rw.length);

console.log('===== ② 放弃确认窗（两段确认） =====');
var A = load('v89154-abandon-ask.png');
var redA = count(A, RED);
chk('② 红按钮存在（red ≥600·实测 1553）', redA.c >= 600, 'red=' + redA.c);
chk('② 红色聚集为一条带（1 个按钮·带高 ≤100·实测 26）', redA.last - redA.first <= 100,
  'band=' + (redA.last - redA.first));
chk('② 文字行组 ≥6（实测 8）', textRows(A).length >= 6, 'rows=' + textRows(A).length);
var B = load('v89154-abandon-armed.png');
var diff = 0;
var dw = Math.min(A.width, B.width), dh = Math.min(A.height, B.height);
for (var y = 0; y < dh; y++) for (var x = 0; x < dw; x++) {
  var i = (A.width * y + x) << 2, j = (B.width * y + x) << 2;
  if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) > 60) diff++;
}
chk('② 上膛后画面显著变化（文案变「再点一次」· 差异像素 ≥300·实测 11654）', diff >= 300, 'diff=' + diff);

console.log('===== ③ 改建：面板 → 回大界面 =====');
var CP = load('v89154-convert-panel.png');
chk('③ 改建面板有内容（亮像素 ≥5000·实测 10670）', count(CP, BRIGHT).c >= 5000, 'bright=' + count(CP, BRIGHT).c);
var CO = load('v89154-convert-open.png');       /* 遮罩态（弹窗打开） */
var CB = load('v89154-convert-back.png');       /* 改建完成，回大界面 */
var ao = avgL(CO), ab = avgL(CB);
chk('③ 遮罩态更暗（弹窗开着·实测 25.8）', ao < 32, 'open avg=' + ao.toFixed(1));
chk('③ 回大界面后亮度回升（弹窗关净·实测 43.6）', ab >= 35 && (ab - ao) >= 10,
  'back avg=' + ab.toFixed(1) + ' open avg=' + ao.toFixed(1) + ' Δ=' + (ab - ao).toFixed(1));
chk('③ 回大界面整页有内容（亮像素 ≥30000·实测 59903）', count(CB, BRIGHT).c >= 30000, 'bright=' + count(CB, BRIGHT).c);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
