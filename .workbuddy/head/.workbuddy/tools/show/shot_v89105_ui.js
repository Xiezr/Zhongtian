/* ============================================================
 * shot_v89105_ui.js — v89.105 基调统一实机截图
 * 出图：市场（两段表）/ 门派（六派两列）/ 官府（新式标题）/ 市场（旧式标题对照）
 *      / 设置页（四行）/ 出征（xxl）/ 见闻日志
 * 顺带量：每个弹窗的溢出（应 0）
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

  var boot = await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = { yibing: 12000, gongjian: 4200, qingji: 1800, minfu: 900 };
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 7); });
    st.items = st.items || {};
    ['shennongchu', 'zengminling', 'yiminling', 'zhenzhu', 'lianbing_jingyan', 'chest_tong', 'jinang']
      .forEach(function (id) { st.items[id] = 4; });
    st.wounded = 5200;
    st.woundedArmy = { yibing: 3600 };
    G.ui.enterGame();
    G.ui.setView('city');
    G.refreshAll();
    return { ok: true };
  });
  console.log('开局 ' + JSON.stringify(boot));

  async function shot(file, fn, label) {
    await page.evaluate(function (e) {
      var G = window.GAME;
      try { G.ui.closeModal(); } catch (x) {}
      (new Function('GAME', e))(G);
    }, fn);
    await new Promise(function (r) { setTimeout(r, 340); });
    var geo = await page.evaluate(function () {
      var pn = document.querySelector('#modal-root .m-body') || document.querySelector('#modal-root .inner-panel');
      var root = document.querySelector('#modal-root');
      return {
        over: pn ? (pn.scrollHeight - pn.clientHeight) : -1,
        hasPanel: !!pn,
        title: (root.querySelector('.m-title, .gold-heading') || {}).textContent || '(无)',
        hasDivider: (function () {
          var g = root.querySelector('.inner-panel > .gold-heading:first-child');
          if (!g) return 'n/a';
          var cs = getComputedStyle(g);
          return (parseFloat(cs.borderBottomWidth) > 0 ? '有' : '无') + '线/' + cs.paddingBottom;
        })(),
      };
    });
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('已存 ' + file + '　溢出 ' + geo.over + 'px ' + (geo.over <= 2 ? '✅' : '❌')
      + '　标题「' + geo.title.slice(0, 14) + '」　首行标题分隔线：' + geo.hasDivider);
  }

  await shot('v89105-market.png', 'GAME.ui.openMarket();', '市场');
  await shot('v89105-sect.png', 'GAME.ui.openSect();', '门派');
  await shot('v89105-guanfu.png', 'GAME.ui.openGuanfu();', '官府（新式标题）');
  await shot('v89105-journal.png', 'GAME.ui.openJournal(1);', '见闻/日志');
  await shot('v89105-auto-march.png', 'GAME.ui.openAutoMarch();', '自动出征配置');
  await shot('v89105-exp.png',
    'GAME.ui.openExpModal({kind:"wild",x:GAME.state.cities[0].x+2,y:GAME.state.cities[0].y+2});', '出征');

  /* 设置页（视图，非弹窗） */
  await page.evaluate(function () { GAME.ui.setView('settings'); });
  await new Promise(function (r) { setTimeout(r, 300); });
  await page.screenshot({ path: path.join(OUT, 'v89105-settings.png') });
  console.log('已存 v89105-settings.png');

  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
