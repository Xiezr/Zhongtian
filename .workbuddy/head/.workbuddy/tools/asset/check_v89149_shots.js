'use strict';
/* v89.149 像素体检：战场条「拉到回合记录的上方」（改前 / 改后 对照）
   ------------------------------------------------------------
   口径（§59.3 先量后定 · §14.4 改前对照的稳做法）：
     「旧空带」= y 390~510 · x 500~1170 —— 改前那一片是**弹窗底色**（战场条只到 385），
     改后那一片是**场地下半截**（战场条到 511）。
   实测（1680×1000 · 同一 seed / 同一配兵）：
     ① 带内均值 43.7 → 37.6（被场地底色覆盖 · 更深）
     ② 带内峰值 44 → 101（末枚兵牌真画进去了）
     ③ 带内亮像素 0.00% → 0.84%（无 → 有内容）
   跑法：node .workbuddy/tools/asset/check_v89149_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var PASS = 0, FAIL = 0;
function chk(n, ok, x) {
  if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); }
}
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var A = PNG.sync.read(fs.readFileSync(S + 'v89149-bt-after.png'));
var B = PNG.sync.read(fs.readFileSync(S + 'v89149-bt-before.png'));

function band(png, x0, x1, y0, y1) {
  var bright = 0, sum = 0, n = 0, mx = 0;
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (png.width * y + x) << 2;
      var L = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++; sum += L; if (L > mx) mx = L; if (L > 90) bright++;
    }
  }
  /* ⚠️ 用**绝对计数**而不是百分比：带宽窄的兵牌在多列采样下占比会被放大
     （x 步长 6 时量到 0.84%、步长 1 时真值 0.04% —— 步长会骗人）。 */
  return { avg: sum / n, pct: bright / n * 100, mx: mx, n: n, cnt: bright };
}

console.log('尺寸：改前 ' + B.width + '×' + B.height + ' · 改后 ' + A.width + '×' + A.height);
chk('两张对照图同尺寸且非空', A.width === B.width && A.height === B.height && A.width > 1000);

var ba = band(B, 500, 1170, 390, 510);      /* 改前：空带（弹窗底色） */
var aa = band(A, 500, 1170, 390, 510);      /* 改后：场地下半截（含末枚兵牌） */
console.log('  旧空带（y390-510）：改前 均值 ' + ba.avg.toFixed(2) + ' / 峰值 ' + Math.round(ba.mx)
  + ' / 亮 ' + ba.pct.toFixed(2) + '%　→　改后 均值 ' + aa.avg.toFixed(2) + ' / 峰值 '
  + Math.round(aa.mx) + ' / 亮 ' + aa.pct.toFixed(2) + '%');

chk('① 改前那一带**确实是空的**（亮像素 0% · 峰值 = 底色）',
  ba.pct < 0.05 && ba.mx < 60, '亮 ' + ba.pct.toFixed(2) + '% · 峰值 ' + Math.round(ba.mx));
chk('② 改后同一带被**场地覆盖**（均值下降 ≥ 4 —— 底色更深）',
  (ba.avg - aa.avg) >= 4, ba.avg.toFixed(2) + ' → ' + aa.avg.toFixed(2));
chk('③ 改后同一带出现**兵牌**（峰值 ≥ 90 —— 改前只有 44）',
  aa.mx >= 90 && aa.mx > ba.mx + 30, '峰值 ' + Math.round(ba.mx) + ' → ' + Math.round(aa.mx));
chk('④ 改后带内亮像素 ≥ 20 个（真的有内容画进去 · 改前 0 个）',
  aa.cnt >= 20 && ba.cnt === 0, '亮像素 ' + ba.cnt + ' → ' + aa.cnt + ' 个');

/* 上半区（战场条主体）两侧都该有内容 —— 防"改后把上半也搞没了" */
var tb = band(B, 500, 1170, 200, 380), ta = band(A, 500, 1170, 200, 380);
console.log('  战场主体（y200-380）：改前 亮 ' + tb.pct.toFixed(2) + '% · 改后 亮 ' + ta.pct.toFixed(2) + '%');
chk('⑤ 战场主体区两版都有内容（改后 ≥ 0.1%）', ta.pct >= 0.1 && tb.pct >= 0.1,
  tb.pct.toFixed(2) + '% → ' + ta.pct.toFixed(2) + '%');

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
