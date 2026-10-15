/* v89.164 像素体检：两图（出征战术下拉 / 战场智能指示）
   运行：NODE_PATH=".../node_modules" node .workbuddy/tools/asset/check_v89164_shots.js */
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
function meanL(p) { var s = 0, n = p.width * p.height; for (var i = 0; i < p.data.length; i += 4) s += 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2]; return s / n; }

console.log('===== ① 出征面板 · 战术下拉（首项 ⚡ 智能战斗） =====');
var A = load('v89164-tactic-smart.png');
console.log('  ' + A.width + 'x' + A.height + ' · 行组=' + rows(A).length + ' · 金=' + gold(A) + ' · 均亮=' + meanL(A).toFixed(1));
chk('图非空（' + A.width + '×' + A.height + '）', A.width >= 500 && A.height >= 300);
chk('★ 面板多行渲染（行组 ' + rows(A).length + ' ≥ 5）', rows(A).length >= 5);
chk('金色元素在位（金像素 ' + gold(A) + ' ≥ 100）', gold(A) >= 100);
chk('暗色基线（均亮 25~60）', meanL(A) > 25 && meanL(A) < 60);

console.log('===== ② 战场顶栏 · ⚡ 智能指示 =====');
var B = load('v89164-bt-smart.png');
console.log('  ' + B.width + 'x' + B.height + ' · 行组=' + rows(B).length + ' · 金=' + gold(B) + ' · 均亮=' + meanL(B).toFixed(1));
chk('图非空（' + B.width + '×' + B.height + '）', B.width >= 400 && B.height >= 40);
chk('★ 顶栏文字行在位（行组 ' + rows(B).length + ' ≥ 1）', rows(B).length >= 1);
chk('金色"智能"指示在位（金像素 ' + gold(B) + ' ≥ 40）', gold(B) >= 40);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
