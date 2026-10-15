/* ============================================================
 * shot_v89103b_field.js — 实时战场（bt-field）实机截图 + 几何量测
 * ------------------------------------------------------------
 * v89.103 改了实时战场两处：① 共享距离轴（两军能照面）② 敌方兵牌下移半行（不叠牌）。
 * 这条脚本就是复量它：截图 + 量"我方最右兵牌 / 敌方最左兵牌"的横坐标差。
 * 用法：node .workbuddy/tools/show/shot_v89103b_field.js
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
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('console', function (m) { if (m.type() === 'error') console.log('  [page:error]', m.text().slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var info = await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    st.settings.battleWatch = true;                 /* 观战：真进战场界面 */
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 5e6; });
    c.army = { yibing: 20000, gongjian: 6000, qingji: 2000 };
    var gen = st.generals[0]; gen.level = 30;
    G.setStaNow(gen, 9999); gen.energy = 100;
    /* 打一场野地仗（守方也会迎击 → 两军对进，轴上的"照面"才看得出来） */
    var t = null;
    for (var y = 4; y < 57 && !t; y++) {
      for (var x = 4; x < 57; x++) {
        var tt = G.map.tile(x, y);
        if (!tt || tt.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 0;
        if (lv >= 5) { t = { x: x, y: y, lv: lv }; break; }
      }
    }
    if (!t) return { err: '没找到目标' };
    /* ⚠️ 必须传**副本**：expedition 会用 `city.army[a] -= atkArmy[a]` 扣兵，
       直接传 c.army 是同一个对象 → 自我清零（v89.102 那条教训，这里又踩了一次） */
    var r = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid', Object.assign({}, c.army), gen.id);
    /* 观战挂起时 G._bsess 里会有一场待打 —— 直接开战场界面（与 onMarchArrive 同一出口） */
    var ids = Object.keys(G._bsess || {});
    if (ids.length && G.ui.openBattlefield) G.ui.openBattlefield(ids[0]);
    return { ok: true, target: t, pending: !!r.pending, sessions: ids.length,
      hasField: !!document.getElementById('bt-field') };
  });
  console.log('开局 =', JSON.stringify(info));
  await new Promise(function (r) { setTimeout(r, 1500); });

  function measure() {
    return page.evaluate(function () {
      var f = document.getElementById('bt-field');
      if (!f) return { err: '没有战场界面（bt-field）' };
      var fb = f.getBoundingClientRect();
      var units = Array.prototype.slice.call(f.querySelectorAll('.bt-unit'));
      var atk = units.filter(function (u) { return u.classList.contains('atk'); });
      var def = units.filter(function (u) { return u.classList.contains('def'); });
      var r = {};
      atk.forEach(function (a) { r[a.dataset.troop] = a.getBoundingClientRect(); });
      var overlap = 0, defLeft = null;
      def.forEach(function (d) {
        var rd = d.getBoundingClientRect();
        if (defLeft === null || rd.left < defLeft) defLeft = rd.left;
        var a = r[d.dataset.troop];
        if (a && Math.abs(a.top - rd.top) < 6 && !(a.right < rd.left || rd.right < a.left)) overlap++;
        var a2 = r[d.dataset.troop];
      });
      var atkRight = null, atkTop = null;
      atk.forEach(function (a) {
        var ra = a.getBoundingClientRect();
        if (atkRight === null || ra.right > atkRight) atkRight = ra.right;
        if (atkTop === null || ra.top < atkTop) atkTop = ra.top;
      });
      var defTop = null;
      def.forEach(function (d) { var rd = d.getBoundingClientRect(); if (defTop === null || rd.top < defTop) defTop = rd.top; });
      return { fieldW: Math.round(fb.width), round: (document.getElementById('bt-round') || {}).textContent,
        atkRight: atkRight === null ? null : Math.round(atkRight - fb.left),
        defLeft: defLeft === null ? null : Math.round(defLeft - fb.left),
        atkTop0: atkTop === null ? null : Math.round(atkTop - fb.top),
        defTop0: defTop === null ? null : Math.round(defTop - fb.top),
        overlap: overlap, nAtk: atk.length, nDef: def.length };
    });
  }
  console.log('实时战场·开局几何 =', JSON.stringify(await measure()));
  await page.screenshot({ path: path.join(OUT, 'v89103-live-field.png') });

  /* 推进几个回合，让两军走到一起 */
  for (var i = 0; i < 4; i++) {
    var done = await page.evaluate(function () {
      var G = window.GAME;
      if (!G._bsess) return false;
      var id = Object.keys(G._bsess)[0];
      var rec = G._bsess[id];
      if (!rec || rec.state === 'done') return true;
      var btn = document.querySelector('#modal-root [data-action="bt-done"]');
      if (btn) btn.click();
      return false;
    });
    await new Promise(function (r) { setTimeout(r, 900); });
    if (done) break;
  }
  var geo = await page.evaluate(function () {
    var f = document.getElementById('bt-field');
    if (!f) return { err: '没有战场界面（bt-field）' };
    var fb = f.getBoundingClientRect();
    var units = Array.prototype.slice.call(f.querySelectorAll('.bt-unit'));
    var atk = units.filter(function (u) { return u.classList.contains('atk'); });
    var def = units.filter(function (u) { return u.classList.contains('def'); });
    function edge(list, rightmost) {
      var best = null;
      list.forEach(function (u) {
        var r = u.getBoundingClientRect();
        var x = rightmost ? r.right : r.left;
        if (best === null || (rightmost ? x > best : x < best)) best = x;
      });
      return best === null ? null : Math.round(best - fb.left);
    }
    /* 同排令牌的纵向错行（我方第 1 队 vs 敌方第 1 队） */
    function topOf(u) { return u ? Math.round(u.getBoundingClientRect().top - fb.top) : null; }
    return {
      fieldW: Math.round(fb.width), fieldH: Math.round(fb.height),
      atkRight: edge(atk, true), defLeft: edge(def, false),
      atkTop0: topOf(atk[0]), defTop0: topOf(def[0]),
      overlap: (function () {
        var r = {};
        atk.forEach(function (a) { r[a.dataset.troop] = a.getBoundingClientRect(); });
        var bad = 0;
        def.forEach(function (d) {
          var a = r[d.dataset.troop];
          if (!a) return;
          var ra = a, rd = d.getBoundingClientRect();
          if (Math.abs(ra.top - rd.top) < 6 && !(ra.right < rd.left || rd.right < ra.left)) bad++;
        });
        return bad;
      })(),
    };
  });
  await page.screenshot({ path: path.join(OUT, 'v89103-live-field.png') });
  console.log('实时战场几何 =', JSON.stringify(geo));
  await browser.close();
  console.log('done');
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
