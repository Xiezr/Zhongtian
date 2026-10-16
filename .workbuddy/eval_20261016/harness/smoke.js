/* 冒烟测试：验证游戏可在无头 Chromium 中加载、tick 推进、600× 设置生效 */
'use strict';
const { chromium } = require('playwright-core');

const CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:8901';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });

  const t0 = Date.now();
  await page.goto(BASE + '/index.html?demo=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.GAME && GAME.state, null, { timeout: 20000 });
  console.log('BOOT_OK ms=' + (Date.now() - t0));

  const info1 = await page.evaluate(() => ({
    version: GAME.VERSION, timeScale: GAME.timeScale(),
    elapsed: GAME.state.elapsed, day: GAME.state.day,
    cities: (GAME.state.cities || []).length,
    screenHidden: document.getElementById('screen-game').classList.contains('hidden'),
    navTabs: document.querySelectorAll('#topnav .tab[data-view]').length
  }));
  console.log('STATE1', JSON.stringify(info1));

  // 等 3 秒看 tick 推进
  await page.waitForTimeout(3000);
  const info2 = await page.evaluate(() => ({ elapsed: GAME.state.elapsed }));
  console.log('TICK_DELTA_3s=' + (info2.elapsed - info1.elapsed) + ' (期望≈' + 3 * info1.timeScale + ')');

  // 切到 600×（直接改 settings，UI 芯片点击留待正式 harness）
  await page.evaluate(() => { GAME.state.settings.timeScale = 600; });
  await page.waitForTimeout(3000);
  const info3 = await page.evaluate(() => ({ elapsed: GAME.state.elapsed, ts: GAME.timeScale() }));
  console.log('TICK_DELTA_3s_600x=' + (info3.elapsed - info2.elapsed) + ' (期望≈1800)');

  // 地图视图渲染测试（3D/WebGL）
  await page.click('.tab[data-view="map"]');
  await page.waitForTimeout(2500);
  const mapInfo = await page.evaluate(() => ({
    canvas: !!document.querySelector('#view-container canvas'),
    map3d: !!(GAME.map3d && GAME.map3d.enabled),
    err: window.__lastMapErr || null
  }));
  console.log('MAP', JSON.stringify(mapInfo));
  await page.screenshot({ path: 'E:/Deepseekdb/.workbuddy/eval_20261016/shots/smoke_map.png' });

  // 城市视图
  await page.click('.tab[data-view="city"]');
  await page.waitForTimeout(800);
  const cityInfo = await page.evaluate(() => ({
    buttons: document.querySelectorAll('#view-container button, #view-container [data-action]').length,
    html: document.getElementById('view-container').innerHTML.length
  }));
  console.log('CITY', JSON.stringify(cityInfo));
  await page.screenshot({ path: 'E:/Deepseekdb/.workbuddy/eval_20261016/shots/smoke_city.png' });

  console.log('ERRORS(' + errors.length + '):');
  errors.slice(0, 10).forEach(e => console.log('  ' + e));
  await browser.close();
  process.exit(errors.length ? 3 : 0);
})().catch(e => { console.error('SMOKE_FAIL', e); process.exit(1); });
