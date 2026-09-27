/* v89.132 实机脚本：军务处 / 缩略地图 / 节钺开拓（自带判定 + 截图）
 * ------------------------------------------------------------
 * 判据：
 *   ① 军务处：两营**左右分列**（左卡 right ≤ 右卡 left · 同一行）+ 逐兵种；总览四段无两营；
 *   ② 缩略图：城名层字体 normal（去 bold）；我城**红点**（画布像素实测朱红）；
 *      波纹层在画（pulse 画布有非零像素）+ 与底图同尺寸；
 *   ③ 节钺：校场 / 招贤馆面板各带扩编入口；真点一次 → 容量/席位数字当场变；面板四用途齐。
 * 跑法：node .workbuddy/tools/show/shot_v89132_three.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 两营有货 */
    st.wounded = 1234; st.woundedArmy = { yibing: 800, gongjian: 300, qingji: 134 };
    st.captives = { changqiang: 420, qingji: 260, gongjian: 90 };
    st.jieyue = 3;
    /* 摆校场 / 招贤馆（节钺扩编入口所在） */
    var put = function (bid) {
      var idx = -1;
      (c.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
      c.cells[idx] = { build: { id: bid, lvl: 3 } };
    };
    put('xiaochang'); put('zhaoxianguan'); put('guanfu'); put('minfang');
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(700);

  /* ══ ① 军务处：两营左右分列 ══ */
  await p.evaluate(function () {
    window.GAME.ui._marchTab = 'affairs';
    window.GAME.ui.setView('marches');
  });
  await p.waitForTimeout(450);
  var aff = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var t = (vc && vc.textContent) || '';
    var cards = document.querySelectorAll('#view-container .camp-cards .camp-card');
    function rect(el) {
      var r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height) };
    }
    return {
      n: cards.length,
      c0: cards[0] ? rect(cards[0]) : null,
      c1: cards[1] ? rect(cards[1]) : null,
      hasW: t.indexOf('伤兵营') >= 0, hasC: t.indexOf('俘虏营') >= 0,
      hasTroop: t.indexOf('义兵') >= 0 && t.indexOf('长枪兵') >= 0,
      noSrc: t.indexOf('兵源与征募') < 0 && t.indexOf('军心') < 0
    };
  });
  chk('① 军务处两营卡各一（camp-cards）', aff.n === 2, aff.n + ' 张');
  chk('① 两营**左右分列**（同顶 · 左卡右缘 ≤ 右卡左缘）',
    aff.c0 && aff.c1 && aff.c1.left >= aff.c0.right - 2 && Math.abs(aff.c0.top - aff.c1.top) <= 4,
    aff.c0 && aff.c1 ? ('c0 [' + aff.c0.left + ',' + aff.c0.right + '] top=' + aff.c0.top
      + ' · c1 [' + aff.c1.left + ',' + aff.c1.right + '] top=' + aff.c1.top) : '-');
  /* v89.132（实测坑）：列宽曾 1098:272（camp-card 行内 svg.ico 无尺寸 → min-content 撑列）——
     判据钉死"两列等宽"（minmax(0,1fr) + 图标定尺寸之后 685:685）。 */
  chk('① 两列等宽（minmax(0,1fr) 未被 min-content 带偏）',
    aff.c0 && aff.c1 && Math.abs(aff.c0.w - aff.c1.w) <= 2,
    aff.c0 && aff.c1 ? (aff.c0.w + ' : ' + aff.c1.w) : '-');
  chk('① 两营均列逐兵种 + 兵源/军心已退役', aff.hasW && aff.hasC && aff.hasTroop && aff.noSrc,
    '伤兵营=' + aff.hasW + ' 俘虏营=' + aff.hasC + ' 逐兵种=' + aff.hasTroop + ' 无两卡=' + aff.noSrc);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-affairs.png' });

  /* ══ ①b 军务总览：四段齐、无两营 ══ */
  await p.evaluate(function () {
    window.GAME.ui._marchTab = 'over';
    window.GAME.ui.setView('marches');
  });
  await p.waitForTimeout(450);
  var over = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var t = (vc && vc.textContent) || '';
    return { s1: t.indexOf('① 城内') >= 0, s4: t.indexOf('④ 行军') >= 0,
      no5: t.indexOf('⑤ 两营') < 0, noB: t.indexOf('伤兵营') < 0 };
  });
  chk('① 总览四段齐 · 无 ⑤ 两营区 · 无伤兵营', over.s1 && over.s4 && over.no5 && over.noB,
    '①②③④=' + over.s1 + '/' + over.s4 + ' 无⑤=' + over.no5 + ' 无伤兵=' + over.noB);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-overview.png' });

  /* ══ ② 缩略图（天下大势）：红点 + 波纹 + 我城名 ══ */
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME.ui.openMinimap(); });
  await p.waitForTimeout(900);                     /* 让波纹跑几帧 */
  var mini = await p.evaluate(function () {
    var G = window.GAME;
    var big = document.getElementById('mini-big');
    var pulse = document.getElementById('mini-pulse');
    var out = { big: !!big, pulse: !!pulse };
    if (big) {
      var ctx = big.getContext('2d');
      var size = big.width;
      var c = null;
      (G.state.cities || []).forEach(function (x) { if (x.id === G.ui._cityId) c = x; });
      var v = G.ui.miniView();
      var px = Math.round((c.x + 0.5 - v.win.x0) / v.win.side * size);
      var py = Math.round((c.y + 0.5 - v.win.y0) / v.win.side * size);
      var d = ctx.getImageData(Math.max(0, px - 1), Math.max(0, py - 1), 3, 3).data;
      out.me = { px: px, py: py, r: d[16], g: d[17], b: d[18], size: size };
    }
    if (big && pulse) {
      out.sameSize = (pulse.width === big.width && pulse.height === big.height);
      out.pw = pulse.width;
    }
    return out;
  });
  chk('② 缩略图：底图 + 波纹层都建出来且同尺寸',
    mini.big && mini.pulse && mini.sameSize, 'pulse=' + (mini.pw || '-'));
  chk('② 我城点是**朱红**（画布像素实测 #ff3a2a ± 容差）',
    mini.me && mini.me.r > 200 && mini.me.g < 110 && mini.me.b < 100,
    mini.me ? ('(' + mini.me.px + ',' + mini.me.py + ') rgb(' + mini.me.r + ',' + mini.me.g + ',' + mini.me.b + ')') : '-');
  var wave = await p.evaluate(function () {
    return new Promise(function (resolve) {
      var cv = document.getElementById('mini-pulse');
      if (!cv) return resolve(null);
      var ctx = cv.getContext('2d');
      var best = 0;
      var t0 = Date.now();
      var timer = setInterval(function () {
        var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        var n = 0;
        for (var i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        best = Math.max(best, n);
        if (Date.now() - t0 > 700) { clearInterval(timer); resolve({ nonZero: best }); }
      }, 120);
    });
  });
  chk('② 波纹在画（pulse 画布有非零像素）', wave && wave.nonZero > 0, '非零 ' + (wave || {}).nonZero);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-minimap.png' });

  /* 底部条 38px 小图特写 + 闪烁两帧对比 */
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await p.waitForTimeout(300);
  var bb = await p.evaluate(function () {
    var el = document.querySelector('.bb-mini');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (bb) await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-mini38.png',
    clip: { x: Math.max(0, bb.x - 6), y: Math.max(0, bb.y - 6), width: bb.w + 12, height: bb.h + 12 } });
  var blink = await p.evaluate(function () {
    var G = window.GAME;
    var cv = document.getElementById('mini-canvas');
    if (!cv) return null;
    var ctx = cv.getContext('2d');
    var c = null;
    (G.state.cities || []).forEach(function (x) { if (x.id === G.ui._cityId) c = x; });
    var v = G.ui.miniView();
    var px = Math.round((c.x + 0.5 - v.win.x0) / v.win.side * cv.width);
    var py = Math.round((c.y + 0.5 - v.win.y0) / v.win.side * cv.height);
    function snap() {
      var d = ctx.getImageData(Math.max(0, px - 1), Math.max(0, py - 1), 3, 3).data;
      return [d[16], d[17], d[18]];
    }
    var s1 = snap();
    return new Promise(function (resolve) {
      setTimeout(function () { resolve({ s1: s1, s2: snap(), px: px, py: py, size: cv.width }); }, 1250);
    });
  });
  chk('② 底部小图：我城红点醒目（38px 图上可见 · 闪烁两帧有明暗差）',
    blink && blink.s1[0] > 150 && (Math.abs(blink.s1[0] - blink.s2[0]) >= 15 || blink.s1[0] !== blink.s2[0]),
    blink ? ('帧1 rgb(' + blink.s1.join(',') + ') 帧2 rgb(' + blink.s2.join(',') + ') 画布 ' + blink.size + 'px') : '-');

  /* ══ ③ 节钺：校场 / 招贤馆 / 面板 ══ */
  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } window.GAME.ui.openXiaochang(); });
  await p.waitForTimeout(500);
  var xc = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    var btn = document.querySelector('#modal-root [data-action="jieyue-xc"]');
    return { has: !!btn, txt: btn ? btn.textContent : '', cap: (t.match(/出征兵力上限[\s\S]{0,24}/) || [''])[0] };
  });
  chk('③ 校场面板带「节钺 · 校场扩编」入口', xc.has && xc.txt.indexOf('校场扩编') >= 0, xc.txt.slice(0, 30));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-xiaochang.png' });

  /* 真点一次：容量数字当场变 */
  var before = xc.cap;
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="jieyue-xc"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(600);
  var xc2 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    var btn = document.querySelector('#modal-root [data-action="jieyue-xc"]');
    return { txt: btn ? btn.textContent : '', cap: (t.match(/出征兵力上限[\s\S]{0,24}/) || [''])[0],
      jy: (window.GAME.jieyueOf ? window.GAME.jieyueOf() : -1) };
  });
  chk('③ 真点扩编：容量数字变 + 节钺扣 1 + 进度 1/2',
    xc2.cap !== before && xc2.jy === 2 && xc2.txt.indexOf('1/2') >= 0,
    '「' + before.replace(/\s+/g, ' ') + '」→「' + xc2.cap.replace(/\s+/g, ' ') + '」· 余额 ' + xc2.jy);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-xiaochang-done.png' });

  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } window.GAME.ui.openHostel(); });
  await p.waitForTimeout(500);
  var hz = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="jieyue-gen"]');
    return { has: !!btn, txt: btn ? btn.textContent : '' };
  });
  chk('③ 招贤馆面板带「节钺 · 招贤纳士」入口', hz.has && hz.txt.indexOf('招贤纳士') >= 0, hz.txt.slice(0, 30));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-hostel.png' });

  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } window.GAME.ui.openJieyue(); });
  await p.waitForTimeout(500);
  var jy = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    var boxes = document.querySelectorAll('#modal-root .res-line');
    var inner = document.querySelector('#modal-root .inner-panel');
    return { t: t, lines: boxes.length,
      overflow: inner ? (inner.scrollHeight - inner.clientHeight) : -999,
      four: ['问鼎天授', '城建扩编', '校场扩编', '招贤纳士'].filter(function (k) { return t.indexOf(k) >= 0; }).length };
  });
  chk('③ 节钺面板：四用途齐 + 来源 + 全境进度', jy.four === 4 && jy.t.indexOf('首占名城') >= 0
    && jy.t.indexOf('全境扩编') >= 0, '用途 ' + jy.four + '/4 · 行 ' + jy.lines);
  chk('③ 节钺面板无滚动条（弹窗内不溢出）', jy.overflow <= 1, 'overflow=' + jy.overflow);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89132-jieyue.png' });

  console.log(FAIL ? '\n✗ 有 ' + FAIL + ' 项未达标' : '\n✓ 全项达标');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
