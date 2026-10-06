'use strict';
/* v89.145 + v89.146 实机验证 C（真浏览器 + 真布局）：老板 2 条 ——
   ① 商城"按 **4 行均分**高度填满"（v89.146 口径修正：**行高不随件数变** ——
      少件分类的行高 == 满页行高；不足 4 行的部分**留空**，不再把卡片拉满）
   ①' 商城购买数量无「最多」（−/＋ 仍在）
   ② 冻结：背包/商城**不整页滚**（#view-container 溢出 ≈0），
      只有物品区滚（.bag-body / .shop-rows 溢出可滚），顶部（排序条 / 分类条）位置不动
   跑法：node .workbuddy/tools/show/shot_v89145_scroll.js  */
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
  /* 矮窗口（1280×640）：让"内容 > 可用高度"真的发生，才能验"只有物品区滚" */
  var p = await b.newPage({ viewport: { width: 1280, height: 640 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局：把能塞的道具都塞进背包（材料页最满） ---------- */
  var seed = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验145', cityName: '许都', region: '碎垣', mapSeed: 20260945 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    st.items = st.items || {};
    var n = 0;
    (G.DATA.ITEMS || []).forEach(function (it) {
      st.items[it.id] = Math.max(st.items[it.id] || 0, it.type === 'material' ? 99 : 3);
      n++;
    });
    G.state.res.gold = Math.max(G.state.res.gold || 0, 5e7);
    G.ui.openBag('equip');
    G.ui.setBagTab && G.ui.setBagTab('treasure');
    if (G.ui.setBagSub) G.ui.setBagSub('material');
    return { items: n, sub: G.ui._bagSub, tab: G.ui._bagTab };
  });
  console.log('造局：道具 ' + seed.items + ' 种 · 背包 ' + seed.tab + '/' + seed.sub);
  await p.waitForTimeout(300);

  /* ================= ② 背包：顶部冻结 · 只滚物品区 ================= */
  console.log('===== ② 背包（材料页）：不整页滚 · 顶部排序条不动 =====');
  var m1 = await p.evaluate(function () {
    var G = window.GAME;
    var vc = document.getElementById('view-container');
    var body = vc.querySelector('.bag-page > .bag-body');
    var sort = vc.querySelector('.bag-sortbar');
    var chips = vc.querySelector('.bag-sub-chips, .bag-chips, .subtabs');
    if (body) body.scrollTop = 0;
    var top0 = sort ? Math.round(sort.getBoundingClientRect().top) : -1;
    var chipTop0 = chips ? Math.round(chips.getBoundingClientRect().top) : -1;
    if (body) body.scrollTop = 9999;                    /* 滚到底 */
    var top1 = sort ? Math.round(sort.getBoundingClientRect().top) : -1;
    var chipTop1 = chips ? Math.round(chips.getBoundingClientRect().top) : -1;
    return {
      vcOver: vc.scrollHeight - vc.clientHeight,
      bodyOver: body ? body.scrollHeight - body.clientHeight : -1,
      bodyTop: body ? Math.round(body.scrollTop) : -1,
      sort: [top0, top1], chip: [chipTop0, chipTop1],
      rows: vc.querySelectorAll('.bag-body .bag-cell').length,
      bodyH: body ? Math.round(body.getBoundingClientRect().height) : -1,
    };
  });
  console.log('  #view-container 溢出 ' + m1.vcOver + 'px · .bag-body 溢出 ' + m1.bodyOver
    + 'px（滚到 ' + m1.bodyTop + '）· 格子 ' + m1.rows + ' 个 · body 高 ' + m1.bodyH);
  console.log('  排序条 top: ' + JSON.stringify(m1.sort) + ' · 分类条 top: ' + JSON.stringify(m1.chip));
  chk('② 背包**不整页滚**（#view-container 溢出 ≤ 2px）', m1.vcOver <= 2, m1.vcOver + 'px');
  chk('② 物品区**自己滚**（.bag-body 溢出 ≥ 20px 且滚得动）',
    m1.bodyOver >= 20 && m1.bodyTop >= 20, 'over=' + m1.bodyOver + ' scrollTop=' + m1.bodyTop);
  chk('② 顶部**冻结**（排序条 / 分类条位置在滚动前后不动）',
    m1.sort[0] === m1.sort[1] && m1.sort[0] > 0 && m1.chip[0] === m1.chip[1],
    'sort ' + JSON.stringify(m1.sort) + ' chip ' + JSON.stringify(m1.chip));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89145-bag-scroll.png' });

  /* ================= ① 商城：行高 = "按 4 行均分"（满页铺满 · 少件留空）================= */
  console.log('===== ① 商城：少件分类的行高 == 满页行高（按 4 行均分 · 不是把卡片拉满）=====');
  /* 基准：满件分类（16 件 = 4 行 × 4 列）的**单行高** */
  var mFull = await p.evaluate(function () {
    var G = window.GAME;
    var all = G.ui.shopItems();
    var cats = G.ui.shopCatOf(all);
    var best = null;
    cats.forEach(function (g) {
      var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
      if (!best || n > best.n) best = { key: g.key, n: n };
    });
    G.ui.openShop(best.key);
    var vc = document.getElementById('view-container');
    var grid = vc.querySelector('.shop-rows');
    var row0 = grid ? grid.querySelector('.item-row') : null;
    return { key: best.key, n: best.n,
      rows: vc.querySelectorAll('.shop-rows .item-row').length,
      rowH: row0 ? Math.round(row0.getBoundingClientRect().height) : -1,
      gridH: grid ? Math.round(grid.getBoundingClientRect().height) : -1 };
  });
  await p.waitForTimeout(220);
  console.log('  基准（满件「' + mFull.key + '」' + mFull.n + ' 件）：渲染 ' + mFull.rows
    + ' 行 · 单行高 ' + mFull.rowH + 'px · 物品区高 ' + mFull.gridH + 'px');

  var m3 = await p.evaluate(function () {
    var G = window.GAME;
    var all = G.ui.shopItems();
    var cats = G.ui.shopCatOf(all);
    var small = null;
    cats.forEach(function (g) {
      var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
      if (n > 0 && (!small || n < small.n)) small = { key: g.key, n: n };
    });
    G.ui.openShop(small.key);
    var vc = document.getElementById('view-container');
    var page = vc.querySelector('.ui-page.shop-page');
    var grid = vc.querySelector('.shop-rows');
    var row0 = vc.querySelector('.shop-rows .item-row');
    return {
      small: small,
      rows: vc.querySelectorAll('.shop-rows .item-row').length,
      hasFill: !!(grid && grid.classList.contains('shop-fill')),
      gridH: grid ? Math.round(grid.getBoundingClientRect().height) : -1,
      pageH: page ? Math.round(page.getBoundingClientRect().height) : -1,
      rowH: row0 ? Math.round(row0.getBoundingClientRect().height) : -1,
    };
  });
  await p.waitForTimeout(250);
  console.log('  最少分类「' + m3.small.key + '」' + m3.small.n + ' 件 · 渲染 ' + m3.rows
    + ' 行 · 行高 ' + m3.rowH + 'px · 物品区高 ' + m3.gridH + ' / 页高 ' + m3.pageH);
  chk('① 少件分类（' + m3.small.n + ' 件）仍挂 shop-fill', m3.hasFill === true);
  chk('① 少件分类的**行高 == 满页行高**（按 4 行均分 · 行高不随件数变化）',
    m3.rowH > 0 && mFull.rowH > 0 && Math.abs(m3.rowH - mFull.rowH) <= 3,
    m3.rowH + 'px vs 满页 ' + mFull.rowH + 'px');
  chk('① 不足 4 行 → **下方留空**（行数×行高 < 物品区高 · 不再拉伸）',
    m3.rows < 4 && m3.rows * m3.rowH < m3.gridH - 10,
    m3.rows + '×' + m3.rowH + '=' + m3.rows * m3.rowH + ' < ' + m3.gridH);
  /* ⚠️ rows 是**卡片数**（16 件 = 4 行 × 4 列），行数要除以列数（4） */
  var fullGridRows = Math.ceil(mFull.rows / 4);
  chk('① 满页 4 行仍**铺满**（4×行高 + 3×行距 ≈ 物品区高）',
    Math.abs(fullGridRows * mFull.rowH - mFull.gridH) < 60,
    fullGridRows + ' 行 × ' + mFull.rowH + ' = ' + fullGridRows * mFull.rowH + ' vs ' + mFull.gridH);
  /* 全屏截图会被"画布 1440 宽 vs 视口 1280"水平裁掉左缘 —— 改**元素截图**（整卡） */
  await p.locator('#view-container .shop-rows .item-row').first()
    .screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89145-shop-fill.png' });

  /* ================= ①' 数量行无「最多」 ================= */
  var m4 = await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    return { max: vc.querySelectorAll('[data-action="qty-max"]').length,
             step: vc.querySelectorAll('[data-action="qty-step"]').length };
  });
  console.log('  数量行：−/＋ × ' + m4.step + ' · 「最多」× ' + m4.max);
  chk('①\' 商城购买数量行**没有「最多」**（−/＋ 仍在）', m4.max === 0 && m4.step > 0);

  /* ================= ②' 商城：不整页滚 · 分类条不动 ================= */
  /* ⚠️ 画布最小 1440×900（fitAppSize 的 min，见 main.js）——窗口再小画布也不缩，
     所以"4 行放不下"要用**画布高度**复现：把 --app-h 压到 620（1366×768 笔记本的观感）。
     只影响本段量测（背包段已量完）。 */
  await p.evaluate(function () {
    /* ⚠️ 不要派发 resize —— 那会触发 fitAppSize 把 --app-h 按 Math.max(900,…) 又写回 900 */
    document.documentElement.style.setProperty('--app-h', '620px');
  });
  await p.waitForTimeout(350);
  console.log('===== ②\' 商城（最满分类）：不整页滚 · 分类条不动 =====');
  var m2 = await p.evaluate(function () {
    var G = window.GAME;
    var all = G.ui.shopItems();
    var cats = G.ui.shopCatOf(all);
    var best = null;
    cats.forEach(function (g) {
      var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
      if (!best || n > best.n) best = { key: g.key, n: n };
    });
    G.ui.openShop(best.key);
    var vc = document.getElementById('view-container');
    var grid = vc.querySelector('.shop-rows');
    var catsEl = vc.querySelector('.shop-cats');
    if (grid) grid.scrollTop = 0;
    var catTop0 = catsEl ? Math.round(catsEl.getBoundingClientRect().top) : -1;
    if (grid) grid.scrollTop = 9999;
    var catTop1 = catsEl ? Math.round(catsEl.getBoundingClientRect().top) : -1;
    return {
      best: best, rows: vc.querySelectorAll('.shop-rows .item-row').length,
      vcOver: vc.scrollHeight - vc.clientHeight,
      gridOver: grid ? grid.scrollHeight - grid.clientHeight : -1,
      gridTop: grid ? Math.round(grid.scrollTop) : -1,
      cat: [catTop0, catTop1],
    };
  });
  await p.waitForTimeout(200);
  console.log('  最满分类「' + m2.best.key + '」' + m2.best.n + ' 件 · 渲染 ' + m2.rows + ' 行 · 物品区溢出 '
    + m2.gridOver + 'px（滚到 ' + m2.gridTop + '）· 整页溢出 ' + m2.vcOver + 'px');
  console.log('  分类条 top: ' + JSON.stringify(m2.cat));
  chk('②\' 商城**不整页滚**（#view-container 溢出 ≤ 2px）', m2.vcOver <= 2, m2.vcOver + 'px');
  chk('②\' 分类条**冻结**（位置在物品区滚动前后不动）',
    m2.cat[0] === m2.cat[1] && m2.cat[0] > 0, JSON.stringify(m2.cat));
  chk('②\' 物品区（满件分类）放不下时**自己滚**（画布 620：4×116 > 可用高）',
    m2.gridOver > 0 && m2.gridTop > 0, 'over=' + m2.gridOver + ' scrollTop=' + m2.gridTop);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89145-shop-scroll.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
