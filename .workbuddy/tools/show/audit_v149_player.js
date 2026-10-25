/* v149 玩家视角视觉巡检：从"第一次打开"走到"打完一场远征"，逐屏截图
 * 用法：node .workbuddy/tools/show/audit_v149_player.js
 * 产出：.workbuddy/shots/v149/*.png（按步骤编号）
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var OUT = '.workbuddy/shots/v149';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String((e && e.message) || e)); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });
  var step = 0;
  async function shot(name, wait) {
    step++;
    if (wait) await p.waitForTimeout(wait);
    var f = OUT + '/' + String(step).padStart(2, '0') + '-' + name + '.png';
    await p.screenshot({ path: f });
    console.log('shot ' + f);
    return f;
  }
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.waitForTimeout(800);

  /* ① 创建界面（玩家第一眼） */
  await shot('create', 300);

  /* ② 开局：普通局（有城） */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '旅人', cityName: '灰岗', region: '碎垣', mapSeed: 20261026, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
  });
  await shot('city', 900);

  /* ③ 主地图 */
  await p.evaluate(function () { var G = window.GAME; G.ui.setView('map'); });
  await shot('map', 1600);

  /* ④ 世界账本（玩法台）—— 新玩家第一处"这里在讲什么" */
  await p.evaluate(function () { var G = window.GAME; try { G.ui.openWorldPanel(); } catch (e) { GAME.ui.toast('openWorldPanel 失败'); } });
  await shot('world-ledger', 700);
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) {} });

  /* ⑤ 出征界面 */
  await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.openExpModal({ kind: 'own' }, { hint: '选目标、选将、选兵' }); } catch (e) { GAME.ui.toast('openExpModal 失败'); }
  });
  await shot('expedition', 700);
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) {} });

  /* ⑥ 建城/空地面板（城内点空地）→ 建筑候选 */
  await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    G.ui.setView('city');
    var idx = -1;
    (c.cells || []).forEach(function (x, i) { if (idx < 0 && !x.build && !x.official) idx = i; });
    try { G.ui.openBuildModal(idx); } catch (e) { GAME.ui.toast('openBuildModal 失败'); }
  });
  await shot('build-pick', 700);
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) {} });

  /* ⑦ 空间站（投送 + 深空远征） */
  await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    (G.DATA.SHIP_BLUEPRINTS || []).forEach(function (x) { st.items[x.id] = 1; });
    (G.DATA.SHIP_PARTS || []).forEach(function (x) { if (x.mat) st.items[x.mat] = 999; });
    st.items.w_stariron = 999; st.items.w_he3 = 999;
    st.station = { lv: 9, ships: [], _seq: 0 };
    ['c_w1', 'c_w2', 'c_w3'].forEach(function (cid) { G.ship.build(cid); });
    G.addPlanet({ seed: 20261027 });
    G.ui.setView('station');
  });
  await shot('station-top', 900);
  await p.evaluate(function () {
    var el = Array.prototype.slice.call(document.querySelectorAll('*')).filter(function (x) {
      return x.children.length === 0 && /星际投送/.test(x.textContent || '');
    })[0];
    if (el) el.scrollIntoView();
  });
  await shot('station-colony', 500);
  await p.evaluate(function () {
    var el = Array.prototype.slice.call(document.querySelectorAll('*')).filter(function (x) {
      return x.children.length === 0 && /深空远征/.test(x.textContent || '');
    })[0];
    if (el) el.scrollIntoView();
  });
  await shot('station-fleet', 500);

  /* ⑧ 行政（星球树 + 总览） */
  await p.evaluate(function () { var G = window.GAME; G.ui.setView('admin'); });
  await shot('admin', 700);

  /* ⑨ 英雄 / 背包 / 科技 */
  await p.evaluate(function () { var G = window.GAME; G.ui.setView('generals'); });
  await shot('generals', 700);
  await p.evaluate(function () { var G = window.GAME; G.ui.setView('bag'); });
  await shot('bag', 700);
  await p.evaluate(function () { var G = window.GAME; G.ui.setView('tech'); });
  await shot('tech', 700);

  /* ⑩ 设置抽屉（新手最容易找不到东西的地方） */
  await p.evaluate(function () {
    var G = window.GAME; G.ui.setView('city');
    try { G.ui.openSettings && G.ui.openSettings(); } catch (e) { GAME.ui.toast('settings 失败'); }
  });
  await shot('settings', 700);

  console.log('pageerrors=' + (errs.length ? errs.slice(0, 8).join(' | ') : '0'));
  await b.close();
})();
