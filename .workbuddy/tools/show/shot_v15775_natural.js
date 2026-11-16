'use strict';
/* v157.75 取证：高空地形色是否变自然（降饱和）+ 六边形硬边是否被软混合抹平 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var base = await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    return { version: G.VERSION, terrainRGB: G.map3d.terrainRGB };
  }, 20260926);
  console.log('===== BASE =====');
  console.log(JSON.stringify(base));

  await p.evaluate(function () { try { window.GAME.map3d.resetView(); } catch (e) { } });
  await p.waitForTimeout(6000);   /* 等分帧构建完成 */

  var AGL = [700, 300, 160, 110];
  for (var i = 0; i < AGL.length; i++) {
    var agl = AGL[i];
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      var target = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, M.ZOOM_MIN - M.SURF_EYE + a));
      var lo = Math.log(M.ZOOM_MIN), hi = Math.log(M.ZOOM_MAX);
      M.setZoom((Math.log(target) - lo) / (hi - lo));
    }, agl);
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/tmp/v15775-agl' + String(agl).padStart(3, '0') + '.png' });
    console.log('shot agl=' + agl);
  }

  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });
  console.log(base.version === 'v157.75' && errs.length === 0 ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
