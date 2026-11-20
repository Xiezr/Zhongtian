/* v15789 P0：球体受光化 —— 改前/改后对照图（三角度）
   用法：MODE=before node .workbuddy/tools/show/shot_v15789_p0.js
        MODE=after  node .workbuddy/tools/show/shot_v15789_p0.js
   判据由像素体检脚本读图（不靠肉眼）。 */
const { chromium } = require('playwright-core');
const MODE = process.env.MODE || 'before';
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  const boot = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
    var M = G.map3d;
    /* 采样法线：确认「径向」还是「真地形法线」（改前应全等径向） */
    var g = M._globe && M._globe.geometry;
    var nrm = null, rad = null, dev = null;
    if (g && g.attributes && g.attributes.normal && g.attributes.position) {
      var pa = g.attributes.position.array, na = g.attributes.normal.array;
      var maxDev = 0, sumDev = 0, cnt = 0;
      for (var i = 0; i < pa.length; i += 3 * 997) {
        var L = Math.sqrt(pa[i] * pa[i] + pa[i + 1] * pa[i + 1] + pa[i + 2] * pa[i + 2]) || 1;
        var rx = pa[i] / L, ry = pa[i + 1] / L, rz = pa[i + 2] / L;
        var d = rx * na[i] + ry * na[i + 1] + rz * na[i + 2];
        var ang = Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
        sumDev += ang; cnt++; if (ang > maxDev) maxDev = ang;
      }
      dev = { samples: cnt, maxDeg: +maxDev.toFixed(2), avgDeg: +(sumDev / cnt).toFixed(2) };
    }
    return { ver: G.VERSION, normalDev: dev };
  });
  await p.waitForTimeout(6000);   /* 等分帧构建完成，再采法线 */
  const nrm = await p.evaluate(function () {
    var M = window.GAME.map3d, g = M._globe && M._globe.geometry;
    if (!g || !g.attributes.normal || !g.attributes.position) return null;
    var pa = g.attributes.position.array, na = g.attributes.normal.array;
    var maxDev = 0, sumDev = 0, cnt = 0;
    for (var i = 0; i < pa.length; i += 3 * 997) {
      var L = Math.sqrt(pa[i] * pa[i] + pa[i + 1] * pa[i + 1] + pa[i + 2] * pa[i + 2]) || 1;
      var d = (pa[i] / L) * na[i] + (pa[i + 1] / L) * na[i + 1] + (pa[i + 2] / L) * na[i + 2];
      var ang = Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
      sumDev += ang; cnt++; if (ang > maxDev) maxDev = ang;
    }
    return { samples: cnt, maxDeg: +maxDev.toFixed(2), avgDeg: +(sumDev / cnt).toFixed(2) };
  });
  console.log('NORMAAL_DEV=' + JSON.stringify(nrm));
  const views = [
    { tag: 'a', dir: [0, 0.42, 1], zoom: 0.24, note: '近景高空斜视' },
    { tag: 'b', dir: [0.30, 0.16, 1], zoom: 0.34, note: '近景中纬' },
    { tag: 'c', dir: [-0.35, 0.28, 1], zoom: 0.44, note: '侧光斜视' }
  ];
  const out = [];
  for (const v of views) {
    await p.evaluate(function (v) {
      var M = window.GAME.map3d;
      M.lookAtDir(v.dir);
      if (M.setZoom) M.setZoom(v.zoom);
      try { if (M._paintGlobeExplore) M._paintGlobeExplore(); } catch (e) { }
      if (window.GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }, v);
    await p.waitForTimeout(1400);
    const path = '.workbuddy/tmp/v15789_p0_' + MODE + '_' + v.tag + '.png';
    await p.screenshot({ path: path, animations: 'disabled' });
    out.push(path);
  }
  console.log(JSON.stringify({ mode: MODE, boot: boot, shots: out, errs: errs.slice(0, 3) }));
  await b.close();
})();
