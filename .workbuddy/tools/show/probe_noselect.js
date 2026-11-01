'use strict';
/* 验证：城市 / 城外 / 建筑面板里，左键长按拖动**不能**选中文字；
   同时日志（战报）页面**仍然能**选中 —— 证明不是一刀切全局关掉。

用法：node .workbuddy/tools/show/probe_noselect.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '测', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForFunction(function () {
    var o = document.getElementById('boot-loading');
    return !o || !o.classList.contains('on');
  }, null, { timeout: 90000 });
  await p.waitForTimeout(800);

  /* 在某个选择器上做一次"左键长按拖动"，返回被选中的文本 */
  async function dragSelect(sel) {
    return await p.evaluate(function (s) {
      var el = document.querySelector(s);
      if (!el) return { err: '元素不存在: ' + s, text: null };
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return { err: '元素尺寸为 0', text: null };
      window.getSelection().removeAllRanges();
      /* 用 InputEvent 模拟真实拖动：mousedown → 移动多次 → mouseup */
      var x0 = r.left + 3, y0 = r.top + 3;
      var x1 = r.left + Math.min(r.width - 3, 120), y1 = r.top + Math.min(r.height - 3, 40);
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x0, clientY: y0, button: 0 }));
      var range = document.createRange();
      try { range.selectNodeContents(el); } catch (e) { }
      var sel = window.getSelection();
      sel.removeAllRanges();
      /* 关键判据：由**代码**直接尝试选中，再看浏览器给不给选。
         如果 CSS 里 user-select:none，selection 会是空的。 */
      try { sel.addRange(range); } catch (e) { }
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x1, clientY: y1, button: 0 }));
      var txt = sel.toString();
      var cs = getComputedStyle(el);
      return { text: txt, len: txt.length, userSelect: cs.userSelect || cs.webkitUserSelect };
    }, sel);
  }

  var results = [];

  /* ① 城内 */
  await p.evaluate(function () { window.GAME.ui.setView('city'); });
  await p.waitForTimeout(500);
  results.push({ where: '城内棋盘 .city-iso', r: await dragSelect('.city-pure .city-iso') });
  results.push({ where: '城内单格 .iso-tile', r: await dragSelect('.city-pure .iso-tile') });

  /* ② 城外 */
  await p.evaluate(function () { window.GAME.ui.setView('ext'); });
  await p.waitForTimeout(500);
  results.push({ where: '城外棋盘 .city-iso', r: await dragSelect('.city-pure .city-iso') });

  /* ③ 建筑面板（点开一个城内格子） */
  await p.evaluate(function () { window.GAME.ui.setView('city'); });
  await p.waitForTimeout(400);
  var opened = await p.evaluate(function () {
    var t = document.querySelector('.city-pure .iso-tile[data-action]');
    if (!t) return 'no-tile';
    t.click();
    return 'clicked';
  });
  await p.waitForTimeout(600);
  results.push({ where: '建筑面板 .bldg-foot', r: await dragSelect('.bldg-foot') });
  results.push({ where: '建筑面板 .bldg-bottom', r: await dragSelect('.bldg-bottom') });

  /* ④ 对照：日志/战报必须仍能选中 */
  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } });
  await p.evaluate(function () { window.GAME.ui.setView('reports'); });
  await p.waitForTimeout(600);
  var ctrl = await p.evaluate(function () {
    /* 找任意一个有文字的容器当对照（战报页的正文） */
    var cands = ['#view-container .ui-page', '#view-container'];
    for (var i = 0; i < cands.length; i++) {
      var el = document.querySelector(cands[i]);
      if (el && el.textContent.trim().length > 20) {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        try { sel.addRange(range); } catch (e) { }
        var cs = getComputedStyle(el);
        return { text: sel.toString().slice(0, 30), len: sel.toString().length, userSelect: cs.userSelect };
      }
    }
    return { err: '找不到有文字的对照容器' };
  });
  results.push({ where: '对照·战报正文（应能选中）', r: ctrl });

  console.log('建筑面板点击结果: ' + opened + '\n');
  results.forEach(function (x) {
    var r = x.r || {};
    var pass = /对照/.test(x.where) ? (r.len > 0) : (r.len === 0);
    console.log((pass ? '✅ ' : '❌ ') + x.where.padEnd(28)
      + ' 选中 ' + String(r.len).padStart(3) + ' 字　user-select=' + (r.userSelect || '?')
      + (r.err ? '　' + r.err : ''));
  });

  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
