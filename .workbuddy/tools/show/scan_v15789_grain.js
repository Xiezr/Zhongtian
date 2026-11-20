/* v157.89d · 网点复核：不同 repeat 的近景截图 + 周期性度量
   用法：node .workbuddy/tools/show/scan_v15789_grain.js */
const { chromium } = require('playwright-core');
const REPS = [40];

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], cerr = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  p.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForTimeout(7000);

  for (const r of REPS) {
    await p.evaluate(function (rep) {
      var M = window.GAME.map3d;
      M.setGrainRep(rep);
      M.lookAtDir([0.2, 0.25, 1]);
      if (M.setZoom) M.setZoom(0.05);
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, r);
    await p.waitForTimeout(1500);
    await p.evaluate(function () {
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: '.workbuddy/tmp/g_close' + r + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ reps: REPS, errs: errs.slice(0, 2), consoleErr: cerr.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
