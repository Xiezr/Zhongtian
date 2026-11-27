/* ============================================================
 * p_edgepan.js · 左键只选、地图位移靠边缘推镜
 * ------------------------------------------------------------
 * 老板：「左键只选择地图元素，不转动相机。地图位置的变动，通过鼠标在地图四周
 *        ……画面持续向右移动，显示右方地图。」
 *
 * 判据：
 *   ① 左键拖 240px：相机 dir/位置/四元数/yaw **逐位不变**（高空 + 地表各一次）
 *   ② 指针贴右边缘：`camO.yaw` 按时间累积增长（0.3 秒 ≈ 15.5°），不是瞬移
 *   ③ 指针离开边缘：yaw / 位置都不再变
 *   ④ 真帧应用后球心**左移**（右侧地图露出来），且不推动小人
 *   ⑤ 地表：左键拖不动相机；贴右边缘 = 绕角色转
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
      yaw: +M.camO.yaw.toFixed(5),
      camPos: [+cam.position.x.toFixed(3), +cam.position.y.toFixed(3), +cam.position.z.toFixed(3)],
      camQ: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w].map((v) => +v.toFixed(5)),
      orbitYaw: +(M._surfOrbitYaw || 0).toFixed(4),
      el: +M.SURF_CAM_EL.toFixed(3),
      pdir: pp.dir.map((v) => +v.toFixed(5))
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
  ok('① 高空左键拖 240px：dir / 位置 / 四元数 / yaw 全部不变',
    JSON.stringify(a0.dir) === JSON.stringify(a1.dir)
    && JSON.stringify(a0.camPos) === JSON.stringify(a1.camPos)
    && JSON.stringify(a0.camQ) === JSON.stringify(a1.camQ)
    && a0.yaw === a1.yaw,
    'dir ' + JSON.stringify(a0.dir) + ' → ' + JSON.stringify(a1.dir));

  /* ── ② 贴右边缘：yaw 按时间累积 ── */
  /* ⚠️ 不能拿"球心"当参照：轨道相机永远 lookAt 球心，它的 NDC 恒 0
     （第一版就是这么假红的）。
     v158.36：也不能拿"玩家位置"当参照 —— 初始相机常在玩家背面，
     该点投影会随 yaw 增大而右移（实测 -0.467→-0.064），把正确行为
     误判成"方向反了"。改用**推镜前相机正下方的球面点**作固定参照：
     初始在画面中心，相机往东（yaw 增大）后它必定左移（x 变小）。 */
  const fixedDir = await p.evaluate(() => GAME.map3d.camO.dir.slice());
  const ballNdc = () => p.evaluate((fd) => {
    const M = GAME.map3d, cam = (M._camObj ? M._camObj() : M._cam);
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(fd[0] * M.R, fd[1] * M.R, fd[2] * M.R).project(cam);
    return [+v.x.toFixed(3), +v.y.toFixed(3)];
  }, fixedDir);
  const ball0 = await ballNdc();
  await p.mouse.move(1430, 450);
  await p.waitForTimeout(150);
  const ticked = await p.evaluate(() => {
    const M = GAME.map3d;
    const y0 = M.camO.yaw;
    let n = 0;
    for (let i = 0; i < 18; i++) { if (M.edgePanTick(1 / 60)) n++; }
    const y1 = M.camO.yaw;
    for (let i = 0; i < 18; i++) M.edgePanTick(1 / 60);
    return { n: n, y0: y0, y1: y1, y2: M.camO.yaw };
  });
  const g1 = (ticked.y1 - ticked.y0) * 180 / Math.PI;
  const g2 = (ticked.y2 - ticked.y1) * 180 / Math.PI;
  ok('② 贴右边缘：每个 0.3 秒转 ' + g1.toFixed(2) + '° / ' + g2.toFixed(2) + '°（持续、非瞬移）',
    ticked.n >= 15 && g1 > 5 && g2 > 5 && g1 < 40 && g2 < 40, 'ticked=' + ticked.n);
  ok('② 方向：yaw 增大 = 相机往东走（右侧地图露出）', g1 > 0, 'Δyaw=' + g1.toFixed(2) + '°');

  /* ── ③ 离开边缘立刻停 ── */
  await p.mouse.move(720, 450);
  await p.waitForTimeout(400);
  const s3 = await snap();
  await p.waitForTimeout(600);
  const s4 = await snap();
  ok('③ 指针离开边缘后立刻停（yaw / 位置都不再变）',
    s3.yaw === s4.yaw && JSON.stringify(s3.camPos) === JSON.stringify(s4.camPos),
    'yaw ' + s3.yaw + ' → ' + s4.yaw);

  /* ── ④ 真帧应用后：球心左移（露出右边）+ 不推动小人 ── */
  await p.mouse.move(1430, 450);
  await p.waitForTimeout(1500);
  const ball1 = await ballNdc();
  await p.mouse.move(720, 450);
  await p.waitForTimeout(300);
  ok('④ 地图上的标记点左移（x 变小）——相机往东走、右侧地图露出来',
    ball1[0] < ball0[0] - 0.01, 'markNdc.x ' + ball0[0] + ' → ' + ball1[0]);
  const s5 = await snap();
  ok('④ 边缘推镜不推动小人', JSON.stringify(a0.pdir) === JSON.stringify(s5.pdir));
  await p.screenshot({ path: OUT + '/1_orbit_edge_right.png' });

  /* ── ⑤ 地表：左键不动相机、贴边绕角色转 ── */
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
  var _dPos = c0.camPos.map((v, i) => +(v - c1.camPos[i]).toFixed(4));
  ok('⑤ 地表左键拖 216px：orbitYaw / 俯角 / 相机位置全不变',
    c0.orbitYaw === c1.orbitYaw && c0.el === c1.el
    && JSON.stringify(c0.camPos) === JSON.stringify(c1.camPos),
    'orbit ' + c0.orbitYaw + '→' + c1.orbitYaw + ' · el ' + c0.el + '→' + c1.el
    + ' · surf=' + c0.surf + ' · camPos ' + JSON.stringify(c0.camPos) + '→' + JSON.stringify(c1.camPos)
    + ' · Δ=' + JSON.stringify(_dPos));

  await p.mouse.move(1434, 450);
  await p.waitForTimeout(150);
  const tickedS = await p.evaluate(() => {
    const M = GAME.map3d;
    const y0 = M._surfOrbitYaw;
    let n = 0;
    for (let i = 0; i < 42; i++) { if (M.edgePanTick(1 / 60)) n++; }
    return { n: n, y0: y0, y1: M._surfOrbitYaw };
  });
  const dOrbit = Math.abs(tickedS.y1 - tickedS.y0);
  ok('⑤ 地表贴右边缘：镜头绕角色转（Δyaw=' + dOrbit.toFixed(3) + '）',
    tickedS.n >= 30 && dOrbit > 0.2, 'orbit ' + tickedS.y0.toFixed(3) + '→' + tickedS.y1.toFixed(3));

  await p.mouse.move(720, 450);
  await p.waitForTimeout(300);
  const c3 = await snap();
  await p.waitForTimeout(600);
  const c4 = await snap();
  ok('⑤ 地表离开边缘后立刻停', c4.orbitYaw === c3.orbitYaw,
    'Δ=' + Math.abs(c4.orbitYaw - c3.orbitYaw).toFixed(5));
  await p.screenshot({ path: OUT + '/2_surf_edge_right.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
