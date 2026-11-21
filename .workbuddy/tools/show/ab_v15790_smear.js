/* v157.90 · 近距离"拉丝/糊"归因：同一相机，逐个关掉贴图与颗粒
   用法：node .workbuddy/tools/show/ab_v15790_smear.js
   输出：.workbuddy/tmp/sm_<variant>.png */
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
    G.map3d.setLight({ mode: 'ambient', term: 0 });   /* 统一照明，排除昼夜线干扰 */
    /* 首都所在地块的方向 —— 保证画面里是陆地 */
    try {
      var st2 = window.GAME.state, c0 = (st2.cities && st2.cities[0]) || null;
      var ci = c0 ? (c0.ci != null ? c0.ci : c0.cell) : null;
      var SP = window.GAME.sphere;
      if (ci != null && SP.cells[ci] && SP.cells[ci].dir) {
        var d0 = SP.cells[ci].dir;
        window.__landDir = { x: d0[0], y: d0[1], z: d0[2] };
      }
    } catch (e) { }
  });
  await p.waitForTimeout(7000);

  const base = { map: true, detail: 1 };
  const VAR = [
    { tag: 'base', map: true, detail: 1 },
    { tag: 'noMap', map: false, detail: 1 },
    { tag: 'noDetail', map: true, detail: 0 },
    { tag: 'neither', map: false, detail: 0 }
  ];

  for (const v of VAR) {
    await p.evaluate(function (o) {
      var M = window.GAME.map3d;
      M.setDetail(o.detail);
      var d = window.__landDir || (M._sunDir || { x: 0, y: 1, z: 0 });
      M.lookAtDir([d.x, d.y, d.z]);
      if (M.setZoom) M.setZoom(0.10);
      var g = M._globe;
      if (g && g.material) { if (!M._globeMapTex) M._globeMapTex = g.material.map; g.material.map = o.map ? M._globeMapTex : null; }
      if (g && g.material) g.material.needsUpdate = true;
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, v);
    await p.waitForTimeout(1500);
    await p.evaluate(function () { window.GAME.ui.renderMapCanvas && window.GAME.ui.renderMapCanvas(); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: '.workbuddy/tmp/sm_' + v.tag + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
