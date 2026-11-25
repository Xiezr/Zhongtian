/* 抓 newGame 内部：pickStartPos 返回什么、makeCity 收到什么 */
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

  const log = await p.evaluate(() => {
    const L = [];
    const origPick = GAME.pickStartPos;
    GAME.pickStartPos = function (region, seed) {
      const r = origPick.call(GAME, region, seed);
      const ci = GAME.sphere.ciOfXY(r.x, r.y);
      L.push({ fn: 'pickStartPos', region: region, seed: seed, ret: r, ci: ci,
        type: GAME.sphere.cells[ci] ? GAME.sphere.cells[ci].type : null });
      return r;
    };
    const origMake = GAME.makeCity;
    GAME.makeCity = function (opts) {
      const c = origMake.call(GAME, opts);
      L.push({ fn: 'makeCity', opts: { x: opts.x, y: opts.y, ci: opts.ci, name: opts.name },
        out: { ci: c.ci, x: c.x, y: c.y },
        type: GAME.sphere.cells[c.ci] ? GAME.sphere.cells[c.ci].type : null });
      return c;
    };
    GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 });
    return L;
  });
  console.log(JSON.stringify(log, null, 1));

  const after = await p.evaluate(() => {
    const c = GAME.currentCity();
    return { ci: c.ci, x: c.x, y: c.y, type: GAME.sphere.cells[c.ci] ? GAME.sphere.cells[c.ci].type : null,
      mapSeed: GAME.state.map.seed };
  });
  console.log('最终城市：' + JSON.stringify(after));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
