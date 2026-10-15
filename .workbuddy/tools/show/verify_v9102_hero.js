/* v91.02 实机验收：① 英雄页仅本城 ② grantBeauty 归属城修复 ③ 政务厅含本城英雄列表
 * 用法：node .workbuddy/tools/show/verify_v9102_hero.js
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
  var setup = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    /* 第二座城 + 一位归属它、一位归属首城的英雄 */
    var c2 = G.makeCity({ id: 'e2c2', name: '副城', x: st.cities[0].x + 5, y: st.cities[0].y, type: 'county',
      res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
    st.cities.push(c2);
    var gA = G.makeGeneral('甲城将', 5, 'idle', st.cities[0].id, false);
    var gB = G.makeGeneral('乙城将', 6, 'idle', c2.id, false);
    st.generals.push(gA); st.generals.push(gB);
    /* 女将修复验证：grantBeauty 传出发城 → cityId 应为出发城 */
    var before = st.generals.length;
    var beauty = G.battle.grantBeauty({ type: 'jun', name: '测试名城' }, c2);
    var beautyCityOk = !!beauty && beauty.cityId === c2.id;
    /* 英雄页（当前城=首城）：应只见甲城将（+君主/开局将），不见乙城将 */
    G.refreshAll(); G.ui.setView('generals');
    var genHtml = document.querySelector('#view-container').innerHTML;
    return { c2: c2.id, beautyCityOk: beautyCityOk, beautyId: beauty && beauty.id,
      heroPage_showsB: genHtml.indexOf('乙城将') >= 0,
      heroPage_showsA: genHtml.indexOf('甲城将') >= 0 };
  });
  console.log('HERO PAGE:', JSON.stringify({
    heroPage_showsCurrentCityHero: setup.heroPage_showsA,
    heroPage_hidesOtherCityHero: !setup.heroPage_showsB,
    beautyGetsOriginCity: setup.beautyCityOk
  }));

  /* 切当前城到副城 → 英雄页应改见乙城将 */
  var swap = await p.evaluate(function () {
    GAME.ui._cityId = 'e2c2'; GAME.ui.setView('generals');
    var h = document.querySelector('#view-container').innerHTML;
    return { showsB: h.indexOf('乙城将') >= 0, showsA: h.indexOf('甲城将') >= 0 };
  });
  console.log('SWAP CITY:', JSON.stringify({ atB_showsB: swap.showsB, atB_hidesA: !swap.showsA }));

  /* 政务厅面板含英雄列表：打开首城政务厅格建筑面板 */
  var gov = await p.evaluate(function () {
    GAME.ui._cityId = GAME.state.cities[0].id;
    var c = GAME.currentCity();
    var idx = null;
    for (var i = 0; i < c.cells.length; i++) { var b2 = c.cells[i] && c.cells[i].build; if (b2 && b2.id === 'guanfu') { idx = i; break; } }
    if (idx == null) return { noGuanfu: true };
    GAME.ui.openBuildModal(idx, c.id);
    var html = (document.querySelector('#modal-root') || {}).innerHTML || '';
    return { hasHeroSec: html.indexOf('本城英雄') >= 0, hasA: html.indexOf('甲城将') >= 0 };
  });
  console.log('GOV PANEL:', JSON.stringify(gov));

  await p.screenshot({ path: '.workbuddy/shots/v9102-govpanel.png' });
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
