'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    G.ui.mapCenterOn(120, 120);        /* 挪到一块森林/山地混区，远离城 */
    G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(2500);
  var cv = await p.$('#mapCanvas');
  if (cv) await cv.screenshot({ path: '.workbuddy/shots/ab_height_on.png' });
  await p.evaluate(function () { GAME.map.useHeight = false; GAME.ui.renderMapCanvas(); });
  await p.waitForTimeout(400);
  cv = await p.$('#mapCanvas');
  if (cv) await cv.screenshot({ path: '.workbuddy/shots/ab_height_off.png' });
  console.log('AB-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
