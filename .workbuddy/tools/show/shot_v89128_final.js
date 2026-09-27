/* v89.128 实机图：① 自动化面板（新增自动采集/收获）② 营造总览（新时长：官府 11→12 = 18h） */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局 + 摆野地（有驻军，供自动采集展示）+ 官府升 11 级准备 */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    st.wilds = [{ x: 3, y: 3, type: 'caoyuan', level: 5, levelDay: null,
      garrison: { troops: { minfu: 1200 }, cityId: c.id } }];
    st.settings.autoGather = true;
    st.autoGatherState = { lastAt: ((st.world && st.world.elapsed) || 0) - 86400, msg: '已开启，待命', at: 0 };
    G.autoGatherTick();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    /* 官府拉满到 11（供营造总览展示 11→12 = 18h）；资源给足 */
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 11; });
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5e6; });
    c.res.gold = 1e6;
    st.queues.build.length = 0;
    G.upgradeAt(c.id, null);   /* 占位：无操作 */
    /* 找一个官府格真升级 */
    var gi = -1;
    c.cells.forEach(function (x, i) { if (gi < 0 && x.build && x.build.id === 'guanfu') gi = i; });
    if (gi >= 0) c.cells[gi].build.lvl = 11;
    var r = G.upgradeAt(c.id, gi);
    window.__upMsg = r && r.msg;
    G.refreshAll();
  });
  await p.waitForTimeout(500);

  /* ① 自动化面板 */
  await p.evaluate(function () { window.GAME.ui.setView('auto'); });
  await p.waitForTimeout(400);
  await p.evaluate(function () { window.GAME.ui.autoPick && window.GAME.ui.autoPick('gather'); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-auto-gather.png' });
  var m1 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    return { t: (vc.textContent || '').replace(/\s+/g, ' ').slice(0, 150) };
  });
  console.log('自动化面板:', m1.t);

  /* ② 营造总览（新时长） —— ⛔ v89.137：「全境营造总览」面板整条退役（老板判重），
     本段停用；建造时长的守护改由 smoke §108（buildTimeSec 曲线四连）承担。
     （历史脚本原样保留，恢复见 backup/v89137）*/

  var pass = m1.t.indexOf('自动采集') >= 0 && m2.t.indexOf('官府') >= 0;
  console.log(pass ? '✓ v89128 实机验证通过' : '✗ 有未达标项');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
