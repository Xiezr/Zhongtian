/* ============================================================
 * check_v89132_shots.js — v89.132 截图体检（像素统计当眼睛）
 *   判据：
 *     ① 每张主图非空（尺寸 > 1200×700 · > 20KB）+ 平均亮度 18~80（暗色主题基线）
 *     ② 军务处图：**左列与右列各有内容**（两营左右分列的直接证据）
 *     ③ 缩略图：图中含**朱红像素**（我城红点 #ff3a2a）+ 有亮像素（城名/波纹层在画）
 *     ④ 底部条特写：含朱红像素（38px 图上我城点醒目）
 * 用法：node .workbuddy/tools/asset/check_v89132_shots.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) {
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}
function load(f) {
  var p = path.join(R, '.workbuddy/shots', f);
  if (!fs.existsSync(p)) return null;
  return { png: PNG.sync.read(fs.readFileSync(p)), bytes: fs.statSync(p).size };
}
function stat(png, x0, x1, y0, y1) {
  var lum = 0, bright = 0, tot = 0, red = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += L; tot++; if (L > 90) bright++;
      if (r > 200 && g < 110 && b < 100) red++;
    }
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot), red: red };
}

console.log('== ① 主图基线（非空 / 亮度）==');
[['v89132-affairs.png', '军务处两营'],
 ['v89132-overview.png', '军务总览四段'],
 ['v89132-xiaochang.png', '练兵场面板（节钺入口）'],
 ['v89132-hostel.png', '招贤馆面板（节钺入口）'],
 ['v89132-jieyue.png', '节钺面板']].forEach(function (it) {
  var L = load(it[0]);
  if (!L) { chk(it[1] + ' 图存在', false, '缺 ' + it[0]); return; }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk(it[1] + '：非空 + 亮度基线', L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000
    && s.lum > 18 && s.lum < 80 && s.brightPct > 0.4 && s.brightPct < 32,
    L.png.width + 'x' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮度 ' + s.lum.toFixed(1)
    + ' · 亮像素 ' + s.brightPct.toFixed(1) + '%');
});
/* ⚠️ 缩略图（天下大势）是**图像型**页面：整屏铺的是一张彩图（地形 × 州染），
   不是暗色 UI —— 亮度天然高，基线要另设（否则会把"正常画面"判成异常）。
   判据：亮度 40~140、亮像素 5%~75%（能挡住"全黑/全白"即可）。 */
(function () {
  var L = load('v89132-minimap.png');
  if (!L) { chk('缩略图存在', false, '缺 v89132-minimap.png'); return; }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk('天下大势缩略图：非空 + 图像型亮度基线', L.png.width > 1200 && L.png.height > 700
    && L.bytes > 20000 && s.lum > 40 && s.lum < 140 && s.brightPct > 5 && s.brightPct < 75,
    L.png.width + 'x' + L.png.height + ' · ' + Math.round(L.bytes / 1024) + 'KB · 亮度 ' + s.lum.toFixed(1)
    + ' · 亮像素 ' + s.brightPct.toFixed(1) + '%');
})();

console.log('== ② 军务处：两列各有内容（左右分列的直接证据）==');
(function () {
  var L = load('v89132-affairs.png');
  if (!L) return;
  var W = L.png.width, H = L.png.height;
  /* 两卡在 1440 画布上：c0 [140,1238] c1 [1248,1520] → 按比例取"左卡中段 / 右卡中段"两块窄带 */
  var l1 = stat(L.png, Math.round(W * 0.10), Math.round(W * 0.55), Math.round(H * 0.18), Math.round(H * 0.85));
  var r1 = stat(L.png, Math.round(W * 0.60), Math.round(W * 0.92), Math.round(H * 0.18), Math.round(H * 0.85));
  chk('左列（伤兵营）有内容', l1.brightPct > 0.8, '亮像素 ' + l1.brightPct.toFixed(2) + '%');
  chk('右列（俘虏营）有内容', r1.brightPct > 0.8, '亮像素 ' + r1.brightPct.toFixed(2) + '%');
})();

console.log('== ③ 缩略图：朱红我城点 + 内容在画 ==');
(function () {
  var L = load('v89132-minimap.png');
  if (!L) return;
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  chk('含朱红像素（我城红点 #ff3a2a）', s.red >= 120, '红像素 ' + s.red);
  chk('有亮像素（城名层 / 波纹层在画）', s.brightPct > 0.3, '亮像素 ' + s.brightPct.toFixed(2) + '%');
})();

console.log('== ④ 底部条 38px 特写：红点醒目 ==');
(function () {
  var L = load('v89132-mini38.png');
  if (!L) { chk('底部条特写存在', false, '缺图'); return; }
  /* ⚠️ 底部小图的我城点带 **1Hz 闪烁**（alpha 0.42 ↔ 1）——特写恰好抓在暗相位时，
     严格红（r>200,g<110）只剩 1~2 px。判据改用**暖红系**（与背景地形色区分即可）：
     亮相位 rgb(255,58,42) ✓ / 暗相位混合后 rgb(207,116,75) ✓（r-g≈91、r-b≈132）。 */
  var red = 0;
  for (var y = 0; y < L.png.height; y++) {
    for (var x = 0; x < L.png.width; x++) {
      var i = (L.png.width * y + x) << 2;
      var r = L.png.data[i], g = L.png.data[i + 1], b = L.png.data[i + 2];
      if (r > 180 && (r - g) > 50 && (r - b) > 70) red++;
    }
  }
  chk('特写图非空（≥30px）', L.png.width >= 30 && L.png.height >= 30, L.png.width + 'x' + L.png.height);
  chk('含暖红像素（我城点在 38px 图上看得见，闪烁两相位兼容）', red >= 2, '暖红像素 ' + red);
})();

console.log(FAIL ? '\n✗ 有 ' + FAIL + ' 项未达标' : '\n✓ 全项达标');
process.exit(FAIL ? 1 : 0);
