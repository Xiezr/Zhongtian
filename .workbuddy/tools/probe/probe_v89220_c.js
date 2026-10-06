/* v89.220 探针 C（改后复验 · 修正版）：科技闸存量宽限四态 + 调兵不限 + 界面出口 + 出征闸保留面
   node .workbuddy/tools/probe/probe_v89220_c.js > .workbuddy/tmp/probe220c.txt 2>&1 */
var path = require('path'), fs = require('fs'); var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

var st = G.newGame({ name: '探针C', region: '烬环', mapSeed: 20261020 });
if (!st.map.grid) G.map.generate();
var c1 = st.cities[0];
st.rank = 20;
st.mainCityId = c1.id;          /* 设为主城（isMainCity 的口径） */
var gen = st.generals[0];

var npc = null;
(st.map.cities || []).forEach(function (c) { if (!npc && c.type === 'county') npc = c; });
G.onConquer(npc, { defLossBy: {}, rounds: 3 }, gen, c1);
var cc = null;
st.cities.forEach(function (c) { if (c.origId === npc.id) cc = c; });
var idx = -1;
cc.cells.forEach(function (c, i) { if (idx < 0 && c.build && c.build.id === 'junying') idx = i; });
console.log('占领城 =', cc.name, '| 军营 lvl=' + cc.cells[idx].build.lvl, 'hiLv=' + cc.cells[idx].build.hiLv, '| 科技 lianbing=', G.systems.techLevel('lianbing', cc));
cc.res = { grain: 9e8, wood: 9e8, stone: 9e8, iron: 9e8 }; st.gold = 9e8;

console.log('\n=== A. 满配未拆：点升级（12→13）→ 期望"已达最高等级" ===');
console.log('  upgradeAt =', JSON.stringify(G.upgradeAt(cc.id, idx)));
console.log('  preUp(界面) =', JSON.stringify(G.buildPrereqOf(cc, 'junying', 13, cc.cells[idx].build)));

console.log('\n=== B. 拆 1 级（12→11）→ 升回（11→12）→ 期望放行 ===');
console.log('  拆除 ok =', G.demolishAt(cc.id, idx).ok, '| 拆后 lvl=' + cc.cells[idx].build.lvl, 'hiLv=' + cc.cells[idx].build.hiLv);
var uB = G.upgradeAt(cc.id, idx);
console.log('  升回 =', JSON.stringify(uB));
if (uB.ok) { cc.cells[idx].pending = null; st.queues.build = []; cc.cells[idx].build.lvl = 12; cc.cells[idx].build.hiLv = 12; }

console.log('\n=== C. 升回后再升 13 → 期望"已达最高等级" ===');
console.log('  upgradeAt =', JSON.stringify(G.upgradeAt(cc.id, idx)));

console.log('\n=== D. 主城（lift 生效）：军营 12 升 13 → 期望"需政务厅 Lv13"（官府未升）===');
var mIdx = -1;
c1.cells.forEach(function (c, i) { if (mIdx < 0 && !c.build && !c.official) mIdx = i; });
c1.cells[mIdx].build = { id: 'junying', lvl: 12, hiLv: 12 };
c1.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
c1.res = { grain: 9e8, wood: 9e8, stone: 9e8, iron: 9e8 };
console.log('  rankBuildCapOf(主城) =', G.rankBuildCapOf(c1), '| buildCapCoreOf(junying) =', G.buildCapCoreOf(c1, 'junying'));
console.log('  preUp =', JSON.stringify(G.buildPrereqOf(c1, 'junying', 13, c1.cells[mIdx].build).short || G.buildPrereqOf(c1, 'junying', 13, c1.cells[mIdx].build).msg));
console.log('  升官府 12→13 =', JSON.stringify(G.upgradeAt(c1.id, (function () { var gi = -1; c1.cells.forEach(function (x, i) { if (gi < 0 && x.build && x.build.id === 'guanfu') gi = i; }); return gi; })())));
/* 官府到位后：军营 13 应报"需研究 lianbing Lv5"（有空间才报科技闸） */
c1.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') { x.build.lvl = 13; x.pending = null; } });
st.queues.build = [];
console.log('  官府 13 后 preUp =', JSON.stringify(G.buildPrereqOf(c1, 'junying', 13, c1.cells[mIdx].build).short));

console.log('\n=== E. 调兵：目标城超容 → 期望通过 ===');
cc.army = { yibing: 200000 };
console.log('  目标城 marchCapOf =', G.battle.marchCapOf(cc), '现有驻军 =', G.battle.marchMenOf(cc.army));
c1.army = { yibing: 50000 };
gen.status = 'idle'; gen.cityId = c1.id;
var tr = G.doTransferCargo(c1.id, cc.id, { yibing: 10000 }, gen.id, null);
console.log('  调兵 1万 →', JSON.stringify({ ok: tr.ok, msg: (tr.msg || '').slice(0, 46) }));

console.log('\n=== F. 界面出口 ===');
console.log('  expFillCapOf(owncity) =', G.ui.expFillCapOf(c1, { kind: 'owncity', city: cc }, 'transfer'));
console.log('  expCapLabelOf(owncity) =', G.ui.expCapLabelOf(c1, { kind: 'owncity', city: cc }, 'transfer'));

console.log('\n=== G. 出征容量闸保留面：从本城发兵 99999（练兵场 Lv1，cap 12500）→ 期望被拦 ===');
c1.cells.forEach(function (x) { if (x.build && x.build.id === 'xiaochang') x.build.lvl = 1; });
var hasXc = c1.cells.some(function (x) { return x.build && x.build.id === 'xiaochang'; });
if (!hasXc) { var xi = -1; c1.cells.forEach(function (x, i) { if (xi < 0 && !x.build && !x.official) xi = i; }); c1.cells[xi].build = { id: 'xiaochang', lvl: 1 }; }
console.log('  本城 marchCapOf =', G.battle.marchCapOf(c1));
var w = null;
for (var rr = 2; rr <= 12 && !w; rr++) {
  for (var dy = -rr; dy <= rr && !w; dy++) for (var dx = -rr; dx <= rr && !w; dx++) {
    var tl = G.map.tile(c1.x + dx, c1.y + dy);
    if (tl && tl.terrain && tl.terrain !== 'city' && !G.map.npcAt(c1.x + dx, c1.y + dy) && !G.map.wildAt(c1.x + dx, c1.y + dy)) w = { x: c1.x + dx, y: c1.y + dy };
  }
}
console.log('  靶 =', JSON.stringify(w), '| weather =', G.story.currentWeather().name);
if (w) {
  var prep = G.battle.prepare({ kind: 'wild', x: w.x, y: w.y }, 'occupy', { yibing: 99999 }, gen.id, {});
  console.log('  prepare 超容量 =', JSON.stringify({ ok: prep.ok, msg: (prep.msg || '').slice(0, 44) }));
}
process.exit(0);
