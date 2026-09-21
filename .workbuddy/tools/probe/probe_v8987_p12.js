/* v89.87 探针：需求1（快购）+ 需求2（派兵统一走行军） */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
global.GAME.DATA.DEFAULT_SETTINGS.battleWatch = false;   /* 本探针不测观战 */

var G = global.GAME, U = G.utils, DATA = G.DATA;
var PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;
var c = st.cities[0];
var gen = st.generals[0];
gen.status = 'idle'; gen.cityId = c.id;

/* ============================================================
 * 一、需求1：快购
 * ============================================================ */
console.log('=== 需求1：就地快购 ===');
(function () {
  /* ① 单物品快购弹窗（锦囊） */
  st.res.gold = 100000;
  var before = st.items.jinang || 0;
  G.ui.openQuickBuy('jinang', 3);
  var qh = global.document.querySelector('#modal-root').innerHTML;
  ck('① 快购弹窗渲染（标题/单价/缺口/数量框）',
    qh.indexOf('快购') >= 0 && qh.indexOf('锦囊') >= 0 && qh.indexOf('qb-qty') >= 0
    && qh.indexOf('缺 3') >= 0, '缺口显示 ' + (qh.indexOf('缺 3') >= 0));
  G.ui.closeModal();

  /* ② 购买出口（doShopping 直购：扣金 + 入包） */
  var r = G.doShopping('jinang', 2);
  ck('② 快购走商城同一出口（doShopping）',
    r.ok === true && (st.items.jinang || 0) === before + 2 && st.res.gold < 100000,
    r.msg + ' · 金 ' + U.fmt(st.res.gold));

  /* ③ 品类快购（加速） */
  G.ui.openQuickCat('boost');
  var ch = global.document.querySelector('#modal-root').innerHTML;
  var boostN = (DATA.ITEMS || []).filter(function (x) { return x.price > 0 && x.type === 'boost'; }).length;
  ck('③ 品类快购渲染（boost 全部在列）',
    ch.indexOf('快购') >= 0 && (ch.match(/qb-cat-buy/g) || []).length === boostN,
    boostN + ' 项');
  G.ui.closeModal();

  /* ④ 种子开售（页签 + 可购 + 弹窗） */
  var seedOnSale = G.ui.shopItems().some(function (it) { return it.type === 'seed'; });
  ck('④ 种子开售（页签 + 商城可见）', seedOnSale && !!G.ui.SHOP_CATS.seed);
  G.ui.openQuickBuy('seed_fan', 2);
  var sh = global.document.querySelector('#modal-root').innerHTML;
  ck('④ 种子快购弹窗（凡植种子）', sh.indexOf('凡植种子') >= 0);
  G.ui.closeModal();

  /* ⑤ 不可购物品被拒（灵气精华 price=0） */
  var rej = false;
  G.ui.openQuickBuy('lingsui', 1);
  rej = !G.ui.modalVisible() || global.document.querySelector('#modal-root').innerHTML.indexOf('快购') < 0;
  ck('⑤ 非卖品快购被拒（灵气精华 price=0）', rej);
  G.ui.closeModal();
})();

/* ============================================================
 * 二、需求2：派兵统一走行军
 * ============================================================ */
console.log('=== 需求2：派兵统一走行军通道 ===');

/* ① 调兵（owncity） */
(function () {
  var c2 = G.makeCity({ id: 'p12b', name: '副城', x: c.x + 3, y: c.y + 3 });
  st.cities.push(c2);
  c.army = { yibing: 500 };
  st.marches = [];
  var tt = G.doTransferTroops(c.id, c2.id, { yibing: 300 }, gen.id);
  ck('① 调兵出发（入队 + 扣兵 + 未入城）',
    tt.ok && st.marches.length === 1 && c.army.yibing === 200 && (c2.army.yibing || 0) === 0,
    tt.msg);
  var m = st.marches[0];
  ck('① 行军方式 = 调兵（mode 实名）', m.modeId === 'transfer', m.modeId);
  m.elapsed = m.totalTime; G.march.tick();
  ck('① 抵达入城（+300）+ 将领随军（cityId 变更）',
    (c2.army.yibing || 0) === 300 && gen.cityId === c2.id && gen.status === 'idle',
    '副城 ' + (c2.army.yibing || 0) + ' · gen@' + gen.cityId);
  /* 把将调回来（后续用） */
  gen.cityId = c.id;
})();

/* ② 野地驻守 */
(function () {
  var wt = null;
  for (var dy = 5; dy <= 9 && !wt; dy++) for (var dx = 5; dx <= 9 && !wt; dx++) {
    var tl = G.map.tile(c.x + dx, c.y + dy);
    if (tl && tl.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) {
      wt = { x: c.x + dx, y: c.y + dy, t: tl.terrain };
    }
  }
  st.wilds = st.wilds || [];
  st.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 5, day: 0, startDay: 0 });
  c.army = { yibing: 400 };
  st.marches = [];
  var r = G.doWildGarrison(wt.x, wt.y, { yibing: 400 }, c.id, gen.id);
  ck('② 驻守出发（入队 + mode=station）',
    r.ok && st.marches.length === 1 && st.marches[0].modeId === 'station', r.msg);
  var m = st.marches[0];
  m.elapsed = m.totalTime; G.march.tick();
  var gar = G.map.wildAt(wt.x, wt.y).garrison;
  ck('② 抵达入驻野地（garrison 写入）', !!(gar && gar.troops && gar.troops.yibing === 400),
    JSON.stringify((gar || {}).troops || null));
  /* 撤回：兵归城 */
  var wr = G.doWildWithdraw(wt.x, wt.y, c.id);
  ck('② 撤回（兵归城）', wr.ok && (c.army.yibing || 0) === 400, wr.msg);
})();

/* ③ 采集 */
(function () {
  var wt = null;
  for (var dy = 12; dy <= 16 && !wt; dy++) for (var dx = 12; dx <= 16 && !wt; dx++) {
    var tl = G.map.tile(c.x + dx, c.y + dy);
    if (tl && tl.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) {
      wt = { x: c.x + dx, y: c.y + dy, t: tl.terrain };
    }
  }
  st.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 3, day: 0, startDay: 0 });
  gen.status = 'idle';
  c.army = { yibing: 300 };
  st.marches = [];
  var r = G.dispatchGather(wt.x, wt.y, gen.id, { yibing: 100 });
  ck('③ 采集出发（入队 + mode=gather + 扣兵）',
    r.ok && st.marches.length === 1 && st.marches[0].modeId === 'gather' && c.army.yibing === 200, r.msg);
  var m = st.marches[0];
  m.elapsed = m.totalTime; G.march.tick();
  var rec = G.gatherAt(wt.x, wt.y);
  ck('③ 抵达成队（采集记录 + 将领进入采集态）',
    !!rec && rec.troops === 100 && gen.status === 'gather', rec ? ('troops ' + rec.troops) : '无');

  /* ④ 行军中召回（通用召回：兵归城、将回空闲） */
  gen.status = 'idle';
  c.army = { yibing: 200 };
  var w2 = null;
  for (var dy2 = 18; dy2 <= 20 && !w2; dy2++) for (var dx2 = 18; dx2 <= 20 && !w2; dx2++) {
    var tl2 = G.map.tile(c.x + dx2, c.y + dy2);
    if (tl2 && tl2.terrain !== 'city' && !G.map.wildAt(c.x + dx2, c.y + dy2)) {
      w2 = { x: c.x + dx2, y: c.y + dy2, t: tl2.terrain };
    }
  }
  st.wilds.push({ x: w2.x, y: w2.y, type: w2.t, level: 3, day: 0, startDay: 0 });
  st.marches = [];
  G.doWildGarrison(w2.x, w2.y, { yibing: 150 }, c.id, gen.id);
  var m2 = st.marches[0];
  var rc = G.march.recall(m2.id);
  ck('④ 行军召回（兵归城 · 未抵达不入驻）',
    rc.ok && c.army.yibing === 200 && !G.map.wildAt(w2.x, w2.y).garrison && gen.status === 'idle',
    rc.msg);
})();

/* ⑤ 军务总览：行军段覆盖三类（源码级口径） */
(function () {
  var uiSrc = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
  ck('⑤ 军务总览行军段为全境口径（三类可见）',
    /var list = \(s\.marches \|\| \[\]\)\.slice\(\);/.test(uiSrc));
  var mSrc = fs.readFileSync(path.join(R, 'js', 'main.js'), 'utf8');
  ck('⑤ UI 入口接线（tm-do/wild-garrison-do/gather-start 都带将领）',
    /doTransferTroops\(from\.id, tid, army, genId\)/.test(uiSrc)
    && /doWildGarrison\(xy\.x, xy\.y, army, c\.id, genId\)/.test(mSrc)
    && /dispatchGather\(xy\.x, xy\.y, genId, army\)/.test(mSrc));
})();

G.ui.closeModal();
console.log('');
console.log('探针结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
