/* 在页面里原样复现那 5 行摆放代码，看是哪一步把朝向算歪 */
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

  var r = await p.evaluate(function () {
    var THREE = window.THREE, L = [];
    var d = [-0.415, 0.291, 0.862], rr = 309.06, sc = 1.5764;
    var up = new THREE.Vector3(0, 1, 0);
    var nn = new THREE.Vector3(), q = new THREE.Quaternion(), qr = new THREE.Quaternion();
    nn.set(d[0], d[1], d[2]).normalize();
    L.push('nn=' + nn.toArray().map(function (v) { return v.toFixed(4); }).join(','));
    q.setFromUnitVectors(up, nn);
    L.push('q(after setFromUnitVectors)=' + q.toArray().map(function (v) { return v.toFixed(4); }).join(','));
    L.push('  q*up=' + new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray().map(function (v) { return v.toFixed(4); }).join(','));
    qr.setFromAxisAngle(nn, 1.234);
    q.multiply(qr);
    L.push('q(after multiply qr)=' + q.toArray().map(function (v) { return v.toFixed(4); }).join(','));
    L.push('  q*up=' + new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray().map(function (v) { return v.toFixed(4); }).join(','));
    var m4 = new THREE.Matrix4(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
    pp.set(d[0] * rr, d[1] * rr, d[2] * rr); ss.set(sc, sc, sc);
    m4.compose(pp, q, ss);
    var e = m4.elements;
    L.push('compose basisY=' + [e[4], e[5], e[6]].map(function (v) { return v.toFixed(4); }).join(','));
    L.push('compose basisY/|.|=' + new THREE.Vector3(e[4], e[5], e[6]).normalize().toArray().map(function (v) { return v.toFixed(4); }).join(','));
    L.push('three REVISION=' + THREE.REVISION);
    return L.join('\n');
  });
  console.log(r);
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
