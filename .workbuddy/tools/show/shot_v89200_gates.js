/* v89.200 实机验收：出征布局三改（几何量测）+ 围攻行下线 + 睡眠自动打（拨钟） */
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
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v200', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000, minfu: 3000 };
    G.ui.enterGame(); G.ui.closeAllModals();
  });

  /* ── ① 出征面板（野地目标）：几何量测 ── */
  var t1 = await p.evaluate(function () {
    var G = window.GAME;
    var out = { wild: null, fort: null };
    for (var y = 0; y < 240; y++) {
      for (var x = 0; x < 240; x++) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (!out.fort) { var ft = G.map.fortAt(x, y); if (ft) out.fort = { kind: 'fort', x: x, y: y }; }
        if (!out.wild) { var wl = G.map.wildLevelNow(x, y); if (wl > 0 && wl <= 5) out.wild = { kind: 'wild', x: x, y: y }; }
        if (out.fort && out.wild) return out;
      }
    }
    return out;
  });
  await p.evaluate(function (tt) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openExpModal(tt);
  }, t1.wild);
  await sleep(700);
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var panel = document.querySelector('#modal-root .inner-panel');
    var H = function (el) { return el ? el.offsetHeight : -1; };
    var W = function (el) { return el ? el.offsetWidth : -1; };
    var tgt = panel.querySelector('.exp-a-target'), gen = panel.querySelector('.exp-a-gen');
    /* 跨模块 select 宽度去重 */
    var widths = {}, sels = panel.querySelectorAll('.exp-row > select');
    Array.prototype.forEach.call(sels, function (s) { widths[s.offsetWidth] = 1; });
    /* select 右缘距行右（应 = 10 字 = 120px）——用**布局值**（rect 会被 #app-scale 乘 k，§65.4） */
    var gaps = [];
    Array.prototype.forEach.call(sels, function (s) {
      var row = s.closest('.exp-row');
      gaps.push(row.clientWidth - (s.offsetLeft + s.offsetWidth));
    });
    var gapUniq = {}; gaps.forEach(function (g) { gapUniq[g] = 1; });
    /* 预估块：在左列 + 在可用道具之后（DOM 顺序） */
    var est = panel.querySelector('.exp-a-est');
    var estInL = est && est.closest('.exp-col-l') ? 1 : 0;
    var orderOK = false;
    if (est) {
      var kids = Array.prototype.slice.call(panel.querySelector('.exp-col-l').children);
      var iEst = kids.indexOf(est.closest('.exp-sec'));
      var iItems = -1;
      kids.forEach(function (k, i) { if (k.className.indexOf('exp-a-items') >= 0) iItems = i; });
      orderOK = iEst > iItems;
    }
    /* 方案「设置」链接贴行右 */
    var link = panel.querySelector('.exp-a-plan .exp-tac-link');
    var linkRight = -1, rowRight = -1;
    if (link) {
      linkRight = Math.round(link.getBoundingClientRect().right);
      rowRight = Math.round(link.closest('.exp-row').getBoundingClientRect().right);
    }
    return {
      tgtH: H(tgt), genH: H(gen),
      widthN: Object.keys(widths).length, wVal: Object.keys(widths).join(','),
      gapN: Object.keys(gapUniq).length, gVal: Object.keys(gapUniq).join(','),
      estInL: estInL, orderOK: orderOK,
      linkGap: rowRight - linkRight,
      over: panel.scrollHeight - panel.clientHeight,
    };
  });
  chk('①a 目标/主将两块固定 2 行高（67px 且相等）',
    r1.tgtH === 67 && r1.genH === 67, 'tgt=' + r1.tgtH + ' gen=' + r1.genH);
  chk('①b 跨模块下拉固定长度（去重 1 值 ' + r1.wVal + '）', r1.widthN === 1, 'n=' + r1.widthN);
  chk('①c 下拉右缘距行右 = 10 字（去重 ' + r1.gVal + 'px · ≈120）', r1.gapN === 1 && Math.abs(Number(r1.gVal) - 120) <= 8,
    'gap=' + r1.gVal);
  chk('①d 预估块在左列下方（可用道具之后）', r1.estInL === 1 && r1.orderOK === true,
    'inL=' + r1.estInL + ' order=' + r1.orderOK);
  chk('①e 「设置」链接贴行右端（距右 ' + r1.linkGap + 'px ≤ 4）', r1.linkGap >= -2 && r1.linkGap <= 4, '');
  chk('①f 弹窗无滚动溢出', r1.over <= 0, 'over=' + r1.over);
  await p.screenshot({ path: E + 'v89200-exp.png' });

  /* ── ② 据点目标：围攻行下线（填兵后读 #exp-power） ── */
  await p.evaluate(function (tt) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openExpModal(tt);
  }, t1.fort);
  await sleep(700);
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var inp = document.getElementById('exp-qingji');
    if (inp) inp.value = 3000;
    G.ui.updateExpMarch();
    var pow = (document.getElementById('exp-power') || {}).textContent || '';
    var panel = document.querySelector('#modal-root .inner-panel');
    return { pow: pow.slice(0, 160), hasSiege: pow.indexOf('围攻') >= 0, over: panel.scrollHeight - panel.clientHeight };
  });
  chk('② 据点估算无「围攻：守备」行（下线）· 数字照常', !r2.hasSiege && r2.pow.indexOf('军师估算') >= 0,
    r2.pow.slice(0, 80));
  chk('② 据点面板无溢出（改前 52px → 0）', r2.over <= 0, 'over=' + r2.over);
  await p.screenshot({ path: E + 'v89200-fort.png' });

  /* ── ③ 睡眠自动打（拨钟 · 双档） ── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var c0 = G.state.cities[0];
    c0.army = { yibing: 60000 };
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; G.setStaNow(lord, G.staMax(lord)); lord.energy = 999;
  });
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var c0 = G.state.cities[0];
    var lord = G.lordGeneralOf();
    var w = null;
    for (var y = 5; y < 120 && !w; y++) {
      for (var x = 5; x < 120; x++) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt && G.map.wildAt(x, y)) continue;
        var lv = G.map.wildLevelNow(x, y);
        if (lv >= 2 && lv <= 5) {
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.total > 0) { w = { x: x, y: y }; break; }
        }
      }
    }
    if (!w) return { err: 'no-wild' };
    var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
    if (!r.ok) return { err: r.msg };
    var n = 0;
    while (G.state.marches.length && n < 400) { G.march.tick(); n++; if ((G.state.battles || []).length) break; }
    return { pending: (G.state.battles || []).length, n: n, w: w };
  });
  chk('③a 造局：挂起战斗已建立', r3.pending === 1, JSON.stringify(r3));
  /* 档 1：拨 60 秒（<300 门槛）→ 补算但不打 */
  await p.evaluate(function () {
    var G = window.GAME;
    G._loopLastAt = Date.now() - 60 * 1000;
  });
  await sleep(1700);
  var r3b = await p.evaluate(function () {
    return { pending: (window.GAME.state.battles || []).length };
  });
  chk('③b 拨 60 秒：补算了但战斗仍挂起（门槛内不误打）', r3b.pending === 1, 'pending=' + r3b.pending);
  /* 档 2：拨 10 分钟（>300）→ 自动打完 */
  await p.evaluate(function () {
    var G = window.GAME;
    G._loopLastAt = Date.now() - 10 * 60 * 1000;
  });
  await sleep(2600);
  var r3c = await p.evaluate(function () {
    var G = window.GAME;
    var jd = G._battleJustDone;
    var logHit = false;
    (G.state.msgLog || []).forEach(function (m) {
      if ((m.msg || '').indexOf('场战斗已自动打完') >= 0) logHit = true;
    });
    return { pending: (G.state.battles || []).length, jd: !!(jd && jd.ok), logHit: logHit,
      reports: (G.state.reports || []).length };
  });
  chk('③c 拨 10 分钟：战斗已自动打完（挂起 0 · 回执 ok · 流水有记录）',
    r3c.pending === 0 && r3c.jd === true && r3c.logHit === true, JSON.stringify(r3c));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
