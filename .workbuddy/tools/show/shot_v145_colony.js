/* v145 实机：空间站 + 星际投送面板（选母舰 / 选星球 / 带人带兵 / 启航）
 * 用法：node .workbuddy/tools/show/shot_v145_colony.js
 * 产出：.workbuddy/shots/v145-colony.png + .workbuddy/shots/v145-colony-done.png
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e && e.message || e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var info = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    st.cities[0].pid = 1;
    /* 给蓝图 + 材料 + 一艘母舰 + 一颗新星球 + 燃料/人口 */
    (G.DATA.SHIP_BLUEPRINTS || []).forEach(function (x) { st.items[x.id] = 1; });
    (G.DATA.SHIP_PARTS || []).forEach(function (x) { if (x.mat) st.items[x.mat] = 999; });
    st.items.w_stariron = 999; st.items.w_he3 = 999;
    st.station = { lv: 9, ships: [], _seq: 0 };
    var cls = (G.DATA.SHIP_CLASSES || []).filter(function (c) { return c.role === 'carrier'; })[0];
    var br = G.ship.build(cls.id);
    var pl = G.addPlanet({ seed: 20261026 });
    st.cities[0].res.pop = 800;
    st.cities[0].army = { buxingji: 600, dunwei: 300 };
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('station');
    GAMEX = { shipId: br.ship && br.ship.id, pid: pl.id, cls: cls.name };
    G.ui._ixShipId = GAMEX.shipId;
    G.ui._ixPid = GAMEX.pid;
    G.ui._ixCols = 150;
    G.ui._ixArmy = { buxingji: 120 };
    G.ui.renderView('station');
    return GAMEX;
  });
  await p.waitForTimeout(400);
  await p.locator('text=星际投送').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  var box = await p.locator('text=星际投送').first().locator('xpath=ancestor::div[contains(@style,"border-radius")][1]').boundingBox();
  await p.screenshot({ path: '.workbuddy/shots/v145-colony.png', clip: { x: box.x, y: box.y, width: box.width, height: Math.min(900, box.height) } });
  console.log('panelText=' + (await p.locator('text=星际投送').first().locator('xpath=ancestor::div[contains(@style,"border-radius")][1]').innerText()).split(/\s+/).join(' ').slice(0, 600));
  var res = await p.evaluate(function () {
    var G = window.GAME;
    var r = G.colony.send({ shipId: G.ui._ixShipId, pid: G.ui._ixPid, colonists: G.ui._ixCols, army: G.ui._ixArmy });
    G.ui.renderView('station');
    var m = G.colony.missions()[0];
    return { ok: r.ok, msg: r.msg, missions: G.colony.missions().length,
      cap: m && m.cap, load: m && m.load, fuel: m && m.fuel,
      flightMin: m ? Math.round((m.arriveAt - m.departAt) / 60000) : 0,
      pop: G.state.cities[0].res.pop, army: G.state.cities[0].army };
  });
  await p.waitForTimeout(300);
  await p.locator('text=在途投送').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  await p.screenshot({ path: '.workbuddy/shots/v145-colony-done.png' });
  console.log('setup=' + JSON.stringify(info));
  console.log('send=' + JSON.stringify(res));
  console.log('pageerrors=' + (errs.length ? errs.join(' | ') : '0'));
  await b.close();
})();
