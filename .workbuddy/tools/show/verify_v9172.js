'use strict';
/* v91.72 实机验收：B 期蓝图 + 本批 UI/系统改动 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = 'E:/Deepseekdb/.workbuddy/tmp/shots_v9172/';
(async function () {
  var fs = require('fs');
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win32/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  var boot = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    G.ui.setView('city');
    var c = st.cities[0];
    st.res.grain = 9e7; st.res.wood = 9e7; st.res.stone = 9e7; st.res.iron = 9e7; st.res.gold = 9e7;
    /* 建一座主城 + 一座分城，装好关键建筑 */
    st.mainCityId = c.id;
    ['shuyuan', 'tiejiangpu', 'junying', 'gongjiangzuofang', 'honglusi', 'cangku', 'shichang', 'guanfu', 'xiaochang'].forEach(function (bid) {
      for (var i = 0; i < c.cells.length; i++) {
        if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: bid, lvl: 10 }; return; }
      }
    });
    var c2 = G.makeCity({ id: 'p2', name: '分城', x: c.x + 3, y: c.y, type: 'self' });
    st.cities.push(c2);
    return { cities: st.cities.length, main: st.mainCityId };
  });
  console.log('BOOT', JSON.stringify(boot));

  /* ===== ① 空间站蓝图 ===== */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    st.items = st.items || {};
    st.items.w_stariron = 100;
    st.items.bp_ship_c_w1 = 1;
    st.station = { lv: 9, ships: [], _seq: 0 };
    G.ui.setView('station');
    var h = document.querySelector('#view-container').innerHTML;
    return {
      bpTotal: /舰船蓝图 <b>1 \/ 12<\/b>/.test(h.replace(/<[^>]+>/g, '')),
      hasBpMark: h.indexOf('📜已持有') >= 0,
      missMark: h.indexOf('📜缺蓝图') >= 0,
      canBuildNoBp: G.ship.canBuild('c_g1').ok === false,
      canBuildBp: G.ship.canBuild('c_w1').ok === true
    };
  });
  console.log('STATION', JSON.stringify(r1));
  await p.screenshot({ path: OUT + 'station.png' });

  /* ===== ② 背包宝物「售」 + 舰船蓝图分类 ===== */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.state.items.bengzhu = 5;
    G.ui.setView('bag');
    G.ui._bagTab = 'treasure'; G.ui._bagSub = 'jewel';
    G.ui.renderBag();
    var h = document.querySelector('#view-container').innerHTML;
    return { sellBadge: h.indexOf('item-sell-ask') >= 0, sellAct: typeof G.ui.openItemSellAsk === 'function' };
  });
  console.log('BAG', JSON.stringify(r2));

  /* ===== ③ 战储仓压缩 ===== */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.state.res.grain = 12000000;
    G.ui.openStore();
    var h = document.querySelector('#modal-root').innerHTML;
    return { compressBtn: h.indexOf('store-compress-ask') >= 0, note: h.indexOf('空间压缩') >= 0 };
  });
  console.log('STORE', JSON.stringify(r3));
  await p.screenshot({ path: OUT + 'store.png' });
  var r3b = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var c = G.currentCity();
    G.state.res.grain = 12000000;
    var r = G.compressResCrate(c, 'grain', 2);
    var d = G.decompressResCrate(c, 'grain', 1);
    return { compress: r.ok, crate: G.items.count('crate_grain'), decompress: d.ok };
  });
  console.log('COMPRESS', JSON.stringify(r3b));

  /* ===== ④ 科技：无重复标题 + 主城独有组 ===== */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('tech');
    var h = document.querySelector('#view-container').innerHTML;
    G.ui.openPanel('tech');
    var mh = document.querySelector('#modal-root').innerHTML;
    var titleCount = (mh.match(/科研中心科技（/g) || []).length;
    return {
      viewTitle: h.indexOf('科研中心科技（') >= 0,
      modalHasDupTitle: titleCount > 0,
      mainGroup: h.indexOf('主城独有') >= 0,
      mainFive: ['中枢统筹', '税关直隶', '王畿兵工', '京畿土木', '金城汤池'].every(function (n) { return h.indexOf(n) >= 0; })
    };
  });
  console.log('TECH', JSON.stringify(r4));
  await p.screenshot({ path: OUT + 'tech.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ===== ⑤ 制造厂：奇观材料行 + 缺料进点选行 ===== */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    G.state.items = G.state.items || {};
    /* 找一件 q>=5 的可打造件（带 jewel 奇观材料），并清空对应材料制造缺料 */
    var pick = null;
    G.forgeList().forEach(function (f) { if (!pick && f.q >= 5) pick = f; });
    if (!pick) return { skip: true };
    G.state.items.w_crystal = 0;
    G.ui.openForge();
    G.ui._forgeQ = pick.q; G.ui.openForge();
    var h = document.querySelector('#modal-root').innerHTML;
    return {
      jewelLine: h.indexOf('奇观材料：') >= 0,
      pickRowQb: /ir-lack[\s\S]{0,400}qb-item/.test(h),
      qbInBodyBeforePick: false,
      sample: (h.match(/奇观材料：[^<]{0,60}/) || [''])[0]
    };
  });
  console.log('FORGE', JSON.stringify(r5));
  await p.screenshot({ path: OUT + 'forge.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ===== ⑥ 城外资源建筑：升级键在底栏 ===== */
  var r6 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var eg = G.extGridOf(c), idx = -1;
    for (var i = 0; i < eg.length; i++) { if (eg[i].type) { idx = i; break; } }
    if (idx < 0) return { skip: true };
    G.ui.openExtModal(idx);
    var root = document.querySelector('#modal-root');
    var h = root.innerHTML;
    var foot = root.querySelector('.bldg-foot');
    return { inFoot: !!(foot && foot.querySelector('[data-action="ext-upgrade"]')),
      zoneUpgrade: h.indexOf('op-zone-t">升级') >= 0 };
  });
  console.log('EXT', JSON.stringify(r6));
  await p.screenshot({ path: OUT + 'ext.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ===== ⑦ 基因实验室按城 + 自动研究 ===== */
  var r7 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    /* 确保实验室格已建（夹具里应已有） */
    var lab = -1;
    c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'honglusi') lab = i; });
    if (lab < 0) { for (var i = 0; i < c.cells.length; i++) { if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'honglusi', lvl: 5 }; lab = i; break; } } }
    G.ui.openFarm();
    var h1 = document.querySelector('#modal-root').innerHTML;
    G.ui.closeAllModals();
    var c2 = G.state.cities[1];
    G.farmPlant(0, 'tieying', c);
    var perCity = G.farmPlotState(0, c).state === 'growing' && G.farmPlotState(0, c2).state === 'empty';
    var cfg = G.autoFarmCfg(); cfg.on = true;
    G.autoFarm();
    var msg = (G.state.autoFarmState || {}).msg || '';
    G.ui.setView('auto'); G.ui._autoSel = 'farm'; G.ui.renderView('auto');
    var ah = document.querySelector('#view-container').innerHTML;
    return { farmOpen: h1.indexOf('各城独立') >= 0, perCity: perCity, autoMsg: msg,
      autoPane: ah.indexOf('自动基因研究') >= 0, cropChips: ah.indexOf('autofarm-crop') >= 0 };
  });
  console.log('FARM', JSON.stringify(r7));
  await p.screenshot({ path: OUT + 'auto.png' });

  /* ===== ⑧ 交易站数量不回跳 ===== */
  var r8 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city'); G.ui.openMarket();
    var inp = document.getElementById('mk-amount');
    inp.value = '2500000';
    inp.dispatchEvent(new Event('input'));
    var before = G.ui._mkAmount;
    /* 买不起也要回填 —— 直接走一次卖出 */
    G.state.res.grain = 1e8;
    G.doMarketSell('grain');
    var after = (document.getElementById('mk-amount') || {}).value;
    G.ui.closeAllModals();
    return { stored: before, after: after, kept: String(after) === '2500000' };
  });
  console.log('MARKET', JSON.stringify(r8));

  /* ===== ⑨ 自动采购统一数量 ===== */
  var r9 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openAutoBuy();
    var h = document.querySelector('#modal-root').innerHTML;
    var hasQty = !!document.getElementById('ab-qty');
    if (hasQty) {
      var sel = document.getElementById('ab-qty');
      sel.value = '5'; sel.dispatchEvent(new Event('change'));
    }
    var q = G.autoBuyCfg().qty;
    G.ui.closeAllModals();
    return { hasUnified: hasQty, noPerItem: h.indexOf('ab-item-') < 0, qty: q };
  });
  console.log('AUTOBUY', JSON.stringify(r9));

  /* ===== ⑩ 弃城限制 + 折叠 ===== */
  var r10 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c = st.cities[0], c2 = st.cities[1];
    var mainChk = G.abandonCityCheck(c.id);
    var selfChk = G.abandonCityCheck(c2.id);
    /* 名城 */
    var c3 = G.makeCity({ id: 'p3', name: '旧都', x: c.x + 6, y: c.y, type: 'capital' });
    st.cities.push(c3);
    var capChk = G.abandonCityCheck(c3.id);
    /* 入口隐藏：政务厅面板 */
    var gf = -1; c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'guanfu') gf = i; });
    G.ui.openBuildModal(gf);
    var mh = document.querySelector('#modal-root').innerHTML;
    G.ui.closeAllModals();
    return { mainBlocked: mainChk.ok === false && /主城/.test(mainChk.msg),
      capBlocked: capChk.ok === false && /名城/.test(capChk.msg),
      selfOk: selfChk.ok === true,
      mainEntryHidden: mh.indexOf('city-abandon-ask') < 0 };
  });
  console.log('ABANDON', JSON.stringify(r10));

  /* ===== ⑪ 奇观派出城过滤 ===== */
  var r11 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var pid = st.activePlanet || 1;
    /* 造第二颗星球（分片），并在当前球放一座城；当前城应在第一球 */
    var res = { eventOpen: false };
    var wid = G.wonderOf(pid);
    if (!wid) return { skip: 'no wonder' };
    G.ui.openExpModal({ kind: 'wonder', pid: pid, mode: (wid.acts || ['collect'])[0] });
    var mh = document.querySelector('#modal-root');
    var sel = mh && mh.querySelector('#exp-from');
    res.eventOpen = !!sel;
    res.selected = sel ? sel.value : null;
    res.hint = mh ? mh.innerHTML.indexOf('仅列目标景点所在星球的城市') >= 0 : false;
    G.ui.closeAllModals();
    return res;
  });
  console.log('WONDERFROM', JSON.stringify(r11));

  console.log('ERRORS', JSON.stringify(errs.slice(0, 10)));
  await b.close();
})();
