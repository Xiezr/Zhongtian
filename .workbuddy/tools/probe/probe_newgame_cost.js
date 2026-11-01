'use strict';
/* v156.36 探针：newGame 到底多贵？同 seed 重复 vs 换 seed —— 这决定了"测试慢"的真凶。
   ------------------------------------------------
   背景：smoke_parallel.js 的文件头写着"全量 458 秒，其中 87% 是 newGame；
   v156.21 给 hexDist 加距离缓存后同 seed 重建只要 15ms"。今天要亲自验这两句。
   做法：真实页面里连开 12 局，分两组（同 seed / 换 seed），逐次计时。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.waitForTimeout(600);

  var out = await p.evaluate(function () {
    var G = window.GAME;
    function once(seed, gen) {
      var t = performance.now();
      var st = G.newGame({ name: 'n', cityName: '灰岗', region: '碎垣', mapSeed: seed });
      if (gen && !st.map.grid) G.map.generate();
      return +(performance.now() - t).toFixed(1);
    }
    /* 预热一局（首局含各种惰性初始化，不能算进统计） */
    once(111111, false);
    var same = [], diff = [];
    for (var i = 0; i < 5; i++) same.push(once(20260926, false));        /* 同 seed 连开 */
    for (var j = 0; j < 5; j++) diff.push(once(300000 + j * 7919, false)); /* 每次换 seed */
    /* 再加上"换 seed + 重建地图"这一档 */
    var withGen = [];
    for (var k = 0; k < 3; k++) withGen.push(once(400000 + k * 131, true));
    return { same: same, diff: diff, withGen: withGen };
  });

  function stat(name, a) {
    var mn = Math.min.apply(null, a), mx = Math.max.apply(null, a);
    var avg = a.reduce(function (s, v) { return s + v; }, 0) / a.length;
    console.log('  ' + name.padEnd(22) + a.map(function (v) { return v.toFixed(0); }).join(', ')
      .padEnd(34) + ' 平均 ' + avg.toFixed(0) + 'ms  范围 ' + mn.toFixed(0) + '~' + mx.toFixed(0));
    return avg;
  }
  console.log('newGame 逐次耗时：');
  var a1 = stat('同 seed ×5', out.same);
  var a2 = stat('换 seed ×5', out.diff);
  var a3 = stat('换 seed + 建图 ×3', out.withGen);
  console.log('\n结论线索：');
  console.log('  · 同 seed 与换 seed 的比值 = ' + (a2 / a1).toFixed(1) + '×'
    + (a2 / a1 > 3 ? '  → 换 seed 明显更贵，缓存只在同 seed 命中' : '  → 换 seed 不特别贵'));
  console.log('  · 若 smoke 里 389 次 newGame 全按 ' + a2.toFixed(0) + 'ms 计 = '
    + (389 * a2 / 1000).toFixed(0) + ' 秒（占 458 秒的 ' + (389 * a2 / 4580).toFixed(0) + '%）');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
