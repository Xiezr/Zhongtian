'use strict';
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2600);

  const S = (t) => p.evaluate((tag) => {
    const m = document.querySelector('.modal-mask');
    return {
      tag,
      open: !!m,
      head: m ? ((m.querySelector('.gold-heading') || {}).textContent || '').trim() : '',
      txt: m ? (m.textContent || '').replace(/\s+/g, ' ').slice(0, 420) : '',
      hasRes: m ? /资源地块/.test(m.textContent || '') : false,
      hasScan: !!document.querySelector('[data-action="res-scan"]')
    };
  }, t).then((x) => { console.log(x.tag + ':', JSON.stringify(x)); return x; });

  /* 找一个 fog=0 的工业地形格并点开（开局画面中部） */
  const find = await p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere;
    const cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
    for (let gy = 0.25; gy < 0.8; gy += 0.02) {
      for (let gx = 0.25; gx < 0.8; gx += 0.02) {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(gx * 2 - 1, -(gy * 2 - 1)), M._cam);
        const ci = M.pickCiByRay(rc, null); const c = SP.cells[ci];
        if (!c) continue;
        const fog = (GAME.fog && GAME.fog.get(ci)) || 0;
        if (fog === 0 && (c.type === 'hill' || c.type === 'forest' || c.type === 'desert'))
          return { ci, type: c.type, fog, x: Math.round(r.left + r.width * gx), y: Math.round(r.top + r.height * gy) };
      }
    }
    return null;
  });
  console.log('未探明工业格:', JSON.stringify(find));
  if (find) {
    await p.mouse.click(find.x, find.y);
    await p.waitForTimeout(1000);
    await S('点未探明林/山');
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/pjourney/31_unfogged.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  }

  /* 对照：平原（非工业地形）点开是什么 */
  const find2 = await p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere;
    const cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
    for (let gy = 0.25; gy < 0.8; gy += 0.02) {
      for (let gx = 0.25; gx < 0.8; gx += 0.02) {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(gx * 2 - 1, -(gy * 2 - 1)), M._cam);
        const ci = M.pickCiByRay(rc, null); const c = SP.cells[ci];
        if (c && c.type === 'plain')
          return { ci, type: c.type, x: Math.round(r.left + r.width * gx), y: Math.round(r.top + r.height * gy) };
      }
    }
    return null;
  });
  console.log('平原格:', JSON.stringify(find2));
  if (find2) {
    await p.mouse.click(find2.x, find2.y);
    await p.waitForTimeout(1000);
    await S('点平原');
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  }
  await b.close();
})();
