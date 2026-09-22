/* ============================================================
 * probe_v8992_equip_buff.js — v89.92「装备流 / 宝物流」可行性探针
 * ------------------------------------------------------------
 * 纯读取 + 走既有出口（无游戏代码改动）。回答三组问题：
 *   A. 各套装「拉满 +10」的**全成本**（打造+材料+图纸+强化）与**六维净得**；
 *   B. 「生产类宝物」（神农锄/后稷神犁…）叠加是否**无上限、是否会到期**；
 *   C. 「符类」（治粟/安民/玄德/文曲星）叠在守将身上的**内政倍率**与到期行为；
 *   D. 真实武将穿满套 → cityProdPerSec 的实际变化（产量链证据）。
 * 用法：node probe_v8992_equip_buff.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

/* SIM 时钟（与推演驾驶舱同口径：全探针内可手动推进） */
var _RealNow = Date.now.bind(Date);
var simMs = Date.UTC(2026, 8, 21, 1, 0, 0);
Date.now = function () { return simMs; };

eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
fs.readdirSync(path.join(R, 'story')).filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(path.join(R, 'story', f)); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var city0 = st.cities[0];
G.ui = G.ui || {}; G.ui._cityId = city0.id;

function hr(s) { console.log('\n=== ' + s + ' ==='); }
function li(s) { console.log('  ' + s); }
var ITEM_BY_ID = {};
(DATA.ITEMS || []).forEach(function (it) { ITEM_BY_ID[it.id] = it; });
function shopPrice(id) { var it = ITEM_BY_ID[id]; return it ? (it.price || 0) * 100 : 0; }

/* ============================================================
 * A. 各套装全成本（打造 + 材料[按商城价] + 图纸 + 强化到 +10）
 * ============================================================ */
hr('A. 套装「拉满」全成本（材料按商城价计；强化 0→+10）');
var SET_LIST = ['yitian', 'tiance', 'mingjiang', 'youxia', 'shenwu', 'xianzhen', 'shouyu'];
var AOUT = [];
SET_LIST.forEach(function (setId) {
  var ids = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === setId; });
  if (!ids.length) return;
  var craft = { gold: 0, iron: 0, wood: 0, stone: 0 };
  var mats = {}; var enhance = { gold: 0, iron: 0, stone: 0 };
  var bpCount = 0;
  ids.forEach(function (id) {
    var c = G.forgeCost(id) || {};
    craft.gold += c.gold || 0; craft.iron += c.iron || 0; craft.wood += c.wood || 0; craft.stone += c.stone || 0;
    var m = G.forgeMaterials(id) || {};
    for (var k in m) mats[k] = (mats[k] || 0) + m[k];
    if (G.blueprintOf(id)) bpCount++;
    /* 强化：逐级成本 = 打造基准 × mul × (lv+1)，0→+10 累加 */
    for (var lv = 0; lv < 10; lv++) {
      var base = DATA.FORGE.costByQ[DATA.EQUIP[id].q];
      enhance.gold += Math.round(base.gold * DATA.ENHANCE.goldMul * (lv + 1));
      enhance.iron += Math.round(base.iron * DATA.ENHANCE.ironMul * (lv + 1));
      enhance.stone += Math.round(base.stone * DATA.ENHANCE.stoneMul * (lv + 1));
    }
  });
  var matGold = 0, matLine = [];
  for (var mk in mats) { matGold += mats[mk] * shopPrice(mk); matLine.push((DATA.MATERIAL_BY_ID[mk] || {}).name + '×' + mats[mk]); }
  var bp = G.blueprintOf(ids[0]);
  var bpGold = bp ? bpCount * shopPrice(bp.id) : 0;
  /* 六维净得（+0 与 +10） */
  function setStats(mul) {
    var s0 = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    ids.forEach(function (id) {
      var it = DATA.EQUIP[id];
      ['tong', 'nz', 'yw', 'zm', 'atk', 'def', 'spd', 'sta'].forEach(function (k) { s0[k] += (it[k] || 0) * mul; });
    });
    var syn = {};
    ids.forEach(function (id) { if (DATA.EQUIP[id].set) syn[DATA.EQUIP[id].set] = (syn[DATA.EQUIP[id].set] || 0) + 1; });
    for (var sk in syn) {
      var def = DATA.SETS[sk]; if (!def) continue;
      Object.keys(def.eff).map(Number).sort(function (a, b) { return a - b; }).forEach(function (t) {
        if (syn[sk] >= t) { var e = def.eff[t]; for (var k in e) s0[k] = (s0[k] || 0) + e[k]; }
      });
    }
    return s0;
  }
  var s0 = setStats(1), s10 = setStats(1.8);
  var totalGold = craft.gold + matGold + bpGold + enhance.gold;
  AOUT.push({ set: setId, name: DATA.SETS[setId] ? DATA.SETS[setId].name : setId, pieces: ids.length,
    craftGold: craft.gold, matGold: matGold, bpGold: bpGold, enhGold: enhance.gold, totalGold: totalGold,
    enhIron: enhance.iron + craft.iron, nz0: Math.round(s0.nz), nz10: Math.round(s10.nz),
    tong10: Math.round(s10.tong), yw10: Math.round(s10.yw), zm10: Math.round(s10.zm),
    atk10: Math.round(s10.atk), def10: Math.round(s10.def), sta10: Math.round(s10.sta) });
});
AOUT.sort(function (a, b) { return a.totalGold - b.totalGold; });
AOUT.forEach(function (o) {
  li(o.name + '（' + o.pieces + '件）：总金 ' + (o.totalGold / 1e4).toFixed(1) + '万'
    + '（打造 ' + (o.craftGold / 1e4).toFixed(1) + ' + 材料 ' + (o.matGold / 1e4).toFixed(1)
    + ' + 图纸 ' + (o.bpGold / 1e4).toFixed(1) + ' + 强化 ' + (o.enhGold / 1e4).toFixed(1) + '）'
    + ' · +10 净得: 内政' + o.nz10 + ' 统率' + o.tong10 + ' 勇武' + o.yw10 + ' 智谋' + o.zm10
    + ' 攻' + o.atk10 + ' 防' + o.def10 + ' 体力' + o.sta10);
});

/* ============================================================
 * B. 生产类宝物叠加与到期（神农锄 / 后稷神犁）
 * ============================================================ */
hr('B. 生产类宝物（prod_buff）叠加与到期实测');
function grainFactor() {
  var f = G.prodFactors('grain', city0);
  var prod = 1; var detail = [];
  f.forEach(function (x) { prod *= (1 + x.d); detail.push(x.name + '+' + Math.round(x.d * 100) + '%'); });
  return { mult: prod, detail: detail };
}
var before = grainFactor();
li('0 个宝物：产量因子 ×' + before.mult.toFixed(3) + '（' + before.detail.join('、') + '）');
st.res.gold = 500000000;   /* 5 亿金，够买测试量 */
GAME.ui._cityId = city0.id;
/* 买 10 个后稷神犁（+100% 粮/个，3,000 金/个）并用掉 */
var buy1 = G.doShopping('houji', 10);
li('购 10×后稷神犁：' + (buy1 && buy1.msg));
for (var i = 0; i < 10; i++) G.systems.useItem('houji', null);
var after10 = grainFactor();
li('用掉 10 个后：产量因子 ×' + after10.mult.toFixed(3) + '（增量 ' + (after10.mult - before.mult).toFixed(1) + '×）');
/* 推到 30 现实小时后复查（到期字段 prodUntil 是否被消费） */
simMs += 30 * 3600 * 1000;
var after30h = grainFactor();
li('SIM 时钟推进 30 现实小时后：×' + after30h.mult.toFixed(3) + ' —— ' + (Math.abs(after30h.mult - after10.mult) < 1e-9 ? '❌ 未到期（prodUntil 未被消费=死字段）' : '✅ 已到期'));
simMs -= 30 * 3600 * 1000;
/* 再叠 100 个，看有无封顶 */
G.doShopping('houji', 100);
for (var i2 = 0; i2 < 100; i2++) G.systems.useItem('houji', null);
var after110 = grainFactor();
li('再叠 100 个（共 110 个）：×' + after110.mult.toFixed(1) + ' —— 每 3,000 金 = +1.0 倍率，' + (after110.mult > 100 ? '❌ 无封顶' : '✅ 有封顶'));
/* 清理：把 buffs 清掉，避免污染后续 */
st.buffs.prod = {};

/* ============================================================
 * C. 符类（attr_buff）叠在守将身上：内政倍率与到期
 * ============================================================ */
hr('C. 符类叠 buff（守将内政）实测');
var gen = st.generals[0];
li('测试将：' + gen.name + '（' + G.rankOf(gen).name + '）基础内政 nz=' + G.genAttrs(gen).nz);
var nz0 = G.genAttrs(gen).nz;
['zhisu', 'anmin', 'xuande', 'wenquxing'].forEach(function (id) {
  var it = ITEM_BY_ID[id];
  G.doShopping(id, 1);
  var r = G.systems.useItem(id, gen.id);
  li('用「' + it.name + '」(' + it.desc + ')：' + (r && r.msg));
});
var nz1 = G.genAttrs(gen).nz;
li('叠完四符后 nz = ' + nz1 + '（×' + (nz1 / Math.max(1, nz0)).toFixed(3) + '）');
simMs += 25 * 3600 * 1000;
li('SIM 时钟推进 25 现实小时后 nz = ' + G.genAttrs(gen).nz + '（' + (G.genAttrs(gen).nz === nz0 ? '✅ 正常到期' : '❌ 未到期') + '）');
simMs -= 25 * 3600 * 1000;

/* ============================================================
 * C2. 徭役令：建造队列
 * ============================================================ */
hr('C2. 徭役令（建造队列）实测');
li('base buildSlots = ' + G.buildSlots(city0));
G.doShopping('corvee5', 1);
var rq = G.systems.useItem('corvee5', null);
li('用大役令（+5 队列/24h）：' + (rq && rq.msg) + ' → buildSlots = ' + G.buildSlots(city0));
simMs += 25 * 3600 * 1000;
li('25h 后 buildSlots = ' + G.buildSlots(city0) + '（' + (G.buildSlots(city0) <= 2 ? '✅ 正常到期' : '❌ 未到期') + '）');
simMs -= 25 * 3600 * 1000;

/* ============================================================
 * D. 真实装备穿戴 → 守将 nz → 单城产量（装备链证据）
 * ============================================================ */
hr('D. 装备穿戴对守将/产量的实际影响');
/* D1: 合成一个英杰级守将指标（用现有将 + 直接给满级属性近似？不——用真实穿脱对比） */
var testGen = null;
(st.generals || []).forEach(function (g) { if (!testGen) testGen = g; });
G.assignGeneral(testGen.id, 'guard', city0.id);
li('指派守将：' + testGen.name + '（guard of ' + city0.name + '）');
function guardProdOf() {
  var gb = G.guardBonus(city0);
  return { name: gb.name, prod: gb.prod, nz: G.genAttrs(G.guardGeneralOf(city0)).nz };
}
var gb0 = guardProdOf();
li('穿装前：守将 ' + gb0.name + ' nz=' + gb0.nz + ' → 产量加成 +' + Math.round(gb0.prod * 100) + '%');

/* 直接给满 倚天套 +10（走 addEquip + equipItem 真实路径） */
var ytIds = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; });
li('倚天套件数：' + ytIds.length + '（' + ytIds.map(function (i) { return DATA.EQUIP[i].name; }).slice(0, 4).join('/') + '…）');
ytIds.forEach(function (id) {
  var inst = G.addEquip(id, 10);        /* +10 实例 */
  var r = G.systems.equipItem(testGen.id, inst.u);
  if (!r.ok) li('  ！穿戴失败 ' + DATA.EQUIP[id].name + '：' + r.msg);
});
var gb1 = guardProdOf();
li('穿满倚天套+10 后：nz=' + gb1.nz + ' → 产量加成 +' + Math.round(gb1.prod * 100) + '%'
  + '（nz 增加 ' + (gb1.nz - gb0.nz) + '，产量乘数 ' + (1 + gb1.prod).toFixed(2) + '× vs ' + (1 + gb0.prod).toFixed(2) + '×）');
var sinfo = G.setProgressOf(testGen);
sinfo.forEach(function (s) { if (s.n >= 3) li('  套装进度：' + s.name + ' ' + s.n + '/' + s.total + ' 已达档 ' + JSON.stringify(s.reached)); });

/* D2: 同金对比 —— 40M 金花在「倚天套」vs「后稷神犁」的产量乘数 */
hr('D2. 同金对比（终局 4,000 万金的两种花法）');
var nzGain = gb1.nz - gb0.nz;
li('花法①装备：倚天套+10 全成本 ≈ ' + (AOUT.filter(function (o) { return o.set === 'yitian'; })[0].totalGold / 1e4).toFixed(0) + ' 万金 → 守将 nz +' + nzGain + ' → 产量乘数 +' + Math.round(gb1.prod - gb0.prod) * 100 * 0.01 + '（(1+' + gb1.prod.toFixed(2) + ')/(1+' + gb0.prod.toFixed(2) + ')=×' + ((1 + gb1.prod) / (1 + gb0.prod)).toFixed(3) + '）');
var unit = shopPrice('houji');
li('花法②宝物：4,000 万金 / ' + unit + ' 金每个后稷神犁 = ' + Math.round(40000000 / unit) + ' 个 → 粮产因子 +' + Math.round(40000000 / unit) + '.0（无上限）');
li('比值：' + ((40000000 / unit) / ((1 + gb1.prod) / (1 + gb0.prod) - 1)).toFixed(0) + ' 倍');

console.log('\n[probe_v8992 done]');
process.exit(0);
