'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForTimeout(4500);
  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, out = {};
    out.hasWaterTiled = !!M._waterTiled;
    out.denseVerts = M._waterDenseVerts;
    out.idxLen = M._waterIdx ? M._waterIdx.length : null;
    var mat = M._waterMat;
    out.matType = mat && mat.type;
    out.uAmp = mat && mat.uniforms && mat.uniforms.uAmp && mat.uniforms.uAmp.value;
    out.uR = mat && mat.uniforms && mat.uniforms.uR && mat.uniforms.uR.value;
    out.uColor = mat && mat.uniforms && mat.uniforms.uColor && mat.uniforms.uColor.value && mat.uniforms.uColor.value.getHexString && mat.uniforms.uColor.value.getHexString();
    if (M._waterTiled) {
      var g = M._waterTiled.geometry || M._waterTiled;
      out.attrs = Object.keys((g.attributes || {})).map(function (k) { return k + ':' + g.attributes[k].count; });
      out.vertCount = g.attributes && g.attributes.position ? g.attributes.position.count : null;
    }
    /* 场景里到底挂的是哪个 material */
    if (M._waterTiled && M._waterTiled.material) out.meshMatType = M._waterTiled.material.type;
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
