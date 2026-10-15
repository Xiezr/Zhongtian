/* v89.170 经验曲线取证探针：老板「前期太低 / 24万金兵仙遗篇直升一百多级」
   算清四组账：① 当前曲线全表 ② 道具族的效果（含金价） ③ 典型战斗 raw ④ 练功/侦察/采集 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var P = function (n, ok, ex) { console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : '')); };

console.log('=== ① 当前经验曲线（DATA.EXP_CURVE）===');
var C = DATA.EXP_CURVE;
console.log('  topLv=' + C.topLv + ' alpha=' + C.alpha + ' needTop=' + C.needTop);
console.log('  total = ' + C.total + '（' + (C.total / 1e8).toFixed(4) + ' 亿）');
function need(lv) { return G.expNeedOf({ level: lv }); }
var cum = 0, cums = {};
for (var lv = 1; lv <= 240; lv++) { cums[lv] = (cums[lv - 1] || 0) + need(lv); if (lv === 240) cum = cums[lv]; }
console.log('  Σneed(1..240) = ' + cum + '（对照 C.total = ' + C.total + '）');
console.log('  lv      need        cum          cum/total');
[1, 10, 20, 30, 31, 40, 60, 80, 100, 120, 150, 180, 200, 220, 240].forEach(function (l) {
  console.log('  Lv' + String(l).padStart(3) + '  ' + String(need(l)).padStart(10) + '  '
    + String(Math.round(cums[l])).padStart(11) + '  ' + (cums[l] / C.total * 100).toFixed(3) + '%');
});

console.log('\n=== ② 「从 Lv1 用一份道具升到几级」===');
function lvAfter(exp) {
  var l = 1, e = exp;
  while (l < 240) { var nd = need(l); if (e < nd) break; e -= nd; l++; }
  return l;
}
DATA.EXP_ITEM_SPEC.forEach(function (sp) {
  var it = null;
  DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
  if (!it) return;
  var noShop = it.noShop ? '（下架）' : '';
  console.log('  ' + it.name + noShop + '  内部价 ' + it.price + ' → 商城 ' + (it.price * 100)
    + ' 金  amount=' + it.amount + ' → 从Lv1升到 Lv' + lvAfter(it.amount)
    + '（占整条曲线 ' + (sp.pct * 100).toFixed(2) + '%）');
});

console.log('\n=== ③ 典型战斗的 raw 经验（歼灭资源/1000×2）===');
function rawOf(army) { return Math.round(G.battle.armyResourceValue(army) / 1000) * 2; }
function valOf(army) { return G.battle.armyResourceValue(army); }
var samples = [
  ['小型遭遇（义兵 2000）', { yibing: 2000 }],
  ['Lv5 野地守军级（杂兵 5000）', { yibing: 3000, changqiang: 1500, gongjian: 500 }],
  ['Lv8 野地守军级（兵 1.5 万）', { yibing: 6000, changqiang: 5000, daodun: 2500, gongjian: 1500 }],
  ['县城守军级（兵 3 万 + 器械）', { yibing: 8000, changqiang: 8000, daodun: 6000, gongjian: 5000, qingji: 2000, chuangnu: 500 }],
  ['州城守军级（兵 8 万）', { yibing: 20000, changqiang: 20000, daodun: 15000, gongjian: 15000, qingji: 5000, tieji: 3000, chuangnu: 1500 }],
];
samples.forEach(function (s) {
  var v = valOf(s[1]);
  console.log('  ' + s[0] + '：资源价值 ' + (v / 10000).toFixed(1) + ' 万 → raw = ' + rawOf(s[1]) + ' 经验');
});
console.log('  —— 真战场规模：一场战斗涨多少级（gain = min(raw, 0.8×need)）——');
[
  ['小遭遇 raw 1560', 1560],
  ['Lv8 野地 raw 25580', 25580],
  ['县城级 raw 81040', 81040],
  ['州城级 raw 270500', 270500],
].forEach(function (sc) {
  var parts = [];
  [10, 30, 60, 100, 150, 200].forEach(function (l) {
    var nd = need(l), cap = Math.round(nd * 0.8);
    var gain = Math.min(sc[1], cap);
    parts.push('Lv' + l + ':' + (gain / nd * 100).toFixed(0) + '%');
  });
  console.log('  ' + sc[0] + ' → ' + parts.join(' · '));
});
console.log('  （对照旧曲线：县城级在 Lv1~177 全程 0.8 级/场 → 现在覆盖到 ~Lv38）');

console.log('\n=== ④ 其它经验来源（现状）===');
console.log('  练功：本级需求 ×10% = 每练一次恒定 0.10 级（相对口径，随曲线自动走）');
console.log('  侦察：固定 30 经验');
console.log('  采集归来：收获量/500 + 20 经验（绝对口径）');
console.log('  攻占城池/野地/守城：同 ③ 的战斗 raw 口径，封顶 0.8 级');

console.log('\n=== ⑤ 线性参照（"从 Lv1 的 need 到 Lv240 的 100 万"的直线）===');
console.log('  线性 = need(1) + (1000000 - need(1)) × (lv-1)/239');
var n1 = need(1);
[30, 60, 100, 150, 200, 240].forEach(function (l) {
  var lin = n1 + (1000000 - n1) * (l - 1) / 239;
  console.log('  Lv' + l + '：线性 ' + Math.round(lin) + ' vs 曲线 ' + need(l)
    + '（曲线/线性 = ' + (need(l) / lin * 100).toFixed(1) + '%）');
});

console.log('\n=== ⑥ 资质等级上限（对照：道具直升的"终点"）===');
DATA.GEN_RANKS.forEach(function (r) {
  console.log('  ' + r.name + ' 上限 Lv' + r.lvCap + '（' + (r.lvCap) + '）');
});
console.log('\n=== ⑦ 金价锚（对照 24 万金的购买力）===');
var gold = [['爵位晋升（顶级）', 0], ['校场扩容', 0]];
console.log('  兵仙遗篇 = ' + (14000 * 100 / 10000) + ' 万金（改前 was 价）→ 现 ' + (2400 * 100 / 10000) + ' 万金');
console.log('\n=== ⑧ 形状守卫：全程低于线性（起点→锚点的直线）· 单调 · 凸性 ===');
(function () {
  var n1 = need(1), nT = need(240);
  var lin = function (lv) { return n1 + (nT - n1) * (lv - 1) / 239; };
  var under = true, worst = 0, worstLv = 0;
  for (var lv = 2; lv <= 239; lv++) {
    var r = need(lv) / lin(lv);
    if (r >= 1) under = false;
    if (r > worst) { worst = r; worstLv = lv; }
  }
  console.log('  全程低于线性 = ' + under + ' · 最高贴合点 = Lv' + worstLv + ' 处占直线 ' + (worst * 100).toFixed(1) + '%');
  var mono = true, prevRatio = 1e9, conv = true;
  for (var lv2 = 2; lv2 <= 240; lv2++) {
    var a = need(lv2), b = need(lv2 - 1);
    if (a < b) mono = false;
    var rr = a / b;
    if (rr > prevRatio + 1e-12) conv = false;      /* 涨幅比值递减 = 凸性 */
    prevRatio = rr;
  }
  console.log('  逐级单调 = ' + mono + ' · 相邻涨幅比值递减（凸性/无断层）= ' + conv);
  console.log('  Lv1→2 涨幅 = ' + (need(2) / need(1)).toFixed(3) + ' · Lv239→240 = ' + (need(240) / need(239)).toFixed(4));
})();
console.log('\n=== ⑨ 核心验收：兵仙遗篇不再「一步登天」 ===');
(function () {
  var it = null;
  DATA.ITEMS.forEach(function (x) { if (x.id === 'bingxian_yipian') it = x; });
  var lv = lvAfter(it.amount);
  console.log('  兵仙遗篇（24 万金）：从 Lv1 升到 Lv' + lv + '（旧口径 177）');
  P('★ 兵仙遗篇 ≤ Lv90（老板报的"直升一百多级"已消除）', lv <= 90, 'Lv' + lv);
  var bs = null;
  DATA.ITEMS.forEach(function (x) { if (x.id === 'bingsheng') bs = x; });
  console.log('  千古兵圣（40 万金）：从 Lv1 升到 Lv' + lvAfter(bs.amount) + '（旧口径 196）');
  var cum100 = 0; for (var i = 1; i <= 100; i++) cum100 += need(i);
  console.log('  前 100 级累计占比 = ' + (cum100 / C.total * 100).toFixed(2) + '%（旧口径 0.59%）');
  P('★ 前 100 级累计占比 ≥ 10%（升级体验从"最后 40 级"回到前中段）', cum100 / C.total >= 0.10);
})();
process.exit(0);
