/* v91.24 复现：行政菜单 + 英雄派遣（城池面板→派遣→出征界面）崩溃
 * 用法：node .workbuddy/tools/show/verify_v9124_repro.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e && (e.stack || e))); });
  var cons = []; p.on('console', function (m) { if (m.type() === 'error') cons.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });

  /* 1) 行政菜单：进入 + 遍历每个分类 */
  await p.evaluate(function () { GAME.ui.setView('admin'); GAME.refreshAll(); });
  await p.waitForTimeout(300);
  var step1 = await p.evaluate(function () {
    GAME.ui._admOpen = {}; GAME.ui._admOpen[GAME.activePlanetOf().id] = true;
    GAME.ui.renderView('admin');
    var vc = document.querySelector('#view-container');
    var cats = vc.querySelectorAll('.adm-cat');
    var out = { catCount: cats.length, picked: [] };
    for (var i = 0; i < cats.length; i++) {
      var label = cats[i].querySelector('.adm-cat-nm').textContent;
      cats[i].click();                     /* 真点 → data-action=adm-cat-pick */
      var t = (document.querySelector('#view-container .adm-cat-body-t') || {}).textContent || '';
      out.picked.push(label + ' => ' + t.slice(0, 40));
    }
    return out;
  });
  console.log('ADMIN-CATS:', JSON.stringify(step1));
  console.log('ERR-AFTER-ADMIN:', JSON.stringify(errs));

  /* 2) 英雄派遣：进入城池 → 城池面板 → 派遣按钮 → 出征界面 */
  errs.length = 0;
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._cityId = G.state.cities[0].id;
    G.ui.setView('city'); G.refreshAll();
  });
  await p.waitForTimeout(200);
  /* 2a 直接调 openExpModal（英雄派遣 hiner） */
  var step2 = await p.evaluate(function () {
    var out = {};
    try {
      GAME.ui.openExpModal({ kind: 'own', id: GAME.state.cities[0].id }, { hint: 'dispatch' });
      out.expOpen = true;
      out.hasFrom = !!document.querySelector('#exp-from');
      out.hasGen = !!document.querySelector('#exp-gen');
    } catch (e) { out.err = String(e && (e.stack || e)); }
    return out;
  });
  console.log('DISPATCH-OPEN:', JSON.stringify(step2));
  await p.screenshot({ path: '.workbuddy/shots/v9124-dispatch.png' });
  console.log('ERR-AFTER-DISPATCH:', JSON.stringify(errs));

  /* 3) 模拟真点：找城池面板里的派遣按钮 */
  errs.length = 0;
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) { } });
  var step3 = await p.evaluate(function () {
    var out = { found: false };
    try {
      var c = GAME.state.cities[0];
      GAME.ui.openCityModal(c);           /* 城池面板 */
      var btn = document.querySelector('[data-action="city-dispatch-exp"]');
      out.found = !!btn;
      if (btn) { btn.click(); out.clicked = true; out.expFrom = !!document.querySelector('#exp-from'); }
    } catch (e) { out.err = String(e && (e.stack || e)); }
    return out;
  });
  console.log('CITY-DISPATCH-CLICK:', JSON.stringify(step3));
  console.log('ERR-AFTER-CLICK:', JSON.stringify(errs));
  console.log('CONSOLE-ERRORS:', JSON.stringify(cons));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
