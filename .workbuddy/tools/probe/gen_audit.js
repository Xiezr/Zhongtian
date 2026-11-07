/* ============================================================
 * 世界生成 · 分层自检（v156.71）
 * ------------------------------------------------------------
 * 老板：「步骤性建立世界生成顺序，星系，星球，地形，地块，省市区划分等。
 *        自检这个过程。不能生成 10 个星球，10 个都有问题吧。」
 *
 * 检查逻辑在产品代码里（GAME.map3d.selfCheck）—— 因为地形/地块/省市区
 * 大量状态是闭包私有，外部探针读不到（实测踩过：数据都对、返回值拿不到）。
 * 这个工具只负责：换 seed、按正确顺序重建、收集结果、统计分层通过率。
 *
 * 正确顺序（本工具就是照它跑）：
 *   ① setPlanet(seed)  数据层：球面/地形/地块/几何
 *   ② map3d.rebuild()  渲染层：网格/线框/边界
 *   ③ selfCheck()      验证
 * 少第 ② 步就是"数据换了星、画面还是上一颗"——所以专门留了一个反例用例。
 *
 * 用法：node .workbuddy/tools/probe/gen_audit.js [星球数]
 * ============================================================ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');

var N = parseInt(process.argv[2] || '10', 10);
var FP_SRC = function () {
  var cells = window.GAME.sphere.cells || [], h = 2166136261;
  for (var i = 0; i < cells.length; i += 7) {
    var c = cells[i], str = c ? (c.type + '|' + Math.round(c.lon) + '|' + Math.round(c.lat)) : 'x';
    for (var j = 0; j < str.length; j++) { h ^= str.charCodeAt(j); h = (h * 16777619) >>> 0; }
  }
  return h.toString(16);
};

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  var p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  var pageErrs = [];
  p.on('pageerror', function (e) { pageErrs.push(e.message); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && GAME.ui', null, { timeout: 30000 });

  /* 起一局并进地图：map3d 就绪（_globe/_vdirs 是 L5/L6 的输入） */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '审', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
    if (G.map3d && G.map3d.rebuild) G.map3d.rebuild();
  });
  await p.waitForFunction(function () {
    return (document.body.innerText || '').indexOf('正在构建星球') < 0;
  }, null, { timeout: 60000, polling: 400 }).catch(function () { });
  await p.waitForTimeout(1500);

  /* 一次完整"换星球"：数据层 + 渲染层（顺序不能反） */
  async function regenerate(seed, skipRebuild) {
    await p.evaluate(function (a) {
      var G = window.GAME;
      var sd = (Math.round(Number(a.seed)) % 100000) || 1;
      if (G.state && G.state.map) G.state.map.seed = sd;
      G.sphere.setPlanet(sd, null);
      if (!a.skip && G.map3d && G.map3d.rebuild) G.map3d.rebuild();
    }, { seed: seed, skip: !!skipRebuild });
    await p.waitForTimeout(skipRebuild ? 400 : 1100);
  }

  var seeds = [];
  for (var i = 0; i < N; i++) seeds.push(20260921 + i * 104729);

  console.log('=== 逐星球分层自检（' + N + ' 个种子，取模 100000 与生产同口径）===');
  var rows = [];
  for (var s = 0; s < seeds.length; s++) {
    var seed = seeds[s];
    await regenerate(seed, false);
    var r = await p.evaluate(function (sd) {
      var out = window.GAME.map3d.selfCheck(sd);
      out.fp = (function () {
        var cells = window.GAME.sphere.cells || [], h = 2166136261;
        for (var i = 0; i < cells.length; i += 7) {
          var c = cells[i], str = c ? (c.type + '|' + Math.round(c.lon) + '|' + Math.round(c.lat)) : 'x';
          for (var j = 0; j < str.length; j++) { h ^= str.charCodeAt(j); h = (h * 16777619) >>> 0; }
        }
        return h.toString(16);
      })();
      return out;
    }, seed);
    rows.push(r);
    var m = r.metrics;
    console.log((r.ok ? '✅' : '❌') + ' seed ' + String(seed).padEnd(9) +
      ' 格=' + String(m.cells).padEnd(6) +
      ' 陆=' + String(m.landPct).padStart(5) + '%' +
      ' 省/市/区=' + m.prov + '/' + m.market + '/' + m.district +
      ' 线框p90=' + (m.lineP90 == null ? '—' : m.lineP90) +
      ' 未分配=' + m.unassigned +
      (r.fails.length ? '\n     ← ' + r.fails.join(' ; ') : ''));
  }

  /* ---- 故障注入：检查器必须能抓到"已知错误"，否则全绿没有意义 ----
     ⚠️ 第一版用"跳过 rebuild"造脱节，结果没抓到 —— 因为其它路径会间接触发
     渲染重建（时序不可控）。改用**直接注入**：把渲染层记录的 seed 改掉，
     模拟"网格还是上一颗星球"的状态。这才能证明检查器不是永远通过。 */
  console.log('\n=== 故障注入（必须抓到，否则全绿无意义）===');
  await regenerate(777001, false);
  var injected = await p.evaluate(function () {
    var M = window.GAME.map3d;
    var keep = M._worldSeed;
    M._worldSeed = -12345;                  /* 人为制造脱节 */
    var out = M.selfCheck(window.GAME.sphere.seed3());
    M._worldSeed = keep;
    out._injected = true;
    return out;
  });
  var caught = injected.fails.some(function (f) { return f.indexOf('L4渲染/不同源') === 0; });
  console.log((caught ? '✅' : '❌') + ' 注入「渲染 seed = -12345」→ '
    + (caught ? '已捕获「渲染与数据不同源」' : '没抓到 —— 检查器无效'));
  console.log('     其余失败项: ' + (injected.fails.length ? injected.fails.join(' ; ') : '无'));

  /* ---- 确定性：同 seed 重建，指纹必须一致 ---- */
  console.log('\n=== 确定性（同 seed 重建，指纹需一致）===');
  var detOK = 0, detN = Math.min(3, seeds.length);
  for (var d = 0; d < detN; d++) {
    var sd2 = seeds[d];
    var fp1 = rows[d].fp;
    await regenerate(777001, false);        /* 中间插一颗别的星球，制造缓存串味压力 */
    await regenerate(sd2, false);
    var fp2 = await p.evaluate(FP_SRC);
    var same = (fp1 === fp2);
    if (same) detOK++;
    console.log((same ? '✅' : '❌') + ' seed ' + sd2 + ' 首次=' + fp1 + ' 重建=' + fp2);
  }

  /* ---- 区分度 ---- */
  var uniq = {}, dup = 0;
  rows.forEach(function (x) { if (uniq[x.fp]) dup++; uniq[x.fp] = 1; });
  console.log('\n=== 区分度 ===');
  console.log((dup === 0 ? '✅' : '❌') + ' ' + rows.length + ' 个星球指纹，重复 ' + dup + ' 个');

  /* ---- 汇总 ---- */
  var pass = rows.filter(function (x) { return x.ok; }).length;
  console.log('\n========== 汇总 ==========');
  console.log('星球 ' + rows.length + ' 颗：六层全通过 ' + pass + ' 颗，有问题 ' + (rows.length - pass) + ' 颗');
  var layerFail = {};
  rows.forEach(function (x) {
    x.fails.forEach(function (f) {
      var layer = f.split('/')[0].split(':')[0];
      layerFail[layer] = (layerFail[layer] || 0) + 1;
    });
  });
  Object.keys(layerFail).sort().forEach(function (k) {
    console.log('  ' + k.padEnd(9) + layerFail[k] + '/' + rows.length + ' 颗不合格');
  });
  console.log('  跳步检测 ' + (caught ? '有效' : '失效') + ' · 确定性 ' + detOK + '/' + detN + ' · 指纹重复 ' + dup);
  if (pageErrs.length) console.log('  页面异常: ' + pageErrs.slice(0, 3).join(' | '));

  fs.writeFileSync('.workbuddy/tmp/gen_audit.json', JSON.stringify({ rows: rows, layerFail: layerFail }, null, 1));
  await b.close();
})().catch(function (e) { console.log('FATAL ' + e.message); process.exit(1); });
