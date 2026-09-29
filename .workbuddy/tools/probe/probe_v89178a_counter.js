/* v89.178 探针 A：**兵种克制系数的实际影响量化**
   老板令：「兵种克制太厉害了，兵种特性本身就体现在数值上了，外的系数给到3倍，
   游戏体感很差。766弓箭手杀伤35个敌方轻骑兵，这合理吗。」
   本探针：① 因子速查（攻/防两向因子 → 实际对冲系数 cf）；
           ② 关键对局矩阵（现状 vs 无克制对照）；
           ③ 复现"766 弓打轻骑"逐回合杀伤。
   跑法：node .workbuddy/tools/probe/probe_v89178a_counter.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }

/* ---------- ① 因子速查 + cf 折算 ---------- */
console.log('=== ① 克制因子速查（无将领/科技裸值）===');
console.log('攻方 → 受方         攻因子  防因子   perA   perD   cf    伤害倍率(vs无克制)');
var PAIRS = [
  ['gongjian', 'qingji', '弓打轻骑（轻骑防箭）'],
  ['gongjian', 'daodun', '弓打刀盾（盾挡箭）'],
  ['gongjian', 'chongche', '弓打冲车（车防弓）'],
  ['changqiang', 'qingji', '枪打轻骑（枪克骑）'],
  ['qingji', 'changqiang', '轻骑打枪（枪拒马）'],
  ['chuangnu', 'chongche', '床弩打冲车'],
  ['gongjian', 'yibing', '弓打义兵（无克制·参照）'],
];
PAIRS.forEach(function (p) {
  var aid = p[0], bid = p[1];
  var obj = {}; obj[bid] = 1;
  var uA = { id: aid, cover: 0, atkPct: 0, vsCity: false };
  var uD = { id: bid, cover: 0, defPct: 0 };
  var mA = T.counterAtkOf(aid, obj);
  var mD = T.counterDefOf(bid, aid);
  var perA = T.perAtk(uA, { counterMul: mA });
  var perD = T.perDef(uD, { defMul: mD });
  var cf = T.clashFactor(perA, perD);
  var cf0 = T.clashFactor(T.perAtk(uA, { counterMul: 1 }), T.perDef(uD, { defMul: 1 }));
  console.log('  ' + p[2].padEnd(16) + ' ×' + String(mA).padEnd(5) + ' ×' + String(mD).padEnd(5)
    + ' ' + perA.toFixed(0).padStart(5) + '  ' + perD.toFixed(0).padStart(5)
    + '  ' + cf.toFixed(3) + '  ' + (cf / cf0).toFixed(2) + 'x');
});

/* ---------- ② 对局矩阵：现状 vs 无克制 ---------- */
function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var first = null, firstR = 0, a0 = sum(A), d0 = sum(B);
  var g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk' && !first) { first = e; firstR = st.r; }
    });
  }
  var fin = env.finish();
  var r = { win: fin.winner, rounds: fin.rounds || g, aLoss: fin.atkLoss, dLoss: fin.defLoss,
    a0: a0, d0: d0, first: first ? first.kill : null, firstT: first ? first.target : '', firstR: firstR };
  return r;
}
function withNoCounter(fn) {
  var bA = DATA.COUNTER_ATK, bD = DATA.COUNTER_DEF;
  DATA.COUNTER_ATK = {}; DATA.COUNTER_DEF = {};
  try { return fn(); } finally { DATA.COUNTER_ATK = bA; DATA.COUNTER_DEF = bD; }
}
var CASES = [
  ['766弓 vs 400轻骑', { gongjian: 766 }, { qingji: 400 }],
  ['766弓 vs 800轻骑', { gongjian: 766 }, { qingji: 800 }],
  ['枪4000 vs 轻骑2000 (同人口)', { changqiang: 4000 }, { qingji: 2000 }],
  ['枪4000 vs 轻骑4000 (同数量)', { changqiang: 4000 }, { qingji: 4000 }],
  ['800轻骑 vs 766弓 (骑冲弓)', { qingji: 800 }, { gongjian: 766 }],
  ['766弓 vs 766刀盾', { gongjian: 766 }, { daodun: 766 }],
  ['300床弩 vs 150冲车', { chuangnu: 300 }, { chongche: 150 }],
  ['766弓 vs 766义兵 (参照)', { gongjian: 766 }, { yibing: 766 }],
];
console.log('');
console.log('=== ② 对局矩阵（现状 vs 无克制）===');
CASES.forEach(function (c) {
  var now = simOne(c[1], c[2]);
  var raw = withNoCounter(function () { return simOne(c[1], c[2]); });
  function fmt(r) {
    return (r.win === 'atk' ? '胜' : '败') + ' ' + r.rounds + '回合'
      + ' 我损' + Math.round(r.aLoss / r.a0 * 100) + '% 敌损' + Math.round(r.dLoss / r.d0 * 100) + '%'
      + ' 首合杀' + (r.first == null ? '—' : r.first);
  }
  console.log('  ' + c[0]);
  console.log('    现状:   ' + fmt(now));
  console.log('    无克制: ' + fmt(raw));
});

/* ---------- ③ 复现"766 弓打轻骑"逐回合 ---------- */
console.log('');
console.log('=== ③ 766弓 vs 800轻骑 逐回合（我方弓的开火杀伤）===');
(function () {
  var env = T.begin({ gongjian: 766 }, null, { qingji: 800 }, 0, null, {});
  var g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    var lines = [];
    (st.events || []).forEach(function (e) {
      if (e.side !== 'atk') return;
      lines.push((e.kind === 'attack' ? '⚔ ' : '🛡 ') + e.name + ' → ' + e.target + ' 杀伤 ' + e.kill);
    });
    var dLeft = 0;
    env.units.def.forEach(function (u) { if (u.count > 0) dLeft += u.count; });
    console.log('  R' + st.r + ' gap=' + st.gap + ' 我766? → ' + lines.join(' | ')
      + '　(敌剩 ' + dLeft + ')');
  }
  var fin = env.finish();
  console.log('  结局: ' + (fin.winner === 'atk' ? '胜' : '败') + ' · 我损 ' + fin.atkLoss + ' · 敌损 ' + fin.defLoss);
})();

process.exit(0);
