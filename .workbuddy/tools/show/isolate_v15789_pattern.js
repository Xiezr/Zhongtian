/* v157.89e · 斑纹归因：逐层关闭 + 周期性度量
   用法：node .workbuddy/tools/show/isolate_v15789_pattern.js
   输出：.workbuddy/tmp/iso_<层>.png（整图）+ 控制台周期性分数 */
const { chromium } = require('playwright-core');

const VARIANTS = [
  { tag: 'base', apply: '' },
  { tag: 'noDetail', apply: 'M.setDetail(0);' },
  { tag: 'noMap', apply: 'var g=M._globe; if(g&&g.material){g.material.map=null;g.material.needsUpdate=true;}' },
  { tag: 'noSky', apply: 'if(M._sky) M._sky.visible=false;' },
  { tag: 'noWater', apply: 'if(M._water) M._water.visible=false;' },
  { tag: 'noTone', apply: 'M.setRelief(0);' }
];

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

  for (const v of VARIANTS) {
    await p.evaluate(function (code) {
      var M = window.GAME.map3d;
      M.lookAtDir([0.2, 0.25, 1]);
      if (M.setZoom) M.setZoom(0.05);
      if (code) { try { eval(code); } catch (e) { } }
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    }, v.apply);
    await p.waitForTimeout(1500);
    await p.evaluate(function () {
      if (window.GAME.ui.renderMapCanvas) window.GAME.ui.renderMapCanvas();
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: '.workbuddy/tmp/iso_' + v.tag + '.png', animations: 'disabled' });
  }
  console.log(JSON.stringify({ variants: VARIANTS.map(v => v.tag), errs: errs.slice(0, 2) }));
  await b.close();
})().catch(e => { console.error('FAIL ' + (e && e.stack || e)); process.exit(1); });
