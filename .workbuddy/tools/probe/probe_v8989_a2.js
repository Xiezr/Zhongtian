/* ============================================================
 * v89.89 探针 · A2 离线结算报告
 *   ① 补算 → GAME._offlineReport 归集齐备
 *   ② 队列完成计数（建造完工 1 项：造一个快完成的队列）
 *   ③ 资源净变为正（离线产出）
 *   ④ 弹窗 HTML 渲染（分类区块齐）
 *   ⑤ 上限+五折折算的说明入报告
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME;
var DATA = G.DATA;
var PASS = 0, FAIL = 0;
function ck(name, cond, info) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (info ? '  [' + info + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (info ? '  [' + info + ']' : '')); }
}

var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;
var city = st.cities[0];

/* 造一个快完成的建造队列（elapsed 距 totalTime 只差 60 游戏秒，补算必完成） */
st.queues = st.queues || { build: [], tech: [], train: [] };
st.queues.build = [{ cityId: city.id, bIdx: 0, buildId: 'minfang', lvl: 2,
  elapsed: 0, totalTime: 60, /* 快完成 */ }];
/* 记录前资源 */
function resSum() {
  var t = 0;
  G.RES_KEYS.forEach(function (k) { if (k !== 'pop') t += city.res[k] || 0; });
  return t;
}
var res0 = resSum();

/* ---------- ① 直接调补算（半小时真实） ---------- */
console.log('=== ① 补算 → 报告归集 ===');
st.settings.offlineCapDays = 7;
G.offlineCatchup(1800);
var rp = G._offlineReport;
ck('_offlineReport 存在', !!rp);
ck('secReal=1800 / applied>0', rp && rp.secReal === 1800 && rp.applied > 0,
  rp ? ('sec=' + rp.secReal + ' applied=' + rp.applied + ' overflow=' + rp.overflow) : '无');
ck('资源字段齐（5 项）', rp && ['grain', 'wood', 'stone', 'iron', 'gold'].every(function (k) {
  return typeof rp.res[k] === 'number';
}), rp ? JSON.stringify(rp.res) : '');
ck('done 字段齐（build/tech/train）', rp && ['build', 'tech', 'train'].every(function (k) {
  return typeof rp.done[k] === 'number';
}), rp ? JSON.stringify(rp.done) : '');
ck('reports 数组 + reportsN', rp && Array.isArray(rp.reports) && typeof rp.reportsN === 'number',
  rp ? ('reportsN=' + rp.reportsN) : '');

/* ---------- ② 队列完成计数 ---------- */
console.log('=== ② 队列完成计数 ===');
ck('建造完工 ≥ 1（快完成的队列被结掉）', rp.done.build >= 1, 'build=' + rp.done.build);

/* ---------- ③ 资源净变 ---------- */
console.log('=== ③ 资源净变 ===');
var res1 = resSum();
ck('资源为正增长（离线产出）', rp.res.grain > 0 || res1 > res0,
  'grain Δ=' + rp.res.grain + '（合计 ' + res0 + ' → ' + res1 + '）');

/* ---------- ④ 弹窗渲染 ---------- */
console.log('=== ④ 弹窗 HTML ===');
var html = G.ui.offlineReportHTML();
ck('标题「归来报告」', html.indexOf('归来报告') >= 0);
ck('离城时长', html.indexOf('离城') >= 0);
ck('资源净变区块', html.indexOf('资源净变') >= 0);
ck('在办完成区块', html.indexOf('在办完成') >= 0);
ck('战报与事件区块', html.indexOf('战报与事件') >= 0);
ck('关闭按钮', html.indexOf('data-action="close-modal"') >= 0);

/* ---------- ⑤ 上限 + 五折折算 ---------- */
console.log('=== ⑤ 超限折算入报告 ===');
G._offlineReport = null;
/* 真实 10 天 = 240 小时；上限 7 游戏日 @120× = 7*86400/120 = 5040 真实秒
   → 1800*480 ≈ 大超限 */
st.settings.offlineCapDays = 7;
G.offlineCatchup(240 * 3600);
var rp2 = G._offlineReport;
ck('overflow > 0（超限段记录）', rp2 && rp2.overflow > 0,
  rp2 ? ('overflow=' + rp2.overflow + ' applied=' + rp2.applied) : '');
var html2 = G.ui.offlineReportHTML();
ck('报告写明"五折折算"', html2.indexOf('五折折算') >= 0);
ck('报告写明推进上限', html2.indexOf('推进上限') >= 0);

console.log('\n===== 结果：' + PASS + ' / ' + (PASS + FAIL) + ' =====');
process.exit(FAIL ? 1 : 0);
