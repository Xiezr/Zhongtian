/* v89.174 复现 B：默认 120 倍速下的两个嫌疑
   ① "00:00 窗口"：显示剩余 = round(现实秒) → 0.4 秒时显示 "00:00"，但 tick 未到 → "读秒 00:00 还在建造中"
   ② 施工弹窗：打开后等待完成 —— 弹窗是否换形态 / 文本变什么（v89.171 提速小窗有"完成即关"先例）
   不篡改 totalTime（用真实曲线），ts 保持默认 120。
   运行：NODE_PATH=".../node_modules" node .workbuddy/tools/play/repro_v89174b_window.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var info = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '复现174b', cityName: '灰岗', region: '碎垣', mapSeed: 20260974 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    var city = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(city)[k] = 1e8; });
    var empties = [];
    city.cells.forEach(function (c, i) { if (!c.build && !c.pending && !c.official) empties.push(i); });
    var rA = G.buildAt(city.id, empties[0], 'minfang');
    var rB = G.buildAt(city.id, empties[1], 'minfang');
    var qs = G.state.queues.build;
    return {
      okA: rA.ok, okB: rB.ok, idxA: empties[0], idxB: empties[1],
      ts: G.timeScale(),
      tA: qs[qs.length - 2] ? qs[qs.length - 2].totalTime : null,
      tB: qs[qs.length - 1] ? qs[qs.length - 1].totalTime : null,
    };
  });
  console.log('  造局：A=' + info.okA + ' B=' + info.okB + ' · ts=' + info.ts
    + ' · totalTimeA=' + info.tA + '（@' + info.ts + 'x ≈ ' + (info.tA / info.ts).toFixed(1) + ' 现实秒）'
    + ' · totalTimeB=' + info.tB);

  /* B：打开施工弹窗（v89.174 场景②） */
  await p.evaluate(function (ii) { window.GAME.ui.openBuildModal(ii.idxB); }, info);
  console.log('  已打开 B 的施工弹窗');

  console.log('===== 逐秒采样（@' + info.ts + 'x）=====');
  for (var t = 1; t <= 10; t++) {
    await p.waitForTimeout(1000);
    var s = await p.evaluate(function (ii) {
      var G = window.GAME;
      var city = G.currentCity();
      var qA = null;
      G.state.queues.build.forEach(function (q) { if (q.gridIndex === ii.idxA) qA = q; });
      var prA = G.buildProgress('city', ii.idxA);
      var pctElA = document.querySelector('[data-build-progress="city:' + ii.idxA + '"]');
      var hostA = document.querySelector('[data-action="build-cell"][data-idx="' + ii.idxA + '"]');
      var m = document.querySelector('#modal-root');
      var mtxt = m ? m.textContent : '';
      var mp = m ? m.querySelector('[data-modal-progress]') : null;
      return {
        qlen: G.state.queues.build.length,
        qA: qA ? { e: Math.round(qA.elapsed), T: qA.totalTime, left: ((qA.totalTime - qA.elapsed) / G.timeScale()).toFixed(2) } : null,
        gridTxt: pctElA ? pctElA.textContent : null,
        hostBusy: hostA ? hostA.className.indexOf('busy') >= 0 : null,
        modalBuilding: mtxt.indexOf('建造中') >= 0,
        mpTxt: mp ? mp.textContent : null,
        prA: prA ? prA.label : null,
      };
    }, info);
    console.log('  t=' + t + 's q=' + s.qlen
      + '  A[qA=' + (s.qA ? (s.qA.e + '/' + s.qA.T + ' left=' + s.qA.left) : '-')
      + ' grid=' + JSON.stringify(s.gridTxt) + ' busy=' + s.hostBusy + ']'
      + '  B[弹窗' + (s.modalBuilding ? '建造中' : '-') + ' pct=' + JSON.stringify(s.mpTxt) + ']');
  }
  await p.screenshot({ path: OUT + 'v89174b-window.png', fullPage: false });
  console.log('（截图 v89174b-window.png）');
  await b.close();
  process.exit(0);
})();
