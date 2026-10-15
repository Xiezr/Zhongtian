/* v90.69 实机验收：3D 星球主地图 + 附属平地「建城」按钮（需求 1/2）+ 球面地形口径。
 * 用法：node .workbuddy/tools/show/verify_v9069_buildcity.js
 * 产出：.workbuddy/shots/v9069-map3d.png（3D 主地图）、v9069-buildcity.png（建城弹窗）
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e && (e.message || e))); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
    G.refreshAll();
  });
  await p.waitForTimeout(1200);   /* 等 3D 首次渲染 */

  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    return {
      map3dEnabled: !!(G.map3d && G.map3d.enabled),
      sphereCells: G.sphere && G.sphere.cells ? G.sphere.cells.length : 0,
      canvas: (function () { var c = document.getElementById('mapCanvas'); return c ? c.width + 'x' + c.height : 'none'; })()
    };
  });
  console.log('① 3D 星球:', JSON.stringify(r1));
  await p.screenshot({ path: '.workbuddy/shots/v9069-map3d.png' });

  /* ② 附属平地 → 弹窗是否有「建城」按钮；并与平面格地形对照 */
  var r2 = await p.evaluate(function () {
    var G = window.GAME, S = G.sphere;
    var found = null;
    for (var i = 0; i < S.cells.length; i++) {
      if (!S.cells[i] || S.cells[i].type !== 'plain') continue;
      var c = S.cells[i];
      var x = Math.round(c.lon / 360 * 500) % 500, y = Math.round((0.5 - c.lat / 180) * 500) % 500;
      var t = G.map.tile(x, y); if (!t) continue;
      if (t.terrain === 'plain') continue;           /* 找「球面=平地 但 平面格≠平地」的错配格 */
      found = { x: x, y: y, sphere: c.type, planar: t.terrain }; break;
    }
    if (!found) {                                  /* 没找到就退回任一球面平地格 */
      for (var j = 0; j < S.cells.length; j++) {
        if (!S.cells[j] || S.cells[j].type !== 'plain') continue;
        var cc = S.cells[j], xx = Math.round(cc.lon / 360 * 500) % 500, yy = Math.round((0.5 - cc.lat / 180) * 500) % 500;
        if (!G.map.tile(xx, yy)) continue;
        found = { x: xx, y: yy, sphere: 'plain', planar: G.map.tile(xx, yy).terrain }; break;
      }
    }
    if (!found) return { err: 'no plain tile' };
    /* 造一条"已占领野地"记录（附属野地）→ 打开地块面板 */
    G.state.wilds = G.state.wilds || [];
    if (!G.map.wildAt(found.x, found.y)) G.state.wilds.push({ x: found.x, y: found.y, type: 'plain', level: 6 });
    G.ui.openLandModal(found.x, found.y);
    var btn = document.querySelector('#modal-root [data-action="build-city"]');
    return { found: found, hasBuildBtn: !!btn, btnText: btn ? btn.textContent.trim() : '' };
  });
  console.log('② 附属平地建城:', JSON.stringify(r2));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '.workbuddy/shots/v9069-buildcity.png' });

  console.log('pageerrors:', JSON.stringify(errs));
  console.log('SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
