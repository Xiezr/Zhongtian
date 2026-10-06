/* v89.164 扫参：目标组合 × 阈值 × 场景 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
function sum(a){var s=0;for(var k in a)s+=a[k];return s;}
function smartTick(env, side, opt) {
  opt = opt || {};
  var mine = env.units[side], theirs = env.units[side === 'atk' ? 'def' : 'atk'];
  var D = env.field || 1, themFront = 0;
  theirs.forEach(function (u) { if (u.count > 0 && u.adv > themFront) themFront = u.adv; });
  mine.forEach(function (u) {
    if (u.count <= 0) return;
    var gap = D - u.adv - themFront;
    var isRanged = u.range >= 500, isCav = u.spd >= 400, want;
    if (isRanged) want = (gap <= u.range * (opt.rangeK || 1)) ? 'hold' : 'advance';
    else if (isCav) want = (gap <= (opt.cavGap != null ? opt.cavGap : 300)) ? 'hold' : 'advance';
    else want = (gap <= (opt.infGap != null ? opt.infGap : 300)) ? 'hold' : 'advance';
    if (u.stance !== want) env.setCmd(side, u.id, { s: want });
  });
}
function targetsPlan(byId, opt) { return { byId: byId, smart: function (env, side) { smartTick(env, side, opt || {}); } }; }
function run(atkPlan, defArmy, label) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(defArmy || ARMY)), 0, null, { stances: {} });
  for (var tid in atkPlan.byId) { var c = atkPlan.byId[tid]; env.setCmd('atk', tid, { s: c.s || 'advance', t: c.t !== undefined ? c.t : '' }); }
  var guard = 0;
  while (!env.over && guard++ < 36) { if (atkPlan.smart) atkPlan.smart(env, 'atk'); var st = env.step(); if (!st) break; }
  var fin = env.finish();
  var aL = sum(fin.atkLossBy), dL = sum(fin.defLossBy), aTot = sum(ARMY), dTot = sum(defArmy || ARMY);
  console.log('  [' + label + '] r=' + fin.rounds + ' 我损=' + (aL/aTot*100).toFixed(1) + '% 敌损=' + (dL/dTot*100).toFixed(1) + '% 交换=' + (aL>0?(dL/aL).toFixed(2):'inf') + ' w=' + fin.winner);
  return { aL: aL, dL: dL, r: fin.rounds, w: fin.winner };
}

/* 目标组合 */
var TL = { changqiang: { t: 'qingji' } };
var TL_CAV = { changqiang: { t: 'qingji' }, qingji: { t: 'gongjian' }, tieji: { t: 'gongjian' }, tuqibing: { t: 'gongjian' }, hubaoqi: { t: 'gongjian' }, xiliangtieqi: { t: 'gongjian' }, nanjiangxiangbing: { t: 'gongjian' } };
var T_REMOTE = { gongjian: { t: 'gongjian' }, chuangnu: { t: 'chuangnu' }, toudan: { t: 'gongjian' } };
var T_SHIELD = { daodun: { t: 'gongjian' }, tengjiabing: { t: 'changqiang' } };
var T_FULL = {};
[TL, TL_CAV, T_REMOTE, T_SHIELD].forEach(function (o) { for (var k in o) T_FULL[k] = o[k]; });

G.newGame({ name: 'grid', region: '烬环' });
console.log('=== A. 目标组合 × 统一阈值(300) ===');
run({ byId: {}, smart: function (e, s) { smartTick(e, s, {}); } }, null, 'T0 默认目标');
run(targetsPlan(TL), null, 'T1 仅枪→骑');
run(targetsPlan(TL_CAV), null, 'T2 枪→骑 + 骑→弓');
run(targetsPlan(T_FULL), null, 'T3 全组合');
run(targetsPlan(T_FULL, { rangeK: 0.95 }), null, 'T3b 全组合 rangeK0.95');

console.log('=== B. 阈值细化（全组合） ===');
[150, 250, 350, 500].forEach(function (g) { run(targetsPlan(T_FULL, { infGap: g, cavGap: g }), null, 'gap=' + g); });
[250].forEach(function (g) { run(targetsPlan(T_FULL, { infGap: g, cavGap: 600 }), null, 'infGap=' + g + ' cavGap=600'); });

console.log('=== C. 场景通用性（基线 vs 全组合 300） ===');
var S_CAV = { qingji: 600, tieji: 300, tuqibing: 400, hubaoqi: 200, xiliangtieqi: 150, nanjiangxiangbing: 40 };
var S_BOW = { gongjian: 1000, chuangnu: 150, toudan: 60, daodun: 400 };
var S_INF = { yibing: 1200, changqiang: 1200, daodun: 900, tengjiabing: 600, minfu: 300 };
[S_CAV, S_BOW, S_INF].forEach(function (enemy, i) {
  var nm = ['敌骑重', '敌弓重', '敌步重'][i];
  run({ byId: {}, smart: null }, enemy, nm + ' · 基线全adv');
  run(targetsPlan(T_FULL, {}), enemy, nm + ' · 智能全组合');
});
process.exit(0);
