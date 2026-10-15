/* v89.165 像素体检：三张实机图（判据按 tmp/measure_v89165.js 实测值定 · §59.3 先量后定）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89165_shots.js */
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

console.log('===== ① 指挥战斗清单（含行军段读秒） =====');
var A = load('v89165-battle-list.png');
var sa = stat(A), ra = rows(A);
console.log('  ' + A.width + 'x' + A.height + ' · 均亮=' + sa.mean.toFixed(1) + ' · 金=' + sa.gold + ' · 行组=' + ra.length);
chk('图非空（' + A.width + '×' + A.height + '）', A.width >= 400 && A.height >= 200);
chk('★ 清单多行渲染（行组 ' + ra.length + ' ≥ 4 · 标题/两段/行）', ra.length >= 4);
chk('金色元素在位（金像素 ' + sa.gold + ' ≥ 80 · 标题与键）', sa.gold >= 80);
chk('暗色基线（均亮 25~60）', sa.mean > 25 && sa.mean < 60);

console.log('===== ② 募兵面板 · 募兵队列（余 X 读秒） =====');
var B = load('v89165-troops-live.png');
var sb = stat(B), rb = rows(B);
console.log('  ' + B.width + 'x' + B.height + ' · 均亮=' + sb.mean.toFixed(1) + ' · 金=' + sb.gold + ' · 行组=' + rb.length);
chk('图非空（' + B.width + '×' + B.height + '）', B.width >= 400 && B.height >= 200);
chk('★ 面板多行渲染（行组 ' + rb.length + ' ≥ 5）', rb.length >= 5);
chk('金色元素在位（金像素 ' + sb.gold + ' ≥ 500 · 兵种卡/按钮）', sb.gold >= 500);
chk('暗色基线（均亮 25~60）', sb.mean > 25 && sb.mean < 60);

console.log('===== ③ 军务烽火页（整页 · 来袭剩余读秒） =====');
var C = load('v89165-beacon-live.png');
var sc = stat(C);
console.log('  ' + C.width + 'x' + C.height + ' · 均亮=' + sc.mean.toFixed(1) + ' · 亮像素=' + (sc.bp * 100).toFixed(2) + '% · 金=' + sc.gold);
chk('图非空（' + C.width + '×' + C.height + ' · 整页 1600×1000）', C.width >= 1200 && C.height >= 700);
chk('★ 内容密度在位（亮像素 0.5%~5% · 表格+文字）', sc.bp > 0.005 && sc.bp < 0.05);
chk('金色元素在位（金像素 ' + sc.gold + ' ≥ 1000 · 标题栏/徽标）', sc.gold >= 1000);
chk('暗色基线（均亮 25~60）', sc.mean > 25 && sc.mean < 60);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
