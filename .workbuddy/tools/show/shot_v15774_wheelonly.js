'use strict';
/* v157.74 取证：滚轮只改高度时，构图是否只缩放、不转向
   判据（体感可核）：同一朝向下一路拉远，画面里的地形特征应该只"变大变小"，
   不应该横向漂移/旋转。这里逐档截图 + dump 高度与缩放比例。 */
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
    return { version: G.VERSION, zoomMin: G.map3d.ZOOM_MIN, zoomMax: G.map3d.ZOOM_MAX, surfEye: G.map3d.SURF_EYE };
  }, 20260926);
  console.log('===== BASE =====');
  console.log(JSON.stringify(base));

  /* 先固定一个朝向：用 resetView 保证每次从同一姿态出发 */
  await p.evaluate(function () { try { window.GAME.map3d.resetView(); } catch (e) { } });
  await p.waitForTimeout(600);

  var AGL = [300, 150, 110, 95, 80, 70, 55, 35, 12];
  for (var i = 0; i < AGL.length; i++) {
    var agl = AGL[i];
    var d = await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      var target = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, M.ZOOM_MIN - M.SURF_EYE + a));
      var lo = Math.log(M.ZOOM_MIN), hi = Math.log(M.ZOOM_MAX);
      M.setZoom((Math.log(target) - lo) / (hi - lo));
      return { rAlt: +((M._rAlt == null) ? -1 : M._rAlt).toFixed(1), frac: +M.zoomFrac().toFixed(4) };
    }, agl);
    await p.waitForTimeout(620);
    await p.screenshot({ path: '.workbuddy/tmp/v15774-agl' + String(agl).padStart(3, '0') + '.png' });
    console.log('agl=' + String(agl).padStart(3) + '  ' + JSON.stringify(d));
  }

  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });
  console.log(base.version === 'v157.74' && errs.length === 0 ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
