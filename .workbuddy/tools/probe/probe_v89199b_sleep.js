/* v89.199 诊断 F：离线补偿——冻结恢复 + 8h 拨钟（复杂状态） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* ① 造复杂状态 + 挂监控 */
  var setup = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'freeze', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    var s = G.state;
    if (!s.map.grid) G.map.generate();
    var c = s.cities[0];
    s.rank = 6;
    /* 募兵队列（真形状 · 超长时长防完成） */
    s.queues.train.push({ kind: 'train', cityId: c.id, bIdx: 0, troopId: 'yibing',
      count: 100, elapsed: 0, totalTime: 500000, waiting: false });
    /* 建造队列 */
    if (s.queues.build.length === 0 && c.cells) {
      for (var i = 0; i < c.cells.length; i++) {
        var cell = c.cells[i];
        if (!cell.build && c.cells[i]) continue;
      }
    }
    /* 行军：将领 + 兵 + 远方野地 */
    var hero = G.makeGeneral('冻结将', 50, 'idle', c.id, false, 'ming', 'balance');
    s.generals.push(hero);
    G.setStaNow(hero, G.staMax(hero)); hero.energy = 999;
    c.army = { yibing: 500000 };
    var wt = null, bestD = -1;
    for (var y = 0; y < 240 && !wt; y++) {
      for (var x = 0; x < 240; x++) {
        var tl = G.map.tile(x, y);
        if (tl && tl.terrain !== 'city' && c && (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > bestD * bestD) {
          bestD = Math.sqrt((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y));
          wt = { x: x, y: y };
        }
      }
    }
    var dR = wt ? G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'occupy',
      { yibing: 1000 }, hero.id) : { ok: false, msg: 'no target' };
    /* 开自动征兵 */
    if (G.doToggleAutoTrain) G.doToggleAutoTrain();
    /* 页面心跳计数（验证 frozen 是否真冻结） */
    window.__ftick = 0;
    setInterval(function () { window.__ftick++; }, 1000);
    /* 监控 loopGapCatchup 的每次调用与异常 */
    window.__watch = [];
    var _orig = G.loopGapCatchup;
    G.loopGapCatchup = function (gap) {
      var r;
      try {
        r = _orig.apply(this, arguments);
        window.__watch.push({ t: Date.now(), gap: Math.round(gap), mode: r && r.mode });
      } catch (e) {
        window.__watch.push({ t: Date.now(), gap: Math.round(gap),
          err: (e && e.message) + ' @' + String((e && e.stack) || '').split('\n')[1] });
        throw e;
      }
      if (window.__watch.length > 80) window.__watch.splice(0, 40);
      return r;
    };
    G.ui.enterGame(); G.ui.closeAllModals();
    return {
      marchOk: dR.ok, marchMsg: dR.msg || '',
      world0: s.world.elapsed, train0: s.queues.train[0].elapsed,
      lastAt0: G._loopLastAt, t0: Date.now(),
    };
  });
  console.log('初始：march=' + setup.marchOk + '（' + setup.marchMsg + '） world=' + setup.world0
    + ' train0=' + setup.train0);
  await new Promise(function (r) { setTimeout(r, 2500); });

  /* ② CDP 冻结 35 秒 */
  var client = await p.context().newCDPSession(p);
  var f1 = await p.evaluate(function () { return window.__ftick; });
  await client.send('Page.setWebLifecycleState', { state: 'frozen' });
  console.log('→ 已请求 frozen；等 35 秒真实时间…');
  await new Promise(function (r) { setTimeout(r, 35000); });
  var during = await p.evaluate(function () { return window.__ftick; }).catch(function (e) { return 'ERR:' + e.message; });
  console.log('  冻结期间 __ftick: ' + f1 + ' → ' + during + '（不涨 = 真冻结）');
  await client.send('Page.setWebLifecycleState', { state: 'active' });
  console.log('→ 已恢复 active，等 8 秒观察补算…');
  await new Promise(function (r) { setTimeout(r, 8000); });

  /* ③ 结果 */
  var r3 = await p.evaluate(function () {
    var G = window.GAME, s = G.state;
    return {
      ftick: window.__ftick,
      world1: s.world.elapsed, train1: s.queues.train.length ? s.queues.train[0].elapsed : -1,
      nTrain: s.queues.train.length,
      lastAt1: G._loopLastAt, t1: Date.now(),
      watch: window.__watch.slice(-14),
    };
  });
  var gapMs = r3.t1 - r3.lastAt1;
  console.log('恢复后：__ftick=' + r3.ftick + ' | world ' + setup.world0 + '→' + r3.world1
    + '（Δ=' + (r3.world1 - setup.world0) + ' 游戏秒，35s×120 应为 4200）');
  console.log('  train0 ' + setup.train0 + '→' + r3.train1 + '（Δ=' + (r3.train1 - setup.train0) + '，同应 ≈4200）');
  console.log('  队列条数=' + r3.nTrain + ' | _loopLastAt 距现在=' + gapMs + 'ms');
  console.log('  watch 最近调用：');
  r3.watch.forEach(function (w) {
    console.log('    gap=' + w.gap + ' mode=' + (w.mode || ('ERR ' + w.err)));
  });

  /* ④ 8h 拨钟（复杂状态下的 bulk 路径） */
  console.log('════ ④ 拨钟 8h（bulk 路径）════');
  var r4 = await p.evaluate(function () {
    var G = window.GAME, s = G.state;
    var w0 = s.world.elapsed, t0 = s.queues.train[0] ? s.queues.train[0].elapsed : -1;
    G._loopLastAt = Date.now() - 8 * 3600 * 1000;
    return { w0: w0, t0: t0 };
  });
  await new Promise(function (r) { setTimeout(r, 4000); });
  var r5 = await p.evaluate(function () {
    var G = window.GAME, s = G.state;
    return { world1: s.world.elapsed, train1: s.queues.train.length ? s.queues.train[0].elapsed : -1,
      nTrain: s.queues.train.length, reports: (s.reports || []).length,
      watch: window.__watch.slice(-6) };
  });
  console.log('world ' + r4.w0 + '→' + r5.world1 + '（Δ=' + (r5.world1 - r4.w0) + '，8h×120 应为 3,456,000）');
  console.log('train ' + r4.t0 + '→' + r5.train1 + '（Δ=' + (r5.train1 - r4.t0) + '）队列=' + r5.nTrain);
  r5.watch.forEach(function (w) {
    console.log('    gap=' + w.gap + ' mode=' + (w.mode || ('ERR ' + w.err)));
  });
  await b.close();
  process.exit(0);
})();
