'use strict';
/* v157.73 穿越云层取证：按离地高度逐档截图 + dump 云的 uniform 曲线 */
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
    var M = G.map3d;
    return {
      version: G.VERSION,
      zoomMin: M.ZOOM_MIN, zoomMax: M.ZOOM_MAX, surfEye: M.SURF_EYE,
      atmH: (G.sphere && G.sphere.ATM_H) || 55,
      puffs: M._puffs ? M._puffs.children.length : 0
    };
  }, 20260926);
  console.log('===== BASE =====');
  console.log(JSON.stringify(base, null, 2));

  var R = base.zoomMin - base.surfEye;
  var AGL = [400, 150, 90, 74, 55, 40, 25, 8, 2];
  var sawPuff = false;

  for (var i = 0; i < AGL.length; i++) {
    var agl = AGL[i];
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      var target = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, M.ZOOM_MIN - M.SURF_EYE + a));
      var lo = Math.log(M.ZOOM_MIN), hi = Math.log(M.ZOOM_MAX);
      M.setZoom((Math.log(target) - lo) / (hi - lo));
    }, agl);
    await p.waitForTimeout(750);
    await p.screenshot({ path: '.workbuddy/tmp/v15773-agl' + agl + '.png' });
    var d = await p.evaluate(function () {
      var M = window.GAME.map3d;
      var u = M._skyMat && M._skyMat.uniforms;
      return {
        uFade: u && u.uFade ? +u.uFade.value.toFixed(3) : null,
        uIn: u && u.uIn ? +u.uIn.value.toFixed(3) : null,
        skyOn: M._sky ? M._sky.visible : null,
        puffOn: M._puffs ? M._puffs.visible : null,
        puffOp: (M._puffs && M._puffs.children[0]) ? +M._puffs.children[0].material.opacity.toFixed(3) : null,
        frac: +M.zoomFrac().toFixed(4)
      };
    });
    if (d.puffOn) sawPuff = true;
    console.log('agl=' + String(agl).padStart(3) + '  ' + JSON.stringify(d));
  }

  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });
  /* base.puffs 读得太早（首次渲染还没跑 buildSkyClouds），改用循环里观察到的 puffOn */
  var ok = base.version === 'v157.73' && sawPuff && errs.length === 0;
  console.log(ok ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
