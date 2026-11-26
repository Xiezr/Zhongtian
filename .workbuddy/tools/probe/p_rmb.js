/* ============================================================
 * p_rmb.js · 地表模式下左/右/中键到底各做了什么
 * ------------------------------------------------------------
 * 老板：「垃圾操作，右键往前？？？」
 *
 * 鼠标拖拽在 map3d 里有三个变量：
 *   camO.lookYaw/lookPitch  → 轨道转头（非地表）
 *   M._surfDir              → 地表视线（贴地第一人称）
 *   M._surfOrbitYaw         → 地表绕过角色一圈（星露谷相机）
 * 星露谷相机接管后**只读 _surfOrbitYaw**，_surfDir 写了没人读 = 右键失效。
 * 这里逐个键实测：玩家是否被推动、相机是否位移、哪个变量动了。
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/prmb';
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
  await p.waitForTimeout(1600);
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
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(65); }
  await p.waitForTimeout(1600);

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d, cam = (M._camObj ? M._camObj() : M._cam);
    const pp = M.playerPose();
    const R2 = M.R + (pp.h || 0) + 0.05;
    const P = new THREE.Vector3(pp.dir[0] * R2, pp.dir[1] * R2, pp.dir[2] * R2);
    cam.updateMatrixWorld();
    const ndc = P.clone().project(cam);
    return {
      surf: !!M._surf,
      dir: pp.dir.map((v) => +v.toFixed(4)),
      camPos: [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)],
      camDist: +cam.position.distanceTo(P).toFixed(2),
      ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)],
      orbitYaw: +(M._surfOrbitYaw || 0).toFixed(4),
      surfDir: M._surfDir ? [+M._surfDir.x.toFixed(4), +M._surfDir.y.toFixed(4), +M._surfDir.z.toFixed(4)] : null,
      lookYaw: +(M.camO.lookYaw || 0).toFixed(4),
      lookPitch: +(M.camO.lookPitch || 0).toFixed(4),
      dist: +M.camO.dist.toFixed(2)
    };
  });

  const s0 = await snap();
  console.log('—— 基线 ' + JSON.stringify(s0));

  const drag = async (button, dx, dy, label) => {
    await p.mouse.move(720, 500);
    await p.mouse.down({ button: button });
    for (let i = 1; i <= 10; i++) {
      await p.mouse.move(720 + dx * i / 10, 500 + dy * i / 10);
      await p.waitForTimeout(30);
    }
    await p.mouse.up({ button: button });
    await p.waitForTimeout(400);
    const s = await snap();
    console.log('—— ' + label + '  ' + JSON.stringify(s));
    return s;
  };

  const sr = await drag('right', 0, -220, '右键上拖 220px');
  await p.screenshot({ path: OUT + '/1_after_rmb_up.png' });
  const sr2 = await drag('right', 0, 220, '右键下拖 220px');
  const sl = await drag('left', 220, 0, '左键右拖 220px');
  await p.screenshot({ path: OUT + '/2_after_lmb.png' });
  const sm = await drag('middle', 0, -220, '中键上拖 220px');

  /* ---- 右键单击 / 双击（隐藏手势） ---- */
  await p.evaluate(() => { const M = GAME.map3d; M._surfOrbitYaw = -1.2; M.SURF_CAM_EL = 0.4; });
  await p.waitForTimeout(200);
  const b1 = await snap();
  await p.mouse.click(720, 500, { button: 'right' });
  await p.waitForTimeout(120);
  const b2 = await snap();
  await p.mouse.click(720, 500, { button: 'right' });
  await p.waitForTimeout(120);
  await p.mouse.click(720, 500, { button: 'right' });
  await p.waitForTimeout(400);
  const b3 = await snap();
  console.log('—— 右键单击前 ' + JSON.stringify({ orbit: b1.orbitYaw, el: b1.dist, ndc: b1.ndc }));
  console.log('—— 右键单击后 ' + JSON.stringify({ orbit: b2.orbitYaw, ndc: b2.ndc, dir: b2.dir }));
  console.log('—— 右键双击后 ' + JSON.stringify({ orbit: b3.orbitYaw, camPos: b3.camPos, ndc: b3.ndc }));

  /* ---- 拉到高空（轨道模式）再看右键 ---- */
  /* 出地表用**便捷入口**：滚轮有阻尼，headless 下 46 格滚不出去（实测 dist 卡在 312）。 */
  await p.evaluate(() => { try { GAME.map3d.surfaceMode(false); } catch (e) { } });
  await p.waitForTimeout(1200);
  const o0 = await p.evaluate(() => {
    const M = GAME.map3d;
    return { surf: !!M._surf, dir: M.camO.dir.map((v) => +v.toFixed(4)),
      lookYaw: +M.camO.lookYaw.toFixed(4), lookPitch: +M.camO.lookPitch.toFixed(4),
      dist: +M.camO.dist.toFixed(1) };
  });
  await p.mouse.move(720, 450);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + i * 20, 450 + i * 6); await p.waitForTimeout(25); }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(400);
  const oR = await p.evaluate(() => {
    const M = GAME.map3d;
    return { dir: M.camO.dir.map((v) => +v.toFixed(4)), lookYaw: +M.camO.lookYaw.toFixed(4), lookPitch: +M.camO.lookPitch.toFixed(4) };
  });
  /* 同一段路径换左键：作为"转得动"的对照 */
  await p.mouse.move(720, 450);
  await p.mouse.down({ button: 'left' });
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + i * 20, 450 + i * 6); await p.waitForTimeout(25); }
  await p.mouse.up({ button: 'left' });
  await p.waitForTimeout(400);
  const oL = await p.evaluate(() => {
    const M = GAME.map3d;
    return { dir: M.camO.dir.map((v) => +v.toFixed(4)), lookYaw: +M.camO.lookYaw.toFixed(4), lookPitch: +M.camO.lookPitch.toFixed(4) };
  });
  const ang = (A, B) => Math.acos(Math.max(-1, Math.min(1,
    A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) * 180 / Math.PI;
  console.log('   → 同路径左键 dir 转了 ' + ang(oR.dir, oL.dir).toFixed(2) + '°（对照）');

  const o1 = await p.evaluate(() => {
    const M = GAME.map3d;
    return { surf: !!M._surf, dir: M.camO.dir.map((v) => +v.toFixed(4)),
      lookYaw: +M.camO.lookYaw.toFixed(4), lookPitch: +M.camO.lookPitch.toFixed(4),
      dist: +M.camO.dist.toFixed(1) };
  });
  console.log('\n—— 轨道模式右键拖  前 ' + JSON.stringify(o0));
  console.log('—— 轨道模式右键拖  后 ' + JSON.stringify(o1));
  const dAng = Math.acos(Math.max(-1, Math.min(1,
    o0.dir[0] * o1.dir[0] + o0.dir[1] * o1.dir[1] + o0.dir[2] * o1.dir[2]))) * 180 / Math.PI;
  console.log('   → dir 转了 ' + dAng.toFixed(2) + '° · lookYaw ' + o0.lookYaw + '→' + o1.lookYaw
    + ' · lookPitch ' + o0.lookPitch + '→' + o1.lookPitch);
  await p.screenshot({ path: OUT + '/3_orbit_rmb.png' });

  /* 判据 */
  const dist3 = (a, c) => Math.sqrt((a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 + (a[2] - c[2]) ** 2);
  console.log('\n=== 汇总 ===');
  console.log('右键上拖：玩家位移 ' + dist3(s0.dir, sr.dir).toFixed(4)
    + ' · 相机位移 ' + dist3(s0.camPos, sr.camPos).toFixed(2) + ' 米'
    + ' · surfDir 变 ' + (JSON.stringify(s0.surfDir) !== JSON.stringify(sr.surfDir))
    + ' · orbitYaw ' + (sr.orbitYaw - s0.orbitYaw).toFixed(4));
  console.log('左键右拖：玩家位移 ' + dist3(sr.dir, sl.dir).toFixed(4)
    + ' · 相机位移 ' + dist3(sr.camPos, sl.camPos).toFixed(2) + ' 米'
    + ' · orbitYaw ' + (sl.orbitYaw - sr.orbitYaw).toFixed(4));
  console.log('中键上拖：玩家位移 ' + dist3(sl.dir, sm.dir).toFixed(4)
    + ' · 相机位移 ' + dist3(sl.camPos, sm.camPos).toFixed(2) + ' 米'
    + ' · surfDir 变 ' + (JSON.stringify(sl.surfDir) !== JSON.stringify(sm.surfDir)));
  console.log('玩家 NDC：' + JSON.stringify(s0.ndc) + ' → ' + JSON.stringify(sr.ndc)
    + ' → ' + JSON.stringify(sl.ndc) + ' → ' + JSON.stringify(sm.ndc));
  if (errs.length) console.log('错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
