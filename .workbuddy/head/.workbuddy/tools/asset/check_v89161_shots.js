/* v89.161 像素体检：资源栏金行（真渲染）· 仓库折损行（现实换算）
   ⚠️ 历史截图体检（时称）：本脚本读 v89.161 时代的历史截图，"金行"是当时对
   货币行的称呼；v89.233 起货币更名「旧币」。像素判据与名称无关，历史正文保留。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89161_shots.js */
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
function amber(p) { var c = 0; for (var i = 0; i < p.data.length; i += 4) { var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2]; if (r > 150 && g > 90 && g < 210 && b < 120 && r - b > 60) c++; } return c; }

console.log('===== ① 资源栏 · 金行（真渲染） =====');
var A = load('v89161-gold-row.png');
chk('图非空（' + A.width + '×' + A.height + '）', A.width >= 100 && A.height >= 30);
chk('金行的金色数字/图标上色（金像素 ' + gold(A) + ' ≥ 60）', gold(A) >= 60);
chk('文字行渲染正常（行组 ' + rows(A).length + ' ≥ 1）', rows(A).length >= 1);

console.log('===== ② 仓库面板 · 折损行（现实换算） =====');
var B = load('v89161-store-real.png');
chk('图非空（' + B.width + '×' + B.height + '）', B.width >= 600 && B.height >= 120);
chk('★ 警示行真的画出来了（琥珀像素 ' + amber(B) + ' ≥ 800）', amber(B) >= 800);
chk('多行渲染（行组 ' + rows(B).length + ' ≥ 3）', rows(B).length >= 3);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
