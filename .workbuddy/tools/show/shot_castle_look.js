/* 城堡朝向实拍：对准一座己方城，围绕它转三个角度拍特写（修复前后对比用）
 * 用法：node .workbuddy/tools/show/shot_castle_look.js [输出前缀]
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var PREFIX = process.argv[2] || 'castle_fix';
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, SEED);

  /* 等"正在构建星球"遮罩自己消失（不硬藏，确认它真的跑完） */
  await p.waitForFunction(function () {
    var ov = document.getElementById('boot-loading');
    return !ov || !ov.classList.contains('on');
  }, null, { timeout: 90000 });
  await p.waitForTimeout(1500);

  var info = await p.evaluate(function () {
    var M = window.GAME.map3d, THREE = window.THREE;
    var S = M._settles || {};
    /* 挑一座最高级的己方/名城城，视野里更清楚 */
    var list = (S.own || []).concat(S.adm || [], S.npc || []);
    if (!list.length) return { err: 'no settle' };
    var t = list.slice().sort(function (a, b) { return (b.lv | 0) - (a.lv | 0); })[0];
    var d = M._cells ? null : null;
    var SP = window.GAME.mapSphere || window.GAME.sphere;
    var dir = SP.cells[t.ci].dir;
    window.__T = { ci: t.ci, dir: [dir[0], dir[1], dir[2]], lv: t.lv };
    return window.__T;
  });
  console.log('TARGET ' + JSON.stringify(info));

  var angles = [0, 55, 120];
  for (var i = 0; i < angles.length; i++) {
    await p.evaluate(function (k) {
      var M = window.GAME.map3d, T = window.__T;
      M.clearFocus && M.clearFocus();
      M.camFree = true;
      var d = T.dir, L = Math.hypot(d[0], d[1], d[2]) || 1;
      var nx = d[0] / L, ny = d[1] / L, nz = d[2] / L;
      var o = M.camO;
      o.yaw = Math.atan2(nx, nz) + k * Math.PI / 180;
      o.pitch = Math.asin(Math.max(-1, Math.min(1, ny))) + 0.16;
      o.dist = M.ZOOM_MIN * 1.22 + 0;      /* 贴地特写：一格占屏幕相当大 */
    }, angles[i]);
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/shots/' + PREFIX + '_' + 'ABC'[i] + '.png' });
  }
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
