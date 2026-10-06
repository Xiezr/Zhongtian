/* v89.163 诊断：①造的行军为何消失 ②募兵面板为何无卡片
   跑法：NODE_PATH=".../node_modules" node .workbuddy/tools/tmp/diag_v89163.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 220)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var r0 = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '诊断', cityName: '许都', region: '碎垣', mapSeed: 7 });
    G.ui.enterGame(); G.ui.closeAllModals();
    var c = G.currentCity();
    G.state.marches = [
      { id: 'M1', cityId: c.id, genId: '', modeId: 'raid', target: { kind: 'wild', x: 1, y: 1 },
        tx: 1, ty: 1, name: '荒野·乙', kind: 'wild', army: { yibing: 1200 }, elapsed: 42, totalTime: 100,
        scheme: null, ops: 'assault', cargo: null }
    ];
    return { immediately: G.state.marches.length, isSame: G.state === window.GAME.state };
  });
  console.log('① 造局后立即：marches=' + r0.immediately + ' · isSame=' + r0.isSame);
  await p.waitForTimeout(300);
  var r1 = await p.evaluate(function () { return { n: window.GAME.state.marches.length }; });
  console.log('   +300ms：marches=' + r1.n);
  await p.waitForTimeout(800);
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    return { n: G.state.marches.length,
      log: (G.state.msgLog || []).slice(-4).map(function (x) { return String(x.msg || '').slice(0, 60); }) };
  });
  console.log('   +1100ms：marches=' + r2.n + ' · 近期公文=' + JSON.stringify(r2.log));

  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var idxs = [];
    c.cells.forEach(function (x, i) { if (!x.build && !x.official && idxs.length < 2) idxs.push(i); });
    c.cells[idxs[0]].build = { id: 'junying', lvl: 4 };
    c.cells[idxs[1]].build = { id: 'shuyuan', lvl: 4 };
    var ok = null;
    try { ok = G.ui.openTroops(idxs[0], 'normal'); } catch (e) { ok = 'ERR ' + e.message; }
    var root = document.querySelector('#modal-root');
    var cards = document.querySelectorAll('[data-troop]');
    var bar = G.barracksLevel(c, idxs[0]);
    return { idx: idxs[0], barLv: bar, ret: String(ok && ok.ok),
      htmlLen: root ? root.innerHTML.length : -1,
      cards: cards.length, first: cards.length ? cards[0].getAttribute('data-troop') : '-',
      title: root ? (root.textContent || '').replace(/\s+/g, ' ').slice(0, 90) : '' };
  });
  console.log('② openTroops(idx=' + r3.idx + ', barracksLv=' + r3.barLv + ') → ' + r3.title);
  console.log('   cards=' + r3.cards + ' first=' + r3.first + ' htmlLen=' + r3.htmlLen);
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    return { canTrain: G.canTrain('yibing'), canGJ: G.canTrain('gongjian'),
      govLv: G.buildingLevel(c, 'guanfu'), junying: G.buildingLevel(c, 'junying'), shuyuan: G.buildingLevel(c, 'shuyuan') };
  });
  console.log('③ canTrain(yibing)=' + JSON.stringify(r4.canTrain) + ' · canTrain(gongjian)=' + JSON.stringify(r4.canGJ));
  console.log('   官府=' + r4.govLv + ' 军营=' + r4.junying + ' 书院=' + r4.shuyuan);
  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL: ' + e.message); process.exit(2); });
