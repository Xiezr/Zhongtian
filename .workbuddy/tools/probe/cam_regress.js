/* 相机修复的实机探针（v157.31 · 临时/可复用）
 * 判据：
 *   A. 低空半径 = R + 眼高（常数），不再带地形项；
 *   B. 高空右键拖动必须改变相机朝向（修复前每帧被清零 → 完全不动）；
 *   C. 地表右键仍能改变视线（回归）。
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : ''))) : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : ''))); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'cam', cityName: '灰岗', mapSeed: 20261023 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(2500);

  const box = await p.locator('#mapCanvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  /* A. 低空半径 = R + 眼高（常数） */
  const a = await p.evaluate(() => {
    const M = GAME.map3d; M.setZoom(0);
    return new Promise((res) => setTimeout(() => {
      const cam = M._camObj();
      res({ r: +cam.position.length().toFixed(3), R: +GAME.map3d.R || 300, alt: +M._rAlt, agl: +M._agl });
    }, 400));
  });
  ok('A1 低空半径 = R + 1.7（地形不参与）', Math.abs(a.r - (a.R + 1.7)) < 0.6, 'r=' + a.r + ' 期望≈' + (a.R + 1.7));

  /* B. 高空右键 */
  await p.evaluate(() => { GAME.map3d.setZoom(0.55); });
  await p.waitForTimeout(500);
  const before = await p.evaluate(() => ({ q: GAME.map3d._camQ(), surf: !!GAME.map3d._surf, alt: +GAME.map3d._rAlt }));
  await p.mouse.move(cx, cy);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(cx + 160, cy + 90, { steps: 6 });
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ q: GAME.map3d._camQ(), lk: GAME.map3d._lookDbg ? GAME.map3d._lookDbg() : null }));
  const dq = Math.abs(before.q[0] - after.q[0]) + Math.abs(before.q[1] - after.q[1]) + Math.abs(before.q[2] - after.q[2]);
  ok('B1 高空不是地表模式（前置）', before.surf === false, 'alt=' + before.alt);
  ok('B2 高空右键改变朝向（修复前为 0）', dq > 0.02, 'Δq=' + dq.toFixed(4));

  /* C. 地表右键 */
  await p.evaluate(() => { GAME.map3d.setZoom(0.004); });
  await p.waitForTimeout(600);
  const s0 = await p.evaluate(() => ({ q: GAME.map3d._camQ(), surf: !!GAME.map3d._surf }));
  await p.mouse.move(cx, cy);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(cx + 140, cy + 40, { steps: 6 });
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(400);
  const s1 = await p.evaluate(() => ({ q: GAME.map3d._camQ() }));
  const dq2 = Math.abs(s0.q[0] - s1.q[0]) + Math.abs(s0.q[1] - s1.q[1]) + Math.abs(s0.q[2] - s1.q[2]);
  ok('C1 地表模式可进入（前置）', s0.surf === true);
  ok('C2 地表右键仍改变视线（回归）', dq2 > 0.02, 'Δq=' + dq2.toFixed(4));

  /* D. 自检 camGuardCheck：半径恒定 + 滚轮下限 */
  const guard = await p.evaluate(() => GAME.map3d.camGuardCheck());
  ok('D1 camGuardCheck 无失败', guard.fails.length === 0, (guard.fails[0] || '') + ' spread=' + guard.metrics.radiusSpread);
  ok('D2 96 方位半径差 ≤ 0.01', guard.metrics.radiusSpread <= 0.01, 'spread=' + guard.metrics.radiusSpread);
  ok('D3 滚轮下限覆盖全部方位', guard.metrics.floorBelow === 0, 'below=' + guard.metrics.floorBelow);

  /* E. 停手后画面必须静止（S2 验收：无自动抬头）
     已知：缩放收尾那一帧会有一次 <0.1° 的落定；从第二拍起必须 **0.0000°**。 */
  await p.evaluate(() => GAME.map3d.setZoom(0));
  await p.waitForTimeout(1600);
  /* ⚠️ 必须先等**落地过渡真的跑完**再开始测"静止漂移"：
     v157.48 的落地抬视线是 220ms 的一次性过渡，headless 里 rAF 可能几秒才来一帧，
     若在它还没落地时就采 q0，后面一帧落定就会被误判成"自己在漂"（实测 Δ=0.056°）。 */
  for (let i = 0; i < 40; i++) {                       /* 最多等 4s */
    const busy = await p.evaluate(() => !!(GAME.map3d._tiltActive && GAME.map3d._tiltActive()));
    if (!busy) break;
    await p.waitForTimeout(100);
  }
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await p.waitForTimeout(200);
  const q0 = await p.evaluate(() => GAME.map3d._camQ());
  await p.waitForTimeout(600);
  const q1 = await p.evaluate(() => GAME.map3d._camQ());
  await p.waitForTimeout(3000);
  const q2 = await p.evaluate(() => GAME.map3d._camQ());
  const angq = (a, c) => Math.acos(Math.max(-1, Math.min(1, a[0]*c[0]+a[1]*c[1]+a[2]*c[2]))) * 180 / Math.PI;
  const settle = angq(q0, q1), idle = angq(q1, q2);
  ok('E1 停手 3.6 秒朝向漂移 = 0（无自动抬头 · v157.34）', idle < 0.0005, 'idle=' + idle.toFixed(4) + '° · 落定=' + settle.toFixed(3) + '°');

  /* ============================================================
   * F 组（v157.50 · 老板「阈值处要全面平滑 + 滚轮按高度取曲线」）
   * ------------------------------------------------------------
   * 这三条是那次改动的**行为判据**（不是源码形态）：
   *   F1 灵敏度曲线：纯函数采样，倍数随高度单调不增、相邻差 < 9%；
   *   F2 跨阈值视线：62 米上下各取几档，相邻两档视线变化 ≤ 40°（旧实现一格 75°）；
   *   F3 淡出对齐：rAlt 62（切模式点）时地表层 fade ≈ 0 —— 不该有半透明地形叠着。
   * ============================================================ */
  const R0 = await p.evaluate(() => GAME.map3d.R);
  const f1 = await p.evaluate(() => {
    const M = GAME.map3d;
    if (!M._zoomCurveProbe) return null;
    const rs = [];
    for (let i = 0; i <= 40; i++) {
      const agl = 1.7 * Math.pow(8000 / 1.7, i / 40);
      rs.push(M._zoomCurveProbe(agl, 100) / agl);
    }
    let bad = 0, jump = 0;
    for (let i = 1; i < rs.length; i++) {
      if (rs[i] > rs[i - 1] + 1e-6) bad++;
      jump = Math.max(jump, Math.abs(rs[i] - rs[i - 1]));
    }
    return { first: rs[0], last: rs[rs.length - 1], bad, jump, mul62: M._handoffMulProbe ? M._handoffMulProbe(62) : null, mul95: M._handoffMulProbe ? M._handoffMulProbe(95) : null };
  });
  /* 低空段本来就是倍数变化最快的一段（1.90 → 1.74 → 1.70），阈值取 0.12：
     旧实现在 120 米处一次跳 0.13 且伴随 dAgl 翻倍，这条能抓住那种硬切。 */
  ok('F1 滚轮曲线单调不增 · 相邻差 < 12%（按高度、不按滚轮位移）',
    !!f1 && f1.bad === 0 && f1.jump < 0.12,
    f1 ? ('贴地×' + f1.first.toFixed(2) + ' → 8000m×' + f1.last.toFixed(3) + ' · maxJump=' + f1.jump.toFixed(3)) : '无探针出口');

  const setAlt = async (agl) => {
    await p.evaluate(({ agl, R }) => {
      const M = GAME.map3d;
      const a = Math.log(M.ZOOM_MIN), b = Math.log(M.ZOOM_MAX);
      M.setZoom((Math.log(R + agl) - a) / (b - a));
    }, { agl, R: R0 });
    await p.waitForTimeout(420);          /* 让 tilt / fade 走完 */
  };
  const elAt = async () => p.evaluate(() => {
    const M = GAME.map3d, u = M._camU();
    const L = Math.hypot(u.pos[0], u.pos[1], u.pos[2]) || 1;
    const dot = (u.fwd[0] * u.pos[0] + u.fwd[1] * u.pos[1] + u.fwd[2] * u.pos[2]) / L;
    return { el: Math.asin(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI, rAlt: +M._rAlt, fade: M._bgOf ? M._bgOf().fade : null, surf: !!M._surf };
  });
  await setAlt(50);
  const seq = [];
  for (const h of [50, 56, 62, 68, 76, 86, 96]) { await setAlt(h); seq.push(await elAt()); }
  let maxStep = 0;
  for (let i = 1; i < seq.length; i++) maxStep = Math.max(maxStep, Math.abs(seq[i].el - seq[i - 1].el));
  ok('F2 跨 62 米阈值视线连续（相邻档变化 ≤ 40° · 旧实现一格 75°）',
    maxStep <= 40,
    'maxStep=' + maxStep.toFixed(1) + '° · el=' + seq.map(x => x.el.toFixed(0)).join('→'));
  const at62 = seq[2];
  ok('F3 切模式点地表层已淡完（fade ≈ 0）', at62 && at62.fade != null && at62.fade <= 0.12,
    at62 ? ('rAlt=' + at62.rAlt + ' fade=' + at62.fade + ' surf=' + at62.surf) : '无读数');

  ok('无页面异常', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
