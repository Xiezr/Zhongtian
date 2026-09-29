/* v89.178 探针 B：**克制系数候选方案对比**（为"削弱克制"定标）
   方案定义（在内存里替换 DATA.COUNTER_ATK / COUNTER_DEF，不落盘）：
     A 温和：攻 3→2；防 5→2.5、4→2、3→2、2→1.5
     B 收敛：攻 3→2；防 5→2.5、4→2、3→1.8、2→1.5（与 A 的差别在个别档）
   对照：现状 / 无克制。
   跑法：node .workbuddy/tools/probe/probe_v89178b_plans.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }

/* ---------- 方案表 ---------- */
var K = ['qingji', 'tieji', 'tuqibing', 'hubaoqi', 'xiliangtieqi'];
var V = ['gongjian', 'chuangnu', 'toudan'];
function m2(a) {   /* 把数组乘一个映射 */
  var o = {}; a.forEach(function (id) { o[id] = 1; }); return o;
}
function fam(ids, v) { var o = {}; ids.forEach(function (id) { o[id] = v; }); return o; }
var PLANS = {
  '现状': null,
  'A温和(攻2·防2.5/2/2/1.5)': {
    atk: { changqiang: fam(K, 2), chuangnu: { chongche: 2, zhouche: 2, toudan: 2, chuangnu: 2 } },
    def: {
      daodun: fam(V, 2), changqiang: fam(K, 2.5),
      qingji: fam(V, 2), tieji: fam(V, 1.5), chongche: { gongjian: 2.5 },
      hubaoqi: fam(V, 2), xiliangtieqi: fam(V, 1.5),
    },
  },
  'B收敛(攻2·防2.5/2/1.8/1.5)': {
    atk: { changqiang: fam(K, 2), chuangnu: { chongche: 2, zhouche: 2, toudan: 2, chuangnu: 2 } },
    def: {
      daodun: fam(V, 1.8), changqiang: fam(K, 2.5),
      qingji: fam(V, 2), tieji: fam(V, 1.5), chongche: { gongjian: 2.5 },
      hubaoqi: fam(V, 2), xiliangtieqi: fam(V, 1.5),
    },
  },
  'C狠(攻1.5·防2/1.5/1.5/1.2)': {
    atk: { changqiang: fam(K, 1.5), chuangnu: { chongche: 1.5, zhouche: 1.5, toudan: 1.5, chuangnu: 1.5 } },
    def: {
      daodun: fam(V, 1.5), changqiang: fam(K, 2),
      qingji: fam(V, 1.5), tieji: fam(V, 1.2), chongche: { gongjian: 2 },
      hubaoqi: fam(V, 1.5), xiliangtieqi: fam(V, 1.2),
    },
  },
};

function applyPlan(name) {
  var p = PLANS[name];
  if (!p) return;   /* 现状/null 由 restore 处理 */
  DATA.COUNTER_ATK = JSON.parse(JSON.stringify(p.atk));
  DATA.COUNTER_DEF = JSON.parse(JSON.stringify(p.def));
}
var BK = { a: DATA.COUNTER_ATK, d: DATA.COUNTER_DEF };
function restore() { DATA.COUNTER_ATK = BK.a; DATA.COUNTER_DEF = BK.d; }

/* ---------- 对局 ---------- */
function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var first = null, firstR = 0, a0 = sum(A), d0 = sum(B), g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk' && !first) { first = e; firstR = st.r; }
    });
  }
  var fin = env.finish();
  return { win: fin.winner, rounds: fin.rounds || g, aLoss: fin.atkLoss, dLoss: fin.defLoss,
    a0: a0, d0: d0, first: first ? first.kill : null, firstR: firstR };
}
function fmt(r) {
  return (r.win === 'atk' ? '胜' : '败') + ' ' + String(r.rounds).padStart(2) + '合'
    + ' 我损' + String(Math.round(r.aLoss / r.a0 * 100)).padStart(3) + '%'
    + ' 敌损' + String(Math.round(r.dLoss / r.d0 * 100)).padStart(3) + '%'
    + ' 首杀' + String(r.first == null ? '—' : r.first).padStart(4);
}
var CASES = [
  ['766弓 vs 400轻骑', { gongjian: 766 }, { qingji: 400 }],
  ['766弓 vs 800轻骑', { gongjian: 766 }, { qingji: 800 }],
  ['800轻骑 vs 766弓', { qingji: 800 }, { gongjian: 766 }],
  ['枪4000 vs 骑2000 同人口', { changqiang: 4000 }, { qingji: 2000 }],
  ['枪4000 vs 骑4000 同数量', { changqiang: 4000 }, { qingji: 4000 }],
  ['766弓 vs 766刀盾', { gongjian: 766 }, { daodun: 766 }],
  ['300床弩 vs 150冲车', { chuangnu: 300 }, { chongche: 150 }],
  ['766弓 vs 300冲车', { gongjian: 766 }, { chongche: 300 }],
];

var NAMES = Object.keys(PLANS);
console.log('=== 候选方案对比 ===');
CASES.forEach(function (c) {
  console.log('▶ ' + c[0]);
  NAMES.forEach(function (nm) {
    if (PLANS[nm]) applyPlan(nm); else restore();
    var r = simOne(c[1], c[2]);
    console.log('    ' + nm.padEnd(24) + fmt(r));
  });
  restore();
});
process.exit(0);
