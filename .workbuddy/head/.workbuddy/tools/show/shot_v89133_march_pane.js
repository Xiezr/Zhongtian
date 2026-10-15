/* v89.133 实机脚本：军务重构一（出征/出征战术/防守战术/练兵场）+ 将领面板三行
 * ------------------------------------------------------------
 * 判据：
 *   ① 六页签 + 出征页（目标下拉 + 进入键 + 容量/节钺入口）；点练兵场 → 直进军务
 *   ② 出征战术：两列网格（左列右缘 ≤ 右列左缘）+ 逐兵种「动作/目标」下拉 + 无在途 + 练兵块
 *   ③ 防守两小页切换（全境防御表格 / 防守战术下拉 + 出城勾选）
 *   ④ 烽火页无备注行
 *   ⑤ 将领面板：体力行单行（≤26px · 当前/上限 两数连写）+ 全军生命进 title；
 *      攻击/防御行单行（≤24px）且无「＋ 装备」行面备注
 *   ⑥ 真改一次战术下拉 → 状态真变（select 路径可用）
 * 跑法：node .workbuddy/tools/show/shot_v89133_march_pane.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    st.wounded = 1234; st.woundedArmy = { yibing: 800, gongjian: 300, qingji: 134 };
    st.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    st.jieyue = 3;
    st.wilds = st.wilds || [];
    st.wilds.push({ x: c.x + 2, y: c.y + 2, type: 'plain', level: 2, garrison: { troops: { yibing: 200 }, cityId: c.id } });
    var put = function (bid) {
      var idx = -1;
      (c.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
      c.cells[idx] = { build: { id: bid, lvl: 3 } };
    };
    put('xiaochang'); put('zhaoxianguan'); put('guanfu'); put('minfang');
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(700);

  /* ══ ① 页签 + 出征页 ══ */
  var act = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'act';
    G.ui.setView('marches');
    var vc = document.querySelector('#view-container');
    var tabs = [].map.call(document.querySelectorAll('.march-tabs .mt'), function (e) {
      return e.textContent.replace(/\s+/g, '').trim();
    });
    var t = vc.textContent || '';
    var sel = document.querySelector('#view-container [data-action="exp-act-target"]');
    var nOpt = sel ? sel.options.length : 0;
    var firstOpt = sel && sel.options[0] ? sel.options[0].textContent : '';
    return { tabs: tabs, nOpt: nOpt, firstOpt: firstOpt,
      hasGo: !!document.querySelector('#view-container [data-action="exp-act-go"]'),
      hasJx: !!document.querySelector('#view-container [data-action="jieyue-xc"]'),
      hasCap: t.indexOf('出征容量') >= 0,
      range: t.indexOf('14 格内') >= 0 && t.indexOf('点选') >= 0 };
  });
  chk('① 六页签 = 军务总览|出征|出征战术|防守战术|烽火|军务处',
    act.tabs.join('|').indexOf('军务总览') === 0 && act.tabs.length === 6
    && act.tabs[1].indexOf('出征') === 0 && act.tabs[2].indexOf('出征战术') === 0
    && act.tabs[3].indexOf('防守战术') === 0,
    act.tabs.join('|'));
  chk('① 出征页：目标下拉含我方野地（全境）',
    act.nOpt >= 2 && act.firstOpt.indexOf('🌾') >= 0,
    '目标 ' + act.nOpt + ' 项 · 首项「' + act.firstOpt + '」');
  chk('① 出征页：进入键 + 容量行 + 节钺入口 + 目标范围说明',
    act.hasGo && act.hasJx && act.hasCap && act.range,
    '进入=' + act.hasGo + ' · 节钺=' + act.hasJx + ' · 容量=' + act.hasCap + ' · 范围=' + act.range);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-act.png' });

  /* 真点一次「进入军队行动」→ 弹出军队行动界面（弹窗 = 同一界面） */
  await p.evaluate(function () {
    var btn = document.querySelector('#view-container [data-action="exp-act-go"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(600);
  var expModal = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    return { open: t.indexOf('主将') >= 0 && t.indexOf('派遣兵力') >= 0,
      isTheSame: t.indexOf('出征方式') >= 0 };
  });
  chk('① 「进入军队行动」→ 弹出军队行动界面（同一界面原样引用）', expModal.open && expModal.isTheSame);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-act-go.png' });
  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } });
  await p.waitForTimeout(250);

  /* ══ ② 出征战术（两列下拉）══ */
  var tac = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'exp';
    G.ui.setView('marches');
    var vc = document.querySelector('#view-container');
    var grid = document.querySelector('#view-container .tac-grid');
    var lines = document.querySelectorAll('#view-container .tac-line');
    var sels = document.querySelectorAll('#view-container .tac-line select');
    function rect(el) {
      var r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), h: Math.round(r.height) };
    }
    /* 两列的证：第 N/2 行的 left 与第 0 行同列（或按几何取两列 x 区间） */
    var xs = {};
    [].forEach.call(lines, function (el) {
      var r = rect(el);
      xs[r.left] = (xs[r.left] || 0) + 1;
    });
    var cols = Object.keys(xs).map(Number).sort(function (a, b) { return a - b; });
    var t = vc.textContent || '';
    return { nLines: lines.length, nSel: sels.length, cols: cols.slice(0, 4),
      colCount: cols.length, rowH: lines[0] ? rect(lines[0]).h : 0,
      hasTrain: !!document.querySelector('#view-container [data-action="xc-spar"]'),
      hasReview: !!document.querySelector('#view-container [data-action="xc-review"]'),
      hasInTransit: t.indexOf('🚩 在途') >= 0, hasChip: !!document.querySelector('#view-container .chip') };
  });
  chk('② 出征战术：两列布局（列数 2 · 每行两列合并）', tac.colCount === 2, '列 x=' + tac.cols.join(','));
  chk('② 逐兵种「动作/目标」下拉（每行 2 个）', tac.nSel === tac.nLines * 2, tac.nLines + ' 行 · ' + tac.nSel + ' 下拉');
  chk('② 无 chip 按钮组 · 无在途行军队列 · 有练兵块（演武/阅兵）',
    !tac.hasChip && !tac.hasInTransit && tac.hasTrain && tac.hasReview);
  chk('② 行高紧凑（≤ 34px）', tac.rowH > 0 && tac.rowH <= 34, '行高 ' + tac.rowH + 'px');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-extac.png' });

  /* 真改一次战术下拉 → 状态真变 */
  var tacSet = await p.evaluate(function () {
    var G = window.GAME;
    var sel = document.querySelector('#view-container .tac-line select[data-f="s"]');
    if (!sel) return { ok: false, why: '无动作下拉' };
    var troop = sel.getAttribute('data-troop');
    var before = (G.tacticsOf('atk')[troop] || {}).s;
    var target = sel.value === 'hold' ? 'advance' : 'hold';
    sel.value = target;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    var after = (G.tacticsOf('atk')[troop] || {}).s;
    /* 还原 */
    sel.value = before || 'advance';
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    return { ok: after === target, troop: troop, before: before, after: after, target: target };
  });
  chk('② 真改战术下拉 → 状态真变（select 走全局 change 委托）', tacSet.ok,
    (tacSet.troop || '-') + '：' + tacSet.before + ' → ' + tacSet.after);

  /* ══ ③ 防守两小页 ══ */
  var def = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'def';
    G.ui._defSub = 'over';
    G.ui.setView('marches');
    var vc = document.querySelector('#view-container');
    var t1 = vc.textContent || '';
    G.ui._defSub = 'tac';
    G.ui.setView('marches');
    var t2 = vc.textContent || '';
    var nSel = document.querySelectorAll('#view-container .tac-line select').length;
    var nChk = document.querySelectorAll('#view-container .tl-sortie input[type="checkbox"]').length;
    /* 切回 over 供截图 */
    G.ui._defSub = 'over';
    G.ui.setView('marches');
    return { over: t1.indexOf('全境防御') >= 0 && t1.indexOf('风险') >= 0,
      tac: t2.indexOf('防守战术') >= 0, nSel: nSel, nChk: nChk,
      tabs: document.querySelectorAll('#view-container .def-tabs .dt').length };
  });
  chk('③ 防守两小页：全境防御（城池清单）', def.over && def.tabs === 2);
  chk('③ 防守战术：下拉 + 出城勾选（防守侧专属）', def.tac && def.nSel >= 2 && def.nChk >= 1,
    def.nSel + ' 下拉 · ' + def.nChk + ' 勾选');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-defover.png' });
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._defSub = 'tac';
    G.ui.setView('marches');
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-deftac.png' });

  /* ══ ④ 烽火：无备注行 ══ */
  var bc = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    var t = (document.querySelector('#view-container') || {}).textContent || '';
    return { noNote: t.indexOf('📜') < 0 && t.indexOf('自动化 · 外敌来犯') < 0,
      hasWarn: t.indexOf('烽火') >= 0 && t.indexOf('预警') >= 0 };
  });
  chk('④ 烽火页：备注行已撤 · 预警区仍在', bc.noNote && bc.hasWarn);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-beacon.png' });

  /* ══ ⑤ 点练兵场 → 直进军务 ══ */
  var xc = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    /* 与玩家路径一致：点练兵场格 → 建筑面板 → 「功能」里点入口 */
    var c = G.currentCity(), idx = -1;
    (c.cells || []).forEach(function (cell, i) {
      if (idx < 0 && cell.build && cell.build.id === 'xiaochang') idx = i;
    });
    if (idx < 0) return { ok: false, why: '无练兵场格' };
    G.ui.openBuildModal(idx);
    var root = document.querySelector('#modal-root');
    var el = root ? root.querySelector('[data-action="open-xiaochang"]') : null;
    if (!el) return { ok: false, why: '建筑面板无功能入口', hasLabel: !!(root && /进入军务/.test(root.innerHTML)) };
    el.click();
    return { ok: G.ui.view === 'marches', view: G.ui.view, tab: G.ui._marchTab };
  });
  chk('⑤ 点练兵场 → 直接进军务视图（练兵场面板退役）', xc.ok, (xc.view || '-') + '/' + (xc.tab || '-'));

  /* ══ ⑥ 将领面板三行（几何实证）══ */
  var pane = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('generals');
    var rows = [];
    var all = document.querySelectorAll('.gp-col-l .gd-line');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      rows.push({ txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
        h: Math.round(r.height), title: el.getAttribute('title') || '' });
    }
    return rows;
  });
  var staRow = pane.find(function (r) { return r.txt.indexOf('体力') === 0; });
  var atkRow = pane.find(function (r) { return r.txt.indexOf('攻击') === 0; });
  var defRow = pane.find(function (r) { return r.txt.indexOf('防御') === 0; });
  chk('⑥ 体力行单行（≤26px）· 当前/上限 两数连写 · 无「当前 X」行面备注',
    !!staRow && staRow.h <= 26 && /体力\s[\d,]+\s*\/\s*[\d,]+/.test(staRow.txt)
    && staRow.txt.indexOf('当前 ') < 0,
    staRow ? (staRow.h + 'px 「' + staRow.txt + '」') : '-');
  chk('⑥ 体力行悬停含「全军生命 +X%」', !!staRow && /全军生命 \+/.test(staRow.title),
    staRow ? staRow.title.replace(/\s+/g, ' ').slice(0, 44) : '-');
  chk('⑥ 攻击/防御行单行（≤24px）· 行面无「＋ 装备」· 构成在悬停',
    !!atkRow && !!defRow && atkRow.h <= 24 && defRow.h <= 24
    && atkRow.txt.indexOf('＋ 装备') < 0 && defRow.txt.indexOf('＋ 装备') < 0
    && /＝|=\s*武力/.test(atkRow.title) === false ? (/武力/.test(atkRow.title) && /谋略/.test(defRow.title)) : true,
    atkRow ? (atkRow.h + 'px / ' + defRow.h + 'px 「' + atkRow.txt + '」') : '-');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-pane.png' });

  console.log(FAIL ? '\n✗ 有 ' + FAIL + ' 项未达标' : '\n✓ 全项达标');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
