/* v89.185（老板 2 · 评估）：守将体系修改的实战影响 ——
   "旧形态"（makeGeneral 半残：四维=base 区间、体力 100）vs "新形态"（guardFillOf：四维按等级 + 满体力）。
   真实引擎跑：各档目标的守军 × 三种守将（无/旧/新）战力对照。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'ag2', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';

function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }
function mkGuard(rankId, lv, full, fold) {
  var g = G.makeGeneral('测将', lv, 'guard', null, false, rankId, 'balance');
  if (full) G.guardFillOf(g, fold ? DATA.GUARD_FOLD : null);   /* v89.185：wild/fort 走折损口径 */
  g.npcGuard = true;
  return g;
}
/* 旧形态（改动前口径）：四维 base 区间 + 体力 100 */
function oldWild(lv) { var idx = Math.min(4, 1 + Math.floor(lv / 3)); return mkGuard(DATA.GEN_RANKS[idx].id, Math.max(3, lv * 2 + 3), false); }
function oldFort(lv) { var idx = Math.min(4, 2 + Math.floor(lv / 3)); return mkGuard(DATA.GEN_RANKS[idx].id, Math.max(10, lv * 4 + 20) + 3, false); }
/* 新形态（改动后）：等级按老板区间 + guardFillOf 满状态 */
function newWild(lv) { return mkGuard('ying', 30 + (lv - 1) * 10 + 4, true, true); }
function newFort(lv) { return mkGuard('ming', 60 + (lv - 1) * 10 + 4, true, true); }

var MYGEN = mkGuard('ying', 60, true);
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }
function fmt(r) { return (r.winner === 'atk' ? '我胜' : '守胜') + ' 我损 ' + String(r.atkLoss).padEnd(6) + ' 敌损 ' + String(r.defLoss).padEnd(7) + r.rounds + '回合'; }
function dump(tag, g) {
  var a = G.genAttrs(g);
  return tag + ' Lv' + g.level + '(' + g.rank + ') 四维' + a.tong + '/体' + Math.round(G.staNow(g)) + ' hp×' + (1 + G.staHpBonus(g)).toFixed(2);
}

console.log('====== 一、野地（我方 1.5×守军 · 英杰 Lv60 满状态带队）======');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(200 + lv, 260, lv);
  var armyA = {};
  for (var k in wd.army) armyA[k] = Math.round(wd.army[k] * 1.5);
  var r0 = sim(armyA, MYGEN, wd.army, null);
  var r1 = sim(armyA, MYGEN, wd.army, oldWild(lv));
  var r2 = sim(armyA, MYGEN, wd.army, newWild(lv));
  console.log('▶ 野地 Lv' + lv + '（守军 ' + wd.total + '）');
  console.log('   ' + dump('旧', oldWild(lv)));
  console.log('   ' + dump('新', newWild(lv)));
  console.log('   无将: ' + fmt(r0));
  console.log('   旧将: ' + fmt(r1));
  console.log('   新将: ' + fmt(r2));
});
console.log('');
console.log('====== 二、据点（我方 1.5×守军）======');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var garr = G.map.fortGarrison(lv);
  var armyA = {};
  for (var k in garr) armyA[k] = Math.round(garr[k] * 1.5);
  var r0 = sim(armyA, MYGEN, garr, null);
  var r1 = sim(armyA, MYGEN, garr, oldFort(lv));
  var r2 = sim(armyA, MYGEN, garr, newFort(lv));
  console.log('▶ 据点 Lv' + lv + '（守军 ' + sum(garr) + '）');
  console.log('   ' + dump('旧', oldFort(lv)));
  console.log('   ' + dump('新', newFort(lv)));
  console.log('   无将: ' + fmt(r0));
  console.log('   旧将: ' + fmt(r1));
  console.log('   新将: ' + fmt(r2));
});
console.log('');
console.log('====== 三、名城守将区间（新旧对照 · 只列数值）======');
console.log('  旧：county 60~100 / jun 100~140 / zhou 140~190 / capital 190~240');
console.log('  新：county 120~150 / jun 150~180 / zhou 180~210 / capital 210~240');
process.exit(0);
