/* 旧军械库（遗迹）可达性：新局实际能发现几处 */
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
  await p.evaluate(() => { GAME.newGame({ name: '遗迹', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); });

  const d = await p.evaluate(() => {
    const G = GAME, R = G.ruin, SP = G.sphereOf ? G.sphereOf() : G.sphere;
    const N = SP.cells.length;
    /* 全图理论遗迹数（不看迷雾） */
    let all = 0, kinds = {};
    for (let i = 0; i < N; i++) {
      const w = R.at(i);
      if (w) { all++; kinds[w.kind] = (kinds[w.kind] || 0) + 1; }
    }
    /* 已探明格数 */
    let explored = 0;
    for (let i = 0; i < N; i++) if (G.fog && G.fog.get && G.fog.get(i) > 0) explored++;
    /* 真实发现（sweep 强制扫一次） */
    const got = R.sweep(true);
    const found = Object.keys(G.state.ruins || {}).length;
    const foundKinds = {};
    Object.keys(G.state.ruins || {}).forEach((ci) => {
      const k = (G.state.ruins[ci] || {}).kind;
      foundKinds[k] = (foundKinds[k] || 0) + 1;
    });
    return { cells: N, ruinsOnMap: all, kinds: kinds, exploredCells: explored,
      exploredPct: +(explored / N * 100).toFixed(2),
      sweepGot: got, foundCells: found, foundKinds: foundKinds,
      chance: (G.DATA.RUIN || {}).chance };
  });
  console.log(JSON.stringify(d, null, 1));

  /* 若一处都没有：把某格强行探明，看能不能发现（证明是"迷雾"而不是"坏掉"） */
  const forced = await p.evaluate(() => {
    const G = GAME, R = G.ruin, SP = G.sphereOf ? G.sphereOf() : G.sphere;
    let ci = -1;
    for (let i = 0; i < SP.cells.length; i++) { if (R.at(i)) { ci = i; break; } }
    if (ci < 0) return { err: '全图没有遗迹' };
    try { G.fog.set(ci, 2); } catch (e) { try { G.fog.reveal(ci); } catch (e2) { } }
    const got = R.sweep(true);
    const w = R.at(ci);
    return { ci: ci, kind: w && w.kind, name: w && w.name, revealed: got,
      isFound: R.isFound(ci), inList: Object.keys(G.state.ruins || {}).length };
  });
  console.log('=== 强行探明一处后 ===');
  console.log(JSON.stringify(forced));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
