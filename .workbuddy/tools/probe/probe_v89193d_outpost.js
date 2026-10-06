/* v89.193 探针D：前哨体系 —— 每城上限5 / 等级五档 / 归属 / 老档迁移 / 税所逐哨
   ① 出口组各档抽查
   ② 每城上限 5：同城第 6 次被拒（full）· 他城不占本城名额
   ③ 归属记录 cityId
   ④ 老档迁移（无 cityId → 最近城）
   ⑤ 逐哨半径：Lv2 六格 / Lv9 十四格
   ⑥ 税所逐哨 Σ tax
   ⑦ 驻军上限随等级（1.25 vs 1.55） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '前哨体系', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var c0 = G.state.cities[0];

console.log('══════ ① 出口组各档 ══════');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var e = G.fortEffectOf({ lv: lv });
  console.log('  Lv' + lv + ': 辐射' + e.radius + ' 采×' + e.gatherMul + ' 宝+' + Math.round(e.treasureAdd * 100) + '%'
    + ' 驻×' + e.garrisonCapMul + ' ' + (e.intelFull ? '确凿' : '半明') + ' 税' + e.tax);
});

console.log('\n══════ ②/③ 每城上限 5 + 归属 ══════');
/* 找 8 个可用的空坐标（贴近首城，非 city/water） */
var spots = [];
for (var r = 2; r <= 20 && spots.length < 8; r++) {
  for (var dy = -r; dy <= r && spots.length < 8; dy++) {
    for (var dx = -r; dx <= r && spots.length < 8; dx++) {
      var x = c0.x + dx, y = c0.y + dy;
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city' || tl.terrain === 'water') continue;
      if (spots.some(function (s) { return s.x === x && s.y === y; })) continue;
      if (dx === 0 && dy === 0) continue;
      spots.push({ x: x, y: y });
    }
  }
}
console.log('  候选格', spots.length, '个');
function mkFort(i, lv) {
  return { kind: 'fort', fort: { x: spots[i].x, y: spots[i].y, level: lv || 5, name: '测试哨' + i } };
}
var results = [];
for (var i = 0; i < 6; i++) {
  var r2 = G.claimFort(mkFort(i, 5), null, c0, {});
  results.push(r2.ok ? 'ok' : (r2.full ? 'full' : JSON.stringify(r2)));
}
console.log('  同城 6 连占据:', results.join(', '));
console.log('  实际登记 =', Object.keys(G.fortsOf()).length, '（应 5）');
var allOwned = Object.keys(G.fortsOf()).every(function (k) { return G.fortsOf()[k].cityId === c0.id; });
console.log('  cityId 全部 = 首城:', allOwned);
var sixth = G.fortsOf()[spots[5].x + ',' + spots[5].y];
console.log('  第 6 格未登记（fortOwnAt=null）:', sixth == null);

/* 他城：不占首城名额 */
var c2 = G.makeCity({ id: 'oc2', name: '陪都', x: c0.x + 40, y: c0.y + 40 });
G.registerCity(c2);
var r3 = G.claimFort(mkFort(6, 3), null, c2, {});
console.log('  他城占据 =', r3.ok ? 'ok' : JSON.stringify(r3), '· 该城计数 =', G.fortsOfCity(c2).length);

console.log('\n══════ ④ 老档迁移（无 cityId → 最近城）══════');
/* 造"老档"：删掉一个哨的 cityId + 清迁移标记 */
var k0 = spots[0].x + ',' + spots[0].y;
delete G.fortsOf()[k0].cityId;
delete G.state.fortsMig193;
var r4 = G.migrateForts193();
var assigned = G.fortsOf()[k0].cityId;
console.log('  迁移执行 =', r4, '· 该哨 cityId =', assigned, '（应 = 首城 id:', c0.id, '）');
console.log('  幂等：二次调用 =', G.migrateForts193(), '（应 false）');

console.log('\n══════ ⑤ 逐哨半径（Lv2 六格 / Lv9 十四格）══════');
/* v89.193 探针修正：多哨重叠会串味 —— 先备份全集合，只留"独哨"测半径/驻军，测完还原。
   （首版教训：f2 的 +7 格被其他 Lv5 哨（半径10）命中 → 假 "true"。） */
var bkForts = JSON.parse(JSON.stringify(G.fortsOf()));
function soloWith(rec) {
  Object.keys(G.fortsOf()).forEach(function (k) { delete G.fortsOf()[k]; });
  G.fortsOf()[rec.x + ',' + rec.y] = rec;
}
var k6 = spots[6].x + ',' + spots[6].y;
var rec2 = { x: bkForts[k0].x, y: bkForts[k0].y, lv: 2, name: '独哨Lv2', cityId: c0.id };
var rec9 = { x: bkForts[k6].x, y: bkForts[k6].y, lv: 9, name: '独哨Lv9', cityId: c2.id };
soloWith(rec2);
console.log('  独哨 Lv2: 半径 =', G.fortRadiusOf(rec2), '（应 6）');
console.log('    +5 格命中且身份=它:', G.fortAuraAt(rec2.x + 5, rec2.y) === rec2);
console.log('    +7 格 miss:', G.fortAuraAt(rec2.x + 7, rec2.y) === null, '（应 true）');
var cap2 = G.wildGarrisonCap(10, rec2.x + 3, rec2.y);
console.log('    驻军上限(10万基础) =', cap2, '（应 125000 = ×1.25）');
soloWith(rec9);
console.log('  独哨 Lv9: 半径 =', G.fortRadiusOf(rec9), '（应 14）');
console.log('    +13 格命中且身份=它:', G.fortAuraAt(rec9.x + 13, rec9.y) === rec9);
console.log('    +15 格 miss:', G.fortAuraAt(rec9.x + 15, rec9.y) === null, '（应 true）');
var cap9 = G.wildGarrisonCap(10, rec9.x + 3, rec9.y);
console.log('    驻军上限 =', cap9, '（应 180000 = ×1.80）');
/* 还原全集合 */
Object.keys(G.fortsOf()).forEach(function (k) { delete G.fortsOf()[k]; });
Object.keys(bkForts).forEach(function (k) { G.fortsOf()[k] = bkForts[k]; });
/* 重叠语义（最近哨优先）：两哨相距 10 格、都 Lv10（R14）——
   点 (8,0) 距 B 2 格、距 A 8 格 → 应取 B；点 (5,0) 平分 → 取 key 序小（A）。 */
soloWith({ x: 200, y: 200, lv: 10, name: 'A' });
G.fortsOf()['210,200'] = { x: 210, y: 200, lv: 10, name: 'B' };
var pA = G.fortAuraAt(205, 200), pB = G.fortAuraAt(208, 200);
console.log('  重叠语义：平分点取 A(key序):', pA && pA.name === 'A', ' · 近点取 B:', pB && pB.name === 'B');
/* 再次还原 */
Object.keys(G.fortsOf()).forEach(function (k) { delete G.fortsOf()[k]; });
Object.keys(bkForts).forEach(function (k) { G.fortsOf()[k] = bkForts[k]; });
G.fortsOf()[k0].lv = 2;   /* 供后续展示：让 k0 为 Lv2（税所 Σ 会自然包含） */

console.log('\n══════ ⑥ 税所逐哨 Σ tax ══════');
G.state.fortTaxDay = G.questDayIndex() - 2;      /* 拨钟：2 现实日前 */
var g0 = G.goldOf();
var tr = G.fortTaxSettle();
var sumTx = 0, n = 0;
Object.keys(G.fortsOf()).forEach(function (k) { sumTx += G.fortEffectOf(G.fortsOf()[k]).tax; n++; });
console.log('  结算 =', JSON.stringify(tr), '（期望 gold =', sumTx * 2, '= Σtax', sumTx, '× 2 日）');
console.log('  金池增量 =', Math.round(G.goldOf() - g0));

var sumOk = tr && tr.gold === sumTx * 2;
console.log('\n总结：同城5拒1=' + (results[5] === 'full') + ' · 迁移=' + (assigned === c0.id)
  + ' · 独哨半径/驻军=' + (cap2 === 125000 && cap9 === 180000)
  + ' · 税所 Σ=' + sumOk + ' · 重叠最近哨=' + (pB && pB.name === 'B'));
process.exit(0);
