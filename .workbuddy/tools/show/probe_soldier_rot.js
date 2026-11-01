/* 定点实验：把 Soldier 用 4 个固定根旋转各渲染一张，肉眼判定"哪个朝向是站着的"。
 * 用法：node .workbuddy/tools/show/probe_soldier_rot.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });

  var imgs = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    return new Promise(function (resolve) {
      G.gltf.loadAnimated('Soldier', function (res) {
        var rot = [[0, 0, 0], [0, 0, 90], [0, 0, -90], [90, 0, 0]];
        var outs = [];
        rot.forEach(function (r) {
          var root = res.root;
          root.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
          root.position.set(0, 0, 0);
          root.updateMatrixWorld(true);
          var bb = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(); bb.getSize(sz);
          var scene = new THREE.Scene(); scene.background = new THREE.Color(0x22303f);
          scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.5));
          var dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(2, 4, 3); scene.add(dl);
          scene.add(root);
          /* 相机按包围盒自动取景：保证四张可比 */
          var cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
          var span = Math.max(sz.x, sz.y, sz.z) || 1;
          var cam = new THREE.PerspectiveCamera(35, 800 / 600, 0.01, 100);
          cam.position.set(cx, cy + span * 0.1, span * 2.2);
          cam.lookAt(cx, cy, 0);
          var cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
          var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
          rd.setSize(800, 600, false);
          rd.render(scene, cam);
          outs.push({ rot: r.join(','), size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)], url: cv.toDataURL('image/png') });
          rd.dispose();
        });
        resolve(outs);
      }, { normalize: false });
    });
  });

  imgs.forEach(function (o, i) {
    var f = '.workbuddy/shots/soldier_rot' + i + '.png';
    fs.writeFileSync(f, Buffer.from(o.url.split(',')[1], 'base64'));
    console.log('WROTE ' + f + ' rot=' + o.rot + ' size=' + JSON.stringify(o.size));
  });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
