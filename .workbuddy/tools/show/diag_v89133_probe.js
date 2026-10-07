/* v89.133 取证：将领面板行（老板点名三处）+ 军务页现状 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
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
    G.ui._cityId = st.cities[0].id;
    st.wounded = 100; st.woundedArmy = { yibing: 60 };
    /* 给首将穿装备 + 备道具，便于看备注 */
    try { G.systems.autoEquipBest(st.generals[0].id); } catch (e) { }
    st.items = st.items || {}; st.items.jiuzhuangyao = 3; st.items.qingxin_wan = 2;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(600);

  console.log('===== ① 将领面板：状态区各行 =====');
  var gen = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('generals');
    var g = G.state.generals[0];
    G.ui._genSel = g.id;
    G.ui.setView('generals');
    var out = [];
    var all = document.querySelectorAll('.gp-col-l .gd-line');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      out.push({ txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        h: Math.round(r.height), w: Math.round(r.width),
        segs: el.children.length, title: (el.getAttribute('title') || '').slice(0, 60) });
    }
    return { name: g.name, rows: out };
  });
  console.log('将领：' + gen.name);
  gen.rows.forEach(function (r) { console.log('  h=' + r.h + ' w=' + r.w + ' segs=' + r.segs + ' | ' + r.txt + (r.title ? '   [title]' + r.title : '')); });

  console.log('');
  console.log('===== ② 军务页现状 =====');
  var march = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'over';
    G.ui.setView('marches');
    var vc = document.querySelector('#view-container');
    var tabs = [].map.call(document.querySelectorAll('.march-tabs .mt'), function (e) { return e.textContent.trim(); });
    G.ui._marchTab = 'exp';
    G.ui.setView('marches');
    var exp = (document.querySelector('#view-container') || {}).innerHTML || '';
    G.ui._marchTab = 'def';
    G.ui.setView('marches');
    var def = (document.querySelector('#view-container') || {}).innerHTML || '';
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    var bc = (document.querySelector('#view-container') || {}).textContent || '';
    return {
      tabs: tabs,
      expHasMarching: exp.indexOf('🚩 在途') >= 0,
      expHasChips: exp.indexOf('class="chips"') >= 0,
      expHasSelect: exp.indexOf('<select') >= 0,
      defHasSelect: def.indexOf('<select') >= 0,
      bcHasNote: bc.indexOf('自动化 · 外敌来犯') >= 0 && bc.indexOf('📜') >= 0
    };
  });
  console.log('页签：' + march.tabs.join(' | '));
  console.log('出征页含在途队列：' + march.expHasMarching + ' · 含 chips 按钮组：' + march.expHasChips + ' · 含 select：' + march.expHasSelect);
  console.log('防守页含 select：' + march.defHasSelect);
  console.log('烽火页含备注行：' + march.bcHasNote);

  console.log('');
  console.log('===== ③ 练兵场点击链路 =====');
  var xc = await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('city');
    var hit = null;
    document.querySelectorAll('[data-action="open-xiaochang"]').forEach(function (e) { if (!hit) hit = e; });
    return { hasEntry: !!hit,
      entryTxt: hit ? (hit.textContent || '').trim().slice(0, 40) : '' };
  });
  console.log('城内视图练兵场入口：' + xc.hasEntry + ' 「' + xc.entryTxt + '」');

  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89133-before-generals.png' });
  await b.close();
  process.exit(0);
})();
