/* 诊断：军务全页签现状 dump（找"军务处没改完"的真身）
 * 逐个页签：渲染文本（去标签）+ 截图 + 找关键词。
 * 跑法：node .workbuddy/tools/show/diag_v89135_march.js
 */
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
    var st = G.newGame({ name: '诊', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    st.wounded = 1234; st.woundedArmy = { yibing: 800, gongjian: 300, qingji: 134 };
    st.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(500);

  var tabs = ['over', 'act', 'exp', 'def', 'beacon', 'affairs'];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var out = await p.evaluate(function (tt) {
      var G = window.GAME;
      G.ui._marchTab = tt;
      G.ui.setView('marches');
      var host = document.querySelector('#view-marches') || document.body;
      var txt = (host.innerText || '').replace(/\n{2,}/g, '\n').trim();
      return { len: txt.length, txt: txt.slice(0, 1100) };
    }, t);
    console.log('\n========== 页签[' + t + '] len=' + out.len + ' ==========');
    console.log(out.txt);
    await p.waitForTimeout(260);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/diag_v89135-' + t + '.png' });
  }

  /* 关键词核查 */
  var kw = await p.evaluate(function () {
    var G = window.GAME;
    var all = {};
    ['over', 'act', 'exp', 'def', 'beacon', 'affairs'].forEach(function (tt) {
      G.ui._marchTab = tt;
      G.ui.setView('marches');
      var host = document.querySelector('#view-marches') || document.body;
      all[tt] = (host.innerText || '');
    });
    var words = ['兵源与征募', '军心', '伤兵营', '俘虏营', '两营'];
    var hit = {};
    words.forEach(function (w) {
      hit[w] = [];
      Object.keys(all).forEach(function (k) { if (all[k].indexOf(w) >= 0) hit[w].push(k); });
    });
    return hit;
  });
  console.log('\n===== 关键词出现的页签 =====');
  console.log(JSON.stringify(kw, null, 1));
  await b.close();
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(2); });
