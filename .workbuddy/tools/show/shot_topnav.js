'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
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
  await p.waitForFunction(function(){ var o=document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  var info = await p.evaluate(function () {
    var nav = document.getElementById('topnav');
    var r = nav.getBoundingClientRect();
    var items = [].slice.call(nav.children).map(function (el) {
      var b = el.getBoundingClientRect();
      return {
        txt: (el.textContent || '').trim().slice(0, 8),
        view: el.getAttribute('data-view') || '',
        act: el.getAttribute('data-action') || '',
        cls: el.className,
        x: Math.round(b.left), w: Math.round(b.width)
      };
    });
    return { navW: Math.round(r.width), navH: Math.round(r.height), items: items };
  });
  console.log('顶栏 ' + info.navW + '×' + info.navH);
  info.items.forEach(function (it) {
    console.log('  ' + String(it.x).padStart(5) + ' +' + String(it.w).padStart(4)
      + '  ' + (it.txt || '(空)').padEnd(9)
      + '  ' + (it.view ? 'view=' + it.view : (it.act ? 'action=' + it.act : ''))
      + (it.cls.indexOf('tab-more') >= 0 ? '  [tab-more]' : ''));
  });
  await p.screenshot({ path: '.workbuddy/shots/topnav.png', clip: { x: 0, y: 0, width: 1440, height: 72 } });
  console.log('WROTE .workbuddy/shots/topnav.png');
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
