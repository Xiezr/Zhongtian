'use strict';
/* v157.72 实机取证：① 点地块是否只剩一层 ② 任务型地块标色是否真的没了 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1080, height: 635 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('PAGE-ERR ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var out = await p.evaluate(function (seed) {
    var G = window.GAME, r = {};
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();

    r.version = G.VERSION;
    r.hasOpenCellMenu = (typeof G.ui.openCellMenu === 'function');
    r.actspotCount = 0;
    try {
      var ck = G.map3d && G.map3d.cellKind;
      if (ck) Object.keys(ck).forEach(function (k) { if (ck[k] === 'actspot') r.actspotCount++; });
    } catch (e) { r.ckErr = String(e); }

    /* 找一块已探明的野地，真调 openCellPanel，看面板里有什么 */
    var ci = -1, SP = G.sphere, CK = (G.map3d && G.map3d.cellKind) || {};
    if (SP && SP.cells && G.fog) {
      for (var i = 0; i < SP.cells.length; i++) {
        if (G.fog.get(i) > 0 && (!CK[i] || CK[i] === 'wild')) { ci = i; break; }
      }
    }
    r.ci = ci;
    if (ci >= 0) {
      var before = (document.querySelector('#modal-root') || {}).innerHTML || '';
      G.map3d.openCellPanel(ci);
      var html = (document.querySelector('#modal-root') || {}).innerHTML || '';
      r.modalLen = html.length;
      r.hasMenuTitle = html.indexOf('地块操作') >= 0 || html.indexOf('🗺') >= 0;
      r.hasScout = html.indexOf('侦查') >= 0;
      r.hasRaid = html.indexOf('掠夺') >= 0;
      r.hasOccupy = html.indexOf('占领') >= 0;
      r.beforeLen = before.length;
    }
    return r;
  }, 20260926);

  console.log('===== 实机 DUMP =====');
  console.log(JSON.stringify(out, null, 2));
  await p.waitForTimeout(900);
  await p.screenshot({ path: '.workbuddy/tmp/v15772-AFTER-cellpanel.png' });
  console.log('===== 页面异常 ' + errs.length + ' 条 =====');
  errs.forEach(function (e) { console.log(e); });

  var pass = out.version === 'v157.72' && out.hasOpenCellMenu === false
    && out.actspotCount === 0 && out.ci >= 0
    && out.modalLen > 500 && out.hasMenuTitle === false
    && out.hasScout === true;
  console.log(pass && errs.length === 0 ? 'SHOT_PASS' : 'SHOT_FAIL');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
