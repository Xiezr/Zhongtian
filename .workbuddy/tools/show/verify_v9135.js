'use strict';
/* v91.35 验收：分帧预建（遮罩 + 各步耗时）+ 平原建城修复 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  /* ① 建城修复：造一个平原野地 → 打开面板 → 点「建城」 */
  var buildRes = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    G.ui._cityId = st.cities[0].id; G.ui.enterGame(); G.ui.setView('city');
    /* 给足资源 */
    st.res.grain = 999999; st.res.wood = 999999; st.res.stone = 999999; st.res.iron = 999999; st.res.gold = 999999;
    /* 找一处平原格并登记为已占野地 */
    var cells = G.sphere.cells, ci = -1;
    for (var i = 0; i < cells.length; i++) { if (cells[i] && cells[i].type === 'plain') { ci = i; break; } }
    if (ci < 0) return { err: 'no plain' };
    var coord = G.map.lonlatOf ? null : null;
    var cell = cells[ci];
    var w = { ci: ci, type: 'plain', x: cell.x, y: cell.y };
    st.wilds = st.wilds || []; st.wilds.push(w);
    var before = st.cities.length;
    var chk = G.canBuildCityAt(ci);
    var r = G.buildCityAt(ci);
    return { ci: ci, chkOk: chk.ok, chkMsg: chk.msg || '', ok: r.ok, msg: r.msg, citiesBefore: before, citiesAfter: st.cities.length };
  });
  console.log('BUILD', JSON.stringify(buildRes));

  /* ② 分帧预建：量各步耗时 + 界面是否卡（用 requestAnimationFrame 计数）*/
  var pre = await p.evaluate(function () {
    var G = window.GAME;
    /* 重置地图预建态，强制重跑 */
    var M = G.map3d;
    M.__resetForTest = null;
    var steps = M.preloadSteps();
    var out = [], frames = 0, raf = window.requestAnimationFrame;
    /* 装帧计数器 */
    (function loop() { frames++; raf(loop); })();
    return new Promise(function (resolve) {
      var i = 0;
      function next() {
        if (i >= steps.length) { resolve({ steps: out, framesDuring: frames }); return; }
        var st = steps[i];
        var a = performance.now();
        try { st.run(); } catch (e) { out.push({ label: st.label, err: String(e) }); i++; setTimeout(next, 0); return; }
        out.push({ label: st.label, ms: Math.round(performance.now() - a) });
        i++;
        setTimeout(next, 0);
      }
      next();
    });
  });
  console.log('PRELOAD_STEPS', JSON.stringify(pre.steps));

  /* ③ 进游戏遮罩：走一次真实 enterGame 路径（新档）看 #boot-loading 是否 on→off */
  var overlay = await p.evaluate(function () {
    var G = window.GAME;
    /* 换档重置预建 */
    var M = G.map3d;
    var st2 = G.newGame({ name: 'Y', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    G.ui._cityId = st2.cities[0].id;
    /* 让 built 复位（换种子会触发重建；这里直接看 overlay 类）*/
    G.ui.enterGame();
    var ov = document.getElementById('boot-loading');
    return { on: ov ? ov.classList.contains('on') : null, hasEl: !!ov };
  });
  console.log('OVERLAY_ON', JSON.stringify(overlay));
  await p.waitForTimeout(4000);
  var overlay2 = await p.evaluate(function () {
    var ov = document.getElementById('boot-loading');
    return { on: ov ? ov.classList.contains('on') : null, pct: (document.getElementById('bl-pct') || {}).textContent };
  });
  console.log('OVERLAY_AFTER', JSON.stringify(overlay2));
  console.log('ERRS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
