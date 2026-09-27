/* v89.157 diag：公文页各块精确坐标 + 滚动容器 + app-k 真值 */
const pw = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var subs = ['war', 'task', 'era', 'weather', 'build', 'gather', 'sys'];
    for (var i = 1; i <= 40; i++) {
      var sub = subs[i % subs.length];
      G.log('§量测消息 ' + i + '：这是一条用于量测行高与铺满的测试消息，中等长度文本内容。', 'sys', sub === 'war' ? undefined : sub);
    }
    G.ui._msgTag = 'all';
    G.ui.setView('reports');
    G.ui.renderView('reports');
  });
  await p.waitForTimeout(600);
  const r = await p.evaluate(function () {
    var G = window.GAME;
    var kComputed = getComputedStyle(document.documentElement).getPropertyValue('--app-k').trim();
    var scaleEl = document.getElementById('app-scale');
    var m = scaleEl ? getComputedStyle(scaleEl).transform : 'none';
    function box(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { top: +r.top.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1),
        offTop: el.offsetTop, offH: el.offsetHeight, cls: String(el.className || el.id).slice(0, 24) };
    }
    var vc = document.getElementById('view-container');
    var page = document.querySelector('.ui-page');
    var head = document.querySelector('.gold-heading');
    var tabs = document.querySelector('.doc-tabs') || document.querySelector('.march-tabs');
    var chips = document.querySelector('.msg-channels');
    var task = document.getElementById('msg-task');
    var feed = document.getElementById('msg-feed');
    var subs = document.querySelector('#doc-body .ui-sub');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    /* 谁在滚：逐级查 scrollHeight/clientHeight */
    var scrollers = [];
    var el = feed;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 1) {
        scrollers.push((el.id || el.className || el.tagName) + ':' + el.clientHeight + '/' + el.scrollHeight);
      }
      el = el.parentElement;
    }
    return {
      kComputed: kComputed, transform: m,
      vc: box(vc), vcScroll: { ch: vc.clientHeight, sh: vc.scrollHeight },
      page: box(page), pageScroll: { ch: page.clientHeight, sh: page.scrollHeight },
      head: box(head), tabs: box(tabs), chips: box(chips), task: box(task),
      feed: box(feed), sub: box(subs),
      lineCount: lines.length, lineH: lines.length ? +lines[0].getBoundingClientRect().height.toFixed(2) : -1,
      scrollers: scrollers
    };
  });
  console.log(JSON.stringify(r, null, 1));
  /* 再量一版 tag=gather（无摘要区） */
  await p.evaluate(function () { window.GAME.ui.setMsgTag('gather'); });
  await p.waitForTimeout(400);
  const r2 = await p.evaluate(function () {
    function box(el) { if (!el) return null; var r = el.getBoundingClientRect(); return { top: +r.top.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) }; }
    var vc = document.getElementById('view-container');
    var chips = document.querySelector('.msg-channels');
    var feed = document.getElementById('msg-feed');
    var sub = document.querySelector('#doc-body .ui-sub');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    return { vc: box(vc), chips: box(chips), feed: box(feed), sub: box(sub), lineCount: lines.length,
      vcCh: vc.clientHeight, vcSh: vc.scrollHeight };
  });
  console.log('gather: ' + JSON.stringify(r2, null, 1));
  await b.close();
  process.exit(0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
