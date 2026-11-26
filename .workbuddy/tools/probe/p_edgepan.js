/* ============================================================
 * p_edgepan.js · 左键只选、地图位移靠边缘推镜
 * ------------------------------------------------------------
 * 老板：「左键只选择地图元素，不转动相机。地图位置的变动，通过鼠标在地图四周
 *        ……画面持续向右移动，显示右方地图。」
 *
 * 判据：
 *   ① 左键拖 240px：相机位置/朝向/状态**一位都不许变**（地表 + 高空各测一次）
 *   ② 指针贴右边缘：相机持续变化（画面在走），且**不是瞬移**（分多帧累积）
 *   ③ 指针离开边缘：立刻停（停手画面不许自己动）
 *   ④ 边缘推镜不推动小人
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pedgepan';
const fs = require('fs');
let PASS = 0, FAIL = 0;
function ok(t, c, d) {
  if (c) { PASS++; console.log('OK   ' + t + (d ? '   [' + d + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + t + (d ? '   [' + d + ']' : '')); }
}

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

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d, cam = (M._camObj ? M._camObj() : M._cam);
    const pp = M.playerPose();
    const R2 = M.R + (pp.h || 0) + 0.05;
    const P = new THREE.Vector3(pp.dir[0] * R2, pp.dir[1] * R2, pp.dir[2] * R2);
    cam.updateMatrixWorld();
    return {
      surf: !!M._surf,
      dir: M.camO.dir.map((v) => +v.toFixed(5)),
      camPos: [+cam.position.x.toFixed(3), +cam.position.y.toFixed(3), +cam.position.z.toFixed(3)],
      camQ: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w].map((v) => +v.toFixed(5)),
      orbitYaw: +(M._surfOrbitYaw || 0).toFixed(4),
      el: +M.SURF_CAM_EL.toFixed(3),
      pdir: pp.dir.map((v) => +v.toFixed(5)),
      ptr: M.edgePanProbe ? M.edgePanProbe() : null
    };
  });

  /* ── ① 高空：左键拖拽不许动相机 ── */
  const a0 = await snap();
  await p.mouse.move(720, 450);
  await p.mouse.down({ button: 'left' });
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + i * 20, 450 + i * 6); await p.waitForTimeout(25); }
  await p.mouse.up({ button: 'left' });
  await p.waitForTimeout(400);
  const a1 = await snap();
  const sameCam = JSON.stringify(a0.dir) === JSON.stringify(a1.dir)
    && JSON.stringify(a0.camPos) === JSON.stringify(a1.camPos)
    && JSON.stringify(a0.camQ) === JSON.stringify(a1.camQ);
  ok('① 高空左键拖 240px：相机 dir/位置/四元数全部不变', sameCam,
    'dir ' + JSON.stringify(a0.dir) + ' → ' + JSON.stringify(a1.dir));

  /* ── ② 高空：指针贴右边缘 1.2 秒 → 画面持续向右走 ── */
  const b0 = await snap();
  await p.mouse.move(1430, 450);              /* 右边缘带内（1440 宽，band≈49） */
  await p.waitForTimeout(150);
  /* ⚠️ headless 的 rAF 被节流到 1~2fps，"等 0.6 秒"测不出角速度。
     改为手动按 1/60 推 36 帧 = 模拟真机 0.6 秒（函数本身是纯逻辑，合法）。 */
  const ticked = await p.evaluate(() => {
    const M = GAME.map3d;
    const a0 = M.camO.dir.slice();
    let n = 0;
    for (let i = 0; i < 18; i++) { if (M.edgePanTick(1 / 60)) n++; }
    const a1 = M.camO.dir.slice();
    for (let i = 0; i < 18; i++) { M.edgePanTick(1 / 60); }
    return { n: n, a0: a0, a1: a1, a2: M.camO.dir.slice() };
  });
  const b1 = await snap();
  const b2 = await snap();
  await p.mouse.move(720, 450);               /* 离开边缘 */
  await p.waitForTimeout(300);
  const b3 = await snap();
  await p.waitForTimeout(500);
  const b4 = await snap();
  await p.screenshot({ path: OUT + '/1_orbit_edge_right.png' });

  const ang = (A, B) => Math.acos(Math.max(-1, Math.min(1,
    A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) * 180 / Math.PI;
  const g1 = ang(ticked.a0, ticked.a1), g2 = ang(ticked.a1, ticked.a2);
  ok('② 贴右边缘：每个 0.3 秒转 ' + g1.toFixed(2) + '° / ' + g2.toFixed(2) + '°（持续、非瞬移）',
    ticked.n >= 15 && g1 > 5 && g2 > 5 && g1 < 40 && g2 < 40,
    'ticked=' + ticked.n + ' ptr=' + JSON.stringify(b1.ptr));
  ok('③ 指针离开边缘后立刻停（两次采样 0°）',
    ang(b3.dir, b4.dir) < 0.05, 'after=' + ang(b3.dir, b4.dir).toFixed(3) + '°');
  ok('② 边缘推镜不推动小人', JSON.stringify(b0.pdir) === JSON.stringify(b4.pdir));

  /* ── ④ 地表：左键拖拽不动相机 + 边缘绕人转 ── */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }
  await p.waitForTimeout(1500);
  const c0 = await snap();
  await p.mouse.move(720, 500);
  await p.mouse.down({ button: 'left' });
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + i * 18, 500 + i * 4); await p.waitForTimeout(25); }
  await p.mouse.up({ button: 'left' });
  await p.waitForTimeout(400);
  const c1 = await snap();
  ok('④ 地表左键拖 216px：orbitYaw / 俯角 / 相机位置全不变',
    c0.orbitYaw === c1.orbitYaw && c0.el === c1.el
    && JSON.stringify(c0.camPos) === JSON.stringify(c1.camPos),
    'orbit ' + c0.orbitYaw + '→' + c1.orbitYaw + ' · el ' + c0.el + '→' + c1.el
    + ' · surf=' + c0.surf);

  await p.mouse.move(1434, 450);
  await p.waitForTimeout(150);
  const tickedS = await p.evaluate(() => {
    const M = GAME.map3d;
    const y0 = M._surfOrbitYaw;
    let n = 0;
    for (let i = 0; i < 42; i++) { if (M.edgePanTick(1 / 60)) n++; }
    return { n: n, y0: y0, y1: M._surfOrbitYaw };
  });
  const c2 = await snap();
  await p.mouse.move(720, 450);
  await p.waitForTimeout(300);
  const c3 = await snap();
  await p.waitForTimeout(500);
  const c4 = await snap();
  await p.screenshot({ path: OUT + '/2_surf_edge_right.png' });
  const dOrbit = Math.abs(tickedS.y1 - tickedS.y0);
  ok('④ 地表贴右边缘：镜头绕角色转（Δyaw=' + dOrbit.toFixed(3) + '）',
    tickedS.n >= 30 && dOrbit > 0.2, 'orbit ' + tickedS.y0.toFixed(3) + '→' + tickedS.y1.toFixed(3));
  ok('④ 地表离开边缘后立刻停', Math.abs(c4.orbitYaw - c3.orbitYaw) < 0.005,
    'Δ=' + Math.abs(c4.orbitYaw - c3.orbitYaw).toFixed(5));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
