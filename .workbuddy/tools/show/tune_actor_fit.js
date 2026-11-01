/* 端到端标定：直接调 GAME.gltf.FIT[asset].scale 的候选值，
 * 走**真实解析路径**（normalize 默认开）渲染，量像素高，挑最接近目标的那一个。
 * 用法：node .workbuddy/tools/show/tune_actor_fit.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage();
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });

  var res = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    var W = 320, H = 320, FOV = 40, DIST = 3.0, TARGET = 150;   /* 目标像素高 */
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 3));
    var cam = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1e6);
    cam.position.set(0, 1.0, DIST); cam.lookAt(0, 0.5, 0);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
    rd.setSize(W, H, false); rd.setClearColor(0x000000, 0);

    function pxHeight() {
      rd.render(scene, cam);
      var gl = rd.getContext(), px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var minY = 1e9, maxY = -1, n = 0;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] > 20) { n++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      return n ? (maxY - minY + 1) : 0;
    }

    function tune(name) {
      return new Promise(function (resolve) {
        var best = null;
        var scales = [];
        for (var e = -2; e <= 2.001; e += 0.25) scales.push(Math.pow(10, e));
        function step(i) {
          if (i >= scales.length) return finish();
          var s = scales[i];
          G.gltf.FIT[name] = { scale: s, footY: 0 };
          G.gltf.loadAnimated(name, function (o) {
            /* 清掉上一轮 */
            while (scene.children.length > 1) scene.remove(scene.children[scene.children.length - 1]);
            scene.add(o.root);
            o.root.position.set(0, 0, 0);
            o.root.updateMatrixWorld(true);
            var ph = pxHeight();
            if (ph && Math.abs(ph - TARGET) < (best ? Math.abs(best.px - TARGET) : 1e9)) best = { scale: s, px: ph };
            step(i + 1);
          }, { name: name });
        }
        function finish() { resolve({ name: name, best: best, target: TARGET }); }
        step(0);
      });
    }
    return tune('Soldier').then(function (a) { return tune('RobotExpressive').then(function (b2) { return [a, b2]; }); });
  });
  res.forEach(function (r) { console.log(JSON.stringify(r)); });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
