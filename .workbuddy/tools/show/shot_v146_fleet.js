/* v146 实机：空间站「深空远征」面板（选舰 / 选目标 / 编成 / 出港 / 战报）
 * 用法：node .workbuddy/tools/show/shot_v146_fleet.js
 * 产出：.workbuddy/shots/v146-fleet.png + v146-fleet-done.png
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String((e && e.message) || e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var setup = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    st.cities[0].pid = 1;
    (G.DATA.SHIP_BLUEPRINTS || []).forEach(function (x) { st.items[x.id] = 1; });
    (G.DATA.SHIP_PARTS || []).forEach(function (x) { if (x.mat) st.items[x.mat] = 999; });
    st.items.w_stariron = 999;
    st.station = { lv: 9, ships: [], _seq: 0 };
    ['c_w1', 'c_b1', 'c_g1', 'c_w2', 'c_w3'].forEach(function (cid) { G.ship.build(cid); });
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('station');
    var ids = G.ship.ships().map(function (s) { return s.id; });
    G.ui._dsShips = {}; ids.slice(0, 4).forEach(function (id) { G.ui._dsShips[id] = true; });
    G.ui._dsTargetId = 'ds_derelict';
    G.ui.renderView('station');
    return { ships: ids.length };
  });
  await p.waitForTimeout(500);
  await p.locator('text=深空远征').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  var panel = p.locator('text=深空远征').first().locator('xpath=ancestor::div[contains(@style,"border-radius")][1]');
  var box = await panel.boundingBox();
  await p.screenshot({ path: '.workbuddy/shots/v146-fleet.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(940, box.height) } });
  console.log('panel=' + (await panel.innerText()).split(/\s+/).join(' ').slice(0, 500));
  var run = await p.evaluate(function () {
    var G = window.GAME;
    var formed = G.ui.dsForm();
    var f = G.fleet.fleets()[0];
    if (!f) return { err: 'no fleet' };
    var launched = G.fleet.launch(f.id);
    var T0 = G.utils.now();
    G._realNowOf = function () { return f.arriveAt + 1000; };
    G.utils.now = G._realNowOf;
    G.fleet.tick();
    var res = f.result && { win: f.result.win, rounds: f.result.rounds, lost: f.result.lost.length };
    G._realNowOf = function () { return (f.returnAt || f.arriveAt) + 1000; };
    G.utils.now = G._realNowOf;
    G.fleet.tick();
    G.ui.renderView('station');
    return { launched: launched.ok, result: res, fleets: G.fleet.fleets().length, hist: G.fleet.history().length,
      loot: (G.fleet.history()[0] || {}).loot };
  });
  await p.waitForTimeout(400);
  await p.locator('text=最近战报').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  var panel2 = p.locator('text=深空远征').first().locator('xpath=ancestor::div[contains(@style,"border-radius")][1]');
  var box2 = await panel2.boundingBox();
  await p.screenshot({ path: '.workbuddy/shots/v146-fleet-done.png', clip: { x: box2.x, y: box2.y, width: box2.width, height: Math.min(940, box2.height) } });
  console.log('run=' + JSON.stringify(run));
  console.log('pageerrors=' + (errs.length ? errs.join(' | ') : '0'));
  await b.close();
})();
