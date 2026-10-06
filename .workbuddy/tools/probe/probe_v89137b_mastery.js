/* v89.137 探针B：建筑专精三档实算 + 兵种最终属性出口
 * 跑法：node .workbuddy/tools/probe/probe_v89137b_mastery.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

console.log('=== ① 建筑专精三档（masteryTierOf / mastery） ===');
var c = G.makeCity({ id: 't1', name: '试', x: 1, y: 1, type: 'self' });
c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
var idx = 0;
function setMf(lv) {
  c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 0; });
  c.cells[idx].build = { id: 'minfang', lvl: lv };
}
[11, 12, 23, 24, 35, 36].forEach(function (lv) {
  setMf(lv);
  console.log('  民房 Lv' + lv + ' → 档 ' + G.masteryTierOf(c, 'minfang') +
    ' · popPct=' + G.mastery('popPct', c).toFixed(2) + ' · masteryOf=' + G.masteryOf(c, 'minfang'));
});

console.log('=== ② 库藏（四档 · 满科技）实算 ===');
G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260931 });
var backup = G.state.techs;
G.state.techs = G.state.techs || {};
G.state.techs.chucun = DATA.TECH_MAX_LV;
['capital', 'zhou', 'jun', 'county'].forEach(function (ty) {
  var nc = (DATA.NPC_CITIES || []).filter(function (x) { return x.type === ty; })[0];
  if (!nc) { console.log('  ' + ty + ': 无样本'); return; }
  var sh = G.npcCityShadow(nc);
  var fake = G.makeCity({ id: 'chk_' + ty, name: '核', x: nc.x, y: nc.y, type: ty });
  fake.cells = sh.cells.map(function (x) {
    return { build: x.build ? { id: x.build.id, lvl: x.build.lvl } : null, pending: null, official: !!x.official };
  });
  fake.col = sh.col; fake.row = sh.row; fake.wallLv = sh.wallLv;
  fake.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
  var cap = G.storeCapOf(fake);
  var want = DATA.NPC_CITY_RES.resByTier[ty];
  console.log('  ' + ty + '（建筑 Lv' + G.npcBuildLvOf(nc) + ' · 仓库档 ' + G.masteryTierOf(fake, 'cangku') +
    '）: 实算仓容 ' + (cap / 1e8).toFixed(3) + '亿 vs 基准 ' + (want / 1e8).toFixed(2) + '亿' +
    (Math.abs(cap - want) > cap * 0.001 ? '   ⚠ 不一致' : '   ✓'));
});
G.state.techs = backup;

console.log('=== ③ 其他消费点（三档口径抽查） ===');
function mk(bid, lv) {
  var cc = G.makeCity({ id: 'k_' + bid, name: 'K', x: 2, y: 2, type: 'self' });
  cc.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
  cc.cells[0].build = { id: bid, lvl: lv };
  return cc;
}
[12, 24, 36].forEach(function (lv) {
  var cj = mk('junying', lv), cz = mk('zhaoxianguan', lv), cq = mk('chengqiang', lv);
  var cm = mk('majiu', lv), ck = mk('kezhan', lv), cg = mk('gongjiangzuofang', lv);
  console.log('  Lv' + lv + '：训练队列位=' + G.trainQueueSlots(lv, cj) +
    ' · 将领席位=' + G.genSlotsOf(cz) +
    ' · 客栈候选=' + G.innSlots(ck) +
    ' · 城防=' + G.cityDefenseBase(cq) +
    ' · 产量加成(马厩)=' + (G.mastery('prodPct', cm) * 100).toFixed(0) + '%' +
    ' · 器械耗时折扣=' + (G.mastery('craftTimePct', cg) * 100).toFixed(0) + '%');
});
/* 驿站 / 烽火台（**各造各的城** —— v89.137 探针教训：别拿驿站的城查烽火台的专精） */
[12, 24, 36].forEach(function (lv) {
  var cy = mk('yizhan', lv), cf = mk('fenghuotai', lv);
  console.log('  Lv' + lv + '：驿站行军加成=' + G.mastery('marchAdd', cy).toFixed(2) +
    ' 倍 · 烽火台强度=' + G.mastery('beaconBoost', cf).toFixed(2) +
    ' · 档数(驿站/烽火)=' + G.masteryTierOf(cy, 'yizhan') + '/' + G.masteryTierOf(cf, 'fenghuotai'));
});

console.log('=== ④ unitFinalOf（兵种最终属性） ===');
var u = { id: 'changqiang', count: 1000, cover: 1, atkPct: 0.35, defPct: 0.2, hpPer: DATA.TROOPS.changqiang.hp, spd: DATA.TROOPS.changqiang.spd };
var f0 = G.battle.unitFinalOf(u, null);
console.log('  无将：', JSON.stringify(f0));
/* 造一个将领（有勇武） */
var g = G.makeGeneral('试将', 12, 'idle', c.id, false);
g.attrs = null;
var f1 = G.battle.unitFinalOf(u, g);
var a = G.genAttrs(g);
console.log('  有将（统' + a.tong + ' 勇' + a.yw + ' 智' + a.zm + '）：atk ' + f1.atk + ' 防 ' + f1.def + ' 血 ' + f1.hp);
console.log('  基础：atk ' + DATA.TROOPS.changqiang.atk + ' 防 ' + DATA.TROOPS.changqiang.def + ' 血 ' + DATA.TROOPS.changqiang.hp);
console.log('  总数（1000）：总攻 ' + f1.totalAtk + ' 总血 ' + f1.totalHp);
console.log('  无效兵种 → ' + G.battle.unitFinalOf({ id: '__nope', count: 1 }, null));

process.exit(0);
