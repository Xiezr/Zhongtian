'use strict';
/* v157.68 修复前/后同状态对照图：唯一变量是 map3d.js 的 fog 渲染口径。
 * 用法：node shot_v15768_beforeafter.js before | after
 * 造「中央一小块已探明 + 外围未探明 + 半明过渡带」的中等距离地表局部，
 * 复现老板截图的深蓝底 + 浅灰蓝六边形碎斑。
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var path = require('path');
var ROOT = 'E:/Deepseekdb';
var TAG = process.argv[2] === 'after' ? 'after' : 'before';
var LOG = path.join(ROOT, '.workbuddy/tmp/shot_v15768_' + TAG + '.log');
fs.writeFileSync(LOG, '');
function log(s) { fs.appendFileSync(LOG, String(s) + '\n'); console.log(s); }

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { log('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') log('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(2200);

  var r = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, SP = G.sphere;
    if (!M || !SP || !SP.cells) return 'no sphere';
    try { M.setZoom(0.14); } catch (e) { }
    var d = (M.camO && M.camO.dir) || [0, 0, 1];
    G.__fogBk = G.fog.get;
    G.fog.get = function (ci) {
      var c = SP.cells[ci];
      if (!c || !c.dir) return 2;
      var t = c.dir[0] * d[0] + c.dir[1] * d[1] + c.dir[2] * d[2];
      var h = ((ci * 1103515245 + 12345) >>> 0) % 1000 / 1000;
      t += (h - 0.5) * 0.024;
      if (t > 0.995) return 2;
      if (t > 0.983) return 1;
      return 0;
    };
    /* ⚠️ buildFog() 是闭包私有、没有挂到 M 上；真正暴露的是 paintGlobeFog /
       paintRegionEdges（内部调 paintLineFog）。必须显式调这两个，fog 桩才会重绘。 */
    try { if (M.paintGlobeFog) M.paintGlobeFog(); } catch (e) { return 'paintGlobeFog err ' + e.message; }
    try { if (M.paintRegionEdges) M.paintRegionEdges(); } catch (e) { }
    /* 统计三档格子数，证明前后用的是同一份 fog 分布 */
    var c0 = 0, c1 = 0, c2 = 0;
    for (var i = 0; i < SP.cells.length; i++) {
      var v = G.fog.get(i);
      if (v === 0) c0++; else if (v === 1) c1++; else c2++;
    }
    return 'zoom=' + M.zoomFrac().toFixed(3) + ' dist=' + M.camO.dist.toFixed(1)
      + ' fog0=' + c0 + ' fog1=' + c1 + ' fog2=' + c2;
  });
  log('STATE ' + r);
  await p.waitForTimeout(1400);
  var f = path.join(ROOT, '.workbuddy/shots/v15768-' + TAG.toUpperCase() + '-fogclean.png');
  await p.screenshot({ path: f });
  log('SHOT ' + TAG + ' -> ' + f);
  log('DONE');
  await b.close();
})().catch(function (e) { log('ERR ' + (e && (e.stack || e.message))); process.exit(1); });
