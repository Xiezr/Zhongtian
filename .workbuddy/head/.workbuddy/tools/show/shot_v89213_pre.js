/* v89.213 改前图（换备份法专用）：同一场景截三张（底栏商场 / 弹窗 / 满页）
   用法：先把 backup/v89213/index.html 换入 → 跑本脚本 → 立即还原 + cmp。
   注意：文件名带 -pre 后缀（防与改后图混淆）；诊断脚本的截图路径已同步改名为 diag-*。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v213pre', cityName: '许都', region: '碎垣', mapSeed: 20261013 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('shop');
  });
  await sleep(650);
  await p.screenshot({ path: E + 'v89213-pre-shop.png' });
  console.log('pre-shop done');

  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.closeAllModals();
    G.ui.openModal(G.ui.modalPagerHTML('m213', 100, 10), { title: '分页（10 页）', size: 'lg' });
  });
  await sleep(450);
  await p.screenshot({ path: E + 'v89213-pre-modal.png' });
  console.log('pre-modal done');

  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('city');
    G.ui._bottom = [G.ui.pagerInnerHTML('big213', 200, 10)];
    G.ui.paintBottom();
  });
  await sleep(250);
  await p.screenshot({ path: E + 'v89213-pre-full.png' });
  console.log('pre-full done');

  await b.close();
  process.exit(0);
})();
