/* v89.240 三档调亮扫描：当前 .80+b1.15（live）之上再探 6 档
 * ------------------------------------------------------------
 * 用法：node .workbuddy/tools/show/sweep_v89240_bright.js
 * 产出：.workbuddy/shots/v89240-doll-<档名>.png（含 live / live2 自证档）
 * 约定（§149.2）：全量覆盖 opacity+filter · 动画禁用 · 自动重试 · 同会话三方自证
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

var CANDS = [
  ['o80b115', 'opacity:.80;filter:brightness(1.15)'],   /* 现行基准（应与 live 一致） */
  ['o85b115', 'opacity:.85;filter:brightness(1.15)'],
  ['o90b115', 'opacity:.90;filter:brightness(1.15)'],
  ['o90b125', 'opacity:.90;filter:brightness(1.25)'],
  ['o100b125', 'opacity:1;filter:brightness(1.25)'],
  ['o100b135', 'opacity:1;filter:brightness(1.35)'],
  ['o100b150', 'opacity:1;filter:brightness(1.50)']
];

async function snap(p, name) {
  for (var t = 0; t < 4; t++) {
    try {
      var doll = await p.$('.gen-pane .doll');
      if (!doll) { console.log(name, '=> NO .doll'); return; }
      await doll.screenshot({ path: '.workbuddy/shots/v89240-doll-' + name + '.png', animations: 'disabled' });
      var info = await p.evaluate(function () {
        var im = document.querySelector('.doll-portrait img');
        if (!im) return 'no-img';
        var cs = getComputedStyle(im);
        return 'opacity=' + cs.opacity + ' filter=' + cs.filter;
      });
      console.log(name, '=>', info);
      return;
    } catch (e) {
      if (t === 3) { console.log(name, '=> FAIL:', (e && e.message || '').split('\n')[0]); return; }
      await p.waitForTimeout(400);
    }
  }
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    var g = st.generals[0];
    try { G.systems.autoEquipBest(g.id); } catch (e) { }
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._genSel = g.id;
    G.ui.setView('generals');
    G.refreshAll();
  });
  await p.waitForFunction(
    "var im = document.querySelector('.doll-portrait img'); return !im || im.complete;",
    null, { timeout: 8000 }).catch(function () { });
  await p.waitForTimeout(700);

  await snap(p, 'live');

  for (var i = 0; i < CANDS.length; i++) {
    var name = CANDS[i][0], css = CANDS[i][1];
    await p.evaluate(function (css) {
      var id = '__sweep';
      var st = document.getElementById(id);
      if (!st) { st = document.createElement('style'); st.id = id; document.head.appendChild(st); }
      st.textContent = '.doll-portrait img, .doll-portrait svg { ' + css + ' !important; }';
    }, css);
    await p.waitForTimeout(700);
    await snap(p, name);
  }

  await p.evaluate(function () {
    var st = document.getElementById('__sweep');
    if (st) st.textContent = '';
  });
  await p.waitForTimeout(700);
  await snap(p, 'live2');

  console.log('SWEEP-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
