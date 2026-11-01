/* 采集场景玩家（Soldier）外观核对：进入 scene3d 的野外场景，截一张
 * 用法：node .workbuddy/tools/show/shot_scene3d_player.js */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
  }, 20260926);
  await p.waitForFunction(function(){ var o=document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 60000 });
  var r = await p.evaluate(function () {
    var S = window.GAME.scene3d;
    if (!S || !S.open) return 'no scene3d';
    var out = [];
    try { out.push(S.open('field')); } catch (e) { out.push('err:' + e.message); }
    return out.join('|');
  });
  console.log('OPEN ' + r);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '.workbuddy/shots/scene3d_player.png' });
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
