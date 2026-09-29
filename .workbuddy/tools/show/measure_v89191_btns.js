/* v89.191 实机量测（真浏览器）：解雇/晋升 两按钮的几何 —— 老板「稍微错开，上下不重叠，等下点错了」
   量：两按钮 rect（x/y/w/h）+ 行 rect + 垂直间隙（下方按钮 top − 上方按钮 bottom）。
   跑法：NODE_PATH=... node .workbuddy/tools/show/measure_v89191_btns.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
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
    G.newGame({ name: '量191', cityName: '许都', region: '豫州', mapSeed: 20260929 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    var p1 = G.makeGeneral('测一', 50, 'idle', null, false, 'ying', 'balance');
    p1.cityId = c.id;
    G.state.generals.push(p1);
    G.ui._genSel = p1.id;
    G.ui.setView('generals');
    G.ui.renderView('generals');
  });
  await p.waitForTimeout(600);
  var out = await p.evaluate(function () {
    var G = window.GAME, k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left / k * 10) / 10, y: Math.round(r.top / k * 10) / 10,
        w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 };
    }
    var pane = document.querySelector('.gen-pane');
    var nameRow = pane.querySelector('.gp-name');
    var rankRow = pane.querySelector('.gp-rankrow');
    var dis = pane.querySelector('[data-action="dismiss-gen"]');
    var pro = pane.querySelector('[data-action="gen-rankup"]');
    var rd = R(dis), rp = R(pro);
    return {
      nameRow: R(nameRow), rankRow: R(rankRow),
      dismiss: rd, promote: rp,
      gapY: (rd && rp) ? Math.round((rp.y - (rd.y + rd.h)) * 10) / 10 : null,
      sameX: (rd && rp) ? rd.x === rp.x : null,
      dx: (rd && rp) ? Math.round((rp.x - rd.x) * 10) / 10 : null,
      nameRowH: R(nameRow) && R(nameRow).h, rankRowH: R(rankRow) && R(rankRow).h,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
