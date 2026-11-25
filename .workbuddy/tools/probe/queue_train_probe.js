/* 训练补偿探针 —— §193② 的口径复现（离线补算推完训练队列后兵力应达 300）
 * 用法：node .workbuddy/tools/probe/queue_train_probe.js
 * 目的：区分「地形改动导致」与「基线 flaky」—— 对同一段逻辑打印中间量。
 */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  global.document = {
    createElement: function () { return { style: {}, appendChild: function () { }, setAttribute: function () { }, classList: { add: function () { }, remove: function () { } } }; },
    getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, addEventListener: function () { }, body: { appendChild: function () { } }
  };

  var src = fs.readFileSync(path.join('E:/Deepseekdb', 'js', 'bundle-core.js'), 'utf8');
  try { (0, eval)(src); } catch (e) { console.log('CORE_LOAD_ERR', e.message); process.exit(1); }
  var G = GAME;

  G.newGame({ name: 'gap193', region: '烬环' });
  if (!G.state.world) G.state.world = {};
  G.state.world.weather = 'clear';
  var c = G.state.cities[0], bIdx = -1;
  for (var i = 0; i < c.cells.length; i++) {
    var cl = c.cells[i];
    if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'junying', lvl: 3 }; bIdx = i; break; }
  }
  c.res.grain = 5e6; c.res.wood = 5e6; c.res.stone = 5e6; c.res.iron = 5e6; c.res.pop = 1e5;
  var army0 = (c.army || {}).buxingji || 0;
  var tr = G.train('buxingji', 300, c.id, bIdx);
  var q0 = (G.state.queues.train || [])[0] || {};
  console.log('城 ' + c.name + ' @' + c.x + ',' + c.y);
  console.log('train ok=' + tr.ok + ' 初始 buxingji=' + army0 + ' 队列条数=' + (G.state.queues.train || []).length);
  console.log('队列头：count=' + q0.count + ' totalTime=' + q0.totalTime + ' elapsed=' + q0.elapsed);
  console.log('兵营 lvl3 容量/上限探测：', typeof G.barracksCap === 'function' ? G.barracksCap(c, 3) : '(无 barracksCap)');
  G._offlineReport = { sentinel: true };
  G._offlineSec = 777;
  var rc = G.loopGapCatchup(2 * 3600);
  var army1 = (G.state.cities[0].army || {}).buxingji || 0;
  console.log('catchup mode=' + rc.mode + ' 队列剩余=' + (G.state.queues.train || []).length + ' 最终 buxingji=' + army1);
  console.log('差值=' + (army1 - army0) + '（期望 300）');
  console.log('兵营占位 bIdx=' + bIdx + ' 该格 build=' + JSON.stringify((G.state.cities[0].cells[bIdx] || {}).build));
})();
