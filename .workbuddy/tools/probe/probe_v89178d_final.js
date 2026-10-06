/* v89.178 探针 D（定稿版）：**克制系数方案对比**（固定天气=晴）
   修正两处探针纪律：
     · 固定 `world.weather = 'clear'`（雪天 move 0.5 → 接敌间距落入射程衰减区 → 首杀减半，
       会让"改前 21 / 改后 X"的对账失真）；
     · 铁骑同人口改用 pop 换算（铁骑 pop3：4000 枪 4000pop vs 1333 铁骑 4000pop）。
   跑法：node .workbuddy/tools/probe/probe_v89178d_final.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '碎垣' });
GAME.state.world.weather = 'clear';   /* ★ 固定天气（雪天会因 move 0.5 拖慢接敌 → 首杀腰斩） */

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
console.log('加成链: atkMult=' + GAME.story.atkMult().toFixed(3) + ' defMult=' + (1 + GAME.story.defMult()).toFixed(3)
  + ' weather=' + GAME.story.currentWeather().name);

/* ---------- 段 0：天气对照（证明雪天的影响机制）---------- */
console.log('');
console.log('=== 段0 · 天气对照（现状表 · 766弓 vs 400轻骑）===');
function quickFirst(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var first = null, g = 0, gaps = [];
  while (!env.over && g++ < 40) {
    var st = env.step();
    gaps.push(st.gap);
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk' && !first) first = { kill: e.kill, gap: st.gap, r: st.r };
    });
  }
  return { first: first, gaps: gaps.slice(0, 4), dLoss: env.finish().defLoss };
}
GAME.state.world.weather = 'clear';
var c1 = quickFirst({ gongjian: 766 }, { qingji: 400 });
GAME.state.world.weather = 'snow';
var c2 = quickFirst({ gongjian: 766 }, { qingji: 400 });
console.log('  晴天(clear): 首杀 ' + JSON.stringify(c1.first) + '  前3回合gap=' + c1.gaps.join(',') + '  敌损=' + c1.dLoss);
console.log('  雪天(snow):  首杀 ' + JSON.stringify(c2.first) + '  前3回合gap=' + c2.gaps.join(',') + '  敌损=' + c2.dLoss);
GAME.state.world.weather = 'clear';

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
  'P1彻底(枪2·弩2.5·盾2/拒马2.5)': plan(2, 2.5, 2, 2.5, 2, 1.5, 3, 2, 1.5),
  'P2保守(枪2.5·弩3·盾2/拒马3)': plan(2.5, 3, 2, 3, 2, 1.5, 3, 2, 1.5),
  'P3折中(枪2.5·弩2.5·盾2/拒马2.5)': plan(2.5, 2.5, 2, 2.5, 2, 1.5, 3, 2, 1.5),
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
  ['800轻骑 vs 766弓（冲弓阵）', { qingji: 800 }, { gongjian: 766 }],
  ['枪4000 vs 骑2000 ★同人口', { changqiang: 4000 }, { qingji: 2000 }],
  ['枪4000 vs 骑4000（骑2倍人口）', { changqiang: 4000 }, { qingji: 4000 }],
  ['枪4000 vs 铁骑1333 ★同人口', { changqiang: 4000 }, { tieji: 1333 }],
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
    console.log('    ' + nm.padEnd(32) + fmt(r));
  });
  restore();
});
process.exit(0);
