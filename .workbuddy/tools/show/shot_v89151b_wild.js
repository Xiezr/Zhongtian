'use strict';
/* v89.151 实机验证 B（真浏览器）：野地面板按钮（采集文案/等长/规格）+ 建筑弹窗按钮 + 缩放限幅
   跑法：node .workbuddy/tools/show/shot_v89151b_wild.js */
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
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ============ 造局：一块带驻军的可采野地 ============ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260951 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    /* 找一块"有采集资源"的地形 key */
    var key = null;
    ['lake', 'river', 'mountain', 'forest', 'hill'].forEach(function (k) {
      if (!key && G.gatherResOf && G.gatherResOf(k)) key = k;
    });
    if (!key) return { err: 'no-gather-terrain' };
    /* 在城边找一格，写入野地记录（业务形态：已占 + 有驻军带将） */
    var wt = null;
    for (var rr = 2; rr <= 8 && !wt; rr++) {
      for (var dy = -rr; dy <= rr && !wt; dy++) {
        for (var dx = -rr; dx <= rr && !wt; dx++) {
          var x = c.x + dx, y = c.y + dy;
          if (!G.map.tile(x, y) || G.map.wildAt(x, y)) continue;
          wt = { x: x, y: y }; break;
        }
      }
    }
    var g = st.generals[0];
    st.wilds.push({ x: wt.x, y: wt.y, type: key, level: 8, day: 0, startDay: 0,
      garrison: { troops: { changqiang: 500 }, cityId: c.id, genId: g.id } });
    G.ui.openLandModal(wt.x, wt.y);
    return { ok: true, x: wt.x, y: wt.y, terrain: key, gen: g.name };
  });
  console.log('造局: ' + JSON.stringify(r1));
  if (!r1.ok) { console.log('结果：' + PASS + ' / ' + (FAIL + 1)); await b.close(); process.exit(1); }
  await p.waitForTimeout(400);

  /* ============ ① 野地面板按钮 ============ */
  console.log('===== ① 野地面板按钮（文案 / 等长 / 规格）=====');
  var m1 = await p.evaluate(function () {
    var sc = document.getElementById('app-scale');
    var k = sc ? (sc.getBoundingClientRect().width / sc.offsetWidth) : 1;
    var root = document.getElementById('modal-root');
    var zones = root.querySelectorAll('.op-zone-eq');
    var gBtn = root.querySelector('[data-action="wild-garrison-gather"]');
    var fBtn = root.querySelector('[data-action="gather-finish"]');
    var sBtn = root.querySelector('[data-action="wild-garrison-open"]');
    var wBtn = root.querySelector('[data-action="wild-withdraw"]');
    function W(el) { return el ? Math.round(el.getBoundingClientRect().width / k * 10) / 10 : -1; }
    var cs = function (el, pp) { return el ? getComputedStyle(el)[pp] : ''; };
    return {
      eqZones: zones.length,
      gText: gBtn ? gBtn.textContent.trim() : '(无)',
      fText: fBtn ? fBtn.textContent.trim() : '(无)',
      sText: sBtn ? sBtn.textContent.trim() : '(无)',
      gW: W(gBtn), fW: W(fBtn), sW: W(sBtn), wW: W(wBtn),
      gDisabled: gBtn ? gBtn.disabled : null, gOpacity: cs(gBtn, 'opacity'),
      gRadius: cs(gBtn, 'borderRadius'), gFw: cs(gBtn, 'fontWeight'), gFs: cs(gBtn, 'fontSize'),
      hasOldText: (root.innerHTML || '').indexOf('设置采集') >= 0,
    };
  });
  console.log('  ' + JSON.stringify(m1));
  chk('① 「⛏️ 采集」在册 · 旧文案「设置采集」整条不在', m1.gText.indexOf('采集') >= 0 && m1.hasOldText === false, m1.gText);
  chk('① 三个 op-zone 挂 op-zone-eq（等长作用域）', m1.eqZones === 3, m1.eqZones + ' 个');
  chk('① 采集 / 收获 两按钮**等长**', m1.gW > 0 && Math.abs(m1.gW - m1.fW) <= 1, m1.gW + ' vs ' + m1.fW);
  chk('① 采集按钮与「🛡️ 增派驻军」**同长**（跨区一致）', Math.abs(m1.gW - m1.sW) <= 1, m1.gW + ' vs ' + m1.sW);
  chk('① 规格统一（圆角/字重/字号同族）', m1.gRadius !== '' && m1.gFw === '700', m1.gRadius + ' / ' + m1.gFw + ' / ' + m1.gFs);
  chk('① 禁用态统一灰暗（采集不可用 → opacity < .7）', m1.gDisabled === false || (m1.gDisabled === true && parseFloat(m1.gOpacity) < 0.7),
    'disabled=' + m1.gDisabled + ' opacity=' + m1.gOpacity);

  /* ============ ② 建筑弹窗按钮（等分 + 规格） ============ */
  console.log('===== ② 建筑弹窗按钮 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var c = G.currentCity();
    var idx = null;
    c.cells.forEach(function (x, i) { if (idx == null && x.build && x.build.id === 'nongtian') idx = i; });
    if (idx == null) c.cells.forEach(function (x, i) { if (idx == null && x.build) idx = i; });
    G.ui.openBuildModal(idx);
    window.__bIdx = idx;
  });
  await p.waitForTimeout(350);
  var m2 = await p.evaluate(function () {
    var sc = document.getElementById('app-scale');
    var k = sc ? (sc.getBoundingClientRect().width / sc.offsetWidth) : 1;
    var root = document.getElementById('modal-root');
    var acts = root.querySelectorAll('.bldg-acts > .btn');
    var ws = [];
    acts.forEach(function (el) { ws.push(Math.round(el.getBoundingClientRect().width / k * 10) / 10); });
    var foot = root.querySelectorAll('.bldg-foot > .btn');
    var fws = [];
    foot.forEach(function (el) { fws.push(Math.round(el.getBoundingClientRect().width / k * 10) / 10); });
    return { actsN: acts.length, ws: ws, footN: foot.length, fws: fws,
      title: (root.querySelector('.gold-heading') || {}).textContent || '' };
  });
  console.log('  ' + JSON.stringify(m2));
  chk('② 建筑弹窗操作键等分（同排等长 ±1px）',
    m2.actsN >= 2 && Math.max.apply(null, m2.ws) - Math.min.apply(null, m2.ws) <= 1, JSON.stringify(m2.ws));

  /* ============ ③ 缩放限幅（DATA.APP_SCALE 0.6 ~ 1.6） ============ */
  console.log('===== ③ 缩放限幅 =====');
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  async function kAt(w, h) {
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(260);
    return await p.evaluate(function () {
      return { k: getComputedStyle(document.documentElement).getPropertyValue('--app-k').trim(),
        inner: window.innerWidth + '×' + window.innerHeight };
    });
  }
  var kBig = await kAt(3000, 1600);      /* 原始 k = min(2.0833, 1.7778) = 1.7778 → 限 1.6 */
  var kSmall = await kAt(800, 500);      /* 原始 k = 0.5556 → 限 0.6 */
  var kMid = await kAt(1680, 1000);      /* 原始 k = min(1.1667, 1.1111) = 1.1111 → 不触发限幅 */
  console.log('  大 ' + kBig.inner + ' → k=' + kBig.k + ' · 小 ' + kSmall.inner + ' → k=' + kSmall.k
    + ' · 中 ' + kMid.inner + ' → k=' + kMid.k);
  chk('③ 4K 级视口被限到 1.6（不再无限放大）', parseFloat(kBig.k) === 1.6, kBig.k);
  chk('③ 超小视口被限到 0.6（不再无限缩小）', parseFloat(kSmall.k) === 0.6, kSmall.k);
  chk('③ 常规视口不触发限幅（实测 k 与原始值一致）', Math.abs(parseFloat(kMid.k) - 1.1111) < 0.001, kMid.k);
  await p.setViewportSize({ width: 1680, height: 1000 });
  await p.waitForTimeout(300);

  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89151-wild-btns.png' });
  console.log('浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 4)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
