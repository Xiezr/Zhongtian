/* v89.178 探针 E（改后固化 · 新表在库）：**克制降档的交货数据**
   输出：① 因子速查（新表 × clashFactor 折算后的"实际倍率"）
        ② 晴天/雨天双矩阵（关键对局：首杀 + 结局）——天气影响弓的射程/开火时机
        ③ 老板场景逐回合（766 弓打轻骑，"可对账 35"的那条线）
   跑法：node .workbuddy/tools/probe/probe_v89178e_after.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '豫州' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function setW(w) { GAME.state.world.weather = w; }

/* ---------- ① 因子速查（含"vs 无克制"实际倍率）---------- */
setW('clear');
console.log('=== ① 因子速查（v89.178 新表 · 无将 · 晴天）===');
console.log('对局                      攻因子 防因子   cf     实际倍率(vs无克制)');
var PAIRS = [
  ['gongjian', 'qingji', '弓打轻骑'], ['gongjian', 'daodun', '弓打刀盾'],
  ['gongjian', 'chongche', '弓打冲车'], ['changqiang', 'qingji', '枪打轻骑'],
  ['qingji', 'changqiang', '轻骑打枪'], ['chuangnu', 'chongche', '床弩打冲车'],
  ['gongjian', 'yibing', '弓打义兵(参照)'],
];
PAIRS.forEach(function (p) {
  var obj = {}; obj[p[1]] = 1;
  var uA = { id: p[0], cover: 0, atkPct: 0, vsCity: false };
  var uD = { id: p[1], cover: 0, defPct: 0 };
  var mA = T.counterAtkOf(p[0], obj);
  var mD = T.counterDefOf(p[1], p[0]);
  var cf = T.clashFactor(T.perAtk(uA, { counterMul: mA }), T.perDef(uD, { defMul: mD }));
  var cf0 = T.clashFactor(T.perAtk(uA, { counterMul: 1 }), T.perDef(uD, { defMul: 1 }));
  console.log('  ' + p[2].padEnd(14) + ' ×' + String(mA).padEnd(5) + ' ×' + String(mD).padEnd(5)
    + ' ' + cf.toFixed(3) + '   ' + (cf / cf0).toFixed(2) + 'x');
});

/* ---------- ② 双天气矩阵 ---------- */
function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var first = null, g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk' && first == null) first = e.kill;
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
  ['766弓 vs 400轻骑 ★老板场景', { gongjian: 766 }, { qingji: 400 }],
  ['766弓 vs 800轻骑', { gongjian: 766 }, { qingji: 800 }],
  ['800轻骑 vs 766弓（冲弓阵）', { qingji: 800 }, { gongjian: 766 }],
  ['枪4000 vs 骑2000 ★同人口', { changqiang: 4000 }, { qingji: 2000 }],
  ['枪4000 vs 骑4000（骑2倍人口）', { changqiang: 4000 }, { qingji: 4000 }],
  ['枪4000 vs 铁骑1333 ★同人口', { changqiang: 4000 }, { tieji: 1333 }],
  ['300床弩 vs 150冲车 ★守卫', { chuangnu: 300 }, { chongche: 150 }],
  ['766弓 vs 766刀盾', { gongjian: 766 }, { daodun: 766 }],
  ['766弓 vs 300冲车', { gongjian: 766 }, { chongche: 300 }],
];
['clear', 'rain'].forEach(function (w) {
  setW(w);
  console.log('');
  console.log('=== ② 矩阵 · 天气=' + GAME.story.currentWeather().name
    + (w === 'rain' ? '（弓射程 −20%）' : '（无修正）') + ' ===');
  CASES.forEach(function (c) {
    console.log('  ' + c[0].padEnd(30) + fmt(simOne(c[1], c[2])));
  });
});

/* ---------- ③ 老板场景逐回合（雨天 —— 对账"35"的那条线）---------- */
setW('rain');
console.log('');
console.log('=== ③ 766弓 vs 800轻骑 逐回合（雨天；改前此线下 R2 杀 21，带将 ≈35 = 老板所见）===');
(function () {
  var env = T.begin({ gongjian: 766 }, null, { qingji: 800 }, 0, null, {});
  var g = 0;
  while (!env.over && g++ < 40) {
    var st = env.step();
    var lines = [];
    (st.events || []).forEach(function (e) {
      if (e.side !== 'atk' || e.kind !== 'attack') return;
      lines.push(e.name + ' → ' + e.target + ' 杀伤 ' + e.kill);
    });
    var dLeft = 0;
    env.units.def.forEach(function (u) { if (u.count > 0) dLeft += u.count; });
    console.log('  R' + st.r + ' gap=' + st.gap + ' ' + (lines.join(' | ') || '（推进/受击）') + '　敌剩 ' + dLeft);
  }
  var fin = env.finish();
  console.log('  结局: ' + (fin.winner === 'atk' ? '胜' : '败') + ' · 我损 ' + fin.atkLoss + ' · 敌损 ' + fin.defLoss);
})();
process.exit(0);
