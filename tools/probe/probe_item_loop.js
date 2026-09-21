/* ============================================================
 * 探针：物品「产生 ↔ 消耗」闭环核验（v89.51）
 * ------------------------------------------------------------
 * 老板的要求：「物品的产生和消耗路径打通了，别买了用不了」。
 * 本探针对 DATA.ITEMS 全量逐件交叉核验五张表：
 *   ① 获取端：商城在售 / 宝箱池 / 侦察池 / 采集池 / 种子掉落 / 任务奖励 / 秘境收获
 *   ② 消耗端：useItem 分支 / 铁匠铺（材料·图纸）/ 计谋（锦囊）/ 秘境播种（种子）
 *   ③ 商城页签（ui.SHOP_CATS）—— 不在页签里 = 玩家看不见 = 买不到
 *   ④ 背包宝物页分组（ui.bagItemHTML 的 CN）—— 不在 CN 里 = 持有也看不见 = 用不了
 *   ⑤ 图标（GAME.itemIcon / icons.TYPE_KEY / bitmaps 注册）
 * 用法：node tools/probe/probe_item_loop.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..', '..');

/* ---- 最小环境（data.js 需要 window） ---- */
global.window = global;
global.localStorage = { _d: {}, getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
require(path.join(ROOT, 'js', 'data.js'));
var D = (global.GAME && global.GAME.DATA) || global.DATA;

function src(f) { return fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'); }
var S = { systems: src('systems.js'), ui: src('ui.js'), battle: src('battle.js'), domain: src('domain.js'), icons: src('icons.js') };

/* ---- ① 从源码抽表（保证探针与代码同源，不靠手抄） ---- */
function blockKeys(text, anchor, openRe, closeRe) {
  var i = text.indexOf(anchor);
  if (i < 0) return [];
  var seg = text.slice(i, i + 4000);
  var end = seg.search(closeRe);
  if (end > 0) seg = seg.slice(0, end);
  var out = [], m;
  var re = new RegExp(openRe, 'g');
  while ((m = re.exec(seg))) out.push(m[1]);
  return out;
}
var SHOP_CATS = blockKeys(S.ui, 'ui.SHOP_CATS = {', '(\\w+)\\s*:', '\\n  \\};');
/* 背包宝物页分组表：v89.51 起提为出口常量 ui.BAG_ITEM_CN（锚点随之更新） */
var BAG_CN = blockKeys(S.ui, 'ui.BAG_ITEM_CN = {', '(\\w+)\\s*:', '\\n  \\};');
var ICON_EMOJI = blockKeys(S.ui, 'GAME.itemIcon = function', '(\\w+)\\s*:', '\\n    \\};');
var TYPE_KEY = blockKeys(S.icons, 'var TYPE_KEY = {', '(\\w+)\\s*:', '\\n  \\};');
var USE_BRANCH = (function () {
  var i = S.systems.indexOf('S.useItem = function');
  /* ⚠ 切片终点必须锚在**函数定义**上：useItem 体内有一句注释提到 `S._openChest`，
     用它当终点会在注释处提前截断 —— 漏掉 neigong / corvee 两条真分支（本探针踩过）。 */
  var j = S.systems.indexOf('\n  S._openChest = function', i);
  var seg = S.systems.slice(i, j > 0 ? j : i + 9000);
  var out = [], m, re = /item\.type === '(\w+)'/g;
  while ((m = re.exec(seg))) out.push(m[1]);
  return out;
})();
/* 宝箱里硬编码 id（比如 s.items.corvee） */
var CHEST_HARD_IDS = (function () {
  var i = S.systems.indexOf('S._openChest');
  var seg = S.systems.slice(i, i + 4200);
  var out = [], m, re = /s\.items\.(\w+)\s*=/g;
  while ((m = re.exec(seg))) out.push(m[1]);
  return out;
})();
/* 计谋消耗的锦囊 id（schemeUse 里的 s.items.jinang） */
var SCHEME_ITEM_IDS = (function () {
  var i = src('state.js').indexOf('GAME.schemeUse');
  var seg = src('state.js').slice(i, i + 900);
  var out = [], m, re = /s\.items\.(\w+)/g;
  while ((m = re.exec(seg))) out.push(m[1]);
  return out;
})();

/* ---- ② 获取端（按源码过滤条件复刻，注释标出处） ---- */
var ITEMS = D.ITEMS || [], MATERIALS = D.MATERIALS || [];
var byId = {}; ITEMS.forEach(function (x) { byId[x.id] = x; });
var matIds = {}; MATERIALS.forEach(function (m) { matIds[m.id] = true; });

function acq(it) {
  var a = [];
  if (it.price > 0 && SHOP_CATS.indexOf(it.type) >= 0) a.push('商城');
  /* systems.S._openChest：珠宝 35/50/60% · 材料 50/60/75% · 图纸(t3) 10% · 徭役令(t3) 8% */
  if (it.type === 'jewel') a.push('宝箱');
  if (it.type === 'material' && matIds[it.id]) a.push('宝箱');
  if (it.type === 'blueprint') a.push('宝箱');
  if (CHEST_HARD_IDS.indexOf(it.id) >= 0) a.push('宝箱');
  /* battle 侦察池：price>0 且 非 material/blueprint 且 price<=40（battle.js ~846） */
  if (it.price > 0 && it.type !== 'material' && it.type !== 'blueprint' && it.price <= 40) a.push('侦察');
  /* domain 采集池：同上 + 非 seed，且 price<=G.treasureMaxPrice（=DATA.EXPEDITION.treasureMaxPrice 40） */
  if (it.price > 0 && it.type !== 'material' && it.type !== 'blueprint'
    && it.type !== 'seed' && it.price <= 40) a.push('采集*');
  return a;
}
/* 种子：GAME.grantSeedDrop（采集归来 / 出征缴获）；灵气精华：GAME.grantEssenceDrop（同两条） */
var SEED_IDS = ITEMS.filter(function (x) { return x.type === 'seed'; }).map(function (x) { return x.id; });
/* 灵草：秘境收获（herb） */
var FARM_HERBS = (D.FARM && D.FARM.CROPS ? D.FARM.CROPS : []).map(function (c) { return c.herb; }).filter(Boolean);
var CN_ACQ = { seed: '采集/缴获', rank_up: '秘境收获', essence: '采集/缴获' };

/* ---- ③ 消耗端 ---- */
var SPECIAL_CONSUMER = {
  material: '铁匠铺锻造', blueprint: '铁匠铺解锁（图纸）',
  talis: '计谋施展（schemeUse 扣 ' + SCHEME_ITEM_IDS.join('/') + '）',
  seed: '秘境播种（farm）',
  essence: '蕴养（domain.lingTemper 扣 lingsui）',
};
function consumer(t) {
  if (USE_BRANCH.indexOf(t) >= 0) return 'useItem';
  return SPECIAL_CONSUMER[t] || null;
}

/* ---- ④ 逐件核验 ---- */
var types = {};
ITEMS.forEach(function (x) { (types[x.type] = types[x.type] || []).push(x); });
var report = [], violations = { V1: [], V2: [], V3: [], V4: [], V5: [] };
Object.keys(types).sort().forEach(function (t) {
  var arr = types[t];
  var priceMin = Math.min.apply(null, arr.map(function (x) { return x.price || 0; }));
  var priceMax = Math.max.apply(null, arr.map(function (x) { return x.price || 0; }));
  var row = {
    type: t, n: arr.length, price: priceMin === priceMax ? priceMin : priceMin + '~' + priceMax,
    shop: SHOP_CATS.indexOf(t) >= 0, bag: BAG_CN.indexOf(t) >= 0,
    use: USE_BRANCH.indexOf(t) >= 0, consumer: consumer(t) || '⚠ 无',
    acq: (function () {
      var a = acq(arr[0]);
      var extra = CN_ACQ[t];
      if (extra && a.indexOf(extra) < 0) a.push(extra);
      return a.join('/') || '⚠ 无';
    })(),
    /* 图标口径：itemIcon（emoji）· TYPE_KEY（矢量）· 材料走 forMat 专属口 */
    icon: (ICON_EMOJI.indexOf(t) >= 0 || TYPE_KEY.indexOf(t) >= 0 || t === 'material') ? 'yes' : '⚠ 兜底',
  };
  report.push(row);
  /* V1 无消耗端 = 死物品 */
  if (!row.consumer || row.consumer === '⚠ 无') violations.V1.push(t + '（' + arr.length + ' 件）');
  /* V2 有价无市：price>0 但商城里看不见（不在页签），也无法通过掉落获取 */
  arr.forEach(function (x) {
    if ((x.price || 0) > 0 && SHOP_CATS.indexOf(t) < 0 && !CN_ACQ[t] && acq(x).length === 0) {
      violations.V2.push(x.id + '（' + x.name + ' · ' + t + '）');
    }
  });
  /* V3 背包不可见：不在 CN 且不是 material/blueprint（两者有专属页签） */
  if (BAG_CN.indexOf(t) < 0 && t !== 'material' && t !== 'blueprint') {
    violations.V3.push(t + '（' + arr.length + ' 件）');
  }
  /* V5 图标兜底 */
  if (row.icon !== 'yes') violations.V5.push(t);
});
/* V4 悬空 id 引用：宝箱硬编码 id / 计谋需求 id / 各任务奖励 / 秘境 herb */
CHEST_HARD_IDS.concat(SCHEME_ITEM_IDS).forEach(function (id) {
  if (!byId[id] && !matIds[id]) violations.V4.push('硬编码 id 不存在：' + id);
});
['QUESTS', 'RANDOM_QUESTS'].forEach(function (tab) {
  ((D[tab] || [])).forEach(function (q) {
    Object.keys(q.reward || {}).forEach(function (k) {
      if (k === 'rep') return;
      if (matIds[k]) return;
      if ((D.RESOURCES || []).some(function (r) { return r.key === k; })) return;
      if (!byId[k]) violations.V4.push(tab + '「' + (q.title || q.id) + '」奖励 id 不存在：' + k);
    });
  });
});
FARM_HERBS.forEach(function (h) { if (!byId[h]) violations.V4.push('秘境 herb 不存在：' + h); });

/* ---- ⑤ 输出 ---- */
var L = [];
L.push('物品闭环核验 · ITEMS 共 ' + ITEMS.length + ' 件 · 材料 ' + MATERIALS.length + ' 件 · 类型 ' + Object.keys(types).length + ' 类');
L.push('');
L.push('类型           件数  价格      商城  背包  使用  获取端                消耗端');
report.forEach(function (r) {
  L.push([r.type.padEnd(13), String(r.n).padStart(3), String(r.price).padStart(9),
    (r.shop ? ' ✓  ' : ' ✗  '), (r.bag ? ' ✓  ' : ' ✗  '), (r.use ? ' ✓  ' : ' ✗  '),
    ' ' + String(r.acq).padEnd(20), r.consumer + (r.icon === 'yes' ? '' : '   [图标' + r.icon + ']')].join(' '));
});
L.push('');
['V1', 'V2', 'V3', 'V4', 'V5'].forEach(function (k) {
  var title = { V1: 'V1 无消耗端（死物品）', V2: 'V2 有价无市（price>0 但买不到也无掉落）', V3: 'V3 背包不可见（持有却看不到）', V4: 'V4 悬空 id 引用', V5: 'V5 图标走兜底' }[k];
  L.push('【' + title + '】' + (violations[k].length ? '  ' + violations[k].length + ' 处' : '  无'));
  violations[k].forEach(function (v) { L.push('   - ' + v); });
});
var txt = L.join('\n');
console.log(txt);
console.log('\nSUMMARY ' + JSON.stringify({ V1: violations.V1.length, V2: violations.V2.length, V3: violations.V3.length, V4: violations.V4.length, V5: violations.V5.length }));
