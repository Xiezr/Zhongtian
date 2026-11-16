/* 半球场对照图：把东半球点亮 → 已探索 ×1.15 / 未探索 ×0.9 → 一眼看出明暗差，
   同时确认「没有边界线」。 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  const r = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
    var SP = G.sphere, F = G.fog, n = 0;
    for (var i = 0; i < SP.cells.length; i++) {
      var c = SP.cells[i]; if (!c || !c.dir) continue;
      var lon = Math.atan2(c.dir[0], c.dir[2]) * 180 / Math.PI;
      if (lon > -100 && lon < 100) { try { F.revealAround(i, 0, 2); n++; } catch (e) { } }
    }
    var M = G.map3d;
    M.lookAtDir([0, 0.25, 1]);
    if (M.setZoom) M.setZoom(0.30);
    try { M._paintGlobeExplore(); } catch (e) { }
    if (G.ui && G.ui.renderMapCanvas) G.ui.renderMapCanvas();
    return { revealed: n, lit: M._globeExploreLit, LIT: M.EXPLORE_LIT, DIM: M.EXPLORE_DIM };
  });
  await p.waitForTimeout(7000);   /* 等分帧构建 + 遮罩撤掉 */
  await p.evaluate(function () { var M = window.GAME.map3d; M._paintGlobeExplore(); if (GAME.ui) GAME.ui.renderMapCanvas(); });
  await p.waitForTimeout(900);
  await p.screenshot({ path: '.workbuddy/tmp/v15786_half.png' });
  console.log(JSON.stringify(r) + ' · 页面异常 ' + errs.length);
  await b.close();
})();
