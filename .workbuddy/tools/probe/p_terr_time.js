/* 时序：建城时是什么地形，进地图后又是什么地形 */
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

  const snap = (tag) => p.evaluate((t) => {
    const c = GAME.currentCity ? GAME.currentCity() : null;
    const SP = GAME.sphere;
    const ci = c ? c.ci : -1;
    return { tag: t, cityCi: ci, x: c && c.x, y: c && c.y,
      type: (SP && SP.cells && SP.cells[ci]) ? SP.cells[ci].type : null,
      startPos: GAME.state && GAME.state.map ? GAME.state.map.startPos : null,
      sphereSeed: SP ? (SP.seed || SP._seed || null) : null };
  }, tag);

  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); });
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await snap('newGame 之后')));

  await p.evaluate(() => { GAME.ui.enterGame(); });
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await snap('enterGame 之后')));

  await p.evaluate(() => { GAME.ui.setView('map'); });
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await snap('进地图之后')));

  /* 直接问 pickStartPos 会给出什么 */
  const ps = await p.evaluate(() => {
    const r = GAME.pickStartPos('random', 20261126);
    const SP = GAME.sphere;
    const ci = SP.ciOfXY(r.x, r.y);
    return { r: r, ci: ci, type: SP.cells[ci] ? SP.cells[ci].type : null };
  });
  console.log('pickStartPos 现在重算：' + JSON.stringify(ps));

  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
