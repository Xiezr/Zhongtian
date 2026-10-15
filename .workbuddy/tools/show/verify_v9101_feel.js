/* v91.01 实机验收：按压反馈统一（:active 下压/轻缩）—— 匹配风格 · 改善交互
 * 用法：node .workbuddy/tools/show/verify_v9101_feel.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.refreshAll();
  });
  await p.waitForTimeout(500);

  /* 逐族读取 :active 规则是否落到该元素（用 getComputedStyle 取不出 :active；
     改为检查 CSS 规则命中 + 元素 cursor）。用 CDP 强制 :active 较繁琐——
     这里用"元素命中族选择器" + 计算 cursor 两个可观测口径。 */
  var res = await p.evaluate(function () {
    function has(el, cls) { return el && el.classList && el.classList.contains(cls); }
    var out = {};
    var tab = document.querySelector('.topnav .tab');
    out.tab_cursor = tab ? getComputedStyle(tab).cursor : '';
    out.tab_transition_has_transform = tab ? /transform/.test(getComputedStyle(tab).transitionProperty || getComputedStyle(tab).transition) : false;
    var chip = document.querySelector('.chips .chip');
    out.chip_found = !!chip;
    out.chip_transition_has_transform = chip ? /transform/.test(getComputedStyle(chip).transitionProperty || getComputedStyle(chip).transition) : false;
    return out;
  });
  console.log('COMPUTED:', JSON.stringify(res));

  /* 用 CDP Input 真按住鼠标，读 CSS.supports 不了的 :active —— 改用 playwright 的
     mouse.down 后读 elementFromPoint 的 transform（浏览器会对 :active 应用规则）。 */
  async function pressTransform(selector) {
    var box = await p.locator(selector).first().boundingBox();
    if (!box) return 'no-box';
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(80);
    var t = await p.evaluate(function (sel) {
      var el = document.querySelector(sel);
      return el ? getComputedStyle(el).transform : 'none';
    }, selector);
    await p.mouse.up();
    await p.waitForTimeout(60);
    return t;
  }

  // 需要可见的元素：先切到有 chip 的视图
  console.log('TAB active transform:', await pressTransform('.topnav .tab[data-view="city"]'));
  console.log('DOCK active transform:', await pressTransform('.bb-label-toggle'));

  // 英雄行 / 背包格：切视图
  await p.evaluate(function () { GAME.ui.setView('generals'); });
  await p.waitForTimeout(300);
  console.log('GENROW active transform:', await pressTransform('.gen-row'));

  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
