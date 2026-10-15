/* v91.24 探针3：验证修法方向 —— 拾取 x,y 换成「北在上」后地形是否对上
 * 用法：node .workbuddy/tools/show/probe_v9124_fix.js
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
    var H = G.DATA.MAP_H;
    function yNorth(y) { return ((H - y) % H + H) % H; }   /* 北在上换算 */
    var rows = [], okNow = 0, okFix = 0, n = 0;
    for (var ci = 0; ci < SP.cells.length; ci += 53) {
      var c = SP.cells[ci]; if (!c || c.x == null) continue;
      n++;
      var nowT = (SP.terrainAt(c.x, c.y) || {}).type;          /* 现状：拾取坐标直接查地形 */
      var fixT = (SP.terrainAt(c.x, yNorth(c.y)) || {}).type;  /* 修法：y 换算后再查 */
      if (nowT === c.type) okNow++;
      if (fixT === c.type) okFix++;
      if (rows.length < 8) rows.push({ ci: ci, cxy: [c.x, c.y], nxy: [c.x, yNorth(c.y)], ct: c.type, nowT: nowT, fixT: fixT });
    }
    /* 另外检查 lonlatOf 与 yNorth 是否一致：lonlatOf(x, yNorth(cell.y)).lat ≈ cell.lat */
    var c0 = SP.cells[SP.cells.length > 100 ? 100 : 0];
    var ll = G.map.lonlatOf(c0.x, yNorth(c0.y));
    return { n: n, matchNow: okNow, matchFix: okFix, rows: rows,
      check: { cellLat: Math.round(c0.lat), yNorthLat: Math.round(ll.lat), cellY: c0.y, yNorthY: yNorth(c0.y) } };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
