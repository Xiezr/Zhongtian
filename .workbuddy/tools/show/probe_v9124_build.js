/* v91.24 探针2：端到端筑城坐标链（不在原格 & 球面/平面往返一致性）
 * 用法：node .workbuddy/tools/show/probe_v9124_build.js
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
    var G = window.GAME, R = {};
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    var SP = G.mapSphere && G.mapSphere.cells ? G.mapSphere : G.sphere;
    var W = G.DATA.MAP_W, H = G.DATA.MAP_H;

    /* 取一个非赤道的陆地平原格（有 c.x/c.y 就到处都有） */
    var cell = null, idx = -1;
    for (var i = 0; i < SP.cells.length; i++) { var c = SP.cells[i]; if (c && c.type === 'plain' && Math.abs(c.lat) > 20) { cell = c; idx = i; break; } }
    R.picked = { ci: idx, x: cell.x, y: cell.y, lon: cell.lon, lat: cell.lat, type: cell.type };

    /* A. 从 (x,y) 经 map.lonlatOf→dirOf 得到“界面坐标 x,y 会画在哪” */
    var ll = G.map.lonlatOf(cell.x, cell.y);
    R.lonlatOf = { lon: Math.round(ll.lon), lat: Math.round(ll.lat) };
    /* B. 该 (x,y) 反查回哪个 cell（ciOfXY） */
    R.ciOfXY = SP.ciOfXY(cell.x, cell.y);
    R.hexDistBack = R.ciOfXY === idx ? 0 : SP.hexDist(idx, R.ciOfXY);
    /* C. 后者对应的球面 (lon,lat) */
    R.cellOfBack = R.ciOfXY >= 0 ? { lon: Math.round(SP.cells[R.ciOfXY].lon), lat: Math.round(SP.cells[R.ciOfXY].lat) } : null;

    /* D. 直接筑城在 (cell.x,cell.y)，看落点 ci 与地形 */
    var tg = { x: cell.x, y: cell.y };
    var before = SP.terrainAt(tg.x, tg.y);
    R.terrainAtPicked = before ? before.type : null;
    /* 找一处空地：canvas 可能不合法，直接调 buildCityAt 看返回 */
    var rr = G.buildCityAt(tg.x, tg.y);
    R.buildRes = { ok: rr.ok, msg: rr.msg || rr.msg };
    if (rr.ok && rr.city) {
      R.newCity = { id: rr.city.id, x: rr.city.x, y: rr.city.y };
      /* 新城在球面上落在哪个 cell？ */
      var nc = G.mapSphere.ciOfXY(rr.city.x, rr.city.y);
      R.newCityCi = nc;
      R.newCityCiType = nc >= 0 ? SP.cells[nc].type : null;
    }
    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
