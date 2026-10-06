/* v89.164 探针 A：六维曲线 + 征兵时长五条对齐
   跑法：node .workbuddy/tools/probe/probe_v89164_curve.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var pass = 0, fail = 0;
function P(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }

console.log('=== ① 分段减半曲线（内政系 1%/点 · 智谋系 0.5%/点） ===');
var pts = [80, 150, 200, 300, 500, 836, 1000, 3000];
pts.forEach(function (n) {
  console.log('  nz=' + String(n).padStart(4) + ' → +' + (G.curveBonusOf(n, 0.01, 150) * 100).toFixed(2) + '%'
    + '   zm同 → +' + (G.curveBonusOf(n, 0.005, 150) * 100).toFixed(2) + '%');
});
P('首段与旧线性一字不差（nz 150 → +150.00%）', Math.abs(G.curveBonusOf(150, 0.01, 150) - 1.5) < 1e-9);
P('样本点：200→+175% · 300→+225% · 500→+268.75%', (function () {
  return Math.abs(G.curveBonusOf(200, 0.01, 150) - 1.75) < 1e-9
    && Math.abs(G.curveBonusOf(300, 0.01, 150) - 2.25) < 1e-9
    && Math.abs(G.curveBonusOf(500, 0.01, 150) - 2.6875) < 1e-9;
})());
P('★ 836 → +293.31%（旧封顶 +150% 的近两倍 · 老板问的那个点）', Math.abs(G.curveBonusOf(836, 0.01, 150) - 2.933125) < 1e-6);
P('★ 收敛有界：nz 3000/5000 → +300% 封顶（不会回到 ×9 量级）', (function () {
  var a = G.curveBonusOf(3000, 0.01, 150), b = G.curveBonusOf(5000, 0.01, 150);
  return Math.abs(a - 3.0) < 1e-5 && Math.abs(b - 3.0) < 1e-5;
})());
P('智谋系收敛 +150%（zm 836 → +146.66%）', Math.abs(G.curveBonusOf(836, 0.005, 150) - 1.466554) < 1e-5);

console.log('\n=== ② 真调：城主 836 的实际加成（mayorBonus） ===');
var st = G.newGame({ name: 'c', region: '烬环' });
var c = st.cities[0];
st.generals.forEach(function (g) { g.status = 'idle'; g.cityId = null; });
var g0 = st.generals[0];
g0.nz = 836; g0.zm = 836; g0.cityId = c.id; g0.status = 'mayor';
var mb = G.mayorBonus(c);
console.log('  mayorBonus(836) = ' + JSON.stringify({ prod: +mb.prod.toFixed(4), build: +mb.build.toFixed(4), tax: +mb.tax.toFixed(4), research: +mb.research.toFixed(4), def: +mb.def.toFixed(4) }));
P('产量/建造/税收 = +293.31%', Math.abs(mb.prod - 2.9331) < 1e-3 && Math.abs(mb.tax - 2.9331) < 1e-3);
P('研究/城防 = +146.66%', Math.abs(mb.research - 1.4666) < 1e-3 && Math.abs(mb.def - 1.4666) < 1e-3);
P('二次截断退役：建造乘数 = 1/(1+2.933)（不再被截到 1/2.5）', Math.abs(G.cityBuildMult(c) - 1 / 3.9331) < 1e-3,
  G.cityBuildMult(c).toFixed(4));
g0.loyalty = 40;
P('忠诚 40（<50 警戒）→ 加成减半（2.933 → 1.4666）', Math.abs(G.mayorBonus(c).prod - 1.4666) < 1e-3);
g0.loyalty = 80;

console.log('\n=== ③ 征兵时长五条对齐（老板给定关系） ===');
var T = DATA.TROOPS;
var rows = [['青州', 'qingzhoubing'], ['长枪', 'changqiang'], ['刀盾', 'daodun'], ['藤甲', 'tengjiabing'],
  ['突骑', 'tuqibing'], ['弓箭', 'gongjian'], ['轻骑', 'qingji'], ['虎豹', 'hubaoqi'], ['铁骑', 'tieji'], ['西凉', 'xiliangtieqi']];
rows.forEach(function (r) { console.log('  ' + r[0] + ' = ' + T[r[1]].time + ' 秒'); });
P('★ 五条对齐全满足', T.qingzhoubing.time === T.changqiang.time && T.daodun.time === T.tengjiabing.time
  && T.qingji.time === T.hubaoqi.time && T.tieji.time === T.xiliangtieqi.time && T.tuqibing.time > T.gongjian.time);
P('步兵 ≤60 / 骑兵 ≤300 保持', (function () {
  var bad = 0;
  Object.keys(T).forEach(function (k) {
    if (T[k].cat === 'inf' && T[k].time > 60) bad++;
    if (T[k].cat === 'cav' && T[k].time > 300) bad++;
  });
  return bad === 0;
})());

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(0);
