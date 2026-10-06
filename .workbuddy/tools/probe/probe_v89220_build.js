/* v89.220 探针：① 调兵容量拒复现（需求 2）② 占领城建筑条件全量体检（需求 3）
   用法：node .workbuddy/tools/probe/probe_v89220_build.js > .workbuddy/tmp/probe220.txt 2>&1 */
var path = require('path'), fs = require('fs'); var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

var st = G.newGame({ name: '探针220', region: '烬环', mapSeed: 20261020 });
var c1 = st.cities[0];
console.log('主城 =', c1.name, '| type =', c1.type, '| level =', c1.level);

/* ── 找一座县城档 NPC 城 → 真调 onConquer 占领 ── */
var npc = null;
(st.map.cities || []).forEach(function (c) { if (!npc && c.type === 'county') npc = c; });
if (!npc) npc = st.map.cities[0];
console.log('目标 NPC =', npc.name, '| type =', npc.type, '| level =', npc.level, '| tierLv =', (D.NPC_TIER_LV || {})[npc.type]);

var gen = st.generals[0];
var r = G.onConquer(npc, { defLossBy: {}, rounds: 3 }, gen, c1);
console.log('onConquer =', JSON.stringify(r));
var city = null;
st.cities.forEach(function (c) { if (c.origId === npc.id) city = c; });
if (!city) { console.log('❌ 占领城未入库'); process.exit(0); }

console.log('\n=== 占领城概况 ===');
console.log('name =', city.name, '| type =', city.type, '| level =', city.level, '| cityLvOf =', G.cityLvOf(city));
console.log('官府等级 =', G.buildingLevel(city, 'guanfu'), '| 围墙(环城槽) =', (city.wall && city.wall.build ? city.wall.build.lvl : 0));
console.log('npcBuildLvOf(城) =', G.npcBuildLvOf(city));
console.log('buildSlots =', G.buildSlots(city), '| cityBuildBonus =', G.cityBuildBonus(city));
console.log('rankBuildCapOf 主城 =', G.rankBuildCapOf(c1), '| 占领城 =', G.rankBuildCapOf(city));

console.log('\n=== 占领城全部建筑（格） ===');
var byBid = {};
(city.cells || []).forEach(function (c, i) {
  if (!c.build) return;
  (byBid[c.build.id] = byBid[c.build.id] || []).push(c.build.lvl);
});
Object.keys(byBid).forEach(function (k) {
  console.log('  ' + (D.BUILDINGS[k] ? D.BUILDINGS[k].name : k) + ' x' + byBid[k].length + ' lvl=' + byBid[k].join(','));
});

console.log('\n=== 逐建筑条件检查（占领城）===');
var BIDS = Object.keys(D.BUILDINGS);
BIDS.forEach(function (bid) {
  var lv = G.buildingLevel(city, bid);
  var cap = G.buildCapOf(city, bid);
  var pre = G.buildPrereqOf(city, bid, lv + 1);
  var tech = G.buildTechOf(city, bid);
  var pg = G.pairGapOf(city, bid);
  console.log('  [' + (D.BUILDINGS[bid].name) + '] 现 Lv' + lv + ' · cap=' + cap
    + (tech ? ' · 科技闸 ' + tech.name + '(lv' + tech.lv + '→cap' + tech.cap + ')' : '')
    + (pg ? ' · 配对闸 ' + pg.name + '(lv' + pg.otherLv + '→cap' + pg.cap + ')' : '')
    + ' · 升级 list = ' + (pre.list.length ? JSON.stringify(pre.list) : '空'));
});

console.log('\n=== 官府能否升级（占领城）===');
console.log('  官府 cap =', G.buildCapOf(city, 'guanfu'));
console.log('  升级 list =', JSON.stringify(G.buildPrereqOf(city, 'guanfu', G.buildingLevel(city, 'guanfu') + 1).list));

console.log('\n=== 城墙（环城槽）升级检查 ===');
console.log('  城墙 buildTechOf =', JSON.stringify(G.buildTechOf(city, 'chengqiang')));
console.log('  城墙 cap =', G.buildCapOf(city, 'chengqiang'));

console.log('\n=== 科技现状（按城）===');
console.log('  占领城 techs =', JSON.stringify(city.techs || '(无)'));
['lianbing', 'zhandou', 'jianzhu', 'yanjiu'].forEach(function (tid) {
  console.log('  techLevel(' + tid + ') =', G.systems.techLevel(tid, city),
    '| canResearch =', JSON.stringify(G.systems.canResearch(tid, city.id)));
});

console.log('\n=== 主城对照（同几个检查）===');
['junying', 'xiaochang', 'guangfu', 'guanfu', 'chengqiang'].forEach(function (bid) {
  if (!D.BUILDINGS[bid]) return;
  var lv = G.buildingLevel(c1, bid);
  console.log('  主城 [' + D.BUILDINGS[bid].name + '] 现 Lv' + lv + ' cap=' + G.buildCapOf(c1, bid));
});

/* ── 需求 2：向占领城调兵（复现容量拒） ── */
console.log('\n=== 需求 2：调兵容量拒复现 ===');
console.log('占领城 练兵场 =', G.buildingLevel(city, 'xiaochang'), '| marchCapOf =', G.battle.marchCapOf(city),
  '| 现有驻军 =', G.battle.marchMenOf(city.army));
c1.army = { yibing: 30000, minfu: 5000 };
console.log('主城兵力 =', JSON.stringify(c1.army));
var tr = G.doTransferCargo(c1.id, city.id, { yibing: 20000 }, gen.id, null);
console.log('doTransferCargo 2万 →', JSON.stringify(tr));
var tr2 = G.doTransferCargo(c1.id, city.id, { yibing: 500 }, gen.id, null);
console.log('doTransferCargo 500 →', JSON.stringify(tr2));
/* 界面额度读数 */
console.log('expFillCapOf(owncity) —— 占领城余量 =',
  G.ui.expFillCapOf(c1, { kind: 'owncity', city: city }, 'transfer'));

/* ── 另一焦点：自建城（type self）对照 ── */
console.log('\n=== 对照：无练兵场的自建城 ===');
var c3 = G.makeCity({ id: 't3', name: '测试自建城', x: c1.x + 6, y: c1.y, type: 'self', level: 1 });
st.cities.push(c3);
console.log('自建城 官府 =', G.buildingLevel(c3, 'guanfu'), '| cityLvOf =', G.cityLvOf(c3), '| npcBuildLvOf =', G.npcBuildLvOf(c3));
console.log('自建城 练兵场 =', G.buildingLevel(c3, 'xiaochang'), '| marchCapOf =', G.battle.marchCapOf(c3));
var tr3 = G.doTransferCargo(c1.id, c3.id, { yibing: 20000 }, gen.id, null);
console.log('向自建城(无练兵场)调兵 2万 →', JSON.stringify(tr3));

process.exit(0);
