/* v89.137 官府面板：改前/改后对照 + 按钮规格量测
 * 跑法：TAG=v89137before node .workbuddy/tools/show/shot_v89137_guanfu.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = process.env.TAG || 'v89137after';

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var info = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') idx = i; });
    G.ui.openBuildModal(idx, c);
    return { idx: idx, isMain: G.isMainCity(c) };
  });

  var meas = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var out = [];
    var zone = null;
    var zts = root.querySelectorAll('.op-zone-t');
    for (var i = 0; i < zts.length; i++) if (zts[i].textContent.indexOf('官府要务') >= 0) zone = zts[i];
    var scope = zone ? zone.parentNode : root;
    var btns = scope.querySelectorAll('.op-row button, .op-row .btn');
    Array.prototype.slice.call(btns).forEach(function (b) {
      var r = b.getBoundingClientRect();
      var cs = getComputedStyle(b);
      out.push({
        text: b.textContent.trim(),
        act: b.getAttribute('data-action') || '',
        w: Math.round(r.width), h: Math.round(r.height),
        fs: cs.fontSize, pad: cs.padding
      });
    });
    return { btns: out, hasSetMain: !!root.querySelector('[data-action="set-main-city"]'),
      hasBuildOv: !!root.querySelector('[data-action="open-build-ov"]') };
  });

  console.log('官府面板（isMain=' + info.isMain + '）：');
  meas.btns.forEach(function (x) { console.log('  · ' + x.text + '  [' + x.w + '×' + x.h + ' · fs ' + x.fs + ' · pad ' + x.pad + ' · act=' + x.act + ']'); });
  console.log('  设为主城按钮: ' + meas.hasSetMain + ' · 全境营造总览: ' + meas.hasBuildOv);

  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/' + TAG + '-guanfu.png' });
  await b.close();
  process.exit(0);
})();
