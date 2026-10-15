'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('http://localhost:8777/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui && window.GAME.gltf', null, { timeout: 30000 });
  var out = await p.evaluate(function () {
    var G = window.GAME, R = {};
    var st = G.newGame({ name: 'X', cityName: 'hue', region: 'a', mapSeed: 20260926 });
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    G.ui.setView('map'); G.refreshAll();
    var wd = G.wonderOf(st.mapPlanetId != null ? st.mapPlanetId : st.activePlanet);
    R.wonder = wd && wd.name;
    return R;
  });
  /* 等 .glb 载入 + 天体出现 */
  await p.waitForFunction('window.GAME.map3d && window.GAME.map3d._wonderBody', null, { timeout: 15000 }).catch(function(){});
  await p.waitForTimeout(800);
  var chk = await p.evaluate(function () {
    var M = window.GAME.map3d;
    return { hasBody: !!(M && M._wonderBody), geoIds: Object.keys(M._wonderGeo || {}), angle: M && M._wonderAngle };
  });
  await p.screenshot({ path: '.workbuddy/shots/v9130-body.png' });
  console.log('RESULT', JSON.stringify(out), JSON.stringify(chk));
  console.log('ERRS', JSON.stringify(errs.slice(0, 3)));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack||e.message)); process.exit(1); });
