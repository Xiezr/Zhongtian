/* v157.80 交付出图：连续上拖 2 轮（越过极点）后截图 + 中途一帧。 */
const { chromium } = require('playwright-core');

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
    try { G.map3d.resetView(); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(6000);

  const box = await p.evaluate(() => {
    const c = document.querySelector('#map-canvas') || document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { cx: r.x + r.width / 2, top: r.y + 14, bot: r.y + r.height - 14 };
  });

  const readDir = () => p.evaluate(() => {
    const d = window.GAME.map3d._cam.position.clone().normalize();
    return [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)];
  });

  async function upOnce() {
    await p.mouse.move(box.cx, box.bot);
    await p.mouse.down();
    for (let y = box.bot; y >= box.top; y -= 3) await p.mouse.move(box.cx, y);
    await p.mouse.up();
    await p.waitForTimeout(250);
  }

  console.log('start ' + JSON.stringify(await readDir()));
  await upOnce();
  console.log('after up1 ' + JSON.stringify(await readDir()));
  await p.screenshot({ path: '.workbuddy/tmp/v15780-pole-after1.png' });

  await upOnce();
  console.log('after up2 ' + JSON.stringify(await readDir()));
  await p.screenshot({ path: '.workbuddy/tmp/v15780-pole-after2.png' });

  console.log('ver=' + await p.evaluate(() => window.GAME.VERSION) + ' · pageerrors=' + errs.length +
    (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
