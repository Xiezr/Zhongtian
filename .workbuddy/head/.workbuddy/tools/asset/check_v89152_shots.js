'use strict';
/* v89.152 像素体检（先量后定 · §59.3）：未占野地"产出 4 行" vs 已占"无产出"
   ------------------------------------------------------------
   量测口径（726×681 元素截图 · 深色主题）：
     · "文字行" = 该行亮像素（L>110）数 ≥ 行宽×0.4%
     · 未占面板版式 = 8 组：标题 / 守军 / 「产出」标题 / 资源 / 产量加成 / 材料 / 珠宝 / 三键
       实测 y 组：13-41 · 76-87 · 120-131 · 152-164 · 180-193 · 210-221 · 239-251 · 288-326
     · 产出区（y115-265）= 5 组（产出标题 + 4 行）
     · 珠宝行的**金色高亮**（暖亮像素 r>170 && r-b>40 && g>120）：
       未占 y230-260 = 627 个（珠宝名「蜜蜡 · 玉髓 · 天珠」+ 门槛提示）；已占同区 = 0 个
   ⚠️ 判据全部用**绝对计数**（§63.5：百分比会被采样步长骗）。
   跑法：node .workbuddy/tools/asset/check_v89152_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(n, ok, x) {
  if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function lum(png, x, y) {
  var i = (png.width * y + x) << 2;
  return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
}
function textGroups(png, y0, y1, thr) {
  thr = thr || 110;
  var need = Math.max(3, Math.round(png.width * 0.004)), groups = [], cur = null;
  for (var y = y0; y < y1; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) if (lum(png, x, y) > thr) c++;
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
    else if (cur) { groups.push(cur); cur = null; }
  }
  if (cur) groups.push(cur);
  return groups;
}
function warm(png, y0, y1) {
  var c = 0;
  for (var y = y0; y < y1; y++) for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 170 && r - b > 40 && g > 120) c++;
  }
  return c;
}
function brightCount(png) {
  var c = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
  }
  return c;
}

var U = load('v89152-land-unowned.png');
var O = load('v89152-land-owned.png');
console.log('尺寸：unowned ' + U.width + '×' + U.height + ' · owned ' + O.width + '×' + O.height);

chk('① 两图同尺寸且非空（>600px 宽）', U.width === O.width && U.height === O.height && U.width > 600,
  U.width + '×' + U.height);

var gU = textGroups(U, 0, U.height), gO = textGroups(O, 0, O.height);
console.log('  unowned 文字行组 ' + gU.length + '：' + gU.map(function (g) { return g.y0 + '-' + g.y1; }).join(' · '));
console.log('  owned   文字行组 ' + gO.length + '：' + gO.map(function (g) { return g.y0 + '-' + g.y1; }).join(' · '));

chk('② 未占面板版式 = 8 组（标题/守军/产出标题/资源/产量加成/材料/珠宝/按钮）',
  gU.length === 8, 'got ' + gU.length);
var gUprod = textGroups(U, 115, 265), gOprod = textGroups(O, 115, 265);
chk('③ 未占产出区（y115-265）= 5 组（「产出」标题 + 4 行）',
  gUprod.length === 5, 'got ' + gUprod.length + ' → ' + gUprod.map(function (g) { return g.y0; }).join(','));

var wu = warm(U, 230, 262), wo = warm(O, 230, 262);
console.log('  珠宝行金色高亮：unowned y230-262 = ' + wu + ' 个 · owned 同区 = ' + wo + ' 个');
chk('④ 未占面板「珠宝」行真画出来（金色高亮 ≥ 300 个）', wu >= 300, wu + ' 个');
chk('⑤ 已占面板同区**无珠宝行**（金色 = 0 —— 产出整块退役的铁证）', wo === 0, wo + ' 个');

chk('⑥ 未占面板有内容（亮像素 ≥ 5000）', brightCount(U) >= 5000, brightCount(U) + ' px');
chk('⑦ 已占面板有内容（亮像素 ≥ 5000）', brightCount(O) >= 5000, brightCount(O) + ' px');

console.log('\n===== ' + PASS + ' pass / ' + FAIL + ' fail =====');
process.exit(FAIL ? 1 : 0);
