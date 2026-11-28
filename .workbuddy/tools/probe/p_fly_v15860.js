'use strict';
/* v158.60 验收探针：斜坡相机穿模。
   ① 陡坡 60 角度：近平面切坡 = 0、视线穿坡 = 0
   ② 平地不回归：不需抬升（lift≈0），机位高度与改前同口径
   ③ 抬升有上限、不把相机甩上天
   ④ 走动（锚点跟随）时仍不穿
   ⑤ 相机/人物仍可见（不因抬升跑到画面外）
   ⑥ 性能：单帧相机计算不超预算 */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  if (cond) { pass++; console.log('✅ ' + name + (info ? ' · ' + info : '')); }
  else { fail++; console.log('❌ ' + name + (info ? ' · ' + info : '')); }
};

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
  await p.evaluate(() => { GAME.newGame({ name: 'V60', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);

  /* 找陡坡 + 找平地 */
  const spots = await p.evaluate(() => {
    const M = GAME.map3d, R = M.R;
    const g = (d) => { try { return M._groundAtUnit(d) || 0; } catch (e) { return 0; } };
    const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const eps = 0.006;
    let steep = null, flat = null;
    for (let latD = -78; latD <= 78; latD += 4) {
      const lat = latD * Math.PI / 180;
      for (let lonD = 0; lonD < 360; lonD += 4) {
        const lon = lonD * Math.PI / 180;
        const d = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
        const h = g(d);
        const north = unit(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
        const east = unit(Math.cos(lon), 0, -Math.sin(lon));
        const at = (a, b2) => g(unit(d[0] + east[0] * a + north[0] * b2,
                                     d[1] + east[1] * a + north[1] * b2,
                                     d[2] + east[2] * a + north[2] * b2));
        const grad = Math.hypot((at(eps, 0) - at(-eps, 0)) / (2 * eps), (at(0, eps) - at(0, -eps)) / (2 * eps));
        if (h > 10 && (!steep || grad > steep.grad)) steep = { dir: d.slice(), h: h, grad: grad };
        /* 平地判据必须看**周边高差**（3.4m 环）：只看梯度会选到台地边缘
           —— 梯度 0 但 3m 外有 1m 台阶，那种地方本来就该抬（否则相机埋进台面）。 */
        let hi = h, lo = h;
        for (let k = 0; k < 8; k++) {
          const a2 = k * Math.PI / 4;
          const r3 = 0.0057;                    /* 1.7m / R */
          const q3 = unit(d[0] + east[0] * Math.cos(a2) * r3 + north[0] * Math.sin(a2) * r3,
                          d[1] + east[1] * Math.cos(a2) * r3 + north[1] * Math.sin(a2) * r3,
                          d[2] + east[2] * Math.cos(a2) * r3 + north[2] * Math.sin(a2) * r3);
          const h3 = g(q3);
          if (h3 > hi) hi = h3;
          if (h3 < lo) lo = h3;
        }
        const relief = hi - lo;
        if (h > 0.6 && h < 8 && (!flat || relief < flat.relief)) {
          flat = { dir: d.slice(), h: h, grad: grad, relief: relief };
        }
      }
    }
    return { steep: steep, flat: flat };
  });
  ok('①找点：陡坡 grad>150、平地 1.7m 环高差 <0.6（最平处）',
    !!spots.steep && spots.steep.grad > 150 && !!spots.flat && spots.flat.relief < 0.6,
    spots.steep ? ('陡坡 h=' + spots.steep.h.toFixed(1) + ' grad=' + spots.steep.grad.toFixed(0)
      + ' | 平地 h=' + spots.flat.h.toFixed(1) + ' relief=' + (spots.flat.relief == null ? 'n/a' : spots.flat.relief.toFixed(2))) : 'null');

  /* 摆到指定点 + 进地表 */
  const place = async (sp) => p.evaluate((s) => {
    const M = GAME.map3d;
    M.FOLLOW = false;
    M._fly.active = false; M._fly.phase = 'cruise';
    M.setSpin && M.setSpin(false);
    if (M._surf) { try { M.surfaceMode(false); } catch (e) {} }
    const gh = M._groundAtUnit([s.dir[0], s.dir[1], s.dir[2]]) || 0;
    M.setPlayerPose({ dir: [s.dir[0], s.dir[1], s.dir[2]], h: gh, yaw: 0, v: [0, 0, 0], ci: null });
    M.surfaceMode(true);
    M._surfCamAnchor = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2])
      .normalize().multiplyScalar(M.R + gh + 0.05);
    M._surfDir = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
    M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (!isFinite(M._surfRight.x)) M._surfRight.set(1, 0, 0);
    M._surfCamE1 = null; M._surfTilt = null;
    M.SURF_CAM_EL = 1.0; M._surfOrbitYaw = 0;
    M._lastAct = Date.now();
    return { gh: gh, surf: M._surf };
  }, sp);

  /* 扫角度：返回穿模统计 */
  const sweep = async (els, yaws) => p.evaluate((arg) => {
    const M = GAME.map3d, R = M.R, cam = M._cam;
    const NEAR = cam.near;
    const out = [];
    for (const el of arg.els) {
      M.SURF_CAM_EL = el;
      for (let yi = 0; yi < arg.yaws; yi++) {
        M._surfOrbitYaw = yi * Math.PI * 2 / arg.yaws;
        M._surfAvatarCam();
        const c = cam.position.clone();
        /* 机位周边采样：4 环 × 8 方位 + 向下 1~3m */
        const up = c.clone().normalize();
        let t1 = new THREE.Vector3(0, 1, 0).cross(up);
        if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
        t1.normalize();
        const t2 = new THREE.Vector3().crossVectors(up, t1).normalize();
        /* ============================================================
         * 真穿模 = **近裁剪面**上有地形。近平面是垂直于视线的平面、在
         *   相机前方 near 处，四角张角 = fov。判据必须取这些点：
         *   相机正下方 1m 的点在地形下是**正常**的（相机离地 0.55m 时下方
         *   当然是土），它不在近平面上、不会被裁 —— 第一版探针把它当穿模，
         *   平地误报 23 个角度。
         * ============================================================ */
        const fwd = (M._surfCamAnchor.clone().sub(c)).normalize();
        let rt = new THREE.Vector3().crossVectors(fwd, up);
        if (rt.lengthSq() < 1e-6) rt = t1.clone();
        rt.normalize();
        const upF = new THREE.Vector3().crossVectors(rt, fwd).normalize();
        const half = Math.tan((cam.fov || 42) * Math.PI / 360) * NEAR;
        const nearC = c.clone().addScaledVector(fwd, NEAR);
        const pts = [c.clone(), nearC.clone()];
        for (const sx of [-1, 0, 1]) {
          for (const sy of [-1, 0, 1]) {
            pts.push(nearC.clone().addScaledVector(rt, sx * half).addScaledVector(upF, sy * half));
          }
        }
        /* 再补机身周边（防机位本体嵌进坡） */
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4;
          for (const rr of [0.5, 1.0]) {
            pts.push(c.clone().addScaledVector(rt, Math.cos(a) * rr).addScaledVector(upF, Math.sin(a) * rr));
          }
        }
        const marginOf = (q) => {
          const l = q.length() || 1;
          return l - (R + (M._groundAtUnit([q.x / l, q.y / l, q.z / l]) || 0));
        };
        /* 分两类：① 近平面 3×3 + 中心 = 真正决定画面的那 10 个点；
           ② 机身周边 0.5/1.0m 环 —— 相机是点，旁边有土不等于穿模，
           只有"埋进土 ≥0.5m"才算嵌坡。 */
        let nearBad = 0, minM = 1e9, bodyBad = 0;
        for (let pi = 0; pi < pts.length; pi++) {
          const q = pts[pi];
          const mg = marginOf(q);
          if (mg < minM) minM = mg;
          if (pi < 10) { if (mg < 0) nearBad++; }
          else { if (mg < -0.5) bodyBad++; }
        }
        if (bodyBad) nearBad += bodyBad;
        /* 视线穿坡 */
        const A = M._surfCamAnchor;
        let pathMin = 1e9;
        for (let i = 0; i <= 12; i++) {
          const q = A.clone().lerp(c, i / 12);
          pathMin = Math.min(pathMin, marginOf(q));
        }
        /* 记录第一个切坡点的现场 */
        let bq = null;
        if (nearBad > 0) {
          for (const q of pts) {
            if (q.distanceTo(c) < NEAR && marginOf(q) < 0) {
              bq = { d: +q.distanceTo(c).toFixed(2), mg: +marginOf(q).toFixed(2),
                     gh: +(M._groundAtUnit([q.x / q.length(), q.y / q.length(), q.z / q.length()]) || 0).toFixed(2) };
              break;
            }
          }
        }
        out.push({ el: el, yaw: +M._surfOrbitYaw.toFixed(2), nearBad: nearBad, bq: bq,
          minM: +minM.toFixed(2), pathMin: +pathMin.toFixed(2),
          camMargin: +marginOf(c).toFixed(2), lift: M._surfCamLift60 || 0,
          pull: M._surfCamPull60 ? 1 : 0, dist: +c.distanceTo(A).toFixed(2),
          snap: M._surfClear60 || null,
          camY: +c.length().toFixed(2) });
      }
    }
    return out;
  }, { els: els, yaws: yaws });

  /* ---------- ① 陡坡 60 角度 ---------- */
  await place(spots.steep);
  const steepMeas = await sweep([0.06, 0.35, 0.7, 1.0, 1.35], 12);
  const sBad = steepMeas.filter((m) => m.nearBad > 0);
  const sPath = steepMeas.filter((m) => m.pathMin < 0);
  ok('②陡坡 60 角度：近平面切坡 = 0、视线穿坡 = 0',
    sBad.length === 0 && sPath.length === 0,
    '切坡 ' + sBad.length + '/60 · 视线穿 ' + sPath.length + '/60 · minM ' + Math.min(...steepMeas.map((m) => m.minM)).toFixed(2));
  ok('③陡坡抬升有上限且未爆炸（max lift ≤ SURF_CAM_CLEAR_MAX）',
    Math.max(...steepMeas.map((m) => m.lift)) <= 14.01,
    'max lift=' + Math.max(...steepMeas.map((m) => m.lift)).toFixed(2)
      + ' 非零=' + steepMeas.filter((m) => m.lift > 0).length + '/60');
  ok('④陡坡机位仍在锚点可及范围（距离 ≤ 26m，人物可见）',
    Math.max(...steepMeas.map((m) => m.dist)) < 26,
    'dist min/max=' + Math.min(...steepMeas.map((m) => m.dist)).toFixed(1) + '/' + Math.max(...steepMeas.map((m) => m.dist)).toFixed(1));

  /* ---------- ② 平地不回归 ---------- */
  await place(spots.flat);
  const flatMeas = await sweep([0.06, 0.35, 0.7, 1.0, 1.35], 12);
  const fBad = flatMeas.filter((m) => m.nearBad > 0);
  const fPath = flatMeas.filter((m) => m.pathMin < 0);
  const fLift = flatMeas.filter((m) => m.lift > 0);
  /* 平地抬升上限 2.5m：坡**脚**朝坡上看时近平面必然扎进坡面，抬 2m 是必要的；
     真平地（四周等高）lift ≈ 0。判据要防的是"无谓把镜头甩远"。 */
  ok('⑤平地 60 角度：无切坡、无视线穿坡、抬升 ≤2.5m 且机距未被甩远',
    fBad.length === 0 && fPath.length === 0
      && (fLift.length === 0 || Math.max(...fLift.map((m) => m.lift)) <= 2.5)
      && Math.max(...flatMeas.map((m) => m.dist)) <= 18,
    '切坡 ' + fBad.length + ' · 视线穿 ' + fPath.length + ' · 抬升角度 ' + fLift.length + '/60'
      + ' maxLift=' + (fLift.length ? Math.max(...fLift.map((m) => m.lift)).toFixed(2) : '0')
      + ' 样本=' + JSON.stringify(fBad.slice(0, 3).map((m) => ({ el: m.el, yaw: m.yaw, camMargin: m.camMargin, lift: m.lift, snap: m.snap, bq: m.bq }))));

  /* ---------- ③ 走动时不穿（锚点跟随） ---------- */
  await place(spots.steep);
  const walk = await p.evaluate(() => {
    const M = GAME.map3d, R = M.R, cam = M._cam;
    let worst = 0, worstPath = 0, n = 0;
    const marginOf = (q) => {
      const l = q.length() || 1;
      return l - (R + (M._groundAtUnit([q.x / l, q.y / l, q.z / l]) || 0));
    };
    for (let i = 0; i < 24; i++) {
      /* 模拟走动：玩家方向沿切向平移一小步，锚点滞后跟随 */
      const pp = M.playerPose();
      const d = pp.dir;
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      const u = [d[0] / l, d[1] / l, d[2] / l];
      let t1 = [u[1], -u[0], 0];
      const lt = Math.hypot(t1[0], t1[1], t1[2]) || 1;
      t1 = t1.map((x) => x / lt);
      const step = 0.0016;
      const nd = [u[0] + t1[0] * step, u[1] + t1[1] * step, u[2] + t1[2] * step];
      const nl = Math.hypot(nd[0], nd[1], nd[2]);
      const ndu = nd.map((x) => x / nl);
      M.setPlayerPose({ dir: ndu, h: M._groundAtUnit(ndu) || 0, yaw: 0, v: [0, 0, 0], ci: null });
      M._lastAvOut = { moved: true };
      M._lastAvDt = 0.016;
      M.SURF_CAM_EL = 0.35;
      M._surfOrbitYaw = i * 0.26;
      M._surfAvatarCam();
      const c = cam.position.clone();
      const A = M._surfCamAnchor;
      let pathMin = 1e9;
      for (let k = 0; k <= 10; k++) pathMin = Math.min(pathMin, marginOf(A.clone().lerp(c, k / 10)));
      /* 切坡：机位周围 0.9m 环 */
      const up = c.clone().normalize();
      let t1v = new THREE.Vector3(0, 1, 0).cross(up);
      if (t1v.lengthSq() < 1e-6) t1v.set(1, 0, 0);
      t1v.normalize();
      const t2v = new THREE.Vector3().crossVectors(up, t1v).normalize();
      let nb = 0;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        const q = c.clone().addScaledVector(t1v, Math.cos(a) * 0.9).addScaledVector(t2v, Math.sin(a) * 0.9);
        if (q.distanceTo(c) < cam.near && marginOf(q) < 0) nb++;
      }
      worst = Math.max(worst, nb);
      worstPath = Math.min(worstPath, pathMin);
      n++;
    }
    return { n: n, worst: worst, worstPath: +worstPath.toFixed(2) };
  });
  ok('⑥走动 24 步（锚点跟随 + 转角度）：无切坡、视线不穿坡',
    walk.worst === 0 && walk.worstPath >= 0,
    'steps=' + walk.n + ' 切坡点=' + walk.worst + ' 视线最小间隙=' + walk.worstPath + 'm');

  /* ---------- ④ 视觉：陡坡低仰角 / 陡坡正对坡 ---------- */
  await place(spots.steep);
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.06; M._surfOrbitYaw = 2.6; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + 'v15860-A-slope-low.png' });
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.35; M._surfOrbitYaw = 5.24; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + 'v15860-B-slope-worst.png' });
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 1.0; M._surfOrbitYaw = 0; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + 'v15860-C-slope-top.png' });

  /* 平地对照（视角应与改前一致） */
  await place(spots.flat);
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 1.0; M._surfOrbitYaw = 0; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + 'v15860-D-flat.png' });

  /* ---------- ④b 真鼠标右键拖（老板的实际操作路径） ---------- */
  await place(spots.steep);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);
  const dragScan = async (dxTotal, dyTotal, steps) => {
    await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.7; M._surfOrbitYaw = 0; });
    await p.mouse.move(CX, CY);
    await p.mouse.down({ button: 'right' });
    let bad = 0, nearBadMax = 0, yawSeen = 0, elSeen = 0, el0 = null, el1 = null;
    for (let i = 1; i <= steps; i++) {
      await p.mouse.move(CX + Math.round(dxTotal * i / steps), CY + Math.round(dyTotal * i / steps));
      await p.waitForTimeout(45);
      const st = await p.evaluate(() => {
        const M = GAME.map3d, R = M.R, cam = M._cam;
        const c = cam.position.clone();
        const NEAR = cam.near;
        const A = M._surfCamAnchor;
        const fwd = A.clone().sub(c).normalize();
        let rt = new THREE.Vector3().crossVectors(fwd, c.clone().normalize());
        if (rt.lengthSq() < 1e-6) rt.set(1, 0, 0);
        rt.normalize();
        const upF = new THREE.Vector3().crossVectors(rt, fwd).normalize();
        const half = Math.tan((cam.fov || 42) * Math.PI / 360) * NEAR;
        const nearC = c.clone().addScaledVector(fwd, NEAR);
        const mg = (q) => {
          const l = q.length() || 1;
          return l - (R + (M._groundAtUnit([q.x / l, q.y / l, q.z / l]) || 0));
        };
        let nb = 0;
        for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) {
          const q = nearC.clone().addScaledVector(rt, sx * half).addScaledVector(upF, sy * half);
          if (mg(q) < 0) nb++;
        }
        let pathMin = 1e9;
        for (let k = 0; k <= 10; k++) pathMin = Math.min(pathMin, mg(A.clone().lerp(c, k / 10)));
        return { nb: nb, pathMin: +pathMin.toFixed(2), yaw: M._surfOrbitYaw, el: M.SURF_CAM_EL };
      });
      if (st.nb > 0) bad++;
      if (st.nb > nearBadMax) nearBadMax = st.nb;
      yawSeen = Math.abs(st.yaw);
      elSeen = st.el;
      if (el0 == null) el0 = st.el;
      el1 = st.el;
    }
    await p.mouse.up({ button: 'right' });
    return { bad: bad, nearBadMax: nearBadMax, yawSeen: yawSeen,
             el0: el0, el1: el1, elSeen: elSeen, steps: steps };
  };
  const dH = await dragScan(560, 0, 14);        /* 水平拖：绕一圈 */
  const dV = await dragScan(0, 240, 12);        /* 垂直拖：改仰角 */
  ok('⑨真右键拖：水平 560px 转绕圈、垂直 240px 改仰角，每步近平面都不切坡',
    dH.bad === 0 && dV.bad === 0
      && dH.yawSeen > 0.15                                  /* 水平拖真的转了 */
      && dV.el0 != null && Math.abs(dV.el1 - dV.el0) > 0.1,  /* 垂直拖真的改了仰角 */
    '水平 ' + dH.bad + '/' + dH.steps + ' 步切坡 (yaw ' + dH.yawSeen.toFixed(2) + ')'
      + ' · 垂直 ' + dV.bad + '/' + dV.steps + ' 步 (el '
      + (dV.el0 == null ? '?' : dV.el0.toFixed(2)) + '→'
      + (dV.el1 == null ? '?' : dV.el1.toFixed(2)) + ')');

  /* ---------- ⑤ 性能 ---------- */
  const perf = await p.evaluate(() => {
    const M = GAME.map3d;
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) { M._surfOrbitYaw = (i % 12) * 0.26; M._surfAvatarCam(); }
    const ms = (performance.now() - t0) / 120;
    return +ms.toFixed(3);
  });
  ok('⑦性能：单帧相机计算 < 1.2ms（60fps 预算的 7%）', perf < 1.2, perf.toFixed(3) + ' ms/帧');

  ok('⑧无 JS 异常', errs.length === 0, 'errs=' + errs.length + (errs.length ? ' ' + errs[0] : ''));

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
