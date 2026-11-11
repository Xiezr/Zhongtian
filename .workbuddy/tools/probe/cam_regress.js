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
  const q0 = await p.evaluate(() => GAME.map3d._camQ());
  await p.waitForTimeout(600);
  const q1 = await p.evaluate(() => GAME.map3d._camQ());
  await p.waitForTimeout(3000);
  const q2 = await p.evaluate(() => GAME.map3d._camQ());
  const angq = (a, c) => Math.acos(Math.max(-1, Math.min(1, a[0]*c[0]+a[1]*c[1]+a[2]*c[2]))) * 180 / Math.PI;
  const settle = angq(q0, q1), idle = angq(q1, q2);
  ok('E1 停手 3.6 秒朝向漂移 = 0（无自动抬头 · v157.34）', idle < 0.0005, 'idle=' + idle.toFixed(4) + '° · 落定=' + settle.toFixed(3) + '°');

  ok('无页面异常', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
