/* v89.171 像素体检：选择窗三段态（Lv1 可用 / 用后 / Lv60 全到线）
   判据按实测先量后定：到线态金色像素塌缩（7087 → 139 ≈ 1/51）+ 亮像素降档（9.44% → 3.67%）。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89171_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function st(p) {
  var n = p.width * p.height, sum = 0, bright = 0, gold = 0;
  for (var i = 0; i < p.data.length; i += 4) {
    var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
    var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += L; if (L > 110) bright++;
    if (r > 180 && g > 150 && b < 120 && r - b > 70) gold++;
  }
  var rows = [], cur = null, need = Math.max(3, Math.round(p.width * 0.004));
  for (var y = 0; y < p.height; y++) {
    var c = 0;
    for (var x = 0; x < p.width; x++) { var j = (p.width * y + x) << 2; if (0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2] > 110) c++; }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { rows.push(cur); cur = null; }
  }
  if (cur) rows.push(cur);
  return { w: p.width, h: p.height, mean: sum / n, bright: bright / n, gold: gold, rows: rows.length };
}

var A = st(load('v89171-exp-lv1.png')), B = st(load('v89171-exp-used.png')), C = st(load('v89171-exp-lv60.png'));
console.log('  lv1  ' + A.w + 'x' + A.h + ' 均亮=' + A.mean.toFixed(1) + ' 亮=' + (A.bright * 100).toFixed(2) + '% 金=' + A.gold + ' 行组=' + A.rows);
console.log('  used ' + B.w + 'x' + B.h + ' 均亮=' + B.mean.toFixed(1) + ' 亮=' + (B.bright * 100).toFixed(2) + '% 金=' + B.gold + ' 行组=' + B.rows);
console.log('  lv60 ' + C.w + 'x' + C.h + ' 均亮=' + C.mean.toFixed(1) + ' 亮=' + (C.bright * 100).toFixed(2) + '% 金=' + C.gold + ' 行组=' + C.rows);

chk('三图非空（面板真渲染）', A.w >= 480 && B.w >= 480 && C.w >= 480 && A.h >= 420 && B.h >= 420 && C.h >= 420);
chk('三图多行渲染（行组 ≥ 6 · 标题/信息/卡面/按钮）', A.rows >= 6 && B.rows >= 6 && C.rows >= 6);
chk('暗主题基线（均亮 35~75）', [A, B, C].every(function (s) { return s.mean > 35 && s.mean < 75; }));
chk('★ Lv1 可用态：金色（按钮/金卡）在位（金 ' + A.gold + ' ≥ 4000）', A.gold >= 4000);
chk('★ 用后态仍有可用档（金 ' + B.gold + ' ≥ 4000 · 对照 ①）', B.gold >= 4000);
chk('★ Lv60 全到线：金色塌缩（金 ' + C.gold + ' < Lv1 的 1/5）', C.gold < A.gold / 5);
chk('★ Lv60 全到线：亮像素降档（' + (C.bright * 100).toFixed(2) + '% < Lv1 的 60%）', C.bright < A.bright * 0.6);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
