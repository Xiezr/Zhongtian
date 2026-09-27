/* ============================================================
 * check_v89156_shots.js  像素体检（v89.156 · 判据"先量后定"）
 *   图（4 张）：
 *     v89156-wilds.png        附属野地面板（含红色「放弃」按钮）
 *     v89156-exp-battle.png   出征 · 战斗型（右列含预估 + 目标区**限制行红字**）
 *     v89156-exp-own.png      出征 · 己方野地（无预估 + 无限制行）
 *     v89156-scout-fail.png   公文侦查页（含「侦查失败」行）
 *   核心对照组：battle 与 own 的**红色像素差** —— 限制行（⚠️ 红字）只在战斗型显示，
 *   这是需求③「目标区只提示出征限制性信息」的像素证据。
 * 运行：node .workbuddy/tools/asset/check_v89156_shots.js
 * ============================================================ */
const fs = require('fs');
const PNG = require('pngjs').PNG;
const S = 'E:/Deepseekdb/.workbuddy/shots/';

let PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) {
  try { return PNG.sync.read(fs.readFileSync(S + f)); } catch (e) { return null; }
}
function rows(png) {
  const out = []; let cur = null;
  const need = Math.max(3, Math.round(png.width * 0.004));
  for (let y = 0; y < png.height; y++) {
    let c = 0;
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
    }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
function count(png, test) {
  let c = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (test(png.data[i], png.data[i + 1], png.data[i + 2])) c++;
  }
  return c;
}
const RED = (r, g, b) => r > 150 && r - g > 60 && r - b > 60;
const BRIGHT = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b > 110;

const W = load('v89156-wilds.png');
const EB = load('v89156-exp-battle.png');
const EO = load('v89156-exp-own.png');
const SF = load('v89156-scout-fail.png');

console.log('===== ① 非空与尺寸 =====');
ck('四图齐备（非空）', !!W && !!EB && !!EO && !!SF);
if (!(W && EB && EO && SF)) { console.log('\n结果：' + PASS + ' 通过 / ' + (FAIL + 1) + ' 失败'); process.exit(1); }
[[W, 'wilds'], [EB, 'exp-battle'], [EO, 'exp-own']].forEach(function (it) {
  ck(it[1] + ' 面板图尺寸（≈1326×936 · xxl 档）', it[0].width >= 1300 && it[0].height >= 900,
    it[0].width + 'x' + it[0].height);
});
ck('scout-fail 元素图尺寸（宽 ≥1500 · 公文视图）', SF.width >= 1500 && SF.height >= 700,
  SF.width + 'x' + SF.height);

console.log('===== ② 附属野地：行组指纹 + 「放弃」红按钮 =====');
const wRows = rows(W).length, wRed = count(W, RED);
ck('行组指纹（量测 8 · 允 6~12）', wRows >= 6 && wRows <= 12, '行组=' + wRows);
ck('「🗑️ 放弃」红按钮在（红像素 ≥300）', wRed >= 300, '红=' + wRed);

console.log('===== ③ 出征两图：限制行红字 + 内容差异（核心对照） =====');
const ebRed = count(EB, RED), eoRed = count(EO, RED);
const ebBright = count(EB, BRIGHT), eoBright = count(EO, BRIGHT);
const ebRows = rows(EB).length, eoRows = rows(EO).length;
ck('exp-battle 行组 ≥24（内容齐全）', ebRows >= 24, '行组=' + ebRows);
ck('exp-own 行组 ≥24', eoRows >= 24, '行组=' + eoRows);
ck('【核心】限制行红字只在战斗型显示（battle 红 ≥800 且比 own 多 ≥400）',
  ebRed >= 800 && (ebRed - eoRed) >= 400, 'battle红=' + ebRed + ' own红=' + eoRed + ' 差=' + (ebRed - eoRed));
ck('两图内容亮像素差 ≥1500（预估/限制行等内容差异）', (ebBright - eoBright) >= 1500,
  'battle亮=' + ebBright + ' own亮=' + eoBright + ' 差=' + (ebBright - eoBright));

console.log('===== ④ 侦察失败公文页 =====');
const sfRows = rows(SF).length, sfBright = count(SF, BRIGHT);
ck('行组指纹（量测 4 · 允 3~8：页签/行头/失败行/合计）', sfRows >= 3 && sfRows <= 8, '行组=' + sfRows);
ck('有内容（亮像素 ≥3000）', sfBright >= 3000, '亮=' + sfBright);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
