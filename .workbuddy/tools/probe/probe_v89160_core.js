'use strict';
/* v89.160 探针：① 逾溢折损（25%/游戏日 · 灾种提示 · 黄金豁免 · 多期复利 · 不削未超部分）
   ② 自动升级：取消城内优先 + 某项不足则顺延下一项（全试遍才暂停） */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join('E:/Deepseekdb/js/', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探160', cityName: '许都', region: '碎垣', mapSeed: 20260960 });
var s = G.state, c = G.currentCity();
function P(tag, v) { console.log((v ? '  ✓ ' : '  ✗ ') + tag); return v; }
function logs() { return (s.msgLog || []).map(function (r) { return r.msg; }); }
function lastLog() { var L = logs(); return L[L.length - 1] || ''; }

console.log('=== ① 逾溢折损 ===');
console.log('  参数 =', JSON.stringify({ keys: DATA.OVERFLOW.keys, ratio: DATA.OVERFLOW.ratio,
  period: DATA.OVERFLOW.periodGameHours, events: DATA.OVERFLOW.events.map(function (e) { return e.name; }) }));
/* 首次调用 = 只登记锚点 */
console.log('  首次 settle →', JSON.stringify(G.settleOverflowRot()));
P('首次只登记锚点（无损失）', s.overflowAt === (s.world.elapsed || 0));
P('未超上限 → 无损失清单', G.overflowRotOf(c).length === 0);

var cap = G.storeCapOf(c);
G.res(c).grain = cap + 100000;
G.res(c).gold = 9e9;
var before = G.res(c).grain, n0 = logs().length;
s.world.elapsed = (s.overflowAt || 0) + 86400;         /* 推进 1 游戏日 */
var r1 = G.settleOverflowRot();
console.log('  1 期结算 →', JSON.stringify(r1));
console.log('  公文 →', lastLog());
P('损失 = 超出部分 × 25%（25000）', r1.total === 25000 && Math.round(G.res(c).grain) === Math.round(before - 25000));
P('只发一条公文 · 含灾种名', logs().length === n0 + 1
  && DATA.OVERFLOW.events.some(function (e) { return lastLog().indexOf(e.name) >= 0; })
  && /损失/.test(lastLog()));
P('黄金豁免（未受损）', G.res(c).gold === 9e9);
/* 多期复利：再推 2 日 */
var b2 = G.res(c).grain;                               /* = cap + 75000 */
s.world.elapsed += 2 * 86400;
var r2 = G.settleOverflowRot();
var ex2 = b2 - cap;
var expect2 = Math.round(ex2 * (1 - Math.pow(0.75, 2)));
console.log('  2 期结算 →', JSON.stringify(r2), '· 期望 ' + expect2);
P('多期按 (1−0.75^n) 复利', r2.total === expect2 && r2.periods === 2);
/* 小额：超出 2 → 至少损 1 */
G.res(c).grain = cap + 2;
s.world.elapsed += 86400;
var r3 = G.settleOverflowRot();
P('超出 2 → 仍损 1（机制不成摆设）', r3.total === 1);
/* 未超：静默 */
G.res(c).grain = cap - 1;
var n1 = logs().length;
s.world.elapsed += 86400;
var r4 = G.settleOverflowRot();
P('未超上限 → 静默（无公文）', (r4 == null || r4.total === 0) && logs().length === n1);
/* 首期锚点：不足一期不结算 */
s.overflowAt = s.world.elapsed;
G.res(c).grain = cap + 100000;
s.world.elapsed += 3600;                                /* 只过 1 小时 */
P('不足一期不结算', G.settleOverflowRot() === null && G.res(c).grain === cap + 100000);

console.log('\n=== ② 自动升级：某项不足 → 顺延下一项（不再当场暂停） ===');
s.settings.autoUpgrade = true;
s.queues.build.length = 0;
/* 造局：格 0 = 铁匠铺 Lv1（贵）· 格 1 = 民房 Lv1（便宜）；池子只够后者 —— 都在官府 Lv1 之下 */
c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build = null; });
c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });   /* 官府 4：城内建筑才升得动（v89.159 严格总闸） */
G.extGridOf(c).forEach(function (e) { e.type = null; e.lv = 0; e.pending = null; });          /* 清掉城外候选，判据只看两格 */
c.cells[0].build = { id: 'tiejiangpu', lvl: 1 };
c.cells[1].build = { id: 'minfang', lvl: 1 };
if (G.wallSlotOf(c).build) G.wallSlotOf(c).build = null;
var costT = DATA.BUILDINGS.tiejiangpu.levelCost(1);
var costM = DATA.BUILDINGS.minfang.levelCost(1);
var sum = function (o) { var t = 0; for (var k in o) { if (k !== 'time' && k !== 'jewel' && k !== 'pop') t += o[k]; } return t; };
console.log('  铁匠铺 Lv1→2 造价 =', JSON.stringify(costT), '（合 ' + sum(costT) + '）');
console.log('  民房   Lv1→2 造价 =', JSON.stringify(costM), '（合 ' + sum(costM) + '）');
P('铁匠铺确实更贵（造局有效）', sum(costT) > sum(costM));
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = costM[k] || 0; });
var rA = G.autoUpgrade();
console.log('  池子只够民房 →', JSON.stringify(rA).slice(0, 170));
P('★ 顺延过格 0（铁匠铺）· 命中格 1（民房）',
  !!(rA && rA.ok) && rA.target && rA.target.idx === 1 && /民房/.test(rA.target.name || ''));
var q1 = (s.queues.build || []).filter(function (q) { return q.cityId === c.id; });
P('队列里只有民房那一项（铁匠铺没被误排）', q1.length === 1 && Number(q1[0].gridIndex) === 1);
P('状态是"正在升级"而不是"暂停"', /正在升级/.test((s.autoState || {}).msg || '') && s.autoState.paused === false);
/* 池子清零 → 全部试遍 → 暂停 */
s.queues.build.length = 0;
c.cells[1].pending = null;
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 0; });
var rB = G.autoUpgrade();
console.log('  池子清零 →', JSON.stringify(rB).slice(0, 170));
P('★ 全部试遍仍无一可动 → 暂停（开关不关）', !!(rB && rB.paused === true) && s.settings.autoUpgrade === true);
P('暂停文案写明"试遍"与待升级项', /试遍/.test((s.autoState || {}).msg || ''));
/* 数据级：KIND_ORD 退役 */
var dm = fs.readFileSync('E:/Deepseekdb/js/domain.js', 'utf8');
P('KIND_ORD（城内优先）已退役', dm.indexOf('var KIND_ORD') < 0);
P('顺延变量就位（blocked160）', dm.indexOf('var blocked160 = null') >= 0);

console.log('\n=== ③ 回归：无资源时仍是"暂停"（旧断言口径未破） ===');
P('单城 0 资源 → paused:true', !!(rB && rB.paused === true));
process.exit(0);
