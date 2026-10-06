/* ============================================================
 * probe_v8993_behavior.js — v89.93 整改行为核验（自写盘，避免控制台编码问题）
 * 逐项验证：W1 生产宝物流到期+取最强 · W2 符类取最强 · W3 内政封顶 ·
 *           E8 队列 3 格 · E9 出征轮换 · E10 待阅不丢 · E11 度支 · E12 新城模板 ·
 *           E4 音效/通知 API · E5 演出 API
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];
function ck(name, cond, extra) { OUT.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); }

var simMs = Date.UTC(2026, 8, 22, 1, 0, 0);
Date.now = function () { return simMs; };
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
fs.readdirSync(R + 'story').filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(R + 'story/' + f); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var city0 = st.cities[0];
G.ui = G.ui || {}; G.ui._cityId = city0.id;
st.res.gold = 5e7;

/* ---- W1：生产宝物（取最强 + 到期真消费） ---- */
(function () {
  st.items = {}; st.buffs = { gens: {} };
  st.items.houji = 3;
  G.systems.useItem('houji', null);
  var f1 = G.prodBuffMult().grain || 0;
  var r2 = G.systems.useItem('houji', null);
  var f2 = G.prodBuffMult().grain || 0;
  ck('W1-1 生产宝物只取最强（不累加）', Math.abs(f1 - 1) < 1e-9 && Math.abs(f2 - 1) < 1e-9,
    '第1个=' + f1 + '（' + (r2.msg || '').slice(0, 20) + '）');
  /* 弱符不覆盖强符 */
  st.items.shennongling = 1;
  G.systems.useItem('shennongling', null);       /* +50% < 已有的 +100% */
  ck('W1-2 更弱的同级宝物只刷时长（不降级）', Math.abs((G.prodBuffMult().grain || 0) - 1) < 1e-9);
  /* 到期真消费：把 prodUntil 拨到过去 */
  st.buffs.prodUntil.grain = Date.now() - 1000;
  ck('W1-3 到期后真失效（prodUntil 被消费）', !(G.prodBuffMult().grain > 0));
  ck('W1-4 buffActive(prod) 与到期同步', G.systems.buffActive('prod') === false);
})();

/* ---- W2：符类取最强（同属性不叠乘） ---- */
(function () {
  var g = { id: 'p93', level: 1, tong: 100, nz: 1000, yw: 100, zm: 100, speed: 10,
    attack: 10, defense: 10, exp: 0, rank: 'ying', style: 'balance', perm: {}, equip: {} };
  st.generals.push(g);
  st.buffs = { gens: {}, prod: {}, prodUntil: {} };
  var base = G.genAttrs(g).nz;
  ['zhisu', 'anmin', 'xuande', 'wenquxing'].forEach(function (id) { st.items = {}; st.items[id] = 1; G.systems.useItem(id, g.id); });
  var after = G.genAttrs(g).nz;
  ck('W2 四张内政符只取最强（×2.0，不叠成 ×6.56）', after === base * 2,
    base + ' → ' + after + '（期望 ' + (base * 2) + '）');
  st.generals.pop();
})();

/* ---- W3：守将内政 → 产量封顶 150% ---- */
(function () {
  var g = st.generals[0];
  G.assignGeneral(g.id, 'idle', null);
  g.status = 'guard'; g.cityId = city0.id; g.nz = 5000;
  var gb = G.guardBonus(city0);
  ck('W3 产量加成封顶 +150%', Math.abs(gb.prod - 1.5) < 1e-9, 'nz=5000 → ' + gb.prod);
  ck('W3 建造加成同封顶（口径统一）', Math.abs(gb.build - 1.5) < 1e-9, 'build=' + gb.build);
  g.nz = 90; g.status = 'idle'; g.cityId = null;
})();

/* ---- E8：建造队列 3 格 ---- */
ck('E8 建造槽位基础 3 格', G.buildSlots(city0) === 3, '当前 = ' + G.buildSlots(city0));

/* ---- E9：自动出征轮换（轮空池） ---- */
(function () {
  var cfg = G.autoMarchCfg();
  cfg.ring = [];
  var t1 = { kind: 'wild', x: 361, y: 247, lv: 1 };
  G.autoMarchRingPush(cfg, t1);
  ck('E9-1 目标入轮空池', G.autoMarchRingHas(cfg, t1) === true && (cfg.ring || []).length === 1);
  /* 池满后先进先出 */
  for (var i = 0; i < 8; i++) G.autoMarchRingPush(cfg, { x: 100 + i, y: 100 });
  ck('E9-2 轮空池只留最近 ' + G.autoMarchRingSize() + ' 个', (cfg.ring || []).length === G.autoMarchRingSize());
  ck('E9-3 老目标已滚出池子', G.autoMarchRingHas(cfg, t1) === false);
  cfg.ring = [];
})();

/* ---- E10：待阅超限进「往事」而不是丢掉 ---- */
(function () {
  st.sgPending = []; st.sgArchived = [];
  var sids = G.SG.list().map(function (x) { return x.id; });
  sids.slice(0, 3).forEach(function (id) { G.SG.defer(id); });
  ck('E10-1 正常入待阅', st.sgPending.length === 3 && st.sgArchived.length === 0);
  st.sgPending = [];
  for (var i = 0; i < G.SG.PENDING_CAP; i++) st.sgPending.push({ sid: 'x' + i, title: 'x', at: 0 });
  G.SG.defer(sids[sids.length - 1]);
  ck('E10-2 超限折入往事（不再丢最旧）',
    st.sgPending.length === G.SG.PENDING_CAP && st.sgArchived.length === 1 && st.sgArchived[0].sid === 'x0');
  st.sgPending = []; st.sgArchived = [];
})();

/* ---- E11：度支归集 ---- */
(function () {
  var c2 = G.makeCity({ id: 'newT', name: '新城T', x: 300, y: 300, type: 'self' });
  st.cities.push(c2);
  G.res(c2).gold = 800000;
  var before = G.res(city0).gold;
  var r = G.budgetGather(city0.id);
  var moved = G.res(city0).gold - before;
  ck('E11-1 度支归集把结余汇入目标城', r.ok === true && moved === 800000 - G.budgetKeep,
    '移入 ' + moved + '（保留 ' + G.budgetKeep + '）');
  ck('E11-2 源城保留线生效', G.res(c2).gold === G.budgetKeep, '源城余 ' + G.res(c2).gold);
  st.cities.pop();
})();

/* ---- E12：新城开发模板 ---- */
(function () {
  var c3 = G.makeCity({ id: 'newT2', name: '新城T2', x: 301, y: 301, type: 'self', initialExt: 'new' });
  var used = (c3.extGrid || []).filter(function (e) { return !!e.type; }).length;
  ck('E12 新城预置 6 块城外资源地', used === (DATA.NEW_CITY_EXT || []).length && used === 6, '预置 ' + used + ' 块');
  var c4 = G.makeCity({ id: 'plain', name: '空城', x: 302, y: 302, type: 'self' });
  ck('E12-2 未指定模板仍为空（攻占城不受影响）', (c4.extGrid || []).every(function (e) { return !e.type; }));
})();

/* ---- E4：反馈层 API ---- */
(function () {
  ck('E4-1 音效 API 齐备（13 键 10 音）', !!(G.audio && G.audio.play) && G.audio.keys().length === 10, G.audio.keys().join(','));
  ck('E4-2 无 AudioContext 时静默降级（不抛错）', G.audio.play('win') === false);
  ck('E4-3 通知四型 + toast 兼容别名', typeof G.ui.notify === 'function' && typeof G.ui.toast === 'function');
  G.ui.notify('warn', '测试警告');
  ck('E4-4 通知写入 #toast 容器', (document.querySelector('#toast').innerHTML || '').indexOf('t-warn') >= 0);
  ck('E4-5 取值浮字 API', typeof G.ui.floatGain === 'function');
})();

/* ---- E5：里程碑演出 API ---- */
(function () {
  ck('E5 演出层 API（三档）', typeof G.ui.moment === 'function' && typeof G.ui.momentClose === 'function');
  G.ui.moment({ kind: 'card', icon: 'T', title: '测试', sub: 's', lines: ['l'] });
  var fx = document.getElementById('moment-fx');
  ck('E5-2 卡片档渲染并挂类', (fx.className || '').indexOf('mo-card') >= 0 && (fx.innerHTML || '').indexOf('测试') >= 0);
  G.ui.moment({ kind: 'inline', title: '横幅' });
  ck('E5-3 横幅档可渲染', (fx.className || '').indexOf('mo-inline') >= 0);
  G.ui.momentClose();
  ck('E5-4 关闭清空', (fx.className || '') === '' && (fx.innerHTML || '') === '');
})();

/* ---- U4：种子文案与在售一致 ---- */
(function () {
  var seeds = (DATA.ITEMS || []).filter(function (x) { return x.type === 'seed'; });
  var allShop = seeds.every(function (x) { return x.price > 0 && x.desc.indexOf('商城') >= 0; });
  ck('U4 五种子在售且文案写明商城来源', seeds.length === 5 && allShop);
})();

var fail = OUT.filter(function (l) { return l.indexOf('FAIL') === 0; }).length;
OUT.push('');
OUT.push('合计：' + (OUT.length - 2) + ' 项 · 失败 ' + fail);
fs.writeFileSync(R + '.workbuddy/tmp/probe_v8993_behavior.txt', OUT.join('\n'), 'utf8');
process.exit(0);
