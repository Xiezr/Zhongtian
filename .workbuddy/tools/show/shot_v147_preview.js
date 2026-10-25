/* v147 实机：建造预览（D 期）—— 候选卡片「先看看」→ 3D 单栋预览
 * 用法：node .workbuddy/tools/show/shot_v147_preview.js
 * 产出：.workbuddy/shots/v147-preview.png
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String((e && e.message) || e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var setup = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    st.cities[0].pid = 1;
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    var r = G.ui.openBuildPreview('tiejiangpu', 4);
    return { ok: !!r && r.ok, fallback: !!(r && r.fallback), scene: G.scene3d.current(),
      webgl: (function () { try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } })() };
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: '.workbuddy/shots/v147-preview.png' });
  var dbg = await p.evaluate(function () {
    var G = window.GAME;
    var d = G.scene3d._debug ? G.scene3d._debug() : null;
    return { scene: G.scene3d.current(), pitch: d && d.pitchDeg, ndc: d && d.ndc };
  });
  await p.evaluate(function () { try { GAME.scene3d.close(); } catch (e) {} });
  console.log('setup=' + JSON.stringify(setup));
  console.log('dbg=' + JSON.stringify(dbg));
  console.log('pageerrors=' + (errs.length ? errs.join(' | ') : '0'));
  await b.close();
})();
