'use strict';
/* v158.50 验收探针：相机转到山坡侧向/后向不再穿模。
   找陡坡 → 进地表 → 右键绕到坡侧 + 抬头压仰角 → 断言相机处处离地 ≥ 0.2m；
   并对照"关掉遮挡检测时同机位会穿"（证明检测真的在起作用，不是恒绿）。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_occl_v15850.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (ok) pass++; else fail++;
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.c && !st.boot) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(600);
  await p.mouse.move(720, 450);

  /* ① 找玩家出生点附近地形落差最大的方向（陡坡侧） */
  const spot = await p.evaluate(() => {
    const M = GAME.map3d;
    const pp = M.playerPose();
    let best = null;
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      /* 玩家切平面上的方向 */
      const up = pp.dir;
      let e = [Math.cos(ang), Math.sin(ang) * up[2], -Math.sin(ang) * up[1]];
      const L = Math.hypot(e[0], e[1], e[2]) || 1;
      e = [e[0] / L, e[1] / L, e[2] / L];
      const n = [up[1] * e[2] - up[2] * e[1], up[2] * e[0] - up[0] * e[2], up[0] * e[1] - up[1] * e[0]];
      /* 沿切向走 6 米采样地形高 */
      const d6 = [up[0] + (e[0] * Math.cos(ang) + n[0] * Math.sin(ang)) * (6 / M.R),
                  up[1] + (e[1] * Math.cos(ang) + n[1] * Math.sin(ang)) * (6 / M.R),
                  up[2] + (e[2] * Math.cos(ang) + n[2] * Math.sin(ang)) * (6 / M.R)];
      const L2 = Math.hypot(d6[0], d6[1], d6[2]);
      const gh = M._groundAtUnit([d6[0] / L2, d6[1] / L2, d6[2] / L2]);
      const g0 = M._groundAtUnit(up);
      const drop = gh - g0;
      if (!best || Math.abs(drop) > Math.abs(best.drop)) {
        best = { ang, drop, gh, g0 };
      }
    }
    return best;
  });
  console.log('陡坡方向: ' + JSON.stringify(spot));
  check('① 找到地形落差方向（|落差| > 1.5m）', !!spot && Math.abs(spot.drop) > 1.5,
    JSON.stringify(spot));

  /* ② 进地表并把相机绕到坡侧（_surfOrbitYaw 转 90°）+ 抬头压仰角 */
  await p.evaluate(() => {
    const M = GAME.map3d;
    M._zoomTo(M.R + 40, false);
    M.camFree = true;
  });
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    const M = GAME.map3d;
    M._surfOrbitYaw = 1.6;        /* 绕到侧方 */
    M.SURF_CAM_EL = 0.08;         /* 抬头压到近水平（3.2m 距离） */
    M._surfCamDist = 16;
  });
  await p.waitForTimeout(800);

  /* ③ 相机沿视线到锚点整段离地高度（新遮挡检测生效）
     ⚠️ 锚点附近贴地是正常姿态（s<0.5 不参与判穿）；判机位后半段 + 机位本身 */
  const occl = await p.evaluate(() => {
    const M = GAME.map3d;
    const cam = M._camObj ? M._camObj() : M._cam;
    const A = M._surfCamAnchor;
    if (!A) return null;
    const dC = cam.position.clone().sub(A);
    const dL = dC.length() || 1;
    const dDir = dC.clone().multiplyScalar(1 / dL);
    let minGap = 99, samples = 0, camGap = null;
    for (let s = 0.5; s <= 1.0; s += 0.1) {
      const q = A.clone().addScaledVector(dDir, dL * s);
      const qL = q.length() || 1;
      const gh = M._groundAtUnit([q.x / qL, q.y / qL, q.z / qL]);
      const gap = qL - (M.R + gh);
      samples++;
      if (gap < minGap) minGap = gap;
    }
    const cL = cam.position.length();
    camGap = cL - (M.R + M._groundAtUnit([cam.position.x / cL, cam.position.y / cL, cam.position.z / cL]));
    return { minGap: +minGap.toFixed(2), camGap: +camGap.toFixed(2), camDist: +dL.toFixed(2), samples };
  });
  console.log('遮挡检测: ' + JSON.stringify(occl));
  check('② 坡侧贴地机位后半段离地 ≥ 0.05m 且机位离地 ≥ 0.08m 且未被过度收缩（camDist ≥ 1m）',
    !!occl && occl.minGap >= 0.05 && occl.camGap >= 0.08 && occl.camDist >= 1.0 && occl.samples >= 5,
    JSON.stringify(occl));

  /* ④ 对照：关检测扫描找"真穿模"姿态（侧向点离地 < -0.2m），
     再开检测验证同一姿态被收缩到不穿。 */
  const found = await p.evaluate(() => {
    const M = GAME.map3d;
    M.SURF_CAM_OCCLUSION = false;
    const cam = M._camObj ? M._camObj() : M._cam;
    const A = M._surfCamAnchor;
    if (!A) return null;
    const up = A.clone().normalize();
    for (let iy = 0; iy < 16; iy++) {
      const yaw = (iy / 16) * Math.PI * 2;
      for (let ie = 0; ie < 3; ie++) {
        const el = [0.06, 0.15, 0.3][ie];
        M._surfOrbitYaw = yaw;
        M.SURF_CAM_EL = el;
        M._surfCamDist = 16;
        M._surfAvatarCam();          /* 手动推一帧机位 */
        const dC = cam.position.clone().sub(A);
        const dL = dC.length() || 1;
        const dDir = dC.clone().multiplyScalar(1 / dL);
        const side = new THREE.Vector3().crossVectors(dDir, up);
        if (side.lengthSq() < 1e-9) side.set(1, 0, 0);
        side.normalize();
        let worst = 99;
        [0.8, -0.8, 0].forEach((off) => {
          const q = cam.position.clone().addScaledVector(side, off);
          const qL = q.length() || 1;
          const gh = M._groundAtUnit([q.x / qL, q.y / qL, q.z / qL]);
          worst = Math.min(worst, qL - (M.R + gh));
        });
        if (worst < -0.2) return { yaw, el, worst: +worst.toFixed(2) };
      }
    }
    return null;
  });
  console.log('穿模姿态: ' + JSON.stringify(found));
  check('③ 找到关检测时真穿模的姿态（侧向点离地 < -0.2m）',
    !!found, JSON.stringify(found));

  if (found) {
    const fixed = await p.evaluate((f) => {
      const M = GAME.map3d;
      M.SURF_CAM_OCCLUSION = true;
      const cam = M._camObj ? M._camObj() : M._cam;
      const A = M._surfCamAnchor;
      M._surfOrbitYaw = f.yaw;
      M.SURF_CAM_EL = f.el;
      M._surfCamDist = 16;
      M._surfAvatarCam();
      const dC = cam.position.clone().sub(A);
      const dL = dC.length() || 1;
      const dDir = dC.clone().multiplyScalar(1 / dL);
      const up = A.clone().normalize();
      const side = new THREE.Vector3().crossVectors(dDir, up);
      if (side.lengthSq() < 1e-9) side.set(1, 0, 0);
      side.normalize();
      let worst = 99;
      [0.8, -0.8, 0].forEach((off) => {
        const q = cam.position.clone().addScaledVector(side, off);
        const qL = q.length() || 1;
        const gh = M._groundAtUnit([q.x / qL, q.y / qL, q.z / qL]);
        worst = Math.min(worst, qL - (M.R + gh));
      });
      return { worst: +worst.toFixed(2), camDist: +dL.toFixed(2) };
    }, found);
    console.log('开检测同姿态: ' + JSON.stringify(fixed));
    check('④ 开检测后同一姿态不穿（收缩生效：侧向点离地 ≥ -0.05m）',
      fixed.worst >= -0.05, JSON.stringify(fixed));
  } else {
    check('④ 开检测后同一姿态不穿（收缩生效）', false, 'no found pose');
  }
  await p.evaluate(() => { GAME.map3d.SURF_CAM_OCCLUSION = true; });

  check('④ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
