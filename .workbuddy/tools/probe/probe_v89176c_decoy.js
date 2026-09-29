/* v89.176 探针 C：**饵的价值 / 1 兵卡线对照 / 撤退止损**
   G 段：我方仅 changqiang500 + minfu1（无同名）—— 看 1 兵民夫把敌线卡在哪、卡几回合；
        附逐回合事件明细（谁打谁、杀多少）。
   H 段：饵 + 器械输出的收益对照（minfu 300 + toudan 100 vs 无饵版）。
   I 段：撤退止损 —— 每回合记录累计损失，算"打到 30% 就撤"能保下多少兵（模拟近似）。
   跑法：node .workbuddy/tools/probe/probe_v89176c_decoy.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function pick(list, id) { var o = null; list.forEach(function (u) { if (u.id === id) o = u; }); return o; }

var FOE = { gongjian: 1200, qingji: 800 };

function run(name, atk, opts2) {
  opts2 = opts2 || {};
  var env = T.begin(atk, null, opts2.foe || FOE, 0, null, {});
  var a0 = 0, d0 = 0;
  env.units.atk.forEach(function (u) { a0 += u.count; });
  env.units.def.forEach(function (u) { d0 += u.count; });
  var g = 0, rows = [];
  while (!env.over && g++ < 30) {
    var st = env.step();
    var aR = 0, dR = 0, fA = 0, fAid = '', fD = 0;
    env.units.atk.forEach(function (u) { if (u.count > 0) { aR += u.count; if (u.adv > fA) { fA = u.adv; fAid = u.id; } } });
    env.units.def.forEach(function (u) { if (u.count > 0) { dR += u.count; if (u.adv > fD) fD = u.adv; } });
    var evs = [];
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' || e.kind === 'counter') {
        evs.push((e.side === 'atk' ? '我' : '敌') + e.name + '→' + e.target + ':' + e.kill);
      }
    });
    rows.push({ r: st.r, gap: st.gap, aRem: aR, dRem: dR, fA: Math.round(fA), fAid: fAid, fD: Math.round(fD), evs: evs });
  }
  var r = env.finish();
  console.log('== ' + name + ' ==  ' + (r.winner === 'atk' ? '胜' : (r.winner === 'def' ? '败' : '平'))
    + ' ' + (r.rounds || g) + '回合  我损=' + r.atkLoss + '/' + a0 + '（' + Math.round(r.atkLoss / a0 * 100) + '%）'
    + ' 敌损=' + r.defLoss + '/' + d0);
  rows.forEach(function (x) {
    console.log('   r' + x.r + ' gap=' + x.gap + ' 我前=' + x.fA + '(' + x.fAid + ') 敌前=' + x.fD
      + ' 存:我' + x.aRem + '/敌' + x.dRem + '  ' + x.evs.join(' | '));
  });
  return { r: r, rows: rows, a0: a0, d0: d0, env: env };
}

console.log('=========================================');
console.log('【G】1 兵民夫卡线（我方 changqiang500 + minfu1；敌无同名 → 全打最近）');
console.log('=========================================');
run('G 1兵民夫', { changqiang: 500, minfu: 1 });
console.log('');
console.log('   对照：无民夫');
run('G0 无民夫', { changqiang: 500 });

console.log('');
console.log('=========================================');
console.log('【H】饵+器械输出（minfu300 + toudan100；敌无同名 —— 我方无器械对照）');
console.log('=========================================');
run('H0 toudan100 alone', { toudan: 100 });
run('H1 minfu300+toudan100', { toudan: 100, minfu: 300 });
run('H2 minfu500+toudan200', { toudan: 200, minfu: 500 });

console.log('');
console.log('=========================================');
console.log('【I】撤退止损：把 G0/D0 的逐回合损失表列出，算 30% 线在哪回合（打到底 vs 撤退）');
console.log('=========================================');
(function () {
  var x = run('I 基线（changqiang500+daodun300 vs 敌）', { changqiang: 500, daodun: 300 });
  var a0 = x.a0;
  var cum = 0, idx = -1;
  x.rows.forEach(function (row, i) {
    var lost = a0 - row.aRem;
    if (idx < 0 && lost / a0 >= 0.30) { idx = i; }
  });
  if (idx >= 0) {
    var row = x.rows[idx];
    console.log('   损失首达 30% 在 r' + row.r + '：存活 ' + row.aRem + '/' + a0
      + '（若此刻撤退可保 ' + row.aRem + ' 兵 = ' + Math.round(row.aRem / a0 * 100) + '%）');
    console.log('   打到底：存活 0（全灭）→ 撤退可多保 ' + row.aRem + ' 兵');
  }
})();

process.exit(0);
