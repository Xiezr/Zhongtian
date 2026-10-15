/* v89.214 换皮实机图（第二组）：军务·出征（兵种） / 威望（爵位阶梯） / 城池（建筑）
   图：v89214-troops / v89214-rank / v89214-city */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '将军', cityName: '许都', region: '碎垣', mapSeed: 20261014 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var c = G.currentCity();
    c.army = { yibing: 2000, changqiang: 1200, gongjian: 800 };
    G.state.res.gold = 3e5; G.state.res.grain = 5e5; G.state.res.wood = 5e5;
  });
  await sleep(600);
  /* ① 募兵面板（兵种卡）—— 换皮后兵种名一览 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._trainTab = 'inf';
    if (G.ui.openTroops) G.ui.openTroops();
    else { G.ui.closeAllModals(); G.ui.openTrainModal && G.ui.openTrainModal(); }
  });
  await sleep(800);
  await p.screenshot({ path: E + 'v89214-troops.png' });
  /* ② 威望（阶梯视图 —— setView('rank')） */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('rank'); G.ui.renderView('rank');
  });
  await sleep(800);
  await p.screenshot({ path: E + 'v89214-rank.png' });
  /* ③ 城池视图（建筑名） */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals(); G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide();
  });
  await sleep(700);
  await p.screenshot({ path: E + 'v89214-city.png' });
  console.log('shots done');
  await b.close(); process.exit(0);
})();
