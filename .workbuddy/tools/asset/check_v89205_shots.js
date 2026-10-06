/* v89.205 像素体检：挂件行退役 + 卸下迁入选择窗（三图）
   ------------------------------------------------------------
   ① 三图非空（1600×1000）· pane 暗色基线
   ② pick（已佩态选择窗）红像素 ≥ 200 —— 「卸下」（btn sm red）真画出来
   ③ off（卸下后重开窗）红像素 = 0（对照：卸下按钮随"当前未佩"消失）
   ④ pick/off 均亮差 < 6（同场景 · 遮罩一致 · 差异只在按钮与文案）
   运行：node .workbuddy/tools/asset/check_v89205_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
function read(f) { try { return PNG.sync.read(fs.readFileSync(OUT + f)); } catch (e) { return null; } }
function stats(png) {
  var n = 0, s = 0, bright = 0, red = 0;
  for (var y = 0; y < png.height; y++) for (var x = 0; x < png.width; x++) {
    var i = (y * png.width + x) * 4;
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    s += L; n++;
    if (L > 90) bright++;
    if (r > 150 && r - g > 60 && r - b > 60) red++;
  }
  return { avg: s / n, brightPct: bright / n * 100, red: red, w: png.width, h: png.height };
}

var pane = read('v89205-pane.png'), pick = read('v89205-pick.png'), off = read('v89205-off.png');
chk('①a 三图齐备且 1600×1000', !!pane && !!pick && !!off
  && pane.width === 1600 && pick.width === 1600 && off.width === 1600);
if (!pane || !pick || !off) { console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败'); process.exit(1); }

var sPane = stats(pane), sPick = stats(pick), sOff = stats(off);
console.log('    [量] pane 均亮=' + sPane.avg.toFixed(1) + ' 亮%=' + sPane.brightPct.toFixed(2) + ' 红=' + sPane.red);
console.log('    [量] pick 均亮=' + sPick.avg.toFixed(1) + ' 亮%=' + sPick.brightPct.toFixed(2) + ' 红=' + sPick.red);
console.log('    [量] off  均亮=' + sOff.avg.toFixed(1) + ' 亮%=' + sOff.brightPct.toFixed(2) + ' 红=' + sOff.red);

chk('①b pane 暗色基线正常（均亮 30~60 · 亮 0.5%~8%）',
  sPane.avg > 30 && sPane.avg < 60 && sPane.brightPct > 0.5 && sPane.brightPct < 8,
  'avg=' + sPane.avg.toFixed(1) + ' bright%=' + sPane.brightPct.toFixed(2));

chk('② pick：卸下按钮真画出（红像素 ' + sPick.red + ' ≥ 200）', sPick.red >= 200, 'red=' + sPick.red);

chk('③ off 对照：卸下按钮随「当前未佩」消失（红像素 ' + sOff.red + ' = 0）',
  sOff.red === 0 && sOff.red < sPick.red * 0.1, 'off=' + sOff.red + ' pick=' + sPick.red);

chk('④ pick/off 同场景（均亮差 ' + Math.abs(sPick.avg - sOff.avg).toFixed(1) + ' < 6）',
  Math.abs(sPick.avg - sOff.avg) < 6, 'Δ=' + Math.abs(sPick.avg - sOff.avg).toFixed(1));

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
