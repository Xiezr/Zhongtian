/* ============================================================
 * probe_v89103b_fort.js — 拔除据点 = 据为己有（实测）
 * ------------------------------------------------------------
 * 问：
 *   ① 占领（围攻）打下来后，据点是否变成**我方一座城**（进 s.cities）？
 *   ② 建筑是否"就地转正"（= 侦查面板看到的满配布局，不是空地）？
 *   ③ 人口是否归附（= 该布局民房满员）？
 *   ④ 该格是否**永久**不再生成据点（换日也不复活）？
 *   ⑤ 拔除后，出征/自动出征的目标扫描是否再也看不到它？
 * 用法：node .workbuddy/tools/probe/probe_v89103b_fort.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
function ap(s) { console.log(s); }

var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var city = st.cities[0];
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { city.res[k] = 5e7; });
city.res.pop = 200000;
var gen = st.generals[0];
gen.level = 40;

/* 找一座据点（挑低等级的，围攻波次少） */
var fort = null, best = 99;
for (var y = 0; y < (DATA.MAP_H || 61); y++) {
  for (var x = 0; x < (DATA.MAP_W || 61); x++) {
    var f = G.map.fortAt(x, y);
    if (f && f.level < best) { best = f.level; fort = f; }
  }
}
if (!fort) { ap('没找到据点'); process.exit(1); }
ap('目标据点 = ' + fort.name + ' Lv' + fort.level + '（' + fort.x + ',' + fort.y + '）');
var plan0 = G.fortPlanOf(fort);
ap('侦查口径：布局等级 Lv' + plan0.buildLv + ' · 城墙 Lv' + plan0.wallLv
  + ' · 人口上限 ' + U.fmt(G.planPopCapOf(fort.level)) + ' · 城防 ' + G.fortDefOf(fort));
var nCity0 = st.cities.length;

/* 围攻：占领模式多波次（每波破防 ≤45%，守备归零 + 胜 = 下城） */
var waves = 0, claimed = null, log = [];
var army = { yibing: 60000, changqiang: 30000, gongjian: 20000, qingji: 8000 };
while (waves < 8 && !claimed) {
  waves++;
  city.army = Object.assign({}, army);
  G.setStaNow(gen, 9999); gen.energy = 100;
  var r = G.battle.expedition({ kind: 'fort', x: fort.x, y: fort.y }, 'occupy', army, gen.id);
  var sg = r.result && r.result.siege;
  log.push('第 ' + waves + ' 波：' + r.msg + (sg ? '（破防 ' + sg.chip + '% → 余 ' + Math.round(sg.hold) + '%'
    + (sg.broke ? ' · 城垣已破' : '') + (sg.retreat ? ' · 撤退' : '') + '）' : ''));
  if (r.result && r.result.claimed) claimed = r.result.claimed;
}
log.forEach(ap);

ap('');
ap('===== 1. 据点是否变成我城 =====');
ap('城池数 ' + nCity0 + ' → ' + st.cities.length);
var nc = claimed && claimed.city;
if (!nc) { ap('❌ 没有占据（可能波次不够）'); process.exit(1); }
ap('新城的公开口径：' + [
  'id=' + nc.id, 'type=' + nc.type, 'level=' + nc.level,
  'col×row=' + nc.col + '×' + nc.row,
  'cells=' + nc.cells.length,
  '建筑数=' + nc.cells.filter(function (c) { return c.build; }).length,
  '外城地块=' + (nc.extGrid || []).length,
  'wallLv=' + nc.wallLv,
  'def=' + nc.def,
  'pop=' + U.fmt(nc.res.pop),
  '出身=' + JSON.stringify(nc.fromFort || null),
].join('　'));
/* 与侦查面板的布局逐项比对（唯一出口：cityPlanOf / fortPlanOf 同一份） */
var planNow = G.cityPlanOf(G.cityLvOf(nc), G.npcBuildLvOf(nc));
var diff = 0;
for (var i = 0; i < nc.cells.length; i++) {
  var a = nc.cells[i].build, b = planNow.cells[i].build;
  var la = a ? a.id + '@' + a.lvl : '-', lb = b ? b.id + '@' + b.lvl : '-';
  if (la !== lb) { diff++; if (diff <= 3) ap('   差异格 ' + i + '：城 ' + la + ' vs 布局 ' + lb); }
}
ap('② 建筑就地转正（逐格与满配布局比对）：' + (diff ? '❌ ' + diff + ' 格不一致' : '✅ 全 ' + nc.cells.length + ' 格一致'));
ap('③ 人口归附 = ' + U.fmt(nc.res.pop) + '（应为 ' + U.fmt(G.planPopCapOf(fort.level)) + '）：'
  + (nc.res.pop === G.planPopCapOf(fort.level) ? '✅' : '❌'));

ap('');
ap('===== 2. 该格是否永久不再生成据点 =====');
ap('④ 当日 fortAt = ' + G.map.fortAt(fort.x, fort.y) + '（应为 null）：'
  + (G.map.fortAt(fort.x, fort.y) === null ? '✅' : '❌'));
/* 换日：清掉"今日已破"标记（模拟次日重置）—— 若还活着说明占据没生效 */
st.fortsRazed = {};
st.fortRaids = {};
ap('⑤ 清掉"今日已破"标记后（= 次日）fortAt = ' + G.map.fortAt(fort.x, fort.y)
  + '：' + (G.map.fortAt(fort.x, fort.y) === null ? '✅ 仍是我城，不再复活' : '❌ 复活了'));
/* 目标扫描（自动出征用同一出口） */
var seen = 0;
for (var y2 = 0; y2 < (DATA.MAP_H || 61); y2++) {
  for (var x2 = 0; x2 < (DATA.MAP_W || 61); x2++) {
    var f2 = G.map.fortAt(x2, y2);
    if (f2 && f2.x === fort.x && f2.y === fort.y) seen++;
  }
}
ap('⑥ 全图扫描还能看到这座据点：' + seen + ' 次（应为 0）：' + (seen === 0 ? '✅' : '❌'));
var tile = G.map.tile(fort.x, fort.y);
ap('⑦ 地块地形 = ' + (tile && tile.terrain) + '（应为 city）');
ap('');
ap('战报战果行：' + ((function () {
  var rep = null;
  (st.reports || []).forEach(function (x) { if (!rep && x.type === 'war' && x.loot) rep = x; });
  return rep ? (rep.loot || []).join(' / ').slice(0, 240) : '（无）';
})()));
ap('');
ap('（探针结束）');
process.exit(0);
