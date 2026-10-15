'use strict';
/* v89.141 实机验证（真浏览器）：城外 12 列 / 108 封顶 / 宝物右键批量 / 记录框上限 / 露天容量
   跑法：node .workbuddy/tools/show/shot_v89141_wide.js */
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
  p.on('requestfailed', function (rq) { errs.push('REQ_FAIL ' + rq.url()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260941 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 宝物（供批量小窗） */
    st.items = st.items || {};
    st.items.shennongchu = 7;
    st.items.zhenzhu = 3;
    return { cid: c.id };
  });
  await p.waitForTimeout(500);

  /* ============ ① 城外 12 列（Lv1 = 12 块 1 整行） ============ */
  console.log('===== ① 城外网格 12 列（Lv1 · 12 块 = 1 整行） =====');
  var v1 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    G.ui.setView('city');
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setExtCity ? null : null;
    /* 切到城外视图（extHTML 由 ui.setView('ext')？—— 走真实入口：城池视图的「城外」页） */
    if (G.ui.setExtView) G.ui.setExtView(true);
    var html = '';
    try { html = G.ui.extHTML(); } catch (e) { return { err: String(e) }; }
    var tiles = [];
    var re = /data-idx="(\d+)"[^>]*style="left:([-\d.]+)px;top:([-\d.]+)px/;
    var m, rx = /data-idx="(\d+)"[^>]*?style="left:([-\d.]+)px;top:([-\d.]+)px/g;
    while ((m = rx.exec(html)) !== null) tiles.push({ idx: +m[1], x: +m[2], y: +m[3] });
    var cap = G.extCap(c);
    return { cap: cap, gridN: (c.extGrid || []).length, tileN: tiles.length, tiles: tiles.slice(0, 24) };
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89141-ext12.png' });
  console.log('   ① 实况：' + JSON.stringify({ cap: v1.cap, gridN: v1.gridN, tileN: v1.tileN }));
  chk('① 官府 Lv1 → 上限 12 块（12 列 1 整行）', v1.cap === 12 && v1.tileN === 12 && !v1.err);
  (function () {
    if (!v1.tiles || !v1.tiles.length) return chk('① 12 块同一行（y 全等）', false, '无 tile');
    var ys = v1.tiles.map(function (t) { return t.y; });
    var xs = v1.tiles.map(function (t) { return t.x; });
    chk('① 12 块铺成 1 整行（y 全等且 x 递增 12 个不同值）',
      new Set(ys).size === 1 && new Set(xs).size === 12,
      'y=' + ys[0] + ' · x 数 ' + new Set(xs).size);
  })();

  /* ============ ② 官府 Lv27 → 108 块（12×9 整网格） ============ */
  console.log('===== ② 城外地块 12×9=108 封顶（官府 Lv27） =====');
  var v2 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var bk = G.buildingLevel(c, 'guanfu');
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 27; });
    var cap27 = G.extCap(c);
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 45; });
    var cap45 = G.extCap(c);
    /* ⚠️ 顺序：ensureExtGrid 必须在"官府=27"时跑（原版先恢复等级 → cap 回 12 → 只铺 12 块） */
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 27; });
    G.ensureExtGrid(c);
    var n = (c.extGrid || []).length;
    var html = G.ui.extHTML();
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = bk || 1; });
    var rows = {};
    var rx = /data-idx="(\d+)"[^>]*?style="left:([-\d.]+)px;top:([-\d.]+)px/g, m;
    while ((m = rx.exec(html)) !== null) { rows[+m[3]] = (rows[+m[3]] || 0) + 1; }
    var rowYs = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    return { cap27: cap27, cap45: cap45, gridN: n, rowN: rowYs.length,
      perRow: Object.values(rows).slice(0, 3), rowYs: rowYs.slice(0, 3) };
  });
  console.log('   ② 实况：' + JSON.stringify(v2));
  chk('② 官府 Lv27 → 108（到顶）· Lv45 → 仍 108（不再增加）', v2.cap27 === 108 && v2.cap45 === 108);
  chk('② 108 块铺成 12 列 × 9 行整网格', v2.gridN === 108 && v2.rowN === 9 && v2.perRow[0] === 12,
    '行数 ' + v2.rowN + ' · 每行 ' + v2.perRow.join('/'));
  /* 出「108 块整网格」图：把官府顶到 27 后截图 */
  await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    c.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 27; });
    G.ensureExtGrid(c);
    if (G.ui.setExtView) G.ui.setExtView(true);
    G.ui.renderView && G.ui.renderView(G.ui.view);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89141-ext108.png' });

  /* ============ ③ 宝物右键 → 批量小窗 ============ */
  console.log('===== ③ 宝物整叠（右键 → 批量小窗） =====');
  var v3 = await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('bag');
    G.ui.setBagTab ? G.ui.setBagTab('item') : null;
    return { ok: true };
  });
  await p.waitForTimeout(600);
  var v3b = await p.evaluate(function () {
    var G = window.GAME;
    var cell = document.querySelector('#view-container .bag-cell[data-bulk]') ||
      document.querySelector('.bag-cell[data-bulk]');
    return { found: !!cell, key: cell ? (cell.getAttribute('data-key') || '') : '' };
  });
  chk('③ 宝物页存在 data-bulk 格子（就地使用类）', v3b.found, v3b.key);
  if (v3b.found) {
    /* 真右键：直接派发 contextmenu（与浏览器右键同一条事件流 → 走 document 委托；
       playwright 的 button:'right' 在分页/滚动布局下偶尔点不到目标格）。 */
    await p.evaluate(function () {
      var cell = document.querySelector('.bag-cell[data-bulk="1"]');
      if (cell) cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    await p.waitForTimeout(500);
    var v3c = await p.evaluate(function () {
      var root = document.querySelector('#modal-root');
      var html = (root && root.innerHTML) || '';
      return { open: html.indexOf('bulk-q') >= 0, hasDo: html.indexOf('bulk-use-do') >= 0,
        hasMax: html.indexOf('最多') >= 0, title: (html.match(/批量使用[^<]*/) || [''])[0].slice(0, 24) };
    });
    chk('③ 右键 → 批量小窗打开（数量框 + 最多 + 执行键）', v3c.open && v3c.hasDo && v3c.hasMax,
      v3c.title);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89141-bulk.png' });
    /* 真用 3 个：点「最多」→ 改 3 → 执行 */
    var v3d = await p.evaluate(function () {
      var G = window.GAME;
      var inp = document.getElementById('bulk-q');
      if (inp) inp.value = '3';
      var before = (G.state.items.shennongchu || 0);
      var btn = document.querySelector('#modal-root [data-action="bulk-use-do"]');
      if (btn) btn.click();
      return { before: before, after: (G.state.items.shennongchu || 0) };
    });
    chk('③ 真批量使用：7 → 4（一次用 3 个）', v3d.before === 7 && v3d.after === 4,
      v3d.before + ' → ' + v3d.after);
  }

  /* ============ ④ 战场记录框（≤340px） ============ */
  console.log('===== ④ 战场记录框硬上限 340px =====');
  var v4 = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = G.currentCity();
    c.army = { yibing: 4000, changqiang: 3000, gongjian: 1500 };
    var gen = st.generals[0]; gen.status = 'idle'; gen.cityId = c.id;
    gen.energy = 200; gen.stamina = 200;
    /* 找一块 Lv8+ 野地（守将概率高、守军够多 → 多回合） */
    var xy = null;
    for (var yy = 3; yy < 200 && !xy; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        if (xx === c.x && yy === c.y) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(xx, yy) || (G.map.npcAt && G.map.npcAt(xx, yy))) continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : G.map.wildLevel(xx, yy);
        if (lv >= 8 && lv <= 10) { xy = { x: xx, y: yy, lv: lv }; break; }
      }
    }
    if (!xy) return { err: '无靶' };
    st.settings.battleSec = 600;
    var r = G.battle.expedition({ kind: 'wild', x: xy.x, y: xy.y }, 'raid',
      { yibing: 4000, changqiang: 3000, gongjian: 1500 }, gen.id);
    if (!r || !r.ok) return { err: 'exp: ' + JSON.stringify(r).slice(0, 100) };
    var ids = Object.keys(G._bsess || {});
    return { bid: ids[0], lv: xy.lv };
  });
  if (v4.err) { chk('④ 战场造局', false, v4.err); }
  else {
    await p.evaluate(function (bid) {
      window.GAME.ui.closeAllModals();
      window.GAME.ui.openBattlefield(bid);
    }, v4.bid);
    await p.waitForTimeout(600);
    for (var k = 0; k < 3; k++) {
      await p.evaluate(function () { var btn = document.querySelector('[data-action="bt-done"]'); if (btn) btn.click(); });
      await p.waitForTimeout(2400);
    }
    var v4b = await p.evaluate(function () {
      var log = document.getElementById('bt-log');
      if (!log) return { err: '无 bt-log' };
      var cs = getComputedStyle(log);
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      var wrap = document.getElementById('bt-wrap');
      return { h: Math.round(log.getBoundingClientRect().height), maxH: cs.maxHeight,
        wrapOver: wrap ? (wrap.scrollHeight - wrap.clientHeight) : -1,
        panelOver: panel ? (panel.scrollHeight - panel.clientHeight) : -1 };
    });
    console.log('   ④ 实况：' + JSON.stringify(v4b));
    chk('④ 记录框实际高 ≤ 340px（max-height 生效）', v4b.maxH === '340px' && v4b.h <= 341,
      'h=' + v4b.h + ' max=' + v4b.maxH);
    chk('④ 面板不溢出（下方空间不浪费也不裁切）', v4b.panelOver <= 4, 'panelOver ' + v4b.panelOver);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89141-bt340.png' });
  }

  /* ============ ⑤ 城外露天容量（并入仓容） ============ */
  console.log('===== ⑤ 城外露天容量（并入 storeCapOf） =====');
  var v5 = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = G.currentCity();
    /* 造 4 块已建地块：3×Lv1 + 1×Lv12 → 露天 = 30 万 */
    var g = G.extGridOf(c);
    /* ⚠️ 先整格清空：自建城有 initialExt 预置的 6 块已建地块（v89.93），
       不清空会让"露天容量"多算（实测多 1 级 = 多 2 万）。 */
    for (var i = 0; i < g.length; i++) g[i] = { id: 'e' + (i + 1), type: null, lv: 0 };
    g[0] = { id: 'e1', type: 'farm', lv: 1 };
    g[1] = { id: 'e2', type: 'forest', lv: 1 };
    g[2] = { id: 'e3', type: 'quarry', lv: 1 };
    g[3] = { id: 'e4', type: 'mine', lv: 12 };
    var ext = G.extStoreCapOf(c);
    var cap = G.storeCapOf(c);
    var lvSum = G.buildingLevelSum(c, 'cangku');
    var base = Math.round(2000000 * Math.max(1, lvSum)
      * (1 + (G.systems.techBonus ? G.systems.techBonus('store') : 0))
      * (1 + (G.mastery('storePct', c) || 0))
      * (1 + G.cityBonusNum(c, 'storePct')));
    return { ext: ext, cap: cap, base: base, diff: cap - base };
  });
  console.log('   ⑤ 实况：' + JSON.stringify(v5));
  chk('⑤ 露天容量 = 3×2万 + 12×2万 = 30 万（逐级线性）', v5.ext === 300000);
  chk('⑤ 总仓容 = 仓库部分 + 露天（纯加法·不吃加成）', v5.cap - v5.base === v5.ext,
    '总 ' + v5.cap + ' − 仓库 ' + v5.base + ' = ' + (v5.cap - v5.base));
  /* 仓库面板截图（仓容展示） */
  await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.openStore();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89141-store.png' });
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) { } });

  console.log('\n===== 汇总 =====');
  if (errs.length) console.log('⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 4).join(' | '));
  else console.log('· 无页面错误');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
