/* 资产尺寸标定：渲染 → 读像素 → 反推"模型在世界里有多高" → 给出"缩到 1 单位"的系数
 * 用法：node .workbuddy/tools/show/calib_actor_fit.js
 * 输出：可直接抄进 js/gltf.js 的 GTF.FIT
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage();
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });

  var res = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    var W = 300, H = 300, FOV = 40, DIST = 20;
    var viewH = 2 * DIST * Math.tan(FOV * Math.PI / 360);   /* z=0 平面上的可见世界高度 */

    function measurePixels(root) {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
      rd.setSize(W, H, false);
      rd.setClearColor(0x000000, 0);
      var scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 3));
      scene.add(root);
      var cam = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1e6);
      cam.position.set(0, 0, DIST); cam.lookAt(0, 0, 0);
      rd.render(scene, cam);
      var gl = rd.getContext();
      var px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var minY = 1e9, maxY = -1, minX = 1e9, maxX = -1, n = 0;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var a = px[(y * W + x) * 4 + 3];
        if (a > 20) { n++; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
      }
      rd.dispose();
      cv.width = cv.height = 1;
      return n ? { h: maxY - minY + 1, w: maxX - minX + 1, cover: n / (W * H) } : null;
    }

    function calib(name) {
      return new Promise(function (resolve) {
        G.gltf.loadAnimated(name, function (o) {
          var root = o.root;
          /* 资产尺度可能差 1e5 倍（Soldier 真实只有 0.003 单位）→ 先对数扫描找量级，再细化 */
          var out = null, base = null;
          for (var e = -5; e <= 6 && !out; e += 0.5) {
            var s0 = Math.pow(10, e);
            root.scale.setScalar(s0); root.updateMatrixWorld(true);
            var m0 = measurePixels(root);
            if (m0 && m0.h >= H * 0.35 && m0.h <= H * 0.95) { out = { scale: s0, h: m0.h, w: m0.w, cover: m0.cover }; base = s0; break; }
          }
          if (out) {
            /* 细化：把像素高度调到 ~70% */
            var lo = out.scale / 3, hi = out.scale * 3;
            for (var it = 0; it < 18; it++) {
              var mid = Math.sqrt(lo * hi);
              root.scale.setScalar(mid); root.updateMatrixWorld(true);
              var m = measurePixels(root);
              if (m && m.h > H * 0.95) { hi = mid; continue; }
              if (!m || m.h < H * 0.62) { lo = mid; continue; }
              out = { scale: mid, h: m.h, w: m.w, cover: m.cover };
              break;
            }
          }
          if (!out) return resolve({ name: name, err: 'calib failed' });
          /* 该缩放下的世界高度 = 像素占比 × 视高 */
          var worldH = (out.h / H) * viewH;
          var unitScale = out.scale / worldH;                   /* 缩到"世界高 1"所需的根缩放 */
          resolve({ name: name, probeScale: out.scale, pixels: out.h, worldH: +worldH.toFixed(3), unitScale: +unitScale.toFixed(6) });
        }, { normalize: false });
      });
    }
    return calib('Soldier').then(function (a) { return calib('RobotExpressive').then(function (b2) { return [a, b2]; }); });
  });
  res.forEach(function (r) { console.log(JSON.stringify(r)); });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
