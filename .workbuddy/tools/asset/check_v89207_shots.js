/* v89.207 像素体检：toast 合并 / 增速档 / 离线纪要 / 沙盘推演（四图）
   运行：node .workbuddy/tools/asset/check_v89207_shots.js */
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
function stats(png, x0, y0, x1, y1) {
  var n = 0, s = 0, bright = 0, gold = 0;
  x0 = x0 == null ? 0 : x0; y0 = y0 == null ? 0 : y0;
  x1 = x1 == null ? png.width : x1; y1 = y1 == null ? png.height : y1;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var i = (y * png.width + x) * 4;
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    var L = 0.299 * r + 0.587 * g + 0.114 * b;
    s += L; n++;
    if (L > 90) bright++;
    if (r > 150 && g > 110 && b < 130 && r - b > 40) gold++;
  }
  return { avg: s / n, bright: bright, gold: gold, n: n };
}

var toast = read('v89207-toast.png'), spd = read('v89207-spd.png');
var report = read('v89207-report.png'), sandbox = read('v89207-sandbox.png');
chk('①a 四图齐备且 1600×1000', !!toast && !!spd && !!report && !!sandbox
  && toast.width === 1600 && spd.width === 1600 && report.width === 1600 && sandbox.width === 1600);
if (!toast || !spd || !report || !sandbox) { console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败'); process.exit(1); }

var sT = stats(toast), sS = stats(spd), sR = stats(report), sB = stats(sandbox);
console.log('    [量] toast 均亮=' + sT.avg.toFixed(1) + ' 亮=' + sT.bright + ' 金=' + sT.gold);
console.log('    [量] spd   均亮=' + sS.avg.toFixed(1) + ' 亮=' + sS.bright + ' 金=' + sS.gold);
console.log('    [量] report 均亮=' + sR.avg.toFixed(1) + ' 亮=' + sR.bright + ' 金=' + sR.gold);
console.log('    [量] sandbox 均亮=' + sB.avg.toFixed(1) + ' 亮=' + sB.bright + ' 金=' + sB.gold);

/* ② toast 图：主界面活体基线 + 底部带 tostring 文本 */
var sTb = stats(toast, 0, 820, 1600, 1000);
chk('②a toast 图主界面基线（均亮 40~70）+ 底部带亮像素在册（toast 文本带）',
  sT.avg > 40 && sT.avg < 70 && sTb.bright >= 400, '底部带亮=' + sTb.bright);

/* ③ spd 图：弹窗态 + 金色选中键 */
chk('③a spd 图弹窗态基线（均亮 20~40）', sS.avg > 20 && sS.avg < 40, 'avg=' + sS.avg.toFixed(1));
chk('③b 增速档金色选中键在册（金 300~6000 · 实测 ' + sS.gold + '）',
  sS.gold >= 300 && sS.gold <= 6000, 'gold=' + sS.gold);

/* ④ report 图：弹窗态 + 明细行 */
chk('④a report 图弹窗态基线（均亮 20~40）+ 内容亮像素 ≥ 8000',
  sR.avg > 20 && sR.avg < 40 && sR.bright >= 8000, 'avg=' + sR.avg.toFixed(1) + ' bright=' + sR.bright);

/* ⑤ sandbox 图：沙盘内容画出来 */
chk('⑤a sandbox 图内容在册（亮 ≥ 30000）', sB.bright >= 30000, 'bright=' + sB.bright);

/* ⑥ 对照：spd 与 report 同为弹窗态（均亮差 < 8） */
chk('⑥ 对照：spd/report 同场景（均亮差 ' + Math.abs(sS.avg - sR.avg).toFixed(1) + ' < 8）',
  Math.abs(sS.avg - sR.avg) < 8, 'Δ=' + Math.abs(sS.avg - sR.avg).toFixed(1));

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
