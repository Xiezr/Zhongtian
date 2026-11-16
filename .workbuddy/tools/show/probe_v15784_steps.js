/* 高度阶梯：固定视线对准同一片纯海，逐档高度截图（8/20/35/50/54/56/60/80/130），
   每档报告 surf / veil / haze 与画面主色。用来确认"哪一档开始出现异色"。 */
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

  const spot = await p.evaluate(function () {
    var SP = window.GAME.sphere, cells = SP.cells, adj = SP.adj;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].type !== 'lake') continue;
      var an = adj[i] || [], ok = true;
      for (var k = 0; k < an.length; k++) if (cells[an[k]].type !== 'lake') { ok = false; break; }
      if (ok && cells[i].dir) return cells[i].dir;
    }
    return null;
  });

  await p.evaluate(function (d) { window.__spot2 = d; }, spot);

  for (const agl of [130, 80, 60, 56, 54, 50, 35, 20, 8]) {
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      M.lookAtDir(window.__spot2);
      var d = M.R + a;
      var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
      M.setZoom(Math.max(0, Math.min(1, f)));
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }, agl);
    await p.waitForTimeout(1300);
    const st = await p.evaluate(function () {
      var M = window.GAME.map3d;
      return { agl: +(M.camO.dist - M.R).toFixed(1), surf: !!M._surf, veil: +(M._cloudVeil || 0).toFixed(3),
        haze: +(M._cloudHaze || 0).toFixed(3), surfVis: M._surfVis, fadeGround: +(M._fadeGround || 0).toFixed(2) };
    });
    await p.screenshot({ path: OUT + 'v15784_step_' + agl + '.png' });
    console.log('agl=' + String(agl).padStart(3) + ' → ' + JSON.stringify(st));
  }
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
