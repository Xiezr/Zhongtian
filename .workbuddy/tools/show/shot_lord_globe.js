/* 前传：君主站在球面的姿态核对（applyQuad 重构后） */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8, prologue: true });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function(){ var o=document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(2000);
  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, P = window.GAME.prologue;
    if (!M || !P || !M.buildFigures) return 'no api';
    M.buildFigures(); M.syncFigures && M.syncFigures();
    var ci = P.pos ? P.pos() : -1;
    var SP = window.GAME.mapSphere || window.GAME.sphere;
    var d = SP.cells[ci] && SP.cells[ci].dir;
    if (d) {
      var L = Math.hypot(d[0], d[1], d[2]) || 1;
      var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
      o.yaw = Math.atan2(d[0] / L, d[2] / L); o.pitch = Math.asin(d[1] / L) + 0.5; o.dist = M.ZOOM_MIN + 40;
    }
    return 'ci=' + ci;
  });
  console.log(info);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/shots/lord_globe.png' });
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
