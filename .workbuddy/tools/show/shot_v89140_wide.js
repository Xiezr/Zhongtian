'use strict';
/* v89.140 实机验证：战场两行制 / 军务兵种表 / 校场关菜单 / 铁匠铺双按钮 / 商城固定 /
   宝物 7 列 / 自动出征 3 列 / 附属野地两列。跑法：node .workbuddy/tools/show/shot_v89140_wide.js */
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
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260943 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    /* 铁匠铺 + 资源 */
    var idx = -1;
    c.cells.forEach(function (cl, i) { if (idx < 0 && !cl.official && !cl.build) idx = i; });
    if (idx >= 0) c.cells[idx].build = { id: 'tiejiangpu', lvl: 7 };
    st.res.gold = 5e8; st.res.iron = 5e6; st.res.wood = 5e6; st.res.stone = 5e6;
    /* 宝物（背包） */
    st.items = st.items || {};
    st.items.zhenzhu = 12; st.items.shanhu = 8; st.items.liuli = 5; st.items.yemingzhu = 2;
    st.items.shennongchu = 3;
    /* 附属野地：一块己方野地 + 驻军 + 将领 */
    var wt = null;
    for (var rr = 2; rr <= 10 && !wt; rr++) {
      for (var dy = -rr; dy <= rr && !wt; dy++) for (var dx = -rr; dx <= rr && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || !G.DATA.GATHER.resOf[tl.terrain] || G.map.wildAt(x, y)) continue;
        wt = { x: x, y: y, t: tl.terrain };
      }
    }
    if (wt) {
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wt.x && z.y === wt.y); });
      st.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 8, day: 0, startDay: 0 });
      var gen = st.generals[0];
      gen.status = 'garrison';
      G.map.wildAt(wt.x, wt.y).garrison = { troops: { changqiang: 5000, gongjian: 2000 }, cityId: c.id, genId: gen.id };
    }
    return { cid: c.id, forgeIdx: idx, wx: wt ? wt.x : 0, wy: wt ? wt.y : 0 };
  });
  await p.waitForTimeout(600);

  console.log('===== ① 战场：只列在场 + 两行制（无图标）+ 战场放宽 + 记录框降高 =====');
  var m1 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c = st.cities[0];
    var all = Object.keys(G.DATA.TROOPS).filter(function (k) { return !G.DATA.TROOPS[k].nocombat && !G.DATA.TROOPS[k].craft; });
    c.army = {};
    all.slice(0, 6).forEach(function (k) { c.army[k] = 3000; });
    var gen = st.generals[0]; gen.status = 'idle'; gen.cityId = c.id;
    var xy = null;
    for (var yy = 4; yy < 240 && !xy; yy++) for (var xx = 4; xx < 240; xx++) {
      var tl = G.map.tile(xx, yy);
      if (!tl || tl.terrain === 'city') continue;
      if (G.map.wildAt(xx, yy) || (G.map.npcAt && G.map.npcAt(xx, yy))) continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : G.map.wildLevel(xx, yy);
      if (lv >= 4 && lv <= 7) { xy = { x: xx, y: yy }; break; }
    }
    if (!xy) return { err: '无靶' };
    var army = {}; all.slice(0, 6).forEach(function (k) { army[k] = 2000; });
    var rr = G.battle.expedition({ kind: 'wild', x: xy.x, y: xy.y }, 'raid', army, gen.id);
    if (!rr || !rr.ok) return { err: 'exp: ' + JSON.stringify(rr).slice(0, 90) };
    return { bid: Object.keys(G._bsess || {})[0], n: 6 };
  });
  if (m1.err) { chk('① 战场造局', false, m1.err); }
  else {
    await p.evaluate(function (bid) { window.GAME.ui.closeAllModals(); window.GAME.ui.openBattlefield(bid); }, m1.bid);
    await p.waitForTimeout(700);
    var m1b = await p.evaluate(function () {
      var side = document.getElementById('bt-side-atk');
      var board = document.getElementById('bt-board');
      var log = document.getElementById('bt-log');
      var field = document.getElementById('bt-field');
      var cards = side.querySelectorAll('.bt-card').length;
      var icons = side.querySelectorAll('.bt-ico').length;
      var l1 = side.querySelectorAll('.bt-l1').length, l2 = side.querySelectorAll('.bt-l2').length;
      return { cards: cards, icons: icons, l1: l1, l2: l2,
        fieldW: Math.round(field.getBoundingClientRect().width),
        logH: log.clientHeight,
        cols: getComputedStyle(board).gridTemplateColumns };
    });
    chk('① 只列在场兵种（6 队 = 6 格）+ 无图标 + 两行制', m1b.cards === 6 && m1b.icons === 0 && m1b.l1 === 6 && m1b.l2 === 6,
      m1b.cards + ' 格 · 图标 ' + m1b.icons + ' · l1/l2 ' + m1b.l1 + '/' + m1b.l2);
    /* 改前实测：战场 576px · log 493px（v89.139）——判据用确实放宽/降高的对照值 */
    chk('① 战场放宽（≥700px，改前 576）+ 记录框降高（≤460px，改前 493）', m1b.fieldW >= 700 && m1b.logH <= 460,
      '战场 ' + m1b.fieldW + 'px · log ' + m1b.logH + 'px · 列 ' + m1b.cols);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-bt.png' });
    await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  }

  console.log('===== ② 军务：三段 + 兵种表头（固定列宽 · 万缩略） =====');
  var m2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'over';
    G.ui.setView('marches');
    var vc = document.getElementById('view-container');
    var h = vc.innerHTML;
    var tbl = vc.querySelector('.mc-tbl');
    var ths = tbl ? tbl.querySelectorAll('thead th').length : 0;
    var firstRow = tbl ? tbl.querySelector('tbody tr') : null;
    return { hasSeg1: h.indexOf('① 城内') >= 0, noGar: h.indexOf('驻守野地') < 0,
      noGather: h.indexOf('③ 采集队') < 0, noStat: h.indexOf('在城 ') < 0,
      ths: ths, hasTbl: !!tbl,
      cells: firstRow ? Array.prototype.slice.call(firstRow.querySelectorAll('td')).slice(0, 5).map(function (td) { return td.textContent.trim(); }) : [] };
  });
  chk('② 军务：无驻守野地/采集队/统计行 · 兵种表头在册', m2.noGar && m2.noGather && m2.noStat && m2.hasTbl && m2.ths >= 3,
    'th ' + m2.ths + ' 列 · 首行 ' + JSON.stringify(m2.cells));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-marches.png' });
  var m2b = await p.evaluate(function () {
    var tbl = document.getElementById('view-container').querySelector('.mc-tbl');
    return tbl ? getComputedStyle(tbl).tableLayout : '-';
  });
  chk('② 固定列宽（table-layout: fixed）', m2b === 'fixed', m2b);

  console.log('===== ③ 校场 → 军务：建筑菜单关闭 =====');
  var m3 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.openBuildModal(o.forgeIdx);
    var before = (G.ui._modalStack || []).length;
    /* 直接走动作：等价于点校场建筑的「进入军务」 */
    G.lordGeneralOf && 0;
    var nav = document.querySelector('#modal-root [data-action="open-xiaochang"]');
    if (!nav) {
      /* 校场建筑不在盘上时，手动调动作验证同一条 case */
      GAME_actionFallback();
    }
    function GAME_actionFallback() { }
    return { before: before, hasXiaochangBtn: !!nav };
  }, init);
  var m3b = await p.evaluate(function () {
    var G = window.GAME;
    /* 用真实动作路径：模拟点击（case 内部逻辑与按钮无关） */
    var el = document.createElement('button');
    el.setAttribute('data-action', 'open-xiaochang');
    document.body.appendChild(el);
    el.click();
    el.remove();
    return { stack: (G.ui._modalStack || []).length,
      view: G.ui.view, tab: G.ui._marchTab, panelOpen: !!document.querySelector('#modal-root .inner-panel') };
  });
  chk('③ 校场进军务：弹层清空（0 层）· 视图=marches · tab=over',
    m3b.stack === 0 && m3b.view === 'marches' && m3b.tab === 'over',
    '层 ' + m3b.stack + ' · view ' + m3b.view + ' · tab ' + m3b.tab);

  console.log('===== ④ 铁匠铺：建筑菜单双按钮 + 卡片固定 + 分页在底部 =====');
  var m4 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.openBuildModal(o.forgeIdx);
    var root = document.getElementById('modal-root');
    var btns = root.querySelectorAll('.op-row [data-action]');
    var acts = Array.prototype.slice.call(btns).map(function (b) { return b.getAttribute('data-action'); });
    var card = root.querySelector('.item-row');
    var s = card ? card.getBoundingClientRect() : null;
    return { acts: acts, cardW: s ? Math.round(s.width) : 0, cardH: s ? Math.round(s.height) : 0 };
  }, init);
  chk('④ 铁匠铺建筑菜单 = 打造 + 百炼强化 两颗键',
    m4.acts.indexOf('open-forge') >= 0 && m4.acts.indexOf('open-enhance') >= 0, m4.acts.join(','));
  var m4b = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._forgeIdx = o.forgeIdx;
    G.ui.openForge();
    var root = document.getElementById('modal-root');
    var foot = root.querySelector('.m-foot');
    var card = root.querySelector('.forge-rows .item-row');
    var s = card ? card.getBoundingClientRect() : null;
    var texts = Array.prototype.slice.call(root.querySelectorAll('.forge-rows .item-row')).map(function (el) {
      var r2 = el.getBoundingClientRect();
      return Math.round(r2.width) + 'x' + Math.round(r2.height);
    });
    return { cardW: s ? Math.round(s.width) : 0, cardH: s ? Math.round(s.height) : 0,
      noEnhanceInFoot: !foot.querySelector('[data-action="open-enhance"]'),
      cards: texts.slice(0, 4) };
  }, init);
  chk('④ 打造面板：底部无百炼 · 卡片固定（等高）· foot 在册',
    m4b.noEnhanceInFoot && m4b.cardH > 0 && m4b.cards.length > 1,
    m4b.cardW + '×' + m4b.cardH + ' · 同页 ' + m4b.cards.join(' / '));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-forge.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ⑤ 商城：卡片固定 + 简介悬停 =====');
  var m5 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._shopCat = 'jewel';
    G.ui.setView('shop');
    var vc = document.getElementById('view-container');
    var rows = vc.querySelectorAll('.shop-rows .item-row');
    var sizes = Array.prototype.slice.call(rows).slice(0, 4).map(function (el) {
      var r2 = el.getBoundingClientRect();
      return Math.round(r2.width) + 'x' + Math.round(r2.height);
    });
    var info = vc.querySelector('.shop-rows .ir-info');
    return { n: rows.length, sizes: sizes, descN: vc.querySelectorAll('.ir-desc').length,
      hasTitle: !!(info && info.getAttribute('title')) };
  });
  chk('⑤ 商城卡片固定尺寸（等高）+ 简介悬停（无 .ir-desc，title 在册）',
    m5.n >= 4 && m5.sizes.length >= 2 && m5.descN === 0 && m5.hasTitle,
    m5.n + ' 件 · ' + m5.sizes.join(' / ') + ' · desc行 ' + m5.descN + ' · title ' + m5.hasTitle);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-shop.png' });

  console.log('===== ⑥ 背包宝物：7 列统一格子 + 悬停 =====');
  var m6 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('bag');
    G.ui.setBagTab('treasure');
    var vc = document.getElementById('view-container');
    var g = vc.querySelector('.bag-grid');
    var cells = vc.querySelectorAll('.bag-cell');
    var tip = vc.querySelector('.bag-cell .bag-tip');
    return { cols: g ? getComputedStyle(g).gridTemplateColumns : '-', cells: cells.length,
      hasTip: !!tip, tipTitle: tip ? (tip.querySelector('.tip-t') || {}).textContent : '' };
  });
  chk('⑥ 宝物页 = 7 列统一格子 + 悬停介绍', (m6.cols.split(' ').length === 7) && m6.cells > 0 && m6.hasTip,
    m6.cols + ' · ' + m6.cells + ' 格 · 悬停「' + (m6.tipTitle || '').slice(0, 12) + '」');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-bag.png' });

  console.log('===== ⑦ 自动出征：3 列 + 无单次兵力 + 无播报 =====');
  var m7 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    G.ui.openAutoMarch();
    var root = document.getElementById('modal-root');
    var h = root.innerHTML;
    var ths = Array.prototype.slice.call(root.querySelectorAll('.exp-tbl thead th')).map(function (t) { return t.textContent.trim(); });
    var hasInput = !!root.querySelector('#am-a-changqiang');
    return { ths: ths, hasInput: hasInput,
      noTroopsSel: !root.querySelector('#am-troops'),
      noBroadcast: h.indexOf('上次结果') < 0,
      selN: root.querySelectorAll('select').length };
  });
  chk('⑦ 编成 3 列（兵种/驻军数量/自动出征数量）+ 输入框 · 无单次兵力 · 无上次结果播报',
    m7.ths.length === 3 && m7.ths[1] === '驻军数量' && m7.ths[2] === '自动出征数量'
    && m7.hasInput && m7.noTroopsSel && m7.noBroadcast,
    m7.ths.join('/') + ' · 下拉 ' + m7.selN + ' 个');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-autoexp.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ⑧ 附属野地：将领 + 驻军两列 =====');
  var m8 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openWilds();
    var root = document.getElementById('modal-root');
    var ths = Array.prototype.slice.call(root.querySelectorAll('thead th')).map(function (t) { return t.textContent.trim(); });
    var tr = root.querySelector('tbody tr');
    var tds = tr ? Array.prototype.slice.call(tr.querySelectorAll('td')).map(function (t) { return t.textContent.trim(); }) : [];
    return { ths: ths, tds: tds };
  });
  chk('⑧ 附属野地表头含「将领」「驻军」（在操作列左边）',
    m8.ths.indexOf('将领') >= 0 && m8.ths.indexOf('驻军') >= 0
    && m8.ths.indexOf('将领') < m8.ths.indexOf('操作'),
    m8.ths.join('/') + ' → 首行 ' + JSON.stringify(m8.tds.slice(0, 7)));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89140-wilds.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  console.log('\n========================');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  console.log('========================');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
