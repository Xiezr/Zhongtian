/* v157.82 取证：视野边界「柔光化 + 恢复遮挡」。
   证据三件：
     ① 探针：depthTest=true、hasMap=true（渐贴在）、segs>0
     ② 视觉：近 / 中 / 远 三档 + 裁剪放大（看横截面渐变）
     ③ 遮挡：把星球转到「探明区在球背面」的角度，正面不应再看到那条边
        （v157.79 的 depthTest:false 会让它穿透显示 = 老板说的"球体透明"） */
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
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
  });

  /* ---- reveal 一片（以相机正对格为心，保证在画面里） ---- */
  const grow = await p.evaluate(function () {
    var G = window.GAME, F = G.fog, M = G.map3d;
    var cd = M._cam.position.clone().normalize();
    var ci = G.sphere.nearestCell([cd.x, cd.y, cd.z]);
    F.revealAround(ci, 9, 2);
    var kn = 0;
    for (var i = 0; i < G.sphere.cells.length; i++) if (F.get(i) > 0) kn++;
    return { ci: ci, known: kn, ver: F.ver() };
  });
  await p.waitForTimeout(1500);
  console.log('reveal ' + JSON.stringify(grow));

  const probe = await p.evaluate(() => {
    const pr = window.GAME.map3d._fogEdgeProbe();
    return { segs: pr.segs, visible: pr.visible, depthTest: pr.depthTest, hasMap: pr.hasMap };
  });
  console.log('probe ' + JSON.stringify(probe));

  /* ---- 三档视野出图（setZoom：0 近 · 1 远）---- */
  for (var _i = 0; _i < 3; _i++) {
    var _f = [0.30, 0.58, 0.82][_i], _tag = ['near', 'mid', 'far'][_i];
    await p.evaluate(function (f) { window.GAME.map3d.setZoom(f); }, _f);
    await p.waitForTimeout(1000);
    await p.screenshot({ path: '.workbuddy/tmp/v15782-' + _tag + '.png' });
    console.log('shot ' + _tag + ' frac=' + _f);
  }

  /* ---- 遮挡验证：横向拖 628px ≈ 180°，把探明区转到球背面 ---- */
  await p.evaluate(function () { window.GAME.map3d.setZoom(0.58); });
  await p.waitForTimeout(900);
  await p.mouse.move(box.cx - 314, box.cy);
  await p.mouse.down();
  for (var _x = box.cx - 314; _x <= box.cx + 314; _x += 4) await p.mouse.move(_x, box.cy);
  await p.mouse.up();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/tmp/v15782-backside.png' });
  var _probe2 = await p.evaluate(function () {
    var pr = window.GAME.map3d._fogEdgeProbe();
    return { segs: pr.segs, visible: pr.visible, depthTest: pr.depthTest };
  });
  console.log('backside probe ' + JSON.stringify(_probe2));

  console.log('ver=' + await p.evaluate(() => window.GAME.VERSION) +
    ' · pageerrors=' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
