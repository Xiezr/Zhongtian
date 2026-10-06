/* v89.162 诊断：侧栏黄金悬停 tip 为何不显示（真浏览器）
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/tmp/diag_v89162_tip.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '诊断', cityName: '许都', region: '碎垣', mapSeed: 7 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.renderSide();                                   /* 侧栏需主动渲染（主循环也会，但这里先摆好） */
  });
  await p.waitForTimeout(800);

  var r = await p.evaluate(function () {
    var cnt = { wrap: 0, amt: 0 };
    var box = null;
    document.querySelectorAll('#res-bar .res-line').forEach(function (row) {
      var lbl = row.querySelector('.lbl');
      if (lbl && /金/.test(lbl.textContent || '')) {
        var w = row.querySelector('.rate-wrap');
        var a = row.querySelector('.amt');
        cnt.wrap = w ? 1 : 0; cnt.amt = a ? 1 : 0;
        if (w) { var rr = w.getBoundingClientRect(); box = { x: rr.left, y: rr.top, w: rr.width, h: rr.height }; }
      }
    });
    return { cnt: cnt, box: box, tipForFn: typeof window.GAME.ui.tipFor,
      k: window.GAME.appKOf ? window.GAME.appKOf() : 1 };
  });
  console.log('定位：wrap=' + r.cnt.wrap + ' amt=' + r.cnt.amt + ' · box=' + JSON.stringify(r.box) + ' · k=' + r.k);

  var cx = r.box.x + r.box.w / 2, cy = r.box.y + r.box.h / 2;
  await p.evaluate(function (xy) { window._dx = xy.x; window._dy = xy.y; }, { x: cx, y: cy });
  await p.mouse.move(cx, cy);
  for (var i = 0; i < 6; i++) {
    await p.waitForTimeout(i === 0 ? 60 : 300);
    var s = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      var hov = [];
      document.querySelectorAll(':hover').forEach(function (x) {
        hov.push(x.tagName + (x.className ? '.' + String(x.className).split(' ')[0] : ''));
      });
      var elAt = document.elementFromPoint(window._dx || 0, window._dy || 0);
      return { on: !!(el && el.classList.contains('on')),
        len: el ? (el.textContent || '').length : -1,
        hov: hov.slice(-3).join(' > '),
        elAt: elAt ? (elAt.tagName + (elAt.className ? '.' + String(elAt.className).split(' ')[0] : '')) : 'null' };
    });
    console.log('  t+' + i + '：on=' + s.on + ' len=' + s.len + ' · hover链=' + s.hov + ' · elementFromPoint=' + s.elAt);
  }
  /* 也试一下 playwright 的 hover（会等元素稳定） */
  console.log('--- 改用 p.hover 选择器法 ---');
  var ok = await p.evaluate(function () {
    document.querySelectorAll('#res-bar .res-line').forEach(function (row) {
      var lbl = row.querySelector('.lbl');
      if (lbl && /金/.test(lbl.textContent || '')) {
        var w = row.querySelector('.rate-wrap');
        if (w) w.id = 'diag-gold-wrap';
      }
    });
    return !!document.getElementById('diag-gold-wrap');
  });
  if (ok) {
    await p.hover('#diag-gold-wrap', { timeout: 5000 }).catch(function (e) { console.log('  hover 失败: ' + e.message.slice(0, 80)); });
    await p.waitForTimeout(150);
    var s2 = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      return { on: !!(el && el.classList.contains('on')), txt: el ? (el.textContent || '').slice(0, 60) : '' };
    });
    console.log('  p.hover 后：on=' + s2.on + ' · ' + s2.txt.replace(/\n/g, ' | '));
  }
  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL: ' + e.message); process.exit(2); });
