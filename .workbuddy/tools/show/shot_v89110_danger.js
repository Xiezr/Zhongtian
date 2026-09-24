/* ============================================================
 * shot_v89110_danger.js — v89.110 实机图：危险动作两段式
 * ------------------------------------------------------------
 * MODE=before → 只出「改前」的兵营面板一张（解散紧挨训练，复现老板指出的问题）
 * 默认        → 四张：兵营面板（危险区）/ 解散确认 / 拆解确认 / 取消建造确认
 * 实机量：训练与解散的**行距**（getBoundingClientRect）、弹窗纵向溢出、确认文案
 * 跑法：
 *   MODE=before TAG=v89110before node .workbuddy/tools/show/shot_v89110_danger.js
 *   node .workbuddy/tools/show/shot_v89110_danger.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });
var MODE = process.env.MODE === 'before' ? 'before' : 'after';
var TAG = process.env.TAG || (MODE === 'before' ? 'v89110before' : 'v89110');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-headless-shell-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; st.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = c.army || {};
    Object.keys(G.DATA.TROOPS).forEach(function (tid) { c.army[tid] = 300; });
    var free = [];
    (c.cells || []).forEach(function (x, i) { if (!x.build && !x.official) free.push(i); });
    if (free.length < 2) return { ok: false };
    c.cells[free[0]].build = { id: 'junying', lvl: 4 };   /* 面板用的军营 */
    st.inventory = st.inventory || [];
    st.inventory.push('cr_weapon_1');                     /* 拆解场景用的一件装备 */
    G.ui.enterGame();
    G.refreshAll();
    return { ok: true, cellA: free[0], cellB: free[1] };
  });
  if (!boot.ok) { console.error('摆场景失败（空地不足）'); process.exit(1); }
  console.log('开局：城 1 · 军营格 ' + boot.cellA + ' · 建造格 ' + boot.cellB);

  /* ① 兵营面板 */
  var m1 = await page.evaluate(function (cellA) {
    var G = window.GAME;
    G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf';
    G.ui._trainCount = 40;
    G.ui.openTroops(cellA, 'normal');
    var root = document.querySelector('#modal-root');
    var dn = root.querySelector('[data-action="troop-disband-ask"]') || root.querySelector('[data-action="troop-disband"]');
    var tr = root.querySelector('[data-action="confirm-train"]');
    var zone = root.querySelector('.op-zone.danger');
    var ip = root.querySelector('.inner-panel');
    var r1 = tr ? tr.getBoundingClientRect() : null;
    var r2 = dn ? dn.getBoundingClientRect() : null;
    if (dn && dn.dataset) window.__selT = dn.dataset.troop || null;
    return {
      hasAsk: !!root.querySelector('[data-action="troop-disband-ask"]'),
      hasBare: !!root.querySelector('[data-action="troop-disband"]'),
      zone: !!zone,
      /* DOM 结构判据（比像素稳）：同容器 = 同一操作行；紧邻兄弟 = 就在训练旁边 */
      sameParent: (dn && tr) ? (dn.parentElement === tr.parentElement) : null,
      adjacent: (dn && tr) ? (tr.previousElementSibling === dn) : null,
      rowGap: (r1 && r2) ? Math.round(r2.top - r1.bottom) : null,
      dnRect: r2 ? Math.round(r2.left) + ',' + Math.round(r2.top) : null,
      trRect: r1 ? Math.round(r1.left) + ',' + Math.round(r1.top) : null,
      overflow: ip ? (ip.scrollHeight - ip.clientHeight) : null,
    };
  }, boot.cellA);
  await new Promise(function (r) { setTimeout(r, 320); });
  await page.screenshot({ path: path.join(OUT, TAG + '-troops-danger.png') });
  console.log('✓ ' + TAG + '-troops-danger.png（危险区 ' + m1.zone + ' · ask ' + m1.hasAsk + ' · 裸入口 ' + m1.hasBare
    + ' · 同容器 ' + m1.sameParent + ' · 紧邻训练 ' + m1.adjacent
    + ' · 解散@' + m1.dnRect + ' 训练@' + m1.trRect + ' · 溢出 ' + m1.overflow + '）');

  if (MODE === 'before') {
    var okB = m1.hasBare === true && m1.sameParent === true && m1.adjacent === true;
    console.log(okB ? '\n[before] 复现改前形态：解散与训练**同容器且紧邻**（就差一个点错的指头）'
      : '\n⚠ [before] 未复现改前形态');
    await browser.close();
    process.exit(okB ? 0 : 1);
  }

  /* ② 解散确认弹窗（点 ask） */
  var m2 = await page.evaluate(function () {
    var G = window.GAME;
    var b = document.querySelector('#modal-root [data-action="troop-disband-ask"]');
    if (b) b.click();
    var root = document.querySelector('#modal-root');
    var tx = root.textContent || '';
    var ip = root.querySelector('.inner-panel');
    return { open: !!root.querySelector('[data-action="troop-disband-do"]'),
      hasBack: tx.indexOf('归农返还') >= 0, hasNoRefund: tx.indexOf('不退') >= 0,
      hasIrrev: tx.indexOf('不可撤销') >= 0,
      overflow: ip ? (ip.scrollHeight - ip.clientHeight) : null };
  });
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, TAG + '-disband-confirm.png') });
  console.log('✓ ' + TAG + '-disband-confirm.png（do 按钮 ' + m2.open + ' · 归农返还 ' + m2.hasBack
    + ' · 军资不退 ' + m2.hasNoRefund + ' · 不可撤销 ' + m2.hasIrrev + ' · 溢出 ' + m2.overflow + '）');

  /* ③ 取消解散 → 兵力不变（误触保护）；随后打开拆解确认 */
  var m3 = await page.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var sel = window.__selT;
    var n0 = (c.army && c.army[sel]) || 0;
    document.querySelector('#modal-root [data-action="close-modal"]').click();
    var n1 = (c.army && c.army[sel]) || 0;
    /* 拆解：打开装备详情 → 点拆解回收 → 确认弹窗 */
    G.ui.openEquipDetail('cr_weapon_1');
    var before = (G.state.inventory || []).length;
    var ask = document.querySelector('#modal-root [data-action="salvage-equip-ask"]');
    if (ask) ask.click();
    var root = document.querySelector('#modal-root');
    var tx = root.textContent || '';
    var ip = root.querySelector('.inner-panel');
    var after = (G.state.inventory || []).length;
    return { cancelKept: n1 === n0 && n0 > 0, sel: sel, n0: n0,
      salvageOpen: !!root.querySelector('[data-action="salvage-equip-do"]'),
      hasIrrev: tx.indexOf('不可撤销') >= 0,
      notYetGone: after === before,
      overflow: ip ? (ip.scrollHeight - ip.clientHeight) : null };
  });
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, TAG + '-salvage-confirm.png') });
  console.log('✓ ' + TAG + '-salvage-confirm.png（取消不损兵 ' + m3.cancelKept + '(' + m3.sel + '=' + m3.n0
    + ') · 拆解确认 ' + m3.salvageOpen + ' · 未销毁 ' + m3.notYetGone + ' · 溢出 ' + m3.overflow + '）');

  /* ④ 取消建造确认（真起一个工程 → 点取消 → 确认弹窗） */
  var m4 = await page.evaluate(function (cellB) {
    var G = window.GAME;
    document.querySelector('#modal-root [data-action="close-modal"]').click();
    var c = G.currentCity();
    var r = G.buildAt(c.id, cellB, 'minfang');
    G.ui.openBuildModal(cellB);
    var ask = document.querySelector('#modal-root [data-action="cancel-build-ask"]');
    if (ask) ask.click();
    var root = document.querySelector('#modal-root');
    var tx = root.textContent || '';
    var ip = root.querySelector('.inner-panel');
    return { buildOk: !!(r && r.ok), ask: !!ask,
      open: !!root.querySelector('[data-action="cancel-build-do"]'),
      hasRule: tx.indexOf('不返还') >= 0,
      total: ((tx.match(/返还/) || []).length > 0),
      overflow: ip ? (ip.scrollHeight - ip.clientHeight) : null };
  }, boot.cellB);
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, TAG + '-cancelbuild-confirm.png') });
  console.log('✓ ' + TAG + '-cancelbuild-confirm.png（工程已起 ' + m4.buildOk + ' · ask ' + m4.ask
    + ' · do 按钮 ' + m4.open + ' · 写清不返还 ' + m4.hasRule + ' · 溢出 ' + m4.overflow + '）');

  var ok = m1.hasAsk && !m1.hasBare && m1.zone && m1.sameParent === false && m1.adjacent === false
    && (m1.rowGap || 0) > 6
    && m2.open && m2.hasBack && m2.hasNoRefund
    && m3.cancelKept && m3.salvageOpen && m3.notYetGone
    && m4.buildOk && m4.open && m4.hasRule
    && m1.overflow <= 0 && m2.overflow <= 0 && m3.overflow <= 0 && m4.overflow <= 0;
  console.log(ok ? '\n全部实机判据通过（解散已与训练分容器/分行 · 三个确认弹窗齐 · 弹窗零溢出 · 取消不损兵/不销毁）'
    : '\n⚠ 有判据未过，请查看上方');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('脚本异常：', e); process.exit(1); });
