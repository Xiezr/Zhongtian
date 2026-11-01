'use strict';
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
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(800);

  async function realDrag(sel) {
    var box = await p.evaluate(function (s) {
      var el = document.querySelector(s);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, sel);
    if (!box) return { err: '元素不存在或尺寸为 0: ' + sel };
    await p.evaluate(function () { window.getSelection().removeAllRanges(); });
    await p.mouse.move(box.x + 6, box.y + 6);
    await p.mouse.down();
    await p.mouse.move(box.x + Math.min(box.w - 6, 160), box.y + Math.min(box.h - 6, 60), { steps: 12 });
    await p.mouse.up();
    return await p.evaluate(function (s) {
      var sel = window.getSelection();
      var el = document.querySelector(s);
      var cs = el ? getComputedStyle(el) : {};
      return { len: sel.toString().length, text: sel.toString().slice(0, 24), userSelect: cs.userSelect };
    }, sel);
  }

  var out = [];

  await p.evaluate(function () { window.GAME.ui.setView('city'); });
  await p.waitForTimeout(500);
  out.push(['城内 .city-iso', await realDrag('.city-pure .city-iso')]);
  out.push(['城内 .iso-tile', await realDrag('.city-pure .iso-tile')]);

  await p.evaluate(function () { window.GAME.ui.setView('ext'); });
  await p.waitForTimeout(500);
  out.push(['城外 .city-iso', await realDrag('.city-pure .city-iso')]);

  /* 找**有建筑**的格子（带 built / lvl 之类的 class） */
  await p.evaluate(function () { window.GAME.ui.setView('city'); });
  await p.waitForTimeout(400);
  var cls = await p.evaluate(function () {
    var tiles = [].slice.call(document.querySelectorAll('.city-pure .iso-tile'));
    var withAct = tiles.filter(function (t) { return t.getAttribute('data-action'); });
    var sample = tiles.slice(0, 4).map(function (t) { return t.className; });
    /* 点第一个带 data-action 的 */
    if (withAct[0]) withAct[0].click();
    return { total: tiles.length, sample: sample };
  });
  await p.waitForTimeout(700);
  var modalClasses = await p.evaluate(function () {
    var root = document.getElementById('modal-root') || document.body;
    var set = {};
    [].slice.call(root.querySelectorAll('[class]')).forEach(function (el) {
      String(el.className).split(/\s+/).forEach(function (c) { if (/^bldg|^build/.test(c)) set[c] = 1; });
    });
    return Object.keys(set);
  });
  console.log('格子 class 样例: ' + JSON.stringify(cls.sample));
  console.log('弹窗内 bldg/build 类: ' + JSON.stringify(modalClasses));

  for (var i = 0; i < modalClasses.length; i++) {
    out.push(['面板 ' + modalClasses[i], await realDrag('.' + modalClasses[i])]);
  }

  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } });
  await p.evaluate(function () { window.GAME.ui.setView('reports'); });
  await p.waitForTimeout(600);
  out.push(['对照 战报正文', await realDrag('#view-container .ui-page')]);

  console.log('');
  out.forEach(function (x) {
    var r = x[1] || {};
    var isCtrl = /对照/.test(x[0]);
    var pass = isCtrl ? (r.len > 0) : (r.len === 0);
    console.log((pass ? '✅ ' : '❌ ') + x[0].padEnd(24)
      + ' 选中 ' + String(r.len).padStart(4) + ' 字　user-select=' + (r.userSelect || '?')
      + (r.err ? '　' + r.err : ''));
  });
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
