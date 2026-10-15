/* v89.210 实机验收：键盘流 · 状态条 · 战前推演（真浏览器 + 真 UI 链路）
   ------------------------------------------------------------
   ① 键盘真按键：Shift+Digit3 → 公文 · Digit1 → 城池 · 弹窗护栏
   ② 状态条：真渲染（chips 数/几何/文案）+ chip 真点跳转
   ③ 弹窗键盘流：开窗焦点在弹窗内 + Tab 真按仍在内（真机焦点环）
   ④ 战前推演：真点「🎬 推演」→ 面板真渲染 + 零落账；✕ 关闭 → 弹栈回填（输入值保留）
   ------------------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* 起局 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v210', cityName: '许都', region: '碎垣', mapSeed: 20261010 });
    if (!G.state.map.grid) G.map.generate();
    G.state.world.weather = 'clear';
    G.ui.enterGame();
    G.ui.closeAllModals();
  });
  await sleep(500);

  /* ══ ① 键盘真按键 ══ */
  await p.keyboard.press('Shift+Digit3');
  await sleep(180);
  var v1 = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('① Shift+3 → 公文视图（真按键 · view=' + v1 + '）', v1 === 'reports');
  await p.keyboard.press('Digit1');
  await sleep(180);
  var v2 = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('①b 数字键 1 仍切城池（旧键位不回退）', v2 === 'city');
  await p.evaluate(function () { window.GAME.ui.openModal('<div class="gold-heading">护栏210</div><div class="ui-sub">x</div>'); });
  await sleep(250);
  await p.keyboard.press('Shift+Digit4');
  await sleep(180);
  var v3 = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('①c 弹窗开着 Shift+4 不切视图（护栏）', v3 === 'city');
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(250);

  /* ══ ② 状态条 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    st.world.weather = 'rain';
    if (st.cities.length < 2) st.cities.push(G.makeCity({ id: 'sky210p', name: '陪都', x: st.cities[0].x + 6, y: st.cities[0].y + 6 }));
    G.heartsWarAdd(st.cities[0], 90);
    st.cities[0].res.grain = G.storeCapOf(st.cities[0]) + 50000;
    G.ui.syncHeader();
  });
  await sleep(500);
  var s2 = await p.evaluate(function () {
    var G = window.GAME;
    var chips = document.querySelectorAll('#nav-sky .sky-badge');
    var nav = document.getElementById('nav-sky');
    var nr = nav.getBoundingClientRect();
    var inside = true, lastRight = 0;
    for (var i = 0; i < chips.length; i++) {
      var r = chips[i].getBoundingClientRect();
      if (r.left < nr.left - 1 || r.right > nr.right + 1) inside = false;
      lastRight = Math.max(lastRight, r.width);
    }
    return {
      n: chips.length, inside: inside, minW: lastRight,
      txt: nav.textContent.slice(0, 80),
      ids: Array.prototype.map.call(chips, function (c) { return c.className; }).join('|'),
    };
  });
  chk('② 状态条真渲染（' + s2.n + ' 枚 · 全部落在天时块内=' + s2.inside + ' · 宽度≥' + Math.round(s2.minW) + 'px）',
    s2.n === 3 && s2.inside && s2.minW > 30, JSON.stringify(s2.ids));
  chk('②b chips 文案（⚔ / 💔 / 🔥）', s2.txt.indexOf('⚔') >= 0 && s2.txt.indexOf('💔') >= 0 && s2.txt.indexOf('🔥') >= 0, s2.txt);
  await p.locator('#nav-sky').screenshot({ path: E + 'v89210-sky.png' });
  /* chip 真点：民心 chip → 跳到该城 */
  var s2b = await p.evaluate(function () {
    var G = window.GAME;
    var c = document.querySelector('#nav-sky .sky-badge.sky-hearts');
    if (c) c.click();
    return { want: G.state.cities[0].id };
  });
  await sleep(400);
  var s2c = await p.evaluate(function () { return { view: window.GAME.ui.view, city: window.GAME.ui._cityId }; });
  chk('②c 民心 chip 真点 → 跳到该城（view=' + s2c.view + ' · city=' + s2c.city + '）',
    s2c.view === 'city' && s2c.city === s2b.want, JSON.stringify(s2c) + ' / want=' + s2b.want);

  /* ══ ③ 弹窗键盘流（真机焦点） ══ */
  await p.evaluate(function () { window.GAME.ui.openStore(); });
  await sleep(500);
  var k1 = await p.evaluate(function () {
    var ae = document.activeElement;
    var root = document.getElementById('modal-root');
    return { inModal: !!(ae && root && root.contains(ae)), tag: ae ? ae.tagName : '', cls: ae ? (ae.className || '') : '' };
  });
  chk('③ 开窗即给焦点（焦点在弹窗内 · ' + k1.tag + '.' + String(k1.cls).slice(0, 24) + '）', k1.inModal);
  await p.keyboard.press('Tab');
  await sleep(120);
  await p.keyboard.press('Tab');
  await sleep(120);
  var k2 = await p.evaluate(function () {
    var ae = document.activeElement;
    var root = document.getElementById('modal-root');
    return { inModal: !!(ae && root && root.contains(ae)), tag: ae ? ae.tagName : '', txt: ae ? (ae.textContent || '').slice(0, 12) : '' };
  });
  chk('③b Tab 真按 ×2 仍圈在弹窗内（' + k2.tag + ' 「' + k2.txt + '」）', k2.inModal);
  await p.locator('#modal-root .modal').screenshot({ path: E + 'v89210-kbd.png' });
  await p.keyboard.press('Escape');
  await sleep(300);
  var k3 = await p.evaluate(function () { return window.GAME.ui.modalVisible(); });
  chk('③c Esc 关弹窗（既有键位不回归）', k3 === false);

  /* ══ ④ 战前推演 ══ */
  var sim = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c0 = st.cities[0];
    var g0 = st.generals[0];
    g0.status = 'idle'; g0.cityId = c0.id;
    G.setStaNow(g0, G.staMax(g0)); g0.energy = 100;
    var cap = G.battle.marchCapOf(c0);
    var send = Math.max(500, Math.min(20000, cap > 0 ? cap : 20000));
    c0.army = { yibing: send + 500 };
    var w = null;
    for (var rr = 1; rr <= 30 && !w; rr++) {
      for (var dy = -rr; dy <= rr && !w; dy++) for (var dx = -rr; dx <= rr && !w; dx++) {
        var x = c0.x + dx, y = c0.y + dy;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.fortAt(x, y)) continue;
        if (!(G.map.wildLevelNow(x, y) > 0)) continue;
        w = { x: x, y: y };
      }
    }
    G.ui._expMode = 'occupy';
    G.ui.openExpModal({ kind: 'wild', x: w.x, y: w.y });
    window.__sim210 = { send: send, army: c0.army.yibing, reports: (st.reports || []).length, marches: (st.marches || []).length };
    return { send: send, w: w };
  });
  await sleep(450);
  await p.evaluate(function () {
    var G = window.GAME;
    var inp = document.getElementById('exp-yibing');
    if (inp) inp.value = String(window.__sim210.send);
    var gs = document.getElementById('exp-gen');
    if (gs) gs.value = G.state.generals[0].id;
  });
  var btnOK = await p.evaluate(function () { return !!document.querySelector('#modal-root [data-action="exp-sim"]'); });
  chk('④ 出征面板「🎬 推演」键在册（真渲染）', btnOK);
  await p.locator('#modal-root [data-action="exp-sim"]').click({ timeout: 4000 });
  await sleep(600);
  var pv = await p.evaluate(function () {
    var G = window.GAME;
    var txt = (document.getElementById('modal-root') || document.body).textContent || '';
    var c0 = G.state.cities[0];
    var want = window.__sim210 || {};
    return {
      txt: txt.slice(0, 160),
      has: txt.indexOf('沙盘推演') >= 0 && txt.indexOf('推演结果') >= 0 && txt.indexOf('同一战斗引擎') >= 0,
      armyNow: c0.army.yibing,
      reportsNow: (G.state.reports || []).length,
      marchesNow: (G.state.marches || []).length,
      armyWant: want.army, reportsWant: want.reports, marchesWant: want.marches,
    };
  });
  chk('④b 推演面板真渲染（结果 / 损失 / 口径注明）', pv.has, pv.txt.slice(0, 100));
  chk('④c 推演零落账（兵 ' + pv.armyNow + '=' + pv.armyWant + ' · 战报/行军未增）',
    pv.armyNow === pv.armyWant && pv.reportsNow === pv.reportsWant && pv.marchesNow === pv.marchesWant,
    JSON.stringify({ a: [pv.armyNow, pv.armyWant], r: [pv.reportsNow, pv.reportsWant], m: [pv.marchesNow, pv.marchesWant] }));
  await p.screenshot({ path: E + 'v89210-sim.png' });
  /* ✕ 关闭 → 弹栈回出征面板：输入值保留（v89.210 弹栈回填） */
  await p.locator('#modal-root .modal-x').click();
  await sleep(500);
  var back = await p.evaluate(function () {
    var G = window.GAME;
    var inp = document.getElementById('exp-yibing');
    var txt = (document.getElementById('modal-root') || document.body).textContent || '';
    return {
      val: inp ? inp.value : '(no-input)',
      backPanel: txt.indexOf('沙盘推演') < 0 && txt.indexOf('派遣兵力') >= 0,
      want: String(window.__sim210.send),
    };
  });
  chk('④d 弹栈回出兵面板 + 输入值保留（' + back.val + '）', back.backPanel && back.val === back.want,
    JSON.stringify(back));
  await p.screenshot({ path: E + 'v89210-back.png' });

  console.log('\n===== 实机验收：' + PASS + ' 通过 / ' + FAIL + ' 失败 =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
