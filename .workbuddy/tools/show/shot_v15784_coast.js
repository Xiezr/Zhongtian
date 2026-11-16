/* 海岸视角复现老板截图：把视线放到首府所在格，高度 130/80/55 各一张。
   目的是看"海 + 陆地交界"处修完云雾后是否还有色斑。 */
const { chromium } = require('playwright-core');
const OUT = '.workbuddy/tmp/';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.setSpin(false); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(4500);

  const info = await p.evaluate(function () {
    var G = window.GAME, SP = G.sphere;
    var c = (G.city && G.city.all && G.city.all()[0]) || null;
    var d = null;
    if (c && typeof c.ci === 'number' && SP.cells[c.ci]) d = SP.cells[c.ci].dir;
    if (!d) {
      for (var i = 0; i < SP.cells.length; i++) if (SP.cells[i].type === 'lake' && SP.cells[i].dir) { d = SP.cells[i].dir; break; }
    }
    window.__coast = d;
    return { name: c && c.name, ci: c && c.ci, type: c && SP.cells[c.ci] ? SP.cells[c.ci].type : null };
  });
  console.log('中心 = ' + JSON.stringify(info));

  for (const agl of [130, 80, 58]) {
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      M.lookAtDir(window.__coast);
      var d = M.R + a;
      var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
      M.setZoom(Math.max(0, Math.min(1, f)));
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }, agl);
    await p.waitForTimeout(1400);
    await p.screenshot({ path: OUT + 'v15784_coast_' + agl + '.png' });
    const st = await p.evaluate(function () {
      var M = window.GAME.map3d;
      return { agl: +(M.camO.dist - M.R).toFixed(1), surf: !!M._surf,
        veil: +(M._cloudVeil || 0).toFixed(3), haze: +(M._cloudHaze || 0).toFixed(3) };
    });
    console.log('agl=' + agl + ' → ' + JSON.stringify(st));
  }
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
