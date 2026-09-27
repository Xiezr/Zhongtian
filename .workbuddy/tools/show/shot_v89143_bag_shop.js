'use strict';
/* v89.143 实机验证（真浏览器）：背包宝物各分类统一 7 列 + 无「全部」；商城 4 行铺满
   跑法：node .workbuddy/tools/show/shot_v89143_bag_shop.js */
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
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260943 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._cityId = st.cities[0].id;
    /* 造点货：材料全员 + 几种宝物 + 图纸 + 装备 */
    (G.DATA.MATERIAL_IDS || []).forEach(function (m) { st.items[m] = 12; });
    st.items.shennongchu = 5; st.items.zhenzhu = 3; st.items.shanhu = 2;
    st.items.lingsui = 4;
    (G.DATA.BLUEPRINTS || []).slice(0, 3).forEach(function (bp) { st.items[bp.id] = 1; });
    G.addEquip('cr_head_1'); G.addEquip('cr_weapon_2');
  });
  await p.waitForTimeout(400);

  /* ============ ① 背包：分类条无「全部」 + 各分类都是 7 列 ============ */
  console.log('===== ① 背包宝物：无「全部」分类 + 各分类统一 7 列 =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('bag');
    G.ui._bagTab = 'treasure';
    var out = [];
    var subs = ['material', 'blueprint'].concat(Object.keys(G.ui.BAG_ITEM_CN || {}));
    subs.forEach(function (sub) {
      G.ui.setBagSub(sub);
      var vc = document.getElementById('view-container');
      var grid = vc.querySelector('.bag-grid');
      if (!grid) { out.push({ sub: sub, n: 0, cols: 0, rows: 0 }); return; }
      var cells = Array.prototype.slice.call(vc.querySelectorAll('.bag-cell'));
      /* 按 y 分组数行 */
      var ys = {};
      cells.forEach(function (c) {
        var y = Math.round(c.getBoundingClientRect().top);
        ys[y] = (ys[y] || 0) + 1;
      });
      var rowN = Object.keys(ys).length;
      var maxPerRow = Math.max.apply(null, Object.keys(ys).map(function (k) { return ys[k]; }));
      out.push({ sub: sub, n: cells.length, cols: maxPerRow, rows: rowN,
        gridCols: getComputedStyle(grid).gridTemplateColumns.split(' ').length });
    });
    /* 分类条的 chip 列表（含"全部"与否） */
    G.ui.setBagSub('material');
    var chips = Array.prototype.slice.call(document.querySelectorAll('#view-container .chip'))
      .map(function (c) { return c.textContent.trim(); });
    return { subs: out, chips: chips,
      subAll: (G.ui.bagSubChipsHTML() || '').indexOf('data-v="all"') >= 0,
      first: G.ui.bagSubFirstOf(), norm: G.ui.bagSubNorm('all') };
  });
  r1.subs.forEach(function (x) {
    console.log('   ' + x.sub.padEnd(12) + ' 格 ' + String(x.n).padStart(3) +
      ' · 行 ' + x.rows + ' · 每行最多 ' + x.cols + ' · CSS 列数 ' + x.gridCols);
  });
  console.log('   分类 chip：' + JSON.stringify(r1.chips));
  console.log('   首类=' + r1.first + ' · norm("all")=' + r1.norm + ' · 分类条含 all=' + r1.subAll);
  var matSub = r1.subs[0];
  chk('① 分类条**没有「全部」**（chip 里无"全部" · data-v="all" 不再渲染）',
    r1.chips.every(function (t) { return t.indexOf('全部') < 0; }) && !r1.subAll);
  chk('① 归一：norm("all") = 第一个有货分类（材料）', r1.norm === 'material');
  chk('① 材料页 = 7 列（CSS 列数 7 · 每行最多 7 格）', matSub.gridCols === 7 && matSub.cols <= 7);
  var itemSubs = r1.subs.slice(2);
  chk('① 宝物各子页**也是 7 列**（改前是 4 列 shop-rows —— 本次统一）',
    itemSubs.length > 0 && itemSubs.every(function (x) { return x.n === 0 || x.gridCols === 7; }),
    itemSubs.map(function (x) { return x.sub + ':' + x.gridCols; }).join(' '));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89143-bag-material.png' });
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setBagSub('material'); G.ui.setView('bag');
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89143-bag-material.png' });
  /* 宝物（物品）子页截图：找一个有货的类型 */
  await p.evaluate(function () {
    var G = window.GAME;
    var hit = null;
    Object.keys(G.ui.BAG_ITEM_CN || {}).forEach(function (ty) {
      if (!hit && G.ui.bagSubCountOf(ty) > 0) hit = ty;
    });
    G.ui.setBagSub(hit || 'material');
    G.ui.setView('bag');
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89143-bag-items.png' });

  /* ============ ② 商城：4 行铺满可视区 ============ */
  console.log('===== ② 商城：4 行铺满整个界面 =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openShop('material');
    var vc = document.getElementById('view-container');
    var box = vc.getBoundingClientRect();
    var rows = Array.prototype.slice.call(vc.querySelectorAll('.shop-rows .item-row'));
    var grid = vc.querySelector('.shop-rows');
    var gr = grid ? grid.getBoundingClientRect() : { height: 0 };
    var ys = {};
    rows.forEach(function (c) {
      var y = Math.round(c.getBoundingClientRect().top);
      ys[y] = (ys[y] || 0) + 1;
    });
    var rowKeys = Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
    var rowH = rowKeys.length >= 2 ? (rowKeys[1] - rowKeys[0]) : (rows[0] ? rows[0].getBoundingClientRect().height : 0);
    return { boxH: Math.round(box.height), gridH: Math.round(gr.height),
      rowsN: rowKeys.length, perRow: rowKeys.map(function (k) { return ys[k]; }),
      cellH: Math.round(rows[0] ? rows[0].getBoundingClientRect().height : 0),
      rowH: Math.round(rowH),
      fill: grid ? Math.round(gr.height / box.height * 100) : 0,
      hasFillCls: !!(grid && grid.className.indexOf('shop-fill') >= 0),
      pageCls: vc.querySelector('.ui-page').className };
  });
  console.log('   可视区 ' + r2.boxH + 'px · 物品区 ' + r2.gridH + 'px（占比 ' + r2.fill + '%）· ' +
    r2.rowsN + ' 行 · 每行 ' + JSON.stringify(r2.perRow) + ' · 单卡高 ' + r2.cellH + 'px');
  chk('② 商城页 = shop-page（满高 flex 列）', /shop-page/.test(r2.pageCls));
  chk('② 满页挂 shop-fill（4 行自适应铺满）', r2.hasFillCls && r2.rowsN === 4 && r2.perRow.every(function (n) { return n === 4; }));
  /* 可视区还含：页面内边距（28）+ 标题行 + 分类条 + 底部呼吸 —— 物品区拿到 ≥85% 即为"铺满"
     （改前 4 行 × 116 = 500px ≈ 56%，下面半屏空白）。 */
  chk('② 物品区高度 ≥ 可视区 85%（铺满 · 改前 ≈ 56%）', r2.fill >= 85, r2.fill + '%');
  chk('② 物品区高度 ≥ 700px（4 行真占满一屏）', r2.gridH >= 700, r2.gridH + 'px');
  chk('② 单卡高 > 116px（行高被拉满，不是写死的 116）', r2.cellH > 130, r2.cellH + 'px');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89143-shop-fill.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
