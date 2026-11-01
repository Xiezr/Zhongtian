/* 海面观感探针 v2：对准大片水域，按 3 档距离（轨道 / 中景 / 近景）各拍一张，
 * 用来判断"规整感"出现在哪一档。
 * 用法：node .workbuddy/tools/show/shot_ocean.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1200, height: 820 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, SP = window.GAME.mapSphere || window.GAME.sphere;
    var best = -1, bestWet = -1;
    for (var ci = 0; ci < SP.cells.length; ci++) {
      var c = SP.cells[ci]; if (!c || c.type !== 'lake') continue;
      var wet = 0, tot = 0;
      var ring = [ci], seen = {};
      seen[ci] = 1;
      for (var h = 0; h < 2; h++) {
        var nx = [];
        ring.forEach(function (q) {
          (SP.adj[q] || []).forEach(function (n) {
            if (seen[n]) return; seen[n] = 1; nx.push(n);
            tot++; if ((SP.cells[n] || {}).type === 'lake') wet++;
          });
        });
        ring = nx;
      }
      if (tot && wet === tot && tot > bestWet) { bestWet = tot; best = ci; }
      if (bestWet > 40) break;
    }
    if (best < 0) return { err: 'no open water' };
    var d = SP.cells[best].dir, L = Math.hypot(d[0], d[1], d[2]) || 1;
    window.__OC = { yaw: Math.atan2(d[0] / L, d[2] / L), lat: Math.asin(d[1] / L) };
    return { ci: best, openCells: bestWet, zoomMin: M.ZOOM_MIN };
  });
  console.log('TARGET ' + JSON.stringify(info));
  if (info.err) { await b.close(); return; }

  var shots = [
    { name: 'orbit', d: 2.30, pitch: 0.30 },
    { name: 'mid', d: 1.55, pitch: 0.30 },
    { name: 'near', d: 1.12, pitch: 0.22 }
  ];
  for (var i = 0; i < shots.length; i++) {
    await p.evaluate(function (s) {
      var M = window.GAME.map3d, o = M.camO;
      M.clearFocus && M.clearFocus(); M.camFree = true;
      o.yaw = window.__OC.yaw;
      o.pitch = window.__OC.lat + s.pitch;
      o.dist = M.ZOOM_MIN * s.d;
    }, shots[i]);
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/shots/ocean_' + shots[i].name + '.png' });
  }
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
