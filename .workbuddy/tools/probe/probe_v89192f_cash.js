/* v89.192 探针F：现金流实测 —— 跑 1 现实小时（3600 tick），统计真实收支 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

console.log('timeScale =', G.timeScale ? G.timeScale() : '?');
console.log('1 游戏日 =', 86400, '游戏秒 → 现实', Math.round(86400 / (G.timeScale ? G.timeScale() : 1)), '秒');

G.newGame({ name: 'cash192', region: '司隶' });
G.state.world.weather = 'clear';

/* 造中期局面：3 城（首城 Lv8 已建好，另两座筑城），8 将（2 良 6 英） */
var c0 = G.state.cities[0];
c0.cells.forEach(function (x) { if (x && x.build && x.build.id === 'guanfu') x.build.lvl = 8; });
c0.res.pop = 12000;
G.state.hearts = 80;
var rk = ['liang', 'liang', 'ying', 'ying', 'ying', 'ying', 'ying', 'ying'];
rk.forEach(function (r, i) {
  var g = G.makeGeneral('将' + i, 30 + i * 5, 'idle', null, false, r, 'zc');
  g.cityId = c0.id;
  G.state.generals.push(g);
});
console.log('将领数 =', G.state.generals.length);

/* 记账钩子 */
var rec = { salaryN: 0, salaryAmt: 0, yieldN: 0, yieldAmt: 0, taxN: 0, taxAmt: 0 };
var _sal = G.settleGenSalary;
G.settleGenSalary = function () {
  var before = rec0();
  var r = _sal.apply(this, arguments);
  var after = rec0();
  if (after < before) { rec.salaryN++; rec.salaryAmt += (before - after); }
  return r;
};
function totalGold() {
  var t = 0;
  (G.state.cities || []).forEach(function (c) { t += (G.res(c).gold || 0); });
  t += (G.state.gold || 0) - t;   /* city.res.gold 是访问器 → 直接 st.gold 更准 */
  return (G.state.gold || 0);
}
function rec0() { return (G.state.gold || 0); }

var g0 = rec0();
var els0 = G.state.world.elapsed;
var ticks = 3600;
for (var i = 0; i < ticks; i++) G.tickOnce();
var g1 = rec0();
var els1 = G.state.world.elapsed;

console.log('══════ 实测 ' + ticks + ' 现实秒（= ' + Math.round((els1 - els0)) + ' 游戏秒 = '
  + ((els1 - els0) / 86400).toFixed(2) + ' 游戏日）══════');
console.log('金池：' + Math.round(g0) + ' → ' + Math.round(g1) + '　净变 = ' + Math.round(g1 - g0));
console.log('  月俸结算：' + rec.salaryN + ' 次 · 计 ' + Math.round(rec.salaryAmt));
console.log('  （另：岁贡/税所/生灭看日志）');

/* 单城税收速率 */
var per = G.cityProdPerSec(c0);
console.log('单城税收速率 = ' + per.gold.toFixed(3) + ' 金/现实秒 = ' + Math.round(per.gold * 86400) + ' 金/现实日');
console.log('月俸单人（实测）: ');
var gA = G.state.generals[1] || G.state.generals[0];
console.log('  ' + gA.name + '[' + gA.rank + '] 每期 = ' + G.genSalaryOf(gA)
  + '　（期 = ' + ((D.GEN_SALARY && D.GEN_SALARY.periodDays) || 7) + ' 游戏日 = '
  + Math.round(((D.GEN_SALARY && D.GEN_SALARY.periodDays) || 7) * 86400 / (G.timeScale() || 1)) + ' 现实秒）');
console.log('全领月俸/期合计 = ' + (G.state.generals.reduce(function (n, g) { return n + G.genSalaryOf(g); }, 0)));

/* 岁贡与岁贡现实日口径 */
var dy = G.dailyYieldSummary ? G.dailyYieldSummary() : null;
console.log('岁贡汇总（每现实日）=', dy ? JSON.stringify({ gold: dy.gold, cities: dy.cities }).slice(0, 120) : '(无出口)');

process.exit(0);
