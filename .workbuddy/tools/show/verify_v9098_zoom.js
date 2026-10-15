/* v90.98 实机验收：地图视野缩放条（底栏右侧 · 仅地图视图）
 * 用法：node .workbuddy/tools/show/verify_v9098_zoom.js
 * 产出：.workbuddy/shots/v9098-zoom-min.png / -zoom-max.png
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
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForTimeout(700);

  var present = await p.evaluate(function () {
    var el = document.getElementById('bb-zoom');
    return { hasSlider: !!el, type: el ? el.type : '', min: el ? el.min : '', max: el ? el.max : '',
      value: el ? el.value : '', frac0: GAME.map3d.zoomFrac().toFixed(3), dist0: GAME.map3d.camO.dist.toFixed(1),
      minD: GAME.map3d.ZOOM_MIN.toFixed(1), maxD: GAME.map3d.ZOOM_MAX.toFixed(1) };
  });
  console.log('PRESENT:', JSON.stringify(present));

  /* 拖到极小视野（value=0） */
  await p.evaluate(function () {
    var el = document.getElementById('bb-zoom'); el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(500);
  var zmin = await p.evaluate(function () { return { frac: GAME.map3d.zoomFrac().toFixed(3), dist: GAME.map3d.camO.dist.toFixed(1) }; });
  await p.screenshot({ path: '.workbuddy/shots/v9098-zoom-min.png' });
  console.log('MIN:', JSON.stringify(zmin));

  /* 拖到极大视野（value=100） */
  await p.evaluate(function () {
    var el = document.getElementById('bb-zoom'); el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(500);
  var zmax = await p.evaluate(function () { return { frac: GAME.map3d.zoomFrac().toFixed(3), dist: GAME.map3d.camO.dist.toFixed(1) }; });
  await p.screenshot({ path: '.workbuddy/shots/v9098-zoom-max.png' });
  console.log('MAX:', JSON.stringify(zmax));

  /* 滚轮同源：滚一格应改 dist（且 slider 反映） */
  var wheel = await p.evaluate(function () {
    var before = GAME.map3d.camO.dist;
    var cv = document.getElementById('mapCanvas');
    cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    return { changed: GAME.map3d.camO.dist !== before };
  });
  console.log('WHEEL:', JSON.stringify(wheel));

  /* 非地图视图不应出现滑块 */
  await p.evaluate(function () { GAME.ui.setView('city'); });
  await p.waitForTimeout(300);
  var offMap = await p.evaluate(function () { return { hasSlider: !!document.getElementById('bb-zoom') }; });
  console.log('OFFMAP:', JSON.stringify(offMap));

  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
