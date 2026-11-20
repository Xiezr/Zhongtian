/* v157.89d · 网点归属：同一相机，颗粒层开/关各一张（zoom 0.05 贴地）
   用法：node .workbuddy/tools/show/ab_v15789_grain.js */
const { chromium } = require('playwright-core');
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
  for (const v of [{rep:120,amp:0.12,tag:'on',z:0.05},{rep:120,amp:0,tag:'off',z:0.05},{rep:120,amp:0.12,tag:'on13',z:0.13},{rep:120,amp:0,tag:'off13',z:0.13}]) {
    await p.evaluate(function (v) {
      var M = window.GAME.map3d;
      M.setGrainRep(v.rep); M._detailAmpU.value = v.amp; M.setDetail(v.amp > 0 ? 1 : 0); M.setRelief(1);
      M.lookAtDir([0.2, 0.25, 1]);
      if (M.setZoom) M.setZoom(v.z);
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, v);
    await p.waitForTimeout(1600);
    await p.evaluate(function () { window.GAME.ui.renderMapCanvas && window.GAME.ui.renderMapCanvas(); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: '.workbuddy/tmp/ab_grain_' + v.tag + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
