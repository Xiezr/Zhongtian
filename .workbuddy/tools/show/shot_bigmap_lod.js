/* 大地图 LOD 远景层 —— 实机对照（默认关 / 开启）
 * 用法：node .workbuddy/tools/show/shot_bigmap_lod.js
 * 产出：.workbuddy/shots/bigmap_mini_off.png（逐格平色 · 原观感）
 *       .workbuddy/shots/bigmap_mini_on.png （大整图底图 · 新观感）
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
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.refreshAll();
  }, SEED);
  await p.waitForTimeout(600);

  /* —— 关（默认）：逐格平色 —— */
  await p.evaluate(function () { GAME.ui.useBigmap = false; GAME.ui.openMinimap(); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '.workbuddy/shots/bigmap_mini_off.png' });
  console.log('SHOT off');

  /* —— 开：大整图底图 —— */
  await p.evaluate(function () { GAME.ui.useBigmap = true; GAME.ui.loadBigmap(); });
  await p.waitForFunction('GAME.ui._bigImg && GAME.ui._bigImg.complete && GAME.ui._bigImg.naturalWidth > 0', null, { timeout: 15000 })
    .catch(function () { console.log('warn: bigmap img not ready'); });
  await p.evaluate(function () { GAME.ui.closeAllModals(); GAME.ui.openMinimap(); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '.workbuddy/shots/bigmap_mini_on.png' });
  console.log('SHOT on');

  var info = await p.evaluate(function () {
    return { bigImg: !!(GAME.ui._bigImg && GAME.ui._bigImg.naturalWidth) ? GAME.ui._bigImg.naturalWidth : 0,
      useBigmap: GAME.ui.useBigmap };
  });
  console.log('INFO ' + JSON.stringify(info));
  console.log('LOD-SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
