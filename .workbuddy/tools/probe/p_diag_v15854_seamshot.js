'use strict';
/* v158.54 接缝实机取景：把相机对准 cube-sphere 一条棱（两共享面中垂线），
   拍"修前/修后"对照。退出飞行态、停自转、用 lookAtDir 精确对准棱中点。 */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';
const tag = process.argv[2] || 'before';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'Z', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 150; i++) {
    const st = await p.evaluate(() => ({ g: !!(GAME.map3d && GAME.map3d._globe) }));
    if (st.g) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const M = GAME.map3d;
    M.setSpin(false); M._lastAct = Date.now();
    /* v158.53 飞行态接管机位：直接设 fly 状态，把战舰放到球外 2.6R、机头指向球心，
       沿 cube 棱方向 (+X,+Y)。相机在机头后方，正好看向这条棱的球面。 */
    M.setFollow && M.setFollow(false);
    M.surfaceMode && M.surfaceMode(false);
    const R = 300, s = 1 / Math.SQRT2, d = [s, s, 0];
    if (!M._fly) M._fly = { v: 0, trail: [], trailAt: 0 };
    M._fly.pos = [d[0] * R * 2.6, d[1] * R * 2.6, d[2] * R * 2.6];
    M._fly.head = [-d[0], -d[1], -d[2]];
    M._fly.vel = M._fly.head.slice();
    M._fly.up = [0, 0, 1]; M._fly.v = 0; M._fly.active = true;
  });
  await p.waitForTimeout(700);
  /* 等首次构建遮罩消失，把太阳打到镜头侧，让球面着色可见 */
  for (let i = 0; i < 60; i++) {
    const ov = await p.evaluate(() => { const o = document.getElementById('boot-loading'); return o ? o.classList.contains('on') : false; });
    if (!ov) break;
    await p.waitForTimeout(200);
  }
  await p.evaluate(() => {
    const M = GAME.map3d;
    if (M._sunDir) { M._sunDir[0] = 1 / Math.SQRT2; M._sunDir[1] = 1 / Math.SQRT2; M._sunDir[2] = 0; }
    if (M.applyLight) M.applyLight();
    M.setSpin(false); M._lastAct = Date.now();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + 'v15854-seam-' + tag + '.png' });
  const st = await p.evaluate(() => {
    const M = GAME.map3d;
    return { surf: M._surf, fly: !!(M._fly && M._fly.active), zoom: M.zoomFrac ? M.zoomFrac() : null,
      atlas: M._colAtlasErr, err: M._flErr1 || null };
  });
  console.log(tag + ' · ' + JSON.stringify(st));
  await b.close();
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
