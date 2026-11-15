'use strict';
/* v157.70 实机取证（真浏览器）：行动台整页 + 5 个玩法真点按钮 + 账目真的变。
 * 防平凡解：每条都要求"数值真的变了"，且页面异常数为 0。
 * 用法：node shot_v15770_agenda.js
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs'), path = require('path');
var ROOT = 'E:/Deepseekdb';
var LOG = path.join(ROOT, '.workbuddy/tmp/shot_v15770_agenda.log');
fs.writeFileSync(LOG, '');
function log(s) { fs.appendFileSync(LOG, String(s) + '\n'); console.log(s); }

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && GAME.ui && GAME.agenda && GAME.DATA && GAME.DATA.AGENDA',
    null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '取证', cityName: '灰岗', region: '碎垣', mapSeed: 20261116, portraitSeed: 8 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    /* 给足资源，让「交付 / 发货」两个按钮真的能按下去（不是只看到灰按钮） */
    var R = G.res(G.currentCity());
    R.grain = 99999; R.wood = 99999; R.stone = 99999; R.iron = 99999;
    G.state.gold = 10000;
    G.agenda.tick(true);
  });
  await p.waitForFunction(function () {
    var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on');
  }, null, { timeout: 90000 });

  /* 真点顶栏「行动台」页签 —— 顺带验证 tab 接线不是摆设 */
  await p.click('[data-view="agenda"]');
  await p.waitForTimeout(300);
  var view = await p.evaluate(function () {
    var G = window.GAME, box = document.getElementById('view-container');
    var h = box ? box.innerHTML : '';
    return {
      htmlLen: h.length,
      acts: (h.match(/data-action="agenda-/g) || []).length,
      hasTitle: h.indexOf('行动台') >= 0,
      hasForecast: h.indexOf('下月预告') >= 0,
      hasOrders: h.indexOf('本月订单') >= 0,
      hasLanes: h.indexOf('商路与护送') >= 0,
      hasRoutes: h.indexOf('远征路线') >= 0,
      hasDraft: h.indexOf('逐局构筑') >= 0,
      orders: G.agenda.orderViews().length,
      lanes: G.agenda.lanesOf().length,
      routes: G.agenda.routesOf().length,
      forecast: G.agenda.forecastOf().length
    };
  });
  log('① 视图面 ' + JSON.stringify(view));
  await p.screenshot({ path: path.join(ROOT, '.workbuddy/tmp/v15770-AFTER-agenda.png'), fullPage: true });
  /* 视图页是内部滚动容器，fullPage 只截到视口 —— 滚到底再补一张，
     确认商路 / 远征路线 / 逐局构筑三块也没有被挤坏。 */
  await p.evaluate(function () {
    var el = document.getElementById('view-container');
    while (el && el.scrollHeight <= el.clientHeight + 5) el = el.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(ROOT, '.workbuddy/tmp/v15770-AFTER-agenda-bottom.png') });
  await p.evaluate(function () {
    var el = document.getElementById('view-container');
    while (el && el.scrollHeight <= el.clientHeight + 5) el = el.parentElement;
    if (el) el.scrollTop = 0;
  });

  /* ① 真点：接单 → 交付，检查资源 / 旧币 / 声望真的变 */
  var before = await p.evaluate(function () {
    var G = window.GAME, R = G.res(G.currentCity());
    return { grain: R.grain, gold: G.state.gold, rep: G.state.rep, done: G.agenda.stateOf().doneCount };
  });
  await p.click('[data-action="agenda-order-take"]');
  await p.waitForTimeout(200);
  await p.click('[data-action="agenda-order-deliver"]');
  await p.waitForTimeout(200);
  var after = await p.evaluate(function () {
    var G = window.GAME, R = G.res(G.currentCity());
    return {
      grain: R.grain, gold: G.state.gold, rep: G.state.rep, done: G.agenda.stateOf().doneCount,
      logs: G.msgLog().filter(function (x) { return String(x.msg || '').indexOf('交付') >= 0; }).length
    };
  });
  log('② 订单真点 BEFORE ' + JSON.stringify(before) + ' → AFTER ' + JSON.stringify(after));

  /* ③ 真点：发货（商路）—— 默认山脊道，开局圈半径 55 未封 */
  var b2 = await p.evaluate(function () {
    var G = window.GAME, R = G.res(G.currentCity());
    return { gold: G.state.gold, stone: R.stone, sent: G.agenda.stateOf().laneSent };
  });
  await p.click('[data-action="agenda-lane-send"]');
  await p.waitForTimeout(200);
  var a2 = await p.evaluate(function () {
    var G = window.GAME, R = G.res(G.currentCity());
    return {
      gold: G.state.gold, stone: R.stone, sent: G.agenda.stateOf().laneSent,
      logs: G.msgLog().filter(function (x) { return String(x.msg || '').indexOf('商队走') >= 0; }).length
    };
  });
  log('③ 商队真点 BEFORE ' + JSON.stringify(b2) + ' → AFTER ' + JSON.stringify(a2));

  /* ② 真点：选路线（穿荒近道），检查冻结的 routeId 与三个系数 */
  var b3 = await p.evaluate(function () { return window.GAME.agenda.routeIdOf(); });
  await p.click('[data-action="agenda-route-pick"][data-id="cut"]');
  await p.waitForTimeout(200);
  var a3 = await p.evaluate(function () {
    var G = window.GAME, id = G.agenda.routeIdOf();
    return {
      route: id, march: G.agenda.routeMarchMulOf(id), supply: G.agenda.routeSupplyOf(id),
      loot: G.agenda.routeLootMulOf(id)
    };
  });
  log('④ 路线真点 ' + b3 + ' → ' + JSON.stringify(a3));

  /* ③ 真点：雇护卫开关 */
  var guard = await p.evaluate(function () { return window.GAME.agenda.stateOf().laneGuard; });
  await p.click('[data-action="agenda-lane-guard"]');
  await p.waitForTimeout(200);
  var guard2 = await p.evaluate(function () { return window.GAME.agenda.stateOf().laneGuard; });
  log('⑤ 护卫开关 ' + guard + ' → ' + guard2);

  await p.screenshot({ path: path.join(ROOT, '.workbuddy/tmp/v15770-AFTER-agenda-acted.png'), fullPage: true });

  var ok = view.htmlLen > 1500 && view.acts >= 10
    && view.hasTitle && view.hasForecast && view.hasOrders && view.hasLanes && view.hasRoutes && view.hasDraft
    && after.grain < before.grain && after.gold > before.gold && after.rep > before.rep
    && after.done === 1 && after.logs >= 1
    && a2.sent === 1 && a2.logs >= 1 && a2.stone < b2.stone
    && a3.route === 'cut' && a3.loot === 1.35 && a3.march === 0.75 && a3.supply === 400
    && guard2 === true && guard === false
    && errs.length === 0;
  log('⑥ 判定 ' + (ok ? 'PASS' : 'FAIL') + ' · 页面异常 ' + errs.length + ' 条');
  errs.forEach(function (e) { log('   ' + e); });
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { log('FATAL ' + (e && e.stack || e)); process.exit(2); });
