/* v89.171 经验道具「基于什么考虑 + 后边纯买道具」取证探针
 * ------------------------------------------------------------
 * 改前实证：
 *   ① 现口径（v89.73 起）= 占**全曲线总量**的百分比（pct）取额（曲线一改自动跟随）；
 *   ② 实证"后边也能靠道具跳级"：把每档道具喂给 Lv60/Lv100/Lv150 的将领各涨几级；
 *   ③ 全族**无任何等级闸**（capLv 字段不存在）—— 任何等级都能用。
 * 新设计打表（capLv 阶梯 10..60 · 量 = 从 Lv1 培养到该上限的累计经验）：
 *   ④ 逐档打印新数值与效果，供老板过目。
 * 运行：node .workbuddy/tools/probe/probe_v89171_items.js
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var pass = 0, fail = 0;
var P = function (n, ok, ex) { if (ok) pass++; else fail++; console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : '')); };

var need = function (lv) { return Math.round(DATA.EXP_CURVE.needTop * Math.pow(lv / DATA.EXP_CURVE.topLv, DATA.EXP_CURVE.alpha)); };
var cum = function (lv) { var s = 0; for (var i = 1; i < lv; i++) s += need(i); return s; };
var fmt = function (n) { return U.numText(n, 0); };
/* 喂经验 → 升到几级（不含神器加成，raw 口径） */
function simLevel(lv0, exp0, amount) {
  var lv = lv0, e = (exp0 || 0) + amount;
  while (lv < 240) { var nd = need(lv); if (e < nd) break; e -= nd; lv++; }
  return { lv: lv, up: lv - lv0 };
}

console.log('=== ① 曲线底座 ===');
console.log('  need(lv) = ' + DATA.EXP_CURVE.needTop + ' × (lv/240)^' + DATA.EXP_CURVE.alpha
  + ' · Lv1=' + fmt(need(1)) + ' · Lv60=' + fmt(need(60)) + ' · Lv240=' + fmt(need(240))
  + ' · 总量=' + fmt(DATA.EXP_CURVE.total));
console.log('  资质上限：' + DATA.GEN_RANKS.map(function (r) { return r.name + ' ' + r.lvCap; }).join(' · '));

console.log('\n=== ② 现存 11 档经验道具（改前：pct×总量取额 · 无等级闸） ===');
var items = [];
DATA.ITEMS.forEach(function (it) { if (it.type === 'exp') items.push(it); });
var specOf = {};
(DATA.EXP_ITEM_SPEC || []).forEach(function (sp) { specOf[sp.id] = sp; });
items.forEach(function (it) {
  var sp = specOf[it.id] || {};
  var gold = (it.price || 0) * 100;
  var r1 = simLevel(1, 0, it.amount);
  var r60 = simLevel(60, 0, it.amount);
  var r100 = simLevel(100, 0, it.amount);
  var r150 = simLevel(150, 0, it.amount);
  console.log('  ' + (it.noShop ? '（下架）' : '【在售】') + it.name + '　' + fmt(gold) + ' 金'
    + '　量=' + fmt(it.amount) + (sp.pct != null ? '（' + (sp.pct * 100).toFixed(2) + '% 总量）' : '')
    + '　capLv=' + (it.capLv == null ? '无' : it.capLv));
  console.log('       Lv1→' + r1.lv + '（涨' + r1.up + '级） · Lv60→' + r60.lv + '（+' + r60.up + '）'
    + ' · Lv100→' + r100.lv + '（+' + r100.up + '） · Lv150→' + r150.lv + '（+' + r150.up + '）');
});
var byId = {};
items.forEach(function (it) { byId[it.id] = it; });
P('★ 改前实证 A：兵仙遗篇（24 万金）Lv1 一本到 Lv' + simLevel(1, 0, byId.bingxian_yipian.amount).lv
  + '（"看起来很高"）', simLevel(1, 0, byId.bingxian_yipian.amount).lv >= 80);
var _b100 = simLevel(100, 0, byId.bingsheng.amount);
P('★ 改前实证 B：千古兵圣（40 万金）用在 Lv100 也能涨 ' + _b100.up + ' 级（"后边纯买道具"成立）', _b100.up >= 10);
P('★ 改前实证 C：全族没有任何等级闸（capLv 全为 undefined）', items.every(function (it) { return it.capLv == null; }));

console.log('\n=== ③ 新设计打表：capLv 阶梯（10~60 · 服务凡品段）+ 量 = 累计到上限 ===');
var LADDER = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
var ORDER = ['lianbing_jingyan', 'pijiang_shouji', 'bingfa_xinde', 'xiaowei_zhaji', 'zhijun_zhidao',
  'jiangjun_zhanlu', 'dudu_bingfa', 'mingjiang_xinchuan', 'bingxian_yipian', 'taigong_bingshu', 'bingsheng'];
console.log('  档位（按现表序）× 上限 × 新量（从 Lv1 培养到上限的累计）× 金价 × 每金经验');
ORDER.forEach(function (id, i) {
  var it = byId[id];
  var cap = LADDER[i];
  var amt = cum(cap);
  var gold = (it.price || 0) * 100;
  console.log('  ' + (it.name + '　').slice(0, 10) + ' 上限 Lv' + cap
    + '　新量=' + fmt(amt) + '（旧 ' + fmt(it.amount) + '）'
    + '　金价=' + fmt(gold) + '　' + (gold > 0 ? (amt / gold).toFixed(1) + ' 经验/金' : '-'));
});
console.log('\n  对照：新量占全曲线总量比 = ' + (cum(60) / DATA.EXP_CURVE.total * 100).toFixed(1) + '%（最大档）');
console.log('  全族上限 = Lv60（凡品段上限）—— 任一道具都不服务 60 级以上。');

console.log('\n=== ④ 新口径下"一本到线"的效果（从各起点使用最大档） ===');
[1, 10, 30, 45, 50, 59].forEach(function (lv0) {
  var amt = cum(60);
  var rem = cum(60) - cum(lv0);
  var grant = Math.min(amt, rem);
  var r = simLevel(lv0, 0, grant);
  console.log('  Lv' + lv0 + ' 用千古兵圣（新量 ' + fmt(amt) + '）→ 实投 ' + fmt(grant) + ' → Lv' + r.lv
    + '（到线 ' + (r.lv === 60 ? '✓' : '✗') + '）');
});

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(0);
