'use strict';
/* v91.34 验收：侧栏（城名行按钮/驻军缩写+渐变条）+ 奇观倒计时 + 奇观贴地 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    G.map.generate(); G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    G.state.cities[0].army = { buxingji: 1234, daodanche: 56, taitan: 8 };
    G.ui.setView('city');
  });
  await p.waitForTimeout(800);

  /* 侧栏近景：城名行 + 城市属性 + 资源 + 驻军 */
  var side = await p.$('.auth-side');
  if (side) await side.screenshot({ path: '.workbuddy/shots/v9134-sidebar.png' });

  var info = await p.evaluate(function () {
    var G = window.GAME;
    var cur = (document.querySelector('#city-cur-name') || {}).innerHTML || '';
    var head = (document.querySelector('#garrison-bar .gb-head') || {}).innerHTML || '';
    var rows = Array.from(document.querySelectorAll('#garrison-bar .gb-row')).map(function (r) {
      return r.querySelector('.gb-n').textContent + '=' + r.querySelector('.gb-c').textContent;
    });
    var pid = G.state.mapPlanetId != null ? G.state.mapPlanetId : G.state.activePlanet;
    return {
      curName: cur.slice(0, 120),
      gbHead: head,
      gbRows: rows,
      leftMs: G.wonderLeftToday ? G.wonderLeftToday(pid) : null,
      leftDur: G.wonderLeftToday ? window.GAME.utils.dur(G.wonderLeftToday(pid) / 1000) : null,
    };
  });
  console.log('INFO', JSON.stringify(info));

  /* 奇观面板（含倒计时） */
  await p.evaluate(function () {
    var G = window.GAME;
    var pid = G.state.mapPlanetId != null ? G.state.mapPlanetId : G.state.activePlanet;
    G.ui.openWonder(pid);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '.workbuddy/shots/v9134-wonder-panel.png' });
  var wpanel = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 300) : 'NO MODAL';
  });
  console.log('WPANEL', wpanel);
  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) {} });

  /* 3D 奇观近景（贴地）*/
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('map');
    var M = G.map3d;
    M._wonderId = null;      /* 触发重建（应用新贴地算法）*/
  });
  await p.waitForTimeout(4000);
  var geo = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, THREE = window.THREE;
    var R = 300, HSC = 26;
    var body = M._wonderBody;
    if (!body) return { err: 'no-body' };
    var d = M._wonderUp;
    var minR = Infinity, maxR = -Infinity;
    body.updateWorldMatrix(true, true);
    body.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      var pos = o.geometry.attributes.position; var v = new THREE.Vector3();
      for (var i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)); v.applyMatrix4(o.matrixWorld); var r = Math.hypot(v.x, v.y, v.z); if (r < minR) minR = r; if (r > maxR) maxR = r; }
    });
    var surfR = R + Math.max(0, (G.mapSphere && G.mapSphere.sphElev ? G.mapSphere.sphElev(d) : 0)) * HSC;
    if (M._wonderMode === 'water') surfR = R + 2.0;
    /* 对准奇观拉近 */
    M.camO.yaw = Math.atan2(d[0], d[2]);
    M.camO.pitch = Math.asin(Math.max(-1, Math.min(1, d[1])));
    M.camO.dist = (M._wonderR || 300) * 1.7;
    if (M.wonderStep) M.wonderStep();
    G.ui.renderMapCanvas();
    return { mode: M._wonderMode, surfR: Math.round(surfR), minVertR: Math.round(minR), maxVertR: Math.round(maxR), seatErr: Math.round(minR - surfR), bodyR: Math.round(Math.hypot(body.position.x, body.position.y, body.position.z)) };
  });
  console.log('GEO', JSON.stringify(geo));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '.workbuddy/shots/v9134-wonder-seat.png' });
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
