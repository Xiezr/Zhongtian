/* ============================================================
 * shot_v89102b_rankcap.js — 主城·爵位解锁建筑上限 实机截图
 * ------------------------------------------------------------
 * 出三张图：① 官府面板（主城 · 爵位「大夫」→ 爵位解锁 +5）
 *          ② 官府面板（非主城 · 只报建筑上限 + 说明）
 *          ③ 建造面板（民房 Lv12 · 等级上限 Lv17 = 档位 12 + 爵位解锁 5）
 * 顺带量：面板正文是否溢出（老板硬规矩：弹窗内不做下拉）。
 * 用法：node .workbuddy/tools/show/shot_v89102b_rankcap.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('console', function (m) { if (m.type() === 'error') console.log('  [page:error]', m.text().slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && window.GAME.ui', null, { timeout: 30000 });

  await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5e7; });
    c.res.gold = 5e6;
    /* 官府满 12（旧硬顶）· 民房 12 级站住上限，才看得出"爵位解锁"这一层 */
    c.cells.forEach(function (x) {
      if (x.build && x.build.id === 'guanfu') x.build.lvl = 12;
      if (x.build && x.build.id === 'minfang') x.build.lvl = 12;
    });
    st.rank = 5;                      /* 爵位「大夫」→ 解锁 5 级 */
    st.mainCityId = c.id;
    G.state = st;
    G.ui.enterGame && G.ui.enterGame();
  });
  await page.waitForTimeout(500);

  async function shot(fn, file) {
    await page.evaluate(fn);
    await page.waitForTimeout(420);
    var geo = await page.evaluate(function () {
      var root = document.querySelector('#modal-root');
      /* ⚠️ 官府/建造面板走 ui.openModal（无 .m-body），沙盘走 openShell（有 .m-body）——
         第一版只量 .m-body，这两个面板量到 -1 却打了 ✅（假绿）。两处都量。 */
      var body = root.querySelector('.m-body') || root.querySelector('.inner-panel');
      if (!body) return { overflow: -1, txt: '未找到面板容器' };
      var cs = window.getComputedStyle ? window.getComputedStyle(body) : null;
      var scrollable = (cs && (cs.overflowY === 'auto' || cs.overflowY === 'scroll'));
      return {
        overflow: body.scrollHeight - body.clientHeight,
        scrollable: !!scrollable,
        txt: (root.textContent || '').replace(/\s+/g, ' ').slice(0, 150),
      };
    });
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('已存 ' + file + '　内容 ' + geo.overflow + 'px 超出气泡 / 容器'
      + (geo.scrollable ? '（可滚区）' : '（不可滚）')
      + '　开头：' + geo.txt);
  }

  await shot(function () { window.GAME.ui.openGuanfu(); }, 'v89102b-guanfu-main.png');
  await shot(function () {
    window.GAME.state.mainCityId = null;      /* 非主城对照 */
    window.GAME.ui.openGuanfu();
  }, 'v89102b-guanfu-notmain.png');
  await shot(function () {
    var G = window.GAME, st = G.state, c = st.cities[0];
    st.mainCityId = c.id;
    var idx = -1;
    c.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'minfang') idx = i; });
    c.cells[idx].build.lvl = 12;
    G.ui.openBuildModal(idx);
  }, 'v89102b-build-main.png');

  await browser.close();
})();
