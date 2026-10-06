/* v89.178 探针 C（正式版）：**克制系数新方案对比**（P1/P2/P3）
   纪律修正：固定 region（消除"年号/天时"漂移——上一版 region:'random' 抽到不同
   atkEra 导致整体数值减半，误判方案 A"崩了"）。
   守卫对局（不能崩的"克制生命线"）：
     · 枪4000 vs 骑2000 同人口 —— 枪克骑要保住（胜）
     · 床弩300 vs 冲车150 —— 弩打器械要保住（胜或接近）
   核心体感场景：766弓打轻骑（老板点名）——首杀要从 21 提升。
   跑法：node .workbuddy/tools/probe/probe_v89178c_final.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '碎垣' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
console.log('加成链体检: atkMult=' + GAME.story.atkMult().toFixed(3)
  + ' defMult=' + (1 + GAME.story.defMult()).toFixed(3)
  + ' combatMod=' + JSON.stringify(GAME.story.combatMod()));

/* ---------- 方案 ---------- */
var K = ['qingji', 'tieji', 'tuqibing', 'hubaoqi', 'xiliangtieqi'];
var V = ['gongjian', 'chuangnu', 'toudan'];
function fam(ids, v) { var o = {}; ids.forEach(function (id) { o[id] = v; }); return o; }
function plan(atkGun, nu, shu, gun, qing, tie, che, hu, xi) {
  return {
    atk: { changqiang: fam(K, atkGun), chuangnu: { chongche: nu, zhouche: nu, toudan: nu, chuangnu: nu } },
    def: {
      daodun: fam(V, shu), changqiang: fam(K, gun),
      qingji: fam(V, qing), tieji: fam(V, tie), chongche: { gongjian: che },
      hubaoqi: fam(V, hu), xiliangtieqi: fam(V, xi),
    },
  };
}
var PLANS = {
  '现状': null,
  'P1(攻2·弩2.5·盾2.5/2/2/1.5)': plan(2, 2.5, 2, 2.5, 2, 1.5, 3, 2, 1.5),
  'P2(攻2.5·弩3·防只压远程)': plan(2.5, 3, 2, 3, 2, 1.5, 3, 2, 1.5),
  'P3(攻2·弩2.5·防再低:1.8/1.2)': plan(2, 2.5, 1.8, 2.5, 1.8, 1.2, 2.5, 1.8, 1.2),
};
function applyPlan(name) {
  var p = PLANS[name];
  if (!p) return;
  DATA.COUNTER_ATK = JSON.parse(JSON.stringify(p.atk));
  DATA.COUNTER_DEF = JSON.parse(JSON.stringify(p.def));
}
var BK = { a: DATA.COUNTER_ATK, d: DATA.COUNTER_DEF };
function restore() { DATA.COUNTER_ATK = BK.a; DATA.COUNTER_DEF = BK.d; }
restore();

function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var first = null, g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk' && !first) first = e.kill;
    });
  }
  var fin = env.finish();
  return { win: fin.winner, rounds: fin.rounds || g, aLoss: fin.atkLoss, dLoss: fin.defLoss,
    a0: sum(A), d0: sum(B), first: first };
}
function fmt(r) {
  return (r.win === 'atk' ? '胜' : '败') + ' ' + String(r.rounds).padStart(2) + '合'
    + ' 我损' + String(Math.round(r.aLoss / r.a0 * 100)).padStart(3) + '%'
    + ' 敌损' + String(Math.round(r.dLoss / r.d0 * 100)).padStart(3) + '%'
    + ' 首杀' + String(r.first == null ? '—' : r.first).padStart(4);
}
var CASES = [
  ['766弓 vs 400轻骑 ★核心场景', { gongjian: 766 }, { qingji: 400 }],
  ['766弓 vs 800轻骑', { gongjian: 766 }, { qingji: 800 }],
  ['800轻骑 vs 766弓', { qingji: 800 }, { gongjian: 766 }],
  ['枪4000 vs 骑2000 ★同人口', { changqiang: 4000 }, { qingji: 2000 }],
  ['枪4000 vs 骑4000 同数量', { changqiang: 4000 }, { qingji: 4000 }],
  ['枪4000 vs 铁骑2000 ★同人口', { changqiang: 4000 }, { tieji: 2000 }],
  ['300床弩 vs 150冲车 ★守卫', { chuangnu: 300 }, { chongche: 150 }],
  ['766弓 vs 766刀盾', { gongjian: 766 }, { daodun: 766 }],
  ['766弓 vs 300冲车', { gongjian: 766 }, { chongche: 300 }],
];
var NAMES = Object.keys(PLANS);
console.log('');
CASES.forEach(function (c) {
  console.log('▶ ' + c[0]);
  NAMES.forEach(function (nm) {
    if (PLANS[nm]) applyPlan(nm); else restore();
    var r = simOne(c[1], c[2]);
    console.log('    ' + nm.padEnd(30) + fmt(r));
  });
  restore();
});
process.exit(0);
