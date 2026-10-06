/* ============================================================
 * shot_v89124_pop.js — 人口行「/时 增速」实机图 + 对齐量化（v89.124）
 * ------------------------------------------------------------
 * 出图：
 *   v89124-pop-rate.png  侧栏（城池属性·人口行 与 资源栏 同屏）
 * 量化（真浏览器有布局，才量得到）：
 *   · 人口行增速列右缘 vs 资源行增速列右缘（"界面规划参考资源"的硬验证）
 *   · 两行首列标签的 x（左缘）
 * 用法：node .workbuddy/tools/show/shot_v89124_pop.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    st.res.gold = 5e6;
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 摆一个人口"进行中"的场景：民房到 8 级（上限大）、人口半满（增速可见） */
    c.cells.forEach(function (x) {
      if (x.build && x.build.id === 'minfang') x.build.lvl = 8;
      if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 6);
    });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    st.res.pop = Math.floor(G.maxPopOf(c) * 0.4);
    G.refreshAll();
  });
  await new Promise(function (r) { setTimeout(r, 700); });

  var m = await page.evaluate(function () {
    function rect(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    }
    return {
      popRate: rect('#city-attrs .pop-line .num-rate'),
      resRate0: rect('#res-bar .res-line .num-rate'),
      popLbl: rect('#city-attrs .pop-line .lbl'),
      resLbl: rect('#res-bar .res-line .lbl'),
      popTxt: (document.querySelector('#city-attrs .pop-line .num-rate') || {}).textContent,
      popFull: (document.querySelector('#city-attrs .pop-line') || {}).textContent,
      resTxt: (document.querySelector('#res-bar .res-line .num-rate') || {}).textContent,
    };
  });
  console.log('人口行：' + (m.popFull || '').replace(/\s+/g, ' ').trim());
  console.log('资源首行增速：' + m.resTxt);
  console.log('增速列右缘：人口 ' + (m.popRate && m.popRate.right) + ' vs 资源 ' + (m.resRate0 && m.resRate0.right)
    + ' → 差 ' + (m.popRate && m.resRate0 ? Math.abs(m.popRate.right - m.resRate0.right) : '?') + 'px');
  console.log('首列标签左缘：人口 ' + (m.popLbl && m.popLbl.x) + ' vs 资源 ' + (m.resLbl && m.resLbl.x)
    + ' → 差 ' + (m.popLbl && m.resLbl ? Math.abs(m.popLbl.x - m.resLbl.x) : '?') + 'px');

  await page.screenshot({ path: path.join(OUT, 'v89124-pop-rate.png') });
  console.log('✓ v89124-pop-rate.png');
  var aligned = m.popRate && m.resRate0 && Math.abs(m.popRate.right - m.resRate0.right) <= 2
    && Math.abs(m.popLbl.x - m.resLbl.x) <= 2;
  console.log(aligned ? '✓ 对齐达标（≤2px）：人口行与资源行同列' : '✗ 对齐未达标');
  await browser.close();
})();
