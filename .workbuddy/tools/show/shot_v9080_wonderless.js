/* v90.80 实机验证：奇遇系统退役后的真实渲染（真浏览器）
 * ------------------------------------------------------------
 * 用法：node .workbuddy/tools/show/shot_v9080_wonderless.js
 * 产出：.workbuddy/shots/v9080-map.png（地图视图·底栏无「见闻录」）
 *       .workbuddy/shots/v9080-wild.png（野地弹窗·无探奇入口）
 * 取证：控制台错误数 · 底栏按钮文本 · 野地弹窗文本 · 关键节点数
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e && e.message || e)); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
    G.refreshAll();
  });
  await p.waitForTimeout(1400);
  var m1 = await p.evaluate(function () {
    var G = window.GAME;
    var bb = document.getElementById('bottom-bar');
    var hasJournal = !!document.querySelector('#bottom-bar [data-action="open-journal"]');
    return {
      bottomText: bb ? bb.textContent.replace(/\s+/g, ' ').slice(0, 220) : '(no bar)',
      hasJournal: hasJournal,
      mapCanvas: !!document.querySelector('#mapCanvas'),
      type: typeof G.wonderSites + '/' + typeof G.wonderSiteOf + '/' + typeof G.ui.openJournal
    };
  });
  console.log('map view:', JSON.stringify(m1));
  await p.screenshot({ path: '.workbuddy/shots/v9080-map.png' });

  /* 野地弹窗（球面地形上的野地） */
  var w2 = await p.evaluate(function () {
    var G = window.GAME;
    var pc = G.map.playerCity();
    for (var r = 1; r <= 6; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var x = pc.x + dx, y = pc.y + dy;
          var tl = G.map.tile(x, y);
          if (!tl) continue;
          var wild = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };
          if (!wild[tl.terrain]) continue;
          if (G.map.fortAt && G.map.fortAt(x, y)) continue;
          try { G.ui.openLandModal(x, y); return { x: x, y: y, ter: tl.terrain }; } catch (e) { return { err: String(e && e.message) }; }
        }
      }
    }
    return null;
  });
  await p.waitForTimeout(700);
  var m2 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent || '').replace(/\s+/g, ' ');
    return {
      hasModal: !!document.querySelector('#modal-root .inner-panel, #modal-root .modal'),
      wnrNodes: document.querySelectorAll('.wnr-line, .wnr-btn').length,
      textSnip: t.slice(0, 300)
    };
  });
  console.log('wild modal:', JSON.stringify(w2), JSON.stringify(m2));
  await p.screenshot({ path: '.workbuddy/shots/v9080-wild.png' });

  console.log('pageerrors:', errs.length, errs.slice(0, 3));
  console.log('SHOT-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
