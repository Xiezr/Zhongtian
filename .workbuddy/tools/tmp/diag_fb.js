var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
function sum(a){var s=0;for(var k in a)s+=a[k];return s;}
var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
G.newGame({ name: 'x', region: '司隶' });
/* 拦截：统计回退触发 + 记录每回合 tick */
var origApply = G.battle.smartApply;
var fbHits = [];
G.battle.smartApply = function (rec, env) {
  var plan = G.battle.smartPlanOf();
  var theirs = (env.units && env.units.def) || [];
  var aliveN = {};
  theirs.forEach(function (x) { if (x.count > 0) aliveN[x.id] = true; });
  ((env.units && env.units.atk) || []).forEach(function (u) {
    if (!(u.count > 0)) return;
    var wantT = plan.targets[u.id];
    if (wantT != null && !aliveN[wantT]) fbHits.push(rec.side + ' r?' + u.id + '→缺' + wantT);
  });
  return origApply(rec, env);
};
function run(smart) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  var rec = { side: 'atk', cmd: {} };
  var guard = 0;
  while (!env.over && guard++ < 36) { if (smart) G.battle.smartApply(rec, env); var st = env.step(); if (!st) break; }
  var fin = env.finish();
  return { aL: sum(fin.atkLossBy), dL: sum(fin.defLossBy), r: fin.rounds };
}
console.log('跑两次智能（确定性检查）：');
var a = run(true); console.log('  run1 =', JSON.stringify(a));
var b = run(true); console.log('  run2 =', JSON.stringify(b));
console.log('回退触发次数 =', fbHits.length, '· 样例 =', fbHits.slice(0, 6).join(' | '));
process.exit(0);
