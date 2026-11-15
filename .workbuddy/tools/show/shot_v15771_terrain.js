'use strict';
/* v157.71 地形配色实机取证：与 BEFORE 同 seed 同视角，出 AFTER 图 + 像素统计对比 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

function statOf(page) {
  return page.evaluate(function () {
    var im = document.querySelector('img');
    if (!im) return { err: 'no img' };
    var c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    var g = c.getContext('2d'); g.drawImage(im, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height).data;
    var lum = [], sat = [], hueBins = {}, n = 0;
    for (var i = 0; i < d.length; i += 4 * 7) {
      var r = d[i], gg = d[i + 1], bb = d[i + 2];
      var L = 0.2126 * r + 0.7152 * gg + 0.0722 * bb;
      lum.push(L);
      var mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      var S = mx ? (mx - mn) / mx : 0;
      sat.push(S);
      /* 只统计有色像素的色相（避开黑背景） */
      if (S > 0.20 && mx > 45) {
        var h;
        if (mx === r) h = ((gg - bb) / (mx - mn) + 6) % 6;
        else if (mx === gg) h = (bb - r) / (mx - mn) + 2;
        else h = (r - gg) / (mx - mn) + 4;
        var b = Math.floor(h * 6);
        hueBins[b] = (hueBins[b] || 0) + 1;
      }
      n++;
    }
    function q(a, p) { a.sort(function (x, y) { return x - y; }); return +a[Math.floor(a.length * p)].toFixed(1); }
    return {
      size: c.width + 'x' + c.height, samples: n,
      lum: { p10: q(lum, .1), p50: q(lum, .5), p90: q(lum, .9) },
      sat: { p10: q(sat, .1), p50: q(sat, .5), p90: q(sat, .9) },
      lowSatRatio: +(sat.filter(function (x) { return x < 0.20; }).length / n).toFixed(3),
      hueBinsUsed: Object.keys(hueBins).length,
      hueBins: hueBins
    };
  });
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1080, height: 635 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var dump = await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    return {
      version: G.VERSION,
      terrainRGB: G.map3d ? G.map3d.terrainRGB : null,
      dataColors: Object.keys(G.DATA.TERRAIN).reduce(function (o, k) {
        o[k] = G.DATA.TERRAIN[k].color; return o;
      }, {})
    };
  }, 20260926);
  console.log('===== AFTER DUMP =====');
  console.log(JSON.stringify(dump, null, 2));

  await p.waitForTimeout(1500);
  var cv = await p.$('#mapCanvas');
  if (cv) await cv.screenshot({ path: '.workbuddy/tmp/v15771-AFTER-canvas.png' });
  await p.screenshot({ path: '.workbuddy/tmp/v15771-AFTER-overview.png' });

  await p.evaluate(function () { window.GAME.map3d.surfaceMode(true); });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: '.workbuddy/tmp/v15771-AFTER-surface.png' });

  console.log('===== 像素统计 =====');
  var q1 = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await q1.goto('file:///E:/Deepseekdb/.workbuddy/tmp/v15771-BEFORE-canvas.png');
  console.log('BEFORE ' + JSON.stringify(await statOf(q1)));
  await q1.goto('file:///E:/Deepseekdb/.workbuddy/tmp/v15771-AFTER-canvas.png');
  console.log('AFTER  ' + JSON.stringify(await statOf(q1)));

  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });
  console.log(errs.length === 0 && dump.version === 'v157.71' ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
