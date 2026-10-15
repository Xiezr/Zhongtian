/* ============================================================
 * shot_v89126_three.js — v89.126 三条需求实机截图
 * ------------------------------------------------------------
 * 出图：
 *   v89126-city-wall.png   城内：围墙**占一格**（真建 + 升到 Lv8）+ 环城视觉 + 侧栏幸存者行
 *   v89126-train-pop.png   募兵面板：可征（幸存者−劳作）/ 上限 / 增势三段条
 *   v89126-build-menu.png  建造菜单第 2 页：「围墙」卡片在册
 * 顺带打印：cap / labor / free / growth / 围墙格 / 队列（真调出口）
 * 用法：node .workbuddy/tools/show/shot_v89126_three.js
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

  /* ① 建局 + 真建围墙（通用出口）→ 升到 Lv8 */
  var info = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { st.res[k] = 5e6; });
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 官府拉满（解"官府总闸"） */
    (c.cells || []).forEach(function (x) { if (x.official && x.build) x.build.lvl = 12; });
    /* 真建围墙：通用入口 buildAt + 拨钟完成 */
    var idxW = -1;
    for (var i = 0; i < c.cells.length; i++) {
      var x = c.cells[i];
      if (!x.build && !x.official && !x.pending) { idxW = i; break; }
    }
    var log = [];
    if (idxW >= 0) {
      var rb = G.buildAt(c.id, idxW, 'chengqiang');
      log.push('buildAt: ' + rb.ok + ' ' + (rb.msg || ''));
      var q = st.queues.build[st.queues.build.length - 1];
      if (q) { q.elapsed = q.totalTime + 1; G.tickOnce(); }
      /* 升到 Lv8（真调 upgradeAt ×7） */
      for (var k = 0; k < 7; k++) {
        var ru = G.upgradeAt(c.id, idxW);
        if (!ru.ok) { log.push('upgradeAt Lv' + (k + 2) + ': ' + ru.msg); break; }
        var q2 = st.queues.build[st.queues.build.length - 1];
        if (q2) { q2.elapsed = q2.totalTime + 1; G.tickOnce(); }
      }
    }
    /* 建一点其它建筑（让劳作占用可见） */
    [[0, 'minfang'], [1, 'minfang'], [2, 'shuyuan'], [3, 'junying'], [4, 'shichang']].forEach(function (arr) {
      var x = c.cells[arr[0]];
      if (x && !x.build && !x.official) x.build = { id: arr[1], lvl: 5 };
    });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    G.refreshAll();
    return {
      idxW: idxW,
      wallLv: G.buildingLevel(c, 'chengqiang'),
      wallCell: G.wallCellIdxOf(c),
      cap: G.maxPopOf(c),
      labor: G.popLaborOf(c),
      free: G.popFreeOf(c),
      growth: G.popGrowthOf(c),
      log: log,
    };
  });
  console.log('围墙格 idx=' + info.idxW + ' · 等级 Lv' + info.wallLv + ' · wallCellIdxOf=' + info.wallCell);
  console.log('幸存者：上限 ' + info.cap + ' · 劳作占用 ' + info.labor + ' · 可征 ' + info.free
    + ' · 增速 ' + info.growth.toFixed(1) + '/时（现实）');
  if (info.log.length) console.log('建造日志：' + info.log.join('｜'));
  await new Promise(function (r) { setTimeout(r, 700); });
  await page.screenshot({ path: path.join(OUT, 'v89126-city-wall.png'), fullPage: false });
  console.log('✓ v89126-city-wall.png（城内：围墙占格 + 环城 + 侧栏幸存者）');

  /* ② 募兵面板（三段条：可征 / 上限 / 增势） */
  var trainInfo = await page.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var bIdx = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i].build && c.cells[i].build.id === 'junying') { bIdx = i; break; }
    }
    if (bIdx < 0) return { ok: false };
    G.ui.closeAllModals();
    G.ui._trainSel = 'yibing';   /* 三段条只在"已选兵种"时渲染 */
    G.ui._trainTab = 'inf';      /* 三页制：que 队列 / inf 步兵 / cav 骑兵 —— 三段条在步兵页 */
    G.ui.openTroops(bIdx, 'normal');
    /* 募兵面板是整页视图（不是弹窗）—— 三段条在 #view-container 里 */
    var body = (document.querySelector('#view-container') || document.body).textContent || '';
    var html = '';
    try { html = G.ui.troopsHTML(); } catch (e) { html = 'ERR:' + e.message; }
    return {
      ok: true,
      hasPop3: (body.indexOf('可征') >= 0) || (html.indexOf('可征') >= 0),
      htmlHas: html.indexOf('可征') >= 0,
      dbgLen: html.length,
      dbgPop3: html.indexOf('pop-3') >= 0,
      dbgSnip: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140),
      canRecruit: G.popFreeOf(c),
      labor: G.popLaborOf(c),
    };
  });
  await new Promise(function (r) { setTimeout(r, 500); });
  await page.screenshot({ path: path.join(OUT, 'v89126-train-pop.png'), fullPage: false });
  console.log('✓ v89126-train-pop.png（募兵面板：可征 ' + trainInfo.canRecruit
    + ' = 幸存者 − 劳作 ' + trainInfo.labor + '）');

  /* ③ 建造菜单第 2 页（「围墙」卡片） */
  var menuInfo = await page.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var free = -1;
    for (var i = 0; i < c.cells.length; i++) {
      var x = c.cells[i];
      if (!x.build && !x.official && !x.pending) { free = i; break; }
    }
    if (free < 0) return { ok: false };
    G.ui.closeAllModals();
    G.ui.openBuildModal(free);
    return { ok: true };
  });
  await new Promise(function (r) { setTimeout(r, 300); });
  /* 翻到第 2 页（围墙在末尾） */
  var page2 = await page.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var btns = Array.prototype.slice.call(root.querySelectorAll('[data-action="mpage"]'))
      .filter(function (b) { return (b.className || '').indexOf('off') < 0; });
    /* 找 data-n=2 优先，否则点最后一个 */
    var target = null;
    btns.forEach(function (b) { if (!target && b.getAttribute('data-n') === '2') target = b; });
    if (!target && btns.length) target = btns[btns.length - 1];
    if (target) { target.click(); return true; }
    return false;
  });
  await new Promise(function (r) { setTimeout(r, 400); });
  var menuTxt = await page.evaluate(function () {
    return ((document.querySelector('#modal-root') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 120);
  });
  await page.screenshot({ path: path.join(OUT, 'v89126-build-menu.png'), fullPage: false });
  console.log('✓ v89126-build-menu.png（翻页=' + page2 + '）：' + menuTxt);

  var pass = info.wallLv === 8 && info.wallCell === info.idxW
    && trainInfo.ok && trainInfo.hasPop3 && menuTxt.indexOf('围墙') >= 0;
  console.log('核对项：wallLv=' + info.wallLv + ' wallCellOk=' + (info.wallCell === info.idxW)
    + ' trainOk=' + trainInfo.ok + ' hasPop3=' + trainInfo.hasPop3
    + ' menuWall=' + (menuTxt.indexOf('围墙') >= 0));
  console.log(pass ? '✓ 实机核对通过（围墙占格 Lv8 · 三段条 · 围墙卡片在册）' : '✗ 实机核对失败');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
