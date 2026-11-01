/* 水面 A/B：同一机位，uAmp=3.2（现状）与 uAmp=0（关浪）各拍一张，
 * 用来确认"规整感"到底是不是波浪贡献的。
 * 用法：node .workbuddy/tools/show/probe_water_ab.js
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
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, SP = window.GAME.mapSphere || window.GAME.sphere;
    /* 找最大的连通水域：随机撒点找"2 环全水"的格，取周围水格最多者 */
    var best = -1, bestN = -1;
    for (var t = 0; t < 900; t++) {
      var ci = (t * 7919) % SP.cells.length;
      var c = SP.cells[ci]; if (!c || c.type !== 'lake') continue;
      var n = 0, ring = [ci], seen = {}; seen[ci] = 1;
      for (var h = 0; h < 3; h++) {
        var nx = [];
        ring.forEach(function (q) { (SP.adj[q] || []).forEach(function (x) { if (seen[x]) return; seen[x] = 1; nx.push(x); if ((SP.cells[x] || {}).type === 'lake') n++; }); });
        ring = nx;
      }
      if (n > bestN) { bestN = n; best = ci; }
    }
    var d = SP.cells[best].dir, L = Math.hypot(d[0], d[1], d[2]) || 1;
    window.__OC = { yaw: Math.atan2(d[0] / L, d[2] / L), lat: Math.asin(d[1] / L) };
    return { ci: best, water3ring: bestN };
  });
  console.log('TARGET ' + JSON.stringify(info));

  /* 三个距离各来一组 A/B，都在"看得见水"的档位 */
  var zooms = [{ n: 'z23', d: 2.30 }, { n: 'z16', d: 1.60 }, { n: 'z12', d: 1.20 }];
  for (var i = 0; i < zooms.length; i++) {
    for (var on = 0; on < 2; on++) {
      await p.evaluate(function (arg) {
        var M = window.GAME.map3d, o = M.camO;
        M.clearFocus && M.clearFocus(); M.camFree = true;
        o.yaw = window.__OC.yaw; o.pitch = window.__OC.lat + 0.32; o.dist = M.ZOOM_MIN * arg.d;
        if (M._waterMat && M._waterMat.uniforms && M._waterMat.uniforms.uAmp) {
          M._waterMat.uniforms.uAmp.value = arg.amp;
        }
      }, { d: zooms[i].d, amp: on ? 3.2 : 0 });
      await p.waitForTimeout(800);
      await p.screenshot({ path: '.workbuddy/shots/water_' + zooms[i].n + (on ? '_wave' : '_flat') + '.png' });
    }
  }
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
