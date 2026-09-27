/* v89.162 像素体检：三张图（六维表 / 城池面板 / 黄金 tip）
   —— 逐行亮度投影数「文字行组」（版式指纹）+ 金色高亮像素（标题/数值）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89162_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function lum(p, x, y) { var i = (p.width * y + x) << 2; return 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2]; }
function rows(p) {
  var out = [], cur = null, need = Math.max(3, Math.round(p.width * 0.004));
  for (var y = 0; y < p.height; y++) {
    var c = 0;
    for (var x = 0; x < p.width; x++) if (lum(p, x, y) > 110) c++;
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
function gold(p) { var c = 0; for (var i = 0; i < p.data.length; i += 4) { var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2]; if (r > 180 && g > 150 && b < 120 && r - b > 70) c++; } return c; }
function cyan(p) { var c = 0; for (var i = 0; i < p.data.length; i += 4) { var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2]; if (g > 150 && b > 150 && r < 140 && g - r > 30) c++; } return c; }

console.log('===== ① 将领详情六维表（内政行含税收加成） =====');
var A = load('v89162-gen-dims.png');
console.log('  ' + A.width + 'x' + A.height + ' · 行组=' + rows(A).length + ' · 金=' + gold(A) + ' · 青=' + cyan(A));
console.log('  行组 y: ' + rows(A).map(function (r) { return r.y0 + '-' + r.y1; }).join(' | '));
chk('图非空（' + A.width + '×' + A.height + '）', A.width >= 200 && A.height >= 120);
chk('★ 六维表 6+ 行文字（行组 ' + rows(A).length + ' ≥ 6）', rows(A).length >= 6);
chk('金色数值/标题在位（金像素 ' + gold(A) + ' ≥ 100）', gold(A) >= 100);

console.log('===== ② 城池面板（城主行悬停全加成） =====');
var B = load('v89162-city-mayor.png');
console.log('  ' + B.width + 'x' + B.height + ' · 行组=' + rows(B).length + ' · 金=' + gold(B));
console.log('  行组 y: ' + rows(B).map(function (r) { return r.y0 + '-' + r.y1; }).join(' | '));
chk('图非空（' + B.width + '×' + B.height + '）', B.width >= 400 && B.height >= 200);
chk('★ 面板多行渲染（行组 ' + rows(B).length + ' ≥ 4）', rows(B).length >= 4);
chk('暗色主题基线（平均亮度 25~60 · 亮像素 0.5%~4%）', (function () {
  var sum = 0, br = 0, n = B.width * B.height;
  for (var i = 0; i < B.data.length; i += 4) {
    var L = 0.2126 * B.data[i] + 0.7152 * B.data[i + 1] + 0.0722 * B.data[i + 2];
    sum += L; if (L > 110) br++;
  }
  var m = sum / n, bp = br / n;
  return m > 25 && m < 60 && bp > 0.005 && bp < 0.04;
})());

console.log('===== ③ 黄金 tip 浮层（分账行） =====');
var C = load('v89162-gold-tip.png');
console.log('  ' + C.width + 'x' + C.height + ' · 行组=' + rows(C).length + ' · 金=' + gold(C) + ' · 青=' + cyan(C));
console.log('  行组 y: ' + rows(C).map(function (r) { return r.y0 + '-' + r.y1; }).join(' | '));
chk('图非空（' + C.width + '×' + C.height + '）', C.width >= 200 && C.height >= 80);
chk('★ tip 多行文字（行组 ' + rows(C).length + ' ≥ 6 · 含分账 6 行 + 合计）', rows(C).length >= 6);
chk('浮层底色存在（亮/暗对比非空）', (function () {
  var s = 0, n = C.width * C.height;
  for (var i = 0; i < C.data.length; i += 4) s += 0.2126 * C.data[i] + 0.7152 * C.data[i + 1] + 0.0722 * C.data[i + 2];
  return (s / n) > 8 && (s / n) < 200;
})());

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
