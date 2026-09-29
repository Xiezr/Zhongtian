/* v89.190 探针A：自动征兵全链路（真调引擎 · 唯一出口）
   ① 判别：planOf 的军营空位与缺口 ② 触发：低于触发线 → 补单（真入队列）
   ③ 停止：达标不再补 / 资源保底 / 队列满 ④ 城参数：canTrain/trainLimitOf 按城 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data','state','questdata','systems','domain','map','battle','tactic','icons','gicons','bitmaps','portraits','story','ui','main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

G.newGame({ name: '自动征兵', region: '司隶' });
var c = G.state.cities[0];
/* 造局：给首城配 军营Lv3 + 书院Lv3（changqiang 门槛），资源给足 */
var placed = 0;
for (var i = 0; i < c.cells.length && placed < 2; i++) {
  if (c.cells[i] && c.cells[i].build) continue;
  c.cells[i] = { build: { id: placed === 0 ? 'junying' : 'shuyuan', lvl: 3 } };
  placed++;
}
c.res.grain = 5000000; c.res.wood = 5000000; c.res.iron = 5000000; c.res.pop = 100000;
G.goldAdd(5000000);
console.log('城池 ' + c.name + ' 军营数 =', G.barracksOf(c).length, ' 金 =', G.goldOf());
console.log('canTrain(changqiang) =', JSON.stringify(G.canTrain('changqiang')));
console.log('canTrain(changqiang, c) =', JSON.stringify(G.canTrain('changqiang', c)));

var cfg = G.autoTrainCfg();
console.log('cfg.targets 条数 =', Object.keys(cfg.targets).length, '（应为 15 = 非器械全兵种）');
cfg.targets.changqiang = { min: 0, max: 500 };
var plan = G.autoTrainPlanOf(c);
console.log('plan：军营', plan.bars.length, '空位', plan.left + '/' + plan.total, '缺口', JSON.stringify(plan.needs));
var lim = G.trainLimitOf('changqiang', c);
console.log('trainLimitOf(changqiang, c).cap =', lim.cap);

/* 触发：开关开 + ticks */
G.state.settings.autoTrain = true;
cfg.at = 0;
var r1 = G.autoTrainTick();
console.log('tick#1 done =', r1 && r1.done, ' acted =', JSON.stringify(r1 && r1.acted), ' msg =', cfg.msg);
var qs = G.state.queues.train.filter(function (q) { return q.cityId === c.id; });
console.log('队列条目 =', qs.length, ' 首条 =', qs[0] && (qs[0].troopId + '×' + qs[0].count));

/* 达标：队列含 500 → 不再补 */
cfg.at = 0;
var r2 = G.autoTrainTick();
console.log('tick#2 done =', r2 && r2.done, ' msg =', cfg.msg, '（应 0 / 达标 或 队列满）');
var plan2 = G.autoTrainPlanOf(c);
console.log('plan2 缺口 =', JSON.stringify(plan2.needs));

/* 资源保底：清队 + 保底抬高 */
G.state.queues.train = [];
cfg.goldKeep = 99999999;
cfg.at = 0;
var r3 = G.autoTrainTick();
console.log('tick#3（金保底）done =', r3 && r3.done, ' msg =', cfg.msg);
cfg.goldKeep = 0;

/* 队列满：占满军营空位 */
cfg.at = 0;
var r4 = G.autoTrainTick();
console.log('tick#4 done =', r4 && r4.done, ' msg =', cfg.msg);
var slots = G.trainQueueSlots(G.barracksOf(c)[0].lvl, c);
console.log('该军营队列位 =', slots, ' 现占 =',
  G.trainQueuesOf(c, G.barracksOf(c)[0].idx, 'train').length);
/* 再补一轮（占满后应报队列满） */
cfg.at = 0;
var r5 = G.autoTrainTick();
console.log('tick#5（应满）done =', r5 && r5.done, ' msg =', cfg.msg);

/* 队列满用例：队列已占满（1 位已占）+ 目标抬高 → 应报队列满而不下单 */
cfg.targets.changqiang = { min: 0, max: 2000 };
cfg.at = 0;
var r6 = G.autoTrainTick();
console.log('tick#6（队列满）done =', r6 && r6.done, ' msg =', cfg.msg);

/* 城参数：无军营城 canTrain 应报"尚无军营"（且不误读当前城） */
var c2 = G.makeCity({ id: 'p2x', name: '无营城', x: c.x + 3, y: c.y + 3, state: 'sili', res: G.emptyRes() });
console.log('canTrain(changqiang, 无营城) =', JSON.stringify(G.canTrain('changqiang', c2)));
console.log('trainLimitOf(changqiang, 无营城).cap =', G.trainLimitOf('changqiang', c2).cap, '（该城资源为 0，应为 0）');
process.exit(0);
