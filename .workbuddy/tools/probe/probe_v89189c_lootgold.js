/* v89.189 批次 C 探针：据点/名城黄金储量现状与预演 ——
   A. genLootEx（据点/野地掠夺）gold 与资源期望（rnd=0.5 dry）
   B. NPC 库藏（名城 resByTier）五项 + 占领全拿 / 掠夺 0.5
   C. 搬运模拟（haulPlanOf：运力 30 万兵 ≈ 1500 万负重）→ 实得
   D. 军费对照（治疗 10 金/兵）· 岁贡对照
   E. 预演：gold 新值下的实得（据点 期望 800 / 名城 base 100）
   跑法：node .workbuddy/tools/probe/probe_v89189c_lootgold.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: 'g189', avatar: '🧔', gender: 'male', region: '碎垣' });
var B = G.battle;
function fmtN(n) { return U.fmt(Math.round(n)); }
function half() { return 0.5; }   /* rnd 期望 */

console.log('===== A. genLootEx 现状（据点/野地 · 期望口径）=====');
console.log('  （现基础 gold = 10000+rd×20000 → 期望 2 万）');
['wild', 'fort'].forEach(function (tier) {
  [1, 5, 10].forEach(function (lv) {
    var o = B.genLootEx({ kind: tier, lv: lv, dropType: tier, x: 1, y: 1 }, 1, half, true);
    var rs = (o.grain || 0) + (o.wood || 0) + (o.stone || 0) + (o.iron || 0);
    console.log('  ' + tier + ' Lv' + String(lv).padEnd(2) + ' 金 ' + fmtN(o.gold).padEnd(9)
      + ' 资源 ' + fmtN(rs).padEnd(11) + ' 合计 ' + fmtN(rs + o.gold) + '　金占比 ' + (o.gold / (rs + o.gold) * 100).toFixed(1) + '%');
  });
});

console.log('\n===== B. NPC 库藏现状（名城 · resByTier + base 比例）=====');
['county', 'jun', 'zhou', 'capital'].forEach(function (tp) {
  var c = { id: 'npc_' + tp, type: tp, level: 12, x: 1, y: 1 };
  var r = G.npcCityRes(c);
  var rs = (r.grain || 0) + (r.wood || 0) + (r.stone || 0) + (r.iron || 0);
  var raid = Math.round(r.gold * 0.5);
  console.log('  ' + tp.padEnd(8) + ' 粮 ' + fmtN(r.grain).padEnd(11) + ' 金 ' + fmtN(r.gold).padEnd(10)
    + '（占全库 ' + (r.gold / (rs + r.gold) * 100).toFixed(2) + '%） 占领全拿金 ' + fmtN(r.gold) + ' · 掠夺 0.5 金 ' + fmtN(raid));
});

console.log('\n===== C. 搬运模拟（haulPlanOf · 运力 30 万兵 ≈ 1500 万负重）=====');
var cap = 30 * 50 * 10000 / 10000 * 10000;   /* 30 万兵 × 负重 50 = 1500 万 */
cap = 15000000;
function haul(loot) {
  /* 手算 factor（与 haulPlanOf 同式）：cap 1500 万 = 30 万兵 × 负重 50 */
  var wt = B.lootWeightOf(loot);
  var factor = wt > 0 ? Math.min(1, 15000000 / wt) : 1;
  var keep = {};
  (G.TRANSPORT_KEYS || ['grain', 'wood', 'stone', 'iron', 'gold']).forEach(function (k) {
    keep[k] = Math.floor((loot[k] || 0) * factor);
  });
  return { factor: factor, keep: keep, wt: wt };
}
var f10 = B.genLootEx({ kind: 'fort', lv: 10, dropType: 'fort', x: 1, y: 1 }, 1, half, true);
var h1 = haul(f10);
console.log('  fort Lv10：库藏金 ' + fmtN(f10.gold) + ' + 资源 ' + fmtN(f10.grain + f10.wood + f10.stone + f10.iron)
  + ' → 搬运 factor ' + h1.factor.toFixed(4) + ' → 实得金 ' + fmtN(h1.keep.gold));
var cty = G.npcCityRes({ id: 'npc_county', type: 'county', level: 12, x: 1, y: 1 });
var raidLoot = {};
for (var k in cty) raidLoot[k] = Math.round(cty[k] * 0.5);
var h2 = haul(raidLoot);
console.log('  县城掠夺（0.5）：库藏金 ' + fmtN(cty.gold) + ' → 搬运 factor ' + h2.factor.toFixed(5)
  + ' → 实得金 ' + fmtN(h2.keep.gold) + ' · 实得资源 ' + fmtN((h2.keep.grain || 0) + (h2.keep.wood || 0) + (h2.keep.stone || 0) + (h2.keep.iron || 0)));

console.log('\n===== D. 对照 =====');
console.log('  军费参照：阵亡 10 万 · 回收 75% → 伤兵 7.5 万 × 10 金/兵 = 治疗费 75 万金');
console.log('  岁贡参照：县城 4500 金/现实日（占领县城金库 = N 天岁贡）');
console.log('  现状：占领县城金 ' + fmtN(cty.gold) + ' = ' + Math.round(cty.gold / 4500) + ' 天县城岁贡');

console.log('\n===== E. 预演（gold 下调）=====');
var NG = 1.8;   /* genLootEx 新期望 800 / 旧 20000 的比 */
var gOld = 20000, gNew = 800;
[1, 5, 10].forEach(function (lv) {
  var mult = 0.5 * Math.pow(2.15, lv - 1);
  var newGold = gNew * mult;
  console.log('  fort Lv' + String(lv).padEnd(2) + ' 新库藏金 ' + fmtN(newGold).padEnd(10)
    + ' → 实得（factor 0.6）≈ ' + fmtN(newGold * 0.6));
});
var pct = 100 / 9000;   /* 新 base.gold = 100 */
['county', 'capital'].forEach(function (tp) {
  var r = G.npcCityRes({ id: 'x_' + tp, type: tp, level: 12, x: 1, y: 1 });
  var ng = Math.round(r.grain * pct);   /* 新金 = 粮 × (100/9000) */
  console.log('  ' + tp.padEnd(8) + ' 新库藏金（占领全拿）' + fmtN(ng) + ' = ' + Math.round(ng / 4500) + ' 天县城岁贡');
});

process.exit(0);
