'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage();
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });
  var r = await p.evaluate(function () {
    var G = window.GAME, THREE = window.THREE;
    function one(name, clip) {
      return new Promise(function (res) {
        G.gltf.loadAnimated(name, function (o) {
          var mixer = new THREE.AnimationMixer(o.root);
          mixer.clipAction(o.byName[clip]).play();
          function deltas(t) {
            mixer.update(t); o.root.updateMatrixWorld(true);
            var arr = [], v = new THREE.Vector3();
            o.root.traverse(function (x) { if (x.isBone) { x.getWorldPosition(v); arr.push(v.clone()); } });
            return arr;
          }
          var a0 = deltas(0), a1 = deltas(0.4), mx = 0;
          for (var i = 0; i < a0.length && i < a1.length; i++) { var d = a0[i].distanceTo(a1[i]); if (d > mx) mx = d; }
          res({ name: name, clip: clip, bones: a0.length, maxDelta: +mx.toFixed(4) });
        }, { normalize: false });
      });
    }
    return one('Soldier', 'Walk').then(function (a) { return one('RobotExpressive', 'Walking').then(function (b2) { return [a, b2]; }); });
  });
  console.log(JSON.stringify(r));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
