/* v89.166 像素体检：两图（城池面板 / 点击后城内大界面）
   判据按 tmp/measure_v89166.js 实测值定（§59.3 先量后定）。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89166_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function stat(p) {
  var sum = 0, n = p.width * p.height, bright = 0, gold = 0;
  for (var i = 0; i < p.data.length; i += 4) {
    var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
    var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += L; if (L > 110) bright++;
    if (r > 180 && g > 150 && b < 120 && r - b > 70) gold++;
  }
  return { mean: sum / n, bp: bright / n, gold: gold };
}
function rows(p) {
  var out = [], cur = null, need = Math.max(3, Math.round(p.width * 0.004));
  for (var y = 0; y < p.height; y++) {
    var c = 0;
    for (var x = 0; x < p.width; x++) { var j = (p.width * y + x) << 2; if (0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2] > 110) c++; }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

console.log('===== ① 城池面板（含「进入城池」键） =====');
var A = load('v89166-city-panel.png');
var sa = stat(A), ra = rows(A);
console.log('  ' + A.width + 'x' + A.height + ' · 均亮=' + sa.mean.toFixed(1) + ' · 亮像素=' + (sa.bp * 100).toFixed(2) + '% · 金=' + sa.gold + ' · 行组=' + ra.length);
chk('图非空（' + A.width + '×' + A.height + '）', A.width >= 400 && A.height >= 300);
chk('★ 面板多行渲染（行组 ' + ra.length + ' ≥ 8 · 城名/资源/操作）', ra.length >= 8);
chk('金色元素在位（金像素 ' + sa.gold + ' ≥ 500 · 「进入城池」金键等）', sa.gold >= 500);
chk('暗色基线（均亮 25~60）', sa.mean > 25 && sa.mean < 60);

console.log('===== ② 点击后 · 城内大界面（整页） =====');
var B = load('v89166-city-entered.png');
var sb = stat(B);
console.log('  ' + B.width + 'x' + B.height + ' · 均亮=' + sb.mean.toFixed(1) + ' · 亮像素=' + (sb.bp * 100).toFixed(2) + '% · 金=' + sb.gold);
chk('图非空（' + B.width + '×' + B.height + ' · 整页 1600×1000）', B.width >= 1200 && B.height >= 700);
chk('★ 内容密度在位（亮像素 1%~10% · 城内棋盘+文字）', sb.bp > 0.01 && sb.bp < 0.10);
chk('金色元素在位（金像素 ' + sb.gold + ' ≥ 1000 · 顶栏/侧栏/建筑牌）', sb.gold >= 1000);
chk('暗色基线（均亮 25~60）', sb.mean > 25 && sb.mean < 60);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
