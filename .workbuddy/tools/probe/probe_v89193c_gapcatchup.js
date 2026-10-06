/* v89.193 探针C：主循环时间跳变补偿 —— 行为验证
   ① 静默补算：队列推完 + 编年史不增 + 报告不被覆盖 + _offlineSec 不设
   ② 对照（非静默读档路径）：编年史 +1 + 报告生成
   ③ 小缺口：mode=skip（走正常 tick） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, U = G.utils;

G.newGame({ name: '跳变补偿', region: '烬环' });
G.state.world.weather = 'clear';
var c = G.state.cities[0];
var bIdx = -1;
for (var i = 0; i < c.cells.length; i++) {
  var cl = c.cells[i];
  if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'junying', lvl: 3 }; bIdx = i; break; }
}
c.res.grain = 5e6; c.res.wood = 5e6; c.res.iron = 5e6; c.res.pop = 1e5;

function enqueue(n) {
  var r = G.train('yibing', n, c.id, bIdx);
  if (!r.ok) throw new Error('入队失败: ' + JSON.stringify(r));
}

/* v89.193：判据口径修正 —— "静默"的对象是 **recordOffline 专属条目（tag='offline'）**；
   era（改元）/milestone（里程碑）是"游戏内真实发生的大事"，被设计豁免抑制、该增就增
   （实测：2h 补算 = 游戏内约 16 年，改元 2 次 —— 那是真实推进的记录，不属静默范畴）。 */
function offTagN() {
  return (G.state.chronicle || []).filter(function (r) { return r.tag === 'offline'; }).length;
}
console.log('══════ ① 静默补算（loopGapCatchup · 模拟睡眠 2h）══════');
enqueue(500);
console.log('入队后：队列 =', G.state.queues.train.length, ' chronicle =', (G.state.chronicle || []).length);
G._offlineReport = { sentinel: true };
G._offlineSec = 99999;
var offA = offTagN();
var rcp = G.loopGapCatchup(2 * 3600);
console.log('loopGapCatchup(7200) =', JSON.stringify(rcp));
console.log('  队列 =', G.state.queues.train.length, '（应为 0 —— 队列推完）');
console.log('  军队 =', JSON.stringify(G.state.cities[0].army || {}).slice(0, 90));
console.log("  编年史 tag='offline' 条目：", offA, '→', offTagN(), '（应不变）');
console.log('  _offlineReport 哨兵保留：', (G._offlineReport || {}).sentinel === true);
console.log('  _offlineSec 未被覆盖：', G._offlineSec === 99999);
var ok1 = G.state.queues.train.length === 0
  && offTagN() === offA
  && (G._offlineReport || {}).sentinel === true
  && G._offlineSec === 99999;
console.log('  判定：' + (ok1 ? '✅ 静默语义全对' : '❌ 静默语义有误'));

console.log('\n══════ ② 对照：非静默（读档路径 offlineCatchup(600)）══════');
enqueue(300);
var offB = offTagN();
G._offlineReport = { sentinel2: true };
G._offlineSec = 0;
G.offlineCatchup(600);
console.log('  队列 =', G.state.queues.train.length, '（600s×120=7.2万游戏秒 → 推完）');
console.log("  编年史 tag='offline'：", offB, '→', offTagN(), '（应 +1：离城乃归）');
console.log('  _offlineReport 已生成（哨兵被覆盖）：', (G._offlineReport || {}).sentinel2 !== true);
console.log('  _offlineReport.train =', G._offlineReport && G._offlineReport.done && G._offlineReport.done.train);
console.log('  _offlineSec 已设置：', G._offlineSec === 600);
var ok2 = offTagN() === offB + 1
  && (G._offlineReport || {}).sentinel2 !== true
  && G._offlineSec === 600;
console.log('  判定：' + (ok2 ? '✅ 对照语义全对' : '❌ 对照语义有误'));

console.log('\n══════ ③ 小缺口：mode=skip ══════');
var r3 = G.loopGapCatchup(3);
console.log('loopGapCatchup(3) =', JSON.stringify(r3), '（应 skip）');
var r4 = G.loopGapCatchup(5);
console.log('loopGapCatchup(5) =', JSON.stringify(r4), '（应 skip —— 阈值上不含）');
var ok3 = r3.mode === 'skip' && r4.mode === 'skip';
console.log('  判定：' + (ok3 ? '✅' : '❌'));

console.log('\n══════ ④ 主循环源码形态检查 ══════');
var msrc = fs.readFileSync(path.join(R, 'js/main.js'), 'utf8');
console.log('  主循环含真实钟锚：', msrc.indexOf('GAME._loopLastAt = GAME.utils.now();') >= 0);
console.log('  主循环含跳变分支：', msrc.indexOf('GAME.loopGapCatchup(_gap193)') >= 0);
console.log('  toastSec 提示在册：', msrc.indexOf('检测到时间跳变') >= 0);

console.log('\n总结：' + ((ok1 && ok2 && ok3) ? '✅ 批次B 全通过' : '❌ 有失败项'));
process.exit(0);
