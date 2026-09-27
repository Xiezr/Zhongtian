/* 诊断：满界面缩略图上我城红点为什么读不到（v89132） */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(600);
  var out = await p.evaluate(function () {
    var G = window.GAME;
    var res = {};
    /* 手动重跑一次 drawMini，捕获异常（openMinimap 里的 try 会吞掉） */
    G.ui.openMinimap();
    var big = document.getElementById('mini-big');
    var side = G.ui.fitMini();
    try { G.ui.drawMini(big, side, { labels: true }); res.redraw = 'ok'; }
    catch (e) { res.redraw = 'ERR: ' + e.message; }
    var ctx = big.getContext('2d');
    /* 全图找红像素 */
    var d = ctx.getImageData(0, 0, big.width, big.height).data;
    var reds = [];
    for (var i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] < 110 && d[i + 2] < 100) {
        reds.push([(i / 4) % big.width, Math.floor((i / 4) / big.width)]);
        if (reds.length > 20) break;
      }
    }
    res.redCount = reds.length; res.redFirst = reds.slice(0, 5);
    var c = null;
    (G.state.cities || []).forEach(function (x) { if (x.id === G.ui._cityId) c = x; });
    res.city = { x: c.x, y: c.y, name: c.name };
    var v = G.ui.miniView();
    var px = Math.round((c.x + 0.5 - v.win.x0) / v.win.side * big.width);
    var py = Math.round((c.y + 0.5 - v.win.y0) / v.win.side * big.height);
    res.target = [px, py];
    var grid = [];
    for (var gy = py - 3; gy <= py + 3; gy++) {
      var row = [];
      for (var gx = px - 3; gx <= px + 3; gx++) {
        var o = (gy * big.width + gx) * 4;
        row.push('(' + d[o] + ',' + d[o + 1] + ',' + d[o + 2] + ')');
      }
      grid.push(row.join(' '));
    }
    res.grid = grid;
    res.bigWH = [big.width, big.height];
    res.dpr = window.devicePixelRatio || 1;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
  process.exit(0);
})();
