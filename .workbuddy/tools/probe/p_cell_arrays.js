/* 两套格数组是否一致：sphere.cells vs mapSphere.cells vs _collider.cells */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1800);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(600);

  const d = await p.evaluate(() => {
    const M = GAME.map3d;
    const SP = GAME.sphere, MSP = GAME.mapSphere, COL = M._collider ? M._collider.cells : null;
    const city = GAME.currentCity();
    const ci = city ? city.ci : -1;
    const types = {};
    const cnt = (arr) => { const o = {}; for (let i = 0; i < arr.length; i++) { const c = arr[i]; if (c) o[c.type] = (o[c.type] || 0) + 1; } return o; };
    return {
      sameArray_sphere_mapSphere: SP && MSP && SP.cells === MSP.cells,
      sameArray_mapSphere_collider: MSP && COL && MSP.cells === COL,
      lens: { sphere: SP && SP.cells ? SP.cells.length : -1, mapSphere: MSP && MSP.cells ? MSP.cells.length : -1, collider: COL ? COL.length : -1 },
      city: { ci: ci, x: city && city.x, y: city && city.y, name: city && city.name },
      typeAtCi: {
        sphere: (SP && SP.cells && SP.cells[ci]) ? SP.cells[ci].type : null,
        mapSphere: (MSP && MSP.cells && MSP.cells[ci]) ? MSP.cells[ci].type : null,
        collider: (COL && COL[ci]) ? COL[ci].type : null
      },
      hist: { sphere: cnt(SP.cells || []), mapSphere: cnt(MSP.cells || []), collider: cnt(COL || []) },
      /* 用 Map 反查：以 xy 找 ci */
      ciOfXY: (SP && SP.ciOfXY) ? SP.ciOfXY(city.x, city.y) : null,
      dirDiff: (SP && SP.cells && SP.cells[ci] && COL && COL[ci])
        ? +(Math.acos(Math.max(-1, Math.min(1, SP.cells[ci].dir[0] * COL[ci].dir[0] + SP.cells[ci].dir[1] * COL[ci].dir[1] + SP.cells[ci].dir[2] * COL[ci].dir[2]))) * 180 / Math.PI).toFixed(3)
        : null
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
