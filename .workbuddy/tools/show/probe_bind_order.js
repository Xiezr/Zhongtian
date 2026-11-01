/* 绑定顺序实验：normalize:false 载入后，手动给根节点做旋转/缩放（**不重绑**），
   看是否仍然站立 —— 用来判定"重绑"到底有没有必要/有没有害。
   用法：node .workbuddy/tools/show/probe_bind_order.js */
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
  var img = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    return new Promise(function (resolve) {
      G.gltf.loadAnimated('Soldier', function (res) {
        var root = res.root;                    /* normalize:false → 原始变换，绑定未动 */
        var scene = new THREE.Scene(); scene.background = new THREE.Color(0x22303f);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.5));
        var dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(2, 4, 3); scene.add(dl);
        /* 外层容器承担 缩放（模拟归一化），不改内层 —— 看蒙皮会不会崩 */
        var wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(0.55); scene.add(wrap);
        wrap.updateMatrixWorld(true);
        var cam = new THREE.PerspectiveCamera(35, 800 / 600, 0.01, 100);
        cam.position.set(0, 1.0, 2.2); cam.lookAt(0, 0.9, 0);
        var cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
        var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
        rd.setSize(800, 600, false); rd.render(scene, cam);
        resolve(cv.toDataURL('image/png'));
      }, { normalize: false });
    });
  });
  fs.writeFileSync('.workbuddy/shots/soldier_wrapscale.png', Buffer.from(img.split(',')[1], 'base64'));
  console.log('WROTE .workbuddy/shots/soldier_wrapscale.png');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
