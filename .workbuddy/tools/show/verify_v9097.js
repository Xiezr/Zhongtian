/* v90.97 实机验收：行政菜单 + 君主收窄 + 英雄仅本城 + 双球面切图（读真文件 · 无注入）
 * 用法：node .workbuddy/tools/show/verify_v9097.js
 * 产出：.workbuddy/shots/v9097-admin.png / -lord.png / -map.png
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.refreshAll();
  });
  await p.waitForTimeout(400);

  /* ---- ① 行政菜单 ---- */
  await p.evaluate(function () { GAME.ui.setView('admin'); });
  await p.waitForTimeout(400);
  var admin1 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var node = vc && vc.querySelector('[data-action="adm-planet-toggle"]');
    var nodes = vc ? vc.querySelectorAll('[data-action="adm-planet-toggle"]').length : 0;
    var citiesBefore = vc ? vc.querySelectorAll('[data-action="adm-city-pick"]').length : 0;
    if (node) node.click();
    return { split: !!(vc && vc.querySelector('.adm-split')), nodes: nodes, citiesBefore: citiesBefore };
  });
  await p.waitForTimeout(300);
  var admin2 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var city = vc && vc.querySelector('[data-action="adm-city-pick"]');
    var n = vc ? vc.querySelectorAll('[data-action="adm-city-pick"]').length : 0;
    if (city) city.click();
    return { citiesAfterExpand: n };
  });
  await p.waitForTimeout(300);
  var admin3 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    return { secs: vc ? vc.querySelectorAll('.adm-sec').length : 0,
      hasEnterBtn: !!document.querySelector('[data-action="adm-city-enter"]'),
      title: (vc && vc.querySelector('.adm-city-title') ? vc.querySelector('.adm-city-title').textContent : '').slice(0, 40) };
  });
  await p.screenshot({ path: '.workbuddy/shots/v9097-admin.png' });
  console.log('ADMIN:', JSON.stringify({ admin1: admin1, admin2: admin2, admin3: admin3 }));

  /* ---- ①b 跨星球：进别星的城（进入该城 → 城市界面切到该星） ---- */
  var enter97 = await p.evaluate(function () {
    var G = GAME; var st = G.state;
    var p2 = G.addPlanet({ seed: 777888 });
    G.enterPlanet(p2.id);                                   /* 建前哨城（落地于新星） */
    var apAfterLogin = st.activePlanet;
    G.enterPlanet(1);                                       /* 切回老家，城市界面应回到老家 */
    var backOk = (G.activePlanetOf().id === 1);
    G.ui.setView('admin');
    /* 展开星球 2 并选中其城 */
    G.ui._admOpen = {}; G.ui._admOpen[p2.id] = true;
    var sl2 = G.sliceOf(p2.id);
    G.ui._admSel = { pid: p2.id, cityId: (sl2.cities[0] || {}).id };
    G.ui.renderView('admin');
    var btn = document.querySelector('[data-action="adm-city-enter"]');
    var pidAtClick = G.activePlanetOf().id;
    if (btn) btn.click();
    return { loginCreated: apAfterLogin === p2.id, backOk: backOk,
      pidBeforeClick: pidAtClick,
      pidAfterClick: G.activePlanetOf().id,
      viewNow: G.ui.view, curCityPlanetOk: G.activePlanetOf().id === p2.id };
  });
  await p.waitForTimeout(400);
  console.log('ENTER:', JSON.stringify(enter97));
  await p.evaluate(function () { GAME.ui.setView('admin'); });

  /* ---- ② 君主收窄 ---- */
  await p.evaluate(function () { GAME.ui.openLordInfo(); });
  await p.waitForTimeout(300);
  var lord = await p.evaluate(function () {
    var r = document.querySelector('#modal-root');
    return { xl: !!document.querySelector('#modal-root .modal-xl'),
      xxl: !!document.querySelector('#modal-root .modal-xxl'),
      split: !!(r && r.querySelector('.lord-split')),
      lsRight: !!(r && r.querySelector('.ls-right')),
      noEst: r ? r.querySelectorAll('[data-action="lord-est-sel"]').length : -1 };
  });
  await p.screenshot({ path: '.workbuddy/shots/v9097-lord.png' });
  console.log('LORD:', JSON.stringify(lord));
  await p.evaluate(function () { GAME.ui.closeAllModals(); });

  /* ---- ③ 英雄仅本城 ---- */
  var hero = await p.evaluate(function () {
    var G = GAME; var st = G.state;
    var cur = G.currentCity();
    var side = G.makeCity({ id: 'side_v97', name: '侧城', x: cur.x + 5, y: cur.y, res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    st.cities.push(side);
    var other = G.makeGeneral('他城英雄', 1, 'idle', side.id, false);
    st.generals.push(other);
    G.ui.setView('generals');
    var html = document.querySelector('#view-container').innerHTML;
    var res = { hasOther: html.indexOf('他城英雄') >= 0, hasChips: html.indexOf('gen-scope') >= 0 };
    other.cityId = cur.id;                                  /* 调入本城 */
    G.ui.renderView('generals');
    var html2 = document.querySelector('#view-container').innerHTML;
    res.afterMove = html2.indexOf('他城英雄') >= 0;
    st.generals = st.generals.filter(function (g) { return g.id !== other.id; });
    return res;
  });
  console.log('HERO:', JSON.stringify(hero));

  /* ---- ④ 双球面：切地图星球不动城市 ---- */
  var map = await p.evaluate(function () {
    var G = GAME; var st = G.state;
    var p2 = G.addPlanet({ seed: 424242 });
    var apBefore = st.activePlanet, cityBefore = G.currentCity() ? G.currentCity().id : null;
    var sphSeedBefore = G.mapSphere.seed3();
    G.setMapPlanet(p2.id);
    var res = { apUnchanged: st.activePlanet === apBefore,
      cityUnchanged: (G.currentCity() ? G.currentCity().id : null) === cityBefore,
      mapPlanet: G.mapPlanetOf().id === p2.id,
      mapSphereChanged: G.mapSphere.seed3() !== sphSeedBefore,
      logicUnchanged: G.sphere.seed3() === sphSeedBefore };
    G.ui.setView('map');
    return res;
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '.workbuddy/shots/v9097-map.png' });
  console.log('MAP:', JSON.stringify(map));
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
