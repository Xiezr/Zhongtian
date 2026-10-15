/* v90.99 实机验收：① 别星地图 回主城/回本城/灰烬城 断开  ② 每颗星球独立的省市区
 * 用法：node .workbuddy/tools/show/verify_v9099.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForTimeout(800);

  /* 母星：省市区名录 */
  var home = await p.evaluate(function () {
    GAME.map3d.render(document.getElementById('mapCanvas'), 0, 0, 12, 12);
    var T = GAME.map3d.adminTable || (GAME.map3d._settle && GAME.map3d._settle.table);
    return { prov: T.prov.map(function (x) { return x.name; }),
      provCount: T.prov.length, marketCount: T.market.length, districtCount: T.district.length,
      navDim: { center: /dim/.test((document.querySelector('[data-action="map-center"]') || {}).className || ''),
        mycity: /dim/.test((document.querySelector('[data-action="map-mycity"]') || {}).className || ''),
        capital: /dim/.test((document.querySelector('[data-action="map-capital"]') || {}).className || '') } };
  });
  console.log('HOME:', JSON.stringify(home));

  /* 切地图到星球 2（只动地图球面）→ 省市名与母星不同 + 导航断开 */
  var p2 = await p.evaluate(function () {
    var G = GAME; var pl = G.addPlanet({ seed: 424242 });
    G.setMapPlanet(pl.id);
    G.refreshAll();                 /* 真链路：下拉切星后刷新（重建 dock + 重绘地图） */
    return { pid: pl.id, mapPlanet: G.mapPlanetOf().id, activePlanet: G.activePlanetOf().id };
  });
  await p.waitForTimeout(900);
  var other = await p.evaluate(function () {
    GAME.map3d.render(document.getElementById('mapCanvas'), 0, 0, 12, 12);
    var T = GAME.map3d.adminTable || (GAME.map3d._settle && GAME.map3d._settle.table);
    return { prov: T.prov.map(function (x) { return x.name; }),
      provCount: T.prov.length, marketCount: T.market.length, districtCount: T.district.length,
      navDim: { center: /dim/.test((document.querySelector('[data-action="map-center"]') || {}).className || ''),
        mycity: /dim/.test((document.querySelector('[data-action="map-mycity"]') || {}).className || ''),
        capital: /dim/.test((document.querySelector('[data-action="map-capital"]') || {}).className || '') } };
  });
  console.log('PLANET2:', JSON.stringify({ id: p2, prov: other.prov, provCount: other.provCount, marketCount: other.marketCount, districtCount: other.districtCount, navDim: other.navDim }));

  var sameProv = JSON.stringify(home.prov) === JSON.stringify(other.prov);
  var dimmed = other.navDim.center && other.navDim.mycity;
  console.log('CHECK:', JSON.stringify({
    provNamesDiffer: !sameProv,
    homeNavActive: !home.navDim.center && !home.navDim.mycity,
    otherNavDimmed: dimmed,
    capitalDimmedOnOther: other.navDim.capital,
    capitalActiveOnHome: !home.navDim.capital
  }));

  /* 运行时守卫：别星地图上点「回本城」→ 不导航（受阻弹原因），mapView 不变 */
  var guard = await p.evaluate(function () {
    var before = GAME.ui.mapView.x + ',' + GAME.ui.mapView.y;
    var btn = document.querySelector('[data-action="map-mycity"]');
    var why = btn ? btn.getAttribute('data-why') : null;
    try { btn && btn.click(); } catch (e) { }
    var after = GAME.ui.mapView.x + ',' + GAME.ui.mapView.y;
    /* 也直接调出口验硬守卫 */
    GAME.ui.mapMyCity();
    var afterCall = GAME.ui.mapView.x + ',' + GAME.ui.mapView.y;
    return { hadWhy: !!why, unchangedByClick: before === after, unchangedByCall: before === afterCall };
  });
  console.log('GUARD:', JSON.stringify(guard));

  await p.screenshot({ path: '.workbuddy/shots/v9099-otherplanet.png' });
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
