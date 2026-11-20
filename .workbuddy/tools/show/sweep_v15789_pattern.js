/* v157.89e · 全缩放档周期性扫描（找"还有规律斑纹"的档位）
   用法：node .workbuddy/tools/show/sweep_v15789_pattern.js
   判据：陆地 ROI 高通后自相关峰值；>0.15 视为"看得出规律纹"。 */
const { chromium } = require('playwright-core');
const ZOOMS = [0, 0.02, 0.05, 0.08, 0.12, 0.18, 0.25, 0.34, 0.45, 0.6];

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
    await p.evaluate(function (z) {
      var M = window.GAME.map3d;
      M.lookAtDir([0.2, 0.25, 1]);
      if (M.setZoom) M.setZoom(z);
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, z);
    await p.waitForTimeout(1600);
    await p.evaluate(function () { window.GAME.ui.renderMapCanvas && window.GAME.ui.renderMapCanvas(); });
    await p.waitForTimeout(400);
    const tag = String(Math.round(z * 1000)).padStart(4, '0');
    await p.screenshot({ path: '.workbuddy/tmp/sw_' + tag + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ zooms: ZOOMS, errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
