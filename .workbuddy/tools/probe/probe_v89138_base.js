/* v89.138 探针：本轮六条需求的现状取证（真浏览器）
 * ① 地图：fitMapCell 输出 · 画布尺寸 · 可用区域 · 覆盖率（老板"没铺满，放大"）
 * ② 己方城池菜单：按钮清单（进入城池/调兵运输/度支归集/将领派遣/节钺扩编/改名/放弃）
 * ③ 提速面板：字段清单（含"已用宝物"拼音 id 那行）
 * ④ 建筑面板：op-zone 标题文案（"功能（升级中照常可用）"）
 * 跑法：node .workbuddy/tools/probe/probe_v89138_base.js
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
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20261002 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 3000, changqiang: 2000 };
    c.res.gold = 1e7;
    c.res.grain = 5e6; c.res.wood = 5e6; c.res.stone = 5e6; c.res.iron = 5e6;
    c.res.pop = 50000;
    /* 造一座已建成的军营（Lv3）—— 提速面板/建筑面板都要它 */
    var bidx = -1;
    c.cells.forEach(function (cell, i) {
      if (bidx < 0 && !cell.build && !cell.official) bidx = i;
    });
    if (bidx >= 0) c.cells[bidx].build = { id: 'junying', lvl: 3 };
    var lord = G.lordGeneralOf(); lord.status = 'idle'; lord.cityId = c.id;
    G.ui.enterGame();
    G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    return { cid: c.id, bidx: bidx };
  });

  /* ══ ① 地图尺寸 ══ */
  await p.waitForTimeout(600);
  var r1 = await p.evaluate(function () {
    var G = window.GAME, U2 = G.ui;
    var box = U2.viewBoxSize();
    var fr = U2.mapFrame;
    var cv = document.getElementById('mapCanvas');
    var fit = U2.fitMapCell ? U2.fitMapCell() : null;
    return {
      boxW: Math.round(box.w), boxH: Math.round(box.h),
      frame: { spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell },
      fit: fit ? { cols: fit.cols, rows: fit.rows, cell: fit.cell } : null,
      canvasW: cv ? cv.width : 0, canvasH: cv ? cv.height : 0,
      cssW: cv ? Math.round(cv.getBoundingClientRect().width) : 0,
      cssH: cv ? Math.round(cv.getBoundingClientRect().height) : 0,
      zoom: U2.MAP_ZOOM, cellMax: U2.MAP_CELL_MAX, minCols: U2.MAP_MIN_COLS, minRows: U2.MAP_MIN_ROWS
    };
  });
  console.log('① 地图：可用区 ' + r1.boxW + '×' + r1.boxH + ' · 观察框 ' + r1.frame.spanX + '×' + r1.frame.spanY +
    '@' + r1.frame.cell + ' · 画布 ' + r1.canvasW + '×' + r1.canvasH + '（显示 ' + r1.cssW + '×' + r1.cssH + '）');
  console.log('   fitMapCell → ' + JSON.stringify(r1.fit) + ' · ZOOM=' + r1.zoom + ' CELL_MAX=' + r1.cellMax +
    ' MIN=' + r1.minCols + '×' + r1.minRows);
  console.log('   覆盖率：宽 ' + Math.round(r1.canvasW / r1.boxW * 100) + '% · 高 ' + Math.round(r1.canvasH / r1.boxH * 100) + '%');

  /* ══ ② 己方城池菜单 ══ */
  var r2 = await p.evaluate(function (cid) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.cityById(cid));
    var root = document.getElementById('modal-root');
    var btns = [];
    Array.prototype.slice.call(root.querySelectorAll('.m-foot button, .modal-foot button')).forEach(function (b) {
      btns.push(b.textContent.trim() + ' | act=' + (b.getAttribute('data-action') || '') +
        (b.title ? ' | title前30=' + b.title.slice(0, 30) : ''));
    });
    return { btns: btns };
  }, init.cid);
  console.log('② 城池菜单底栏：');
  r2.btns.forEach(function (t) { console.log('   · ' + t); });
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-citymenu-before.png' });

  /* ══ ③ 提速面板（造一个进行中的募兵） ══ */
  var r3 = await p.evaluate(function (cid) {
    var G = window.GAME;
    var c = G.cityById(cid);
    var bar = G.barracksOf(c)[0];
    if (!bar) return { err: '无军营' };
    /* 起一条募兵（走域出口） */
    G.ui._cityId = cid;
    var r = G.doTrain ? null : null;
    G.state.res.grain = 5e6; G.state.res.wood = 5e6; G.state.res.stone = 5e6; G.state.res.iron = 5e6;
    try { G.trainAt(cid, bar.idx, 'yibing', 200); } catch (e) { return { err: 'trainAt: ' + e.message }; }
    /* 用掉一枚宝物（制造"已用宝物"行） */
    G.state.items = G.state.items || {};
    G.state.items.hanxin_dianbing = 2;
    try { G.doBoostTrain('hanxin_dianbing', bar.idx); } catch (e) { /* 无队列时忽略 */ }
    G.ui.closeAllModals();
    G.ui.openTrainBoost(bar.idx);
    var root = document.getElementById('modal-root');
    var rows = [];
    Array.prototype.slice.call(root.querySelectorAll('.attr')).forEach(function (a) {
      rows.push((a.textContent || '').replace(/\s+/g, ' ').trim());
    });
    return { idx: bar.idx, rows: rows };
  }, init.cid);
  if (r3.err) console.log('③ 提速面板：' + r3.err);
  else {
    console.log('③ 提速面板（军营格 ' + r3.idx + '）字段行：');
    r3.rows.forEach(function (t) { console.log('   · ' + t); });
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-trainboost-before.png' });
  }

  /* ══ ④ 建筑面板的区标题 ══ */
  var r4 = await p.evaluate(function (cid) {
    var G = window.GAME;
    var c = G.cityById(cid);
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'junying') idx = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
    var root = document.getElementById('modal-root');
    var zts = [];
    Array.prototype.slice.call(root.querySelectorAll('.op-zone-t')).forEach(function (t) { zts.push(t.textContent.trim()); });
    return { idx: idx, zts: zts };
  }, init.cid);
  console.log('④ 军营建筑面板 op-zone 标题：' + JSON.stringify(r4.zts));

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  else console.log('\n✅ 无页面错误');
  await b.close();
  process.exit(0);
})();
