/* 诊断 v2：军务处三个按钮真点验证（治疗伤兵 / 收编为民 / 释放）
 * 跑法：node .workbuddy/tools/show/diag_v89135b_btns.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '诊', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    st.res.gold = 1e7;
    st.wounded = 1234; st.woundedArmy = { yibing: 800, gongjian: 300, qingji: 134 };
    st.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches');
    return { wounded: st.wounded, captives: JSON.parse(JSON.stringify(st.captives)), army: JSON.parse(JSON.stringify(st.cities[0].army || {})) };
  });
  console.log('初始：伤兵', init.wounded, '· 俘虏', JSON.stringify(init.captives));

  await p.waitForTimeout(300);

  /* ① 治疗伤兵 */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var btn = document.querySelector('[data-action="heal-wounded"]');
    if (!btn) return { found: false };
    btn.click();
    return { found: true };
  });
  await p.waitForTimeout(400);
  var s1 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    /* 治疗可能是"两段式"（确认弹窗）——查 modal */
    var root = document.querySelector('#modal-root');
    var modalTxt = root ? (root.innerText || '').slice(0, 300) : '';
    return { wounded: st.wounded, modalTxt: modalTxt.replace(/\n{2,}/g, ' | ') };
  });
  console.log('\n① 治疗伤兵 click →', JSON.stringify(r1));
  console.log('   治疗后 wounded =', s1.wounded, '· 弹窗:', s1.modalTxt.slice(0, 200));

  /* 若出现确认弹窗，点确认 */
  var s1b = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    if (!root) return { confirm: false };
    var btn = root.querySelector('[data-action="heal-wounded-do"], [data-action="heal-do"], [data-action="confirm"]');
    if (!btn) return { confirm: false, buttons: Array.from(root.querySelectorAll('[data-action]')).map(function (x) { return x.getAttribute('data-action'); }).slice(0, 8) };
    btn.click();
    return { confirm: true };
  });
  await p.waitForTimeout(400);
  var s1c = await p.evaluate(function () {
    var G = window.GAME;
    return { wounded: G.state.wounded, army: JSON.parse(JSON.stringify(G.state.cities[0].army || {})) };
  });
  console.log('   确认步:', JSON.stringify(s1b).slice(0, 220));
  console.log('   治疗后 wounded =', s1c.wounded, '· army =', JSON.stringify(s1c.army));

  /* ② 收编为民 */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    if (root) root.innerHTML = '';
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches');
    var btn = document.querySelector('[data-action="conscript-captives"]');
    if (!btn) return { found: false };
    var pop0 = G.res(G.currentCity()).pop;
    btn.click();
    return { found: true, pop0: pop0 };
  });
  await p.waitForTimeout(400);
  var s2 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    var txt = root ? (root.innerText || '').slice(0, 260) : '';
    return { captives: JSON.parse(JSON.stringify(G.state.captives || {})), pop: G.res(G.currentCity()).pop,
      modalTxt: txt.replace(/\n{2,}/g, ' | ') };
  });
  console.log('\n② 收编 click →', JSON.stringify(r2).slice(0, 160));
  console.log('   后：俘虏', JSON.stringify(s2.captives), '· 幸存者', s2.pop, '· 弹窗:', s2.modalTxt.slice(0, 180));

  /* ③ 释放 */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    if (root) root.innerHTML = '';
    G.state.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches');
    var btn = document.querySelector('[data-action="release-captives"]');
    if (!btn) return { found: false };
    btn.click();
    return { found: true };
  });
  await p.waitForTimeout(400);
  var s3 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    var txt = root ? (root.innerText || '').slice(0, 260) : '';
    return { captives: JSON.parse(JSON.stringify(G.state.captives || {})), rep: G.state.rep,
      modalTxt: txt.replace(/\n{2,}/g, ' | ') };
  });
  console.log('\n③ 释放 click →', JSON.stringify(r3).slice(0, 160));
  console.log('   后：俘虏', JSON.stringify(s3.captives), '· 声望', s3.rep, '· 弹窗:', s3.modalTxt.slice(0, 180));

  console.log('\nJS 错误:', errs.length ? errs.slice(0, 3) : '无');
  await b.close();
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(2); });
