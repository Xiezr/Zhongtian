/* ============================================================
 * shot_v89123_rate.js — 资源栏「每小时产量」实机图（v89.123）
 * ------------------------------------------------------------
 * 出图：
 *   v89123-reshour.png   侧栏资源栏（/时 增速 + 过万以万）
 * 场景：把城外农田拉到高级别，让粮食产量过万（"万"档可见）。
 * 顺带量：#res-bar 各行增速文本 / 悬停明细是否 /时 口径
 * 用法：node .workbuddy/tools/show/shot_v89123_rate.js
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

  var info = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    st.res.gold = 5e6;
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 城内建筑拉到 8 级（官府放闸） */
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 8); });
    /* 城外：前 6 格全部改成满级农田（让粮食产量过万）—— extGrid 结构 = {id,type,lv} */
    var grid = c.extGrid || [];
    grid.forEach(function (e, k) {
      if (k < 6) { e.type = 'farm'; e.lv = 12; e.pending = null; }
    });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    G.refreshAll();
    var pc = G.cityProdPerSec(c);
    return {
      perSec: pc.grain,
      perH: pc.grain * 3600 / G.timeScale(),   /* 游戏时间 /时（与页面显示同口径） */
      ts: G.timeScale(),
    };
  });
  console.log('本城粮食：现实每秒 ' + info.perSec.toFixed(2) + ' · timeScale=' + info.ts
    + ' → 游戏每小时 ' + Math.round(info.perH) + '（页面应显示此值）');
  await new Promise(function (r) { setTimeout(r, 600); });

  var bar = await page.evaluate(function () {
    var out = [];
    document.querySelectorAll('#res-bar .res-line').forEach(function (ln) {
      var lbl = ln.querySelector('.lbl');
      var rate = ln.querySelector('.num-rate');
      out.push((lbl ? lbl.textContent : '?') + ' ' + (rate ? rate.textContent : '?'));
    });
    var wrap = document.querySelector('#res-bar .rate-wrap');
    return { rows: out, tip: wrap ? (wrap.getAttribute('data-tip') || '') : '' };
  });
  console.log('资源栏读数：');
  bar.rows.forEach(function (x) { console.log('  ' + x); });
  console.log('悬停明细首行：' + bar.tip.split('\n')[0]);
  console.log('悬停明细含 /时：' + (bar.tip.indexOf('（/时）') >= 0) + ' · 含 万：' + (bar.tip.indexOf('万') >= 0));

  await page.screenshot({ path: path.join(OUT, 'v89123-reshour.png') });
  console.log('✓ v89123-reshour.png（侧栏资源栏）');
  var good = bar.rows.length >= 5 && bar.rows.every(function (x) { return x.indexOf('/时') > 0; });
  console.log(good ? '✓ 五行均为 /时 口径' : '✗ 有行不是 /时');
  await browser.close();
})();
