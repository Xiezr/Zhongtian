/* v89.212 实机验收：城外堆场按资源分账（资源悬停 / 仓库面板 / 城外面板）+ 出征行序（真 DOM） */
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
    G.newGame({ name: 'v212', cityName: '许都', region: '碎垣', mapSeed: 20261212 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000, minfu: 3000 };
    G.ui.enterGame(); G.ui.closeAllModals();
  });
  await sleep(420);

  /* ── ① 资源悬停按资源（title 数值核对 + 真悬停浮层） ── */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, U = G.utils;
    G.ui.renderSide();   /* 进游戏后主循环第一拍前侧栏未渲染 —— 测试主动渲染一次（e2e 同惯例） */
    var c = G.currentCity();
    var amts = document.querySelectorAll('#res-bar .res-line .amt');
    var t = [];
    Array.prototype.forEach.call(amts, function (el) { t.push(el.getAttribute('title') || ''); });
    return {
      n: t.length, grain: t[0] || '', wood: t[1] || '',
      capG: G.storeCapOf(c, 'grain'), capW: G.storeCapOf(c, 'wood'),
      wantG: U.amtText(G.storeCapOf(c, 'grain')),
      wantW: U.amtText(G.storeCapOf(c, 'wood')),
    };
  });
  chk('①a 粮上限 > 木上限（域层 ' + r1.capG + ' vs ' + r1.capW + ' · 2田1木）', r1.capG > r1.capW);
  chk('①b 粮行 title 含粮自己的上限（' + r1.wantG + '）', r1.grain.indexOf(r1.wantG) >= 0, r1.grain.slice(0, 90));
  chk('①c 木行 title 含木自己的上限（' + r1.wantW + '）', r1.wood.indexOf(r1.wantW) >= 0, r1.wood.slice(0, 90));
  chk('①d 粮行 ≠ 木行（按资源分账生效）', r1.grain !== r1.wood);
  chk('①e 分解行在（· 城外堆场（本类地块）：+）', r1.grain.indexOf('城外堆场（本类地块）') >= 0);
  /* 真悬停：粮行 → tip 浮层 */
  var pt1 = await p.evaluate(function () {
    var el = document.querySelectorAll('#res-bar .res-line .amt')[0];
    var rc = el.getBoundingClientRect();
    return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
  });
  await p.mouse.move(pt1.x, pt1.y);
  await sleep(680);
  var r1b = await p.evaluate(function () {
    var tl = document.getElementById('tip-layer');
    return { on: !!(tl && tl.classList.contains('on')), txt: (tl ? tl.textContent : '').slice(0, 150) };
  });
  chk('①f 真悬停 → tip 浮层显示（含「上限」）', r1b.on && r1b.txt.indexOf('上限') >= 0, r1b.txt);
  await p.screenshot({ path: E + 'v89212-res.png' });

  /* ── ② 仓库面板：四行各显各的上限 ── */
  await p.evaluate(function () { window.GAME.ui.openStore(); });
  await sleep(520);
  var r2 = await p.evaluate(function () {
    var caps = Array.prototype.map.call(
      document.querySelectorAll('#modal-root .store-row .cap'), function (el) { return el.textContent; });
    var tits = Array.prototype.map.call(
      document.querySelectorAll('#modal-root .store-row .cap'), function (el) { return el.getAttribute('title') || ''; });
    return { caps: caps, tits: tits };
  });
  chk('②a 仓库面板四行各显各的（粮 ≠ 木 = 石 = 铁）',
    r2.caps.length === 4 && r2.caps[0] !== r2.caps[1]
    && r2.caps[1] === r2.caps[2] && r2.caps[2] === r2.caps[3],
    JSON.stringify(r2.caps));
  chk('②b 行悬停给分解（仓库 + 城外堆场）',
    /仓库/.test(r2.tits[0] || '') && /堆场/.test(r2.tits[0] || ''), r2.tits[0]);
  await p.screenshot({ path: E + 'v89212-store.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(200);

  /* ── ③ 城外面板：按归属资源（首城 idx2 = 伐木场） ── */
  await p.evaluate(function () { window.GAME.ui.openExtModal(2); });
  await sleep(520);
  var r3 = await p.evaluate(function () {
    var txt = (document.querySelector('#modal-root') || document.body).textContent || '';
    return { has: txt.indexOf('另加木材上限') >= 0, head: txt.slice(0, 70) };
  });
  chk('③ 城外面板：伐木场块标「另加木材上限」', r3.has, r3.head);
  await p.screenshot({ path: E + 'v89212-ext.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(200);

  /* ── ④ 出征行序（真 DOM） ── */
  var t4 = await p.evaluate(function () {
    var G = window.GAME;
    for (var y = 0; y < 240; y++) {
      for (var x = 0; x < 240; x++) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        var wl = G.map.wildLevelNow(x, y);
        if (wl > 0 && wl <= 5) return { kind: 'wild', x: x, y: y };
      }
    }
    return null;
  });
  chk('④⓪ 找到野地靶（前置）', !!t4, JSON.stringify(t4));
  if (t4) {
    await p.evaluate(function (tt) { window.GAME.ui.openExpModal(tt); }, t4);
    await sleep(720);
    var r4 = await p.evaluate(function () {
      var secs = document.querySelectorAll('#modal-root .exp-quad .exp-sec');
      var seq = Array.prototype.map.call(secs, function (el) {
        var m = (el.className || '').match(/exp-a-[a-z]+/);
        return m ? m[0] : '';
      });
      var q = document.querySelector('#modal-root .exp-quad');
      var mo = q ? q.querySelector('.exp-a-modes') : null;
      var ta = q ? q.querySelector('.exp-a-tactic') : null;
      return { seq: seq, topModes: mo ? mo.offsetTop : -1, topTactic: ta ? ta.offsetTop : -1 };
    });
    var want = ['exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic'];
    var seqOK = r4.seq.length >= 4 && want.every(function (k, i) { return r4.seq[i] === k; });
    chk('④a 行序（真 DOM）= 出征方式→方案→战术→计略', seqOK, JSON.stringify(r4.seq));
    chk('④b 视觉序一致（modes.top ' + r4.topModes + ' < tactic.top ' + r4.topTactic + '）',
      r4.topModes >= 0 && r4.topTactic > r4.topModes);
    await p.screenshot({ path: E + 'v89212-exp.png' });
    await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
    await sleep(150);
  }

  console.log('');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
