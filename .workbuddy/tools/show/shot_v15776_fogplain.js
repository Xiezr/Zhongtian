'use strict';
/* v157.76 取证：视野不再改地形色（顶点色零压暗），探明与否只由地块线框标识。
 * 三层证据：
 *   ① 行为：F.bump 把若干格从未探明推到全明（_ver++ → render 触发 buildFog）后，
 *      globe 顶点色**逐位不变** —— 这条是「不影响原来的渲染颜色」的硬证据。
 *   ② 行为：同一批线框色**必须变化**（fog=0 段从背景色变成冷蓝）—— 标识仍在。
 *   ③ 视觉：700 / 300 / 160 三档截图。
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var base = await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    return { version: G.VERSION, cells: (G.sphere && G.sphere.cells || []).length };
  }, 20260926);
  console.log('===== BASE =====');
  console.log(JSON.stringify(base));

  await p.evaluate(function () { try { window.GAME.map3d.resetView(); } catch (e) { } });
  await p.waitForTimeout(6000);

  /* ---- ①② 行为取证：顶点色不变 / 线框色必须变 ---- */
  var beh = await p.evaluate(function () {
    return new Promise(function (resolve) {
      var G = window.GAME, M = G.map3d, F = G.fog;
      var geo = M._globe && M._globe.geometry;
      var cAttr = geo && geo.getAttribute && geo.getAttribute('color');
      var lAttr = M._lineColAttr;
      if (!cAttr || !lAttr) { resolve({ err: '取不到颜色属性' }); return; }

      /* 顶点色采样：每 331 个顶点取 1 个，共 300 点（覆盖六个面） */
      var STEP = 331, N = 300;
      var snap = function () {
        var out = [], a = cAttr.array;
        for (var i = 0; i < N; i++) {
          var o = (i * STEP) % (cAttr.count) * 3;
          out.push(a[o], a[o + 1], a[o + 2]);
        }
        return out;
      };
      var lineSnap = function () {
        var out = [], a = lAttr.array;
        for (var i = 0; i < 120; i++) out.push(a[i]);
        return out;
      };

      var beforeC = snap(), beforeL = lineSnap();

      /* 找 40 个未探明格，推到全明（真实走 F.bump，会触发 _ver++） */
      var unknown = [];
      for (var ci = 0; ci < (G.sphere.cells || []).length && unknown.length < 40; ci++) {
        if (F.get(ci) === 0) unknown.push(ci);
      }
      unknown.forEach(function (ci) { F.bump(ci, 2); });
      var verAfter = F.ver();

      /* 等两帧，让 render 里的 _fogVer 比对触发 buildFog */
      var frames = 0;
      var tick = function () {
        frames++;
        if (frames < 4) { requestAnimationFrame(tick); return; }
        var afterC = snap(), afterL = lineSnap();
        var same = beforeC.length === afterC.length;
        var diffC = 0, diffL = 0;
        for (var i = 0; i < beforeC.length; i++) if (Math.abs(beforeC[i] - afterC[i]) > 1e-9) diffC++;
        for (var j = 0; j < beforeL.length; j++) if (Math.abs(beforeL[j] - afterL[j]) > 1e-9) diffL++;
        resolve({
          bumped: unknown.length, ver: verAfter,
          sampled: N, globeDiff: diffC, lineDiff: diffL,
          fog2: (function () { var n = 0; for (var k = 0; k < 200; k++) if (F.get(k) === 2) n++; return n; })()
        });
      };
      requestAnimationFrame(tick);
    });
  });
  console.log('===== 行为取证 =====');
  console.log(JSON.stringify(beh));

  /* 模拟真实存档：以**当前城**为中心探明一片 + 几处不规则凸起（像走过路径），
     再把相机对准它 —— 圈落在画面中央才好判断观感。 */
  var grow = await p.evaluate(function () {
    var G = window.GAME, F = G.fog, M = G.map3d;
    /* 以**相机正对的那一格**为圆心 reveal —— 前面的教训：用城市中心时探明区常在球背面，
       截图上一条边界都看不见，白验一轮。 */
    var _cd = new THREE.Vector3(0, 0, 1);
    try { _cd = G.map3d._cam.position.clone().normalize(); } catch (e0) { }
    var ci = G.sphere.nearestCell([_cd.x, _cd.y, _cd.z]);
    var c = (typeof G.currentCity === 'function') ? G.currentCity() : null;
    F.revealAround(ci, 8, 2);
    var hops = (G.sphere && G.sphere.hopsWithin) ? G.sphere.hopsWithin(ci, 13) : [];
    for (var i = 0; i < hops.length; i += 9) F.revealAround(hops[i], 4, 2);
    var kn = 0;
    for (var j = 0; j < G.sphere.cells.length; j++) if (F.get(j) > 0) kn++;
    return { ci: ci, name: c && c.name, known: kn, ver: F.ver() };
  });
  await p.waitForTimeout(2000);
  console.log('===== reveal 后 =====');
  console.log(JSON.stringify(grow));
  var probeAfter = await p.evaluate(function () { var M=window.GAME.map3d; return {segs:M._fogEdgeSegCount, drawn:M._fogEdgeDrawn, surf:!!M._surf, ver:window.GAME.VERSION}; });
  console.log('probeAfter=' + JSON.stringify(probeAfter));

  var AGL = [1200, 800];
  for (var i = 0; i < AGL.length; i++) {
    var agl = AGL[i];
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      var target = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, M.ZOOM_MIN - M.SURF_EYE + a));
      var lo = Math.log(M.ZOOM_MIN), hi = Math.log(M.ZOOM_MAX);
      M.setZoom((Math.log(target) - lo) / (hi - lo));
    }, agl);
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/tmp/v15776-agl' + String(agl).padStart(3, '0') + '.png' });
    console.log('shot agl=' + agl);
  }

  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });
  var ok = base.version === 'v157.76' && errs.length === 0
    && beh && beh.bumped >= 40 && beh.globeDiff === 0 && beh.lineDiff > 0;
  console.log(ok ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
