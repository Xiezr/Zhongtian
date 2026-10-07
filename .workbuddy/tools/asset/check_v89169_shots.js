/* v89.169 像素体检：围墙 0 级虚影环（三图对照）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89169_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function meanL(p) {
  var s = 0; for (var i = 0; i < p.data.length; i += 4) s += 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  return s / (p.width * p.height);
}
/* 墙环条带（clip 四边 42px 框内）的像素统计 */
function band(p) {
  var W = p.width, H = p.height, gold = 0, goldLum = 0, earth = 0;
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    if (!(x < 42 || x > W - 43 || y < 42 || y > H - 43)) continue;
    var i = (W * y + x) << 2, r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
    var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (r > 85 && r - b > 45 && g - b > 18 && r >= g) { gold++; goldLum += L; }
    if (r >= g && g >= b && r - b >= 6 && r - b <= 42 && r > 45 && r < 150 && L < 130) earth++;
  }
  return { gold: gold, goldLum: gold ? goldLum / gold : 0, earth: earth };
}

console.log('===== 图基线（暗主题 · 三图同框） =====');
var A = load('v89169-wall-lv0.png'), B = load('v89169-wall-lv3.png'), C = load('v89169-wall-hover.png');
[A, B, C].forEach(function (p, i) {
  var nm = ['0级虚影', 'Lv3实墙', '悬停提亮'][i];
  chk(nm + ' 图非空（' + p.width + '×' + p.height + '）', p.width >= 900 && p.height >= 700);
  chk(nm + ' 暗主题基线（均亮 35~75 · 实测 ' + meanL(p).toFixed(1) + '）', meanL(p) > 35 && meanL(p) < 75);
});
var bA = band(A), bB = band(B), bC = band(C);
console.log('  条带统计：lv0 金=' + bA.gold + '（亮 ' + bA.goldLum.toFixed(1) + '）夯土=' + bA.earth
  + ' · lv3 金=' + bB.gold + ' 夯土=' + bB.earth
  + ' · hover 金=' + bC.gold + '（亮 ' + bC.goldLum.toFixed(1) + '）');

console.log('\n===== ① 0 级 = 虚线虚影（金线在、实墙带不在） =====');
chk('★ 虚影虚线可见（条带金 ' + bA.gold + ' ≥ 4000）', bA.gold >= 4000);
chk('无实墙带（条带夯土 ' + bA.earth + ' < 12000）', bA.earth < 12000);

console.log('\n===== ② Lv3 = 实墙带登场（对照 lv0） =====');
chk('★ 实墙夯土带出现（条带夯土 ' + bB.earth + ' ≥ 30000）', bB.earth >= 30000);
chk('对照：lv3 夯土 ≥ lv0 的 5 倍（' + bB.earth + ' vs ' + bA.earth + '）', bB.earth >= bA.earth * 5);

console.log('\n===== ③ 悬停 = 虚影提亮（金线均亮上跳） =====');
chk('★ 悬停提亮可测（金均亮 ' + bC.goldLum.toFixed(1) + ' − ' + bA.goldLum.toFixed(1) + ' ≥ 15）',
  bC.goldLum - bA.goldLum >= 15);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
