'use strict';
/* v158.60 诊断：斜坡处改相机角度出现"地底画面/穿模"——先量化再改。
   判据用**高度场间隙**（不是射raycaster：globe 顶点位移在 GPU 侧，
   CPU 几何不含地形起伏，raycaster 量不准）。
   间隙 margin = |q| − (R + groundAt(q̂))，即机位沿径向离坡面的米数。
   相机 near = 1m —— margin < 1 时近裁剪面必然切进坡体（画面下半透出地底）。 */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'S60', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);

  /* ---------- ① 找最陡的方向（经纬网格扫；_tileCells 只在地表层建好后才有） ---------- */
  const slope = await p.evaluate(() => {
    const M = GAME.map3d, R = M.R;
    const g = (d) => { try { return M._groundAtUnit(d) || 0; } catch (e) { return 0; } };
    const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    let best = null;
    const eps = 0.006;
    for (let latD = -78; latD <= 78; latD += 3) {
      const lat = latD * Math.PI / 180;
      for (let lonD = 0; lonD < 360; lonD += 3) {
        const lon = lonD * Math.PI / 180;
        const d = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
        const h = g(d);
        if (!(h > 8)) continue;                      /* 只要山地 */
        const north = unit(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
        const east = unit(Math.cos(lon), 0, -Math.sin(lon));
        const at = (a, b2) => g(unit(d[0] + east[0] * a + north[0] * b2,
                                     d[1] + east[1] * a + north[1] * b2,
                                     d[2] + east[2] * a + north[2] * b2));
        const gx = (at(eps, 0) - at(-eps, 0)) / (2 * eps);
        const gy = (at(0, eps) - at(0, -eps)) / (2 * eps);
        const grad = Math.hypot(gx, gy);
        if (!best || grad > best.grad) {
          best = { dir: d.slice(), h: h, grad: grad,
                   deg: Math.atan(grad / R) * 180 / Math.PI };
        }
      }
    }
    return best;
  });
  if (!slope) { console.log('NO_SLOPE_FOUND'); await b.close(); return; }
  console.log('SLOPE ci=' + slope.ci + ' h=' + slope.h.toFixed(1) + 'm 坡度≈' + slope.deg.toFixed(1) + '°');

  /* ---------- ② 把玩家放到坡上，进地表 ---------- */
  await p.evaluate((s) => {
    const M = GAME.map3d;
    M.FOLLOW = false;
    M._fly.active = false; M._fly.phase = 'cruise';
    M.setSpin && M.setSpin(false);
    M._surfCamAnchor = null;
    M._surfDir = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
    M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (!isFinite(M._surfRight.x)) M._surfRight.set(1, 0, 0);
    M._surfCamE1 = null;
    M._surfTilt = null;
    var _gh = M._groundAtUnit([s.dir[0], s.dir[1], s.dir[2]]) || 0;
    M.setPlayerPose({ dir: [s.dir[0], s.dir[1], s.dir[2]], h: _gh, yaw: 0, v: [0, 0, 0], ci: null });
    M.surfaceMode(true);
    /* 锚点直接钉在坡面（否则它会取 camO.dir = 高空那束视线，探针测的是别处） */
    M._surfCamAnchor = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2])
      .normalize().multiplyScalar(M.R + _gh + 0.05);
    M._lastAct = Date.now();
  }, slope);
  await p.waitForTimeout(900);

  /* ---------- ③ 绕一圈 × 多仰角，量机位间隙 ---------- */
  const meas = await p.evaluate(() => {
    const M = GAME.map3d, R = M.R;
    const out = [];
    const keepYaw = M._surfOrbitYaw, keepEl = M.SURF_CAM_EL, keepDist = M._surfCamDist;
    /* 采一组方向上的间隙：机位本身 + 8 方位环绕（半径 1m，球面切向） */
    const marginAt = (q) => {
      const l = Math.hypot(q.x, q.y, q.z) || 1;
      const d = [q.x / l, q.y / l, q.z / l];
      return l - (R + (M._groundAtUnit(d) || 0));
    };
    const probeCam = () => {
      const cam = M._cam;
      const c = cam.position.clone();
      const up = c.clone().normalize();
      let t1 = new up.constructor(0, 1, 0).cross(up);
      if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new up.constructor().crossVectors(up, t1).normalize();
      const pts = [[0, 0]];
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        for (const rr of [0.6, 1.0, 1.6, 2.2]) {
          pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
      }
      /* 再补"向下 1~3m"的视锥下缘近似点 */
      const down = up.clone().negate();
      for (const dy of [1, 2, 3]) pts.push({ dv: down.clone().multiplyScalar(dy) });
      /* 真穿模的判据：**距离相机 < near 且在地形下** —— 只有这样的点会被
         近裁剪面切进坡体、画面透出地底。距离 > near 的点在地形下是正常地面
         （相机离地 2.9m 时，正下方 3m 处当然在地形下）。 */
      let minM = 1e9, nearBad = 0, nearBadM = 0;
      for (const o of pts) {
        const q = Array.isArray(o)
          ? c.clone().addScaledVector(t1, o[0]).addScaledVector(t2, o[1])
          : c.clone().add(o.dv);
        const mg = marginAt(q);
        if (mg < minM) minM = mg;
        if (q.distanceTo(c) < (window.__NEAR || 2) && mg < 0) { nearBad++; nearBadM = Math.min(nearBadM, mg); }
      }
      /* 视线路径（锚点到机位）上的最小间隙：坡挡在中间就会很负 */
      const A = M._surfCamAnchor || c;
      let pathMin = 1e9;
      for (let i = 0; i <= 12; i++) {
        const q = A.clone().lerp(c, i / 12);
        pathMin = Math.min(pathMin, marginAt(q));
      }
      return { camMargin: +marginAt(c).toFixed(2), minM: +minM.toFixed(2),
               pathMin: +pathMin.toFixed(2), nearBad: nearBad, nearBadM: +nearBadM.toFixed(2) };
    };
    for (const el of [0.06, 0.35, 0.7, 1.0, 1.35]) {
      M.SURF_CAM_EL = el;
      for (let yi = 0; yi < 12; yi++) {
        M._surfOrbitYaw = yi * Math.PI / 6;
        /* 走真实出口：_surfAvatarCam 会写 cam.position / cam.up，
           与 placeCamera 里的地表分支是同一段代码（探针不另算一套） */
        M._surfAvatarCam();
        const r = probeCam();
        r.lift = M._surfCamLift60 || 0;
        r.dbg = M._dbg60 || null;
        r.camY = +M._cam.position.length().toFixed(2);
        out.push({ el: el, yaw: +(M._surfOrbitYaw).toFixed(2), ...r });
      }
    }
    M._surfOrbitYaw = keepYaw; M.SURF_CAM_EL = keepEl; M._surfCamDist = keepDist;
    return out;
  });

  const near = await p.evaluate(() => GAME.map3d._cam.near);
  await p.evaluate((n) => { window.__NEAR = n; }, near);
  const bad = meas.filter((m) => m.nearBad > 0);
  const badPath = meas.filter((m) => m.pathMin < 0);
  const worst = meas.reduce((a, m) => (m.nearBadM < a.nearBadM ? m : a), meas[0]);
  console.log('near=' + near + ' 采样=' + meas.length);
  console.log('**近平面切坡（真穿模）**的角度数: ' + bad.length + ' / ' + meas.length
    + '  (最低 ' + Math.min(...meas.map((m) => m.nearBadM)).toFixed(2) + 'm 在地形下)');
  console.log('视线穿坡(pathMin<0) 的角度数: ' + badPath.length + ' / ' + meas.length);
  console.log('camMargin 分布: min=' + Math.min(...meas.map((m) => m.camMargin)).toFixed(2)
    + ' 中位=' + meas.map((m) => m.camMargin).sort((a, c) => a - c)[Math.floor(meas.length / 2)]);
  console.log('SLOPE_DIR=' + JSON.stringify(slope.dir) + ' grad=' + slope.grad.toFixed(2));
  console.log('--- 穿模明细(前 12) ---');
  bad.slice(0, 6).forEach((m) => console.log('  el=' + m.el + ' yaw=' + m.yaw
    + ' minM=' + m.minM + ' camMargin=' + m.camMargin + ' lift=' + m.lift
    + ' camY=' + m.camY + ' dbg=' + JSON.stringify(m.dbg)));
  console.log('lift 分布: max=' + Math.max(...meas.map((m) => m.lift)).toFixed(2)
    + ' 非零个数=' + meas.filter((m) => m.lift > 0).length);

  /* ---------- ④ 拍最差角度 ---------- */
  await p.evaluate((w) => {
    const M = GAME.map3d;
    M.SURF_CAM_EL = w.el; M._surfOrbitYaw = w.yaw;
  }, worst);
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOTS + 'v15860-diag-worst.png' });
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.06; M._surfOrbitYaw = Math.PI; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOTS + 'v15860-diag-lowback.png' });

  console.log('errs=' + errs.length + (errs.length ? ' ' + errs[0] : ''));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
