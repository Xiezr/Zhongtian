/* v89.213 诊断：底栏分页条三栏布局 → 与左右相邻菜单（bb-tools / 缩略图）重叠实况
   老板：「底部导航栏有隐藏名称，指挥战斗菜单…商场等多页码页面，页码集中在中部，
          不要分散至两边，导致和其他菜单重叠住了」
   量：① .pager 与 .bb-tools（左）与 .bb-mini（右）的几何关系（布局值，免 k 麻烦→除 k）
       ② 分页条内**首按钮**与**末按钮**的实际落点（重叠发生在按钮上，不只是条）
       ③ 页码中点 vs 条中点（v89.204 口径仍要成立）
   截图：改前形态（v89213-before-*.png） */
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
    G.newGame({ name: 'v213', cityName: '许都', region: '碎垣', mapSeed: 20261013 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('shop');
  });
  await sleep(600);

  /* ── 量底栏分页条几何 ── */
  var r = await p.evaluate(function () {
    var G = window.GAME;
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) {
      if (!el) return null;
      var x = el.getBoundingClientRect();
      return { l: Math.round(x.left / k), r: Math.round(x.right / k), t: Math.round(x.top / k), b: Math.round(x.bottom / k), w: Math.round(x.width / k) };
    }
    var pg = document.querySelector('#bottom-bar .pager');
    if (!pg) return { err: 'no-pager' };
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r'), mid = pg.querySelector('.pg-info');
    var lBtns = l ? l.querySelectorAll('button') : [];
    var rBtns = rr ? rr.querySelectorAll('button') : [];
    var tools = document.querySelector('#bottom-bar .bb-tools');
    var mini = document.querySelector('#bottom-bar .bb-mini');
    var firstBtn = lBtns.length ? lBtns[0] : null;
    var lastBtn = rBtns.length ? rBtns[rBtns.length - 1] : null;
    var pr = R(pg), tr = R(tools), mr = R(mini), fr = R(firstBtn), lr = R(lastBtn), midr = R(mid);
    return {
      pager: pr, tools: tr, mini: mr, firstBtn: fr, lastBtn: lr, mid: midr,
      nL: lBtns.length, nR: rBtns.length,
      midTxt: (mid ? mid.textContent : '').slice(0, 30),
      /* 重叠量（正 = 重叠） */
      ovLeft: (fr && tr) ? tr.r - fr.l : null,       /* 首按钮左缘 vs bb-tools 右缘 */
      ovRight: (lr && mr) ? lr.r - mr.l : null,      /* 末按钮右缘 vs 缩略图左缘 */
      barL: (pr && tr) ? tr.r - pr.l : null,          /* 条左缘 vs bb-tools 右缘 */
      barR: (pr && mr) ? pr.r - mr.l : null,          /* 条右缘 vs 缩略图左缘 */
      diff: (midr && pr) ? Math.round(((midr.l + midr.r) / 2 - (pr.l + pr.r) / 2) * 10) / 10 : null,
    };
  });
  console.log('=== 改前基线（底栏 · 商场多页）===');
  console.log(JSON.stringify(r, null, 1));
  if (!r.err) {
    console.log('\n判读：ovLeft = ' + r.ovLeft + 'px（>0 = 首按钮与「隐藏名称/指挥战斗」重叠）');
    console.log('      ovRight = ' + r.ovRight + 'px（>0 = 末按钮与缩略图重叠）');
    console.log('      barL = ' + r.barL + 'px · barR = ' + r.barR + 'px（条体本身的越界量）');
  }
  await p.screenshot({ path: E + 'v89213-diag-shop.png' });

  /* ── 弹窗内分页条（modalPagerHTML · 取收集面板）── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.openModal(G.ui.modalPagerHTML('dg213x', 100, 10), { title: '分页诊断', size: 'lg' });
  });
  await sleep(420);
  var r2 = await p.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) { if (!el) return null; var x = el.getBoundingClientRect(); return { l: Math.round(x.left / k), r: Math.round(x.right / k), w: Math.round(x.width / k) }; }
    var pg = document.querySelector('#modal-root .pager');
    if (!pg) return { err: 'no-pager' };
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r'), mid = pg.querySelector('.pg-info');
    var lb = l ? l.querySelector('button') : null;
    return { pager: R(pg), firstBtn: R(lb), mid: R(mid), midTxt: (mid ? mid.textContent : '').slice(0, 30) };
  });
  console.log('\n=== 改前基线（弹窗内 · modalPagerHTML）===');
  console.log(JSON.stringify(r2, null, 1));
  await p.screenshot({ path: E + 'v89213-diag-modal.png' });

  await b.close();
  process.exit(0);
})();
