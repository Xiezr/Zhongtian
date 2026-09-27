'use strict';
/* v89.139 实机验证（真浏览器）：大屏铺满 · 地图无箭头 · 战场 2 列 · 采集静默 ·
   野地面板 · 缩略图我城档。跑法：node .workbuddy/tools/show/shot_v89139_wide.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260939 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    /* 三座我城（缩略图验证）+ 一块可采野地（湖畔）+ 驻军与将领 */
    var c = st.cities[0];
    [[20, 20, '二城'], [30, 24, '三城']].forEach(function (t) {
      if (!G.map.wildAt(t[0], t[1])) st.wilds.push({ x: t[0], y: t[1], type: 'plain', level: 2, day: 0 });
      G.buildCityAt(t[0], t[1]);
      var nc = st.cities[st.cities.length - 1];
      nc.name = t[2];
    });
    G.ui._cityId = c.id;
    /* 可采野地（湖畔 Lv8）距主城 2 格内 */
    /* ⚠️ 找**可采地形**（resOf 里有资源的地形）——否则面板没有采集区（实测踩过） */
    var RESOK = G.DATA.GATHER.resOf || {};
    var wt = null;
    for (var rr = 2; rr <= 14 && !wt; rr++) {
      for (var dy = -rr; dy <= rr && !wt; dy++) for (var dx = -rr; dx <= rr && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || !RESOK[tl.terrain] || G.map.wildAt(x, y)) continue;
        if (G.map.npcAt && G.map.npcAt(x, y)) continue;
        wt = { x: x, y: y, t: tl.terrain };
      }
    }
    if (wt) {
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wt.x && z.y === wt.y); });
      st.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 8, day: 0, startDay: 0 });
      var gen = st.generals[0];
      gen.status = 'garrison';
      G.map.wildAt(wt.x, wt.y).garrison = { troops: { changqiang: 5000, gongjian: 2000 }, cityId: c.id, genId: gen.id };
    }
    return { cid: c.id, wx: wt ? wt.x : 0, wy: wt ? wt.y : 0 };
  });
  await p.waitForTimeout(700);

  console.log('===== ① 大屏铺满（1920×1080）+ 地图无方向箭头 =====');
  var m1 = await p.evaluate(function () {
    var el = document.getElementById('screen-game');
    var r = el.getBoundingClientRect();
    var cv = document.getElementById('mapCanvas');
    var ctx = cv.getContext('2d');
    /* 边缘 20px 环带里的"暖黄箭头色"文字像素（改前 ◀▶▲▼ 就是这色） */
    var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var n = 0;
    var RING = 12;   /* 箭头 clamp 在 14/16px 处（字号 16）—— 12px 环带内才可能是箭头 */
    var inRing = function (x, y) { return x < RING || y < RING || x > cv.width - RING || y > cv.height - RING; };
    for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
      if (!inRing(x, y)) continue;
      var i = (cv.width * y + x) << 2;
      var r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      if (r0 > 200 && g0 > 180 && b0 < 160 && r0 - b0 > 60) n++;   /* 暖黄 */
    }
    /* 视野外名城数（改前它们会在边缘画箭头） */
    var offC = 0;
    var fr = window.GAME.ui.mapFrame, mp = window.GAME.map;
    (window.GAME.state.map.cities || []).forEach(function (cy) {
      if (cy.type !== 'capital' && cy.type !== 'zhou') return;
      var g = mp.gxy ? mp.gxy(cy.x, cy.y) : null;
      if (!g) return;
      if (g.x < -8 || g.x > cv.width + 8 || g.y < -8 || g.y > cv.height + 8) offC++;
    });
    return { w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), ringWarm: n, offCity: offC,
      vw: window.innerWidth, vh: window.innerHeight };
  });
  chk('① 界面铺满视口（1920×1080 无留白）', m1.w === 1920 && m1.h === 1080 && m1.left === 0,
    m1.w + '×' + m1.h + ' left=' + m1.left);
  /* ①-b 视野移到地图角落（保证有"视野外名城"—— 改前正是在这种场景画箭头）再量 */
  var m1b = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.mapCenterOn(4, 4);
    var cv = document.getElementById('mapCanvas');
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    var RING = 12, n = 0;
    for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
      if (!(x < RING || y < RING || x > cv.width - RING || y > cv.height - RING)) continue;
      var i = (cv.width * y + x) << 2;
      var r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      if (r0 > 200 && g0 > 180 && b0 < 160 && r0 - b0 > 60) n++;
    }
    var offC = 0;
    (G.state.map.cities || []).forEach(function (cy) {
      if (cy.type !== 'capital' && cy.type !== 'zhou') return;
      var g = G.map.gxy ? G.map.gxy(cy.x, cy.y) : null;
      if (g && (g.x < -8 || g.x > cv.width + 8 || g.y < -8 || g.y > cv.height + 8)) offC++;
    });
    return { ringWarm: n, offCity: offC };
  });
  /* 像素判据交给专用对照脚本（measure_v89139_arrow.js：改前 2723 vs 改后 2546，
     差 177px 正是箭头字符）—— 这里只出图 + 打印信息，避免地形暖色误判。 */
  console.log('   ①-b 视野角落场景：环带暖黄 ' + m1b.ringWarm + ' px（对照见 measure_v89139_arrow.js）');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-map-corner.png' });
  await p.evaluate(function () { var G = window.GAME; G.ui.mapCenterOn(G.state.cities[0].x, G.state.cities[0].y); });
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-map-1920.png' });

  console.log('===== ② 缩略图：默认只当前城 vs「我城」档 =====');
  await p.evaluate(function () { window.GAME.ui.openMinimap(); });
  await p.waitForTimeout(500);
  var m2a = await p.evaluate(function () {
    var big = document.getElementById('mini-big');
    var d = big.getContext('2d').getImageData(0, 0, big.width, big.height).data;
    var red = 0, n = big.width * big.height;
    for (var i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b2 = d[i * 4 + 2];
      /* 只认我城红 `#ff3a2a`（255,58,42）——排除都城朱红 `#ff5a40`（255,90,64） */
      if (r > 230 && g > 30 && g < 80 && b2 > 20 && b2 < 55) red++;
    }
    var opts = Array.prototype.slice.call(document.querySelectorAll('#mini-level option')).map(function (o) { return o.value; });
    return { red: red, opts: opts };
  });
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-mini-default.png' });
  await p.evaluate(function () { window.GAME.ui.setMiniFilter('level', 'mine'); });
  await p.waitForTimeout(500);
  var m2b = await p.evaluate(function () {
    var big = document.getElementById('mini-big');
    var d = big.getContext('2d').getImageData(0, 0, big.width, big.height).data;
    var red = 0, n = big.width * big.height;
    for (var i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b2 = d[i * 4 + 2];
      /* 只认我城红 `#ff3a2a`（255,58,42）——排除都城朱红 `#ff5a40`（255,90,64） */
      if (r > 230 && g > 30 && g < 80 && b2 > 20 && b2 < 55) red++;
    }
    return { red: red };
  });
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-mini-mine.png' });
  chk('② 筛选含「我城」档', m2a.opts.join(',').indexOf('mine') >= 0, m2a.opts.join('/'));
  chk('② 默认档红点 = 当前城 1 座（< 我城档）', m2a.red > 0 && m2b.red > m2a.red,
    '默认 ' + m2a.red + ' px → 我城档 ' + m2b.red + ' px（3 城）');
  await p.evaluate(function () {
    window.GAME.ui._miniFilter = { level: '', state: '', jun: '' };
    window.GAME.ui._miniViewCache = null;
    window.GAME.ui.closeAllModals();
  });

  console.log('===== ③ 采集点击静默（不重开面板） =====');
  var m3 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.openLandModal(o.wx, o.wy);
    window.__mut = 0;
    var ob = new MutationObserver(function () { window.__mut++; });
    ob.observe(document.getElementById('modal-root'), { childList: true, subtree: true });
    var btn = document.querySelector('[data-action="wild-garrison-gather"]');
    if (!btn) return { err: '无设置采集按钮' };
    if (btn.disabled) return { err: '按钮被禁用' };
    btn.click();
    return { clicked: true };
  }, init);
  await p.waitForTimeout(400);
  var m3b = await p.evaluate(function () {
    var G = window.GAME;
    var g = G.gatherAt ? G.gatherAt(window.__wx || 0, window.__wy || 0) : null;
    return { mut: window.__mut };
  });
  chk('③ 点击「设置采集」后 400ms 内无面板重建（改前会重开 1 次）',
    !m3.err && m3b.mut === 0, (m3.err || '') + ' DOM 变动 ' + m3b.mut + ' 次');
  var m3c = await p.evaluate(function () {
    var G = window.GAME;
    var seg = document.querySelector('#modal-root').innerHTML;
    return { hasProgress: seg.indexOf('已采') >= 0 || seg.indexOf('设置采集') >= 0,
      isGathering: (G.gatherList() || []).length > 0 };
  });
  chk('③ 采集已后台开始（gatherList ≥ 1）', m3c.isGathering, '在采 ' + (m3c.isGathering ? 1 : 0) + ' 队');

  console.log('===== ④ 己方野地面板（文案精简） =====');
  var m4 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openLandModal(o.wx, o.wy);
    var seg = document.querySelector('#modal-root').innerHTML;
    return {
      noOwn: seg.indexOf('（已占）') < 0,
      noGuard: seg.indexOf('守军约') < 0,
      noProd: seg.indexOf('op-zone-t">产出') < 0 && seg.indexOf('产量加成') < 0,   /* v89.152：已占不显示产出行 */
      noDecay: seg.indexOf('等级衰减') < 0,
      twoBtn: seg.indexOf('⚙️ 设置采集') >= 0 && seg.indexOf('📦 收获') >= 0,
      recallN: (seg.match(/🏳️ 召回/g) || []).length
    };
  }, init);
  chk('④ 无（已占）/ 无守军行 / 不显示产出行（v89.152）', m4.noOwn && m4.noGuard && m4.noProd);
  chk('④ 无等级衰减行 · 采集区两按钮 · 召回仅剩驻军那颗', m4.noDecay && m4.twoBtn && m4.recallN === 1,
    '召回 ' + m4.recallN + ' 处');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-land.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ⑤ 战场：2 列 / 全兵种 / 无副标题 / 距离 =====');
  var m5 = await p.evaluate(function () {
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
    return { bid: Object.keys(G._bsess || {})[0], all: all.length };
  });
  if (m5.err) { chk('⑤ 战场造局', false, m5.err); }
  else {
    await p.evaluate(function (bid) { window.GAME.ui.closeAllModals(); window.GAME.ui.openBattlefield(bid); }, m5.bid);
    await p.waitForTimeout(700);
    var m5b = await p.evaluate(function () {
      var cards = document.querySelectorAll('#bt-side-atk .bt-card').length;
      var off = document.querySelectorAll('#bt-side-atk .bt-card.off').length;
      var seg = document.querySelector('#modal-root').innerHTML;
      var wrapEl = document.querySelector('#bt-side-atk .bt-cards');
      var cs = wrapEl ? getComputedStyle(wrapEl).gridTemplateColumns : '-';
      var cardEl = document.querySelector('#bt-side-atk .bt-card');
      return { cards: cards, off: off, cols: cs,
        cardH: cardEl ? +cardEl.getBoundingClientRect().height.toFixed(1) : 0,
        cardsH: wrapEl ? Math.round(wrapEl.getBoundingClientRect().height) : 0,
        noSub: seg.indexOf('战斗待指挥') < 0,
        gapTxt: (function () { var el = document.querySelector('.bt-top'); return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 60) : '-'; })() };
    });
    chk('⑤ 侧栏全兵种 2 列（17 格 = 12 参战 + 5 灰暗）',
      m5b.cards === 17 && m5b.off === 5 && m5b.cols.split(' ').length === 2,
      m5b.cards + ' 格（灰 ' + m5b.off + '）· 列 ' + m5b.cols + ' · 格高 ' + m5b.cardH + ' · 总高 ' + m5b.cardsH);
    chk('⑤ 副标题备注已去掉', m5b.noSub);
    var m5c = await p.evaluate(function () {
      var G = window.GAME;
      var T = G.tactic;
      return { D: T.battlefieldOf({ tieji: 100 }, { tieji: 100 }, 0, {}),
        D2: T.battlefieldOf({ tieji: 100 }, { changqiang: 100 }, 0, {}) };
    });
    chk('⑤ 距离随速度放大（铁骑互冲 2400）', m5c.D === 2400, '铁骑 ' + m5c.D + ' / 铁骑vs长枪 ' + m5c.D2);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89139-bt2col.png' });
    await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  }

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  console.log('\n========================');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  console.log('========================');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
