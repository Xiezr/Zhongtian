/* v91.04 实机验收：行政右栏改「分类清单 + 选中列表」（参考募兵界面）
 * 用法：node .workbuddy/tools/show/verify_v9104_admcat.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('admin'); G.refreshAll();
  });
  await p.waitForTimeout(400);
  var a = await p.evaluate(function () {
    GAME.ui._admOpen = {}; GAME.ui._admOpen[GAME.activePlanetOf().id] = true;
    GAME.ui.renderView('admin');
    var vc = document.querySelector('#view-container');
    var cats = vc.querySelectorAll('.adm-cat');
    return { split: !!vc.querySelector('.adm-cat-split'), catCount: cats.length,
      hasBody: !!vc.querySelector('.adm-cat-body'), bodyTitle: (vc.querySelector('.adm-cat-body-t') || {}).textContent || '' };
  });
  console.log('ADMIN SPLIT:', JSON.stringify(a));

  /* 点第 2 个分类（据点）→ body 标题应随之变 */
  var b2 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var cats = vc.querySelectorAll('.adm-cat');
    if (cats[1]) cats[1].click();
    vc = document.querySelector('#view-container');
    return { bodyTitle: (vc.querySelector('.adm-cat-body-t') || {}).textContent || '',
      curIdx: Array.prototype.findIndex.call(vc.querySelectorAll('.adm-cat'), function (x) { return x.classList.contains('cur'); }) };
  });
  console.log('AFTER CLICK CAT2:', JSON.stringify(b2));
  await p.screenshot({ path: '.workbuddy/shots/v9104-adm-split.png' });
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
