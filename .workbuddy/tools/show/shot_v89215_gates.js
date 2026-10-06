/* v89.215 实机验收：侧栏驻军栏 —— 去下拉 · 全兵种固定序 · 暂无记 0
   ------------------------------------------------------------
   老板：「左侧统计栏，驻军，不再设置下拉，直接显示，直接按固定位置和顺序列出所有兵种和数量，
          暂无的数量则为 0」
   ① 18 行（全部兵种）· 顺序 = DATA.TROOPS 声明序
   ② 有兵行金色 / 零行灰显（computedStyle 实测两色不同）
   ③ 头不再是折叠键：无 data-action · 真点一下**无任何变化**（行数/可见性不变）
   ④ 空城：仍 18 行全 0（不再有"本城暂无驻军"文案）
   ⑤ 撑满口径未破（v76）：驻军框底缘 = 侧栏底缘（同一行高）
   图：v89215-garrison / v89215-garrison-zero */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
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
    G.newGame({ name: 'v215', cityName: '许都', region: '碎垣', mapSeed: 20261015 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var c = G.currentCity();
    /* 造一支"有兵"的驻军：主力 + 器械 + 后勤各一（覆盖三线） */
    c.army = { yibing: 1234, changqiang: 800, gongjian: 56, chuangnu: 12 };
    G.ui.renderSide();
  });
  await sleep(650);

  /* ══ ① 全兵种固定序 ══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#garrison-bar .gb-row'));
    var ids = rows.map(function (r) { return r.getAttribute('data-troop'); });
    var want = Object.keys(G.DATA.TROOPS);
    return { n: rows.length, ids: ids, want: want, head: (document.querySelector('#garrison-bar .gb-head') || {}).textContent || '',
             hasAction: !!(document.querySelector('#garrison-bar .gb-head[data-action]')),
             arrow: !!document.querySelector('#garrison-bar .gb-arrow') };
  });
  chk('①a 驻军栏 18 行（全部兵种）', r1.n === 18, 'n=' + r1.n);
  chk('①b 顺序 = DATA.TROOPS 声明序（逐行 data-troop 比对）',
    r1.ids.length === r1.want.length && r1.ids.every(function (x, i) { return x === r1.want[i]; }),
    r1.ids.slice(0, 4).join(',') + ' …');
  chk('①c 头只写「⚔ 驻军」· 无箭头 · 无 data-action', r1.head.indexOf('驻军') >= 0 && !r1.arrow && !r1.hasAction, r1.head.trim());

  /* ══ ② 颜色：有兵金 / 零行灰 ══ */
  var r2 = await p.evaluate(function () {
    var seg = function (id) { return document.querySelector('#garrison-bar .gb-row[data-troop="' + id + '"]'); };
    var gold = getComputedStyle(seg('yibing').querySelector('.gb-c')).color;
    var zero = getComputedStyle(seg('minfu').querySelector('.gb-c')).color;
    var zeroCls = seg('minfu').className;
    var goldCls = seg('yibing').className;
    var zeroTxt = seg('minfu').querySelector('.gb-c').textContent;
    var goldTxt = seg('yibing').querySelector('.gb-c').textContent;
    return { gold: gold, zero: zero, zeroCls: zeroCls, goldCls: goldCls, zeroTxt: zeroTxt, goldTxt: goldTxt };
  });
  console.log('  颜色：有兵 ' + r2.gold + ' / 零行 ' + r2.zero + '　文本：' + r2.goldTxt + ' / ' + r2.zeroTxt);
  chk('②a 有兵行数量正确（民兵 1,234）', r2.goldTxt === '1,234', r2.goldTxt);
  chk('②b 零行记 0 且灰显（gb-zero · 颜色与有兵行不同）',
    r2.zeroTxt === '0' && /gb-zero/.test(r2.zeroCls) && r2.gold !== r2.zero,
    r2.zeroCls + ' ' + r2.zero);
  chk('②c 有兵行不带 gb-zero', !/gb-zero/.test(r2.goldCls), r2.goldCls);

  await p.screenshot({ path: E + 'v89215-garrison.png' });

  /* ══ ③ 头不再是折叠键：真点一下无变化 ══ */
  var before3 = await p.evaluate(function () {
    return document.querySelectorAll('#garrison-bar .gb-row').length;
  });
  await p.locator('#garrison-bar .gb-head').click();
  await sleep(420);
  var after3 = await p.evaluate(function () {
    return { n: document.querySelectorAll('#garrison-bar .gb-row').length,
             vis: !!document.querySelector('#garrison-bar .gb-list') };
  });
  chk('③ 真点头部：无任何变化（行数不变 · 列表仍在场 · 折叠开关确已退役）',
    before3 === after3.n && after3.vis, before3 + ' → ' + after3.n);

  /* ══ ④ 空城：仍全列 18 行全 0 ══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    window.__bk215 = c.army;
    c.army = {};
    G.ui.renderSide();
    var rows = Array.prototype.slice.call(document.querySelectorAll('#garrison-bar .gb-row'));
    var zeros = rows.filter(function (r) { return /gb-zero/.test(r.className); }).length;
    var txt = document.querySelector('#garrison-bar').textContent;
    return { n: rows.length, zeros: zeros, emptyTxt: txt.indexOf('暂无驻军') >= 0,
             box: document.querySelector('#garrison-bar').outerHTML.length };
  });
  chk('④a 空城仍列 18 行 · 全 0 灰显', r4.n === 18 && r4.zeros === 18, 'n=' + r4.n + ' zero=' + r4.zeros);
  chk('④b 空态文案已退役（无「暂无驻军」）', r4.emptyTxt === false);
  await p.screenshot({ path: E + 'v89215-garrison-zero.png' });

  /* ══ ⑤ 撑满口径未破（v76）+ 18 行**全部可视**（不靠滚动） ══
     判据用权威量（scrollHeight vs clientHeight）—— 矩形差法会把 padding 算歪。 */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    c.army = window.__bk215 || {};
    G.ui.renderSide();
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function px(v) { return Math.round(v / k); }
    var side = document.querySelector('.auth-side');
    var bar = document.querySelector('#garrison-bar');
    var list = document.querySelector('#garrison-bar .gb-list');
    var rows = Array.prototype.slice.call(document.querySelectorAll('#garrison-bar .gb-row'));
    var lastRow = rows[rows.length - 1];
    return {
      sideOverflow: px(side.scrollHeight - side.clientHeight),
      listOverflow: px(list.scrollHeight - list.clientHeight),
      barH: px(bar.getBoundingClientRect().height),
      listH: px(list.getBoundingClientRect().height),
      lastRowBottom: px(lastRow.getBoundingClientRect().bottom),
      sideBottom: px(side.getBoundingClientRect().bottom),
    };
  });
  console.log('  侧栏溢出 ' + r5.sideOverflow + 'px · 列表溢出 ' + r5.listOverflow
    + 'px · 列表高 ' + r5.listH + 'px · 末行底 ' + r5.lastRowBottom + ' vs 侧栏底 ' + r5.sideBottom);
  chk('⑤a 侧栏不溢出（v76 铺满口径：无整体滚动）', r5.sideOverflow === 0, 'overflow=' + r5.sideOverflow);
  chk('⑤b 18 行**全部可视**：列表无内滚（不靠滚动看全）', r5.listOverflow === 0 && r5.listH >= 160,
    'listOverflow=' + r5.listOverflow + ' h=' + r5.listH);
  chk('⑤c 末行落在侧栏可视区内（末行底 ≤ 侧栏底）', r5.lastRowBottom <= r5.sideBottom + 2,
    r5.lastRowBottom + ' vs ' + r5.sideBottom);

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
