/* ============================================================
 * audit_v125b_perf_ui.js —— 实机 UI 性能门禁（v125b · 审核 P0-1 的常驻尺子）
 * ------------------------------------------------------------
 * 为什么需要它：`smoke §87` 的性能护栏只量 `tickOnce`（逻辑层），
 *   **覆盖不到渲染路径**。于是 `P.spots` 按 4000 次抽样逐格跑 BFS（3712 次 / 2.4s）
 *   一直绿灯，直到实机点击测出「前传一次清剿同步阻塞 7.2 秒」。
 *
 * 判据（都带下限，防"空数据飞快"的平凡解）：
 *   ① 正式局：ui.setView 五个视图各 < 100ms，且每个视图 DOM 节点 ≥ 300
 *   ② 前传态：GAME.refreshAll() 三轮取最小 < 400ms（修前 2,511ms）
 *   ③ 前传态：prologue.spots() 精确距离调用 ≤ 20 次，且返回 ≥ 1 处
 *
 * 用法：
 *   NODE_PATH=<...>/node_modules node .workbuddy/tools/audit/audit_v125b_perf_ui.js
 *   退出码 0 = 全绿；1 = 有红项
 * ============================================================ */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const TH = { viewMs: 100, nodes: 300, refreshMs: 400, distOf: 20 };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT.replace(/\\/g, '/') + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* ---------- ① 正式局：视图切换 ---------- */
  const v = await p.evaluate((th) => {
    const G = window.GAME, out = { times: {}, nodes: {} };
    G.newGame({ name: '性能审核', cityName: '灰岗', mapSeed: 20261023 });
    G.ui.enterGame();
    ['city', 'admin', 'generals', 'bag', 'map'].forEach((k) => {
      const t = performance.now();
      G.ui.setView(k);
      out.times[k] = Math.round(performance.now() - t);
      out.nodes[k] = document.querySelectorAll('*').length;
    });
    out.cities = (G.state.cities || []).length;
    return out;
  }, TH);

  console.log('① 正式局视图切换（阈值 ' + TH.viewMs + 'ms）');
  ok('新建局有城（下限：1 座，防"空局面飞快"）', v.cities >= 1, '城 ' + v.cities);
  Object.keys(v.times).forEach((k) => {
    ok('setView(' + k + ') < ' + TH.viewMs + 'ms', v.times[k] < TH.viewMs, v.times[k] + 'ms');
    ok('  └ ' + k + ' 渲染节点 ≥ ' + TH.nodes, v.nodes[k] >= TH.nodes, v.nodes[k] + ' 个');
  });

  /* ---------- ②③ 前传态 ---------- */
  const pr = await p.evaluate((th) => {
    const G = window.GAME, out = {};
    G.newGame({ name: '性能审核', cityName: '灰岗', prologue: true });
    G.ui.enterGame();
    if (!G.state.map.grid && G.map && G.map.generate) G.map.generate();

    const sp = G.sphereOf ? G.sphereOf() : G.sphere;
    let n = 0;
    const orig = sp.distOf;
    sp.distOf = function (a, b) { n++; return orig.apply(this, arguments); };
    const spots = G.prologue.spots();
    sp.distOf = orig;
    out.distOf = n;
    out.spots = spots.length;

    let best = 1e9;
    for (let i = 0; i < 3; i++) { const t = Date.now(); G.refreshAll(); const d = Date.now() - t; if (d < best) best = d; }
    out.refreshMin = best;
    out.on = G.prologue.on();
    return out;
  }, TH);

  console.log('② 前传 refreshAll（阈值 ' + TH.refreshMs + 'ms · 修前 2,511ms）');
  ok('确实处于前传态（下限：on===true，防测错场景）', pr.on === true, 'on=' + pr.on);
  ok('refreshAll 三轮取最小 < ' + TH.refreshMs + 'ms', pr.refreshMin < TH.refreshMs, pr.refreshMin + 'ms');
  console.log('③ 前传 spots 距离调用上界');
  ok('返回 ≥ 1 处（下限：防"空结果也通过"）', pr.spots >= 1, pr.spots + ' 处');
  ok('distOf ≤ ' + TH.distOf + ' 次（原 3,712 次）', pr.distOf <= TH.distOf, pr.distOf + ' 次');
  ok('无页面运行时异常', errs.length === 0, errs.slice(0, 2).join(' | ') || '无');

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针自身异常：' + e.message); process.exit(2); });
