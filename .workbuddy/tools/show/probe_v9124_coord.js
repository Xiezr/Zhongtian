/* v91.24 探针：球面 cell 的 (x,y) ↔ ci 往返稳定性（筑城坐标飞走根因）
 * 用法：node .workbuddy/tools/probe_v9124_coord.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var out = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    var SP = G.mapSphere && G.mapSphere.cells ? G.mapSphere : G.sphere;
    var cells = SP.cells;
    var W = G.DATA.MAP_W, H = G.DATA.MAP_H;
    var W2 = [0, 10];   /* 不匹配计数 + 最大 hexDist */
    var samples = [], n = 0, mismatch = 0, maxD = 0, sumD = 0;
    /* 抽样：每 37 格取一个，覆盖全球 */
    for (var ci = 0; ci < cells.length; ci += 37) {
      var c = cells[ci]; if (!c || c.x == null) continue;
      n++;
      /* 正向（cell → 界面坐标）：cell.x/cell.y 就是生成时 round(lon/360*W) 得来的 */
      /* 反向（界面坐标 → cell）：ciOfXY 走 lonlatOf + nearestCell */
      var back = SP.ciOfXY(c.x, c.y);
      var d = back === ci ? 0 : SP.hexDist(ci, back);
      if (back !== ci) mismatch++;
      if (d > maxD) maxD = d;
      sumD += d;
      if (samples.length < 12) samples.push({ ci: ci, xy: [c.x, c.y], lon: Math.round(c.lon), lat: Math.round(c.lat), back: back, d: d });
    }
    /* 再验：cell 的 lon/lat → dir → nearestCell 是否回到自身（球面自洽） */
    var nMismatchSelf = 0;
    for (var ci2 = 0; ci2 < cells.length; ci2 += 137) {
      var c2 = cells[ci2]; if (!c2) continue;
      var self = SP.nearestCell ? SP.nearestCell(SP.dirOfLonLat(c2.lon, c2.lat)) : -1;
      if (self !== ci2) nMismatchSelf++;
    }
    return { n: n, mismatch: mismatch, maxD: maxD, avgD: (sumD / n).toFixed(3), nMismatchSelf: nMismatchSelf, samples: samples };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
