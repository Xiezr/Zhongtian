/* v89.171 改后验证探针：经验道具「前期化」
 * ------------------------------------------------------------
 * 验收四组：
 *   ① 数据层：全族 capLv 单调 10→60 · 量 = expCumOf(capLv) · desc 带上限 · pct 零残留
 *   ② 闸门（真调 expItemGrantOf）：到线拒绝 / 到线即止 / 到线后不可再用
 *   ③ 全链路（真调 S.useItem / gainExpByItem）：等级与道具数量双验证
 *   ④ 对照：60 级一个将 —— 全族一个都点不动（"后边纯买道具"构造上杜绝）
 * 运行：node .workbuddy/tools/probe/probe_v89171b_after.js
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var pass = 0, fail = 0;
var P = function (n, ok, ex) { if (ok) pass++; else fail++; console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : '')); };

G.newGame({ name: '道具171', region: '司隶' });
var st = G.state;
var C = DATA.EXP_CURVE;
var need = function (lv) { return Math.round(C.needTop * Math.pow(lv / C.topLv, C.alpha)); };
var items = [];
DATA.ITEMS.forEach(function (it) { if (it.type === 'exp') items.push(it); });
var byId = {};
items.forEach(function (it) { byId[it.id] = it; });

console.log('=== ① 数据层（capLv × expCumOf × desc） ===');
console.log('  expCumOf(241) = ' + U.numText(DATA.expCumOf(241), 0) + ' · total = ' + U.numText(C.total, 0));
P('expCumOf(241) === EXP_CURVE.total（同源）', DATA.expCumOf(241) === C.total);
var caps = items.map(function (it) { return it.capLv; });
console.log('  全族上限：' + items.map(function (it) { return it.name + '→Lv' + it.capLv; }).join(' · '));
P('全族 11 档都有 capLv（无 undefined）', items.length === 11 && caps.every(function (c) { return c > 0; }));
/* ⚠️ 单调性按 **EXP_ITEM_SPEC 表序** 判（DATA.ITEMS 数组序 ≠ 规格表序 —— 本轮实中） */
var specCaps = DATA.EXP_ITEM_SPEC.map(function (sp) { return sp.capLv; });
P('上限单调递增（规格表序 10 → 60）', specCaps.every(function (c, i) { return i === 0 || c > specCaps[i - 1]; }),
  specCaps.join(','));
P('全族上限 ≤ 60（凡品段 · 只服务前期）', caps.every(function (c) { return c <= 60; }));
P('量 = expCumOf(capLv)（唯一出口）', items.every(function (it) { return it.amount === DATA.expCumOf(it.capLv); }));
P('desc 带上限（「最多培养至 LvN」）', items.every(function (it) {
  return it.desc.indexOf('最多培养至 Lv' + it.capLv) >= 0;
}));
P('兵仙遗篇：量 = expCumOf(50)（' + U.numText(byId.bingxian_yipian.amount, 0) + '）',
  byId.bingxian_yipian.amount === DATA.expCumOf(50) && byId.bingxian_yipian.capLv === 50);
var dS = fs.readFileSync(path.join(R, 'js', 'data.js'), 'utf8');
var exec = dS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(function (l) { return l.split('//')[0]; }).join('\n');
P('pct 取额形态零残留（可执行形态）', !/total\s*\*\s*sp\.pct/.test(exec) && !/sp\.pct/.test(exec));

console.log('\n=== ② 闸门（真调 expItemGrantOf） ===');
var g = { id: 'g171', name: '样本171', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
  speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
var it50 = byId.bingxian_yipian, it60 = byId.bingsheng, it10 = byId.lianbing_jingyan;
var t1 = G.expItemGrantOf(g, it50);
console.log('  Lv1 + 兵仙遗篇 → ' + JSON.stringify(t1));
P('Lv1 可用 · 到线（capped）· 额度 = expCumOf(50)', t1.ok && t1.capped === true && t1.grant === DATA.expCumOf(50));
g.level = 50;
var t2 = G.expItemGrantOf(g, it50);
console.log('  Lv50 + 兵仙遗篇 → ' + JSON.stringify(t2).slice(0, 160));
P('Lv50（= 上限）→ 拒绝 · 消息含「只服务前期」', !t2.ok && /只服务前期/.test(t2.msg));
g.level = 45;
var t3 = G.expItemGrantOf(g, it60);
console.log('  Lv45 + 千古兵圣 → grant=' + U.numText(t3.grant, 0) + '（rem 口径）· capped=' + t3.capped);
P('Lv45 用千古兵圣：额度 = 到 Lv60 的剩余（< 面额）', t3.ok && t3.grant === DATA.expCumOf(60) - DATA.expCumOf(45) && t3.grant < it60.amount);
g.level = 60;
P('Lv60 → 全族一个都用不了（11/11 拒绝）', items.every(function (it) { var r = G.expItemGrantOf(g, it); return !r.ok; }));
g.level = 1;

console.log('\n=== ③ 全链路（真调 S.useItem / gainExpByItem） ===');
var bkItems = st.items, bkGen = st.generals[0];
st.items = { bingxian_yipian: 3, bingsheng: 1, lianbing_jingyan: 2 };
/* 借一个真将领来跑（全字段齐备），用完还原 */
var real = bkGen;
var bkReal = { level: real.level, exp: real.exp, rank: real.rank };
real.level = 1; real.exp = 0; real.rank = 'tian';
var r1 = G.systems.useItem('bingxian_yipian', real.id, {});
console.log('  真调 useItem（Lv1 · 兵仙遗篇）→ ' + JSON.stringify(r1).slice(0, 190));
P('★ Lv1 用兵仙遗篇 → Lv' + real.level + '（到线 Lv50）· 道具 -1',
  r1.ok && real.level === 50 && st.items.bingxian_yipian === 2);
P('消息写明「已达培养上限 Lv50」', /已达「兵仙遗篇」的培养上限 Lv50/.test(r1.msg));
var r2 = G.systems.useItem('bingxian_yipian', real.id, {});
console.log('  再用一本（已 Lv50）→ ' + JSON.stringify(r2).slice(0, 170));
P('★ 到线后拒绝 · 道具**不扣**（防"白烧"）', !r2.ok && /只服务前期/.test(r2.msg) && st.items.bingxian_yipian === 2);
var r3 = G.systems.useItem('bingsheng', real.id, {});
P('Lv50 用千古兵圣 → Lv' + real.level + '（到 Lv60）', r3.ok && real.level === 60);
var r4 = G.systems.useItem('lianbing_jingyan', real.id, {});
P('Lv60 用最低档也被拒（全族同闸）', !r4.ok && st.items.lianbing_jingyan === 2);
real.level = 1; real.exp = 0;
var r5 = G.systems.gainExpByItem('bingxian_yipian', real.id, 'till');
console.log('  真调 gainExpByItem（till · Lv1）→ ' + JSON.stringify(r5).slice(0, 190));
P('★ 批量口同样到线即止（used=1 · 升至 Lv' + real.level + '）', r5.ok && real.level === 50 && r5.used === 1);
P('批量口消息带上限', /培养上限/.test(r5.msg));

console.log('\n=== ④ 对照：改前 vs 改后（同一支道具的"上限"效果） ===');
console.log('  改前：兵仙遗篇 Lv1→86 · Lv100→+27 级 · Lv150→+17 级（全期可买）');
console.log('  改后：兵仙遗篇 Lv1→50（到线）· Lv50 起拒绝（全族 60 级封顶）');
P('上限闸真在（Lv61 的将 · 全族拒绝）', (function () {
  real.level = 61;
  var all = items.every(function (it) { return !G.expItemGrantOf(real, it).ok; });
  real.level = 1;
  return all;
})());

/* 还原现场 */
real.level = bkReal.level; real.exp = bkReal.exp; real.rank = bkReal.rank;
st.items = bkItems;

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
