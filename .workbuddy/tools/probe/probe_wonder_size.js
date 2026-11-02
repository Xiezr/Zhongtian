'use strict';
/* v156.48 验证奇观尺寸：强制一个**地表**奇观（按日随机可能是太空/海面），
   把相机移到它正上方低空，截一张能同时看见奇观与地面格子的图。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

var WANT = process.argv[2] || 'temple';

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '奇观', cityName: '灰岗', region: '碎垣', mapSeed: 20260921, portraitSeed: 1 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
  });
  await p.waitForFunction(function () {
    var t = document.body.innerText || ''; return t.indexOf('正在构建星球') < 0;
  }, null, { timeout: 60000, polling: 500 }).catch(function () { });
  await p.waitForTimeout(1500);

  var info = await p.evaluate(function (want) {
    var G = window.GAME, M = G.map3d;
    var pid = (G.mapPlanetOf ? G.mapPlanetOf().id : null);
    /* 先让 wonderOf 跑一次（它会写 wonderDay），再强制换成地表奇观 */
    var wd0 = G.wonderOf ? G.wonderOf(pid) : null;
    var pl = G._planetOf ? G._planetOf(pid) : null;
    if (pl) { pl.wonderId = want; }
    if (M.rebuild) M.rebuild();
    return { pending: true, id: want };
    var wd = G.wonderOf ? G.wonderOf(pid) : null;
    var d = M._wonderUp, rr = M._wonderR;
    if (!d) return { err: 'no wonder placed', mode: M._wonderMode, id: wd && wd.id };
    var R = 0, SP = G.sphere || G.mapSphere;
    R = M.ZOOM_MIN / 1.15;                       /* 反推球半径 */
    var cy = Math.atan2(d[0], d[2]), cp = Math.asin(Math.max(-1, Math.min(1, d[1])));
    M.camO.yaw = cy; M.camO.pitch = cp + 0.22; M.camO.dist = R * 1.9;
    M.camO.lookYaw = 0; M.camO.lookPitch = 0;
    var cv = document.getElementById('mapCanvas');
    if (M.render && cv) M.render(cv);
    return { id: wd && wd.id, mode: M._wonderMode, cell: M._wonderCell,
      R: Math.round(R), dist: Math.round(M.camO.dist), up: d.map(function (x) { return +x.toFixed(3); }) };
  }, WANT);

  var f = '.workbuddy/shots/wonder_' + WANT + '.png';
  await p.screenshot({ path: f });
  console.log('  ' + JSON.stringify(info));
  console.log('  → ' + f);
  /* 等 glb 真正就绪（2~7MB base64 异步解析），再定位相机 */
  await p.waitForFunction(function () {
    var M = window.GAME.map3d;
    return !!(M && M._wonderBody && M._wonderUp && M._wonderSpin && M._wonderSpin.material && M._wonderSpin.material.map);
  }, null, { timeout: 60000, polling: 400 }).catch(function () { console.log('  ⚠️ 奇观未就绪'); });

  var info = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d;
    var d = M._wonderUp;
    if (!d) return { err: 'no wonder' };
    var R = M.ZOOM_MIN / 1.15;
    M.camO.yaw = Math.atan2(d[0], d[2]);
    M.camO.pitch = Math.asin(Math.max(-1, Math.min(1, d[1])));
    M.camO.dist = R * 1.35;
    M.camO.lookYaw = 0; M.camO.lookPitch = 0;
    var cv = document.getElementById('mapCanvas');
    if (M.render && cv) M.render(cv);
    return { id: M._wonderId, mode: M._wonderMode, R: Math.round(R), dist: Math.round(M.camO.dist) };
  });
  await p.waitForTimeout(1200);
  var f = '.workbuddy/shots/wonder_' + WANT + '.png';
  await p.screenshot({ path: f });
  console.log('  ' + JSON.stringify(info));
  console.log('  → ' + f);
  await b.close();
})();
