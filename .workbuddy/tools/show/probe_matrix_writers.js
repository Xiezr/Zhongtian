/* 抓现行：给 InstancedMesh.setMatrixAt 装钩子，记录所有写入者的调用栈 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    window.__WRITES = [];
    var P = window.THREE.InstancedMesh.prototype;
    var orig = P.setMatrixAt;
    P.setMatrixAt = function (i, m) {
      var st = (new Error()).stack.split('\n').slice(1, 5).join(' | ');
      window.__WRITES.push({ n: this.name || this.type, i: i, stack: st });
      return orig.call(this, i, m);
    };
  });

  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  }, 20260926);
  await p.waitForTimeout(2500);

  var r = await p.evaluate(function () {
    var W = window.__WRITES;
    var byStack = {};
    W.forEach(function (w) { var k = w.n + ' :: ' + w.stack; byStack[k] = (byStack[k] || 0) + 1; });
    var lines = ['totalWrites=' + W.length];
    Object.keys(byStack).forEach(function (k) { lines.push('[' + byStack[k] + 'x] ' + k); });
    return lines.join('\n');
  });
  console.log(r);
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
