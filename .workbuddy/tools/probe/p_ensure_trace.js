/* 抓球面 ensure：每次用什么种子重建、重建前后同一格的地形 */
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
    [GAME.sphere, GAME.mapSphere].forEach((sp, si) => {
      if (!sp || !sp.ensure) return;
      const orig = sp.ensure;
      sp.ensure = function () {
        const before = { built: sp._builtSeed, ovr: sp._seedOverride,
          at24006: sp.cells && sp.cells[24006] ? sp.cells[24006].type : null,
          at355248: (function () { try { const ci = sp.ciOfXY(355, 248); return ci >= 0 && sp.cells[ci] ? ci + ':' + sp.cells[ci].type : 'none'; } catch (e) { return 'err'; } })() };
        const r = orig.apply(sp, arguments);
        L.push({ sphere: si === 0 ? 'sphere' : 'mapSphere', before: before,
          after: { built: sp._builtSeed, ovr: sp._seedOverride,
            at24006: sp.cells && sp.cells[24006] ? sp.cells[24006].type : null,
            at355248: (function () { try { const ci = sp.ciOfXY(355, 248); return ci >= 0 && sp.cells[ci] ? ci + ':' + sp.cells[ci].type : 'none'; } catch (e) { return 'err'; } })() } });
        return r;
      };
    });
    GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 });
    return L;
  });
  console.log(JSON.stringify(log, null, 1));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
