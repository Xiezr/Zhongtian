/* v89.220 探针 B：① 各档位占领城建筑条件 ② 拆后升回（科技闸边界）③ 调兵容量拒复现
   node .workbuddy/tools/probe/probe_v89220_b2.js > .workbuddy/tmp/probe220b.txt 2>&1 */
var path = require('path'), fs = require('fs'); var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

var st = G.newGame({ name: '探针B', region: '烬环', mapSeed: 20261020 });
var c1 = st.cities[0];
st.rank = 20;   /* 抬爵位：领地上限 + 主城 lift 对照 */

/* ── 各档位各占一座 ── */
console.log('=== 各档位占领城建筑等级 ===');
var gen = st.generals[0];
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  var npc = null;
  (st.map.cities || []).forEach(function (c) { if (!npc && c.type === ty) npc = c; });
  if (!npc) { console.log('  ' + ty + ': 无此档 NPC 城'); return; }
  var r = G.onConquer(npc, { defLossBy: {}, rounds: 3 }, gen, c1);
  var city = null;
  st.cities.forEach(function (c) { if (c.origId === npc.id) city = c; });
  if (!city) { console.log('  ' + ty + ' 占领失败'); return; }
  var jy = G.buildingLevel(city, 'junying');
  var gf = G.buildingLevel(city, 'guanfu');
  var wl = city.wall && city.wall.build ? city.wall.build.lvl : 0;
  console.log('  [' + ty + '] ' + city.name + ' 训练营=' + jy + ' 官府=' + gf + ' 城墙=' + wl
    + ' | cityBuildBonus=' + G.cityBuildBonus(city)
    + ' | cap(训练营)=min[base12+bonus' + G.cityBuildBonus(city) + ', 官府' + gf + ', 科技闸'
    + (G.buildTechOf(city, 'junying') ? G.buildTechOf(city, 'junying').cap : '-')
    + '] = ' + G.buildCapOf(city, 'junying'));
  if (ty === 'county') global.__cc = city;
  if (ty === 'jun') global.__jc = city;
});

/* ── 拆后升回（科技闸边界）── */
console.log('\n=== 拆后升回（县城占领城 · 训练营）===');
var cc = global.__cc;
/* 找训练营格 */
var idx = -1;
cc.cells.forEach(function (c, i) { if (idx < 0 && c.build && c.build.id === 'junying') idx = i; });
console.log('  训练营格 idx=' + idx + ' lvl=' + cc.cells[idx].build.lvl);
/* 给足资源 */
cc.res = { grain: 5e8, wood: 5e8, stone: 5e8, iron: 5e8 }; st.gold = 5e8;
var d1 = G.demolishAt(cc.id, idx);
console.log('  拆除一次 =', JSON.stringify(d1));
console.log('  拆后 lvl =', cc.cells[idx].build.lvl);
/* 队列里有没有东西（拆是否入队？） */
console.log('  队列 =', JSON.stringify((st.queues.build || []).map(function (q) { return q.buildId + ':' + q.type; })));
var u1 = G.upgradeAt(cc.id, idx);
console.log('  升回 =', JSON.stringify(u1));
console.log('  升级后 pending =', JSON.stringify(cc.cells[idx].pending));

/* ── 城墙（环城槽）升级尝试 ── */
console.log('\n=== 城墙槽升级尝试 ===');
var uw = G.upgradeAt(cc.id, 'wall');
console.log('  upgradeAt(wall) =', JSON.stringify(uw));

/* ── 调兵容量拒复现（把县城驻军塞到超容）── */
console.log('\n=== 调兵容量拒复现 ===');
var cc2 = global.__cc;
cc2.army = { yibing: 200000 };   /* 超容：cap 15 万 */
console.log('  目标城 marchCapOf =', G.battle.marchCapOf(cc2), '现有驻军 =', G.battle.marchMenOf(cc2.army));
c1.army = { yibing: 50000 };
var tr = G.doTransferCargo(c1.id, cc2.id, { yibing: 10000 }, gen.id, null);
console.log('  调兵 1万 →', JSON.stringify(tr));
console.log('  expFillCapOf(owncity) =', G.ui.expFillCapOf(c1, { kind: 'owncity', city: cc2 }, 'transfer'));
console.log('  expCapLabelOf =', G.ui.expCapLabelOf(c1, { kind: 'owncity', city: cc2 }, 'transfer'));

/* ── 郡城拆后升回（16 级档）── */
console.log('\n=== 拆后升回（郡城 · 训练营）===');
var jc = global.__jc;
if (jc) {
  var jidx = -1;
  jc.cells.forEach(function (c, i) { if (jidx < 0 && c.build && c.build.id === 'junying') jidx = i; });
  console.log('  训练营格 lvl=' + jc.cells[jidx].build.lvl + ' cap=' + G.buildCapOf(jc, 'junying'));
  jc.res = { grain: 9e8, wood: 9e8, stone: 9e8, iron: 9e8 };
  var jd = G.demolishAt(jc.id, jidx);
  console.log('  拆除 =', JSON.stringify(jd), '→ lvl=' + jc.cells[jidx].build.lvl);
  var ju = G.upgradeAt(jc.id, jidx);
  console.log('  升回 =', JSON.stringify(ju));
}

/* ── 全新自建城从零：科技闸的"正常路径"对照 ── */
console.log('\n=== 对照：自建城从零建训练营 ===');
var c3 = G.makeCity({ id: 't3b', name: '自建对照', x: c1.x + 8, y: c1.y, type: 'self', level: 1 });
st.cities.push(c3);
c3.res = { grain: 5e8, wood: 5e8, stone: 5e8, iron: 5e8 };
var bidx = -1;
c3.cells.forEach(function (c, i) { if (bidx < 0 && !c.build) bidx = i; });
console.log('  空格 idx=' + bidx, '| buildAt 训练营 =', JSON.stringify(G.buildAt(c3.id, bidx, 'junying')));
/* 直接看条件：升到 2 级 / 3 级 */
console.log('  升 2 级 list =', JSON.stringify(G.buildPrereqOf(c3, 'junying', 2).list.map(function (o) { return o.short || o.name; })));
console.log('  升 3 级 list =', JSON.stringify(G.buildPrereqOf(c3, 'junying', 3).list));
process.exit(0);
