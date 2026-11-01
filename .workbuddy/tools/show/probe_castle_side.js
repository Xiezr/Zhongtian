/* 城堡朝向「侧视图」诊断：把实例的几何+矩阵搬到独立场景，
 * 旁边立一块**该点的切平面**（垂直于半径的圆盘 = 理想地面），侧视看它立没立住。
 * 用法：node .workbuddy/tools/show/probe_castle_side.js [前缀]
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var PREFIX = process.argv[2] || 'castle_side';

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1000, height: 700 } });
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
  await p.waitForFunction(function () {
    var ov = document.getElementById('boot-loading');
    return !ov || !ov.classList.contains('on');
  }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);

  var shots = await p.evaluate(function () {
    var THREE = window.THREE, M = window.GAME.map3d;
    var m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
    /* 取第一座城（city 模板）与第一座据点（fort 模板），各拍一张 */
    var picks = [];
    (M._towns || []).forEach(function (im, gi) {
      if (!im.count) return;
      im.getMatrixAt(0, m4); m4.decompose(pos, qt, sc);
      picks.push({ gi: gi, geo: im.geometry, mat: im.material, m: m4.clone(), pos: pos.clone(), sc: sc.x });
    });

    var out = [];
    picks.forEach(function (pk, idx) {
      var rad = pk.pos.clone().normalize();
      var scene2 = new THREE.Scene();
      scene2.background = new THREE.Color(0x1b2430);

      /* ① 城堡本体：几何 + 完整实例矩阵（位置/姿态/缩放都原样搬过来） */
      var mesh = new THREE.Mesh(pk.geo, pk.mat);
      mesh.applyMatrix4(pk.m);
      scene2.add(mesh);

      /* ② 参考地面：一块"垂直于半径"的大圆盘，摆在城堡脚底那一层 */
      var disc = new THREE.Mesh(
        new THREE.CircleGeometry(pk.sc * 6, 48),
        new THREE.MeshBasicMaterial({ color: 0x2e6f4e, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      disc.position.copy(pk.pos);
      disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rad);   /* 圆盘法线(自身+Z) → 半径 */
      scene2.add(disc);

      /* ③ 一根"半径指示线"：从脚底沿法线往外伸 → 城堡应与之平行 */
      var lg = new THREE.BufferGeometry().setFromPoints([
        pk.pos.clone(), pk.pos.clone().add(rad.clone().multiplyScalar(pk.sc * 5))
      ]);
      scene2.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffd166 })));

      /* ④ 相机：站在切平面里侧看（仰角 12°），这样"歪没歪"一眼可见 */
      var cam2 = new THREE.PerspectiveCamera(38, 1000 / 700, 0.1, 10000);
      var up = rad.clone();
      var t1 = new THREE.Vector3(0, 1, 0).cross(up);
      if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
      t1.normalize();
      var t2 = new THREE.Vector3().crossVectors(up, t1).normalize();
      var target = pk.pos.clone().add(up.clone().multiplyScalar(pk.sc * 1.1));
      var eye = target.clone()
        .add(t1.clone().multiplyScalar(pk.sc * 7.2))
        .add(t2.clone().multiplyScalar(pk.sc * 2.6))
        .add(up.clone().multiplyScalar(pk.sc * 1.5));
      cam2.position.copy(eye);
      cam2.up.copy(up);
      cam2.lookAt(target);

      var cv = document.createElement('canvas'); cv.width = 1000; cv.height = 700;
      var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      rd.setSize(1000, 700, false);
      rd.render(scene2, cam2);
      var url = cv.toDataURL('image/png');
      rd.dispose();
      out.push({ idx: idx, url: url, pos: pk.pos.toArray().map(function (v) { return +v.toFixed(1); }), sc: +pk.sc.toFixed(3) });
    });
    return out;
  });

  shots.forEach(function (s, i) {
    var b64 = s.url.split(',')[1];
    var f = '.workbuddy/shots/' + PREFIX + '_' + i + '.png';
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log('WROTE ' + f + '  pos=' + JSON.stringify(s.pos) + ' scale=' + s.sc);
  });
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
