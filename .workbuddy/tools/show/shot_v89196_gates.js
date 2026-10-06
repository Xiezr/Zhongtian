/* v89.196 实机验收：
   ① 雷达圈折线（静态）：前哨 → 地图 → 环带对比（折线在）+ 两帧 108 点像素 diff（静态）
   ② 战斗回看：真打一场 → 战场界面开着等结束 → 「🎬 回看全程」按钮 → 点开沙盘
   ③ 藏珍阁三态：全锁 → 解锁激活按钮
   ④ 资质升档 toast：等级差补 / 资质奖励 在册 */
var E = 'E:/Deepseekdb/.workbuddy/shots/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
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
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验收客', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.goldAdd(5000000 - G.goldOf());
    var c = G.state.cities[0];
    G.state.forts = G.state.forts || {};
    G.state.forts[(c.x - 6) + ',' + (c.y + 2)] = { x: c.x - 6, y: c.y + 2, lv: 3, name: '云驿站', day: 0, cityId: c.id };
    G.ui.enterGame(); G.ui.closeAllModals();
  });

  /* ── ① 雷达圈折线（静态）── */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    G.ui.setView('map');
    G.ui.mapCenterOn(c.x - 6, c.y + 2);
  });
  await sleep(1300);
  var snapFn = function () {
    var G = window.GAME;
    var vw = G.map._view;
    var cv = document.getElementById('mapCanvas');
    var ctx = cv.getContext('2d');
    var c = G.state.cities[0];
    var f = G.state.forts[(c.x - 6) + ',' + (c.y + 2)];
    var R = G.fortRadiusOf(f);
    var cx = vw.ox + (f.x - f.y) * vw.HW, cy = vw.oy + (f.x + f.y) * vw.HH;
    var rx = R * vw.HW * 1.4142, ry = R * vw.HH * 1.4142;
    var pts = [], score = 0, nSc = 0;
    for (var i = 0; i < 36; i++) {
      var th = i / 36 * Math.PI * 2;
      var ct = Math.cos(th), st = Math.sin(th);
      /* 静态采样：3 层半径 */
      [-22, 0, 22].forEach(function (d) {
        var sx = cx + ct * (rx + d), sy = cy + st * (ry + d);
        var a = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
        pts.push(a[0], a[1], a[2]);
      });
      /* 折线在：圈带 [-26, +26] 取 max g，与内 12px 均值比（§106.4 环带对比法） */
      var gMax = 0;
      for (var d2 = -26; d2 <= 26; d2 += 2) {
        var px = Math.round(cx + ct * (rx + d2)), py = Math.round(cy + st * (ry + d2));
        if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) continue;
        var a2 = ctx.getImageData(px, py, 1, 1).data;
        if (a2[1] > gMax) gMax = a2[1];
      }
      var gi = ctx.getImageData(Math.round(cx + ct * (rx - 60)), Math.round(cy + st * (ry - 60)), 1, 1).data;
      score += (gMax - gi[1]); nSc++;
    }
    return { pts: pts, score: Math.round(score / (nSc || 1)), rx: Math.round(rx), R: R };
  };
  var s1 = await p.evaluate(snapFn);
  await sleep(1400);
  var s2 = await p.evaluate(snapFn);
  var diff = 0;
  for (var i = 0; i < s1.pts.length; i += 3) {
    if (Math.abs(s1.pts[i] - s2.pts[i]) > 6
      || Math.abs(s1.pts[i + 1] - s2.pts[i + 1]) > 6
      || Math.abs(s1.pts[i + 2] - s2.pts[i + 2]) > 6) diff++;
  }
  chk('① 雷达圈：折线在（环带 g 增量 ' + s1.score + ' · R=' + s1.R + ' rx=' + s1.rx + '）· 静态（两帧 108 点 diff=' + diff + '）',
    s1.score >= 8 && diff <= 5, 'diff=' + diff);
  await p.screenshot({ path: E + 'v89196-radar.png' });

  /* ── ② 战斗回看：真打一场 → 战场界面开着等结束 → 回看按钮 → 沙盘 ── */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    c.army = { yibing: 60000 };
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; lord.stamina = 100; lord.energy = 100;
    var w = null;
    for (var y = 5; y < 120 && !w; y++) {
      for (var x = 5; x < 120; x++) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt && G.map.wildAt(x, y)) continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : G.map.wildLevel(x, y);
        if (lv >= 2 && lv <= 5) { w = { x: x, y: y }; break; }
      }
    }
    if (!w) return { err: 'no-wild' };
    G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
    var n = 0;
    while (G.state.marches.length && n < 400) { G.march.tick(); n++; if (G.state.battles && G.state.battles.length) break; }
    var rec = (G.state.battles || [])[0];
    if (!rec) return { err: 'no-battle' };
    G.ui.openBattlefield(rec.id);              /* 亲临战场（界面开着） */
    return { ok: true, id: rec.id };
  });
  if (r2.ok) {
    await sleep(600);
    await p.evaluate(function (id) { window.GAME.battle.autoBattle(id); }, r2.id);   /* 后台打完 */
    await sleep(1200);                          /* 等 btTick(500ms) 捕获结束态 */
    var r2b = await p.evaluate(function () {
      var acts = document.getElementById('bt-acts');
      var h = acts ? acts.innerHTML : '';
      return {
        btn: h.indexOf('bt-replay') >= 0, txt: h.indexOf('回看全程') >= 0,
        log: (document.getElementById('bt-log') || {}).textContent || '',
      };
    });
    chk('② 战斗回看：结束界面「🎬 回看全程」按钮在册（自动战斗结算后）',
      r2b.btn && r2b.txt, JSON.stringify({ btn: r2b.btn, txt: r2b.txt }));
    await p.screenshot({ path: E + 'v89196-btend.png' });
    /* 真点回看 → 沙盘 */
    var r2c = await p.evaluate(function () {
      var btn = document.querySelector('#modal-root [data-action="bt-replay"]');
      if (!btn) return { ok: false, why: 'no-btn' };
      btn.click();
      return { ok: true };
    });
    await sleep(900);
    var r2d = await p.evaluate(function () {
      return {
        sd: !!document.getElementById('sd-wrap'),
        frames: (window.GAME.ui._sd && window.GAME.ui._sd.sb) ? window.GAME.ui._sd.sb.frames.length : -1,
        verify: (window.GAME.ui._sd && window.GAME.ui._sd.sb) ? window.GAME.ui._sd.sb.verify : null,
      };
    });
    chk('② 真点回看 → 沙盘打开（frames=' + r2d.frames + ' · verify=' + r2d.verify + '）',
      r2c.ok && r2d.sd && r2d.frames > 0, JSON.stringify(r2d));
    await p.screenshot({ path: E + 'v89196-bt-replay.png' });
  } else {
    chk('② 战斗回看（造局失败）', false, r2.err);
  }

  /* ── ③ 藏珍阁三态 ── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.state.stats = {}; G.state.rep = 0; G.state.rank = 0; G.state.collect = {};
    G.ui._colCat = 'all';
    G.ui.setView('collection');
    G.ui.renderCollect();
  });
  await sleep(400);
  var r3 = await p.evaluate(function () {
    return {
      locked: document.querySelectorAll('#view-container .col-card.locked').length,
      cards: document.querySelectorAll('#view-container .col-card').length,
      cond: !!document.querySelector('#view-container .col-lock'),
    };
  });
  chk('③ 藏珍阁全锁态：.col-card.locked=' + r3.locked + ' / 卡 ' + r3.cards + ' + 条件行在册',
    r3.locked >= 8 && r3.cards === 12 && r3.cond, JSON.stringify(r3));
  await p.screenshot({ path: E + 'v89196-collect-locked.png' });
  await p.evaluate(function () {
    var G = window.GAME;
    G.state.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
      recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
    G.state.rep = 99999; G.state.rank = 9;
    var _lg = G.lordGeneralOf(); if (_lg) _lg.level = 300;
    (G.state.cities[0].cells || []).forEach(function (cell) {
      if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
    });
    (G.DATA.ITEMS || []).slice(0, 8).forEach(function (it) {
      G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
    });
    G.ui.renderCollect();
  });
  await sleep(400);
  var r3b = await p.evaluate(function () {
    return {
      locked: document.querySelectorAll('#view-container .col-card.locked').length,
      btn: !!document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]'),
      btnTxt: (document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]') || {}).textContent || '',
    };
  });
  chk('③ 解锁后：locked=0 + 「激活」按钮在册', r3b.locked === 0 && r3b.btn && r3b.btnTxt.indexOf('激活') >= 0,
    JSON.stringify(r3b));
  await p.screenshot({ path: E + 'v89196-collect-unlocked.png' });

  /* ── ④ 资质升档 toast（等级差补 / 资质奖励）── */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var g = G.makeGeneral('升档验将', 60, 'idle', c.id, false, 'fan', 'balance');
    g.tong = 40; g.nz = 40; g.yw = 40; g.zm = 40;
    g.freePts = 0; g.staAdd = 0; g.atkAcc = 0; g.defAcc = 0; g.attack = 10; g.defense = 10;
    G.state.generals.push(g);
    G.ui._rankTestGen96 = g.id;
    (G.DATA.ITEMS || []).forEach(function (it) {
      if (it.type === 'rank_up' && it.from === 'fan') G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
    });
    G.ui._notes = [];
    var tel = document.getElementById('toast');
    if (tel) { tel.innerHTML = ''; tel.classList.remove('show'); }
    G.ui.setView('generals');
    G.ui._genSel = g.id;
    G.ui.renderView('generals');
  });
  await sleep(500);
  var r4 = await p.evaluate(function () {
    var btn = document.querySelector('#view-container [data-action="gen-rankup"]');
    if (!btn) return { ok: false, why: 'no-btn' };
    btn.click();
    return { ok: true };
  });
  await sleep(600);
  var r4b = await p.evaluate(function () {
    var t = (document.getElementById('toast') || {}).textContent || '';
    var gen = null;
    (window.GAME.state.generals || []).forEach(function (g) { if (g.id === window.GAME.ui._rankTestGen96) gen = g; });
    return { toast: t, tong: gen ? gen.tong : 0, fp: gen ? gen.freePts : 0, sta: gen ? (gen.staAdd || 0) : 0 };
  });
  chk('④ 升档 toast：等级差补 + 资质奖励在册 · 四维=' + r4b.tong + ' freePts=' + r4b.fp + ' staAdd=' + r4b.sta,
    r4.ok && r4b.toast.indexOf('等级差补') >= 0 && r4b.toast.indexOf('资质奖励') >= 0 && r4b.tong >= 260,
    r4b.toast.slice(0, 110));
  await p.screenshot({ path: E + 'v89196-rankup2.png' });

  console.log('\n' + (fails ? ('❌ 实机失败 ' + fails + ' 项') : '✅ 实机全过 4/4'));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
