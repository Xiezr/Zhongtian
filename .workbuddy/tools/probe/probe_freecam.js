'use strict';
/* v156.47 验证自由相机：三张图对拍 ——
   ① 偏移 0（应与改造前完全一致，证明"解耦"没动默认视角）
   ② 抬头看天（lookPitch 正）
   ③ 贴地看地平线（拉近 + 抬头）—— 这是轨道相机做不到的 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '相机', cityName: '灰岗', region: '碎垣', mapSeed: 20260921, portraitSeed: 1 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
  });
  await p.waitForFunction(function () {
    var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on');
  }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  var cases = [
    { name: 'A_默认（偏移0）', look: [0, 0], dist: null },
    { name: 'B_抬头43度', look: [0, 0.75], dist: null },
    { name: 'C_贴地看地平线', look: [0, 0.75], dist: 0.02 },
  ];
  var out = [];
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    var info = await p.evaluate(function (a) {
      var G = window.GAME, M = G.map3d;
      if (!M || !M.camO) return { err: 'no camO' };
      var bak = { d: M.camO.dist };
      if (a.dist != null) M.camO.dist = M.ZOOM_MIN + (M.ZOOM_MIN * 0.9) * a.dist;
      M.camO.lookYaw = a.look[0]; M.camO.lookPitch = a.look[1];
      if (G.ui.renderMapCanvas) G.ui.renderMapCanvas();
      if (M.render) { var cv = document.getElementById('mapCanvas'); if (cv && cv.width) M.render(cv); }
      var cam = M.__cam || null;
      return { dist: Math.round(M.camO.dist), look: [M.camO.lookYaw, M.camO.lookPitch] };
    }, { look: c.look, dist: c.dist });
    await p.waitForTimeout(700);
    var f = '.workbuddy/shots/freecam_' + c.name.replace(/[^\w]/g, '') + '.png';
    await p.screenshot({ path: f });
    out.push({ name: c.name, file: f, info: info });
    console.log('  📷 ' + c.name + '  ' + JSON.stringify(info));
  }
  console.log('\n共 ' + out.length + ' 张');
  await b.close();
})();
