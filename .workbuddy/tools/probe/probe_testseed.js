'use strict';
/* v156.36：验证 `GAME.__testSeed` 到底有没有让"不传 seed 的 newGame"变便宜。
   对照组：① 不设 __testSeed（时间戳随机）② 设 __testSeed 固定。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && window.GAME.ui', null, { timeout: 30000 });
  await p.waitForTimeout(600);
  var out = await p.evaluate(function () {
    var G = window.GAME;
    function once() {
      var t = performance.now();
      var st = G.newGame({ name: 'n', cityName: '灰岗', region: '碎垣' });   /* 不传 mapSeed */
      return { ms: +(performance.now() - t).toFixed(1), seed: st.map && st.map.seed };
    }
    once();                                   /* 预热 */
    var random = [];
    G.__testSeed = null;
    for (var i = 0; i < 4; i++) random.push(once());
    var fixed = [];
    G.__testSeed = 20260926;
    for (var j = 0; j < 4; j++) fixed.push(once());
    return { random: random, fixed: fixed };
  });
  console.log('不设 __testSeed（每次时间戳随机）:');
  out.random.forEach(function (r) { console.log('   ' + String(r.ms).padStart(8) + ' ms   seed=' + r.seed); });
  console.log('设 __testSeed=20260926（固定）:');
  out.fixed.forEach(function (r) { console.log('   ' + String(r.ms).padStart(8) + ' ms   seed=' + r.seed); });
  var a = out.random.reduce(function (s, r) { return s + r.ms; }, 0) / 4;
  var c = out.fixed.reduce(function (s, r) { return s + r.ms; }, 0) / 4;
  console.log('\n平均：随机 ' + a.toFixed(0) + ' ms · 固定 ' + c.toFixed(0) + ' ms · 比值 ' + (a / c).toFixed(1) + '×');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
