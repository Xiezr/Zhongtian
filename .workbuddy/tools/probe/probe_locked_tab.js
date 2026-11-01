'use strict';
/* v156.33：锁定页签的**真实点击行为** ——
   ① early 期点「游商」：不切视图 + 给一句人话（#toast）
   ② 解锁后（3 胜 → mid）点同一项：正常进入 shop 视图，且不再带 tab-locked。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '锁', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('city');
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(700);

  var before = await p.evaluate(function () { return GAME.ui.view; });
  await p.click('#topnav [data-view="shop"]');
  await p.waitForTimeout(220);
  var afterLocked = await p.evaluate(function () {
    return {
      view: GAME.ui.view,
      toast: (document.getElementById('toast').textContent || '').trim(),
      modal: (document.getElementById('modal-root') || {}).textContent ? 'has' : (document.querySelector('#modal-root.on') ? 'has' : 'none'),
      locked: document.querySelector('#topnav [data-view="shop"]').classList.contains('tab-locked')
    };
  });
  console.log('① 锁着时点「游商」  view: ' + before + ' → ' + afterLocked.view
    + '   locked=' + afterLocked.locked);
  console.log('   toast=[' + afterLocked.toast.slice(0, 60) + ']');
  console.log('   判据：view 未变 = ' + (before === afterLocked.view)
    + ' · toast 含"暂时进不去" = ' + (afterLocked.toast.indexOf('暂时进不去') >= 0));

  /* 解锁：3 胜 → mid */
  var unlocked = await p.evaluate(function () {
    var st = GAME.state;
    st.stats = st.stats || {}; st.stats.wins = 3;
    GAME.ui._phaseShown = null;
    GAME.ui.syncPhase();
    var el = document.querySelector('#topnav [data-view="shop"]');
    var cs = getComputedStyle(el);
    return { locked: el.classList.contains('tab-locked'), op: cs.opacity, title: el.getAttribute('title') || '' };
  });
  await p.click('#topnav [data-view="shop"]');
  await p.waitForTimeout(240);
  var afterOpen = await p.evaluate(function () {
    return { view: GAME.ui.view, html: (document.getElementById('view-container').textContent || '').slice(0, 40) };
  });
  console.log('② 解锁后（3 胜）  locked=' + unlocked.locked + ' opacity=' + unlocked.op
    + ' title=' + (unlocked.title ? '有' : '无'));
  console.log('   点「游商」→ view=' + afterOpen.view + '  首屏=[' + afterOpen.html.replace(/\s+/g, ' ').trim() + ']');
  console.log('   判据：解锁后真进得去 = ' + (afterOpen.view === 'shop'));

  await p.screenshot({ path: '.workbuddy/shots/locked_tab_click.png', clip: { x: 0, y: 0, width: 1440, height: 90 } });
  console.log('页面异常 ' + (errs.length ? errs.join(' | ') : '无'));
  await b.close();
  if (afterLocked.view !== before || afterLocked.toast.indexOf('暂时进不去') < 0 || afterOpen.view !== 'shop') process.exit(1);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
