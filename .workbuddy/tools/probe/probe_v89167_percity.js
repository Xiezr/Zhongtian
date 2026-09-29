/* v89.167 探针：自动升级 **每城独立建造位**（逐城遍历、各自排满）。
   ① 三城造局：一次调用应"每城都排、各自封顶、总数 > 3"（改前上限 3）
   ② 资源只够每城 1 条：应"每城恰好 1 条"（分别升级 · 公平）
   ③ 暂停语义保持（全城资源清零 → 试遍 → paused）
   运行：node .workbuddy/tools/probe/probe_v89167_percity.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var pass = 0, fail = 0;
function P(n, ok, ex) {
  if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); }
  else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); }
}
var sum = function (o) { var t = 0; for (var k in o) { if (k !== 'time' && k !== 'jewel' && k !== 'pop') t += o[k] || 0; } return t; };

G.newGame({ name: 'v167', region: '司隶' });
var s = G.state;
if (!s.map.grid) G.map.generate();

/* ── 造局：三城（主城 + 2 建城），各城官府 lv3 + 4 格民房 lv1 ── */
function resOf(c) { return ['grain', 'wood', 'stone', 'iron'].map(function (k) { return G.res(c)[k] || 0; }); }
function setRes(c, v) { ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = v; }); }
function seedCity(c) {
  c.cells.forEach(function (x) { if (x.build && !x.official) x.build = null; });
  var govIdx = -1;
  for (var i = 0; i < c.cells.length; i++) { if (c.cells[i].official) { govIdx = i; break; } }
  c.cells[govIdx].build = { id: 'guanfu', lvl: 3 };
  var put = 0;
  for (var i = 0; i < c.cells.length && put < 4; i++) {
    if (c.cells[i].official || c.cells[i].build) continue;
    c.cells[i].build = { id: 'minfang', lvl: 1 };
    put++;
  }
}
setRes(G.currentCity(), 600000);
G.res(G.currentCity()).gold = 300000;
s.rank = 6;                    /* 领地上限随爵位（v89.108）—— 平民只 2 城，给爵位到 3 城 */
var lastFail167 = '';
var MAXW = Math.min((DATA.MAP_W || 40) - 1, 60);
for (var y = 1; y < MAXW && s.cities.length < 3; y++) {
  for (var x = 1; x < MAXW && s.cities.length < 3; x++) {
    var t = G.map.tile(x, y);
    if (!t || t.terrain !== 'plain') continue;
    var dup = false;
    (s.wilds || []).forEach(function (w) { if (w.x === x && w.y === y) dup = true; });
    if (dup) continue;
    setRes(G.currentCity(), 600000);          /* 建城扣款走当前城（v89.161 按城）· 先补足 */
    /* ⚠️ 顺序：先"占野地"（push s.wilds —— wildAt 查的就是它），再筑城；
       反之 = 永远报"需先占领该野地"（本轮实中）。buildCityAt 内部自带 canBuildCityAt。 */
    s.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });
    var r167 = null;
    try { r167 = G.buildCityAt(x, y); } catch (e) { lastFail167 = 'EX ' + e.message; }
    if (r167 && !r167.ok) lastFail167 = r167.msg;
  }
}
if (s.cities.length < 3) console.log('  建城中止原因 = ' + lastFail167);
/* 新城（after 都有 4 项资源=0？建城扣款，统一补） */
s.cities.forEach(function (c) { if (c !== G.currentCity()) setRes(c, 600000); s.autoState = null; });
s.cities.forEach(seedCity);
console.log('  造局：城数=' + s.cities.length + ' · 各城候选 = 官府(3) + 民房×4(1)');
P('造局：3 城各 5 候选', s.cities.length === 3);

/* 清空队列（造局之前可能有） */
s.queues.build.length = 0;
s.settings.autoUpgrade = true;

/* ═══ ① 排满：一次调用每城排满（各城 5 候选 > 3 位 → 每城 3 条）═══ */
console.log('\n=== ① 一次调用 · 每城排满 ===');
var r1 = G.autoUpgrade();
var byCity = {};
(s.queues.build || []).forEach(function (q) { byCity[q.cityId] = (byCity[q.cityId] || 0) + 1; });
var perSlots = s.cities.map(function (c) { return G.buildSlots(c); });
console.log('  autoUpgrade → count=' + (r1 && r1.count) + ' · 各城在办=' + JSON.stringify(s.cities.map(function (c) { return (byCity[c.id] || 0); })));
console.log('  autoState = ' + ((s.autoState || {}).msg || ''));
P('★ 排入数 > 3（改前全境上限 3 的铁证）', !!(r1 && r1.count > 3), 'count=' + (r1 && r1.count));
P('★ 每城都被遍历到（每城 ≥1 条）', s.cities.every(function (c) { return (byCity[c.id] || 0) >= 1; }),
  JSON.stringify(s.cities.map(function (c) { return (byCity[c.id] || 0); })));
P('★ 各城各自封顶（每城 ≤ 该城建造位 ' + perSlots.join('/') + '）',
  s.cities.every(function (c, i) { return (byCity[c.id] || 0) <= perSlots[i]; }));
P('★ 各城都被排满（每城 = 位 · 候选足够时）',
  s.cities.every(function (c, i) { return (byCity[c.id] || 0) === perSlots[i]; }),
  JSON.stringify(perSlots));
P('autoState 文案写明「各城独立建造位」', /各城独立建造位/.test((s.autoState || {}).msg || ''));

/* ═══ ② 公平：清空队列 + 资源只够每城 1 条 → 每城恰好 1 条 ═══ */
console.log('\n=== ② 资源只够每城 1 条 · 每城恰好 1 条 ===');
s.queues.build.length = 0;
s.cities.forEach(function (c) { c.cells.forEach(function (x) { x.pending = null; }); });
var cm167 = DATA.BUILDINGS.minfang.levelCost(1);
s.cities.forEach(function (c) {
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = cm167[k] || 0; });
});                                                            /* 每项恰好够 1 条民房（逐项口径） */
var r2 = G.autoUpgrade();
var byCity2 = {};
(s.queues.build || []).forEach(function (q) { byCity2[q.cityId] = (byCity2[q.cityId] || 0) + 1; });
console.log('  autoUpgrade → count=' + (r2 && r2.count) + ' · 各城在办=' + JSON.stringify(s.cities.map(function (c) { return (byCity2[c.id] || 0); })));
P('★ 每城恰好 1 条（分别升级 · 公平 —— 改前只排"当前城/首个"的 1 条）',
  s.cities.every(function (c) { return (byCity2[c.id] || 0) === 1; }),
  JSON.stringify(s.cities.map(function (c) { return (byCity2[c.id] || 0); })));

/* ═══ ③ 暂停语义保持（v89.160）：全城资源清零 → 试遍 → paused ═══ */
console.log('\n=== ③ 全城资源清零 · 试遍 → 暂停（v89.160 语义保持）===');
s.queues.build.length = 0;
s.cities.forEach(function (c) { c.cells.forEach(function (x) { x.pending = null; }); setRes(c, 0); });
var r3 = G.autoUpgrade();
console.log('  autoState = ' + ((s.autoState || {}).msg || ''));
P('★ 全试遍仍无一可动 → 暂停（开关不关）', !!(r3 && r3.paused === true) && s.settings.autoUpgrade === true);
P('暂停文案写明「试遍」与待升级项', /试遍/.test((s.autoState || {}).msg || ''));

/* ═══ ④ 全城队列满 → "各城队列已满"（不 paused · 退役老闸门文案）═══ */
console.log('\n=== ④ 全城队列满 → 文案 ===');
s.queues.build.length = 0;
s.cities.forEach(function (c) { c.cells.forEach(function (x) { x.pending = null; }); setRes(c, 600000); });
/* 手工塞满各城位 */
s.cities.forEach(function (c) {
  for (var i = 0; i < G.buildSlots(c); i++) {
    s.queues.build.push({ cityId: c.id, gridIndex: 0, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 0, totalTime: 999 });
  }
});
var r4 = G.autoUpgrade();
console.log('  autoState = ' + ((s.autoState || {}).msg || ''));
P('★ 全城队列满 → 「各城队列已满（合 N 位在办）」· 不 paused', r4 === null && /各城队列已满（合 \d+ 位在办/.test((s.autoState || {}).msg || ''));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
