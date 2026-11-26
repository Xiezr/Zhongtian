/* 诊断：点「开始新的征程」之后到底发生了什么 */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => console.log('PAGEERR ' + e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  const before = await p.evaluate(() => {
    const g = document.getElementById('screen-game'), c = document.getElementById('screen-create');
    const bs = Array.from(document.querySelectorAll('button, .btn')).filter((x) => /开始|征程/.test(x.textContent || ''));
    return { gameHidden: g ? g.classList.contains('hidden') : null,
      createHidden: c ? c.classList.contains('hidden') : null,
      btns: bs.map((x) => ({ t: x.textContent.trim().slice(0, 12), a: x.dataset.action || '',
        r: (function () { const q = x.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; })() })) };
  });
  console.log('点击前 ' + JSON.stringify(before));

  const t = before.btns[0];
  if (!t) throw new Error('没找到开始按钮');
  await p.mouse.click(t.r[0] + t.r[2] / 2, t.r[1] + t.r[3] / 2);
  for (const wait of [300, 800, 1500, 2500, 4000]) {
    await p.waitForTimeout(wait);
    const st = await p.evaluate(() => {
      const g = document.getElementById('screen-game'), c = document.getElementById('screen-create');
      const tab = document.querySelector('#topnav .tab[data-view="map"]');
      const r = tab ? tab.getBoundingClientRect() : null;
      return { t: Date.now() % 100000,
        hasState: !!GAME.state, view: GAME.ui && GAME.ui.view,
        gameHidden: g ? g.classList.contains('hidden') : null,
        createHidden: c ? c.classList.contains('hidden') : null,
        tabRect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
        topnavDisplay: (function () { const n = document.getElementById('topnav'); return n ? getComputedStyle(n).display : null; })(),
        appFit: (function () { const a = document.getElementById('app-fit'); if (!a) return null; const q = a.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; })(),
        title: document.title };
    });
    console.log('  +' + wait + 'ms ' + JSON.stringify(st));
  }
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/pops/draw_diag.png' });
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
