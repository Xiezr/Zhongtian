/* 占领省府后，地图上那一格"长什么样"：等真实渲染循环重建标记后再读，
 * 判断玩家会不会觉得"我占了，但地图上还是敌方的紫色行政城"。
 * 用法：node .workbuddy/tools/show/probe_adm_marker.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', function (e) { console.log('EXC ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 120000 });
  await p.waitForTimeout(2000);

  var pick = await p.evaluate(function () {
    var M = window.GAME.map3d;
    var prov = (M.admCities || []).filter(function (c) { return c.admLevel === 'prov'; })[0];
    return { name: prov.name, ci: prov.ci, x: prov.x, y: prov.y, admIndex: prov.admIndex };
  });
  console.log('PICK ' + JSON.stringify(pick));

  var before = await p.evaluate(function (ci) {
    var M = window.GAME.map3d;
    var adm = (M._settles && M._settles.adm) || [];
    return { kind: M.cellKind ? M.cellKind[ci] : undefined,
      ref: M.cellRef && M.cellRef[ci] ? M.cellRef[ci].name : null,
      admInSettles: adm.filter(function (s) { return s.ci === ci; }).length,
      ownInSettles: ((M._settles && M._settles.own) || []).filter(function (s) { return s.ci === ci; }).length };
  }, pick.ci);
  console.log('BEFORE ' + JSON.stringify(before));

  await p.evaluate(function (prov) {
    var G = window.GAME;
    var c = (G.map3d.admCities || []).filter(function (x) { return x.name === prov.name && x.ci === prov.ci; })[0];
    G.onConquer(c, {}, null, null);
  }, pick);
  await p.waitForTimeout(2200);      /* 等渲染循环按 _mkVer 重建标记 */

  var after = await p.evaluate(function (ci) {
    var M = window.GAME.map3d;
    var adm = (M._settles && M._settles.adm) || [];
    return { kind: M.cellKind ? M.cellKind[ci] : undefined,
      ref: M.cellRef && M.cellRef[ci] ? M.cellRef[ci].name : null,
      admInSettles: adm.filter(function (s) { return s.ci === ci; }).length,
      ownInSettles: ((M._settles && M._settles.own) || []).filter(function (s) { return s.ci === ci; }).length };
  }, pick.ci);
  console.log('AFTER  ' + JSON.stringify(after));

  await p.screenshot({ path: '.workbuddy/shots/adm_marker_after.png' });
  console.log('WROTE adm_marker_after.png');
  await b.close();
})().catch(function (e) { console.error('ERR ' + (e && (e.stack || e.message))); process.exit(1); });
