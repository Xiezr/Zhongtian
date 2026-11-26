/* 遗迹内容是否是真的：强行探明一处 → sweep 发现 → 翻找 → 材料/资源到账 */
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

  const r = await p.evaluate(() => {
    const G = GAME, R = G.ruin, SP = G.sphereOf ? G.sphereOf() : G.sphere;
    /* 找一处 arsenal，且离首城最近（保证 cityNearOf 有城） */
    const city = G.state.cities[0];
    let best = -1, bestD = 1e9;
    for (let i = 0; i < SP.cells.length; i++) {
      const w = R.at(i);
      if (!w || w.kind !== 'arsenal') continue;
      const d = SP.distOf ? SP.distOf({ ci: city.ci }, { ci: i }) : 0;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return { err: 'no arsenal' };
    const w0 = R.at(best);

    /* 强行探明（bump 才是真 API；set 不存在） */
    G.fog.bump(best, 3);
    const revealed = R.sweep(true);
    const isFound = R.isFound(best);

    /* 记录翻找前 */
    const matBefore = (function () { try { return (G.state.items || {})['jingtie'] || 0; } catch (e) { return null; } })();
    const ironBefore = (city.res || {}).iron || 0;
    const stoneBefore = (city.res || {}).stone || 0;

    /* 打开面板看按钮 */
    G.ui.openRuinModal(best);
    const m = document.querySelector('.modal-mask');
    const html = m ? m.innerHTML : '';
    const btns = Array.from(document.querySelectorAll('[data-action="ruin-act"]')).map((x) => (x.textContent || '').trim());

    /* 真点 a（拆走军械） */
    const btnA = document.querySelector('[data-action="ruin-act"][data-rs="a"]');
    if (btnA) btnA.click();

    const matAfter = (G.state.items || {})['jingtie'] || 0;
    const rec = (G.state.ruins || {})[best] || {};

    return { ci: best, name: w0.name, distToCity: +bestD.toFixed(1),
      revealed: revealed, isFound: isFound,
      btns: btns, hasFlavor: /门是被人从里面焊死/.test(html),
      matBefore: matBefore, matAfter: matAfter, matGain: matAfter - matBefore,
      ironBefore: ironBefore, stoneBefore: stoneBefore,
      recSide: rec.side, recGot: rec.got || '' };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
