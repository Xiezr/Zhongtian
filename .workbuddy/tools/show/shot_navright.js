'use strict';
/* v156.32：顶栏右侧工具区（图例 + 天时）放大对照 —— 省约前/后看同一块。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = process.argv[2] || '.workbuddy/shots/navright.png';
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
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
  await p.waitForTimeout(900);
  var box = await p.evaluate(function () {
    var el = document.querySelector('.nav-right');
    var r = el.getBoundingClientRect();
    var sky = document.getElementById('nav-sky');
    var rs = sky.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(r.left) - 6), y: Math.max(0, Math.round(r.top) - 8),
      w: Math.round(r.width) + 12, h: Math.round(r.height) + 16,
      skyW: Math.round(rs.width), skyH: Math.round(rs.height),
      txt: sky.textContent, title: sky.title,
      font: getComputedStyle(sky).fontSize, weight: getComputedStyle(sky).fontWeight
    };
  });
  console.log('nav-right ' + box.w + '×' + box.h + '  天时块 ' + box.skyW + '×' + box.skyH
    + '  font=' + box.font + '/' + box.weight);
  console.log('文字: ' + box.txt);
  console.log('tooltip: ' + box.title);
  await p.screenshot({ path: OUT, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  console.log('WROTE ' + OUT);
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
