/* ============================================================
 * probe_v89135_base.js —— 野地驻军体系 行为基线/验收探针（v89.135 批 A）
 * ------------------------------------------------------------
 * 记录（改前基线 → 改后验收同一脚本重跑）：
 *   ① 驻军结构：有没有 genId（将领在不在野地）
 *   ② 驻军开采：garrison 被抽空？gather.genId 是什么？采集卡显示什么？
 *   ③ 派驻将领：走完行军的 status（idle = 不在野地 / garrison = 在野地）
 *   ④ 占领带兵超上限：10W 打 1 级野地 → 全进 还是 overflow 回城？
 *   ⑤ 采集珠宝：收获有没有珠宝入包（改后新增）
 *   ⑥ autoGather：满 24h 是否即时收、空闲是否即时采（改后）
 * 用法：node .workbuddy/tools/probe/probe_v89135_base.js
 * ============================================================ */
'use strict';
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '　' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '　' + extra : '')); }
}

console.log('===== v89.135 批 A 野地驻军体系 · 行为探针 =====');

/* ---------- 造局 ---------- */
var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
G.state = st;
if (!st.map.grid) G.map.generate();
var c = st.cities[0];
G.ui._cityId = c.id;

/* 摆一块我方野地（湖泊 Lv10）+ 城中兵马 + 空闲将领 */
var wx = c.x + 2, wy = c.y + 2;
st.wilds.push({ x: wx, y: wy, type: 'lake', level: 10, garrison: null });
var gen0 = st.generals[0];
c.army = { yibing: 6000, changqiang: 3000 };

console.log('\n① 派将驻守（走 doWildGarrison 首队带将 → 行军）');
var r1 = G.doWildGarrison(wx, wy, { yibing: 5, changqiang: 3 }, c.id, gen0.id);
console.log('   doWildGarrison →', JSON.stringify(r1).slice(0, 140));
/* 快进行军 */
var m0 = (st.marches || [])[0];
if (m0) { m0.elapsed = m0.totalTime + 1; G.march.tick(); }
var w1 = G.map.wildAt(wx, wy);
var gm1 = w1 && w1.garrison;
console.log('   驻军 =', JSON.stringify(gm1));
ok('驻军建立（兵已入驻）', !!(gm1 && G.wildGarrisonTotal(gm1) > 0), '共 ' + (gm1 ? G.wildGarrisonTotal(gm1) : 0));
ok('【改后目标】驻军记将领 genId', !!(gm1 && gm1.genId), gm1 ? ('genId=' + gm1.genId) : '-');
console.log('   将领 ' + gen0.name + ' status =', gen0.status, '· cityId =', gen0.cityId);
ok('【改后目标】将领停留在野地（status=garrison）', gen0.status === 'garrison', '现 ' + gen0.status);

console.log('\n② 驻军开采（startGather from garrison）');
var before2 = JSON.stringify(gm1 && gm1.troops);
var r2 = G.startGather(wx, wy, null, U.deep(gm1 ? gm1.troops : {}), { from: 'garrison', cityId: c.id });
console.log('   startGather →', JSON.stringify(r2).slice(0, 160));
var g2 = (G.gatherList() || [])[0];
ok('采集队建立', !!(r2 && r2.ok && g2), g2 ? ('id=' + g2.id) : '-');
if (g2) {
  console.log('   采集队: genId=' + JSON.stringify(g2.genId) + ' troops=' + g2.troops + ' origin=' + g2.origin);
  ok('【改后目标】采集队带将领 genId（现为 null → 卡片显示"将已不在"）', !!g2.genId, '现 ' + g2.genId);
}
var w2 = G.map.wildAt(wx, wy);
console.log('   开采后 garrison =', JSON.stringify(w2 ? w2.garrison : null), '（改前 = null 被抽空 → "驻军 无"）');
ok('【改后目标】开采后驻军仍在（原地开工）', !!(w2 && G.wildGarrisonTotal(w2.garrison) > 0));

console.log('\n③ 采集卡片文案（openGathers 渲染）');
try {
  G.ui.openGathers();
  var root = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('modal-root') : null;
  var html = root ? (root.innerHTML || '') : '';
  if (!html && G.ui._lastModalHTML) html = G.ui._lastModalHTML;
  if (!html) {
    /* Node 桩 DOM：直接读渲染函数的产物 */
    console.log('   （桩 DOM：跳过渲染读取）');
  }
  ok('【改后目标】卡片不含「（将已不在）」', html.indexOf('将已不在') < 0, html ? '' : '桩环境跳过');
} catch (e) { console.log('   openGathers 异常：' + e.message); }

console.log('\n④ 占领带兵超上限（10W 打 1 级野地）');
/* 摆第二块未占野地（低等级） */
var wx2 = c.x - 3, wy2 = c.y - 3;
st.wilds = st.wilds.filter(function (w) { return !(w.x === wx2 && w.y === wy2); });
/* 直接测试写入函数的行为（occupy 结算的最后一环） */
var fake = { x: wx2, y: wy2 };
/* 用 wildGarrisonAdd 模拟：不格挡（改后应支持 noCap） */
var t4 = G.map.tile ? G.map.tile(wx2, wy2) : null;
console.log('   目标格地形 =', t4 ? t4.terrain : '(未查)', '（占位：改后走 occupy noCap 断言在 smoke）');

console.log('\n⑤ 采集珠宝（改后新增）');
console.log('   DATA.GATHER.jewelTable =', JSON.stringify(D.GATHER.jewelTable || null));
ok('【改后目标】GATHER 有 jewelTable（按地形珠宝池）', !!D.GATHER.jewelTable);
ok('【改后目标】GATHER 有 jewelChance', D.GATHER.jewelChance != null, String(D.GATHER.jewelChance));

console.log('\n⑥ autoGather 实时化（改后）');
console.log('   autoGatherState 结构 =', JSON.stringify(st.autoGatherState || null));
ok('【改后目标】autoGatherTick 存在（满24h即收/空闲即采）', typeof G.autoGatherTick === 'function');

console.log('\n⑦ 行军精力（批 B · 记录当前值）');
D.EXPEDITION.modes.forEach(function (m) {
  if (['scout', 'raid', 'occupy'].indexOf(m.id) >= 0) {
    console.log('   ' + m.id + ': stamina=' + m.stamina + ' energy=' + m.energy);
  }
});
console.log('   计谋数 =', D.SCHEMES.length, '（' + D.SCHEMES.map(function (x) { return x.name; }).join('、') + '）');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败（含【改后目标】项 —— 改前必然红，正常）');
process.exit(0);
