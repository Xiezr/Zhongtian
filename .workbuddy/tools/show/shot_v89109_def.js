/* ============================================================
 * shot_v89109_def.js — v89.109 实机图（五条需求的核心场景）
 *   ① 军务 · 出征页 = **出征战术**（全兵种 × 动作 × 目标）
 *   ② 军务 · 防守页 = 体检 + **防守战术**（含「🏇 出城迎战」开关）
 *   ③ 公文 · 战报页：**防御战报**在列（🛡 守土 / 💥 城破）
 *   ④ 防御战报详情：正文（回合/工事/野战军）+ 回放区
 * 顺带量：防守页 sortie chip 的 on 数、战报 type/replay 帧、详情含"回合"
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
    c.army = { yibing: 300, changqiang: 200, gongjian: 150 };
    c.wallLv = 6;
    /* 二城：撑"全境战力"（来袭规模按它缩放），守军不参战 */
    var w = null;
    for (var r = 1; r <= 6 && !w; r++) {
      for (var dx = -r; dx <= r && !w; dx++) for (var dy = -r; dy <= r && !w; dy++) {
        var t = G.map.tile(c.x + dx, c.y + dy);
        if (!t || t.terrain !== 'plain') continue;
        if (st.cities.some(function (x2) { return x2.x === c.x + dx && x2.y === c.y + dy; })) continue;
        w = { x: c.x + dx, y: c.y + dy };
      }
    }
    if (w) {
      st.wilds = (st.wilds || []).filter(function (x2) { return !(x2.x === w.x && x2.y === w.y); });
      st.wilds.push({ x: w.x, y: w.y, type: 'plain', lv: 3 });
      var b = G.buildCityAt(w.x, w.y);
      if (b && b.ok) b.city.army = { yibing: 3000 };
    }
    /* 出征战术：两个示范（专拆工事 / 防御对射） */
    G.setTactic('atk', 'toudan', { s: 'advance', t: '_tower' });
    G.setTactic('atk', 'gongjian', { s: 'hold', t: 'daodun' });
    /* 防守战术：两个出城迎战 + 一个固守 */
    G.setTactic('def', 'changqiang', { s: 'advance', t: '', sortie: true });
    G.setTactic('def', 'qingji', { s: 'advance', t: '', sortie: true });
    G.setTactic('def', 'gongjian', { s: 'hold', t: '', sortie: false });
    G.ui.enterGame();
    G.refreshAll();
    /* 真触发一次来袭（v89.111：先初始化排期，再拨到当日 9:01 → 结算当天那一场并写战报。
       首 tick 只排期不结算 = 设计内的宽限：新局/新解锁不会"上来就挨打"。） */
    st.world = st.world || {};
    st.world.elapsed = 0;
    G.invasionTick(0);
    st.world.elapsed = G.invasionDueOfDay(0) + 60;
    var fired = G.invasionTick(1);
    var rep = (st.reports || [])[0] || null;
    return {
      cities: st.cities.length, fired: fired,
      repType: rep ? rep.type : '(none)',
      repTitle: rep ? rep.title : '',
      replayLen: rep && rep.replay ? JSON.stringify(rep.replay).length : 0,
      defSummary: G.tacticSummary('def'),
      atkSummary: G.tacticSummary('atk'),
    };
  });
  console.log('开局：' + boot.cities + ' 城 · 来袭结算 ' + boot.fired + ' 次 · 战报「' + boot.repTitle
    + '」(' + boot.repType + ') · replay ' + boot.replayLen + 'B');
  console.log('  防守战术摘要：' + boot.defSummary + '　|　出征战术摘要：' + boot.atkSummary);

  /* ① 军务·出征页 */
  var m1 = await page.evaluate(function () {
    GAME.ui._marchTab = 'exp';
    GAME.ui.setView('marches');
    var bc = document.querySelectorAll('#view-container .tac-block').length;
    var hasSortie = document.querySelectorAll('#view-container [data-f="sortie"]').length;
    return { blocks: bc, sortie: hasSortie };
  });
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, 'v89109-march-exp.png') });
  console.log('✓ v89109-march-exp.png（战术块 ' + m1.blocks + ' 个 · 出征侧无出城开关：' + (m1.sortie === 0) + '）');

  /* ② 军务·防守页（含出城迎战开关） */
  var m2 = await page.evaluate(function () {
    GAME.ui._marchTab = 'def';
    GAME.ui.setView('marches');
    var chips = document.querySelectorAll('#view-container [data-f="sortie"]');
    var on = 0;
    chips.forEach(function (c) { if (c.classList.contains('on')) on++; });
    return { chips: chips.length, on: on };
  });
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, 'v89109-march-def.png') });
  console.log('✓ v89109-march-def.png（出城迎战开关 ' + m2.chips + ' 个 · 已开 ' + m2.on + ' 个）');

  /* ③ 公文·战报页（防御战报在列） */
  var m3 = await page.evaluate(function () {
    GAME.ui._docTab = 'war';
    GAME.ui.setView('reports');
    var tx = document.querySelector('#view-container').textContent || '';
    return { hasDef: /守土|城破/.test(tx), rows: document.querySelectorAll('#view-container [data-action="view-report"]').length };
  });
  await new Promise(function (r) { setTimeout(r, 280); });
  await page.screenshot({ path: path.join(OUT, 'v89109-report-list.png') });
  console.log('✓ v89109-report-list.png（战报行 ' + m3.rows + ' 条 · 含防御战报：' + m3.hasDef + '）');

  /* ④ 防御战报详情（正文 + 回放） */
  var m4 = await page.evaluate(function () {
    var rows = document.querySelectorAll('#view-container [data-action="view-report"]');
    if (rows.length) rows[0].click();
    var root = document.querySelector('#modal-root');
    var tx = root ? (root.textContent || '') : '';
    return { opened: !!root && tx.length > 30, hasRounds: /回合/.test(tx), hasTower: /工事|城墙/.test(tx) };
  });
  await new Promise(function (r) { setTimeout(r, 300); });
  await page.screenshot({ path: path.join(OUT, 'v89109-report-detail.png') });
  console.log('✓ v89109-report-detail.png（详情打开 ' + m4.opened + ' · 含回合 ' + m4.hasRounds + ' · 含工事 ' + m4.hasTower + '）');

  var ok = m1.blocks >= 10 && m1.sortie === 0 && m2.chips >= 10 && m2.on === 2
    && m3.hasDef && m4.opened && m4.hasRounds;
  console.log(ok ? '\n全部实机判据通过（两页战术 / 出城开关 2 开 / 防御战报 / 详情回合）'
    : '\n⚠ 有判据未过，请查看上方');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('脚本异常：', e); process.exit(1); });
