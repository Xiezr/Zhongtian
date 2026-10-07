/* v89.238 实机脚本：英雄页 people 部件栏（doll）人形图与背景亮度 —— 改前/改后对照
 * ------------------------------------------------------------
 * 用法：node .workbuddy/tools/show/shot_v89238_doll.js before|after
 * 产出：.workbuddy/shots/v89238-doll-<mode>.png（.doll 元素截图）
 *       .workbuddy/shots/v89238-pane-<mode>.png（英雄页整屏）
 * 取证：人形剪影数量（doll-fig-svg）· 抠图 src/opacity · 槽位数 · .doll 几何
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var MODE = process.argv[2] === 'after' ? 'after' : (process.argv[2] === 'before' ? 'before' : 'probe');

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
  /* 等抠图加载（img.complete）再截 */
  await p.waitForFunction(
    "var im = document.querySelector('.doll-portrait img'); return !im || im.complete;",
    null, { timeout: 8000 }).catch(function () { });
  await p.waitForTimeout(600);

  var facts = await p.evaluate(function () {
    var G = window.GAME;
    function rect(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    var doll = document.querySelector('.gen-pane .doll');
    var img = document.querySelector('.doll-portrait img');
    var fig = document.querySelector('.doll .doll-fig-svg');
    var holder = document.querySelector('.doll-portrait');
    return {
      hasDoll: !!doll,
      dollRect: rect(doll),
      figCount: document.querySelectorAll('.doll .doll-fig-svg').length,
      figPresent: !!fig,
      hasPortraitImg: !!img,
      portraitSrc: img ? img.getAttribute('src') : '',
      portraitOpacity: img ? getComputedStyle(img).opacity : '',
      portraitRect: rect(img),
      holderRect: rect(holder),
      holderOverflow: holder ? getComputedStyle(holder).overflow : '',
      dollOverflow: doll ? getComputedStyle(doll).overflow : '',
      slots: document.querySelectorAll('.doll-slot').length,
      figOpacity: fig ? getComputedStyle(fig).opacity : ''
    };
  });
  console.log('== v89.238 doll facts (' + MODE + ') ==');
  console.log(JSON.stringify(facts, null, 2));

  /* 元素截图（.doll 区域）+ 整屏 */
  var dollEl = await p.$('.gen-pane .doll');
  if (dollEl) {
    await dollEl.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89238-doll-' + MODE + '.png' });
    console.log('shot: v89238-doll-' + MODE + '.png');
  }
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89238-pane-' + MODE + '.png' });
  console.log('shot: v89238-pane-' + MODE + '.png');

  await b.close();
  process.exit(0);
})();
