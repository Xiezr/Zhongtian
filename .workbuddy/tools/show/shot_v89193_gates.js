module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  var fails = 0;
  function chk(tag, ok, extra) {
    console.log((ok ? '✅ ' : '❌ ') + tag + (extra ? '  [' + extra + ']' : ''));
    if (!ok) fails++;
    return ok;
  }

  /* boot */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '越王勾践', cityName: '会稽', region: '扬州', mapSeed: 20260931 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
  });

  /* ① 时间跳变补偿（老板 3 的实机复现：过夜回来应看到募兵完成） */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var bIdx = -1;
    for (var i = 0; i < c.cells.length; i++) {
      var cl = c.cells[i];
      if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'junying', lvl: 3 }; bIdx = i; break; }
    }
    c.res.grain = 5e6; c.res.wood = 5e6; c.res.iron = 5e6; c.res.pop = 1e5;
    G.train('yibing', 500, c.id, bIdx);
    G._loopLastAt = Date.now() - 3 * 3600 * 1000;   /* 拨钟：模拟睡眠 3 小时 */
  });
  await new Promise(function (r) { setTimeout(r, 3200); });   /* 等主循环 2~3 tick */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var toastTxt = (document.getElementById('toast') || {}).textContent || '';
    return { q: G.state.queues.train.length, army: JSON.stringify(c.army || {}),
      toast: toastTxt.slice(0, 100) };
  });
  chk('① 拨钟 3h → 主循环补算：队列推完 + 500 兵入营', r2.q === 0 && r2.army.indexOf('500') >= 0, JSON.stringify(r2));
  chk('①b 时间跳变 toast（≥5 分钟给轻提示）', r2.toast.indexOf('时间跳变') >= 0, r2.toast);
  await p.screenshot({ path: E + 'v89193-gap.png' });
  await p.evaluate(function () { var t = document.getElementById('toast'); if (t) t.textContent = ''; });

  /* ② 导航栏按钮 + 空态总览（真点） */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('map');
    var btn = document.querySelector('[data-action="open-outposts"]');
    if (btn) btn.click();
    return { btn: !!btn };
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  var r4 = await p.evaluate(function () {
    var t = (document.querySelector('#modal-root .inner-panel') || {}).textContent || '';
    return { hasTitle: t.indexOf('我方前哨') >= 0, hasEmpty: t.indexOf('尚未占据任何前哨') >= 0,
      has5: t.indexOf('每城上限 5') >= 0 };
  });
  chk('② 导航栏「🚩 前哨」→ 总览（空态 + 每城上限 5）',
    r3.btn && r4.hasTitle && r4.hasEmpty && r4.has5, JSON.stringify(r4));
  await p.screenshot({ path: E + 'v89193-outposts-empty.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ③ 造前哨（真调 claimFort，Lv9/Lv4/Lv4）→ 总览有行 */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var spots = [];
    for (var r = 2; r <= 20 && spots.length < 3; r++) {
      for (var dy = -r; dy <= r && spots.length < 3; dy++) {
        for (var dx = -r; dx <= r && spots.length < 3; dx++) {
          if (dx === 0 && dy === 0) continue;
          var tl = G.map.tile(c.x + dx, c.y + dy);
          if (!tl || tl.terrain === 'city' || tl.terrain === 'water') continue;
          spots.push({ x: c.x + dx, y: c.y + dy });
        }
      }
    }
    var out = [];
    spots.forEach(function (s, i) {
      var rr = G.claimFort({ kind: 'fort', fort: { x: s.x, y: s.y, level: i === 0 ? 9 : 4, name: '前哨' + (i + 1) } }, null, c, {});
      out.push(rr.ok ? 'ok' : JSON.stringify(rr).slice(0, 40));
    });
    return { out: out, n: Object.keys(G.fortsOf()).length };
  });
  chk('③ 真调 claimFort 造 3 哨（Lv9/Lv4/Lv4）', r5.out.join(',') === 'ok,ok,ok', JSON.stringify(r5));
  await p.evaluate(function () { window.GAME.ui.openOutposts(); });
  await new Promise(function (r) { setTimeout(r, 600); });
  var r7 = await p.evaluate(function () {
    var el = document.querySelector('#modal-root .inner-panel') || {};
    var t = el.textContent || '', html = el.innerHTML || '';
    return { hasRow: t.indexOf('前哨1') >= 0, hasLv9: t.indexOf('Lv9') >= 0,
      hasRadius: t.indexOf('14 格') >= 0, hasGoto: html.indexOf('data-action="fort-goto"') >= 0,
      hasMine: t.indexOf('3/5') >= 0 };
  });
  chk('③b 总览行（名称/Lv9/辐射14格/定位按钮/本城 3/5）',
    r7.hasRow && r7.hasLv9 && r7.hasRadius && r7.hasGoto && r7.hasMine, JSON.stringify(r7));
  await p.screenshot({ path: E + 'v89193-outposts.png' });

  /* ④ 前哨格面板（openLandModal 落点，点"前哨1"格） */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var fs = G.fortsOf();
    var k = Object.keys(fs).filter(function (kk) { return fs[kk].name === '前哨1'; })[0];
    G.ui.openLandModal(fs[k].x, fs[k].y);
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  var r9 = await p.evaluate(function () {
    var t = (document.querySelector('#modal-root .inner-panel') || {}).textContent || '';
    return { hasOwn: t.indexOf('我方前哨') >= 0, hasProt: t.indexOf('前哨护持') >= 0,
      hasTax: t.indexOf('商旅税所') >= 0, hasOverview: t.indexOf('前哨总览') >= 0,
      noGuard: t.indexOf('守军约') < 0 };
  });
  chk('④ 前哨格 → 前哨面板（护持/税所/总览入口 · 无"守军约"错误信息）',
    r9.hasOwn && r9.hasProt && r9.hasTax && r9.hasOverview && r9.noGuard, JSON.stringify(r9));
  await p.screenshot({ path: E + 'v89193-outpost-panel.png' });

  /* ④b 面板内真点「前哨总览」 */
  var r10 = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="open-outposts"]');
    var has = !!btn;
    if (btn) btn.click();
    return { has: has };
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  var r11 = await p.evaluate(function () {
    var t = (document.querySelector('#modal-root .inner-panel') || {}).textContent || '';
    return { title: t.indexOf('我方前哨（共') >= 0 };
  });
  chk('④b 面板内真点「前哨总览」→ 总览在顶', r10.has && r11.title, JSON.stringify(r11));
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ⑤ 满员受阻：填满本城 5 哨 → 未占据点面板的 occupy 受阻 */
  var r12 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var spots = [];
    for (var r = 2; r <= 25 && spots.length < 4; r++) {
      for (var dy = -r; dy <= r && spots.length < 4; dy++) {
        for (var dx = -r; dx <= r && spots.length < 4; dx++) {
          if (dx === 0 && dy === 0) continue;
          var tl = G.map.tile(c.x + dx, c.y + dy);
          if (!tl || tl.terrain === 'city' || tl.terrain === 'water') continue;
          if (G.fortOwnAt(c.x + dx, c.y + dy)) continue;
          spots.push({ x: c.x + dx, y: c.y + dy });
        }
      }
    }
    spots.forEach(function (s, i) {
      G.claimFort({ kind: 'fort', fort: { x: s.x, y: s.y, level: 5, name: '填满' + i } }, null, c, {});
    });
    var hit = null;
    for (var r = 2; r <= 40 && !hit; r++) {
      for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
        var f = G.map.fortAt(c.x + dx, c.y + dy);
        if (f) hit = f;
      }
    }
    if (hit) G.ui.openFortModal(hit);
    return { n: G.fortsOfCity(c).length, hasModal: !!hit };
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  var r13 = await p.evaluate(function () {
    var occ = document.querySelector('#modal-root [data-action="fort-exp"][data-mode="occupy"]');
    var t = (document.querySelector('#modal-root .inner-panel') || {}).textContent || '';
    return { disabled: occ ? occ.disabled : null,
      dim: occ ? occ.classList.contains('dim') : null,
      why: occ ? occ.getAttribute('data-why') : null,
      hint: /本城前哨\s*5\/5/.test(t) };
  });
  chk('⑤ 满员（5/5）→ occupy 软化受阻（可点 + data-why）+ hint 5/5',
    r12.n === 5 && r12.hasModal && r13.disabled === false && r13.dim === true && !!r13.why && r13.hint,
    JSON.stringify(r12) + ' | ' + JSON.stringify(r13));
  await p.screenshot({ path: E + 'v89193-full.png' });

  console.log('════ 合计：' + (fails ? ('❌ ' + fails + ' 项失败') : '✅ 全通过') + ' ════');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
