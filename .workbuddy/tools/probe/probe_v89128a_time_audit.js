/* v89.128 需求 1 探针：时间口径总表 —— 以 1 倍速为基准，枚举全部时间数值
   输出：stdout + .workbuddy/tmp/time_audit_v89128.txt
   口径：1 倍速 = 1 现实秒 : 1 游戏秒（timeScale=1）；所有"游戏秒/游戏小时"即 1x 下的真实时长 */
'use strict';
process.chdir('E:/Deepseekdb');
var fs = require('fs');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) { require('E:/Deepseekdb/js/' + f + '.js'); });
var G = global.GAME, D = G.DATA;
var lines = [];
function p(s) { lines.push(s); console.log(s); }

function h(sec) {           /* 游戏秒 → 人类可读（1x 基准） */
  var v = Number(sec) || 0;
  if (v < 60) return v + ' 秒';
  if (v < 3600) return (v / 60).toFixed(v < 600 ? 1 : 0) + ' 分';
  if (v < 86400) return (v / 3600).toFixed(v < 36000 ? 1 : 0) + ' 小时';
  return (v / 86400).toFixed(v < 864000 ? 1 : 0) + ' 天';
}

p('════════ 时间口径总表（1x 基准：1 现实秒 = 1 游戏秒）════════');
p('timeScale 档位 = 1 / 10 / 30 / 120 / 300 / 600（当前档：' + G.timeScale() + '）');
p('');

p('━━ ① 建造（游戏秒；1x 下即真实秒）━━');
var keys = Object.keys(D.BUILDINGS);
keys.forEach(function (k) {
  var b = D.BUILDINGS[k];
  var arr = [];
  [1, 5, 8, 10, 11].forEach(function (lv) {
    var c = b.levelCost ? b.levelCost(lv) : null;
    arr.push('Lv' + lv + '→' + (lv + 1) + ':' + (c ? h(c.time || 0) : '-'));
  });
  /* 13 与 45 采样（外推/冻结） */
  var c13 = b.levelCost(13), c45 = b.levelCost(45);
  p('  ' + (b.name + '　　').slice(0, 5) + ' ' + arr.join('  ') + ' | Lv13:' + h(c13 ? c13.time : 0)
    + ' Lv45:' + h(c45 ? c45.time : 0));
});
p('');

p('━━ ② 训练（单兵游戏秒；total = 数量 × time）━━');
Object.keys(D.TROOPS).forEach(function (t) {
  var tr = D.TROOPS[t];
  p('  ' + tr.name + '：' + tr.time + ' 秒/个（×100 = ' + h(tr.time * 100) + '）');
});
p('');

p('━━ ③ 研究（60 × 2^cur 游戏秒）━━');
for (var lv = 0; lv <= 9; lv++) {
  p('  Lv' + lv + '→' + (lv + 1) + '：' + h(60 * Math.pow(2, lv)));
}
p('');

p('━━ ④ 行军（secPerTile = 60 游戏秒/格 ÷ 速度系数）━━');
[10, 30, 80, 200].forEach(function (d) {
  p('  ' + d + ' 格（标准步卒）：' + h(d * 60));
});
p('');

p('━━ ⑤ 采集（游戏小时）━━');
var GG = D.GATHER;
p('  最短 ' + GG.minHours + ' 游戏小时 · 最长 ' + GG.maxHours + ' 游戏小时（' + h(GG.maxHours * 3600) + '）· 同时 ' + GG.maxActive + ' 队');
p('');

p('━━ ⑥ 农田（游戏小时）━━');
D.FARM.crops.forEach(function (c) {
  p('  ' + c.name + '：' + c.hours + ' 游戏小时（' + h(c.hours * 3600) + '）');
});
p('');

p('━━ ⑦ 定期来袭（现实时间口径）━━');
p('  每 ' + D.INVASION.realMin + ' 现实分钟一场 · 预警提前 ' + D.INVASION.warnMin + ' 分钟');
p('');

p('━━ ⑧ 其它时间常量 ━━');
p('  最短建造（地板）= 5 现实秒 × 倍率 = 5 游戏秒（1x）');
p('  城墙升级兜底 = 等级 × 60 游戏秒');
p('  自动治疗节流 = ' + ((G.autoHeal && '见 s.autoHealState') || '—'));
p('  野地衰减 = 每现实日 −1 级');
p('');

p('━━ ⑨ 诊断：超长项（1x 下 > 24 游戏小时）━━');
keys.forEach(function (k) {
  var b = D.BUILDINGS[k];
  for (var lv = 1; lv <= 12; lv++) {
    var c = b.levelCost ? b.levelCost(lv) : null;
    var t = c ? (c.time || 0) : 0;
    if (t > 86400) p('  ' + b.name + ' Lv' + lv + '→' + (lv + 1) + '：' + h(t) + ' ⚠ 超 24h');
  }
});

fs.writeFileSync('.workbuddy/tmp/time_audit_v89128.txt', lines.join('\n'), 'utf8');
console.log('\n（已落盘 .workbuddy/tmp/time_audit_v89128.txt）');
process.exit(0);
