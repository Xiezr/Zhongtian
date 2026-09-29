/* v89.194 探针B：批次A 行为验证（S1 金成本 / S4 欠俸忠诚）
   ① levelCost gold 五档 + Lv1-8 零金护栏 + 封顶
   ② 真调支付/退还链（canAffordIn / payCostIn / refundCert）
   ③ 欠俸 → 忠诚 -10；连欠封顶 -20；君主豁免
   ④ 忠诚 0 → marchBlockOf 拦；赏赐恢复后可出征
   ⑤ upgradeAt 端到端（金不足被拒 → 补足后入队） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '批次A', region: '司隶' });
if (!G.state.map.grid) G.map.generate();
var s = G.state, c0 = s.cities[0];

console.log('══════ ① levelCost gold 五档 ══════');
[1, 7, 8, 9, 10, 11, 12, 13, 20].forEach(function (lv) {
  var c = D.BUILDINGS.guanfu.levelCost(lv);
  console.log('  升到 Lv' + (lv + 1) + '：gold=' + (c.gold == null ? 0 : c.gold)
    + '　(期望 Lv9=3000 Lv10=6000 Lv11=12000 Lv12+=24000, ≤Lv8=0)');
});
console.log('  城墙 Lv9: ' + JSON.stringify(D.BUILDINGS.chengqiang.levelCost(8).gold));
console.log('  城外 farm（S1 口径不含）: ' + JSON.stringify(G.extBuildCost('farm', 8).gold || 0));

console.log('\n══════ ② 支付/退还链 ══════');
var cost = D.BUILDINGS.guanfu.levelCost(8);   /* 升到 Lv9：需 3000 金 */
console.log('  目标 cost.gold=' + cost.gold);
G.goldAdd(-G.goldOf());
console.log('  清零后 canAffordIn=false? ' + (G.canAffordIn(c0, cost) === false));
G.goldAdd(2500);
console.log('  2500 金 canAffordIn=false? ' + (G.canAffordIn(c0, cost) === false));
G.goldAdd(1000);
console.log('  3500 金 canAffordIn=true? ' + (G.canAffordIn(c0, cost) === true));
var before = G.goldOf();
var R0 = G.res(c0);
/* 资源也备足，避免被资源拦住 */
['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
  R0[k] = (R0[k] || 0) + (cost[k] || 0) + 1000;
});
G.payCostIn(c0, cost);
console.log('  支付后金 ' + before + ' → ' + G.goldOf() + '（应 -3000）');
G.refundCert(cost, 1.0, c0);
console.log('  全额退还后金 ' + G.goldOf() + '（应回 3500）');

console.log('\n══════ ③ 欠俸 → 忠诚 ══════');
var gens = (s.generals || []).filter(function (g) { return !G.isLordGeneral(g); });
var g1 = gens[0], lord = (s.generals || []).find(function (g) { return G.isLordGeneral(g); });
var loy0 = g1.loyalty, lordLoy0 = lord ? lord.loyalty : null;
G.goldAdd(-G.goldOf());          /* 府库清零 → 必欠俸 */
var at0 = s.salaryAt;
s.salaryAt = s.world.elapsed - 8 * 86400;   /* 拨钟 1 期 */
var r1 = G.settleGenSalary();
console.log('  1 期欠俸：' + JSON.stringify(r1));
console.log('  忠诚 ' + loy0 + ' → ' + g1.loyalty + '（应 -10）· 君主 ' + lordLoy0 + ' → ' + (lord ? lord.loyalty : '-') + '（不变）');
/* 连欠 3 期 */
s.salaryAt = s.world.elapsed - 25 * 86400;
var r2 = G.settleGenSalary();
console.log('  连欠 3 期：drop=' + r2.drop + '（封顶 20）· 忠诚 ' + g1.loyalty);
/* 再欠一轮 → 到 0 附近 */
s.salaryAt = s.world.elapsed - 25 * 86400;
G.settleGenSalary();
console.log('  又一轮：忠诚 ' + g1.loyalty + '（可能触 0）');

console.log('\n══════ ④ 忠诚 0 → 出征闸 ══════');
var bkL = g1.loyalty;
g1.loyalty = 0;
console.log('  忠诚 0：marchBlockOf = ' + JSON.stringify(G.marchBlockOf(g1)));
console.log('  canMarch=' + G.canMarch(g1) + ' · expGeneralsOf 含他? '
  + G.expGeneralsOf().some(function (x) { return x.id === g1.id; }));
g1.loyalty = 30;
console.log('  忠诚 30（赏赐恢复）：marchBlockOf = ' + JSON.stringify(G.marchBlockOf(g1)));
g1.loyalty = bkL;

console.log('\n══════ ⑤ upgradeAt 端到端（金不足拒 / 补足入队）══════');
G.goldAdd(-G.goldOf());
/* 造局：官府拉到 Lv10（否则"其他建筑 ≤ 官府等级"的闸会先拦） */
c0.cells.forEach(function (cell) {
  if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 10;
});
/* 找一座 Lv3 民房造局（升到 Lv4 不吃金——先验"低级别不吃金"） */
var idx = -1, bidFound = '';
c0.cells.forEach(function (cell, i) {
  if (cell.build && cell.build.id === 'minfang' && cell.build.lvl === 3) { idx = i; bidFound = 'minfang Lv3'; }
});
if (idx < 0) {
  /* 没有就现场造一座 */
  c0.cells.forEach(function (cell, i) {
    if (idx < 0 && !cell.build) { idx = i; cell.build = { id: 'minfang', lvl: 3 }; bidFound = '造局 minfang Lv3'; }
  });
}
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { R0[k] = (R0[k] || 0) + 5000000; });
var up = G.upgradeAt(c0.id, idx);
console.log('  ' + bidFound + ' 升 Lv4（Lv4<9 不收金）：ok=' + up.ok + ' ' + (up.msg || ''));
/* 造高等级民房测金 */
var idx2 = -1;
c0.cells.forEach(function (cell, i) {
  if (idx2 < 0 && !cell.build) { idx2 = i; }
});
if (idx2 >= 0) {
  c0.cells[idx2].build = { id: 'minfang', lvl: 8 };
  var up2 = G.upgradeAt(c0.id, idx2);   /* 升到 Lv9：需 3000 金，当前 0 金 */
  console.log('  minfang Lv8→Lv9（需 3000 金，钱 0）：ok=' + up2.ok + ' msg=' + up2.msg);
  G.goldAdd(3000);
  var up3 = G.upgradeAt(c0.id, idx2);
  console.log('  补金后：ok=' + up3.ok + ' msg=' + (up3.msg || '') + ' 金=' + G.goldOf() + '（应扣到 0）');
}

console.log('\n完成。');
process.exit(0);
