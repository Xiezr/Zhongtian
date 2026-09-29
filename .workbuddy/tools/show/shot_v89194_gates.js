/* v89.194 实机验收：前哨雷达圈 / 藏珍阁 / 将领详情三处
   ① 雷达圈：造哨（Lv10+Lv3）→ 地图居中 → canvas 像素找圈描边（绿环）
   ② 藏珍阁：18 chips + 12 卡 → 真点购买 → .owned 金框
   ③ 将领详情：按钮 x（78px 位移目标 ≈590）· 月俸行 · 城主无小签
   ④ 宝具未佩备注行不再渲染 */
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
    G.newGame({ name: '藏珍客', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.goldAdd(20000000 - G.goldOf());
    var c = G.state.cities[0];
    /* 两个前哨：Lv10（大圈）近视野、Lv3（小圈）稍远 */
    G.state.forts = G.state.forts || {};
    G.state.forts[(c.x + 3) + ',' + (c.y + 3)] = { x: c.x + 3, y: c.y + 3, lv: 10, name: '靖海哨', day: 0, cityId: c.id };
    G.state.forts[(c.x - 6) + ',' + (c.y + 2)] = { x: c.x - 6, y: c.y + 2, lv: 3, name: '云驿站', day: 0, cityId: c.id };
    G.ui.enterGame(); G.ui.closeAllModals();
  });

  /* ── ① 雷达圈（地图视图 + 居中到前哨）──
     ⚠️ 像素验收用**对照法**（有哨 vs 删哨重绘，逐点 diff）——
     排除地形绿色误命中；且用 Lv3 哨（R8，圈完整在画布内）——
     Lv10 圈半轴 871px > 画布半宽 660px，本就出屏（"大圈只见弧"是正常渲染）。 */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    G.ui.setView('map');
    G.ui.mapCenterOn(c.x - 6, c.y + 2);
  });
  await sleep(1300);
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var vw = G.map._view;
    var cv = document.getElementById('mapCanvas');
    var ctx = cv.getContext('2d');
    var c = G.state.cities[0];
    var key = (c.x - 6) + ',' + (c.y + 2);
    var f = G.state.forts[key];
    var R = G.fortRadiusOf(f);
    var cx = vw.ox + (f.x - f.y) * vw.HW, cy = vw.oy + (f.x + f.y) * vw.HH;
    var rx = R * vw.HW * 1.4142, ry = R * vw.HH * 1.4142;
    /* 环对比法（抗地形/抗相位）：椭圆上 32 角度取 g 值，
       与**同角度**内外各 12px 的均值比 —— 地形连续渐变被抵消，剩下描边的"亮线"。 */
    function gAt(k, ang) {
      var px = Math.round(cx + rx * Math.cos(ang) * k), py = Math.round(cy + ry * Math.sin(ang) * k);
      if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return null;
      return ctx.getImageData(px, py, 1, 1).data[1];
    }
    var sum = 0, n = 0, best = -999;
    for (var i = 0; i < 32; i++) {
      var ang = i / 32 * Math.PI * 2;
      var on = gAt(1, ang), inn = gAt(1 - 12 / rx, ang), out = gAt(1 + 12 / rx, ang);
      if (on == null || inn == null || out == null) continue;
      var sc = on - (inn + out) / 2;
      sum += sc; n++;
      if (sc > best) best = sc;
    }
    /* 对照：删哨重绘后再测同一点（应有感下降） */
    delete G.state.forts[key];
    G.ui.renderMapCanvas();
    var sum2 = 0, n2 = 0;
    for (var i2 = 0; i2 < 32; i2++) {
      var ang2 = i2 / 32 * Math.PI * 2;
      var on2 = gAt(1, ang2), inn2 = gAt(1 - 12 / rx, ang2), out2 = gAt(1 + 12 / rx, ang2);
      if (on2 == null || inn2 == null || out2 == null) continue;
      sum2 += on2 - (inn2 + out2) / 2; n2++;
    }
    G.state.forts[key] = f;
    G.ui.renderMapCanvas();
    return { R: R, rx: Math.round(rx), ry: Math.round(ry), score: n ? sum / n : -999, best: best,
      scoreOff: n2 ? sum2 / n2 : -999, n: n };
  });
  chk('① 雷达圈渲染（环对比法 · Lv3 → R=8 · 半轴 ' + r1.rx + 'px）：圈上比内外亮 '
    + r1.score.toFixed(1) + '（对照删哨 ' + r1.scoreOff.toFixed(1) + '）· 最佳角 +' + r1.best.toFixed(1),
    r1.n >= 20 && r1.score >= 12 && r1.scoreOff < r1.score * 0.6, JSON.stringify(r1));
  await p.screenshot({ path: E + 'v89194-radar.png' });

  /* ── ② 藏珍阁 ── */
  await p.evaluate(function () { window.GAME.ui.setView('collection'); });
  await sleep(500);
  var r2 = await p.evaluate(function () {
    var chips = document.querySelectorAll('#view-container .col-chip');
    var cards = document.querySelectorAll('#view-container .col-card');
    var head = (document.querySelector('#view-container .gold-heading') || {}).textContent || '';
    return { chips: chips.length, cards: cards.length, head: head.slice(0, 60) };
  });
  chk('② 藏珍阁渲染：chips ' + r2.chips + '（全部+18 系）· 卡 ' + r2.cards + ' · 标题「藏珍阁」',
    r2.chips === 19 && r2.cards === 12 && r2.head.indexOf('藏珍阁') >= 0, JSON.stringify(r2));
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var btn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');
    if (!btn) return { ok: false, why: 'no-btn' };
    var id = btn.getAttribute('data-item');
    var g0 = G.goldOf();
    btn.click();
    var paid = g0 - G.goldOf();     /* collectBuy 同步 —— 立即读（收税窗口≈0） */
    return { ok: true, id: id, g0: g0, paid: paid };
  });
  await sleep(500);
  var r3b = await p.evaluate(function (ctx) {
    var G = window.GAME;
    var owned = document.querySelectorAll('#view-container .col-card.owned').length;
    return { owned: owned, have: G.collectHaveOf(ctx.id), g1: G.goldOf(), price: G.collectItemOf(ctx.id).price };
  }, r3);
  chk('② 真点购买：「' + r3.id + '」入藏 · 扣金 ' + r3.paid + '（应 ' + r3b.price + ' · 立即读）',
    r3.ok && r3b.have === true && Math.abs(r3.paid - r3b.price) <= 50 && r3b.owned >= 1, JSON.stringify(r3b));
  await p.screenshot({ path: E + 'v89194-collect.png' });

  /* ── ③ 将领详情：按钮位移 / 月俸行 / 城主小签 ── */
  await p.evaluate(function () {
    var G = window.GAME;
    var g1 = (G.state.generals || []).filter(function (x) { return !G.isLordGeneral(x); })[0];
    if (g1) { g1.status = 'mayor'; G.ui._genSel = g1.id; }
    G.ui.setView('city');
  });
  await sleep(150);
  await p.evaluate(function () { window.GAME.ui.setView('generals'); });
  await sleep(350);
  var r4 = await p.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var ops = document.querySelector('#view-container .gp-nameops');
    var rank = document.querySelector('#view-container .gp-rankops190');
    var pane = document.querySelector('#view-container .gen-pane');
    var html = pane ? pane.innerHTML : '';
    var r1 = ops ? ops.getBoundingClientRect() : null;
    var r2b = rank ? rank.getBoundingClientRect() : null;
    return {
      k: k,
      x1: r1 ? Math.round(r1.left / k) : -1,
      x2: r2b ? Math.round(r2b.left / k) : -1,
      sal: html.indexOf('gp-sal194') >= 0,
      salText: (function () { var el = pane && pane.querySelector('.gp-sal194'); return el ? el.textContent.slice(0, 40) : ''; })(),
      stag: html.indexOf('gp-stag') >= 0,
      attachNote: html.indexOf('未佩宝具（打据点/名城有几率缴获）') >= 0,
    };
  });
  chk('③ 按钮位移：解雇 x=' + r4.x1 + ' · 晋升 x=' + r4.x2 + '（目标 ≈590/630 · 同差 40）',
    Math.abs(r4.x1 - 590) <= 8 && Math.abs((r4.x2 - r4.x1) - 40) <= 2, 'k=' + r4.k);
  chk('③ 月俸行在册（城主 ×1.5）：' + r4.salText, r4.sal && r4.salText.indexOf('月俸') >= 0, r4.salText);
  chk('③ 城主状态无小签（gp-stag 不在）· 宝具未佩备注行不在', r4.stag === false && r4.attachNote === false,
    'stag=' + r4.stag + ' note=' + r4.attachNote);
  await p.screenshot({ path: E + 'v89194-gp.png' });

  await b.close();
  console.log(fails ? ('\n❌ ' + fails + ' 项未过') : '\n✅ 全部通过');
  process.exit(fails ? 1 : 0);
})();
