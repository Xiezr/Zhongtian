'use strict';
/* v89.142 实机验证（真浏览器）：城外地块 12×8（96）+ 中心扩散 + 暗格 + 铺满率对照
   跑法：node .workbuddy/tools/show/shot_v89142a_ext.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260942 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._cityId = st.cities[0].id;
  });
  await p.waitForTimeout(500);

  console.log('===== ① 铺满率对照：12×9 vs 12×8（同一窗口） =====');
  var fit = await p.evaluate(function () {
    var G = window.GAME;
    var s8 = G.ui.fitTile(12, 8, { pad: G.ui.WALL_PAD * 2 });
    var s9 = G.ui.fitTile(12, 9, { pad: G.ui.WALL_PAD * 2 });
    var M8 = G.ui.isoMetrics(12, 8), M9 = G.ui.isoMetrics(12, 9);
    G.ui.TILE_W = s8; G.ui.TILE_H = s8;                 /* 还原到 12×8 */
    var M8b = G.ui.isoMetrics(12, 8);
    return { s8: s8, s9: s9, w8: M8b.w, h8: M8b.h, w9: M9.w, h9: M9.h };
  });
  console.log('   12×8 格子 ' + fit.s8 + 'px · 棋盘 ' + fit.w8 + '×' + fit.h8 +
    '　|　12×9 格子 ' + fit.s9 + 'px · 棋盘 ' + fit.w9 + '×' + fit.h9);
  chk('① 12×8 格子边长 ≥ 12×9（同窗口更铺满）', fit.s8 >= fit.s9, 's8=' + fit.s8 + ' s9=' + fit.s9);

  function viewExt() {
    return p.evaluate(function () {
      var G = window.GAME;
      try { G.ui.closeAllModals(); } catch (e) { }
      G.ui.setView('ext');
      return 1;
    });
  }

  console.log('===== ② Lv1 → 12 块（中心扩散 + 84 暗格） =====');
  await viewExt();
  await p.waitForTimeout(450);
  var v1 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var html = G.ui.extHTML();
    var tiles = [], m;
    var rx = /data-idx="(\d+)"[^>]*?style="left:([-\d.]+)px;top:([-\d.]+)px/g;
    while ((m = rx.exec(html)) !== null) tiles.push({ idx: +m[1], x: +m[2], y: +m[3] });
    var lockedN = (html.match(/iso-tile locked/g) || []).length;
    var M = G.ui.isoMetrics(G.DATA.EXT_COLS, G.DATA.EXT_ROWS);
    var ord = G.extSlotOrder();
    var want0 = Math.round(M.x(ord[0].col, ord[0].row)) + ',' + Math.round(M.y(ord[0].col, ord[0].row));
    var got0 = tiles.length ? (tiles[0].x + ',' + tiles[0].y) : '-';
    return { cap: G.extCap(c), tileN: tiles.length, lockedN: lockedN, want0: want0, got0: got0,
      boardW: M.w, boardH: M.h };
  });
  console.log('   cap=' + v1.cap + ' · 亮格 ' + v1.tileN + ' · 暗格 ' + v1.lockedN +
    ' · 第 1 块 @' + v1.got0 + '（期望 ' + v1.want0 + '）· 棋盘 ' + v1.boardW + '×' + v1.boardH);
  chk('② Lv1：12 亮格 + 84 暗格（96 整网格）', v1.cap === 12 && v1.tileN === 12 && v1.lockedN === 84);
  chk('② 第 1 块落在中心位（extSlotOrder[0]）', v1.got0 === v1.want0);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-ext-lv1.png' });
  await p.locator('.iso-board').first().screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-board-lv1.png' });

  console.log('===== ③ Lv12 → 48 块（扩散中） =====');
  await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 12; });
    G.ensureExtGrid(c);
  });
  await viewExt();
  await p.waitForTimeout(450);
  var v2 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var html = G.ui.extHTML();
    var lockedN = (html.match(/iso-tile locked/g) || []).length;
    return { cap: G.extCap(c), gridN: c.extGrid.length, lockedN: lockedN };
  });
  console.log('   cap=' + v2.cap + ' · grid=' + v2.gridN + ' · 暗格 ' + v2.lockedN);
  chk('③ Lv12：48 亮格 + 48 暗格', v2.cap === 48 && v2.lockedN === 48);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-ext-lv12.png' });
  await p.locator('.iso-board').first().screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-board-lv12.png' });

  console.log('===== ④ 满级 → 96 块（12×8 铺满 · 零暗格） =====');
  await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 24; });
    G.ensureExtGrid(c);
    /* 顺手把前若干块建成农田/伐木场，让"满级铺满"的画面更有代表性 */
    var types = ['farm', 'forest', 'quarry', 'mine'];
    c.extGrid.forEach(function (e, i) { if (i < 60) { e.type = types[i % 4]; e.lv = 1 + (i % 6); } });
  });
  await viewExt();
  await p.waitForTimeout(450);
  var v3 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var html = G.ui.extHTML();
    var lockedN = (html.match(/iso-tile locked/g) || []).length;
    var builtN = (html.match(/iso-tile built/g) || []).length;
    return { cap: G.extCap(c), used: G.extUsed(c), lockedN: lockedN, builtN: builtN };
  });
  console.log('   cap=' + v3.cap + ' · 已建 ' + v3.used + ' · 亮格含建筑 ' + v3.builtN + ' · 暗格 ' + v3.lockedN);
  chk('④ 满级：96 亮格 · 零暗格 · 60 座建筑在册', v3.cap === 96 && v3.lockedN === 0 && v3.builtN === 60);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-ext-full.png' });
  await p.locator('.iso-board').first().screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-board-full.png' });

  console.log('===== ⑤ 暗格点击提示（ext-locked · 用新建 Lv1 城避免"已开垦地不缩容"） =====');
  var lockRes = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    /* ⚠️ ensureExtGrid 只增不减（已开垦的地不回收）—— 测暗格必须用**新造 Lv1 城**，
       不能把满级城的等级降回来（那样 grid 仍是 96，等于没有暗格）。 */
    var bx = G.currentCity().x - 3, by = G.currentCity().y + 3;
    if (!G.map.wildAt(bx, by)) st.wilds.push({ x: bx, y: by, type: 'plain', level: 2, day: 0 });
    G.buildCityAt(bx, by);
    var nc = st.cities[st.cities.length - 1];
    G.ui._cityId = nc.id;
    G.ui.setView('ext');
    var el = document.querySelector('.iso-tile.locked');
    if (!el) return { found: false };
    el.click();                                     /* 走全站委托 → case 'ext-locked' */
    var t = document.getElementById('toast');
    return { found: true, cap: G.extCap(nc), gridN: nc.extGrid.length, toast: t ? t.textContent : '' };
  });
  await p.waitForTimeout(200);
  console.log('   新建城 cap=' + lockRes.cap + ' grid=' + lockRes.gridN +
    ' · 点击暗格 → toast: ' + JSON.stringify(lockRes.toast));
  chk('⑤ 暗格点击给出解锁提示（含"官府升到 Lv2"）',
    lockRes.found && /官府升到 Lv2/.test(lockRes.toast || ''));

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
