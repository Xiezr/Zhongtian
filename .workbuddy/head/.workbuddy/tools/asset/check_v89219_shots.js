/* v89.219 像素体检：悬停浮层（白值+金增量）/ 百炼面板（整套键）/ 缩略图（新机构词）
   判据先量后定（实测值写在 chk 名里，留 5~6 成余量）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function stats(png) {
  var s = 0, n = 0, b = 0, gold = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], bl = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * bl;
    s += L; n++;
    if (L > 140) b++;
    if (r > 200 && g > 160 && bl < 130 && (r - bl) > 70) gold++;   /* 金色系：标题/增量 */
  }
  return { avg: s / n, bright: b * 100 / n, gold: gold };
}
var H = read('v89219-hover.png'), F = read('v89219-forge.png'), M = read('v89219-minimap.png');
chk('① 三图非空', !!H && !!F && !!M,
  (H ? H.width + 'x' + H.height : 'null') + ' / ' + (F ? F.width + 'x' + F.height : 'null') + ' / ' + (M ? M.width + 'x' + M.height : 'null'));
if (H) {
  var sh = stats(H);
  console.log('  悬停浮层：均亮 ' + sh.avg.toFixed(1) + ' 亮 ' + sh.bright.toFixed(1) + '% 金 ' + sh.gold);
  chk('①a 悬停浮层：暗底深色浮层（均亮 20~60 · 实测 31.5）', sh.avg >= 20 && sh.avg <= 60, 'avg=' + sh.avg.toFixed(1));
  chk('①b 悬停浮层：金色增量像素 ≥250（标题 + 各行 +N · 实测 492）', sh.gold >= 250, 'gold=' + sh.gold);
  chk('①c 悬停浮层：文字密度（亮像素 3%~25% · 实测 4.6%）', sh.bright >= 3 && sh.bright <= 25, 'br=' + sh.bright.toFixed(1));
}
if (F) {
  var sf = stats(F);
  console.log('  百炼面板：均亮 ' + sf.avg.toFixed(1) + ' 亮 ' + sf.bright.toFixed(1) + '% 金 ' + sf.gold + ' 尺寸 ' + F.width + 'x' + F.height);
  chk('②a 百炼面板：xxl 档尺寸（宽 1200~1400 · 实测 1315）', F.width >= 1200 && F.width <= 1400, 'w=' + F.width);
  chk('②b 百炼面板：有金色元素（整套键 + 卡面等级 · 实测 71）', sf.gold >= 30, 'gold=' + sf.gold);
}
if (M) {
  var sm = stats(M);
  console.log('  缩略图面板：均亮 ' + sm.avg.toFixed(1) + ' 亮 ' + sm.bright.toFixed(1) + '% 金 ' + sm.gold + ' 尺寸 ' + M.width + 'x' + M.height);
  chk('③a 缩略图：地图画布为主（均亮 40~90 · 实测 57.4）', sm.avg >= 40 && sm.avg <= 90, 'avg=' + sm.avg.toFixed(1));
  chk('③b 缩略图：金色标注像素 ≥300（城名/图例 · 实测 592）', sm.gold >= 300, 'gold=' + sm.gold);
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
