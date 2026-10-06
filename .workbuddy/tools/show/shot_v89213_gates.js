/* v89.213 实机验收：分页条「整体居中」（底栏 + 弹窗两条路）
   ------------------------------------------------------------
   老板：「底部导航栏有隐藏名称，指挥战斗菜单；商场等多页码页面，页码集中在中部，
          不要分散至两边，导致和其他菜单重叠住了」
   ① 底栏商场分页：内容块中点 = 屏幕中点（≤2px）· 与 bb-tools / 缩略图不相交（改前重叠 95px）
   ② 真点可用：分页首按钮 elementFromPoint 命中自身（改前被 bb-tools 盖住）· 真点「末页」翻页
      · 「🏷 隐藏名称」真点切换（顺带验证未被分页条影响）
   ③ 弹窗分页：内容块中点 = 屏幕中点（≤2px）
   ④ 底栏满数字页（20 页 · l 组 7 按钮）最宽形态：仍居中 + 与 bb-tools 不相交
   图：v89213-shop / v89213-full / v89213-modal */
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
    G.newGame({ name: 'v213', cityName: '许都', region: '碎垣', mapSeed: 20261013 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('shop');
  });
  await sleep(650);

  /* ══ ① 底栏商场分页：整体居中 + 不与两侧菜单相交 ══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) { if (!el) return null; var x = el.getBoundingClientRect(); return { l: Math.round(x.left / k), r: Math.round(x.right / k), t: Math.round(x.top / k), b: Math.round(x.bottom / k) }; }
    var pg = document.querySelector('#bottom-bar .pager');
    if (!pg) return { err: 'no-pager' };
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r'), mid = pg.querySelector('.pg-info');
    var tools = document.querySelector('#bottom-bar .bb-tools');
    var mini = document.querySelector('#bottom-bar .bb-mini');
    var lr = R(l), rrr = R(rr), tr = R(tools), mr = R(mini);
    var contentMid = (lr.l + rrr.r) / 2;
    return {
      lGroup: lr, rGroup: rrr, tools: tr, mini: mr,
      midTxt: (mid ? mid.textContent : '').slice(0, 24),
      contentMid: contentMid, screenMid: 720,
      dMid: Math.round((contentMid - 720) * 10) / 10,
      ovLeft: tr.r - lr.l,        /* 内容块左缘 vs bb-tools 右缘（>0 = 重叠） */
      ovRight: rrr.r - mr.l,      /* 内容块右缘 vs 缩略图左缘 */
    };
  });
  chk('①a 商场底栏分页「' + (r1.midTxt || '') + '」内容块整体居中（中点 ' + r1.contentMid + ' vs 720 · 差 ' + r1.dMid + 'px ≤ 2）',
    !r1.err && Math.abs(r1.dMid) <= 2, JSON.stringify(r1));
  chk('①b 与「🏷/⚔」不重叠（内容左缘 ' + (r1.lGroup && r1.lGroup.l) + ' − bb-tools 右缘 ' + (r1.tools && r1.tools.r) + ' = ' + r1.ovLeft + 'px < 0）',
    !r1.err && r1.ovLeft < 0, 'ovLeft=' + r1.ovLeft);
  chk('①c 与缩略图不重叠（' + r1.ovRight + 'px < 0）', !r1.err && r1.ovRight < 0, 'ovRight=' + r1.ovRight);
  await p.screenshot({ path: E + 'v89213-shop.png' });

  /* ══ ② 真点可用：分页首按钮 elementFromPoint 命中自身 + 末页翻页 + 隐藏名称真点 ══ */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var btn = document.querySelector('#bottom-bar .pager .pg-side.l button');
    if (!btn) return { err: 'no-btn' };
    var rc = btn.getBoundingClientRect();
    var hit = document.elementFromPoint((rc.left + rc.right) / 2, (rc.top + rc.bottom) / 2);
    var lbl = document.querySelector('#bottom-bar .bb-label-toggle');
    var lrc = lbl.getBoundingClientRect();
    var hitLbl = document.elementFromPoint((lrc.left + lrc.right) / 2, (lrc.top + lrc.bottom) / 2);
    return {
      btnTxt: btn.textContent,
      hitIsBtn: hit === btn || (hit && btn.contains(hit)),
      hitTag: hit ? (hit.className || hit.tagName) : 'null',
      lblTxt: lbl.textContent.trim(),
      hitIsLbl: hitLbl === lbl || (hitLbl && lbl.contains(hitLbl)),
    };
  });
  chk('②a 分页首按钮「' + (r2.btnTxt || '') + '」命中自身（改前被 bb-tools 盖住 · 实测 hit=' + r2.hitTag + '）',
    !r2.err && r2.hitIsBtn === true, JSON.stringify(r2));
  chk('②b 「' + (r2.lblTxt || '') + '」命中自身（分页条不盖它）', !r2.err && r2.hitIsLbl === true);

  /* 真点「末页»」→ 页码变化；真点「隐藏名称」→ 文案翻转（各点完还原） */
  var r2c = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._pages['shop-items'] = 1;
    G.refreshView();
    return true;
  });
  await sleep(400);
  var lastBtnOk = await p.evaluate(function () {
    var btns = document.querySelectorAll('#bottom-bar .pager .pg-side.r button');
    var last = btns[btns.length - 1];
    if (!last) return { err: 'no-last' };
    last.click();
    return { clicked: last.textContent };
  });
  await sleep(350);
  var r2d = await p.evaluate(function () {
    var G = window.GAME;
    return { page: G.ui._pages['shop-items'] || 1 };
  });
  chk('②c 真点「' + (lastBtnOk.clicked || '') + '」翻页生效（页 1 → ' + r2d.page + '）', r2d.page === 2, JSON.stringify(r2d));
  var r2e = await p.evaluate(function () {
    var G = window.GAME;
    var lbl = document.querySelector('#bottom-bar .bb-label-toggle');
    var before = document.body.classList.contains('labels-off');
    lbl.click();
    return { before: before };
  });
  await sleep(350);
  var r2f = await p.evaluate(function () {
    var G = window.GAME;
    var lbl = document.querySelector('#bottom-bar .bb-label-toggle');
    var now = document.body.classList.contains('labels-off');
    var txt = lbl.textContent.trim();
    lbl.click();   /* 还原 */
    return { after: now, txt: txt };
  });
  await sleep(200);
  chk('②d 「隐藏名称/显示名称」真点切换（' + (r2e.before ? '关' : '开') + ' → ' + (r2f.after ? '关' : '开') + ' · 文案「' + r2f.txt + '」）',
    r2f.after !== r2e.before, JSON.stringify({ b: r2e.before, a: r2f.after, t: r2f.txt }));

  /* ══ ③ 弹窗分页：内容块中点 = 屏幕中点 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.closeAllModals();
    G.ui.openModal(G.ui.modalPagerHTML('m213', 100, 10), { title: '分页（10 页）', size: 'lg' });
  });
  await sleep(450);
  var r3 = await p.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) { if (!el) return null; var x = el.getBoundingClientRect(); return { l: Math.round(x.left / k), r: Math.round(x.right / k) }; }
    var pg = document.querySelector('#modal-root .pager');
    if (!pg) return { err: 'no-pager' };
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r');
    var lr = R(l), rrr = R(rr);
    var contentMid = (lr.l + rrr.r) / 2;
    return { lGroup: lr, rGroup: rrr, contentMid: contentMid,
      dMid: Math.round((contentMid - 720) * 10) / 10 };
  });
  chk('③ 弹窗分页（10 页满数字）内容块居中（中点 ' + r3.contentMid + ' vs 720 · 差 ' + r3.dMid + 'px ≤ 2）',
    !r3.err && Math.abs(r3.dMid) <= 2, JSON.stringify(r3));
  await p.screenshot({ path: E + 'v89213-modal.png' });

  /* ══ ④ 底栏满数字页（20 页）最宽形态 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('city');
    /* 直推底栏绘制出口：20 页 200 项 → l 组 7 按钮（首页/上页/5 数字）——最宽形态 */
    G.ui._bottom = [G.ui.pagerInnerHTML('big213', 200, 10)];
    G.ui.paintBottom();
  });
  await sleep(250);
  var r4 = await p.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) { if (!el) return null; var x = el.getBoundingClientRect(); return { l: Math.round(x.left / k), r: Math.round(x.right / k) }; }
    var pg = document.querySelector('#bottom-bar .pager');
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r');
    var tools = document.querySelector('#bottom-bar .bb-tools');
    var mini = document.querySelector('#bottom-bar .bb-mini');
    var lr = R(l), rrr = R(rr), tr = R(tools), mr = R(mini);
    var contentMid = (lr.l + rrr.r) / 2;
    return { contentMid: contentMid, dMid: Math.round((contentMid - 720) * 10) / 10,
      ovLeft: tr.r - lr.l, ovRight: rrr.r - mr.l,
      nBtns: l.querySelectorAll('button').length };
  });
  chk('④ 底栏满数字页（' + r4.nBtns + ' 按钮组）最宽形态：居中（差 ' + r4.dMid + 'px ≤ 2）· 不重叠（' + r4.ovLeft + ' / ' + r4.ovRight + ' < 0）',
    Math.abs(r4.dMid) <= 2 && r4.ovLeft < 0 && r4.ovRight < 0, JSON.stringify(r4));
  await p.screenshot({ path: E + 'v89213-full.png' });

  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
