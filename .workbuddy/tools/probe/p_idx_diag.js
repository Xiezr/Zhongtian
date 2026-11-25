/* v158.21 诊断：地图格索引 vs 资源系统索引 —— 到底哪里断的 */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '诊断', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2200);

  const d = await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    const col = M._collider && M._collider.cells;
    const sph = G.mapSphere && G.mapSphere.cells;
    const out = {
      colN: col ? col.length : -1,
      sphN: sph ? sph.length : -1,
      sameRef: col === sph,
      tileCellsN: (M._tileCells ? M._tileCells.length : 'private'),
      rsOfType: G.resource ? Object.keys(G.resource.RES_OF_TYPE || {}) : null
    };
    const byType = {};
    for (let i = 0; i < Math.min(col ? col.length : 0, 30000); i++) {
      const t = col[i] && col[i].type;
      if (t) byType[t] = (byType[t] || 0) + 1;
    }
    out.byType = byType;
    /* 拿 20 个 forest 格试 RS.view */
    let tried = 0, ok = 0, sample = [];
    for (let i = 0; i < (col ? col.length : 0) && tried < 20; i++) {
      if (!col[i] || col[i].type !== 'forest') continue;
      tried++;
      let rv = null, err = null;
      try { rv = G.resource.view(i); } catch (e) { err = String(e && e.message || e); }
      if (rv && rv.res) ok++;
      if (sample.length < 3) sample.push({ ci: i, rv: rv ? { res: rv.res, scanned: rv.scanned } : null, err: err });
    }
    out.forestTried = tried; out.forestOk = ok; out.sample = sample;
    /* 再试：取 forest 的 dir 反算 sphere 索引 */
    let sphHit = null;
    for (let i = 0; i < (col ? col.length : 0); i++) {
      if (!col[i] || col[i].type !== 'forest' || !col[i].dir) continue;
      const n = G.mapSphere.nearestCell(col[i].dir);
      let rv2 = null;
      try { rv2 = G.resource.view(n); } catch (e) { }
      sphHit = { colCi: i, sphereCi: n, rv: rv2 ? { res: rv2.res, scanned: rv2.scanned } : null };
      break;
    }
    out.sphHit = sphHit;
    return out;
  });
  console.log(JSON.stringify(d, null, 1));
  await b.close();
  process.exit(0);
})();
