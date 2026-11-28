'use strict';
/* v158.55 实机图：右键拖过球心前后，确认球面不翻面、战舰与 HUD 完好 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';
const L = []; const log = (s) => { L.push(s); console.log(s); };
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(900);
  /* 飞行机位对准球，太阳打到镜头侧 */
  await p.evaluate(() => {
    const M = GAME.map3d, R = 300, s = 1 / Math.SQRT2;
    M.setFollow && M.setFollow(false);
    M._fly = M._fly || { v: 0, trail: [], trailAt: 0 };
    M._fly.pos = [s * R * 2.6, s * R * 2.6, 0];
    M._fly.head = [-s, -s, 0]; M._fly.vel = M._fly.head.slice();
    M._fly.up = [0, 0, 1]; M._fly.v = 0; M._fly.active = true;
    if (M._sunDir) { M._sunDir[0] = s; M._sunDir[1] = s; M._sunDir[2] = 0; }
    if (M.applyLight) M.applyLight();
    M.setSpin && M.setSpin(false); M._lastAct = Date.now();
  });
  for (let i = 0; i < 40; i++) {
    const ov = await p.evaluate(() => { const o = document.getElementById('boot-loading'); return o ? o.classList.contains('on') : false; });
    if (!ov) break; await p.waitForTimeout(200);
  }
  await p.waitForTimeout(600);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = box.x + box.width / 2, CY = box.y + box.height / 2;
  await p.screenshot({ path: SHOTS + 'v15855-look-before.png' });
  log('before: ' + JSON.stringify(await p.evaluate(() => ({ head: GAME.map3d._fly.head, up: GAME.map3d._fly.up }))));
  /* 右键长按向上拖 240px —— 旧版在这一段会翻转弹跳 */
  await p.mouse.move(CX, CY);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 30; i++) {
    await p.mouse.move(CX, CY - i * 8);
    await p.waitForTimeout(14);
  }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: SHOTS + 'v15855-look-after.png' });
  const st = await p.evaluate(() => ({ head: GAME.map3d._fly.head, up: GAME.map3d._fly.up,
    bank: GAME.map3d._bankAngle, err: GAME.map3d._flErr1 || null }));
  log('after: ' + JSON.stringify(st));
  log('页面异常: ' + (errs.length ? errs.join(' | ') : '无'));
  fs.writeFileSync(ROOT + '/.workbuddy/tmp/shot_v15855.log', L.join('\n'), 'utf8');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
