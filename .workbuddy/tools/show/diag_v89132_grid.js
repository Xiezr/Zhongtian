/* 诊断：军务处两营 grid 列宽为何不等（1098 vs 272） */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    st.wounded = 1234; st.woundedArmy = { yibing: 800, gongjian: 300, qingji: 134 };
    st.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches');
  });
  await p.waitForTimeout(500);
  var out = await p.evaluate(function () {
    var wrap = document.querySelector('.camp-cards');
    var cs = getComputedStyle(wrap);
    var cards = wrap.querySelectorAll('.camp-card');
    function widest(card) {
      var best = { w: 0, tag: '', cls: '', txt: '' };
      card.querySelectorAll('*').forEach(function (el) {
        var w = el.getBoundingClientRect().width;
        if (w > best.w) best = { w: Math.round(w), tag: el.tagName, cls: el.className || '', txt: (el.textContent || '').slice(0, 40) };
      });
      return best;
    }
    return {
      wrapW: Math.round(wrap.getBoundingClientRect().width),
      cols: cs.gridTemplateColumns,
      display: cs.display, gap: cs.gap,
      cardW: [Math.round(cards[0].getBoundingClientRect().width), Math.round(cards[1].getBoundingClientRect().width)],
      c0: widest(cards[0]), c1: widest(cards[1]),
      c0scroll: cards[0].scrollWidth, c0min: getComputedStyle(cards[0]).minWidth
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
  process.exit(0);
})();
