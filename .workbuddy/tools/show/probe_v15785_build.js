/* 完整首城下：点空地弹出的建造菜单里到底有哪些卡片？
   回答 e2e「弹窗含科研中心选项」为什么红。 */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  const out = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st;
    G.ui.enterGame();
    var c = st.cities[0];
    var empty = [];
    c.cells.forEach(function (x, i) { if (!x.build) empty.push(i); });
    var kinds = {};
    c.cells.forEach(function (x) { if (x.build) kinds[x.build.id] = (kinds[x.build.id] || 0) + 1; });
    /* 打开一个空地的建造菜单 */
    var res = null;
    try {
      G.ui.openBuildMenu(c.id, empty[0]);
      var m = document.querySelector('#modal-root');
      var cards = m ? m.querySelectorAll('[data-build]') : [];
      var ids = [];
      for (var i = 0; i < cards.length; i++) ids.push(cards[i].getAttribute('data-build'));
      res = { count: cards.length, ids: ids.slice(0, 30) };
    } catch (e) { res = { err: e.message }; }
    return { cells: c.cells.length, empty: empty.length, builds: kinds, modal: res,
      popCap: c.popCap, pop: c.pop };
  });
  console.log('格数 ' + out.cells + ' · 空 ' + out.empty + ' · 建筑 ' + JSON.stringify(out.builds));
  console.log('人口 ' + out.pop + '/' + out.popCap);
  console.log('建造菜单 ' + JSON.stringify(out.modal));
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''));
  await browser.close();
})();
