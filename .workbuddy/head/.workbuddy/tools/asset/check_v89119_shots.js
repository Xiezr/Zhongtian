/* v89.150：⛔「回合纪要」板块已退役（老板 3）—— 本脚本第 ② 项的判据（下半区=纪要）不再成立，
   保留作历史参考，不再作为回归依据。 */
/* ============================================================
 * check_v89119_shots.js — v89.119 截图体检（像素统计当眼睛）
 *   判据（只挡"空白图 / 没渲染出来"，观感由人拍板）：
 *     ① 每张图非空（尺寸 > 1200 且文件 > 20KB）
 *     ② 平均亮度 18~80（暗色主题基线；全黑/全白即异常）
 *     ③ 亮像素占比 0.4%~32%
 *     ④ ② 战报图：下半区（纪要/损耗表所在）也要有内容——防"只画了上半截"
 * 用法：node .workbuddy/tools/asset/check_v89119_shots.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) {
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}
function load(f) {
  var p = path.join(R, '.workbuddy/shots', f);
  if (!fs.existsSync(p)) return null;
  return { png: PNG.sync.read(fs.readFileSync(p)), bytes: fs.statSync(p).size };
}
function stat(png, x0, x1, y0, y1) {
  var lum = 0, bright = 0, tot = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      lum += L; tot++; if (L > 90) bright++;
    }
  }
  return { lum: lum / Math.max(1, tot), brightPct: 100 * bright / Math.max(1, tot) };
}
var bad = [];
[['v89119-battle-round-log.png', '① 实时战斗回合记录'],
 ['v89119-report-counter.png', '② 战报正文（配对形态）']].forEach(function (f) {
  var L = load(f[0]);
  if (!L) { bad.push(f[0] + ' 缺图'); console.log('  ❌ ' + f[0] + ' 缺图'); return; }
  var s = stat(L.png, 0, L.png.width, 0, L.png.height);
  var ok = L.png.width > 1200 && L.png.height > 700 && L.bytes > 20000
    && s.lum > 18 && s.lum < 80 && s.brightPct > 0.4 && s.brightPct < 32;
  console.log((ok ? '  ✅ ' : '  ❌ ') + f[1] + '　' + L.png.width + '×' + L.png.height + '　'
    + (L.bytes / 1024).toFixed(0) + 'KB　亮度 ' + s.lum.toFixed(1) + '　亮像素 ' + s.brightPct.toFixed(2) + '%');
  if (!ok) bad.push(f[0]);
  /* ④ 战报图下半区也要有内容 */
  if (f[0].indexOf('report') >= 0) {
    var s2 = stat(L.png, 0, L.png.width, Math.round(L.png.height * 0.55), L.png.height);
    var ok2 = s2.brightPct > 0.3;
    console.log((ok2 ? '  ✅ ' : '  ❌ ') + '② 下半区（回合纪要 / 兵种损耗表）亮像素 '
      + s2.brightPct.toFixed(2) + '%');
    if (!ok2) bad.push(f[0] + '-lower');
  }
});
console.log(bad.length ? ('\n⚠ 未过：' + bad.join('、')) : '\n截图体检通过');
process.exit(bad.length ? 1 : 0);
