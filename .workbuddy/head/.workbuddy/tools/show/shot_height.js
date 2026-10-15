/* 主地图 · 高度模式实机截图
 * 用法：node .workbuddy/tools/show/shot_height.js
 * 产出：.workbuddy/shots/height_map.png（平视）· height_map_zoom.png（放大）
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  p.on('console', function (m) { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });
  p.on('pageerror', function (e) { console.log('PAGE-EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, SEED);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/shots/height_map.png' });
  /* 地图画布高清元素截图（细看台阶/崖壁） */
  var cv = await p.$('#mapCanvas');
  if (cv) await cv.screenshot({ path: '.workbuddy/shots/height_canvas.png' });
  console.log('SHOT map');

  /* 第二张：居中到主城（周边有各种地形） */
  await p.evaluate(function () {
    var pc = GAME.map.playerCity();
    if (pc) GAME.ui.mapCenterOn(pc.x, pc.y);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '.workbuddy/shots/height_map_zoom.png' });
  console.log('SHOT city');
  console.log('HEIGHT-SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
