'use strict';
/* v156.34 探针：**消元法**找"半径闪烁"的元凶。
   同一视角、同一自转速度，跑三种配置各拍 6 帧：
     A 原样        B 关大气壳(M._sky)      C 关大气壳 + 关地块线框(M._shellMat.opacity=0)
   每组的帧存到 .workbuddy/shots/flick_<组>，之后交给 probe_globe_radius2.js 量抖动。
   判据：哪一组把 std 打下来，元凶就是那层。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var path = require('path');

var N = Number(process.argv[2] || 6);
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

async function run(b, mode, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '闪', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(function (m) {
    var M = GAME.map3d;
    /* ⚠️ 不能只设 visible/opacity —— render 每帧都会把它们写回去。
       大气壳：直接从场景摘掉；线框：关 colorWrite（材质属性，render 不管）。 */
    if (m !== 'A' && M._sky && M._sky.removeFromParent) M._sky.removeFromParent();
    if (m === 'C' && M._shellMat) M._shellMat.colorWrite = false;
    M._lastAct = 0;                       /* 立即起转 */
  }, mode);
  await p.waitForTimeout(400);
  var cv = await p.$('#mapCanvas');
  for (var k = 0; k < N; k++) {
    await cv.screenshot({ path: path.join(outDir, 'f' + String(k + 1).padStart(2, '0') + '.png') });
    await p.waitForTimeout(130);
  }
  /* 关掉大气后，把 shader/材质状态也报一下，避免"其实没关成" */
  var st = await p.evaluate(function () {
    return { sky: !!(GAME.map3d._sky && GAME.map3d._sky.visible), shell: GAME.map3d._shellMat ? GAME.map3d._shellMat.opacity : null };
  });
  console.log('组 ' + mode + ' 拍完 ' + N + ' 帧  sky.visible=' + st.sky + ' shell.opacity=' + st.shell
    + '  异常 ' + (errs.length ? errs.slice(0, 2).join(' | ') : '无'));
  await p.close();
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  for (var m of ['A', 'B', 'C']) await run(b, m, '.workbuddy/shots/flick_' + m);
  await b.close();
  console.log('DONE');
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
