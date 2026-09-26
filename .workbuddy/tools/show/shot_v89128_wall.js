/* v89.128 需求 6 实机图：城墙环城结构（未建不画 / 修上画环 / 点环城开面板） */
'use strict';
var fs = require('fs');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局（摆一些建筑让城内有东西看） */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 摆几座建筑 */
    [[0, 'minfang'], [1, 'junying'], [2, 'shuyuan'], [7, 'shichang'], [8, 'cangku']].forEach(function (a) {
      var x = c.cells[a[0]];
      if (x && !x.official) x.build = { id: a[1], lvl: 5 };
    });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    G.wallSlotOf(c).build = null;   /* 未建 */
    G.refreshAll();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-city-nowall.png' });
  var r1 = await p.evaluate(function () {
    return { hasWallSvg: !!document.querySelector('#view-container svg.iso-wall') };
  });
  console.log('① 未建城墙：环城 SVG 存在 =', r1.hasWallSvg, '（期望 false）');

  /* 修上 Lv8（官府拉满 —— 否则非官府建筑被"官府总闸"卡住，升级键不显示） */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 8 };
    G.refreshAll();
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-city-wall.png' });
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    return {
      hasWallSvg: !!document.querySelector('#view-container svg.iso-wall'),
      towers: document.querySelectorAll('#view-container svg.iso-wall .wtower').length,
      cellsWithWall: G.currentCity().cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length,
    };
  });
  console.log('② 修上 Lv8：环城 SVG =', r2.hasWallSvg, ' 角楼 =', r2.towers, ' 格子里的城墙 =', r2.cellsWithWall, '（期望 true/4/0）');

  /* 点环城 → 面板 */
  await p.click('#view-container .wall-hit[data-action="open-wall"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-wall-panel.png' });
  var r3 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return {
      hasUpgrade: !!m.querySelector('[data-action="confirm-upgrade"][data-idx="wall"]'),
      txt: (m.textContent || '').replace(/\s+/g, ' ').slice(0, 70),
    };
  });
  console.log('③ 点环城 → 面板：升级键 =', r3.hasUpgrade, '｜', r3.txt);

  var pass = !r1.hasWallSvg && r2.hasWallSvg && r2.towers === 4 && r2.cellsWithWall === 0 && r3.hasUpgrade;
  console.log(pass ? '✓ 需求 6 实机验证通过' : '✗ 有未达标项');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
