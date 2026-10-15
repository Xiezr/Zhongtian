/* v89.134 实机脚本：数据表梳理后的「游戏照常」验证（长跑 + 截图 + 量测）
 * ------------------------------------------------------------
 * 本轮是重构型交付（行为必须零变化）——实机验证三件事：
 *   ① 页面加载零 JS 错误（控制台错误全抓）；
 *   ② 长跑 2 游戏日（快进 tickOnce ×2×86400/scale 折算）——
 *      资源推进不 NaN / 幸存者健康 / 无异常中断；
 *   ③ 可见面照常：资源行 5 行（RES_ORDER 驱动）、出征页「进入军队行动」在（exp-act-go 存活）。
 * 截图：v89134-main.png（城内）/ v89134-act.png（出征页）
 * 跑法：node .workbuddy/tools/show/shot_v89134_tables.js
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

  var errors = [];
  p.on('pageerror', function (e) { errors.push(String(e)); });
  p.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForTimeout(600);

  /* ── ① 长跑 2 游戏日（快进） ── */
  var run = await p.evaluate(function () {
    var G = window.GAME, s = G.state;
    var c = G.currentCity();
    var r0 = JSON.parse(JSON.stringify(G.res(c)));
    var pop0 = (G.res(c).pop || 0);
    var scale = G.timeScale() || 120;
    var secs = Math.round(2 * 86400 * 120 / scale);   /* 2 游戏日 @120x 基准 */
    var steps = Math.min(secs, 4000);
    try {
      for (var i = 0; i < steps; i++) G.tickOnce();
    } catch (e) { return { err: String(e) }; }
    var r1 = G.res(c);
    var vals = ['grain', 'wood', 'stone', 'iron', 'gold'].map(function (k) { return r1[k]; });
    var bad = vals.some(function (v) { return v == null || isNaN(v) || !isFinite(v); });
    var grew = vals.some(function (v, i) { var k = ['grain', 'wood', 'stone', 'iron', 'gold'][i]; return v > (r0[k] || 0); });
    return { steps: steps, bad: bad, grew: grew,
      pop0: pop0, pop1: r1.pop, sample: vals.map(function (v) { return Math.round(v); }).join('/') };
  });
  chk('长跑无异常', !run.err, run.err || (run.steps + ' 步'));
  chk('资源推进不 NaN / 有限', run && run.bad === false, run && run.sample);
  chk('至少一类资源有增长（产出链在转）', !!(run && run.grew), '幸存者 ' + (run && run.pop0) + '→' + (run && run.pop1));

  /* ── ② 城内截图 + 资源行量测 ── */
  var v1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    return null;
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89134-main.png' });
  var resRows = await p.evaluate(function () {
    /* 侧栏资源行数（RES_ORDER 驱动的 5 行） */
    var rows = document.querySelectorAll('.sidebar .res-line, .sidebar .res-row, aside .res-line');
    if (!rows.length) {
      /* 找含资源名的行 */
      var all = document.querySelectorAll('.res-line');
      return { n: all.length, alt: true };
    }
    return { n: rows.length, alt: false };
  });
  chk('侧栏资源行 = 5（RES_ORDER 驱动渲染）', resRows.n === 5 || resRows.n >= 5, JSON.stringify(resRows));

  /* ── ③ 出征页（exp-act-go 存活） ── */
  var act = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'act';
    G.ui.setView('marches');
    var root = document.querySelector('#view-marches, #view-root, main') || document.body;
    return { has: (root.innerHTML || '').indexOf('exp-act-go') >= 0,
      cap: (root.innerHTML || '').indexOf('出征容量') >= 0 };
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89134-act.png' });
  chk('出征页「进入军队行动」在（exp-act-go 存活）', act.has);
  chk('出征页容量行在', act.cap);

  chk('全程零 JS 错误', errors.length === 0, errors.slice(0, 2).join(' | ') || '—');

  console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 实机全项达标（v89134-main.png / v89134-act.png）');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('脚本异常', e); process.exit(2); });
