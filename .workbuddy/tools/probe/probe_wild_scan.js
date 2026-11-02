'use strict';
/* 诊断「回放态改设定」那条的 `no wild`：城周围 ±8 格到底有什么。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var out = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '演', cityName: '灰岗', mapSeed: 20260925 });
    if (!st.map.grid) G.map.generate();
    var c0 = st.cities[0];
    var rows = [];
    var terrCount = {}, lvCount = {}, sample = [];
    for (var dx = -8; dx <= 8; dx++) {
      for (var dy = -8; dy <= 8; dy++) {
        if (!dx && !dy) continue;
        var xx = c0.x + dx, yy = c0.y + dy;
        var tl = G.map.tile(xx, yy);
        var ci = (G.sphere && G.sphere.ciOfXY) ? G.sphere.ciOfXY(xx, yy) : -1;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(ci) : 'no-fn';
        var terr = tl ? (tl.terrain || tl.type) : 'null';
        terrCount[terr] = (terrCount[terr] || 0) + 1;
        lvCount[String(lv)] = (lvCount[String(lv)] || 0) + 1;
        if (sample.length < 10) sample.push({ dx: dx, dy: dy, terr: terr, lv: lv, hasFn: !!G.map.wildLevelNow });
      }
    }
    return { cx: c0.x, cy: c0.y, terrCount: terrCount, lvCount: lvCount, sample: sample,
      hasWildLevelNow: !!G.map.wildLevelNow };
  });

  console.log('城池 (' + out.cx + ',' + out.cy + ')  ±8 格分布');
  console.log('hasWildLevelNow =', out.hasWildLevelNow);
  console.log('terrain:', JSON.stringify(out.terrCount));
  console.log('wildLevelNow:', JSON.stringify(out.lvCount));
  console.log('样例:');
  out.sample.forEach(function (s) { console.log('  (' + s.dx + ',' + s.dy + ') terr=' + s.terr + ' lv=' + s.lv); });
  await b.close();
})();
