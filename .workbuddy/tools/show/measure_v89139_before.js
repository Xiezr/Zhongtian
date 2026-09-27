'use strict';
/* v89.139 实机量测（改前基线）：大屏留白 / 战场侧栏 / 缩略图红点 / 地图箭头
   跑法：node .workbuddy/tools/show/measure_v89139_before.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '量', cityName: '许都', region: '豫州', mapSeed: 20260939 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    /* 三座我城（缩略图红点验证） */
    var c = st.cities[0];
    if (!G.map.wildAt(20, 20)) st.wilds.push({ x: 20, y: 20, type: 'plain', level: 2, day: 0 });
    G.buildCityAt(20, 20);
    st.cities[st.cities.length - 1].name = '二城';
    if (!G.map.wildAt(30, 24)) st.wilds.push({ x: 30, y: 24, type: 'plain', level: 2, day: 0 });
    G.buildCityAt(30, 24);
    st.cities[st.cities.length - 1].name = '三城';
    G.ui._cityId = c.id;
  });
  await p.waitForTimeout(600);

  /* ① 大屏留白 */
  var m1 = await p.evaluate(function () {
    var el = document.getElementById('screen-game');
    var r = el.getBoundingClientRect();
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      appW: Math.round(r.width), appH: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(window.innerWidth - r.right),
      top: Math.round(r.top)
    };
  });
  console.log('① 大屏 1920×1080：界面 ' + m1.appW + '×' + m1.appH +
    ' · 左右留白 ' + m1.left + 'px / ' + m1.right + 'px · 上留白 ' + m1.top + 'px');

  /* ② 地图画布覆盖率 + 箭头 */
  var m2 = await p.evaluate(function () {
    var cv = document.getElementById('mapCanvas');
    var fr = window.GAME.ui.mapFrame;
    var box = window.GAME.ui.viewBoxSize();
    return {
      cw: cv.width, ch: cv.height,
      boxW: Math.round(box.w), boxH: Math.round(box.h),
      covW: Math.round(cv.width / (box.w - 44) * 100), covH: Math.round(cv.height / (box.h - 54) * 100),
      cell: fr.cell, span: fr.spanX + 'x' + fr.spanY
    };
  });
  console.log('② 地图画布 ' + m2.cw + '×' + m2.ch + ' · 可用区 ' + m2.boxW + '×' + m2.boxH +
    ' · 覆盖 ' + m2.covW + '%/' + m2.covH + '% · 格距 ' + m2.cell + ' · 观察框 ' + m2.span);

  /* ③ 缩略图红点（当前档 = 全部我城；筛选里没有"我城"） */
  var m3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openMinimap();
    var opts = Array.prototype.slice.call(document.querySelectorAll('#mini-level option')).map(function (o) {
      return o.value + ':' + o.textContent;
    });
    var big = document.getElementById('mini-big');
    return { opts: opts, w: big.width, h: big.height };
  });
  await p.waitForTimeout(400);
  var m3b = await p.evaluate(function () {
    var big = document.getElementById('mini-big');
    var ctx = big.getContext('2d');
    var d = ctx.getImageData(0, 0, big.width, big.height).data;
    var red = 0, n = big.width * big.height;
    for (var i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b2 = d[i * 4 + 2];
      if (r > 190 && g < 120 && b2 < 110) red++;
    }
    return { redPx: red, side: big.width };
  });
  console.log('③ 缩略图筛选档：' + m3.opts.join(' / '));
  console.log('   画布 ' + m3.w + 'px · 红点像素 ' + m3b.redPx + '（当前 = 3 座我城全画）');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139before-mini.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ④ 战场侧栏（12 兵种极端载荷） */
  var m4 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c = st.cities[0];
    var all = Object.keys(G.DATA.TROOPS).filter(function (k) { return !G.DATA.TROOPS[k].nocombat; });
    c.army = {};
    all.slice(0, 12).forEach(function (k) { c.army[k] = 3000; });
    var gen = st.generals[0]; gen.status = 'idle'; gen.cityId = c.id;
    var xy = null;
    for (var yy = 4; yy < 240 && !xy; yy++) for (var xx = 4; xx < 240; xx++) {
      var tl = G.map.tile(xx, yy);
      if (!tl || tl.terrain === 'city') continue;
      if (G.map.wildAt(xx, yy) || (G.map.npcAt && G.map.npcAt(xx, yy))) continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : G.map.wildLevel(xx, yy);
      if (lv >= 4 && lv <= 7) { xy = { x: xx, y: yy }; break; }
    }
    if (!xy) return { err: '无靶' };
    var army = {}; all.slice(0, 12).forEach(function (k) { army[k] = 2000; });
    var rr = G.battle.expedition({ kind: 'wild', x: xy.x, y: xy.y }, 'raid', army, gen.id);
    if (!rr || !rr.ok) return { err: 'exp: ' + JSON.stringify(rr).slice(0, 100) };
    return { bid: Object.keys(G._bsess || {})[0], n: 12 };
  });
  if (m4.err) { console.log('④ 战场造局失败：' + m4.err); }
  else {
    await p.evaluate(function (bid) { window.GAME.ui.closeAllModals(); window.GAME.ui.openBattlefield(bid); }, m4.bid);
    await p.waitForTimeout(700);
    var m5 = await p.evaluate(function () {
      var sideA = document.getElementById('bt-side-atk');
      var sideD = document.getElementById('bt-side-def');
      var field = document.getElementById('bt-field');
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      var card = document.querySelector('#bt-side-atk .bt-card');
      var offC = document.querySelector('#bt-side-atk .bt-card.off');
      var wrapEl = document.querySelector('#bt-side-atk .bt-cards');
      var board = document.getElementById('bt-board');
      var cs = function (el) { return el ? getComputedStyle(el) : null; };
      var csCards = wrapEl ? cs(wrapEl) : null;
      return {
        sideW: sideA ? Math.round(sideA.getBoundingClientRect().width) : 0,
        sideD: sideD ? Math.round(sideD.getBoundingClientRect().width) : 0,
        fieldW: field ? Math.round(field.getBoundingClientRect().width) : 0,
        cardH: card ? +card.getBoundingClientRect().height.toFixed(1) : 0,
        cardN: document.querySelectorAll('#bt-side-atk .bt-card').length,
        offN: document.querySelectorAll('#bt-side-atk .bt-card.off').length,
        cardCols: csCards ? csCards.gridTemplateColumns : '-',
        cardsH: wrapEl ? Math.round(wrapEl.getBoundingClientRect().height) : 0,
        cols: board ? cs(board).gridTemplateColumns : '-',
        panelW: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
        panelH: panel ? Math.round(panel.getBoundingClientRect().height) : 0,
        sub: (function () { var el = document.querySelector('#modal-root .m-sub, #modal-root .shell-sub'); return el ? el.textContent.slice(0, 40) : '(无副标题)'; })(),
        wrapOverflow: (function () { var w = document.getElementById('bt-wrap'); return w ? w.scrollHeight - w.clientHeight : -1; })()
      };
    });
    console.log('④ 战场（12 兵种 / 共 17 兵种）：面板 ' + m5.panelW + '×' + m5.panelH + ' · 列宽 ' + m5.cols);
    console.log('   我军侧栏 ' + m5.sideW + 'px / 战场 ' + m5.fieldW + 'px / 敌军侧栏 ' + m5.sideD + 'px');
    console.log('   兵种格 ' + m5.cardN + ' 个（灰暗 ' + m5.offN + ' 个）· 格高 ' + m5.cardH + 'px · 网格列 ' + m5.cardCols);
    console.log('   列表总高 ' + m5.cardsH + 'px · 副标题：' + m5.sub + ' · wrap 溢出 ' + m5.wrapOverflow + 'px');
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139before-bt.png' });
  }
  if (errs.length) console.log('⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  await b.close();
  process.exit(0);
})();
