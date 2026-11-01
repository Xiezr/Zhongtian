/* 决定性探针：拿 ci → 现算 dir/pos/quat，与实例矩阵里的值逐一比对 */
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
    var M = window.GAME.map3d, THREE = window.THREE, L = [];
    var R = M.R || M._R || 0;
    L.push('M.R=' + R + ' M._R=' + M._R);
    var S = M._settles || {};
    var first = (S.own || [])[0];
    L.push('firstOwn=' + JSON.stringify(first));
    /* 找到 own 组实例网格（count=1） */
    var im = null; (M._towns || []).forEach(function (x) { if (x.count === 1) im = x; });
    if (!im) { L.push('no im'); return L.join('\n'); }
    var m4 = new THREE.Matrix4(); im.getMatrixAt(0, m4);
    var e = m4.elements;
    L.push('storedPos=' + [e[12], e[13], e[14]].map(function (v) { return v.toFixed(3); }).join(','));
    L.push('storedBasisY=' + [e[4], e[5], e[6]].map(function (v) { return v.toFixed(3); }).join(','));

    /* 现算 */
    var cells = M._cells || (window.GAME.sphere && window.GAME.sphere.cells) || null;
    var SP = window.GAME.mapSphere || window.GAME.sphere;
    var d = SP && SP.cells ? SP.cells[first.ci] && SP.cells[first.ci].dir : null;
    L.push('SP.cells[ci].dir=' + (d ? d.map(function (v) { return v.toFixed(3); }).join(',') : 'null'));
    if (d) {
      var nn = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nn);
      var upv = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      L.push('recalcUp=' + upv.toArray().map(function (v) { return v.toFixed(3); }).join(','));
    }
    /* 实例网格所在父链是否有旋转 */
    var o = im, chain = [];
    while (o) { chain.push(o.type + '#' + (o.id || '')); o = o.parent; }
    L.push('parentChain=' + chain.join(' < '));
    return L.join('\n');
  });
  console.log(r);
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
