/* v89.175 探针 A：智能战斗**逐回合轨迹** —— 老板疑点「弓箭兵是不是不用一直前进？」
   输出：每回合 gap + 我方远程（弓/床弩/投石）与骑兵的 adv/stance/target + 敌方弓的 adv/stance。
   附：战斗模拟速度（评估"策略赛马"成本）。
   跑法：node .workbuddy/tools/probe/probe_v89175a_smart_trace.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });   /* story 等模块需要 state */

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
function pick(list, id) { var o = null; list.forEach(function (u) { if (u.id === id) o = u; }); return o; }
function total(list) { var n = 0; list.forEach(function (u) { if (u.count > 0) n += u.count; }); return n; }

console.log('=== ① 逐回合轨迹（智能托管我方攻方 · 全兵种镜像） ===');
var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
var D = env.field;
console.log('战场距离 D = ' + D + '（弓射程 ' + (DATA.TROOPS.gongjian.range) + '）');
var recA = { side: 'atk', cmd: {} };
var guard = 0, firstHold = null;
while (!env.over && guard++ < 40) {
  var n = G.battle.smartApply(recA, env);
  var r = env.step();
  var atkF = 0, defF = 0;
  env.units.atk.forEach(function (u) { if (u.count > 0 && u.adv > atkF) atkF = u.adv; });
  env.units.def.forEach(function (u) { if (u.count > 0 && u.adv > defF) defF = u.adv; });
  var gap = Math.max(0, D - atkF - defF);
  var aG = pick(env.units.atk, 'gongjian'), dG = pick(env.units.def, 'gongjian');
  var aN = pick(env.units.atk, 'chuangnu'), aT = pick(env.units.atk, 'toudan');
  var aQ = pick(env.units.atk, 'qingji'), aC = pick(env.units.atk, 'changqiang');
  if (aG && aG.stance === 'hold' && firstHold == null) firstHold = { r: r.r, adv: Math.round(aG.adv), gap: Math.round(gap) };
  console.log('R' + String(r.r).padStart(2) + ' gap=' + String(Math.round(gap)).padStart(5)
    + ' 调兵=' + n
    + ' | 我：弓 ' + String(Math.round(aG ? aG.adv : 0)).padStart(5) + '/' + (aG ? aG.stance : '-')
    + ' 弩 ' + String(Math.round(aN ? aN.adv : 0)).padStart(5) + '/' + (aN ? aN.stance : '-')
    + ' 石 ' + String(Math.round(aT ? aT.adv : 0)).padStart(5) + '/' + (aT ? aT.stance : '-')
    + ' 枪 ' + String(Math.round(aC ? aC.adv : 0)).padStart(5) + '/' + (aC ? aC.stance : '-')
    + ' 骑 ' + String(Math.round(aQ ? aQ.adv : 0)).padStart(5) + '/' + (aQ ? aQ.stance : '-')
    + ' | 敌：弓 ' + String(Math.round(dG ? dG.adv : 0)).padStart(5) + '/' + (dG ? dG.stance : '-')
    + ' 兵 ' + total(env.units.atk) + ' vs ' + total(env.units.def));
}
console.log('');
console.log('我弓首次 hold：' + (firstHold ? ('R' + firstHold.r + ' · adv=' + firstHold.adv + ' · gap=' + firstHold.gap
  + '（射程 1200 内 ' + (firstHold.gap <= 1200) + '）') : '从未 hold'));
console.log('');

console.log('=== ② 战斗模拟速度（赛马成本评估） ===');
var t0 = Date.now();
var N = 30;
for (var k = 0; k < N; k++) {
  var e2 = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  var g2 = 0;
  while (!e2.over && g2++ < 40) { e2.step(); }
}
var ms = Date.now() - t0;
console.log('跑 ' + N + ' 局无智能全速模拟：' + ms + 'ms（平均 ' + (ms / N).toFixed(1) + 'ms/局）');

var t1 = Date.now();
for (var k2 = 0; k2 < N; k2++) {
  var e3 = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  var rec3 = { side: 'atk', cmd: {} };
  var g3 = 0;
  while (!e3.over && g3++ < 40) { G.battle.smartApply(rec3, e3); e3.step(); }
}
var ms2 = Date.now() - t1;
console.log('跑 ' + N + ' 局带智能模拟：' + ms2 + 'ms（平均 ' + (ms2 / N).toFixed(1) + 'ms/局）');
process.exit(0);
