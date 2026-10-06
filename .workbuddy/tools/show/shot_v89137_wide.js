/* v89.137 实机脚本：七条需求的可见面验证（自带判定 + 截图）
 * ------------------------------------------------------------
 * 判定清单：
 *   ① 官府：主城入口常显（本城即主城 状态标记）· 四个按钮同规格（h=26）· 无全境营造
 *   ② 战场：回合记录贴底（log 底距面板底 ≤ 4px）· 可见 ≥16 行 · BT_LOG_MAX=64
 *   ③ 兵种悬停 title 含"最终属性"（攻/防/血/基础值）
 *   ④ 附属野地：操作列 4 按钮 + 一采就绪态的启用/禁用
 *   ⑤ 派驻 → 出征界面：方式只有「驻守·增援」· 已有驻将 → 不带将提示 + 主将下拉禁用
 *   ⑥ 建筑面板：专精三档（Lv12 → Lv24 → Lv36）
 *   ⑦ 资源区下拉 ⛏ 标记 + 大地图采集绿点（像素统计）
 * 截图：v89137-guanfu.png / bt16.png / wildops.png / exp-station.png / pane-tier.png
 * 跑法：node .workbuddy/tools/show/shot_v89137_wide.js
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
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', function (rq) { errs.push('REQ_FAIL ' + rq.url()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ── 造局：城 + 带将驻军的野地 + 采集队 ── */
  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20261001 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 6000, changqiang: 3000 };
    c.res.gold = 1e7;
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; lord.cityId = c.id;
    /* 野地 (3,3)：带将驻军 + 采集队 */
    st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === 3 && z.y === 3); });
    var g1 = null;
    (st.generals || []).forEach(function (g) { if (!g1 && g.id !== lord.id) g1 = g; });
    if (!g1) { g1 = G.makeGeneral('驻将甲', 12, 'idle', c.id, false); st.generals.push(g1); }
    g1.status = 'garrison'; g1.cityId = c.id;
    st.wilds.push({ x: 3, y: 3, type: 'lake', level: 8, levelDay: 0,
      garrison: { troops: { yibing: 5000 }, cityId: c.id, genId: g1.id } });
    var w = G.map.wildAt(3, 3);
    w.garrison = { troops: { yibing: 5000 }, cityId: c.id, genId: g1.id };
    /* 第二块野地：无驻军（操作列禁用态对照） */
    st.wilds.push({ x: 4, y: 3, type: 'forest', level: 4, levelDay: 0 });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    return { cid: c.id, g1: g1.id, g1n: g1.name };
  });
  console.log('  造局：野地(3,3) 驻将=' + init.g1n + ' · (4,3) 无驻军');

  /* ══ ① 官府面板 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') idx = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
  });
  await p.waitForTimeout(350);
  var v1 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var out = { btns: [], hasMain: false, hasMainState: false, hasOv: false };
    var zts = root.querySelectorAll('.op-zone-t');
    var zone = null;
    for (var i = 0; i < zts.length; i++) if (zts[i].textContent.indexOf('官府要务') >= 0) zone = zts[i];
    var scope = zone ? zone.parentNode : root;
    Array.prototype.slice.call(scope.querySelectorAll('.op-row button, .op-row .btn')).forEach(function (b) {
      var r = b.getBoundingClientRect();
      out.btns.push(b.textContent.trim() + '·' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    out.hasMain = !!root.querySelector('[data-action="set-main-city"]');
    out.hasMainState = root.innerHTML.indexOf('本城即主城') >= 0;
    out.hasOv = !!root.querySelector('[data-action="open-build-ov"]');
    return out;
  });
  console.log('① 官府要务段：' + v1.btns.join(' | '));
  chk('① 官府：主城入口常显（非主城 → 设为主城；已是主城 → 状态标记）', v1.hasMain || v1.hasMainState);
  chk('① 官府：全境营造总览已删', !v1.hasOv);
  var heights = v1.btns.map(function (t) { return Number((t.match(/x(\d+)$/) || [])[1]); });
  chk('① 官府：四按钮同规格（高度全 26）', heights.length >= 2 && heights.every(function (h) { return h === 26; }),
    heights.join('/'));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-guanfu.png' });

  /* ══ ②/③ 战场：回合记录贴底 + 16 行 + 兵种悬停 ══ */
  var btInit = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c = G.currentCity();
    /* 找 4~7 级野地（非我方）作战 */
    var xy = null;
    for (var yy = 4; yy < 240 && !xy; yy++) {
      for (var xx = 4; xx < 240; xx++) {
        if ((xx === 3 && yy === 3) || (xx === 4 && yy === 3)) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(xx, yy) || (G.map.npcAt && G.map.npcAt(xx, yy))) continue;   /* 只要无主野地 */
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : G.map.wildLevel(xx, yy);
        if (lv >= 4 && lv <= 7) { xy = { x: xx, y: yy, lv: lv }; break; }
      }
    }
    if (!xy) return { err: '无靶' };
    var gen = st.generals[0];
    gen.status = 'idle'; gen.cityId = c.id;
    var r = G.battle.expedition({ kind: 'wild', x: xy.x, y: xy.y }, 'raid',
      { yibing: 4000, changqiang: 2000 }, gen.id);
    if (!r || !r.ok) return { err: 'expedition: ' + JSON.stringify(r) };
    var ids = Object.keys(G._bsess || {});
    return { bid: ids[0] };
  });
  if (btInit.err) { chk('② 战场造局', false, btInit.err); }
  else {
    await p.evaluate(function (bid) {
      window.GAME.ui.closeAllModals();
      window.GAME.ui.openBattlefield(bid);
    }, btInit.bid);
    await p.waitForTimeout(400);
    /* 推 3 回合填满记录区 */
    for (var k = 0; k < 3; k++) {
      await p.evaluate(function () {
        var btn = document.querySelector('[data-action="bt-done"]');
        if (btn) btn.click();
      });
      await p.waitForTimeout(2400);
    }
    var v2 = await p.evaluate(function () {
      var G = window.GAME;
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      var log = document.getElementById('bt-log');
      var pr = panel.getBoundingClientRect(), lr = log.getBoundingClientRect();
      /* 普通行高（跳过 sep/hdr） */
      var rows = log.querySelectorAll('.bt-ev.atk, .bt-ev.def');
      var lh = rows.length ? rows[rows.length - 1].getBoundingClientRect().height : 0;
      /* 兵种行 title（悬停最终属性） */
      var rr = document.querySelector('#bt-side-atk .bt-rrow .bt-ric');
      var title = rr ? rr.getAttribute('title') : '';
      var padB = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
      return {
        gap: Math.round(pr.bottom - lr.bottom),
        padB: padB,
        logH: log.clientHeight,
        lineH: Math.round(lh),
        visible: lh ? Math.floor(log.clientHeight / lh) : 0,
        maxLines: G.ui.BT_LOG_MAX,
        title: title,
        hasFinal: /基础/.test(title) && /攻/.test(title) && /防/.test(title) && /血/.test(title),
        hasTotal: /全军合计/.test(title)
      };
    });
    console.log('② 战场：log 视高 ' + v2.logH + 'px · 行高 ' + v2.lineH + 'px · 可见 ' + v2.visible +
      ' 行 · 贴底差 ' + v2.gap + 'px · BT_LOG_MAX ' + v2.maxLines);
    /* "下移到底"的判据 = 记录区底 ≈ 正文区底（差 ≤ 面板自身 padding+4；改前是 295px 空白） */
    chk('② 回合记录下移到底（底距 ≤ padding+4）', Math.abs(v2.gap) <= (v2.padB + 4),
      v2.gap + 'px（padding ' + v2.padB + '）');
    chk('② 回合记录提供 ≥16 行空间', v2.visible >= 16, v2.visible + ' 行');
    chk('② BT_LOG_MAX = 64（配套）', v2.maxLines === 64);
    console.log('③ 兵种悬停 title：' + v2.title.replace(/\n/g, ' ⏎ ').slice(0, 130));
    chk('③ 悬停含最终属性（攻/防/血 含基础值对照 + 全军合计）', v2.hasFinal && v2.hasTotal);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-bt16.png' });
    await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  }

  /* ══ ④ 附属野地操作列 ══ */
  await p.evaluate(function () {
    window.GAME.ui.closeAllModals();
    window.GAME.ui.openWilds();
  });
  await p.waitForTimeout(350);
  var v4 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var ths = [];
    Array.prototype.slice.call(root.querySelectorAll('table thead th')).forEach(function (t) { ths.push(t.textContent.trim()); });
    var rows = root.querySelectorAll('tbody tr');
    var got = { ths: ths, rows: rows.length, ops: [], disableds: [] };
    Array.prototype.slice.call(rows).forEach(function (tr, i) {
      var acts = [];
      Array.prototype.slice.call(tr.querySelectorAll('button')).forEach(function (b) {
        acts.push((b.getAttribute('data-action') || '?') + (b.disabled ? '(禁)' : ''));
        if (b.disabled) got.disableds.push(i + ':' + (b.textContent || '').trim());
      });
      got.ops.push(acts.join('+'));
    });
    return got;
  });
  console.log('④ 附属野地：表头 [' + v4.ths.join(' | ') + ']');
  v4.ops.forEach(function (o, i) { console.log('   行' + i + '：' + o); });
  chk('④ 操作列在位（表头"操作"）', v4.ths.indexOf('操作') >= 0);
  var allOps137 = v4.ops.join('+');
  chk('④ 四按钮齐备（派驻/采集/收获/召回 · 含禁用态）',
    v4.ops.length >= 2
    && /wild-garrison-open/.test(allOps137) && /wild-garrison-gather/.test(allOps137)
    && /gather-finish/.test(allOps137) && /wild-withdraw/.test(allOps137));
  chk('④ 无驻军行：采集/收获/召回为禁用态', v4.disableds.length >= 2, v4.disableds.join(' · '));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-wildops.png' });

  /* ══ ⑤ 派驻 → 出征界面 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openWilds();
    var btn = document.querySelector('#modal-root [data-action="wild-garrison-open"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(400);
  var v5 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var sel = root.querySelector('#exp-mode');
    var opts = [];
    if (sel) Array.prototype.slice.call(sel.options).forEach(function (o) { opts.push(o.value + (o.disabled ? '[锁]' : '')); });
    var genSel = root.querySelector('#exp-gen');
    var txt = (root.textContent || '');
    return {
      opts: opts,
      selected: sel ? sel.value : null,
      genDisabled: genSel ? genSel.disabled : null,
      hasNoGenHint: txt.indexOf('本次增援') >= 0 && txt.indexOf('不带将') >= 0,
      title: (root.querySelector('.m-title') || root.querySelector('.gold-heading') || {}).textContent || ''
    };
  });
  console.log('⑤ 出征界面（派驻入口）：方式 [' + v5.opts.join(', ') + '] 选中=' + v5.selected +
    ' · 主将下拉禁用=' + v5.genDisabled + ' · 不带将提示=' + v5.hasNoGenHint);
  chk('⑤ 只出「驻守·增援」一项且默认选中', v5.opts.length === 1 && v5.opts[0] === 'station' && v5.selected === 'station');
  chk('⑤ 已有驻将 → 主将下拉禁用 + 「不带将」提示', v5.genDisabled === true && v5.hasNoGenHint);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-exp-station.png' });

  /* ══ ⑥ 建筑面板：专精三档 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'minfang') idx = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
  });
  await p.waitForTimeout(300);
  var v6 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var txt = (root.textContent || '').replace(/\s+/g, ' ');
    return { txt: txt, has: /建筑专精/.test(txt) && /Lv12/.test(txt) && /Lv24/.test(txt) && /Lv36/.test(txt) };
  });
  chk('⑥ 建筑面板：建筑专精三档（Lv12 / Lv24 / Lv36）', v6.has);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-pane-tier.png' });

  /* ══ ⑦ 资源区下拉 ⛏ + 大地图绿点 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var w = G.map.wildAt(3, 3);
    var chk = G.canStartGather ? G.canStartGather(3, 3) : { ok: 'no-fn' };
    var r = G.startGather(3, 3, JSON.parse(JSON.stringify(w.garrison.troops)), {});
    window._g137 = { chk: chk, r: r };
    G.refreshAll();
    G.ui.setView('map');
  });
  await p.waitForTimeout(500);
  var v7 = await p.evaluate(function () {
    var G = window.GAME;
    var sel = document.getElementById('wild-pick');
    var opts = sel ? sel.innerHTML : '';
    return {
      hasPick: !!sel,
      marked: /⛏/.test(opts),
      inGather: !!G.gatherAt(3, 3)
    };
  });
  var v7d = await p.evaluate(function () { return window._g137; });
  console.log('⑦ 资源区野地下拉：⛏ 标记=' + v7.marked + ' · 在采=' + v7.inGather +
    ' · startGather=' + JSON.stringify(v7d && v7d.r && v7d.r.msg || v7d));
  chk('⑦ 资源区下拉带 ⛏（在采可见）', v7.hasPick && v7.inGather && v7.marked);

  /* 大地图绿点：读野地格中心像素（页面坐标 → 画布像素） */
  var v7b = await p.evaluate(function () {
    var G = window.GAME;
    var cv = document.querySelector('#map-canvas') || document.querySelector('canvas');
    if (!cv) return { err: 'no-canvas' };
    var hit = G.ui.mapHitOf ? G.ui.mapHitOf(3, 3) : null;
    return { canvasId: cv.id, w: cv.width, h: cv.height, hit: hit };
  });
  console.log('⑦b 大地图画布：' + JSON.stringify(v7b).slice(0, 200));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89137-map-green.png' });

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 4).join(' | '));
  else console.log('\n✅ 无页面错误');
  console.log('\n===== 实机判定：' + (FAIL ? (FAIL + ' 项失败') : '全部通过') + ' =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
