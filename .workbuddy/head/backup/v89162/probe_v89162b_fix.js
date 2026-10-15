/* v89.162 探针 B（改后验证）：城主的六维加成 + 内政→税收 + 分解逐项对齐
   跑法：node .workbuddy/tools/probe/probe_v89162b_fix.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function P(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }

console.log('=== ① 城主内政 → 税收（改后） ===');
var st = G.newGame({ name: '税测2', region: '司隶' });
var c = st.cities[0];
st.generals.forEach(function (g) { g.status = 'idle'; g.cityId = null; });
var g = st.generals[0];
g.nz = 200; g.zm = 100;
var goldNo = G.cityProdPerSec(c).gold;
g.cityId = c.id; g.status = 'mayor';
var mb = G.mayorBonus(c);
var goldYes = G.cityProdPerSec(c).gold;
console.log('  mayorBonus.tax = ' + mb.tax + '（内政 200 × 0.01 → 封顶 1.5）');
P('城主内政 → 税收 +150%（封顶）', Math.abs(mb.tax - 1.5) < 1e-9);
console.log('  税收：无城主 ' + goldNo.toExponential(4) + ' → 有城主 ' + goldYes.toExponential(4)
  + ' ×' + (goldYes / goldNo).toFixed(3));
P('★ 真调：城主在任 → 税收 = ×(1+1.5) = ×2.5', Math.abs(goldYes / goldNo - 2.5) < 1e-9);
P('对照：未任命城主 → tax 为 0 不是旧值', (function () {
  st.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
  return G.mayorBonus(c).tax === 0;
})());

console.log('\n=== ② 中等内政的线性（nz 80 → +80%，不封顶前按点数走） ===');
g.nz = 80; g.cityId = c.id; g.status = 'mayor';
P('内政 80 → 税收 +80%（0.01/点）', Math.abs(G.mayorBonus(c).tax - 0.8) < 1e-9);
g.nz = 200;

console.log('\n=== ③ 分解 vs 结算：全境 + 单城两口径（带爵位+城主+宝物） ===');
var st2 = G.newGame({ name: '对齐测', region: '司隶' });
var c2 = st2.cities[0];
st2.rank = 10;                                       /* 爵位 10 → 税制 +10% */
st2.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
var g2 = st2.generals[0];
g2.nz = 120; g2.cityId = c2.id; g2.status = 'mayor'; /* 城主 +120% */
st2.buffs = st2.buffs || {};
st2.buffs.prod = { gold: 0.25 };                 /* 造宝物 gold +25% buff */
st2.buffs.prodUntil = {};
var pAll = G.productionPerSec().gold;
var sAll = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
console.log('  全境：结算=' + pAll.toExponential(8) + ' · 分解=' + sAll.toExponential(8) + ' · 差=' + (pAll - sAll).toExponential(2));
P('★ 全境：分解各项之和 = 结算（带 爵位+城主+宝物）', Math.abs(pAll - sAll) < Math.max(1e-9, Math.abs(pAll) * 1e-9));
var p1 = G.cityProdPerSec(c2).gold;
var s1 = G.prodBreakdown('gold', c2).reduce(function (a, x) { return a + x.val; }, 0);
/* 单城口径的分解含俸禄（与 prodBreakdown 既有结构一致），结算取 cityProdPerSec + 俸禄项 */
var sal1 = G.prodBreakdown('gold', c2).filter(function (x) { return x.name.indexOf('爵位俸禄') === 0; })
  .reduce(function (a, x) { return a + x.val; }, 0);
console.log('  单城：结算(城)=' + p1.toExponential(8) + ' + 俸禄=' + sal1.toExponential(8) + ' · 分解=' + s1.toExponential(8));
P('★ 单城：分解 = 该城税收结算 + 俸禄行', Math.abs(s1 - (p1 + sal1)) < Math.max(1e-9, Math.abs(s1) * 1e-9));
var rows = G.prodBreakdown('gold', c2);
console.log('  分解行：');
rows.forEach(function (x) { console.log('    · ' + x.name + ' = ' + x.val.toExponential(3)); });
P('分解含「城主内政」行', rows.some(function (x) { return x.name === '城主内政'; }));
P('分解含「税制加成（名城/爵位/主城/神器）」行', rows.some(function (x) { return x.name === '税制加成（名城/爵位/主城/神器）'; }));
P('「城主内政」行的值 = 基础×1.2（税额×加成）', (function () {
  var base = rows[0].val;
  var may = rows.filter(function (x) { return x.name === '城主内政'; })[0];
  return may && Math.abs(may.val - base * 1.2) < Math.max(1e-9, base * 1e-6);
})());

console.log('\n=== ④ 未任命城主：分解无「城主内政」行（对照） ===');
st2.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
var rowsNo = G.prodBreakdown('gold', c2);
P('未任命 → 没有「城主内政」行', !rowsNo.some(function (x) { return x.name === '城主内政'; }));
P('未任命 → 仍与结算对齐', (function () {
  var pA = G.productionPerSec().gold;
  var sA = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
  return Math.abs(pA - sA) < Math.max(1e-9, Math.abs(pA) * 1e-9);
})());

console.log('\n=== ⑤ 顺手复验：修复前的分叉已消失（爵位10 时） ===');
var st3 = G.newGame({ name: '回归测', region: '司隶' });
st3.rank = 10;
var p3 = G.productionPerSec().gold;
var s3 = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
P('★ 修复前分叉 0.11 → 现在差 = 0', Math.abs(p3 - s3) < Math.max(1e-9, Math.abs(p3) * 1e-9),
  '差=' + (p3 - s3).toExponential(2));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(0);
