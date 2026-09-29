/* v89.193 探针A：离线募兵推进 —— 老板"过夜后募兵还是昨天那列"
   ① 读档路径（关页面过夜）：存档 savedAt 改到 10h 前 → adoptState → 队列推进了吗？
   ② 在线路径（页面开着过夜/电脑睡眠）：主循环 dt 参考系检查 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, U = G.utils;

console.log('timeScale =', G.timeScale());
console.log('OFFLINE 逐秒上限 = 3600 现实秒（代码常量）');

/* ---------- 场景① 读档路径（关页面过夜） ---------- */
console.log('\n══════ 场景①：读档路径（关页面过夜 10h）══════');
G.newGame({ name: '过夜测试', region: '司隶' });
G.state.world.weather = 'clear';
var c = G.state.cities[0];
var bIdx = -1;
for (var i = 0; i < c.cells.length; i++) {
  var cl = c.cells[i];
  if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'junying', lvl: 3 }; bIdx = i; break; }
}
c.res.grain = 5e6; c.res.wood = 5e6; c.res.iron = 5e6; c.res.pop = 100000;
console.log('军营格 idx =', bIdx);
var r0 = G.train('yibing', 500, c.id, bIdx);
console.log('入队 500 义兵:', r0.ok ? 'ok' : JSON.stringify(r0));
var qs0 = G.state.queues.train;
console.log('  队列条数 =', qs0.length, ' 首条 =', qs0[0] ? (qs0[0].troopId + '×' + qs0[0].count
  + ' · elapsed=' + Math.round(qs0[0].elapsed) + '/' + qs0[0].totalTime) : '(无)');
console.log('  军队（前）:', JSON.stringify(c.army || {}).slice(0, 120));

var raw = G.savePayload();
var d = JSON.parse(raw);
var savedAt0 = d.savedAt;
d.savedAt = Date.now() - 10 * 3600 * 1000;   // 伪造：10 小时前存的档
console.log('  伪造 savedAt：10 小时前（真实 savedAt 与现在差 ' + Math.round((Date.now() - savedAt0) / 1000) + ' 秒）');

var t0 = Date.now();
var st = G.adoptState(d);
console.log('  adoptState 用时 =', Date.now() - t0, 'ms');
var qs1 = G.state.queues.train;
console.log('  读档后队列条数 =', qs1.length, qs1[0] ? (' 首条 elapsed=' + Math.round(qs1[0].elapsed) + '/' + qs1[0].totalTime) : '');
console.log('  军队（后）:', JSON.stringify(G.state.cities[0].army || {}).slice(0, 160));
var rep = G._offlineReport;
console.log('  _offlineReport：secReal=' + (rep && rep.secReal) + ' applied=' + (rep && rep.applied)
  + ' done.train=' + (rep && rep.done && rep.done.train)
  + ' done.build=' + (rep && rep.done && rep.done.build)
  + ' done.tech=' + (rep && rep.done && rep.done.tech));
console.log('  判定：' + (G.state.cities[0].army && G.state.cities[0].army.yibing >= 500
  ? '✅ 队列完成、兵已入营'
  : '❌ 队列没动 / 兵没到 —— 复现老板的 bug'));

/* ---------- 场景①b 读档后立刻再读一次（防重复补算） ---------- */
var raw2 = G.savePayload();
var d2 = JSON.parse(raw2);
d2.savedAt = d2.savedAt;                     // 原样（= 刚补算过，savedAt 已更新）
var st2 = G.adoptState(d2);
console.log('  二次读档（savedAt 未变老）：队列条数 =', G.state.queues.train.length,
  ' _offlineReport =', G._offlineReport ? ('secReal=' + G._offlineReport.secReal) : 'null（未补算 ✓）');

/* ---------- 场景② 在线路径：主循环 dt 参考系检查 ---------- */
console.log('\n══════ 场景②：在线路径（页面开着过夜/电脑睡眠）══════');
console.log('主循环 setInterval(…, 1000) + tickOnce() 内 dtReal = 1（固定值）——');
console.log('  · 电脑睡眠 8h → setInterval 冻结 → 唤醒后不补发 8h（只按"醒来后的秒"走）');
console.log('  · 浏览器挂起标签页同理（后台节流）');
console.log('  · 全仓 grep "visibilitychange|时间跳变|唤醒" = 0 处 → ❌ 在线路径没有"时间跳变补偿"');
console.log('  判定：页面开着过夜 = 时间凭空丢失（这是第二种可复现的"过夜没动"）');

process.exit(0);
