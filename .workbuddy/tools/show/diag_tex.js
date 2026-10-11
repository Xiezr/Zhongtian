'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(2500);   /* 给贴图充分加载时间 */

  var art = await p.evaluate(function () { return GAME.map.artCount ? GAME.map.artCount() : -1; });
  console.log('ART loaded count = ' + art);

  function sample() {
    return p.evaluate(function () {
      var cv = document.getElementById('mapCanvas'), ctx = cv.getContext('2d');
      function px(x, y) { var d = ctx.getImageData(x, y, 1, 1).data; return d[0] + ',' + d[1] + ',' + d[2]; }
      /* 取中心附近 5 点 */
      var cx = cv.width / 2 | 0, cy = cv.height / 2 | 0;
      return [px(cx, cy), px(cx + 40, cy), px(cx, cy + 40), px(cx - 60, cy - 30), px(cx + 80, cy + 60)];
    });
  }
  console.log('HEIGHT=on  px: ' + JSON.stringify(await sample()));
  await p.evaluate(function () { GAME.map.useHeight = false; GAME.ui.renderMapCanvas(); });
  await p.waitForTimeout(300);
  console.log('HEIGHT=off px: ' + JSON.stringify(await sample()));

  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
