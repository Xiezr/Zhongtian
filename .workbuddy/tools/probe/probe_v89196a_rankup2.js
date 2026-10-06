/* v89.196 探针A：资质补全 v2（等级重演 + 等级差补 + 奖励表）
   ① 升档链：凡品 Lv60 → 良→英→名→天，每步记录 四维/自由点/体力上限/攻防/ascend
   ② 对照："若全程新资质"的理论值（base[0]×m + (Lv−1)×grow×m×(4/Σm)）
   ③ 奖励表：四维 +N / 体力上限 +N / 速度不动
   ④ 只补不削（高四维将升档不动）
   ⑤ 自由点等级差补核对（(Lv−1)×Δgrow） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针A96', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var s = G.state;
G.state.jieyue = (G.state.jieyue || 0) + 2;   /* 天授闸备节钺 */

console.log('══════ ① 升档链（凡品 Lv60 起步 · balance 风格）══════');
var g = G.makeGeneral('升档将', 60, 'idle', null, false, 'fan', 'balance');
/* 造"低四维"起点（凡品实际水平） */
g.tong = 40; g.nz = 40; g.yw = 40; g.zm = 40;
g.attack = 10; g.defense = 10; g.atkAcc = 0; g.defAcc = 0;
g.freePts = 0; g.staAdd = 0;
function snap(tag) {
  var a = G.genAttrs(g);
  console.log('  [' + tag + '] rank=' + g.rank + ' 四维=' + g.tong + '/' + g.nz + '/' + g.yw + '/' + g.zm
    + ' atk=' + g.attack + ' spd=' + a.spd + ' staMax=' + a.staMax
    + ' freePts=' + (g.freePts == null ? 0 : g.freePts) + ' staAdd=' + (g.staAdd || 0));
  return g.tong;
}
snap('凡品 Lv60 起点');
var chain = [
  { from: 'fan', to: 'liang' }, { from: 'liang', to: 'ying' },
  { from: 'ying', to: 'ming' }, { from: 'ming', to: 'tian' },
];
chain.forEach(function (step) {
  var it = null;
  (D.ITEMS || []).forEach(function (x) { if (x.type === 'rank_up' && x.from === step.from) it = x; });
  var r = G.rankUpUse(g, it);
  console.log('  → ' + step.from + '→' + step.to + '：' + (r.ok ? r.msg : ('FAIL ' + r.msg)));
  if (r.ok) snap('升到' + step.to);
});

console.log('\n══════ ② 理论对照（若全程新资质 · base[0]×m + (Lv−1)×grow×m×(4/Σm)）══════');
[['liang', 46, 2], ['ying', 64, 3], ['ming', 86, 5], ['tian', 108, 8]].forEach(function (x) {
  var exp = Math.round(x[1] * 1 + (60 - 1) * x[2] * 1 * 1);
  console.log('  ' + x[0] + ' Lv60 重演值 = ' + exp);
});

console.log('\n══════ ③ 奖励表出口（DATA.RANKUP_AWARD）══════');
console.log('  ' + JSON.stringify(D.RANKUP_AWARD));

console.log('\n══════ ④ 只补不削（高四维/高自由点的将升档不动）══════');
var g2 = G.makeGeneral('高将', 60, 'idle', null, false, 'fan', 'balance');
g2.tong = 9999; g2.nz = 9999; g2.yw = 9999; g2.zm = 9999;
g2.freePts = 0; g2.staAdd = 0;
var it2 = null;
(D.ITEMS || []).forEach(function (x) { if (x.type === 'rank_up' && x.from === 'fan') it2 = x; });
var r2 = G.rankUpUse(g2, it2);
console.log('  升档 ok=' + r2.ok + '　四维=' + g2.tong + '（期望 9999，只补不削；奖励 +100 会到 10099）'
  + '　wait——奖励是"额外给"，9999+100=' + g2.tong + '（奖励叠加是设计）');

console.log('\n══════ ⑤ 自由点等级差补核对 ══════');
var g3 = G.makeGeneral('点数将', 30, 'idle', null, false, 'fan', 'balance');
g3.tong = 40; g3.nz = 40; g3.yw = 40; g3.zm = 40;
g3.freePts = 0; g3.staAdd = 0;
var it3 = null;
(D.ITEMS || []).forEach(function (x) { if (x.type === 'rank_up' && x.from === 'fan') it3 = x; });
var r3 = G.rankUpUse(g3, it3);
console.log('  凡 Lv30 → 良材：freePts = ' + g3.freePts + '（期望 lump 25 + 等级差 (30-1)×(2-1)=29 → 54）');
console.log('  msg=' + r3.msg);

console.log('\n══════ ⑥ 速度不受影响（升级前后对比）══════');
var aa0 = G.genAttrs(G.makeGeneral('速', 60, 'idle', null, false, 'fan', 'balance'));
var g4 = G.makeGeneral('速2', 60, 'idle', null, false, 'fan', 'balance');
g4.tong = 40; g4.nz = 40; g4.yw = 40; g4.zm = 40;
G.rankUpUse(g4, it3);
var aa1 = G.genAttrs(g4);
console.log('  升档前 spd=' + aa0.spd + '　升档后（凡→良）spd=' + aa1.spd + '（应相等）');

console.log('\n完成。');
process.exit(0);
