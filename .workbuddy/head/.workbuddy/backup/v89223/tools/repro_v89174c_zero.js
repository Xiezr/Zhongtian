/* v89.174 复现 C：00:00 窗口 —— 非整除时长（610 游戏秒 @120x）下的"读秒 00:00 但 busy 仍在"
   200ms 采样，抓同帧（显示 00:00 && 格子 busy && 队列仍在）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var info = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '复现174c', cityName: '许都', region: '碎垣', mapSeed: 20260974 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    var city = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(city)[k] = 1e8; });
    var e0 = null;
    city.cells.forEach(function (c, i) { if (e0 == null && !c.build && !c.pending && !c.official) e0 = i; });
    var r = G.buildAt(city.id, e0, 'minfang');
    var q = G.state.queues.build[G.state.queues.build.length - 1];
    q.totalTime = 610; q.elapsed = 0;      /* 610 % 120 ≠ 0 → left 尾数 0.083 → round 成 00:00 */
    return { ok: r.ok, idx: e0, T: q.totalTime, ts: G.timeScale() };
  });
  console.log('  造局：' + info.ok + ' · idx=' + info.idx + ' · totalTime=' + info.T + ' · ts=' + info.ts
    + '（尾数 left=' + ((info.T % info.ts) / info.ts).toFixed(3) + ' 秒）');

  var hit = 0, samples = 0, last = '';
  for (var t = 0; t < 60; t++) {           /* 60 × 200ms = 12 秒 */
    await p.waitForTimeout(200);
    var s = await p.evaluate(function (ii) {
      var G = window.GAME;
      var q = null;
      G.state.queues.build.forEach(function (x) { if (x.gridIndex === ii.idx) q = x; });
      var host = document.querySelector('[data-action="build-cell"][data-idx="' + ii.idx + '"]');
      var el = document.querySelector('[data-build-progress="city:' + ii.idx + '"]');
      return {
        q: !!q,
        e: q ? Math.round(q.elapsed) : null,
        left: q ? (q.totalTime - q.elapsed) / G.timeScale() : null,
        busy: host ? host.className.indexOf('busy') >= 0 : null,
        txt: el ? el.textContent : null,
      };
    }, info);
    samples++;
    var line = 't=' + (t * 0.2).toFixed(1) + 's q=' + (s.q ? 1 : 0)
      + ' left=' + (s.left == null ? '-' : s.left.toFixed(3))
      + ' txt=' + JSON.stringify(s.txt) + ' busy=' + s.busy;
    if (line !== last) { console.log('  ' + line); last = line; }
    /* 同帧判据：显示 "00:00" 且 busy=true（队列仍在跑） */
    if (s.txt && s.txt.indexOf('00:00') >= 0 && s.busy === true) hit++;
  }
  console.log('');
  console.log('  ★ "00:00 且 busy" 同帧采样数 = ' + hit + ' / ' + samples);
  console.log(hit > 0 ? '  ✅ 复现：读秒显示 00:00 时格子仍在"建造中"（ceil 修复目标）' : '  ⚠ 未复现');
  await b.close();
  process.exit(0);
})();
