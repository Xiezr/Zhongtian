/* v89.194 探针A：基线取证（S1 成本表 / S2 道具价格全量 / S4 忠诚与欠俸 / 前哨半径口径）
   ① S1：levelCost 当前是否含金（Lv7~12 逐档）
   ② S2：全体道具价格表（在售 / 下架 / dropOnly）+ 商城类别归属 + 实售口径复核
   ③ S4：LOYALTY 现状 + 欠俸场景下忠诚是否变化（改前实证）
   ④ 前哨：fortRadiusOf 五档 + fortAuraAt 切比雪夫/欧氏对角线分歧实证 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '基线', region: '烬环' });
if (!G.state.map.grid) G.map.generate();

console.log('══════ ① S1：当前升级成本（官府 / 校场 / 城墙，Lv7~12）══════');
[['guanfu', 7], ['guanfu', 8], ['guanfu', 9], ['guanfu', 10], ['guanfu', 11], ['guanfu', 12]].forEach(function (p) {
  var c = D.BUILDINGS[p[0]].levelCost(p[1]);
  console.log('  ' + p[0] + ' 升到 Lv' + (p[1] + 1) + '：金=' + (c.gold == null ? '(无)' : c.gold)
    + ' 粮' + U.fmt(c.grain) + ' 木' + U.fmt(c.wood) + ' 石' + U.fmt(c.stone) + ' 铁' + U.fmt(c.iron)
    + ' 珠宝=' + (c.jewel ? JSON.stringify(c.jewel) : '(无)'));
});
console.log('  — 城外（farm 升 Lv9/10）—');
console.log('  farm Lv9: ' + JSON.stringify(G.extBuildCost('farm', 8)));
console.log('  farm 升Lv10: ' + JSON.stringify(G.extBuildCost('farm', 9)));

console.log('\n══════ ② S2：全体道具价格表（含实售 ×100）══════');
var cats = G.ui.SHOP_CATS || {};
var all = D.ITEMS.filter(function (it) { return it.price > 0; });
function pageOf(it) {
  for (var k in cats) { if (cats[k] === it.type) return k; }
  return '(无页签)';
}
var groups = { '在售': [], '下架noShop': [], 'dropOnly': [] };
all.forEach(function (it) {
  var g = it.noShop ? '下架noShop' : (it.dropOnly ? 'dropOnly' : '在售');
  groups[g].push(it);
});
Object.keys(groups).forEach(function (g) {
  console.log('\n—— ' + g + '（' + groups[g].length + ' 件）——');
  groups[g].forEach(function (it) {
    console.log('  ' + (it.id + '                    ').slice(0, 20)
      + (it.name + '          ').slice(0, 10)
      + ' [' + it.type + ']  内部价 ' + U.fmt(it.price) + '  实售 ' + U.fmt(it.price * 100) + ' 金'
      + '  页签 ' + pageOf(it));
  });
});
console.log('\n类别表 SHOP_CATS=' + JSON.stringify(cats));
console.log('BAG_ITEM_CN=' + JSON.stringify(G.ui.BAG_ITEM_CN || {}));

console.log('\n══════ ③ S4：忠诚 / 欠俸现状 ══════');
console.log('  LOYALTY=' + JSON.stringify(D.LOYALTY));
var s = G.state;
var g1 = s.generals[0]; if (g1) {
  console.log('  首将: ' + g1.name + ' loyalty=' + g1.loyalty + ' status=' + (g1.status || 'idle')
    + ' 月俸=' + G.genSalaryOf(g1));
}
/* 欠俸场景：把府库清零 → 拨钟一期 → settleGenSalary → 看 loyalty 是否变化 */
var c0 = s.cities[0];
var bkGold = G.goldOf();
var bkAt = s.salaryAt;
G.goldAdd(-bkGold);
s.salaryAt = s.world.elapsed - 8 * 86400;
var loyBefore = (g1 && g1.loyalty);
var r = G.settleGenSalary();
var loyAfter = (g1 && g1.loyalty);
console.log('  欠俸结算: ' + JSON.stringify(r) + '  忠诚 ' + loyBefore + ' → ' + loyAfter
  + (loyBefore === loyAfter ? '（不变 = 改前口径"欠俸不惩罚"）' : '（有变）'));
G.goldAdd(bkGold); s.salaryAt = bkAt;

/* 出征闸现状：忠诚 0 能不能出征 */
if (g1) {
  var bk = g1.loyalty;
  g1.loyalty = 0;
  console.log('  忠诚 0 时 marchBlockOf = ' + JSON.stringify(G.marchBlockOf(g1)) + '（null=可出征）');
  g1.loyalty = bk;
}

console.log('\n══════ ④ 前哨半径口径（切比雪夫 vs 欧氏对角线）══════');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var e = G.fortEffectOf({ lv: lv });
  console.log('  Lv' + lv + ' → 半径 ' + e.radius + ' 格');
});
/* 造一个前哨于 (100,100)（lv6 → 半径 10），测对角线格 */
s.forts = s.forts || {};
s.forts['100,100'] = { x: 100, y: 100, lv: 6, name: '测试哨', day: 0, cityId: c0.id };
var R6 = G.fortRadiusOf(s.forts['100,100']);
console.log('  半径 R=' + R6 + ' · 轴向 (100+R,100) 覆盖=' + !!G.fortAuraAt(100 + R6, 100));
console.log('  对角线 (100+R,100+R) 覆盖=' + !!G.fortAuraAt(100 + R6, 100 + R6)
  + '（切比雪夫会命中，欧氏 14.1>10 不命中 → 口径分歧点）');
console.log('  半对角 (100+7,100+7) 覆盖=' + !!G.fortAuraAt(107, 107) + '（欧氏 9.9<10 命中）');
delete s.forts['100,100'];

console.log('\n══════ ⑤ 月俸 1.5 倍现状 ══════');
var gm = null;
(s.generals || []).forEach(function (g) { if (!G.isLordGeneral(g) && g.cityId === c0.id) gm = gm || g; });
if (gm) {
  console.log('  普通将 ' + gm.name + ' 月俸=' + G.genSalaryOf(gm));
  gm.status = 'mayor';
  console.log('  设为城主后 月俸=' + G.genSalaryOf(gm) + '（若不变 = 尚未实装 1.5 倍）');
  gm.status = 'idle';
}
console.log('\n完成。');
process.exit(0);
