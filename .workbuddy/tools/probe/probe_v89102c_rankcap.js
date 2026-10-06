/* ============================================================
 * probe_v89102c_rankcap.js — 主城·爵位解锁建筑等级上限（受控实测）
 * ------------------------------------------------------------
 * 老板令：「主城（每个玩家只能设定一座主城）可随爵位逐步解锁官府及其他建筑
 *   等级上限，爵位每级解锁建筑等级上限 1 级」。
 * 本探针只问四件事：
 *   ① 上限链：主城 / 非主城 / 各爵位档 → 建筑上限各是多少（唯一出口 buildCapOf）
 *   ② **表覆盖**：等级上限抬到 45 后，五张"按等级取值"的表是否都够长
 *      （不够长 = 升级按钮忽然消失 / 产量变 NaN —— 本项目踩过的老坑）
 *   ③ 官府总闸：主城爵位解锁是否**同步抬起总闸**（否则"解锁了却被官府卡住"）
 *   ④ **真通道**：给足资源，主城能不能真的把民房从 12 级升到 13+ 级（域层守卫放行）
 * 用法：node .workbuddy/tools/probe/probe_v89102c_rankcap.js
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
var out = [];
function ap(s) { out.push(s); }

var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var c0 = st.cities[0];
G.ui._cityId = c0.id;
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c0.res[k] = 5e6; });
c0.res.gold = 5e6;

ap('===== 0. 上限常量 =====');
ap('MAX_BLEVEL = ' + DATA.MAX_BLEVEL + ' · 档位加成 = ' + JSON.stringify(DATA.CITY_BUILD_BONUS));
ap('主城每档解锁 = ' + DATA.MAIN_CITY_BUILD_PER_RANK + ' · 满档解锁 = ' + DATA.RANK_BUILD_LIFT_MAX
  + ' · 爵位档数 = ' + DATA.RANK.length);
ap('MAX_LEVEL_ABS = ' + DATA.MAX_LEVEL_ABS
  + '（= 12 + 12 + ' + DATA.RANK_BUILD_LIFT_MAX + ' → 主城能盖到的最高级）');
ap('一致性：RANK.length − 1 === RANK_BUILD_LIFT_MAX → '
  + ((DATA.RANK.length - 1) === DATA.RANK_BUILD_LIFT_MAX ? '✅' : '❌'));
ap('主城坡度引用一致：MAIN_CITY.buildCapPerRank === MAIN_CITY_BUILD_PER_RANK → '
  + ((DATA.MAIN_CITY.buildCapPerRank === DATA.MAIN_CITY_BUILD_PER_RANK) ? '✅' : '❌'));

ap('');
ap('===== 1. 上限链（buildCapOf 唯一出口）=====');
function mkCity(type, govLv) {
  var c = G.makeCity({ id: 'p_' + type + '_' + (G._pcSeq = (G._pcSeq || 0) + 1), name: type, x: 2, y: 2, type: type });
  c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = govLv; });
  return c;
}
/* ⚠️ 探针第一版把 `st.mainCityId` 写在建城函数里 —— 后建的一座把前一座的"主城"身份
   顶掉了，于是四列数字全是错的（这正好说明"身份要显式设、且设完立刻测"）。 */
function cap4(type, govLv, rk) {
  st.rank = rk;
  var c = mkCity(type, govLv);
  st.mainCityId = c.id;
  var isMain = G.buildCapOf(c, 'minfang');
  var liftMain = G.rankBuildCapOf(c);
  var govMain = G.buildCapOf(c, 'guanfu');
  st.mainCityId = null;
  var notMain = G.buildCapOf(c, 'minfang');
  var liftNot = G.rankBuildCapOf(c);
  return { main: isMain, not: notMain, lift: liftMain, liftNot: liftNot, gov: govMain };
}
[0, 1, 5, 21].forEach(function (rk) {
  var a = cap4('self', 12, rk), b = cap4('capital', 24, rk);
  ap('爵位 Lv' + rk + '（' + DATA.RANK[rk].name + '）：'
    + '自建主城 Lv' + a.main + ' / 自建非主城 Lv' + a.not
    + '　·　都城主城 Lv' + b.main + ' / 都城非主城 Lv' + b.not
    + '　·　主城官府 Lv' + a.gov
    + '　·　解锁量 主城 ' + a.lift + ' / 非主城 ' + a.liftNot);
});
st.rank = 21;
(function () {
  var mc2 = mkCity('self', 12, 21);
  st.mainCityId = mc2.id;
  ap('满档主城 · 官府 Lv12：民房上限 = ' + G.buildCapOf(mc2, 'minfang')
    + '（总闸 12 + 解锁 21 = 33）· 城墙 = ' + G.buildCapOf(mc2, 'chengqiang')
    + ' · 城外农田 = ' + G.buildCapOf(mc2));
})();

ap('');
ap('===== 2. 表覆盖（五张按等级取值的表 ≥ MAX_LEVEL_ABS）=====');
var N = DATA.MAX_LEVEL_ABS;
var tables = [
  ['民房人口 pop', DATA.BUILDINGS.minfang.pop],
  ['仓库保护 cap', DATA.BUILDINGS.cangku.cap],
  ['驿站速度 speed', DATA.BUILDINGS.yizhan.speed],
  ['城外产量 prod', DATA.EXT_BUILDINGS.farm.prod],
  ['城外上限 EXT_CAP_BY_LV', DATA.EXT_CAP_BY_LV],
  ['城外布局 EXT_PLAN_BY_LV', DATA.EXT_PLAN_BY_LV],
];
tables.forEach(function (t) {
  ap('  ' + t[0] + '：' + t[1].length + ' 项 ' + (t[1].length >= N ? '✅' : '❌ 短 ' + (N - t[1].length)));
});
var badCost = [];
Object.keys(DATA.BUILDINGS).forEach(function (k) {
  if (DATA.BUILDINGS[k].levelCost && !DATA.BUILDINGS[k].levelCost(N - 1)) badCost.push(k);
});
ap('  城内造价表取得到第 ' + N + ' 级（levelCost(' + (N - 1) + ')）：'
  + (badCost.length ? '❌ ' + badCost.join(',') : '✅ ' + Object.keys(DATA.BUILDINGS).length + ' 张全在'));
var badExt = [];
['farm', 'forest', 'quarry', 'mine'].forEach(function (t) {
  if (!G.extBuildCost(t, N - 1)) badExt.push(t);
});
ap('  城外造价表取得到第 ' + N + ' 级：' + (badExt.length ? '❌ ' + badExt.join(',') : '✅ 4 张全在'));
var planBad = 0;
for (var lv = 1; lv <= N; lv++) {
  var pl = DATA.EXT_PLAN_BY_LV[lv - 1] || [];
  var sum = pl.reduce(function (a, b) { return a + b; }, 0);
  if (sum !== DATA.EXT_CAP_BY_LV[lv - 1]) planBad++;
}
ap('  城外"满建筑"不变量（逐档合计 == 上限）1..' + N + '：' + (planBad ? '❌ ' + planBad + ' 档 ' : '✅ 全档'));

ap('');
ap('===== 3. 数值后果（满档主城）=====');
ap('  民房 Lv12 → Lv33 人口上限：' + DATA.BUILDINGS.minfang.pop[11] + ' → ' + DATA.BUILDINGS.minfang.pop[32]
  + '　（×' + (DATA.BUILDINGS.minfang.pop[32] / DATA.BUILDINGS.minfang.pop[11]).toFixed(1) + '）');
ap('  仓库 Lv12 → Lv33 保护：' + DATA.BUILDINGS.cangku.cap[11] + ' → ' + DATA.BUILDINGS.cangku.cap[32]);
ap('  驿站 Lv12 → Lv33 速度：' + DATA.BUILDINGS.yizhan.speed[11] + ' → ' + DATA.BUILDINGS.yizhan.speed[32]);
var cost12 = DATA.BUILDINGS.minfang.levelCost(11), cost33 = DATA.BUILDINGS.minfang.levelCost(32);
ap('  民房 Lv13 造价（粮/木）：' + cost12.grain + '/' + cost12.wood
  + '　Lv33 造价：' + cost33.grain + '/' + cost33.wood);
ap('  城外上限 Lv12 → Lv33：' + DATA.EXT_CAP_BY_LV[11] + ' → ' + DATA.EXT_CAP_BY_LV[32] + ' 块');

ap('');
ap('===== 4. 真通道：主城能否真的升过 12 级 =====');
(function () {
  st.rank = 0;
  st.mainCityId = c0.id;
  /* 官府先置满 12 级（总闸的底），否则每一路都会被"官府不足"先拦掉 */
  c0.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
  if (!G.buildingLevel(c0, 'guanfu')) {
    var gi = c0.cells.findIndex(function (x) { return !x.build && !x.official; });
    if (gi >= 0) c0.cells[gi].build = { id: 'guanfu', lvl: 12 };
  }
  var idx = -1;
  c0.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'minfang') idx = i; });
  if (idx < 0) {
    idx = c0.cells.findIndex(function (x) { return !x.build && !x.official; });
    c0.cells[idx].build = { id: 'minfang', lvl: 12 };
  }
  c0.cells[idx].build.lvl = 12;
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c0.res[k] = 1e9; });
  function tryUp() {
    var r = null;
    try { r = G.upgradeAt(c0.id, idx); } catch (e) { r = { ok: false, msg: e.message }; }
    return r;
  }
  ap('  官府 Lv' + G.buildingLevel(c0, 'guanfu') + ' · 民房 Lv12（旧硬顶）');
  var r1 = tryUp();
  ap('  爵位「平民」（解锁 0）→ 升级：' + (r1 && r1.ok ? '❌ 不该通过' : '⛔ ' + ((r1 && r1.msg) || '?')));
  c0.cells[idx].build.lvl = 12;
  st.rank = 5;
  var r2 = tryUp();
  ap('  爵位「大夫」（解锁 5）→ 升级：' + (r2 && r2.ok ? '✅ 通过（进队列，目标 13 级，上限 17 之内）' : '⛔ ' + ((r2 && r2.msg) || '?'))
    + '　队列中：' + !!GAME.queueAt('city', idx));
  /* 把这条队列撤掉，恢复"未施工"的干净态，再验非主城 */
  (function () {
    st.queues.build = (st.queues.build || []).filter(function (q) { return Number(q.gridIndex) !== idx; });
    c0.cells[idx].pending = null;
    c0.cells[idx].build.lvl = 12;
  })();
  st.rank = 2;
  st.mainCityId = null;                 /* 取消主城 */
  var pre3 = G.buildPrereqOf(c0, 'minfang', 13);
  var r3 = tryUp();
  var upCap = G.buildCapOf(c0, 'minfang');
  ap('  爵位「上造」（解锁 2）· **非主城** → 上限 Lv' + upCap
    + '　升级：' + (r3 && r3.ok ? '❌ 不该通过' : '⛔ ' + ((r3 && r3.msg) || '?')));
  ap('    （同条件下"能否升到 13 级"的前置提示：' + (pre3.ok ? 'ok' : pre3.short)
    + ' —— 上限由升级守卫拦，前置提示只报"前置"）');
})();

ap('');
ap('===== 5. 界面前置提示口径 =====');
(function () {
  st.rank = 5; st.mainCityId = c0.id;
  var idx = 0;
  c0.cells.forEach(function (x, i) { if (x.build && x.build.id === 'minfang') idx = i; });
  c0.cells[idx].build.lvl = 15;
  var pre = G.buildPrereqOf(c0, 'minfang', 16);
  ap('  主城（官府 Lv' + G.buildingLevel(c0, 'guanfu') + ' · 解锁 ' + G.rankBuildCapOf(c0) + '）想升 16 级：'
    + (pre.ok ? '✅ 前置通过（16 ≤ 官府12 + 解锁5 = 17）' : '⛔ ' + pre.msg));
  /* 非主城：官府已到自己的顶（12 = 12+0+0）→ 前置不再报 gate，由等级硬顶报"已达最高等级"
     —— 与 v68 的既定语义一致（"官府已到顶时不报 gate"）。 */
  st.mainCityId = null;
  var pre2 = G.buildPrereqOf(c0, 'minfang', 16);
  ap('  非主城同条件想升 16 级：前置 ' + (pre2.ok ? 'ok（不报 gate：官府已到自己的顶）' : '⛔ ' + pre2.short)
    + '　硬顶 Lv' + G.buildCapOf(c0, 'minfang') + ' → 升级守卫会拦"已达最高等级"');
})();

console.log(out.join('\n'));
