/* ============================================================
 * shot_v89103.js — v89.103 实机截图 + 几何量测（真浏览器 · 真 index.html）
 * ------------------------------------------------------------
 * 出四张图给老板拍板：
 *   ① 沙盘·接敌中（两条前线各在本军最前部队前方）
 *   ② 沙盘·接触（两条合成一条接触线）
 *   ③ 沙盘·被攻入腹地（劣势方被推回出发线）
 *   ④ 出征界面·本境调运（辎重资源调配区 + 运力）
 * 并用 getBoundingClientRect 量：
 *   前线是否落在场区内、两条前线是否在接触时重合、弹窗是否溢出（不下拉）。
 * 用法：node .workbuddy/tools/show/shot_v89103.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) {
    var alt = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
    exe = fs.existsSync(alt) ? alt : exe;
  }
  console.log('browser =', exe, fs.existsSync(exe) ? '(ok)' : '(MISSING)');
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('console', function (m) { if (m.type() === 'error') console.log('  [page:error]', m.text().slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 建局 + 打一场野地仗（双方都会推进 → 能看到"接敌 → 接触 → 腹地"） ---------- */
  var info = await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    st.settings.battleWatch = false;
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 5e6; });
    c.res.pop = 60000;
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 8); });
    var gen = st.generals[0];
    gen.level = 30;
    G.setStaNow(gen, 9999); gen.energy = 100;
    var t = null;
    for (var y = 4; y < 57 && !t; y++) {
      for (var x = 4; x < 57; x++) {
        var tt = G.map.tile(x, y);
        if (!tt || tt.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 0;
        if (lv >= 7) { t = { x: x, y: y, lv: lv }; break; }
      }
    }
    if (!t) return { err: '没找到高等级野地' };
    var army = { yibing: 20000, changqiang: 9000, gongjian: 6000, qingji: 2500 };
    c.army = Object.assign({}, army);
    G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid', army, gen.id);
    var rep = null;
    (st.reports || []).forEach(function (x) { if (!rep && x.type === 'war') rep = x; });
    if (!rep) return { err: '没生成战报' };
    rep._i = 0;
    G.ui.viewReport(GAME.repRidOf(GAME.state.reports[0]));   /* v89.120：身份 rid */
    var sb = G.battle.sandboxOf(rep);
    if (!sb) return { err: '沙盘不可用' };
    /* 找三帧：接敌中 / 刚接触 / 终局 */
    var K = sb.frames.length;
    var iHot = -1, iEnd = K;
    var stx = G.ui.sdStateInit(sb);
    for (var i = 0; i < K; i++) {
      G.ui.sdApply(stx, sb, sb.frames[i]);
      var fr = G.tactic.frontsOf(stx.atk, stx.def, sb.field);
      if (iHot < 0 && fr.contact) iHot = i + 1;
    }
    window.__v103 = { K: K, iHot: iHot, field: sb.field };
    return { ok: true, K: K, iHot: iHot, field: sb.field, report: rep.title };
  });
  console.log('局面 =', JSON.stringify(info));

  function shot(name) { return page.screenshot({ path: path.join(OUT, name) }); }
  async function geom() {
    return page.evaluate(function () {
      var f = document.getElementById('sd-field');
      if (!f) return null;
      var fb = f.getBoundingClientRect();
      function rect(id) {
        var e = document.getElementById(id);
        if (!e) return null;
        var r = e.getBoundingClientRect();
        var hide = e.classList && e.classList.contains('hide');
        return { x: Math.round(r.left - fb.left), hide: hide,
          txt: (e.querySelector('span') || {}).textContent || '' };
      }
      var body = document.querySelector('#modal-root .m-body');
      return {
        field: { w: Math.round(fb.width), h: Math.round(fb.height) },
        a: rect('sd-fl-a'), d: rect('sd-fl-d'), c: rect('sd-fl-c'),
        overflow: body ? (body.scrollHeight - body.clientHeight) : -1,
        phase: (document.getElementById('sd-phase') || {}).textContent || '',
      };
    });
  }

  /* ① 接敌中：第 1 帧 */
  await page.evaluate(function () { window.GAME.ui.sdSet(1); });
  await new Promise(function (r) { setTimeout(r, 900); });
  var g1 = await geom();
  await shot('v89103-sandbox-approach.png');
  console.log('① 接敌中：' + JSON.stringify(g1));

  /* ② 接触：第一帧"已经交过手" */
  await page.evaluate(function (i) { window.GAME.ui.sdSet(i); }, Math.max(1, info.iHot || Math.round(info.K / 3)));
  await new Promise(function (r) { setTimeout(r, 900); });
  var g2 = await geom();
  await shot('v89103-sandbox-contact.png');
  console.log('② 接触：' + JSON.stringify(g2));

  /* ③ 终局（被攻入腹地） */
  await page.evaluate(function () { window.GAME.ui.sdSet(99999); });
  await new Promise(function (r) { setTimeout(r, 900); });
  var g3 = await geom();
  await shot('v89103-sandbox-end.png');
  console.log('③ 终局：' + JSON.stringify(g3));

  /* ---------- ④ 出征界面·本境调运 ---------- */
  var tr = await page.evaluate(function () {
    var G = window.GAME, st = G.state;
    G.ui.closeModal();
    var A = st.cities[0];
    /* 造分城（先占野地 → 筑城） */
    var cx = null, cy = null;
    for (var rr = 2; rr <= 5 && cx === null; rr++) {
      for (var dy = -rr; dy <= rr && cx === null; dy++) {
        for (var dx = -rr; dx <= rr; dx++) {
          var px = A.x + dx, py = A.y + dy;
          var tt = G.map.tile(px, py);
          if (tt && tt.terrain === 'plain' && !G.map.wildAt(px, py) && !G.map.fortAt(px, py)) { cx = px; cy = py; break; }
        }
      }
    }
    if (cx === null) return { err: '找不到平原' };
    st.wilds = st.wilds || [];
    st.wilds.push({ x: cx, y: cy, type: 'plain', lv: 3, day: 0 });
    var bd = G.buildCityAt(cx, cy);
    if (!bd.ok) return { err: bd.msg };
    A.army = { minfu: 800, yibing: 4000, qingji: 600 };
    G.ui._cityId = A.id;
    G.ui._expMode = 'occupy';
    G.ui.openExpModal({ kind: 'own', id: bd.city.id });
    /* 填一点兵力与辎重，让"实收/运力"有内容 */
    var mf = document.getElementById('exp-minfu'); if (mf) { mf.value = 400; mf.dispatchEvent(new Event('input', { bubbles: true })); }
    var yb = document.getElementById('exp-yibing'); if (yb) { yb.value = 2000; yb.dispatchEvent(new Event('input', { bubbles: true })); }
    G.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      if (el) { el.value = { grain: 30000, wood: 12000, stone: 0, iron: 4000, gold: 8000 }[k] || 0;
        el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    G.ui.syncCargoEst();
    return { ok: true, name: bd.city.name };
  });
  console.log('④ 分城 =', JSON.stringify(tr));
  await new Promise(function (r) { setTimeout(r, 500); });
  var g4 = await page.evaluate(function () {
    var body = document.querySelector('#modal-root .m-body') || document.querySelector('#modal-root .inner-panel');
    var modal = document.querySelector('#modal-root .modal');
    var cap = document.getElementById('exp-cargo-cap');
    var est = document.getElementById('cg-est-grain');
    var foot = document.querySelector('#modal-root [data-action="exp-confirm"]');
    return {
      cap: cap ? cap.textContent : '(缺)',
      grainEst: est ? est.textContent : '(缺)',
      foot: foot ? foot.textContent : '(缺)',
      overflow: body ? (body.scrollHeight - body.clientHeight) : -1,
      modalH: modal ? Math.round(modal.getBoundingClientRect().height) : -1,
      cargoRows: document.querySelectorAll('#modal-root .cg-tbl tbody tr').length,
    };
  });
  await shot('v89103-exp-cargo.png');
  console.log('④ 调运面板：' + JSON.stringify(g4));

  await browser.close();
  console.log('done');
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
