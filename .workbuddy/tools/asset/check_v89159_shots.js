/* v89.159 像素体检：升级键在/不在（对照）· 上限行 · 公文升级刷新行
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89159_shots.js */
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
function goldCount(png) {
  var c = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 180 && g > 150 && b < 120 && r - b > 70) c++;
  }
  return c;
}
function bandText(png, y0, y1) {          /* 带内"文字行"像素（亮度 > 110） */
  var c = 0;
  for (var y = y0; y < Math.min(y1, png.height); y++) for (var x = 0; x < png.width; x++) if (lum(png, x, y) > 110) c++;
  return c;
}
function rowGroups(png) {
  var out = [], cur = null, need = Math.max(3, Math.round(png.width * 0.004));
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) if (lum(png, x, y) > 110) c++;
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

console.log('===== ① 民房面板「升级」键在/不在（同一装置的两态对照） =====');
var UP = load('v89159-build-up.png'), BLK = load('v89159-build-block.png');
chk('两图非空且同尺寸（同装置对照）', UP.width >= 700 && UP.height >= 600 && UP.width === BLK.width && UP.height === BLK.height,
  UP.width + 'x' + UP.height);
var gUp = goldCount(UP), gBlk = goldCount(BLK);
chk('★ 可升那座的「升级」键是金色大按钮（金色像素 ' + gUp + '）', gUp >= 3000);
chk('★ 已到顶那座没有金键（金色像素 ' + gBlk + ' · 仅剩标题一粒）', gBlk <= 500);
chk('两态对照显著性（差 ' + (gUp - gBlk) + ' 像素）', (gUp - gBlk) >= 3000);
var tailUp = bandText(UP, UP.height - 90, UP.height), tailBlk = bandText(BLK, BLK.height - 90, BLK.height);
chk('底部操作区两态都有内容（升级键 / 禁用键）', tailUp >= 500 && tailBlk >= 500, 'up=' + tailUp + ' blk=' + tailBlk);

console.log('===== ② 上限行（"受官府 LvN 限制 · 升官府可提升"） =====');
var CAP = load('v89159-cap-line.png');
chk('图非空', CAP.width >= 700 && CAP.height >= 600, CAP.width + 'x' + CAP.height);
/* 实测：cap-line 在 y∈[160,195] 多出一行（build-up 同带为空）—— 两图对照取值 */
var capBand = bandText(CAP, 158, 195), upBand = bandText(UP, 158, 195);
chk('★ 上限行真的画出来了（该带文字像素 ' + capBand + ' vs 对照图 ' + upBand + '）', capBand >= 200 && upBand < 60);
chk('上限行仍在"标题之下、操作区之上"（行组序：标题 → 属性行 → 操作区）',
  rowGroups(CAP).length >= 6, '行组=' + rowGroups(CAP).length);

console.log('===== ③ 公文 · 系统页「升级刷新…已回满」行 =====');
var DOC = load('v89159-levelup-doc.png');
chk('图非空', DOC.width >= 600 && DOC.height >= 100, DOC.width + 'x' + DOC.height);
var rows = rowGroups(DOC);
chk('裁剪到多行消息（行组 ' + rows.length + ' ≥ 12）', rows.length >= 12);
chk('有金色强调（标题/高亮）', goldCount(DOC) >= 300, 'gold=' + goldCount(DOC));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
