/* 数值探针：逐实例打印 局部+Y vs 径向 的点积、以及原始矩阵元素 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(2500);

  var r = await p.evaluate(function () {
    var M = window.GAME.map3d, THREE = window.THREE;
    var lines = [];
    var counts = (M._towns || []).map(function (im) { return im.count; });
    lines.push('instMeshCounts=' + JSON.stringify(counts));
    var im = (M._towns || [])[0];
    if (!im) return lines.join('\n');
    lines.push('im.matrixWorld=' + im.matrixWorld.elements.join(','));
    lines.push('im.visible=' + im.visible + ' geoBound=' + JSON.stringify(im.geometry.boundingBox));
    var m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (var i = 0; i < Math.min(3, im.count); i++) {
      im.getMatrixAt(i, m4);
      m4.decompose(pos, qt, sc);
      var upv = new THREE.Vector3(0, 1, 0).applyQuaternion(qt);
      var rad = pos.clone().normalize();
      lines.push('i=' + i + ' pos=' + pos.toArray().map(function (v) { return v.toFixed(3); }).join(',')
        + ' scale=' + sc.x.toFixed(4) + ' up=' + upv.toArray().map(function (v) { return v.toFixed(3); }).join(',')
        + ' rad=' + rad.toArray().map(function (v) { return v.toFixed(3); }).join(',')
        + ' dot=' + upv.dot(rad).toFixed(4));
      /* 直接看矩阵的前三列（basis） */
      var e = m4.elements;
      lines.push('   basisX=' + [e[0], e[1], e[2]].map(function (v) { return v.toFixed(3); }).join(',')
        + ' basisY=' + [e[4], e[5], e[6]].map(function (v) { return v.toFixed(3); }).join(','));
    }
    /* 手动复算一遍正确值 */
    im.getMatrixAt(0, m4); m4.decompose(pos, qt, sc);
    var nn = pos.clone().normalize();
    var q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nn);
    lines.push('expectedQ=' + q2.toArray().map(function (v) { return v.toFixed(4); }).join(','));
    lines.push('actualQ  =' + qt.toArray().map(function (v) { return v.toFixed(4); }).join(','));
    lines.push('angleDeg=' + (qt.angleTo(q2) * 180 / Math.PI).toFixed(2));
    return lines.join('\n');
  });
  console.log(r);
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
