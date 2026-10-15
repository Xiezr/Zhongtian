/* v89.160 像素体检：仓库面板折损行（琥珀警示）· 公文灾种行（内政青主题色）· 自动化面板说明
   ⚠️ 历史截图体检（时称）：本脚本读 v89.160 时代的历史截图，"内政"是当时六维名
   （v89.224 换代后为「治理」）。像素判据与名称无关，历史正文保留。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89160_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function lum(png, x, y) { var i = (png.width * y + x) << 2; return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]; }
function count(png, test) {
  var c = 0;
  for (var i = 0; i < png.data.length; i += 4) if (test(png.data[i], png.data[i + 1], png.data[i + 2])) c++;
  return c;
}
function rows(png) {
  var out = [], cur = null, need = Math.max(3, Math.round(png.width * 0.004));
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) if (lum(png, x, y) > 110) c++;
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
var amber = function (r, g, b) { return r > 150 && g > 90 && g < 210 && b < 120 && r - b > 60; };
var cyan = function (r, g, b) { return g > 150 && b > 150 && r < 140 && g - r > 30; };

console.log('===== ① 仓库面板 · 逾溢折损行（琥珀警示） =====');
var A = load('v89160-store-rot.png');
chk('图非空且尺寸达标（' + A.width + '×' + A.height + '）', A.width >= 700 && A.height >= 480);
chk('★ 警示行真的画出来了（琥珀像素 ' + count(A, amber) + ' ≥ 1500）', count(A, amber) >= 1500);
chk('面板正文分行正常（行组 ' + rows(A).length + ' ≥ 6）', rows(A).length >= 6);

console.log('===== ② 公文 · 灾种行（内政主题色） =====');
var B = load('v89160-rot-log.png');
chk('图非空（' + B.width + '×' + B.height + '）', B.width >= 600 && B.height >= 40);
chk('消息分行（行组 ' + rows(B).length + ' ≥ 3 —— 长文自动折行）', rows(B).length >= 3);
chk('★ 消息按主题上色（内政青 ' + count(B, cyan) + ' ≥ 400 —— v89.157 的主题色对折损消息同样生效）',
  count(B, cyan) >= 400);

console.log('===== ③ 自动化面板 · 顺延说明 =====');
var C = load('v89160-auto-pane.png');
chk('图非空（' + C.width + '×' + C.height + '）', C.width >= 600 && C.height >= 40);
chk('说明文字多行渲染（行组 ' + rows(C).length + ' ≥ 2）', rows(C).length >= 2);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
