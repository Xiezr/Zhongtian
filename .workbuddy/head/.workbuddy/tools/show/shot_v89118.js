/* ============================================================
 * shot_v89118.js — v89.118 实机截图（三条需求各一张 + 兵营卡回归）
 * ------------------------------------------------------------
 * ① 军务 · 军务处：俘虏营**纯文字**明细（老板「直接文字显示就行」）
 * ② 自动化 · 外敌来犯：开关 + 状态 + 规则块 + 烽火流水（从烽火页迁来）
 * ③ 军务 · 烽火：只剩预警（排期表）与布防 + 一行指路（判"块"不判词）
 * ④ 兵营招募卡（步兵页）——顺带回归卡面
 * 用法：node .workbuddy/tools/show/shot_v89118.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(String(e && e.message).slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', mapSeed: 20260921 });
    G.ui.enterGame && G.ui.enterGame();
    if (G.ui.closeAllModals) G.ui.closeAllModals(); else if (G.ui.closeModal) G.ui.closeModal();
    G.map.generate();
    st.cities.push(G.makeCity({ id: 'x118', name: '新城2', x: 268, y: 218 }));
    st.captives = { yibing: 1281, changqiang: 937, daodun: 767, qingji: 15, gongjian: 88 };
    st.wounded = 680; st.woundedArmy = { tieji: 520, changqiang: 160 };
    st.settings = st.settings || {};
    st.inv = { lastSlot: G.invasionSlotOf(G.realNow()), warnedSlot: -1 };
    if (G.log && G.log.beacon) {
      G.log.beacon('🔥 烽火：「流寇」 · 约 120.5万 战力将于今日 9 时犯『许都』');
      G.log.beacon('🛡 许都 击退郡国游兵（守备 2.85亿 vs 来犯 5969.3万）：损兵 8.8k、战报已入公文（10 回合）');
    }
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches');
    return { cap: G.captivesTotalOf(), pop: G.captivePopOf ? G.captivePopOf(st.captives) : 0 };
  });
  console.log('boot: 俘虏 ' + boot.cap + ' 人 · 折算幸存者 ' + boot.pop);

  async function shot(name, expr, probe) {
    await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); } catch (err) {}
      return null;
    }, expr);
    await new Promise(function (r) { setTimeout(r, 420); });
    var p = await page.evaluate(function (e) {
      try { return (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message) }; }
    }, probe);
    var geo = await page.evaluate(function () {
      var box = document.querySelector('#view-container');
      return box ? { overflow: box.scrollHeight - box.clientHeight, h: box.clientHeight } : null;
    });
    await page.screenshot({ path: R + '.workbuddy/shots/' + name });
    console.log('  📸 ' + name + '  ' + JSON.stringify(p));
    return { p: p, geo: geo };
  }

  var PC = 'var v=document.querySelector("#view-container");var t=v?v.textContent:"";';

  var r1 = await shot('v89118-captive-camp.png',
    '(function(){ ui._marchTab = "affairs"; ui.setView("marches"); })()',
    '(function(){ ' + PC +
    'var img=(v?v.querySelectorAll(".camp-card img").length:-1);' +
    'return {hasCamp:t.indexOf("俘虏营")>=0,hasPlain:t.indexOf("不限量")>=0,' +
    'totalPop:t.indexOf("幸存者 +")>=0,campImgs:img}; })()');

  var r2 = await shot('v89118-auto-invasion.png',
    '(function(){ ui._autoSel = "invasion"; ui.setView("auto"); })()',
    '(function(){ ' + PC +
    'return {hasItem:t.indexOf("外敌来犯")>=0,hasRules:t.indexOf("触发点")>=0,' +
    'hasFlow:t.indexOf("烽火流水")>=0,' +
    'hasSwitch:!!document.querySelector("[data-action=\\"toggle-auto-invasion\\"]"),' +
    'acc:(t.indexOf("已接受")>=0||t.indexOf("拒战")>=0)}; })()');

  var r3 = await shot('v89118-beacon-slim.png',
    '(function(){ ui._marchTab = "beacon"; ui.setView("marches"); })()',
    '(function(){ ' + PC +
    'var fb=(v?v.querySelectorAll(".bb-line.beacon").length:0);' +
    'return {hasWarn:t.indexOf("烽火 · 预警")>=0,hasScheme:t.indexOf("策略布防")>=0,' +
    'hasRuleBlock:t.indexOf("触发点")>=0,hasFlowDom:fb,' +
    'hasGuide:t.indexOf("自动化 · 外敌来犯")>=0}; })()');

  var r4 = await shot('v89118-elephant-card.png',
    '(function(){ ui._trainTab = "inf"; ui.setView("troops"); })()',
    '(function(){ ' + PC +
    'return {hasTroops:(t.indexOf("兵营")>=0||t.indexOf("募兵")>=0),' +
    'cards:(v?v.querySelectorAll(".troop-card").length:0)}; })()');

  var okAll = true;
  function need(c, label) { if (!c) { okAll = false; console.log('  ⚠ 未过：' + label); } }
  need(r1.p && r1.p.hasCamp && r1.p.hasPlain && r1.p.campImgs === 0, '① 俘虏营纯文字（无 img）');
  need(r2.p && r2.p.hasRules && r2.p.hasFlow && r2.p.hasSwitch, '② 外敌来犯（规则+流水+开关）');
  need(r3.p && r3.p.hasWarn && r3.p.hasScheme && !r3.p.hasRuleBlock && r3.p.hasFlowDom === 0 && r3.p.hasGuide,
    '③ 烽火精简只剩预警布防（无规则块、无流水 DOM）');
  need(r4.p && r4.p.cards > 0, '④ 兵营卡在册');
  console.log('页面错误: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log(okAll ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
