/* ============================================================
 * p_fps.js · 帧率与卡顿来源
 * ------------------------------------------------------------
 * 老板：「画面太卡」
 * 量三件事：
 *   ① 静止在地表的 fps / 最长帧
 *   ② 走路时的 fps / 最长帧 / >33ms 的帧数（卡顿次数）
 *   ③ 每次地表重建的耗时（surfStats.builtMs）
 * 判据用**相对比较**：走路 vs 静止的 p95 帧时间差 —— 差得多说明是"重建"在卡。
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pfps';
const fs = require('fs');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((x) => {
      if (/知道了|跳过|关闭|开始/.test(x.textContent || '')) x.click();
    });
  });
  await p.waitForTimeout(900);
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.c && !st.boot) break;
    await p.waitForTimeout(200);
  }

  const sample = (ms) => p.evaluate((dur) => new Promise((res) => {
    const t = [];
    let last = performance.now();
    const end = last + dur;
    function tick(now) {
      t.push(now - last); last = now;
      if (now < end) requestAnimationFrame(tick); else res(t);
    }
    requestAnimationFrame(tick);
  }), ms);

  const stat = (arr) => {
    const a = arr.slice(1).sort((x, y) => x - y);
    const q = (k) => a[Math.min(a.length - 1, Math.floor(a.length * k))];
    return {
      n: a.length,
      fps: +(1000 / (a.reduce((s, v) => s + v, 0) / a.length)).toFixed(1),
      p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +a[a.length - 1].toFixed(1),
      over33: a.filter((v) => v > 33).length, over100: a.filter((v) => v > 100).length
    };
  };

  /* ① 高空静止 */
  const air = stat(await sample(2500));
  console.log('—— 高空静止 ' + JSON.stringify(air));

  /* ② 地表静止 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }
  await p.waitForTimeout(2000);
  const surf = await p.evaluate(() => {
    const M = GAME.map3d;
    const s = M.surfStats ? M.surfStats() : null;
    return { surf: !!M._surf, builtMs: s ? s.ms : null, verts: s ? s.verts : null,
      cells: s ? s.cells : null, timing: s ? s.timing : null, dist: +M.SURF_CAM_DIST.toFixed(1) };
  });
  console.log('—— 地表层 ' + JSON.stringify(surf));
  const still = stat(await sample(2500));
  console.log('—— 地表静止 ' + JSON.stringify(still));

  /* ③ 地表走路 */
  await p.keyboard.down('KeyW');
  const walk = stat(await sample(3000));
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(400);
  console.log('—— 地表走路 ' + JSON.stringify(walk));

  /* ④ F2 性能条 + 走路 3 秒的真实重建次数 */
  await p.keyboard.press('F2');
  await p.waitForTimeout(700);
  const hud = await p.evaluate(() => {
    const el = document.getElementById('perf-hud');
    return el ? { d: el.style.display, t: el.textContent } : null;
  });
  console.log('—— 性能条 ' + JSON.stringify(hud));

  const n0 = await p.evaluate(() => (GAME.map3d._perf.rebuildN || 0));
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(3000);
  await p.keyboard.up('KeyW');
  const n1 = await p.evaluate(() => (GAME.map3d._perf.rebuildN || 0));
  const avgMs = await p.evaluate(() => GAME.map3d._perf.rebuildMs);
  console.log('—— 走 3 秒重建次数 ' + (n1 - n0) + ' 次 · 单次 ' + avgMs + 'ms');
  await p.screenshot({ path: OUT + '/1_perf.png' });

  /* ④ 重建次数与耗时（再走 2 秒，数重建） */
  const rebs = await p.evaluate(() => new Promise((res) => {
    const M = GAME.map3d;
    let n = 0, ms = 0;
    const orig = M.rebuildSurf;
    M.rebuildSurf = function (d) {
      const t0 = performance.now();
      const r = orig.call(M, d);
      ms += performance.now() - t0; n++;
      return r;
    };
    GAME._keys = { w: true };
    setTimeout(() => {
      GAME._keys = {};
      M.rebuildSurf = orig;
      res({ n: n, totalMs: +ms.toFixed(1), avgMs: n ? +(ms / n).toFixed(1) : 0 });
    }, 2000);
  }));
  console.log('—— 走 2 秒的重建 ' + JSON.stringify(rebs));

  console.log('\n=== 结论 ===');
  console.log('走路 p95 / 静止 p95 = ' + walk.p95 + ' / ' + still.p95 + ' ms');
  console.log('走路 >33ms 帧数 = ' + walk.over33 + ' / ' + walk.n + '（' + (walk.over33 / Math.max(1, walk.n) * 100).toFixed(0) + '%）');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 2).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
