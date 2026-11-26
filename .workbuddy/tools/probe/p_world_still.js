/* ============================================================
 * p_world_still.js · 「移动时到底是谁在动」
 * ------------------------------------------------------------
 * 老板：「为啥移动整个世界都在动，而不是相机+人物移动」
 *
 * 要区分三种完全不同的原因：
 *   A. 相机硬跟随（cam.position 每帧 = 玩家位置 + 偏移）
 *      → 人在屏幕上钉死正中，世界流过。第三人称跟随的必然，
 *        但观感上就是"世界在动"。
 *   B. 世界几何真的被改写（地砖/地形的世界坐标随行走漂移）→ 真 bug。
 *   C. 地表层每 2.6 米整层重建，远处地形重新采样 → "游泳"。
 *
 * 判据全部取**世界坐标**（不受相机影响）：
 *   ① 同一格编号 → 世界方向：走 8 秒前后必须一致
 *   ② 同一批砖顶点：重建前后必须重合（世界锚定）
 *   ③ 玩家屏幕 NDC：走的时候是否恒 (0,0)（A 的证据）
 *   ④ 相机位移 vs 玩家位移
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pworldstill';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE, headless: true, args: ['--allow-file-access-from-files', '--no-sandbox']
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  /* 固定种子：这张图上的地形/城位每次都一样，结论可复现 */
  await p.evaluate(() => {
    GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(1600);
  await p.evaluate(() => {
    try {
      document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => {
        if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click();
      });
    } catch (e) { }
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
  await p.waitForTimeout(1800);

  const st0 = await p.evaluate(() => {
    const M = GAME.map3d;
    const cam = (M._camObj ? M._camObj() : M._cam);
    const camR = cam ? Math.hypot(cam.position.x, cam.position.y, cam.position.z) : -1;
    return { surf: !!M._surf, dist: +M.camO.dist.toFixed(2),
      eyeAbove: +(camR - M.R).toFixed(2),
      playerCi: M.playerCi ? M.playerCi() : -1, hasCam: !!M._cam,
      hasScene: !!(M._globe && M._globe.parent) };
  });
  console.log('—— 地表状态 ' + JSON.stringify(st0));

  const sample = () => p.evaluate(() => {
    const M = GAME.map3d;
    const THREE = window.THREE;
    const cam = (M._camObj ? M._camObj() : M._cam);
    const scene = (M._globe && M._globe.parent) ? M._globe.parent : null;
    const pp = M.playerPose();
    const _R2 = M.R + (isFinite(pp.h) ? pp.h : 0) + 0.05;
    const P = new THREE.Vector3(pp.dir[0], pp.dir[1], pp.dir[2]).multiplyScalar(_R2);
    cam.updateMatrixWorld();
    const ps = P.clone().project(cam);

    const cell = M.gridCellOf(pp.dir);
    const cellDir = cell ? M.gridCellDir(cell.i, cell.j) : null;
    const cellW = cellDir ? [cellDir[0] * M.R, cellDir[1] * M.R, cellDir[2] * M.R] : null;

    /* 地表层结构 */
    const root = scene.getObjectByName('surfaceLayer');
    const out = { ci: M.playerCi ? M.playerCi() : -1,
      pos: [+P.x.toFixed(4), +P.y.toFixed(4), +P.z.toFixed(4)],
      camPos: [+cam.position.x.toFixed(4), +cam.position.y.toFixed(4), +cam.position.z.toFixed(4)],
      camQ: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w].map((v) => +v.toFixed(5)),
      ndc: [+ps.x.toFixed(4), +ps.y.toFixed(4)],
      cell: cell ? [cell.i, cell.j] : null,
      cellW: cellW ? cellW.map((v) => +v.toFixed(4)) : null,
      reanchors: M._gridReanchors || 0 };

    if (root) {
      root.updateMatrixWorld(true);
      out.rootMat = root.matrixWorld.elements.map((v) => +v.toFixed(5));
      const pl = root.getObjectByName('surfPlate');
      if (pl && pl.geometry) {
        const a = pl.geometry.attributes.position.array;
        out.plateN = a.length / 3;
        /* 取按世界坐标排序后最小/最大的两个顶点 —— 窗口滑动时它们会变，
           但**同一批世界点**必须还在原处：把世界坐标四舍五入到 0.01 米做集合，
           比较两次采样里"共同点"是否同位。 */
        out.plateSample = [];
        for (let k = 0; k < Math.min(a.length, 9 * 3); k += 3) {
          out.plateSample.push([+a[k].toFixed(3), +a[k + 1].toFixed(3), +a[k + 2].toFixed(3)]);
        }
      }
      /* 地形层：取全部顶点的世界坐标质心 + 覆盖半径（游泳会表现为质心随玩家漂） */
      const tr = root.getObjectByName('surfTerrain');
      if (tr && tr.geometry) {
        const a = tr.geometry.attributes.position.array;
        let sx = 0, sy = 0, sz = 0, n = a.length / 3;
        for (let k = 0; k < a.length; k += 3) { sx += a[k]; sy += a[k + 1]; sz += a[k + 2]; }
        out.terrN = n;
        out.terrCentroid = [sx / n, sy / n, sz / n].map((v) => +v.toFixed(3));
      }
    }
    return out;
  });

  const walk = (seconds, keys) => p.evaluate(({ sec, k }) => {
    const M = GAME.map3d;
    const n = Math.round(sec * 60);
    GAME._keys = Object.assign({}, k);
    let rebuilds = 0;
    let lastDir = (M.camO.dir || [0, 1, 0]).slice();
    const halfCell = (5.25 / M.R) * 0.5;
    for (let i = 0; i < n; i++) {
      const out = M.stepAvatar(1 / 60, GAME._keys);
      M.syncAvatarFigure(1 / 60, out);
      /* ⚠️ 这两行渲染循环会写，手动驱动必须补 —— 「是否在走」靠它判断
         （漏了会让镜头以为一直站着，滞后永远不启用，测出来只有 3px） */
      M._lastAvOut = out; M._lastAvDt = 1 / 60;
      const pp = M.playerPose();
      if (pp && pp.dir) M.camO.dir = pp.dir.slice();
      if (M._surf) {
        if (M._surfAvatarCam) M._surfAvatarCam();
        /* 与渲染循环同一节流：走半格才重建 */
        const d = M.camO.dir;
        const dot = d[0] * lastDir[0] + d[1] * lastDir[1] + d[2] * lastDir[2];
        if (dot < Math.cos(halfCell)) { M.rebuildSurf(d); lastDir = d.slice(); rebuilds++; }
      }
    }
    GAME._keys = {};
    return rebuilds;
  }, { sec: seconds, k: keys || {} });

  const diag = await p.evaluate(() => {
    const M = GAME.map3d, cam = (M._camObj ? M._camObj() : M._cam);
    const before = [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)];
    let ret = null, err = null;
    try { ret = M._surfAvatarCam(); } catch (e) { err = e.message; }
    const after = [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)];
    const pp = M.playerPose();
    const P = new THREE.Vector3(pp.dir[0], pp.dir[1], pp.dir[2]).multiplyScalar(M.R);
    return { ret: ret, err: err, before: before, after: after,
      distToP: +Math.hypot(after[0] - P.x, after[1] - P.y, after[2] - P.z).toFixed(2),
      SURF_CAM_DIST: M.SURF_CAM_DIST, SURF_CAM_EL: M.SURF_CAM_EL,
      SURF_AVATAR: M.SURF_AVATAR, surf: M._surf, surfVis: M._surfVis,
      agl: +(M.camO.dist - M.R).toFixed(2) };
  });
  console.log('—— 跟随相机直调 ' + JSON.stringify(diag));

  const a0 = await sample();
  const r1 = await walk(4, { w: true });
  await p.waitForTimeout(300);
  const a1 = await sample();
  await p.screenshot({ path: OUT + '/0_walking.png' });   /* 走动中：人应偏离中心 */
  const r2 = await walk(4, { w: true });
  await p.waitForTimeout(300);
  const a2 = await sample();
  await walk(1.2, {});          /* 停 1.2 秒：镜头锚点必须归位 */
  await p.waitForTimeout(200);
  const a3 = await sample();
  await p.screenshot({ path: OUT + '/1_after_walk.png' });

  const dist = (A, B) => Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2);

  console.log('\n=== ① 同一格编号的世界坐标 ===');
  console.log('  t0 格 ' + JSON.stringify(a0.cell) + ' → cellW ' + JSON.stringify(a0.cellW));
  console.log('  t2 格 ' + JSON.stringify(a2.cell) + ' → cellW ' + JSON.stringify(a2.cellW));
  const backA = a0.cellW ? null : null;
  /* 回到起点格号，看世界坐标还是不是原处 */
  const same = await p.evaluate(({ ci }) => {
    const M = GAME.map3d;
    const d = M.gridCellDir(ci[0], ci[1]);
    if (!d) return null;
    return [d[0] * M.R, d[1] * M.R, d[2] * M.R].map((v) => +v.toFixed(4));
  }, { ci: a0.cell });
  console.log('  t0 起点格现在的世界坐标 ' + JSON.stringify(same)
    + '   漂移 ' + (same ? dist(same, a0.cellW).toFixed(3) : '?') + ' 米');

  console.log('\n=== ② 玩家 / 相机 ===');
  console.log('  玩家位移 t0→t2 = ' + dist(a0.pos, a2.pos).toFixed(2) + ' 米');
  console.log('  相机位移 t0→t2 = ' + dist(a0.camPos, a2.camPos).toFixed(2) + ' 米');
  console.log('  相机到人距离 = ' + dist(a0.camPos, a0.pos).toFixed(2) + ' → ' + dist(a2.camPos, a2.pos).toFixed(2) + ' 米');
  console.log('  玩家 NDC  静止 ' + JSON.stringify(a0.ndc) + ' → 走4s ' + JSON.stringify(a1.ndc)
    + ' → 走8s ' + JSON.stringify(a2.ndc) + ' → 停1.2s ' + JSON.stringify(a3.ndc));
  console.log('  重建次数  ' + r1 + ' + ' + r2);

  console.log('\n=== ③ 地砖顶点（前 3 个） ===');
  console.log('  顶点数 ' + a0.plateN + ' → ' + a1.plateN + ' → ' + a2.plateN);
  console.log('  t0 ' + JSON.stringify(a0.plateSample));
  console.log('  t2 ' + JSON.stringify(a2.plateSample));

  console.log('\n=== ④ 地形层质心（游泳 = 跟着人漂） ===');
  console.log('  顶点数 ' + a0.terrN);
  console.log('  t0 ' + JSON.stringify(a0.terrCentroid));
  console.log('  t2 ' + JSON.stringify(a2.terrCentroid));
  console.log('  质心漂移 ' + dist(a0.terrCentroid, a2.terrCentroid).toFixed(3) + ' 米（玩家走了 '
    + dist(a0.pos, a2.pos).toFixed(2) + ' 米）');

  console.log('\n=== ⑤ 地表根节点世界矩阵是否恒等 ===');
  console.log('  t0 ' + JSON.stringify(a0.rootMat));
  console.log('  t2 ' + JSON.stringify(a2.rootMat));
  console.log('  重锚 ' + a0.reanchors + ' → ' + a2.reanchors);

  if (errs.length) console.log('\n错误: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
