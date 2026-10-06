/* v89.188 批次 B 探针：三条经济口径的取证与预演 ——
   A. 岁贡档位实值（税所对照基准）
   B. 税所：旧口径（Lv×40/游戏日 → 现实日）vs 新提案（固定额/现实日）—— 据点数量矩阵
   C. 城主内政 → 税收加成：旧曲线（0.01 不封口）vs 新设计（0.006 + 封顶 2.0）
   D. 伤兵三档书：回本线（阵亡数）与单位价复核（治疗费 10 金/兵 = 官方兵价锚）
   跑法：node .workbuddy/tools/probe/probe_v89188a_econ.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: 'e188', avatar: '🧔', gender: 'male', region: '碎垣' });

var ts = G.timeScale ? G.timeScale() : (DATA.DEFAULT_SETTINGS || {}).timeScale || 120;
console.log('时间倍率 ts = ' + ts + '（1 现实秒 = ' + ts + ' 游戏秒）；1 现实日 = ' + ts + ' 游戏日 = ' + (ts * 86400).toLocaleString() + ' 游戏秒');

console.log('\n===== A. 岁贡档位（现实日结算，与税所对照基准）=====');
var gate = (DATA.GOLD_GATE || {}).yield || 1;
console.log('GOLD_GATE.yield = ' + gate);
['capital', 'zhou', 'jun', 'county'].forEach(function (tp) {
  var y = (DATA.CITY_YIELD || {})[tp];
  if (!y) { console.log('  ' + tp + ': (无表项)'); return; }
  console.log('  ' + tp + '：金 ' + U.fmt(Math.round(y.gold * gate)) + '/现实日 · 声望 ' + y.rep);
});

console.log('\n===== B. 税所：旧口径 → 现实日矩阵 =====');
var A = DATA.FORT_AURA || {};
console.log('旧口径：每游戏日 等级×' + (A.goldPerLvDay || 40) + ' 金；新提案：每现实日 固定 500 金/处');
console.log('  ── 旧口径折算现实日（×' + ts + ' 游戏日）：');
[1, 3, 5, 10].forEach(function (lv) {
  var perDay = lv * (A.goldPerLvDay || 40) * ts;
  console.log('     Lv' + String(lv).padEnd(2) + ' 一处 = ' + U.fmt(perDay) + ' 金/现实日');
});
console.log('  ── 新提案（每处 500/现实日）：按据点数量');
[1, 5, 10, 20].forEach(function (n) {
  console.log('     ' + String(n).padEnd(2) + ' 处 = ' + U.fmt(n * 500) + ' 金/现实日');
});
var county = Math.round(((DATA.CITY_YIELD || {}).county || {}).gold * gate);
console.log('  对照：一座县城岁贡 = ' + U.fmt(county) + ' 金/现实日；20 处新税所 = ' + U.fmt(20 * 500) + '（占县城 ' + Math.round(20 * 500 / county * 100) + '%）');

console.log('\n===== C. 城主内政 → 税收加成的曲线（旧 vs 新设计）=====');
var SEG = (DATA.MAYOR_CURVE || {}).seg || 150;
function curve(pts, r0) { return G.curveBonusOf(pts, r0, SEG); }
console.log('  内政值 | 旧（r0=0.01 不封口） | 新（r0=0.006 · 封顶 2.0）');
[100, 150, 200, 300, 450, 500, 700, 733, 1000, 1400].forEach(function (nz) {
  var oldV = curve(nz, 0.01);
  var newV = Math.min(curve(nz, 0.006), 2.0);
  console.log('   ' + String(nz).padEnd(5) + ' |  +' + Math.round(oldV * 100) + '%'.padEnd(6) + '        |  +' + Math.round(newV * 100) + '%' + (newV >= 2 ? '（封顶）' : ''));
});

console.log('\n===== D. 伤兵三档书：单位价与回本线（兵价锚 = 治疗费 10 金/兵）=====');
/* 回本线：书价 ÷ (10 金/兵 × 回收增量)。阵亡 G → 增量伤兵 = G×Δ，价值 = 10×G×Δ */
[['青囊书', 0.05, 80, 70], ['续命书', 0.10, 130, 120], ['医圣书', 0.15, 200, 150]].forEach(function (x) {
  var name = x[0], d = x[1], p0 = x[2], p1 = x[3];
  console.log('  ' + name + '（+' + (d * 100) + 'pp）：现价 ' + p0 + ' 金（' + (p0 / (d * 100)).toFixed(1) + ' 金/pp · 回本线 ' + Math.round(p0 / 10 / d) + ' 阵亡）'
    + ' → 建议 ' + p1 + ' 金（' + (p1 / (d * 100)).toFixed(1) + ' 金/pp · 回本线 ' + Math.round(p1 / 10 / d) + ' 阵亡）');
});
console.log('  复合包：万全策 200（atk20/def20/wound10）· 天时令 300（atk30/def30/cap30/wound15）——本批不动');

process.exit(0);
