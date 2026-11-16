'use strict';
/* v157.77 取证：色块 → 悬停简报是否说清了"这是什么" */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var base = await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.resetView(); } catch (e) { }
    return { version: G.VERSION };
  }, 20260926);
  await p.waitForTimeout(6000);

  var d = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, F = G.fog;
    var tk = M._tintKind || {};
    var out = { version: G.VERSION, tintKinds: {}, briefs: [], missing: 0 };

    Object.keys(tk).forEach(function (k) { out.tintKinds[tk[k]] = (out.tintKinds[tk[k]] || 0) + 1; });

    /* 每类取 2 个样本，看简报说了什么 */
    var seen = {};
    Object.keys(tk).forEach(function (k) {
      var kindw = tk[k];
      seen[kindw] = (seen[kindw] || 0) + 1;
      if (seen[kindw] > 2) return;
      var ci = +k;
      var br = M.cellBrief(ci);
      if (!br) { out.missing++; return; }
      var txt = (br.facts || []).join(' / ');
      out.briefs.push({
        ci: ci, tint: kindw, fog: F.get(ci),
        title: br.title, icon: br.icon,
        facts: br.facts, tasks: br.tasks,
        /* 关键判据：这格的简报里到底有没有解释"色块" */
        explains: /动静|营地|村社|遗迹|我方|阵亡|地面标记/.test(txt)
      });
    });
    return out;
  });

  console.log(JSON.stringify(d, null, 1));

  /* 真悬停：找一个 trace 格，把它转到屏幕中央附近再 hover */
  var hov = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, tk = M._tintKind || {};
    var traceCi = -1;
    Object.keys(tk).forEach(function (k) { if (tk[k] === 'trace' && traceCi < 0) traceCi = +k; });
    if (traceCi < 0) return { err: '没有 trace 格' };
    try { M.focusOnCell(traceCi, true); } catch (e) { }
    return { traceCi: traceCi };
  });
  await p.waitForTimeout(2200);
  /* 回到轨道视角（focusOnCell 会贴地；贴地模式按 v157.56 主动隐藏浮签） */
  await p.evaluate(function () {
    var M = window.GAME.map3d;
    try { M.surfaceMode(false); } catch (e) { }
    var target = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, M.ZOOM_MIN - M.SURF_EYE + 320));
    var lo = Math.log(M.ZOOM_MIN), hi = Math.log(M.ZOOM_MAX);
    M.setZoom((Math.log(target) - lo) / (hi - lo));
  });
  await p.waitForTimeout(900);
  await p.mouse.move(640, 360);
  await p.waitForTimeout(500);
  await p.screenshot({ path: '.workbuddy/tmp/v15777-hover.png' });
  console.log('hover target ' + JSON.stringify(hov));

  console.log('===== 异常 ' + errs.length + ' =====');
  errs.slice(0, 4).forEach(function (e) { console.log(e); });
  console.log(base.version === 'v157.77' && errs.length === 0 ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
