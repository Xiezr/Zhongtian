/* ============================================================
 * probe_v89114_load.js — 需求 1 取证：负重口径标定
 * 量四组：
 *   ① 18 兵种负重现值表（load）与"人均搬运力"分布
 *   ② 各档位**掠夺总量**：野地 Lv1~10 / 据点 Lv1~10 / 四类名城（各采样 300 次）
 *      统一折算为"重量"（粮木石铁金同权，与 cargoLoadOf 同口径）
 *   ③ 典型编队载重：几套常见编制（纯战兵 / 带民夫 / 带辎重车）× 兵力规模
 *   ④ **标定核心表**：打赢各档目标所需兵力 → 那份兵力的载重 vs 该目标掠夺量
 *      （"需多少后勤才能搬完"一眼可见）
 * 用法：node .workbuddy/tools/probe/probe_v89114_load.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '量', cityName: '许都', mapSeed: 20260923 });
if (!st.map.grid) G.map.generate();

function wan(x) { return (x / 1e4).toFixed(1) + '万'; }
var KEYS = ['grain', 'wood', 'stone', 'iron', 'gold'];

/* ① 兵种负重表 */
console.log('=== ① 兵种负重现值（load）与定位 ===');
var ids = Object.keys(DATA.TROOPS);
ids.forEach(function (id) {
  var t = DATA.TROOPS[id];
  console.log('  ' + t.name.padEnd(6) + ' cat=' + (t.cat || 'siege').padEnd(6)
    + ' load=' + String(t.load).padStart(5)
    + '  hp=' + String(t.hp).padStart(6) + ' atk=' + String(t.atk).padStart(4)
    + ' cost≈' + Math.round((t.cost.grain || 0) + (t.cost.wood || 0) + (t.cost.iron || 0) + (t.cost.stone || 0))
    + '  ' + (t.nocombat ? '[不列阵] ' : '') + (t.craft ? '[器械] ' : ''));
});
var loadSum = 0, n = 0;
ids.forEach(function (id) { loadSum += DATA.TROOPS[id].load; n++; });
console.log('  —— 战斗兵（非 craft 非 nocombat）平均 load = ' +
  (function () {
    var a = ids.filter(function (i) { return !DATA.TROOPS[i].craft && !DATA.TROOPS[i].nocombat; });
    var s = 0; a.forEach(function (i) { s += DATA.TROOPS[i].load; }); return (s / a.length).toFixed(1);
  })());

/* ② 掠夺总量（重量口径） */
function lootSamples(t, extMul, n2) {
  var tot = 0;
  for (var i = 0; i < n2; i++) {
    var o = G.battle.genLoot(t, extMul);
    KEYS.forEach(function (k) { tot += o[k] || 0; });
  }
  return Math.round(tot / n2);
}
var cm = DATA.EXPEDITION.cityResMul, wm = DATA.EXPEDITION.wildResMul;
console.log('\n=== ② 掠夺总量（重量 · 粮木石铁金合计）===');
console.log('  —— 野地 wild（genLoot × wildResMul.raid=' + wm.raid + '）');
var wildAmt = {};
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (lv) {
  var t = { kind: 'wild', lv: lv };
  wildAmt[lv] = lootSamples(t, wm.raid, 300);
  console.log('  Lv' + String(lv).padStart(2) + '  掠夺合计 ' + wan(wildAmt[lv]).padStart(9));
});
console.log('  —— 据点 fort（genLoot × cityResMul.raid=' + cm.raid + '）');
var fortAmt = {};
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (lv) {
  var t = { kind: 'fort', lv: lv, dropType: 'fort' };
  fortAmt[lv] = lootSamples(t, cm.raid, 300);
  var gs = G.map.fortGarrison(lv), gsum = 0; for (var k in gs) gsum += gs[k];
  console.log('  Lv' + String(lv).padStart(2) + '  掠夺合计 ' + wan(fortAmt[lv]).padStart(9) + '   守军 ' + wan(gsum).padStart(9));
});
console.log('  —— 名城（npcLoot：派生库藏 × cityResMul.raid=' + cm.raid + '）');
var cityAmt = {};
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  var c = (st.map.cities || []).filter(function (x) { return x.type === ty; })[0];
  if (!c) { console.log('  ' + ty + ' 无样本'); return; }
  var lo = G.npcLoot(c, 'raid'), lt = 0; for (var k2 in lo) lt += lo[k2];
  cityAmt[ty] = lt;
  var res = G.npcCityRes(c), tot = 0; for (var k3 in res) { if (k3 !== 'pop') tot += res[k3]; }
  console.log('  ' + ty.padEnd(8) + ' Lv' + G.cityLvOf(c) + '  库藏 ' + wan(tot).padStart(10) + '  掠夺 ' + wan(lt).padStart(10)
    + '  守军 ' + wan(DATA.NPC_CITY_RES.garrisonByTier[ty] || 0).padStart(9));
});

/* ③ 典型编队载重 */
console.log('\n=== ③ 典型编队载重（GAME.cargoCapOf）===');
function capOf(army) { return G.cargoCapOf(army); }
var forms = [
  ['1 万义兵', { yibing: 10000 }],
  ['1 万长枪', { changqiang: 10000 }],
  ['1 万刀盾', { daodun: 10000 }],
  ['1 万弓手', { gongjian: 10000 }],
  ['5000 轻骑', { qingji: 5000 }],
  ['5000 铁骑', { tieji: 5000 }],
  ['500 辎重车', { zhouche: 500 }],
  ['5000 民夫', { minfu: 5000 }],
  ['1 万混编(4 兵种均分)', { yibing: 2500, changqiang: 2500, gongjian: 2500, qingji: 2500 }],
  ['2 万混编 + 2000 民夫', { yibing: 4000, changqiang: 4000, gongjian: 4000, qingji: 4000, minfu: 2000 }],
  ['2 万混编 + 400 车', { yibing: 4000, changqiang: 4000, gongjian: 4000, qingji: 4000, zhouche: 400 }],
  ['1 万民夫(专运)', { minfu: 10000 }],
  ['2000 车(专运)', { zhouche: 2000 }],
];
forms.forEach(function (f) { console.log('  ' + f[0].padEnd(24) + ' 载重 ' + wan(capOf(f[1])).padStart(10)); });

/* ④ 标定核心表：打赢所需兵力 → 载重 vs 掠夺量 */
console.log('\n=== ④ 标定：打赢各档目标所需兵力规模 → 兵力的载重 覆盖 掠夺量 的比例 ===');
/* 兵力规模口径：取胜兵力 ≈ 守军 × 0.8（引擎里攻方有将领/科技优势时的经验值区间；
   这里给 0.5 / 1.0 两档做敏感性） */
function coverRow(name, lootAmt, garrison, loadPer) {
  var need = Math.round(garrison * 0.8);
  var cap = need * loadPer;
  console.log('  ' + name.padEnd(22) + ' 掠夺 ' + wan(lootAmt).padStart(10)
    + '  需兵≈' + wan(need).padStart(8)
    + '  纯战兵载重(load=' + loadPer + ') ' + wan(cap).padStart(10)
    + '  → 覆盖率 ' + (cap / lootAmt * 100).toFixed(1) + '%');
}
console.log('  （纯战兵 load 取 40 —— 长枪 40 / 刀盾 30 / 弓 25 / 轻骑 100 的中位）');
[1, 3, 5, 8, 10].forEach(function (lv) {
  var gs = G.map.fortGarrison(lv), gsum = 0; for (var k in gs) gsum += gs[k];
  coverRow('据点 Lv' + lv, fortAmt[lv], gsum, 40);
});
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  if (!cityAmt[ty]) return;
  coverRow(ty, cityAmt[ty], DATA.NPC_CITY_RES.garrisonByTier[ty] || 1, 40);
});

console.log('\n=== ⑤ 后勤换算：把掠夺量搬完，各需要多少后勤（按现值 load）===');
function needOf(amt, per) { return Math.ceil(amt / per); }
[1, 5, 10].forEach(function (lv) {
  console.log('  据点 Lv' + lv + '（掠夺 ' + wan(fortAmt[lv]) + '）→ 民夫 ' + wan(needOf(fortAmt[lv], 200))
    + ' 或 辎重车 ' + Math.ceil(needOf(fortAmt[lv], 5000)) + ' 辆');
});
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  if (!cityAmt[ty]) return;
  console.log('  ' + ty.padEnd(8) + '（掠夺 ' + wan(cityAmt[ty]) + '）→ 民夫 ' + wan(needOf(cityAmt[ty], 200))
    + ' 或 辎重车 ' + Math.ceil(needOf(cityAmt[ty], 5000)) + ' 辆');
});

process.exit(0);
