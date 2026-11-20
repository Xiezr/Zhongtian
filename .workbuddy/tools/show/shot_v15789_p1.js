/* v15789 P1 · 细节法线 A/B（detail 1 vs 0）× 三档缩放
   用法：node .workbuddy/tools/show/shot_v15789_p1.js
   输出：.workbuddy/tmp/p1_z<zoom>_d<0|1>.png */
const { chromium } = require('playwright-core');
const ZOOMS = [0.13, 0.34, 0.55];

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
    for (const d of [1, 0]) {
      await p.evaluate(function (args) {
        var M = window.GAME.map3d;
        M.setDetail(args.d);
        M.lookAtDir([0.2, 0.25, 1]);
        if (M.setZoom) M.setZoom(args.z);
        if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
      }, { z: z, d: d });
      await p.waitForTimeout(1400);
      await p.evaluate(function () {
        if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
      });
      await p.waitForTimeout(500);
      const tag = Math.round(z * 100);
      await p.screenshot({ path: '.workbuddy/tmp/p1_z' + tag + '_d' + d + '.png', animations: 'disabled' });
    }
  }
  console.log(JSON.stringify({ shots: ZOOMS.length * 2, errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
