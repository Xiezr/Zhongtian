/* v91.05 实机验收：地图上为己方据点/野地插小旗
 * 用法：node .workbuddy/tools/show/verify_v9105_flags.js
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
  var seeded = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    var pc = G.map.playerCity() || st.cities[0];
    /* 己方野地×3 + 己方据点×2（近旁，便于截图） */
    st.wilds = st.wilds || [];
    [[pc.x + 2, pc.y, 'plain'], [pc.x - 2, pc.y + 1, 'forest'], [pc.x + 1, pc.y - 2, 'caoyuan']].forEach(function (t) {
      st.wilds.push({ x: t[0], y: t[1], type: t[2], level: 3 });
    });
    st.forts = st.forts || {};
    [[pc.x, pc.y + 2, '琥珀哨'], [pc.x - 3, pc.y - 1, '金岭驿']].forEach(function (t) {
      st.forts[t[0] + ',' + t[1]] = { x: t[0], y: t[1], lv: 2, name: t[2], cityId: st.cities[0].id };
    });
    G.ui.setView('map'); G.refreshAll();
    return { wilds: st.wilds.length, forts: Object.keys(st.forts).length };
  });
  await p.waitForTimeout(1200);
  var res = await p.evaluate(function () {
    var F = GAME.map3d && GAME.map3d._flags;
    var n = F && F.children ? F.children.length : 0;
    var isSprite = n > 0 ? !!F.children[0].isSprite : false;
    return { flagChildren: n, isSprite: isSprite, inScene: !!(F && F.parent) };
  });
  console.log('SEEDED:', JSON.stringify(seeded));
  console.log('FLAGS:', JSON.stringify(res));
  await p.screenshot({ path: '.workbuddy/shots/v9105-flags.png' });
  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
