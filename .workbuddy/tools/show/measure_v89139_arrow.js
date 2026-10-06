'use strict';
/* v89.139 箭头对照量测（单场景）：视野移到地图角落 → 数边缘环带暖黄像素
   用法：node measure_v89139_arrow.js [tag]
   （改前 = 先 cp backup/v89139/map.js js/map.js；改后 = cp 回工作区版） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = process.argv[2] || 'now';
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var r = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '箭', cityName: '许都', region: '碎垣', mapSeed: 20260939 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.mapCenterOn(0, 0);       /* 地图极角：几乎所有名城在视野外，画布多为背景 */
    var cv = document.getElementById('mapCanvas');
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    var RING = 36, n = 0;
    for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
      if (!(x < RING || y < RING || x > cv.width - RING || y > cv.height - RING)) continue;
      var i = (cv.width * y + x) << 2;
      var r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      /* 箭头色 rgba(232,206,136,.92)：r≈215+ g≈190+ b 明显低于 r */
      if (r0 > 195 && g0 > 170 && b0 < 165 && (r0 - b0) > 55 && (g0 - b0) > 45) n++;
    }
    return { ringWarm: n, cell: G.ui.mapFrame.cell, span: G.ui.mapFrame.spanX + 'x' + G.ui.mapFrame.spanY,
      ox: Math.round(G.ui.mapFrame.ox), oy: Math.round(G.ui.mapFrame.oy) };
  });
  console.log('[箭头对照 · ' + TAG + '] 视野角落 · 观察框 ' + r.span + '@' + r.cell +
    ' · 边缘 36px 环带暖黄像素 = ' + r.ringWarm);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-arrow-' + TAG + '.png' });
  await b.close();
  process.exit(0);
})();
