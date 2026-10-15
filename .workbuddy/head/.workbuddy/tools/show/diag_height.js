'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(800);
  var r = await p.evaluate(function () {
    var G = window.GAME, W = G.DATA.MAP_W, H = G.DATA.MAP_H, grid = G.state.map.grid;
    /* 复刻 map.js 的高度场（与生成同源） */
    function nhash(ix, iy, salt) { var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    function vnoise(x, y, step, salt) { var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy); var tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); var a = nhash(ix, iy, salt), b = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt); var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx; return t0 + (t1 - t0) * ty; }
    var OCT = [[21, 0.55], [11, 0.30], [6, 0.15]];
    function fbm(x, y, salt) { var v = 0; for (var i = 0; i < OCT.length; i++) v += OCT[i][1] * vnoise(x, y, OCT[i][0], salt + i * 101); return v; }
    var seed = G.state.map.seed;
    var hist = {}, mn = 9, mx = -1, sum = 0, n = 0;
    for (var y = 0; y < H; y += 3) for (var x = 0; x < W; x += 3) {
      var t = grid[y][x].terrain;
      var l = Math.floor(fbm(x, y, seed * 7 + 11) * 9);
      if (l < 0) l = 0; if (l > 7) l = 7;
      if (t === 'lake') l = 0; else if (t === 'zhaoze') l = Math.min(l, 1); if (t === 'hill') l = Math.max(l, 4);
      hist[l] = (hist[l] || 0) + 1; if (l < mn) mn = l; if (l > mx) mx = l; sum += l; n++;
    }
    /* 可见一屏（中心附近 15×8）的层次跨度 */
    var v = G.ui.mapView; var f = G.ui.mapFrame; var win = [];
    for (var dy = -4; dy < 4; dy++) { var row = []; for (var dx = -7; dx < 8; dx++) {
      var xx = v.x + dx, yy = v.y + dy, tt = (grid[yy] && grid[yy][xx]) ? grid[yy][xx].terrain : '?';
      var ll = Math.floor(fbm(xx, yy, seed * 7 + 11) * 9); if (ll < 0) ll = 0; if (ll > 7) ll = 7;
      if (tt === 'lake') ll = 0; else if (tt === 'zhaoze') ll = Math.min(ll, 1); if (tt === 'hill') ll = Math.max(ll, 4);
      row.push(ll);
    } win.push(row.join('')); }
    return { hist: hist, min: mn, max: mx, avg: (sum / n).toFixed(2), cell: f.cell, win: win };
  });
  console.log('HIST ' + JSON.stringify(r.hist) + ' min=' + r.min + ' max=' + r.max + ' avg=' + r.avg + ' cell=' + r.cell);
  console.log('WIN(levels, 15x8 around center):');
  r.win.forEach(function (line) { console.log('  ' + line); });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
