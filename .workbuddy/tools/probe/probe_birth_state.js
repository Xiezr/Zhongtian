'use strict';
/* 诊断「出生州：十三区逐个验证落点归属」—— 到底哪个州、哪个条件不对。
   用真实浏览器（不是 jsdom），跑的是玩家实际会走的那条路。 */
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
    /* 先开一局：没有 state/grid 时 sphere.cells 为空，_terrAt 恒 null，
       所有候选都被 free() 拒掉 → 全落到兜底同一个点。这是探针环境问题。 */
    var _st = G.newGame({ name: "诊断", cityName: "灰岗", region: "碎垣", mapSeed: 20260921 });
    if (!_st.map.grid) G.map.generate();
    var list = G.DATA.START_STATES || [];
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      var pt = G.pickStartPos(st, 1000 + i * 7);
      var r = { want: st, got: pt && pt.state, x: pt && pt.x, y: pt && pt.y };
      if (pt) {
        var ci = (G.sphere && G.sphere.ciOfXY) ? G.sphere.ciOfXY(pt.x, pt.y) : -1;
        r.ci = ci;
        r.own = G.stateOfCity({ x: pt.x, y: pt.y, ci: ci });
        r.tileState = G.stateOfCity({ x: pt.x, y: pt.y });
      }
      r.ok = !!pt && r.got === st && r.own === st;
      rows.push(r);
    }
    return { n: list.length, rows: rows };
  });

  console.log('START_STATES 数量：' + out.n + '（断言要求 === 13）');
  var bad = out.rows.filter(function (r) { return !r.ok; });
  console.log('不合格：' + bad.length + ' 个\n');
  out.rows.forEach(function (r) {
    console.log((r.ok ? '✅' : '❌') + ' ' + String(r.want).padEnd(6)
      + ' 落点(' + r.x + ',' + r.y + ')'
      + ' pickStartPos.state=' + String(r.got).padEnd(6)
      + ' stateOfCity(带ci)=' + String(r.own).padEnd(6)
      + ' stateOfCity(无ci)=' + String(r.tileState));
  });
  await b.close();
})();
