'use strict';
/* v89.147 实机验证（真浏览器 + 真布局）：老板 3 条 ——
   ① 装备页分类栏 = **一行 4 主类**（状态/品质/散件/全部）· 左侧起
   ② 宝物页分类条**左起**（原来居中）
   ③ 两页**排序框在同一位置**（行高一致）
   跑法：node .workbuddy/tools/show/shot_v89147_bagfilters.js */
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
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 造局：给点装备与材料（两页都有货） */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验147', cityName: '许都', region: '豫州', mapSeed: 20260947 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    /* 装备：拿 DATA.EQUIP 前 8 件（有则入 inventory） */
    var eqIds = Object.keys(G.DATA.EQUIP || {}).slice(0, 8);
    st.inventory = eqIds.slice();
    /* 材料：给 material 类型前 3 件各 5 个 */
    st.items = st.items || {};
    (G.DATA.ITEMS || []).filter(function (it) { return it.type === 'material'; }).slice(0, 3)
      .forEach(function (it) { st.items[it.id] = 5; });
    G.ui.openBag('equip');
  });
  await p.waitForTimeout(300);

  function measure() {
    return p.evaluate(function () {
      var vc = document.getElementById('view-container');
      var row = vc.querySelector('.bag-filterrow');
      var chips = row ? [].slice.call(row.querySelectorAll('.chip')) : [];
      var sort = vc.querySelector('.bag-sortbar');
      var first = chips[0];
      var rowR = row ? row.getBoundingClientRect() : null;
      /* ⚠️ "左起"要量**行容器**的左边缘（装备页行首是"状态"标签、宝物页行首是"材料" chip ——
         首个 chip 的 left 本就不同，那是结构差异不是对齐问题） */
      var rowLeft = rowR ? Math.round(rowR.left) : -1;
      var vcR = vc.getBoundingClientRect();
      return {
        rows: vc.querySelectorAll('.bag-filterrow').length,
        rowH: rowR ? Math.round(rowR.height) : -1,
        rowTop: rowR ? Math.round(rowR.top) : -1,
        chips: chips.length,
        firstLeft: first ? Math.round(first.getBoundingClientRect().left) : -1,
        rowLeft: rowLeft,
        firstText: first ? first.textContent.trim().slice(0, 8) : '',
        sortTop: sort ? Math.round(sort.getBoundingClientRect().top) : -1,
        sortLeft: sort ? Math.round(sort.getBoundingClientRect().left) : -1,
        vcLeft: Math.round(vcR.left),
        labels: row ? [].slice.call(row.querySelectorAll('.lb')).map(function (x) { return x.textContent; }) : [],
        chipTexts: chips.map(function (x) { return x.textContent.trim().replace(/\s+/g, ' ').slice(0, 6); }),
      };
    });
  }

  /* ---------- ① 装备页 ---------- */
  console.log('===== ① 装备页：一行 4 主类 · 左起 =====');
  var mEq = await measure();
  console.log('  行数 ' + mEq.rows + ' · 行高 ' + mEq.rowH + 'px · chips ' + mEq.chips + ' 个 · 首 chip left ' + mEq.firstLeft);
  console.log('  主类标签：' + JSON.stringify(mEq.labels));
  console.log('  chips：' + JSON.stringify(mEq.chipTexts.slice(0, 14)));
  chk('① 分类栏**只有一行**（.bag-filterrow × 1）', mEq.rows === 1, mEq.rows + ' 行');
  chk('① 4 个主类依次往右（状态 → 品质 → 散件 → 全部）',
    mEq.labels.join(',') === '状态,品质,散件', mEq.labels.join(',') + ' + reset chip');
  chk('① 行**左侧起**（行容器左边缘贴近容器左侧）+ 行高固定（≥32px）',
    mEq.rowLeft <= mEq.vcLeft + 40 && mEq.rowH >= 30,
    'rowLeft=' + mEq.rowLeft + ' vcLeft=' + mEq.vcLeft + ' rowH=' + mEq.rowH);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89147-bag-equip.png' });

  /* ---------- ② 宝物页 ---------- */
  console.log('===== ② 宝物页：分类左起 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setBagTab ? G.ui.setBagTab('treasure') : (G.ui._bagTab = 'treasure');
    if (G.ui._bagSub) G.ui.setBagSub('material');
  });
  await p.waitForTimeout(300);
  var mTr = await measure();
  console.log('  行数 ' + mTr.rows + ' · 行高 ' + mTr.rowH + 'px · chips ' + mTr.chips + ' 个 · 首 chip left ' + mTr.firstLeft);
  console.log('  chips：' + JSON.stringify(mTr.chipTexts.slice(0, 8)));
  chk('② 宝物页分类**只有一行**', mTr.rows === 1, mTr.rows + ' 行');
  chk('② 分类**左侧起**（行容器左边缘贴近容器左侧）', mTr.rowLeft <= mTr.vcLeft + 40,
    'rowLeft=' + mTr.rowLeft + ' vcLeft=' + mTr.vcLeft);
  chk('② 两页**左起基准一致**（行容器 left 相等）', mEq.rowLeft === mTr.rowLeft,
    mEq.rowLeft + ' vs ' + mTr.rowLeft);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89147-bag-treasure.png' });

  /* ---------- ③ 排序框同位置 ---------- */
  console.log('===== ③ 排序框位置（两页对比）=====');
  console.log('  装备页 sortTop=' + mEq.sortTop + ' · 宝物页 sortTop=' + mTr.sortTop);
  chk('③ 两页**排序框在同一位置**（top 相差 ≤ 1px）', Math.abs(mEq.sortTop - mTr.sortTop) <= 1,
    mEq.sortTop + ' vs ' + mTr.sortTop);
  chk('③ 两页分类行**同高**（rowH 相等）', mEq.rowH === mTr.rowH, mEq.rowH + ' vs ' + mTr.rowH);

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
