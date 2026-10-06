/* ============================================================
 * shot_v89125_migration.js — 移民令改版实机截图（v89.125）
 * ------------------------------------------------------------
 * 出图：
 *   v89125-shop-yiminling.png   商城 · 民生页（移民令新文案「+上限的 25%」）
 *   v89125-yiminling-use.png    真用一次（40% → 65%）+ toast 结算文案
 * 顺带打印证据：上限 / 用前 / 用后 / toast 文本
 * 用法：node .workbuddy/tools/show/shot_v89125_migration.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ① 商城民生页（新文案） */
  await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    st.res.gold = 5e6;
    st.items.yiminling = 3;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.openShop('pop_boost');
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  await page.screenshot({ path: path.join(OUT, 'v89125-shop-yiminling.png'), fullPage: false });
  console.log('✓ v89125-shop-yiminling.png（商城 · 民生页：移民令新文案）');

  /* ② 真用一次：摆 40% → 使用 → toast 结算 */
  var evidence = await page.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    var c = G.currentCity();
    var cap = G.maxPopOf(c);
    c.res.pop = Math.floor(cap * 0.4);
    G.refreshAll();
    var before = c.res.pop;
    var r = G.doUseItem('yiminling');   /* 注意：doUseItem 不返回（内部 toast + refresh），判据读状态与 DOM */
    var toast = document.querySelector('#toast');
    return {
      cap: cap,
      before: before,
      after: c.res.pop,
      msg: (r && r.msg) || '',
      toastShown: !!(toast && toast.classList.contains('show')),
      toastText: toast ? toast.textContent : '',
      itemsLeft: (G.state.items.yiminling || 0),
    };
  });
  await new Promise(function (r) { setTimeout(r, 200); });
  await page.screenshot({ path: path.join(OUT, 'v89125-yiminling-use.png'), fullPage: false });
  console.log('✓ v89125-yiminling-use.png（使用一次：人口 ' + evidence.before + ' → ' + evidence.after
    + '，上限 ' + evidence.cap + '）');

  /* 证据核对：增量必须 = 上限 × 25%，且 toast 文案里的增量数字一致 */
  var add = Math.floor(evidence.cap * 0.25);
  var pass = evidence.after === evidence.before + add
    && evidence.toastShown && evidence.itemsLeft === 2
    && evidence.toastText.indexOf('+' + add) >= 0;
  console.log('  toast 可见=' + evidence.toastShown + '｜toast 文案：' + evidence.toastText.slice(0, 70));
  console.log('  增量核对：' + evidence.after + ' - ' + evidence.before + ' = ' + (evidence.after - evidence.before)
    + '（期望 ' + add + '）· 库存剩余 ' + evidence.itemsLeft + '/3');
  console.log(pass ? '  ✓ 实机核对通过' : '  ✗ 实机核对失败');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
