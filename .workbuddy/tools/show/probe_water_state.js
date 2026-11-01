'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });
  var r = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('map'); G.refreshAll();
    return 'ok';
  });
  await p.waitForTimeout(4000);
  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, out = {};
    /* 场景里所有 ShaderMaterial 的 uniform 快照 */
    var scene = null;
    /* map3d 没有暴露 scene —— 从 renderer 入手不太好，改用 canvas 上挂的引用 */
    var mats = [];
    try {
      /* 遍历所有 THREE.Material 不现实：从 M 里已知的引用找 */
      ['_water', '_waterMesh', '_ocean', '_sea', '_marines', 'water'].forEach(function (k) {
        if (M[k]) mats.push({ key: k, type: (M[k].type || (M[k].material && M[k].material.type) || '?') });
      });
    } catch (e) { }
    out.knownRefs = mats;
    out.keys = Object.keys(M).filter(function (k) { return /water|sea|ocean|marine/i.test(k); });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
