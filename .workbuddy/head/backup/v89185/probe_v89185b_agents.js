/* v89.185（老板 2）：守将体系评估 —— 现状（3-25 级野地 / 24-65 据点 / 60-240 名城）
   vs 老板新配置（野地 30-120 英杰 / 据点 60-150 名世 / 名城 120-240）。
   真实引擎跑：各档目标的守军 × 守将 战力变化。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic, U = G.U;
G.newGame({ name: 'agents', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';

function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }

/* ---- 守将工厂：与真实生成同源（makeGeneral + 资质 + 特性）---- */
function mkGuard(rankId, lv, style) {
  var g = G.makeGeneral('测将', lv, 'guard', null, false, rankId, style || 'balance');
  g.npcGuard = true;
  return g;
}
/* 现状公式（野地）：rk = GEN_RANKS[1+⌊lv/3⌋]，等级 = max(3, lv*2) */
function oldWild(lv) { var idx = Math.min(4, 1 + Math.floor(lv / 3)); return mkGuard(DATA.GEN_RANKS[idx].id, Math.max(3, lv * 2 + 3)); }
/* 新公式（野地）：英杰，等级 = 30 + (lv-1)*10 + 4 */
function newWild(lv) { return mkGuard('ying', 30 + (lv - 1) * 10 + 4); }
/* 现状公式（据点）：rk = GEN_RANKS[min(4, 2+⌊lv/3⌋)]，等级 = max(10, lv*4+20) */
function oldFort(lv) { var idx = Math.min(4, 2 + Math.floor(lv / 3)); return mkGuard(DATA.GEN_RANKS[idx].id, Math.max(10, lv * 4 + 20) + 3); }
/* 新公式（据点）：名世，等级 = 60 + (lv-1)*10 + 4 */
function newFort(lv) { return mkGuard('ming', 60 + (lv - 1) * 10 + 4); }

/* ---- 玩家将领（中等：英杰 Lv60，平衡型）---- */
var MYGEN = mkGuard('ying', 60);

function sim(atk, ag, def, dg) {
  return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {});
}
function fmt(r) {
  return (r.winner === 'atk' ? '我胜' : (r.winner === 'def' ? '守胜' : '平')) +
    '  我损 ' + String(r.atkLoss).padEnd(7) + ' 敌损 ' + String(r.defLoss).padEnd(7) + r.rounds + '回合';
}
function runRow(tag, armyD, oldG, newG, armyA) {
  var r0 = sim(armyA, MYGEN, armyD, null);
  var r1 = sim(armyA, MYGEN, armyD, oldG);
  var r2 = sim(armyA, MYGEN, armyD, newG);
  console.log('  ' + tag.padEnd(18) + '无将: ' + fmt(r0));
  console.log('  ' + ''.padEnd(18) + '旧将(' + oldG.level + '/档' + Math.round(DATA.GEN_RANKS.indexOf(DATA.GEN_RANK_BY_ID[oldG.rank]) + 1) + '): ' + fmt(r1));
  console.log('  ' + ''.padEnd(18) + '新将(' + newG.level + '/' + newG.rank + '): ' + fmt(r2));
  console.log('');
}

console.log('====== 一、野地（我方 1.5×守军 兵力，英杰 Lv60 带队）======');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(200 + lv, 260, lv);
  var armyA = {};
  for (var k in wd.army) armyA[k] = Math.round(wd.army[k] * 1.5);
  console.log('▶ 野地 Lv' + lv + '（守军 ' + wd.total + ' · 我方 ' + sum(armyA) + '）');
  runRow('Lv' + lv, wd.army, oldWild(lv), newWild(lv), armyA);
});

console.log('====== 二、据点（我方 1.5×守军 兵力）======');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var garr = G.map.fortGarrison(lv);
  var armyA = {};
  for (var k in garr) armyA[k] = Math.round(garr[k] * 1.5);
  console.log('▶ 据点 Lv' + lv + '（守军 ' + sum(garr) + ' · 我方 ' + sum(armyA) + '）');
  runRow('Lv' + lv, garr, oldFort(lv), newFort(lv), armyA);
});

console.log('====== 三、名城守将（区间对照 · 只列新旧等级区间）======');
console.log('  旧：county 60~100 · jun 100~140 · zhou 140~190 · capital 190~240');
console.log('  新：county 120~150 · jun 150~180 · zhou 180~210 · capital 210~240');

process.exit(0);
