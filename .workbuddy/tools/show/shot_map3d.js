'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  p.on('console', function (m) { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var en = await p.evaluate(function () { return GAME.map3d && GAME.map3d.enabled; });
  console.log('map3d enabled = ' + en);
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '.workbuddy/shots/map3d_game5.png' });
  var cv = await p.$('#mapCanvas');
  if (cv) await cv.screenshot({ path: '.workbuddy/shots/map3d_canvas5.png' });
  console.log('MAP3D-SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
