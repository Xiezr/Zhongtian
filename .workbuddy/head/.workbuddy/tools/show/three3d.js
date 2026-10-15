/* Three.js 真 3D 地形原型（用游戏真实地形数据）
 * 用法：node .workbuddy/tools/show/three3d.js
 * 产出：.workbuddy/shots/three3d.png
 * 正路：三角网格 + 平滑法线 + 方向光/环境光 + 水面平面（WebGL 真光栅化）。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  p.on('console', function (m) { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
  }, SEED);
  await p.addScriptTag({ path: 'E:/Deepseekdb/vendor/three.min.js' });
  var ok = await p.evaluate(function () { return typeof THREE !== 'undefined'; });
  console.log('THREE loaded = ' + ok);

  var dataUrl = await p.evaluate(function (o) {
    var G = window.GAME, DATA = G.DATA, grid = G.state.map.grid, seed = G.state.map.seed;
    if (typeof THREE === 'undefined') return 'NO-THREE';
    /* --- 噪声（复刻 map.js 的 fbm 做细节） --- */
    function nhash(ix, iy, salt) { var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    function vnoise(x, y, step, salt) { var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); var a = nhash(ix, iy, salt), b2 = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt); var r0 = a + (b2 - a) * tx, r1 = c + (d - c) * tx; return r0 + (r1 - r0) * ty; }
    var OCT = [[14, 0.5], [7, 0.3], [3.5, 0.2]];
    function fbm(x, y, salt) { var v = 0; for (var i = 0; i < OCT.length; i++) v += OCT[i][1] * vnoise(x, y, OCT[i][0], salt + i * 101); return v; }

    /* --- 选一块地形多样的区域 --- */
    function terr(gx, gz) { return (grid[gz] && grid[gz][gx] && grid[gz][gx].terrain) || 'plain'; }
    var N = o.N;
    function score(rx, rz) { var v = 0, types = {}; for (var z = 0; z < N; z += 4) for (var x = 0; x < N; x += 4) { var t = terr(rx + x, rz + z); types[t] = 1; v++; } return Object.keys(types).length; }
    var best = null;
    for (var t2 = 0; t2 < 80; t2++) { var rx = 30 + (t2 * 53) % (DATA.MAP_W - N - 60), rz = 30 + (t2 * 71) % (DATA.MAP_H - N - 60); var s = score(rx, rz); if (!best || s > best.s) best = { x: rx, z: rz, s: s }; }
    var x0 = best.x, z0 = best.z;

    /* --- 地形深度（到最近异类地形的距离）→ 山穹顶 --- */
    var w = DATA.MAP_W, h = DATA.MAP_H, dpt = {};
    (function () {
      var q = [], seen = {};
      for (var z = 30; z < 30 + N + 8; z++) for (var x = 30; x < 30 + N + 8; x++) {
        var tt = terr(x, z), e = (terr(x - 1, z) !== tt || terr(x + 1, z) !== tt || terr(x, z - 1) !== tt || terr(x, z + 1) !== tt);
        if (e) { dpt[x + ',' + z] = 0; q.push([x, z]); } else dpt[x + ',' + z] = -1;
      }
      var head = 0;
      while (head < q.length) { var c = q[head++], nd = dpt[c[0] + ',' + c[1]] + 1; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = c[0] + d[0], nz = c[1] + d[1], k = nx + ',' + nz; if (dpt[k] === -1) { dpt[k] = nd; q.push([nx, nz]); } }); }
    })();

    /* --- 高度场 --- */
    var HMAX = 22;
    function heightAt(gx, gz) {
      var t = terr(gx, gz);
      if (t === 'lake' || t === 'zhaoze') return 0;
      var base = fbm(gx, gz, seed * 7 + 11);
      var bias = { plain: 0.10, caoyuan: 0.18, desert: 0.20, forest: 0.34, hill: 0.62 }[t] || 0.15;
      var hh = (base * 0.55 + bias);
      if (t === 'hill') { var dep = dpt[gx + ',' + gz] || 0; hh += Math.min(1, dep / 7) * 0.9; }   /* 穹顶：中间高 */
      return Math.max(0, hh) * HMAX;
    }

    /* --- 组网格（N+1 × N+1 顶点） --- */
    var V = N + 1, positions = [], colors = [], index = [];
    var waterH = 1.0;
    function terrColor(t, hh) {
      // 角点色：按地形 + 高度（平滑）；水另画
      var c = {
        plain: [150, 172, 120], caoyuan: [170, 186, 104], forest: [70, 112, 54],
        desert: [214, 188, 122], hill: [150, 138, 116], zhaoze: [108, 126, 104], lake: [70, 138, 176]
      }[t] || [150, 172, 120];
      var k = 0.72 + Math.min(1, hh / HMAX) * 0.55;    /* 越高越亮 */
      return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
    }
    for (var z = 0; z < V; z++) for (var x = 0; x < V; x++) {
      var gx = x0 + x, gz = z0 + z;
      var hh = heightAt(gx, gz);
      positions.push(x, hh, z);
      var col = terrColor(terr(gx, gz), hh);
      colors.push(col[0] / 255, col[1] / 255, col[2] / 255);
    }
    for (var z2 = 0; z2 < N; z2++) for (var x2 = 0; x2 < N; x2++) {
      var a = z2 * V + x2, b2 = a + 1, c2 = a + V, d2 = c2 + 1;
      index.push(a, c2, b2, b2, c2, d2);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();

    /* --- 场景 --- */
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbcd4e0);
    scene.fog = new THREE.Fog(0xcfe0e6, 120, 320);
    var cam = new THREE.PerspectiveCamera(38, o.w / o.h, 1, 2000);
    var cx = N / 2, cz = N / 2;
    cam.position.set(cx - 40, 70, cz + 105);        /* 斜俯视 */
    cam.lookAt(cx, 6, cz);

    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    var sun = new THREE.DirectionalLight(0xffe9c2, 1.55);
    sun.position.set(cx - 90, 120, cz - 40);        /* 暖阳左上前方 */
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xbfd4e8, 0.35);
    fill.position.set(cx + 80, 50, cz + 90);
    scene.add(fill);

    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0.0, flatShading: false });
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    /* --- 水面（低处） --- */
    var wgeo = new THREE.PlaneGeometry(N, N);
    wgeo.rotateX(-Math.PI / 2);
    var wmat = new THREE.MeshStandardMaterial({ color: 0x4a86b0, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.86 });
    var water = new THREE.Mesh(wgeo, wmat);
    water.position.set(cx, waterH, cz);
    scene.add(water);

    var canvas = document.createElement('canvas'); canvas.width = o.w; canvas.height = o.h;
    document.body.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(o.w, o.h, false);
    renderer.shadowMap.enabled = false;
    renderer.render(scene, cam);
    var url = canvas.toDataURL('image/png');
    return url;
  }, { N: 140, w: 1280, h: 720 });

  if (dataUrl === 'NO-THREE') { console.log('THREE 未加载，停'); await b.close(); return; }
  fs.writeFileSync('.workbuddy/shots/three3d.png', Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('THREE3D-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
