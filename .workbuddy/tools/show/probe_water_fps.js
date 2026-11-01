/* 水面着色器性能：在"看得见海"的视角下统计 90 帧的平均帧时间
 * 用法：node .workbuddy/tools/show/probe_water_fps.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1200, height: 820 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.evaluate(function () {
    var M = window.GAME.map3d, SP = window.GAME.mapSphere || window.GAME.sphere;
    var best = -1, bestN = -1;
    for (var t = 0; t < 900; t++) {
      var ci = (t * 7919) % SP.cells.length;
      var c = SP.cells[ci]; if (!c || c.type !== 'lake') continue;
      var n = 0, ring = [ci], seen = {}; seen[ci] = 1;
      for (var h = 0; h < 3; h++) { var nx = []; ring.forEach(function (q) { (SP.adj[q] || []).forEach(function (x) { if (seen[x]) return; seen[x] = 1; nx.push(x); if ((SP.cells[x] || {}).type === 'lake') n++; }); }); ring = nx; }
      if (n > bestN) { bestN = n; best = ci; }
    }
    var d = SP.cells[best].dir, L = Math.hypot(d[0], d[1], d[2]) || 1;
    var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
    o.yaw = Math.atan2(d[0] / L, d[2] / L); o.pitch = Math.asin(d[1] / L) + 0.32; o.dist = M.ZOOM_MIN * 1.6;
  });
  await p.waitForTimeout(1500);
  var res = await p.evaluate(function () {
    return new Promise(function (resolve) {
      var t = [], last = performance.now(), n = 0;
      function frame() {
        var now = performance.now(); t.push(now - last); last = now; n++;
        if (n < 90) requestAnimationFrame(frame); else {
          t = t.slice(10);
          t.sort(function (a, b) { return a - b; });
          var avg = t.reduce(function (a, b) { return a + b; }, 0) / t.length;
          resolve({ frames: t.length, avgMs: +avg.toFixed(2), p95Ms: +t[Math.floor(t.length * 0.95)].toFixed(2), fps: +(1000 / avg).toFixed(1) });
        }
      }
      requestAnimationFrame(frame);
    });
  });
  console.log('FPS ' + JSON.stringify(res));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
