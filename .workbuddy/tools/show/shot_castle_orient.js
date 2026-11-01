/* 城堡朝向诊断：把镜头怼到一座城上拍特写 + 数值核对"基座是否 ⟂ 半径"
 * 用法：node .workbuddy/tools/show/shot_castle_orient.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  p.on('console', function (m) { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, SEED);
  await p.waitForTimeout(2500);

  /* ---- 数值核对：每座城的局部 +Y 是否等于该格径向 ---- */
  var audit = await p.evaluate(function () {
    var M = window.GAME.map3d, out = [];
    var S = M._settles;
    if (!S) return { err: 'no _settles' };
    var THREE = window.THREE;
    ['own', 'npc', 'adm', 'fort'].forEach(function (k) {
      (S[k] || []).forEach(function (e) {
        out.push({ k: k, ci: e.ci, lv: e.lv });
      });
    });
    /* 从 InstancedMesh 反解实例矩阵 */
    var res = [];
    (M._towns || []).forEach(function (im) {
      var m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
      var minDot = 9, maxDot = -9, worst = null;
      for (var i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4);
        m4.decompose(pos, qt, sc);
        var upv = new THREE.Vector3(0, 1, 0).applyQuaternion(qt);
        var rad = pos.clone().normalize();
        var dt = upv.dot(rad);
        if (dt < minDot) { minDot = dt; worst = { i: i, dt: dt, pos: [pos.x, pos.y, pos.z] }; }
        if (dt > maxDot) maxDot = dt;
      }
      res.push({ count: im.count, minDot: minDot, maxDot: maxDot, worst: worst });
    });
    return { towns: res, settles: out.length, sample: out.slice(0, 6) };
  });
  console.log('AUDIT ' + JSON.stringify(audit, null, 1));

  /* ---- 特写：对准己方首城，拉近 ---- */
  var shotInfo = await p.evaluate(function () {
    var M = window.GAME.map3d;
    var S = M._settles || {};
    var list = (S.own || []).concat(S.npc || [], S.adm || [], S.fort || []);
    if (!list.length) return { err: 'no settle' };
    var t = list[0];
    M.setZoom(0.02);
    M.focusOnCell(t.ci, true);
    return { ci: t.ci, key: 'ok' };
  });
  console.log('FOCUS ' + JSON.stringify(shotInfo));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/shots/castle_close_a.png' });

  /* 换两个方位角，看同一座城 */
  for (var k = 0; k < 2; k++) {
    await p.evaluate(function (kk) {
      var M = window.GAME.map3d;
      var o = M.camO;
      if (o) { o.az = (o.az || 0) + 60 * (kk + 1); o.el = 20 + 18 * kk; }
    }, k);
    await p.waitForTimeout(700);
    await p.screenshot({ path: '.workbuddy/shots/castle_close_' + 'bcd'[k] + '.png' });
  }
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
