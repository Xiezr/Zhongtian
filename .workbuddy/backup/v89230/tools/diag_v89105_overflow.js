/* 诊断：7 个溢出弹窗的**高度分布**（哪个块把窗口撑爆了） */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = { yibing: 12000, gongjian: 4200, qingji: 1800 };
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 7); });
    try { G.buildCityAt(c.x + 3, c.y + 1); } catch (e) {}
    st.items = st.items || {};
    ['shennongchu', 'zengminling', 'yiminling', 'bengzhu', 'lianbing_jingyan', 'chest_tong'].forEach(function (id) { st.items[id] = 4; });
    st.wounded = 5200; st.woundedArmy = { yibing: 3600 };
    st.reports = st.reports || [];
    for (var i = 0; i < 6; i++) st.reports.push({ t: Date.now() - i * 1e5, type: 'war', title: '战报 ' + i, body: 'x', win: true });
    G.ui.enterGame(); G.ui.setView('city'); G.refreshAll();
  });

  var CASES = [
    ['市场', 'ui.openMarket()'],
    ['自动出征配置', 'ui.openAutoMarch()'],
  ];
  for (var i = 0; i < CASES.length; i++) {
    var out = await page.evaluate(function (arg) {
      var G = window.GAME, ui = G.ui;
      try { ui.closeModal(); } catch (e) {}
      try { (new Function('GAME', 'ui', arg.expr))(G, ui); } catch (e) { return { err: e.message }; }
      var root = document.querySelector('#modal-root');
      var panel = root.querySelector('.inner-panel');
      if (!panel) return { err: 'no panel' };
      function h(el) { return Math.round(el.getBoundingClientRect().height); }
      var kids = [];
      Array.prototype.forEach.call(panel.children, function (c) {
        kids.push((c.className || c.tagName).slice(0, 26) + '=' + h(c)
          + (c.scrollHeight > c.clientHeight + 2 ? '(内滚' + (c.scrollHeight - c.clientHeight) + ')' : ''));
      });
      return {
        cls: panel.className, panelH: h(panel), scrollH: panel.scrollHeight, over: panel.scrollHeight - panel.clientHeight,
        kids: kids,
      };
    }, { expr: CASES[i][1] });
    console.log('\n═══ ' + CASES[i][0] + ' ═══');
    if (out.err) { console.log('  ' + out.err); continue; }
    console.log('  面板 ' + out.panelH + 'px · 内容 ' + out.scrollH + 'px · 溢出 ' + out.over + 'px  [' + out.cls + ']');
    out.kids.forEach(function (k) { console.log('    · ' + k); });
  }
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
