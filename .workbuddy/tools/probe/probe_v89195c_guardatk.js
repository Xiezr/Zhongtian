/* v89.195 探针C：守将「攻防成型」的平衡影响扫描（v89.185 定稿场景复现）
   背景：v89.185 把守将四维/体力"成型"（guardFillOf），但**攻防（attack/defense）
   遗漏**——守将攻防恒为 base 10（+1% 全军攻防）。本轮候选：guardFillOf 补攻防
   （与四维同一把尺 · dimK 同乘折损）。
   目标：量出"补攻防"对 v89.185 已定稿场景（野地 Lv10 / 据点 Lv10 可胜）的影响。
   A 组 = 现状（攻防 10）；B 组 = 补攻防（dimK=0.5）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'guardatk', region: '豫州' });
G.state.world.weather = 'clear';
function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }

/* 守将（复刻 guardFillOf + 可选攻防补全 · atkK=攻防折损系数） */
function mk(rankId, lv, dim, withAtk, atkK) {
  var g = G.makeGeneral('测', lv, 'guard', null, false, rankId, 'balance');
  var rk = G.rankOf(g);
  var m = { tong: 1, nz: 1, yw: 1, zm: 1 }, f = 1.25;
  var up = Math.max(0, lv - 1);
  ['tong', 'yw', 'zm', 'nz'].forEach(function (d) {
    g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dim);
  });
  g.freePts = 0;
  G.setStaNow(g, Math.round(100 + (G.staMax(g) - 100) * 0.8));
  if (withAtk) {
    var k = atkK == null ? dim : atkK;
    var gb = DATA.GEN_BASE || { attack: 10, defense: 10 };
    g.attack = Math.round(gb.attack + up * 0.4 * (rk.grow || 1) * k);
    g.defense = Math.round(gb.defense + up * 0.4 * (rk.grow || 1) * k);
  }
  g.npcGuard = true;
  return g;
}
var MYGEN = G.makeGeneral('我方', 60, 'idle', null, false, 'ying', 'balance');
(function () {   /* 我方将：满状态（与 v89.185 探针一致；攻防按现状 10） */
  G.setStaNow(MYGEN, G.staMax(MYGEN));
})();
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }

console.log('====== 守将「攻防补全」影响扫描（我方 1.5×守军 · 英杰 Lv60 满状态）======');
console.log('（A=现状 攻防10 · B=补攻防 dimK=0.5；观察维度：胜负 / 我损 / 我损比 / 守将全军攻防加成）');
[['野地', 10, 'wild'], ['野地', 7, 'wild'], ['据点', 10, 'fort'], ['据点', 7, 'fort'], ['据点', 5, 'fort']].forEach(function (sc) {
  var kind = sc[2], lv = sc[1];
  var def, armyA;
  if (kind === 'wild') {
    var wd = G.wildDefenseAt(200 + lv, 260, lv);
    def = wd.army;
    armyA = {}; for (var k in def) armyA[k] = Math.round(def[k] * 1.5);
  } else {
    def = G.map.fortGarrison(lv);
    armyA = {}; for (var k2 in def) armyA[k2] = Math.round(def[k2] * 1.5);
  }
  var rankId = (kind === 'wild') ? 'ying' : 'ming';
  var base = (kind === 'wild') ? 30 + (lv - 1) * 10 + 4 : 60 + (lv - 1) * 10 + 4;
  var r0 = sim(armyA, MYGEN, def, null);
  var rA = sim(armyA, MYGEN, def, mk(rankId, base, 0.5, false));
  var dgB = mk(rankId, base, 0.5, true);
  var rB = sim(armyA, MYGEN, def, dgB);
  var dgC = mk(rankId, base, 0.5, true, 0.25);
  var rC = sim(armyA, MYGEN, def, dgC);
  var pctC = G.genAttrs(dgC).atkPct;
  console.log('▶ ' + sc[0] + ' Lv' + lv + '（守军 ' + sum(def) + ' · 我方 ' + sum(armyA) + ' · 守将 ' + rankId + ' Lv' + base + '）');
  console.log('    无将　：' + (r0.winner === 'atk' ? '我胜' : '守胜') + '　我损 ' + r0.atkLoss);
  console.log('    A 现状：' + (rA.winner === 'atk' ? '我胜' : '守胜') + '　我损 ' + rA.atkLoss + '（比 ' + (rA.atkLoss / r0.atkLoss).toFixed(2) + '）');
  console.log('    B 攻防折0.5：' + (rB.winner === 'atk' ? '我胜' : '守胜') + '　我损 ' + rB.atkLoss + '（比 ' + (rB.atkLoss / r0.atkLoss).toFixed(2) + '）'
    + '　守将攻防 ' + dgB.attack + '（全军攻击 +' + (G.genAttrs(dgB).atkPct * 100).toFixed(1) + '%）');
  console.log('    C 攻防折0.25：' + (rC.winner === 'atk' ? '我胜' : '守胜') + '　我损 ' + rC.atkLoss + '（比 ' + (rC.atkLoss / r0.atkLoss).toFixed(2) + '）'
    + '　守将攻防 ' + dgC.attack + '（全军攻击 +' + (pctC * 100).toFixed(1) + '%）');
});

console.log('\n====== 边角对照：据点 Lv10 我方 1.2×/1.3×/1.4×/1.5×（A 现状 vs B 折0.5 vs C 折0.25）======');
[[1.2], [1.3], [1.4], [1.5]].forEach(function (mulA) {
  var def = G.map.fortGarrison(10), armyA = {};
  for (var k in def) armyA[k] = Math.round(def[k] * mulA[0]);
  var dgA = mk('ming', 60 + 9 * 10 + 4, 0.5, false);
  var dgB = mk('ming', 60 + 9 * 10 + 4, 0.5, true);
  var dgC = mk('ming', 60 + 9 * 10 + 4, 0.5, true, 0.25);
  var ra = sim(armyA, MYGEN, def, dgA);
  var rb = sim(armyA, MYGEN, def, dgB);
  var rcv = sim(armyA, MYGEN, def, dgC);
  console.log('  ' + mulA[0] + '×：A ' + (ra.winner === 'atk' ? '我胜' : '守胜') + ' 损' + ra.atkLoss
    + '　·　B ' + (rb.winner === 'atk' ? '我胜' : '守胜') + ' 损' + rb.atkLoss
    + '　·　C ' + (rcv.winner === 'atk' ? '我胜' : '守胜') + ' 损' + rcv.atkLoss);
});

console.log('\n完成。');
process.exit(0);
