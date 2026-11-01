'use strict';
/* v156.35：地图页底栏（.map-dock）实测 —— 截条 + 打印每个可见元素与总宽。
   用来确认「球系坐标 / 经度 / °E / 纬度 / °N / 前往」整组真的没了，且没有挤坏其它按钮。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '测', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 120000 });
  await p.waitForTimeout(1200);
  var info = await p.evaluate(function () {
    var dock = document.querySelector('#bottom-bar .map-dock');
    if (!dock) return { err: 'no dock' };
    var kids = [].slice.call(dock.children).map(function (el) {
      var b = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: el.className, act: el.getAttribute('data-action') || '',
        w: Math.round(b.width),
        txt: (el.tagName === 'INPUT' ? ('input[' + (el.placeholder || '') + ']') : (el.textContent || '').trim()).slice(0, 14)
      };
    });
    return {
      w: Math.round(dock.getBoundingClientRect().width),
      h: Math.round(dock.getBoundingClientRect().height),
      kids: kids,
      hasLon: !!document.querySelector('#map-lon'),
      hasLat: !!document.querySelector('#map-lat'),
      hasGoto: !!document.querySelector('[data-action="map-goto"]'),
      hasGx: !!document.querySelector('#map-gx'),
      hasLabel: (dock.textContent || '').indexOf('球系坐标') >= 0
    };
  });
  if (info.err) { console.log(info.err); await b.close(); return; }
  console.log('底栏 ' + info.w + '×' + info.h + '   元素 ' + info.kids.length + ' 个');
  console.log('  残留检查：经度框=' + info.hasLon + ' 纬度框=' + info.hasLat
    + ' 前往=' + info.hasGoto + ' 旧平面框=' + info.hasGx + ' 「球系坐标」字样=' + info.hasLabel);
  console.log('  元素明细：');
  info.kids.forEach(function (k) {
    console.log('    ' + String(k.w).padStart(4) + 'px  ' + k.tag.padEnd(6)
      + (k.act ? '[' + k.act + '] ' : '').padEnd(18) + k.txt);
  });
  var box = await (await p.$('#bottom-bar')).boundingBox();
  await p.screenshot({ path: '.workbuddy/shots/mapdock.png', clip: { x: 0, y: Math.max(0, box.y - 6), width: 1440, height: Math.min(90, box.height + 12) } });
  console.log('WROTE .workbuddy/shots/mapdock.png');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
