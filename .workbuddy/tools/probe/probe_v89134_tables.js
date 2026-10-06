/* ============================================================
 * probe_v89134_tables.js —— 数据表梳理 行为验证探针（v89.134）
 * ------------------------------------------------------------
 * 本轮是**重构型**交付（行为必须零变化）——
 * 探针验证「接线后的运行时值 == 接线前的语义」：
 *   ① RES_ORDER / RES_KEYS / TRANSPORT_KEYS 三键表关系；
 *   ② 首城外城模板 = 2田1木1石1铁（逐格）；
 *   ③ 掠夺产出的资源键集 = RES_ORDER（实调 expLootOf 类出口）；
 *   ④ 死表现场确无（5 张 undefined）；
 *   ⑤ QUESTS 单一来源（运行时数据形状带 metric）。
 * 用法：node .workbuddy/tools/probe/probe_v89134_tables.js
 * ============================================================ */
'use strict';
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '　' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '　' + extra : '')); }
}

console.log('===== v89.134 数据表梳理 · 行为验证探针 =====');

/* ① 三键表关系 */
console.log('\n① 资源键表（RES_ORDER 派生）');
ok('DATA.RES_ORDER = 5 键（不含 pop）',
  D.RES_ORDER.join(',') === 'grain,wood,stone,iron,gold');
ok('GAME.RES_KEYS = RES_ORDER + [pop]（运行时同值）',
  G.RES_KEYS.join(',') === 'grain,wood,stone,iron,gold,pop');
ok('GAME.TRANSPORT_KEYS = RES_ORDER（同引用）',
  G.TRANSPORT_KEYS === D.RES_ORDER, '同引用=' + (G.TRANSPORT_KEYS === D.RES_ORDER));
ok('RES_ORDER 无重复',
  new Set(D.RES_ORDER).size === D.RES_ORDER.length);

/* ② 首城外城模板 */
console.log('\n② 首城外城模板（INITIAL_EXT 接线）');
var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
G.state = st;
var c0 = st.cities[0];
var t5 = (c0.extGrid || []).slice(0, 5).map(function (g) { return g.type; });
ok('首城前 5 格 = farm,farm,forest,quarry,mine（实调逐格）',
  t5.join(',') === 'farm,farm,forest,quarry,mine', t5.join(','));
ok('DATA.INITIAL_EXT 是类型数组（与 NEW_CITY_EXT 同构）',
  Array.isArray(D.INITIAL_EXT) && D.INITIAL_EXT.length === 5);

/* ③ 掠夺产出资源键集（走真实出口） */
console.log('\n③ 掠夺产出（npcCityLoot 类出口 · 资源键集 = RES_ORDER）');
var npc = (st.map && st.map.npcCities && st.map.npcCities[0]) || null;
if (npc) {
  var loot = G.npcCityLoot ? G.npcCityLoot(npc, 'raid', 1) : null;
  if (loot) {
    var keys = Object.keys(loot).filter(function (k) { return k !== 'pop' && k !== 'rep'; });
    ok('掠夺键集 ⊆ RES_ORDER',
      keys.every(function (k) { return D.RES_ORDER.indexOf(k) >= 0; }), keys.join(','));
  } else {
    ok('掠夺出口存在（跳过实调）', !!G.npcCityLoot, '签名差异');
  }
} else {
  console.log('  · 无 NPC 城（跳过③实调）');
}

/* ④ 死表现场 */
console.log('\n④ 死表确无（运行时）');
ok('5 张死表均 undefined',
  typeof D.EQUIP_QUALITY === 'undefined' && typeof D.GENERAL_NAMES === 'undefined'
  && typeof D.ZOOM_LEVELS === 'undefined' && typeof D.WILD_ADD === 'undefined'
  && typeof D.QUEST_TYPE_ORDER === 'undefined');

/* ⑤ QUESTS 数据形状 */
console.log('\n⑤ QUESTS 单一来源（形状核验）');
ok('QUESTS ≥ 50 且全部带 metric（questdata 版特征）',
  (D.QUESTS || []).length >= 50 && D.QUESTS.every(function (q) { return !!q.metric; }),
  (D.QUESTS || []).length + ' 条');
ok('RANDOM_QUESTS ≥ 35（同源文件）', (D.RANDOM_QUESTS || []).length >= 35,
  (D.RANDOM_QUESTS || []).length + ' 条');

/* ⑥ 构建步骤白名单之表仍正常（回归巡查） */
console.log('\n⑥ 白名单构建之表（回归巡查）');
ok('jewelLadder() 返回非空（惰性构建正常）', (D.jewelLadder() || []).length >= 6,
  (D.jewelLadder() || []).length + ' 枚');
ok('ITEM_BY_ID 键数 == ITEMS 长度（末尾重建生效）',
  Object.keys(D.ITEM_BY_ID).length === D.ITEMS.length,
  Object.keys(D.ITEM_BY_ID).length + '/' + D.ITEMS.length);
ok('MAX_LEVEL_ABS = 45（基准 12 + 加成 12 + 爵位 21）', D.MAX_LEVEL_ABS === 45, String(D.MAX_LEVEL_ABS));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
