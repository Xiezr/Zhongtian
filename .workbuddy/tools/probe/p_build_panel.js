/* v158.21 视觉核对：点一块野地，面板第一屏该看到「🏭 采集场」而不是「占领」 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pbuild';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '建', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2200);

  /* 找一块能建采集场的野地格（森林/山地/荒漠/平原/草原 —— 只要 RS.view 有资源） */
  const pick = await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    const cells = M._collider.cells;
    const want = { forest: 1, hill: 1, desert: 1, plain: 1, caoyuan: 1 };
    for (let i = 0; i < cells.length; i++) {
      const cc = cells[i];
      if (!cc || !want[cc.type]) continue;
      let rv = null;
      try { rv = G.resource.view(i); } catch (e) { rv = null; }
      if (!rv || !rv.res) continue;
      return { ci: i, type: cc.type, res: rv.res, scanned: !!rv.scanned };
    }
    return { err: 'none' };
  });
  console.log('  目标格', JSON.stringify(pick));
  if (pick.err) { await b.close(); process.exit(1); }

  await p.evaluate((ci) => { GAME.ui.closeAllModals(); GAME.ui.openLandModalCi(ci); }, pick.ci);
  await p.waitForTimeout(700);
  const info = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    if (!m) return { err: 'no modal' };
    const order = [];
    m.querySelectorAll('.gold-heading, .op-zone-t, .op-row button, .btn, .k').forEach((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) order.push(t.slice(0, 28));
    });
    return { first: order.slice(0, 14), hasResZone: /采集场/.test(m.textContent),
      hasBuild: !!m.querySelector('[data-action="res-build-open"], [data-action="res-scan"]') };
  });
  console.log('  面板顺序', JSON.stringify(info));
  await p.screenshot({ path: OUT + '/land_panel.png' });
  console.log('  错误', JSON.stringify(errs.slice(0, 3)));
  await b.close();
  process.exit(0);
})();
