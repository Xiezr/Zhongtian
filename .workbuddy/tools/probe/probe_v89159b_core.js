'use strict';
/* v89.159 探针 B：三条改动的实证（改后）
   ① 将领升级 → 体力/精力回满（含"没升级不回满"的对照）
   ② 民房门槛按**本座**等级（两座混级：Lv3 那座可升 · Lv4 那座报需官府 5）
   ③ 官府总闸严格 ≤ 官府（主城爵位解锁时，其他建筑 cap = 官府等级） */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join('E:/Deepseekdb/js/', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探159b', cityName: '许都', region: '碎垣', mapSeed: 20260959 });
var s = G.state, c = G.currentCity();

function P(tag, v) { console.log((v ? '  ✓ ' : '  ✗ ') + tag); return v; }
function cellOf(id) { var out = []; (c.cells || []).forEach(function (x, i) { if (x.build && x.build.id === id) out.push(i); }); return out; }
function setAll(id, lv) { cellOf(id).forEach(function (i) { c.cells[i].build.lvl = lv; }); }

console.log('=== ① 将领升级 → 体力/精力回满 ===');
var gen = (s.generals || []).filter(function (g) { return !g.isLord; })[0] || (s.generals || [])[0];
if (!gen) { console.log('  无将领可测'); } else {
  G.setStaNow(gen, G.staMax(gen) * 0.2);
  G.setEnergyNow(gen, Math.round(G.energyMaxOf(gen) * 0.15));
  var before = { lv: gen.level, sta: G.staNow(gen), ene: G.energyNowOf(gen) };
  console.log('  升级前：Lv' + before.lv + ' · 体力 ' + before.sta + '/' + G.staMax(gen) + ' · 精力 ' + before.ene + '/' + G.energyMaxOf(gen));
  /* 对照：只给一点点经验（不升级）→ 体力/精力**不动** */
  G.battle.gainExp(gen, 1, '探针对照');
  P('未升级 → 体力不动（' + G.staNow(gen) + ' vs ' + before.sta + '）', G.staNow(gen) === before.sta);
  P('未升级 → 精力不动（' + G.energyNowOf(gen) + ' vs ' + before.ene + '）', G.energyNowOf(gen) === before.ene);
  /* 真升级：给足经验 */
  var need = G.expNeedOf(gen) + 5;
  G.battle.gainExp(gen, need, '探针升级');
  console.log('  升级后：Lv' + gen.level + ' · 体力 ' + G.staNow(gen) + '/' + G.staMax(gen) + ' · 精力 ' + G.energyNowOf(gen) + '/' + G.energyMaxOf(gen));
  P('升级了（Lv' + before.lv + ' → ' + gen.level + '）', gen.level > before.lv);
  P('体力回满', G.staNow(gen) === G.staMax(gen));
  P('精力回满', G.energyNowOf(gen) === G.energyMaxOf(gen));
  /* 多级连升只回一次（幂等） */
  G.setStaNow(gen, 10);
  G.battle.gainExp(gen, G.expNeedOf(gen) + 1, '探针二级');
  P('二级后再满（Lv' + gen.level + '）', G.staNow(gen) === G.staMax(gen) && G.energyNowOf(gen) === G.energyMaxOf(gen));
}

console.log('\n=== ② 民房门槛按本座等级 ===');
setAll('guanfu', 4); setAll('minfang', 3);
var idxs = cellOf('minfang');
console.log('  民房格 = ' + JSON.stringify(idxs) + ' · 官府 ' + G.buildingLevel(c, 'guanfu') + ' · 民房上限 ' + G.buildCapOf(c, 'minfang'));
P('两座都 Lv3 时：Lv1→2 的第 7 格可升', G.buildPrereqOf(c, 'minfang', 4).ok === true);
c.cells[idxs[0]].build.lvl = 4;                       /* 一座已 Lv4（老板场景） */
c.cells[idxs[1]].build.lvl = 3;
s.queues.build.length = 0;
c.cells.forEach(function (x) { x.pending = null; });
var r3 = G.upgradeAt(c.id, idxs[1]);
console.log('  升级 Lv3 那座 → ' + JSON.stringify(r3));
P('Lv3 那座可升（不再误报需官府 5）', r3.ok === true);
s.queues.build.length = 0; c.cells[idxs[1]].pending = null;
var r4 = G.upgradeAt(c.id, idxs[0]);
console.log('  升级 Lv4 那座 → ' + JSON.stringify(r4));
P('Lv4 那座正确被拦（短文案「' + r4.short + '」）', r4.ok === false && r4.short === '需官府 Lv5');
/* 面板与内核同一把尺：Lv3 那座的面板应给出**可升级**的键（不是"需官府"） */
try { G.ui.openBuildModal(idxs[1]); } catch (e) { console.log('  面板异常：' + e.message); }
var m = String(global.document.getElementById('modal-root').innerHTML || '');
console.log('  面板（Lv3 那座）：含升级键 = ' + /confirm-upgrade/.test(m) + ' · 含"需官府" = ' + /需官府/.test(m));
P('面板给的是「升级」键（与本座等级同尺）', /confirm-upgrade/.test(m) && !/需官府/.test(m));
try { G.ui.openBuildModal(idxs[0]); } catch (e) { console.log('  面板异常：' + e.message); }
var m4 = String(global.document.getElementById('modal-root').innerHTML || '');
console.log('  面板（Lv4 那座）：含"需官府 Lv5" = ' + /需官府 Lv5/.test(m4));
P('面板（Lv4 那座）如实报「需官府 Lv5」', /需官府 Lv5/.test(m4));

console.log('\n=== ③ 官府总闸严格 ≤ 官府（主城爵位解锁）===');
var oldRank = s.rank, oldMain = s.mainCityId;
s.mainCityId = c.id;
s.rank = 5;
var lift = G.rankBuildCapOf(c);
s.queues.build.length = 0; c.cells.forEach(function (x) { x.pending = null; });
setAll('guanfu', 12); setAll('minfang', 12);
console.log('  lift = ' + lift + ' · 官府 cap = ' + G.buildCapOf(c, 'guanfu') + ' · 民房 cap = ' + G.buildCapOf(c, 'minfang'));
P('官府自身上限 = 12 + lift（爵位解锁对官府仍生效）', G.buildCapOf(c, 'guanfu') === 12 + lift);
P('民房上限 = 官府等级 12（严格 ≤ 官府）', G.buildCapOf(c, 'minfang') === 12);
var rr = G.upgradeAt(c.id, cellOf('minfang')[0]);
console.log('  民房 12 → 13 → ' + JSON.stringify(rr));
P('民房 12→13 被拦（短文案「' + rr.short + '」）', rr.ok === false && rr.short === '需官府 Lv13');
setAll('guanfu', 13);
s.queues.build.length = 0; c.cells.forEach(function (x) { x.pending = null; });
/* 补足资源与珠宝（12→13 的珠宝需求），让"门槛已放行"这件事单独可验 */
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
var cost12 = DATA.BUILDINGS.minfang.levelCost(12) || {};
if (cost12.jewel) {
  s.jewels = s.jewels || {};
  for (var jk in cost12.jewel) s.jewels[jk] = Math.max(s.jewels[jk] || 0, cost12.jewel[jk]);
}
var rr2 = G.upgradeAt(c.id, cellOf('minfang')[0]);
console.log('  升官府到 13 + 补料后 → ' + JSON.stringify(rr2));
P('官府升到 13 后民房放行（门槛不再是官府）', rr2.ok === true || !/前置未满足/.test(rr2.msg || ''));
P('民房上限随官府到 13', G.buildCapOf(c, 'minfang') === 13);
s.rank = oldRank; s.mainCityId = oldMain;

console.log('\n=== ④ 回归对照：非主城 / 无 lift 行为一字未变 ===');
var oldRank2 = s.rank, oldMain2 = s.mainCityId;
s.rank = 0; s.mainCityId = null;
setAll('guanfu', 4); setAll('minfang', 4);
P('平民非主城：民房 cap = 4（同改前）', G.buildCapOf(c, 'minfang') === 4);
P('平民非主城：官府 cap = 12（同改前）', G.buildCapOf(c, 'guanfu') === 12);
s.rank = oldRank2; s.mainCityId = oldMain2;
process.exit(0);
