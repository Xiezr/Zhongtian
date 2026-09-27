/* v89.162 探针：城主六维加成现状 + 税收缺口 + 税收分解分叉疑点
   —— 老板 2 条：①列举城主的六维对生产/战斗的加成 ②内政对税收也应有加成
   跑法：node .workbuddy/tools/probe/probe_v89162_mayor.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function P(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }

console.log('=== ① 城主六维 → 生产/经营 的现状清点（真调 mayorBonus） ===');
var st = G.newGame({ name: '城测', region: '司隶' });
var c = st.cities[0];
st.generals.forEach(function (g) { g.status = 'idle'; g.cityId = null; });
var g = st.generals[0];
g.nz = 200; g.zm = 200; g.yw = 200; g.tong = 200; g.speed = 100;
g.cityId = c.id; g.status = 'mayor';
var mb = G.mayorBonus(c);
console.log('  mayorBonus = ' + JSON.stringify({ prod: mb.prod, build: mb.build, research: mb.research, def: mb.def, tax: mb.tax }));
P('内政 → 产量（现状）', mb.prod > 0, '+' + (mb.prod * 100).toFixed(0) + '%');
P('内政 → 建造（现状，与产量同率同引用）', mb.build === mb.prod, '+' + (mb.build * 100).toFixed(0) + '%');
P('智谋 → 研究（现状）', mb.research > 0, '+' + (mb.research * 100).toFixed(0) + '%');
P('智谋 → 城防（现状）', mb.def > 0, '+' + (mb.def * 100).toFixed(0) + '%');
P('★ 内政 → 税收（缺口证实：字段不存在）', mb.tax === undefined);

console.log('\n=== ② 城主内政对税收有没有实际影响（真调 cityProdPerSec） ===');
st.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
var goldNo = G.cityProdPerSec(c).gold;
g.cityId = c.id; g.status = 'mayor';
var goldYes = G.cityProdPerSec(c).gold;
console.log('  无城主 → ' + goldNo.toExponential(4) + ' /秒 · 有城主(nz200) → ' + goldYes.toExponential(4) + ' /秒');
P('★ 现状：城主在任，税收**分毫不变**（缺口证实）', Math.abs(goldYes - goldNo) < 1e-12);
console.log('  （对照：粮食产量 无城主→有城主 应显著上升）');
st.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
var grainNo = G.cityProdPerSec(c).grain;
g.cityId = c.id; g.status = 'mayor';
var grainYes = G.cityProdPerSec(c).grain;
P('粮食产量随城主任命上升（说明造局有效）', grainYes > grainNo,
  grainNo.toFixed(2) + ' → ' + grainYes.toFixed(2));

console.log('\n=== ③ 税收分解 vs 结算：带「税制加成」时是否分叉（疑点实证） ===');
var st2 = G.newGame({ name: '分叉测', region: '司隶' });
var c2 = st2.cities[0];
console.log('  首城：popCap=' + G.maxPopOf(c2) + ' · 税率=' + (st2.tax || 0) + ' · 民心=' + (st2.hearts || 100));
var p0 = G.productionPerSec().gold;
var s0 = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
console.log('  零加成：结算=' + p0.toExponential(6) + ' · 分解之和=' + s0.toExponential(6) + ' · 差=' + (p0 - s0).toExponential(2));
P('零加成时两边一致（既有断言的口径）', Math.abs(p0 - s0) < Math.max(1e-9, Math.abs(p0) * 1e-9));
st2.rank = 10;                                   /* 爵位 10 级 → 税制加成 +10% */
var p1 = G.productionPerSec().gold;
var s1 = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
console.log('  爵位10（税+10%）：结算=' + p1.toExponential(6) + ' · 分解之和=' + s1.toExponential(6) + ' · 差=' + (p1 - s1).toExponential(2));
P('★ 现状：带税制加成时两边**分叉**（真 bug 证实 · 显示少于结算）', (p1 - s1) > 0 && (p1 - s1) > Math.abs(p0) * 0.05);

console.log('\n=== ④ 六维 → 战斗 的现状清点（真调 genAttrs 对照） ===');
var a = G.genAttrs(g);
console.log('  genAttrs(城主) = tong=' + a.tong + ' nz=' + a.nz + ' yw=' + a.yw + ' zm=' + a.zm + ' spd=' + a.spd + ' staMax=' + a.staMax);
console.log('  atkPct=' + a.atkPct.toFixed(4) + '（勇武×' + G.YW_PCT + '+装备）· defPct=' + a.defPct.toFixed(4) + '（智谋×' + G.ZM_PCT + '+装备）');
P('勇武 → 全军攻击（战斗，该将带队时）', a.atkPct > 0);
P('智谋 → 全军防御（战斗，该将带队时）', a.defPct > 0);
P('统率 → 覆盖（战斗，tong×100 士卒吃满）', a.tong > 0);
P('速度 → 战斗速度/行军（战斗，该将带队时）', a.spd > 0);
P('城主不参战（marchBlockOf 拦城主出征）', !!G.marchBlockOf(g));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(0);
