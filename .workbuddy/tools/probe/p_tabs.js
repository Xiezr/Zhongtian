/* 诊断：开局后哪些可点元素能进地图 */
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
  const btn = await p.evaluate(() => {
    const bs = Array.from(document.querySelectorAll('button, .btn'));
    const b = bs.find((x) => x.offsetParent && /开始|征程/.test((x.textContent || '')));
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent.trim() };
  });
  await p.mouse.click(btn.x, btn.y);
  await p.waitForTimeout(2500);
  /* 关弹窗 */
  for (let i = 0; i < 6; i++) {
    const b2 = await p.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('button, .btn'));
      const b = bs.find((x) => x.offsetParent && /知道了|开始建设|继续|关闭|跳过|确定/.test((x.textContent || '')));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      if (!r.width) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent.trim() };
    });
    if (!b2) break;
    await p.mouse.click(b2.x, b2.y);
    await p.waitForTimeout(600);
  }

  const d = await p.evaluate(() => {
    const out = { view: GAME.ui.view, tabs: [], mapish: [], bottom: [] };
    document.querySelectorAll('[data-view]').forEach((el) => {
      const r = el.getBoundingClientRect();
      out.tabs.push({ v: el.dataset.view, t: (el.textContent || '').trim().slice(0, 8),
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height),
        vis: !!el.offsetParent });
    });
    document.querySelectorAll('button, .btn, [data-action]').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (!/地图|星球|大世界/.test(t)) return;
      const r = el.getBoundingClientRect();
      out.mapish.push({ t: t.slice(0, 16), a: el.dataset.action || '', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
        w: Math.round(r.width), vis: !!el.offsetParent });
    });
    /* 底栏 */
    const bb = document.querySelector('.bottom-bar') || document.querySelector('#bottom-bar');
    if (bb) {
      Array.from(bb.querySelectorAll('button, .btn')).forEach((el) => {
        const r = el.getBoundingClientRect();
        out.bottom.push({ t: (el.textContent || '').trim().slice(0, 12), a: el.dataset.action || '',
          x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), vis: !!el.offsetParent });
      });
    }
    return out;
  });
  console.log(JSON.stringify(d, null, 1).slice(0, 3000));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
