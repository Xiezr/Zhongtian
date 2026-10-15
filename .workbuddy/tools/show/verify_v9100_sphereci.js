/* v90.100 球系化 实机验收：地图/城池面板无运行时错误 + 球系往返自洽 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  var out = await p.evaluate(function () {
    var G = window.GAME, R = {};
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    G.ui.setView('map'); G.refreshAll();
    var c = st.cities[0];
    R.city = { ci: c.ci, x: c.x, y: c.y, xyInverse: (G.sphere.ciOfXY(c.x, c.y) === c.ci) };
    R.roundTrip = (function () { var bad = 0; for (var i = 0; i < G.sphere.cells.length; i += 500) { var cc = G.sphere.cells[i]; if (G.sphere.ciOfXY(cc.x, cc.y) !== i) bad++; } return bad; })();
    G.ui.openCityPanel(c);
    R.panelOpen = !!document.querySelector('#modal-root');
    try { G.ui.closeAllModals(); } catch (e) {}
    return R;
  });
  await p.screenshot({ path: '.workbuddy/shots/v9100-sphereci-map.png' });
  console.log('RESULT', JSON.stringify(out));
  console.log('PAGEERRORS', JSON.stringify(errs));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
