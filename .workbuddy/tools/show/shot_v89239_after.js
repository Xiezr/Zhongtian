/* v89.239 定档后实机图（读【真文件】CSS · 无注入）——与 v89238 对照图同机位同局
 * 用法：node .workbuddy/tools/show/shot_v89239_after.js
 * 产出：.workbuddy/shots/v89239-doll-after.png（.doll 元素）+ v89239-pane-after.png（整屏）
 * 取证：opacity / filter / 槽位数 / src（一次性 dump）
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    var g = st.generals[0];
    try { G.systems.autoEquipBest(g.id); } catch (e) { }
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._genSel = g.id;
    G.ui.setView('generals');
    G.refreshAll();
  });
  await p.waitForFunction(
    "var im = document.querySelector('.doll-portrait img'); return !im || im.complete;",
    null, { timeout: 8000 }).catch(function () { });
  await p.waitForTimeout(500);

  var info = await p.evaluate(function () {
    var im = document.querySelector('.doll-portrait img');
    return {
      opacity: im ? getComputedStyle(im).opacity : '',
      filter: im ? getComputedStyle(im).filter : '',
      src: im ? im.getAttribute('src') : '',
      slots: document.querySelectorAll('.gen-pane .doll-slot').length,
      fig: document.querySelectorAll('.doll .doll-fig-svg').length
    };
  });
  console.log('live dump:', JSON.stringify(info));

  var doll = await p.$('.gen-pane .doll');
  if (doll) await doll.screenshot({ path: '.workbuddy/shots/v89239-doll-after.png' });
  await p.screenshot({ path: '.workbuddy/shots/v89239-pane-after.png' });
  console.log('SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
