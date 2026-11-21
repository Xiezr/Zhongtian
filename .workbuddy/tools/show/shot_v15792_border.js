/* v157.92 · 地貌交界锯齿：找一处"相邻两格类型不同"的位置拍对照
   用法：MODE=before|after node .workbuddy/tools/show/shot_v15792_border.js */
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
  const pick = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
    var SP = G.sphere, sd = G.map3d._sunDir;
    var best = null, bestS = -9;
    for (var i = 0; i < SP.cells.length; i++) {
      var c = SP.cells[i]; if (!c || !c.dir || !c.type) continue;
      if (/lake|sea|ocean|water/i.test(c.type)) continue;
      var adj = (SP.adj && SP.adj[i]) || [];
      var diff = 0;
      for (var k = 0; k < adj.length; k++) {
        var n = SP.cells[adj[k]];
        if (n && n.type && n.type !== c.type && !/lake|sea|ocean|water/i.test(n.type)) diff++;
      }
      if (!diff) continue;
      var s = c.dir[0] * sd.x + c.dir[1] * sd.y + c.dir[2] * sd.z;
      var score = s * 2 + diff * 0.2;
      if (score > bestS) { bestS = score; best = { dir: [c.dir[0], c.dir[1], c.dir[2]], type: c.type, diff: diff, sun: +s.toFixed(2) }; }
    }
    return best;
  });
  console.log('PICK=' + JSON.stringify(pick));
  await p.waitForTimeout(8000);
  const views = [{ z: 0.09, tag: 'near' }, { z: 0.16, tag: 'mid' }];
  for (const v of views) {
    await p.evaluate(function (o) {
      var M = window.GAME.map3d;
      M.setDetail(0); M.setRelief(1);
      M.lookAtDir(o.d); if (M.setZoom) M.setZoom(o.z);
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, { d: pick.dir, z: v.z });
    await p.waitForTimeout(1600);
    await p.evaluate(function () { window.GAME.ui.renderMapCanvas && window.GAME.ui.renderMapCanvas(); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: '.workbuddy/tmp/bd_' + MODE + '_' + v.tag + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ mode: MODE, errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
