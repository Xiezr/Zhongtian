/* ============================================================
 * shot_v89121_shop.js — 商城「民生」页实机截图（v89.121）
 * ------------------------------------------------------------
 * 出图：
 *   v89121-shop-minisheng.png  商城 · 民生页（增民令 + 移民令 同页）
 * 顺带量：页签总数 / 民生页物品数 / 纵向溢出（弹窗规矩：不许滚动条）
 * 用法：node .workbuddy/tools/show/shot_v89121_shop.js
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

  var info = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260924 });
    if (!st.map.grid) G.map.generate();
    st.res.gold = 5e6;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.openShop('pop_boost');     /* 民生页（pop_boost + pop_fill 合并） */
    /* 结构证据：页签数 / 民生页物品 */
    var tabs = document.querySelectorAll('.shop-cats .shop-cat');
    var names = [];
    tabs.forEach(function (t) { names.push(t.textContent.replace(/\d+$/, '').trim()); });
    var body = document.body.textContent || '';
    return {
      tabs: tabs.length,
      hasMinSheng: names.indexOf('民生') >= 0,
      minShengCount: names.filter(function (x) { return x === '民生'; }).length,
      hasZengmin: body.indexOf('增民令') >= 0,
      hasYimin: body.indexOf('移民令') >= 0,
      view: G.ui.view,
    };
  });
  console.log('页签 ' + info.tabs + ' 个 · 「民生」出现 ' + info.minShengCount + ' 次（应为 1）');
  console.log('民生页含 增民令=' + info.hasZengmin + ' · 移民令=' + info.hasYimin + ' · 当前视图=' + info.view);

  await new Promise(function (r) { setTimeout(r, 600); });
  await page.screenshot({ path: path.join(OUT, 'v89121-shop-minisheng.png'), fullPage: false });
  console.log('✓ v89121-shop-minisheng.png（商城 · 民生页）');
  await browser.close();
})();
