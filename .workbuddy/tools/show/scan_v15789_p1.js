/* v15789 P1 · 颗粒强度扫参（运行时改 uDetAmp，不重建）
   输出：每个 (zoom, amp) 的截图 + 数值，供选默认值。
   用法：node .workbuddy/tools/show/scan_v15789_p1.js */
const { chromium } = require('playwright-core');
const ZOOMS = [0.13, 0.22];
const AMPS = [0, 0.22];

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForTimeout(7000);

  for (const z of ZOOMS) {
    for (const a of AMPS) {
      await p.evaluate(function (o) {
        var M = window.GAME.map3d;
        M._detailAmpU.value = o.a;
        M.lookAtDir([0.2, 0.25, 1]);
        if (M.setZoom) M.setZoom(o.z);
        if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
      }, { z: z, a: a });
      await p.waitForTimeout(1200);
      await p.evaluate(function () {
        if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
      });
      await p.waitForTimeout(400);
      const tag = Math.round(z * 100) + '_a' + String(Math.round(a * 100)).padStart(3, '0');
      await p.screenshot({ path: '.workbuddy/tmp/s1_' + tag + '.png', animations: 'disabled' });
    }
  }
  console.log(JSON.stringify({ n: ZOOMS.length * AMPS.length, errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
