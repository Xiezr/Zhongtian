/* v89.157 量测：① 公文系统页铺满 ② 将领状态条折行 ③ 地块 Lv1 形态（先量后改） */
const pw = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const fs = require('fs');

(async function () {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + String(e.message).slice(0, 160)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- ① 公文系统页 ---------- */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 40 条不同主题消息 */
    var subs = ['war', 'task', 'era', 'weather', 'build', 'gather', 'sys'];
    for (var i = 1; i <= 40; i++) {
      var sub = subs[i % subs.length];
      G.log('§量测消息 ' + i + '：这是一条用于量测行高与铺满的测试消息，中等长度文本内容。', 'sys', sub === 'war' ? undefined : sub);
    }
    G.ui._msgTag = 'all';
    G.ui.setView('reports');
    G.ui.renderView('reports');
  });
  await p.waitForTimeout(600);
  const r1 = await p.evaluate(function () {
    var G = window.GAME;
    var k = G.ui.appKOf ? G.ui.appKOf() : 1;
    function R(el) { var r = el.getBoundingClientRect(); return { t: r.top / k, h: r.height / k, b: r.bottom / k, l: r.left / k, w: r.width / k }; }
    var vc = document.getElementById('view-container');
    var body = document.getElementById('doc-body');
    var chips = document.querySelector('.msg-channels');
    var task = document.getElementById('msg-task');
    var feed = document.getElementById('msg-feed');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    var vcR = R(vc), bodyR = R(body);
    var last = lines.length ? R(lines[lines.length - 1]) : null;
    return {
      k: k, vcH: vc.clientHeight, vcBottom: vcR.b,
      bodyTop: +bodyR.t.toFixed(1), bodyH: +bodyR.h.toFixed(1),
      chipsH: chips ? +R(chips).h.toFixed(1) : -1,
      taskH: task ? +R(task).h.toFixed(1) : -1,
      feedH: feed ? +R(feed).h.toFixed(1) : -1,
      feedTop: feed ? +R(feed).t.toFixed(1) : -1,
      lineCount: lines.length,
      lineH: lines.length ? +R(lines[0]).h.toFixed(2) : -1,
      lineStep: lines.length >= 2 ? +(R(lines[1]).t - R(lines[0]).t).toFixed(2) : -1,
      lastBottom: last ? +last.b.toFixed(1) : -1,
      gapBottom: last ? +(vcR.b - last.b).toFixed(1) : -1,
      vcScroll: vc.scrollHeight - vc.clientHeight,
      per: G.ui.docPerOf('sys'), total: G.ui.docCountOf('sys')
    };
  });
  console.log('① 公文系统页(all): ' + JSON.stringify(r1));

  const r1b = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setMsgTag('gather');       /* 单标签：无摘要区 */
    return null;
  });
  await p.waitForTimeout(400);
  const r1c = await p.evaluate(function () {
    var G = window.GAME;
    var k = G.ui.appKOf ? G.ui.appKOf() : 1;
    function R(el) { var r = el.getBoundingClientRect(); return { t: r.top / k, b: r.bottom / k, h: r.height / k }; }
    var vc = document.getElementById('view-container');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    var last = lines.length ? R(lines[lines.length - 1]) : null;
    return { tag: G.ui._msgTag, lineCount: lines.length, per: G.ui.docPerOf('sys'),
      gapBottom: last ? +(R(vc).b - last.b).toFixed(1) : -1, vcScroll: vc.scrollHeight - vc.clientHeight };
  });
  console.log('① 公文系统页(gather 单标签): ' + JSON.stringify(r1c));

  /* ---------- ② 将领页状态条 ---------- */
  const r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('generals');
    G.ui.renderView('generals');
    var g = (G.state.generals || [])[0];
    if (g) { G.ui._genSel = g.id; G.ui.renderView('generals'); }
    return null;
  });
  await p.waitForTimeout(500);
  const r2b = await p.evaluate(function () {
    var G = window.GAME;
    var k = G.ui.appKOf ? G.ui.appKOf() : 1;
    function R(el) { var r = el.getBoundingClientRect(); return { w: r.width / k, h: r.height / k, t: r.top / k }; }
    var col = document.querySelector('.gp-col-l');
    var out = { colW: col ? +R(col).w.toFixed(1) : -1, rows: [] };
    if (col) {
      Array.prototype.forEach.call(col.querySelectorAll('.gd-line'), function (el) {
        var kids = [];
        Array.prototype.forEach.call(el.children, function (c) {
          kids.push((c.className || c.tagName).split(' ')[0] + '=' + Math.round(R(c).w));
        });
        out.rows.push({ txt: (el.textContent || '').slice(0, 12).replace(/\s+/g, ''), h: +R(el).h.toFixed(1),
          w: +R(el).w.toFixed(1), scrollW: el.scrollWidth, wrap: R(el).h > 30, kids: kids.join(',') });
      });
    }
    /* 整页宽 / gen-split / gp-body */
    var sp = document.querySelector('.gen-split');
    var gp = document.querySelector('.gp-body');
    out.splitW = sp ? +R(sp).w.toFixed(1) : -1;
    out.gpW = gp ? +R(gp).w.toFixed(1) : -1;
    return out;
  });
  console.log('② 将领页: ' + JSON.stringify(r2b, null, 1));

  /* ---------- ③ 地块 Lv1 形态 ---------- */
  const r3 = await p.evaluate(function () {
    var G = window.GAME;
    var ord = G.extSlotOrder();
    var cap = G.extCap(G.currentCity());
    var cols = G.DATA.EXT_COLS || 12, rows = G.DATA.EXT_ROWS || 8;
    var lit = {};
    ord.slice(0, cap).forEach(function (o) { lit[o.row + ',' + o.col] = 1; });
    var map = [];
    for (var r = 0; r < rows; r++) {
      var line = '';
      for (var c = 0; c < cols; c++) line += lit[r + ',' + c] ? '■' : '·';
      map.push(line);
    }
    /* bbox */
    var r0 = 99, r1 = -1, c0 = 99, c1 = -1;
    ord.slice(0, cap).forEach(function (o) {
      if (o.row < r0) r0 = o.row; if (o.row > r1) r1 = o.row;
      if (o.col < c0) c0 = o.col; if (o.col > c1) c1 = o.col;
    });
    return { cap: cap, cols: cols, rows: rows, map: map,
      bbox: { r0: r0, r1: r1, c0: c0, c1: c1 },
      first: ord.slice(0, 3).map(function (o) { return o.row + ',' + o.col; }) };
  });
  console.log('③ 地块 Lv1(' + r3.cap + ') bbox=' + JSON.stringify(r3.bbox) + ' 首块=' + r3.first.join(' '));
  console.log(r3.map.join('\n'));

  /* 下一档（cap 15 / 18）形态，看增长 */
  const r4 = await p.evaluate(function () {
    var G = window.GAME;
    var ord = G.extSlotOrder();
    var cols = G.DATA.EXT_COLS || 12, rows = G.DATA.EXT_ROWS || 8;
    var out = {};
    [15, 18, 24].forEach(function (cap) {
      var lit = {}; ord.slice(0, cap).forEach(function (o) { lit[o.row + ',' + o.col] = 1; });
      var map = [];
      for (var r = 0; r < rows; r++) { var l = ''; for (var c = 0; c < cols; c++) l += lit[r + ',' + c] ? '■' : '·'; map.push(l); }
      out[cap] = map;
    });
    return out;
  });
  console.log('③b cap=15:\n' + r4[15].join('\n'));
  console.log('③c cap=18:\n' + r4[18].join('\n'));

  /* ---------- ④ 墙/官府现状 ---------- */
  const r5 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    return { guanfu: G.buildingLevel(c, 'guanfu'), wall: G.buildingLevel(c, 'chengqiang'),
      cap: G.buildCapOf(c, 'guanfu'), capWall: G.buildCapOf(c, 'chengqiang'),
      pre: JSON.stringify(G.buildPrereqOf(c, 'guanfu')) };
  });
  console.log('④ 城中 官府/城墙: ' + JSON.stringify(r5));

  await b.close();
  process.exit(0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
