/* 城堡朝向实拍 v2：从"实际渲染出来的实例"里挑一座（必然不过雾），
 * 按它的世界坐标对准，距离按格宽反推，保证城堡占屏 1/3 左右。
 * 用法：node .workbuddy/tools/show/shot_castle_look2.js [前缀]
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var PREFIX = process.argv[2] || 'castle2';
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, SEED);
  await p.waitForFunction(function () {
    var ov = document.getElementById('boot-loading');
    return !ov || !ov.classList.contains('on');
  }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, THREE = window.THREE;
    var m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
    var best = null;
    (M._towns || []).forEach(function (im, gi) {
      for (var i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4); m4.decompose(pos, qt, sc);
        if (!best || sc.x > best.sc) best = { sc: sc.x, pos: [pos.x, pos.y, pos.z], group: gi, i: i };
      }
    });
    var upv = new THREE.Vector3(0, 1, 0).applyQuaternion(qt);
    var rad = pos.clone().normalize();
    return {
      R: M.ZOOM_MIN, pick: best,
      dotYRadial: upv.dot(rad),
      settleTotal: Object.keys(M._settles || {}).reduce(function (a, k) { return a + (M._settles[k] || []).length; }, 0),
      visibleInstances: (M._towns || []).reduce(function (a, im) { return a + im.count; }, 0)
    };
  });
  console.log('INFO ' + JSON.stringify(info));

  var k = 0;
  var angles = [0, 60, 130];
  for (k = 0; k < angles.length; k++) {
    await p.evaluate(function (arg) {
      var M = window.GAME.map3d, o = M.camO;
      var pos = arg.pos, R = arg.R;
      var L = Math.hypot(pos[0], pos[1], pos[2]) || 1;
      var nx = pos[0] / L, ny = pos[1] / L, nz = pos[2] / L;
      M.clearFocus && M.clearFocus();
      M.camFree = true;
      o.yaw = Math.atan2(nx, nz) + arg.ang * Math.PI / 180;
      o.pitch = Math.asin(Math.max(-1, Math.min(1, ny))) + 0.42;
      o.dist = R + 58;               /* 离地 58 → 城堡占屏 100px 量级，看得出"立没立住" */
    }, { pos: info.pick.pos, R: info.R, ang: angles[k] });
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/shots/' + PREFIX + '_' + 'ABC'[k] + '.png' });
  }
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
