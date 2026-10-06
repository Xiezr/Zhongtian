/* ============================================================
 * shot_v89106_bldg.js — 城内建筑配色实机截图（v89.106）
 * ------------------------------------------------------------
 * 出图：
 *   v89106-city-all.png      城内全景（16 座建筑一次看全 —— 分色是否"一眼分得出"）
 *   v89106-city-closeup.png  棋盘特写（1.6 倍放大，看清建筑本体颜色）
 *   v89106-build-menu.png    建造菜单（图标在面板底色上的观感）
 * 顺带量：每格挂的 ser-<族> 类名（结构证据）+ 图标是否都是位图
 * 用法：node .workbuddy/tools/show/shot_v89106_bldg.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });
/* 文件名前缀可换：`TAG=v89106before node ...` —— 用来出"同一场景、改色前"的对照图 */
var TAG = process.env.TAG || 'v89106';

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局 → 把 16 座建筑一座一格摆满（每族都能看见，才是"分色"的验收条件） */
  var info = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    var order = ['minfang', 'kezhan', 'cangku', 'majiu', 'shuyuan', 'zhaoxianguan',
      'junying', 'xiaochang', 'chengqiang', 'fenghuotai',
      'shichang', 'tiejiangpu', 'gongjiangzuofang', 'yizhan', 'honglusi'];
    var free = [];
    c.cells.forEach(function (x, i) { if (!x.official) free.push(i); });
    order.forEach(function (bid, k) {
      var idx = free[k];
      c.cells[idx].build = { id: bid, lvl: 1 + (k % 12) };
      c.cells[idx].pending = null;
    });
    G.ui.enterGame();
    G.ui.setView('city');
    G.refreshAll();
    /* 结构证据：逐格 ser-<族> + 是否位图 */
    var tiles = [];
    document.querySelectorAll('#view-container .iso-tile.built').forEach(function (el) {
      var cls = el.className.match(/ser-[a-z]+/);
      var img = el.querySelector('img.ico-img');
      var nm = el.querySelector('.tile-label .nm');
      tiles.push({
        ser: cls ? cls[0] : '-',
        name: nm ? nm.textContent : '?',
        bmp: !!img
      });
    });
    return { placed: order.length, tiles: tiles };
  });
  console.log('摆放建筑 ' + info.placed + ' 座；渲染出的地块：');
  info.tiles.forEach(function (t) { console.log('   ' + t.ser.padEnd(9) + t.name + (t.bmp ? '  [位图]' : '  [回退向量]')); });
  var bySer = {};
  info.tiles.forEach(function (t) { bySer[t.ser] = (bySer[t.ser] || 0) + 1; });
  console.log('族分布：' + JSON.stringify(bySer));

  await new Promise(function (r) { setTimeout(r, 500); });
  await page.screenshot({ path: path.join(OUT, TAG + '-city-all.png'), fullPage: false });
  console.log('✓ ' + TAG + '-city-all.png（城内全景）');

  /* 特写：只截棋盘，并放大 1.6 倍 —— 老板要看的是"建筑本体颜色" */
  await page.evaluate(function () {
    var el = document.querySelector('#view-container .city-iso');
    if (el) el.style.zoom = '1.6';
  });
  await new Promise(function (r) { setTimeout(r, 420); });
  var board = await page.$('#view-container .city-iso');
  if (board) {
    await board.screenshot({ path: path.join(OUT, TAG + '-city-closeup.png') });
    console.log('✓ ' + TAG + '-city-closeup.png（棋盘特写 · 1.6×）');
  }
  await page.evaluate(function () {
    var el = document.querySelector('#view-container .city-iso');
    if (el) el.style.zoom = '';
  });
  await new Promise(function (r) { setTimeout(r, 260); });

  /* 建造菜单：图标落在面板底色上（另一处会出现建筑图标的地方）
     入口与点地块同一条：main.js 的 `build-cell` → ui.openBuildModal(idx) */
  var menu = await page.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var idx = -1;
    c.cells.forEach(function (x, i) { if (!x.official && !x.build && idx < 0) idx = i; });
    G.ui.openBuildModal(idx);
    return { idx: idx };
  });
  console.log('   建造菜单入口 idx=' + menu.idx);
  await new Promise(function (r) { setTimeout(r, 420); });
  await page.screenshot({ path: path.join(OUT, TAG + '-build-menu.png'), fullPage: false });
  var cards = await page.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var n = root.querySelectorAll('.bldg-pick').length;
    var imgs = root.querySelectorAll('.bldg-pick img.ico-img').length;
    var pn = root.querySelector('.m-body') || root.querySelector('.inner-panel');
    return { cards: n, imgs: imgs, over: pn ? pn.scrollHeight - pn.clientHeight : -1 };
  });
  console.log('✓ ' + TAG + '-build-menu.png（建造菜单：' + cards.cards + ' 张卡片 / ' + cards.imgs
    + ' 张位图 / 纵向溢出 ' + cards.over + '）');

  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('截图失败：' + (e && e.message)); process.exit(1); });
