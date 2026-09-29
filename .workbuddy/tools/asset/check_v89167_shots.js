/* v89.167 像素体检：两图（自动化面板状态行 / 主城多格施工）
   判据按 tmp/measure_v89167.js 实测值定（§59.3 先量后定）。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89167_shots.js */
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

console.log('===== ① 自动化面板（自动升级 · 每城独立状态行） =====');
var A = load('v89167-auto-pane.png');
var sa = stat(A);
console.log('  ' + A.width + 'x' + A.height + ' · 均亮=' + sa.mean.toFixed(1) + ' · 亮像素=' + (sa.bp * 100).toFixed(2) + '% · 金=' + sa.gold);
chk('图非空（' + A.width + '×' + A.height + ' · 整页）', A.width >= 1200 && A.height >= 700);
chk('★ 内容密度在位（亮像素 1%~6% · 面板文字+开关）', sa.bp > 0.01 && sa.bp < 0.06);
chk('金色元素在位（金像素 ' + sa.gold + ' ≥ 500 · 开关/标题）', sa.gold >= 500);
chk('暗色基线（均亮 25~60）', sa.mean > 25 && sa.mean < 60);

console.log('===== ② 主城城内 · 多格施工 =====');
var B = load('v89167-city-building.png');
var sb = stat(B);
console.log('  ' + B.width + 'x' + B.height + ' · 均亮=' + sb.mean.toFixed(1) + ' · 亮像素=' + (sb.bp * 100).toFixed(2) + '% · 金=' + sb.gold);
chk('图非空（' + B.width + '×' + B.height + ' · 整页）', B.width >= 1200 && B.height >= 700);
chk('★ 内容密度在位（亮像素 3%~12% · 棋盘+施工格+文字）', sb.bp > 0.03 && sb.bp < 0.12);
chk('金色元素在位（金像素 ' + sb.gold + ' ≥ 1500 · 顶栏/侧栏/建筑牌）', sb.gold >= 1500);
chk('暗色基线（均亮 25~60）', sb.mean > 25 && sb.mean < 60);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
