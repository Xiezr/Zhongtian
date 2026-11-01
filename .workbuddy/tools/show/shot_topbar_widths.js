'use strict';
/* v156.33：顶栏在 1440 / 1180 / 1024 三档的实测 ——
   重点看"锁定页签灰显后"会不会把顶栏挤成两行（.topnav 是 flex-wrap:wrap，会换行不会溢出）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var WIDTHS = [1440, 1180, 1024];
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  for (var wi = 0; wi < WIDTHS.length; wi++) {
    var W = WIDTHS[wi];
    var p = await b.newPage({ viewport: { width: W, height: 900 } });
    p.on('pageerror', function (e) { console.log('EXC', e.message); });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
    await p.evaluate(function () {
      var G = window.GAME;
      var st = G.newGame({ name: '测', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
      if (!st.map.grid) G.map.generate();
      G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
      G.ui.setView('city');
    });
    await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
    await p.waitForTimeout(700);
    var info = await p.evaluate(function () {
      var nav = document.getElementById('topnav');
      var r = nav.getBoundingClientRect();
      var tabs = [].slice.call(nav.querySelectorAll('.tab[data-view]'));
      var rows = {};
      tabs.forEach(function (t) {
        var b = t.getBoundingClientRect();
        if (!b.width) return;
        var k = Math.round(b.top);
        rows[k] = (rows[k] || 0) + 1;
      });
      var locked = tabs.filter(function (t) { return t.classList.contains('tab-locked'); }).map(function (t) {
        var b = t.getBoundingClientRect();
        var cs = getComputedStyle(t);
        return {
          v: t.dataset.view, w: Math.round(b.width), x: Math.round(b.left),
          op: cs.opacity, disp: cs.display, filter: cs.filter,
          title: t.getAttribute('title') || '', aria: t.getAttribute('aria-disabled') || ''
        };
      });
      var right = nav.querySelector('.nav-right');
      return {
        navH: Math.round(r.height), navTop: Math.round(r.top),
        rows: rows, locked: locked,
        rightRight: right ? Math.round(right.getBoundingClientRect().right) : 0,
        scrollW: nav.scrollWidth, clientW: nav.clientWidth
      };
    });
    console.log('── ' + W + 'px ──  顶栏高 ' + info.navH + '  行分布 ' + JSON.stringify(info.rows)
      + '  右侧工具区右缘 ' + info.rightRight + '  溢出 ' + (info.scrollW - info.clientW));
    info.locked.forEach(function (l) {
      console.log('   🔒 ' + l.v.padEnd(11) + ' x=' + String(l.x).padStart(4) + ' w=' + String(l.w).padStart(3)
        + ' display=' + l.disp + ' opacity=' + l.op + ' filter=' + l.filter
        + ' aria=' + (l.aria || '-') + ' title=' + (l.title ? '有' : '无'));
    });
    await p.screenshot({ path: '.workbuddy/shots/topbar_' + W + '.png', clip: { x: 0, y: 0, width: W, height: Math.min(120, info.navH + 20) } });
    await p.close();
  }
  await b.close();
  console.log('WROTE .workbuddy/shots/topbar_1440.png / _1180.png / _1024.png');
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
