/* ============================================================
 * shot_v89122_invasion.js — 「外敌来犯」开关实机对照（v89.122）
 * ------------------------------------------------------------
 * 出图：
 *   v89122-invasion-on.png   接受态（圆点亮 · 摘要"已接受 · 下一场 X 后"）
 *   v89122-invasion-off.png  拒战态（圆点灭 · 摘要"已拒战"）
 * 顺带量：圆点 class（.auto-item.on）/ 摘要文本 / settings.invasion
 * 用法：node .workbuddy/tools/show/shot_v89122_invasion.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    st.cities.push(G.makeCity({ id: 'c2b', name: '二城', x: 265, y: 215 }));
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('auto');
    G.ui._autoSel = 'invasion';
    G.ui.renderView('auto');
  });
  await new Promise(function (r) { setTimeout(r, 400); });

  function probe() {
    return page.evaluate(function () {
      var G = window.GAME;
      var item = null;
      document.querySelectorAll('#view-container .auto-item').forEach(function (el) {
        var nm = el.querySelector('.ai-name');
        if (nm && nm.textContent === '外敌来犯') item = el;
      });
      return {
        on: item ? item.className.indexOf(' on') >= 0 : null,
        sub: item ? (item.querySelector('.ai-sub') || {}).textContent : null,
        inv: G.state.settings.invasion,
        accept: G.invasionAcceptOn(),
      };
    });
  }
  var a = await probe();
  console.log('开启态：圆点 on=' + a.on + ' · 摘要="' + a.sub + '" · settings.invasion=' + a.inv + ' · acceptOn=' + a.accept);
  await page.screenshot({ path: path.join(OUT, 'v89122-invasion-on.png') });
  console.log('✓ v89122-invasion-on.png');

  /* 点开关（走真动作出口），界面重绘后取拒战态 */
  await page.evaluate(function () {
    var G = window.GAME;
    G.doToggleInvasionAccept();
    G.ui._autoSel = 'invasion';
    G.ui.renderView('auto');
  });
  await new Promise(function (r) { setTimeout(r, 400); });
  var b = await probe();
  console.log('拒战态：圆点 on=' + b.on + ' · 摘要="' + b.sub + '" · settings.invasion=' + b.inv + ' · acceptOn=' + b.accept);
  await page.screenshot({ path: path.join(OUT, 'v89122-invasion-off.png') });
  console.log('✓ v89122-invasion-off.png');

  var good = a.on === true && b.on === false && b.accept === false
    && String(b.sub).indexOf('已拒战') >= 0 && String(a.sub).indexOf('已接受') >= 0;
  console.log(good ? '✓ 对照达标：点击前接受（亮）→ 点击后拒战（灭），摘要同步' : '✗ 对照异常');
  await browser.close();
})();
