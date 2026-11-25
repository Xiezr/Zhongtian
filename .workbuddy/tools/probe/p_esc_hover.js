/* 查两件事：①Esc 到底能不能关面板 ②鼠标悬停时画面到底变了什么 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pjourney';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2600);

  /* 开一块地（用玩家入口：回本城 → 点城边的森林） */
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(3200);
  const hit = await p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere;
    const cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
    for (let gy = 0.2; gy < 0.8; gy += 0.02) {
      for (let gx = 0.2; gx < 0.8; gx += 0.02) {
        const x = r.left + r.width * gx, y = r.top + r.height * gy;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(gx * 2 - 1, -(gy * 2 - 1)), M._cam);
        const ci = M.pickCiByRay(rc, null);
        const c = SP.cells[ci];
        if (c && c.type === 'forest' && ((GAME.fog && GAME.fog.get(ci)) > 0)) return { ci, x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  });
  console.log('目标格:', JSON.stringify(hit));
  await p.mouse.click(hit.x, hit.y);
  await p.waitForTimeout(900);
  const st1 = await p.evaluate(() => ({
    open: !!document.querySelector('.modal-mask'),
    modalVisible: GAME.ui.modalVisible ? GAME.ui.modalVisible() : 'n/a',
    active: document.activeElement ? (document.activeElement.tagName + '#' + (document.activeElement.id || '') + '.' + String(document.activeElement.className).slice(0, 20)) : null
  }));
  console.log('点开后:', JSON.stringify(st1));

  /* Esc（三次不同目标都试：body / 面板里的按钮） */
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  console.log('Esc 第1次:', JSON.stringify(await p.evaluate(() => ({ open: !!document.querySelector('.modal-mask'), mv: GAME.ui.modalVisible ? GAME.ui.modalVisible() : 'n/a' }))));

  /* 若还开着，点面板里某个按钮让它焦点进去，再 Esc */
  await p.evaluate(() => {
    const bt = document.querySelector('[data-action="res-scan"]');
    if (bt) bt.focus();
  });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  console.log('Esc 第2次(按钮聚焦):', JSON.stringify(await p.evaluate(() => ({ open: !!document.querySelector('.modal-mask'), mv: GAME.ui.modalVisible ? GAME.ui.modalVisible() : 'n/a' }))));

  /* 用真实 dispatch 再试一次，看是不是 Playwright press 的问题 */
  await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true })));
  await p.waitForTimeout(700);
  console.log('Esc 第3次(dispatch):', JSON.stringify(await p.evaluate(() => ({ open: !!document.querySelector('.modal-mask'), mv: GAME.ui.modalVisible ? GAME.ui.modalVisible() : 'n/a' }))));

  /* ══ 悬停：同格内微动 vs 跨格移动，比较画布像素差 ══ */
  await p.evaluate(() => {
    window.__grab = function () {
      const cv = document.getElementById('mapCanvas');
      const c2 = document.createElement('canvas');
      c2.width = cv.width; c2.height = cv.height;
      c2.getContext('2d').drawImage(cv, 0, 0);
      return c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data;
    };
    window.__diff = function (a, b2) {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b2[i]) > 10 || Math.abs(a[i + 1] - b2[i + 1]) > 10 || Math.abs(a[i + 2] - b2[i + 2]) > 10) n++;
      }
      return n;
    };
  });
  const box = await p.evaluate(() => { const r = document.getElementById('mapCanvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__a = window.__grab(); });
  /* 同格内微动 6px */
  await p.mouse.move(box.x + box.w * 0.5 + 6, box.y + box.h * 0.5 + 4);
  await p.waitForTimeout(900);
  const sameCell = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  /* 跨一大片 */
  await p.mouse.move(box.x + box.w * 0.62, box.y + box.h * 0.58, { steps: 10 });
  await p.waitForTimeout(900);
  const crossCell = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  /* 完全不动，只等时间 */
  await p.waitForTimeout(900);
  const idle = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  console.log('像素差: 同格微动=' + sameCell + ' 跨格=' + crossCell + ' 静止等待=' + idle);
  await p.screenshot({ path: OUT + '/30_hover_check.png' });
  await b.close();
})();
