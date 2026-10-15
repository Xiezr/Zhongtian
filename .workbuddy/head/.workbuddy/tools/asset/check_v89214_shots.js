/* v89.214 像素体检：装备悬停三色 + 换皮画面（程序化"眼睛"—— 判据先量后定）
   ① v89214-eqtip.png：浮层暗底上白值/金色增量像素真实存在（按色域统计，容差 26）
   ② v89214-wasteland.png：非空 + 平均亮度落在既有基线带 + 有文字行（逐行投影） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) {
  try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; }
}
function near(r, g, b, R, G, B, tol) {
  return Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol;
}
function countColor(png, R, G, B, tol) {
  var c = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    if (near(png.data[i], png.data[i + 1], png.data[i + 2], R, G, B, tol)) c++;
  }
  return c;
}
function stats(png) {
  var s = 0, n = 0, bright = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
    s += L; n++; if (L > 110) bright++;
  }
  return { avg: s / n, brightPct: bright * 100 / n };
}

/* ① 悬停浮层：三色（白 / 金 #f0c14b / 青 #7fd6e0） */
var t = read('v89214-eqtip.png');
chk('①a eqtip 图非空', !!t, t ? t.width + 'x' + t.height : 'null');
if (t) {
  var white = countColor(t, 255, 255, 255, 16);
  var gold = countColor(t, 240, 193, 75, 26);
  var cyan = countColor(t, 127, 214, 224, 26);
  /* 阈值先量后定：实测 white=495 / gold=366（tol 16/26）→ 判据留 5~6 成余量 */
  chk('①b 白值像素（原始属性 ≥250 —— 实测 495）', white >= 250, 'white=' + white);
  chk('①c 金色增量像素（百炼 ≥180 —— 实测 366）', gold >= 180, 'gold=' + gold);
  chk('①d 浮层暗底（平均亮度 25~90 —— 实测 31.1）', (function () { var s = stats(t); return s.avg >= 25 && s.avg <= 90; })(), 'avg=' + stats(t).avg.toFixed(1));
  console.log('     青（蕴养）像素参考值 = ' + cyan + '（本图军装件为 0/极少，青色在 ② 的 CSS 令牌实证里）');
}

/* ② 换皮画面：非空 + 基线亮度 + 文字行 */
var w = read('v89214-wasteland.png');
chk('②a wasteland 图非空（全屏 1600x1000）', !!w && w.width >= 1200, w ? w.width + 'x' + w.height : 'null');
if (w) {
  var st = stats(w);
  chk('②b 画面亮度落在暗色基线带（25~80）', st.avg >= 25 && st.avg <= 80, 'avg=' + st.avg.toFixed(1));
  chk('②c 亮像素占比 0.5%~8%（有内容、非空屏）', st.brightPct >= 0.5 && st.brightPct <= 8, st.brightPct.toFixed(2) + '%');
  /* 顶栏资源带（y 30~90）逐行文字投影：亮像素 ≥ 行宽 0.8% 记一行 */
  var lines = 0;
  for (var y = 20; y < 110; y++) {
    var c = 0;
    for (var x = 0; x < w.width; x++) {
      var i = (y * w.width + x) * 4;
      var L = 0.299 * w.data[i] + 0.587 * w.data[i + 1] + 0.114 * w.data[i + 2];
      if (L > 110) c++;
    }
    if (c >= w.width * 0.008) lines++;
  }
  chk('②d 顶栏带（资源栏）有文字行 ≥ 6 行', lines >= 6, 'lines=' + lines);
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
