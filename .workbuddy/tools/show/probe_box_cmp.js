'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage();
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf', null, { timeout: 30000 });
  var r = await p.evaluate(function () {
    var G = window.GAME, THREE = window.THREE;
    return new Promise(function (res) {
      G.gltf.loadAnimated('Soldier', function (o) {
        var root = o.root;
        function sizeOf(obj) {
          obj.updateMatrixWorld(true);
          var bb = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); bb.getSize(s);
          return [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)];
        }
        var bare = sizeOf(root);
        var wrap = new THREE.Group(); wrap.add(root); wrap.updateMatrixWorld(true);
        var inWrap = sizeOf(wrap);
        var scaleInTree = [];
        root.traverse(function (x) { if (x.scale && (Math.abs(x.scale.x - 1) > 1e-6)) scaleInTree.push(x.name + ':' + x.scale.x.toFixed(3)); });
        res({ bare: bare, inWrap: inWrap, scaledNodes: scaleInTree.slice(0, 6), meta: o.meta });
      }, { normalize: false });
    });
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
