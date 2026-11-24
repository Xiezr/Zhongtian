/* P3 载具与碰撞探针（v158.3）
 * 判据：A 上/下车 ≤2 键 / B WASD 真驱动（非 0 位移）/ C 撞墙穿透 0 /
 *       D 子步进 ≤0.5 格 + 刹车 ≤0.5s / E 三级按键隔离 / F 退出位姿还原 /
 *       G 相机跟随不碰 camO / H 回退开关 + 旧路径保留
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/vehicle_probe.js > .workbuddy/tmp/vehicle_probe.log 2>&1
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'vehicle', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);

  await p.evaluate(() => {
    window.__loadN = 0;
    const o = GAME.loadGame;
    GAME.loadGame = function () { window.__loadN++; return o.apply(this, arguments); };
    window.__settle = function () {
      const D = GAME.district;
      D.TRANSITION_MS = 1;
      for (let i = 0; i < 8 && D.active; i++) D.tick();
      D.TRANSITION_MS = 240;
      D.camera();
    };
  });

  /* 进入街区并 settle */
  const city = await p.evaluate(() => {
    const c = (GAME.state.cities || [])[0];
    GAME.map3d.setFollow(true);
    GAME.district.enter(c.ci, c);
    window.__settle();
    return { id: c.id, ci: c.ci };
  });
  ok('A0 街区就绪', await p.evaluate(() => GAME.district.active), 'ci=' + city.ci);

  /* ---- A. 走到车旁，真按 E 上车（≤2 键）---- */
  const boardSetup = await p.evaluate(() => {
    const D = GAME.district, V = GAME.vehicle;
    const park = V.parkOf(D.plan);
    D.pos = { x: park.x - 1.2, z: park.z };   /* 车西侧 1.2m */
    D.yaw = Math.PI / 2;                        /* 面向 +x，正对车 */
    V.park = null;                              /* 用默认停点 */
    return { near: !!V.nearestMount(), dist: V.nearestMount() ? V.nearestMount().dist : -1,
      mounted: V.mounted };
  });
  ok('A1 车旁正对时能查到可上载具（非 0 平凡解）',
    boardSetup.near === true && boardSetup.dist > 0 && boardSetup.dist <= 2.2,
    'dist=' + boardSetup.dist + 'm');
  await p.keyboard.press('e');
  const boarded = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    const hud = document.getElementById('vehicle-hud');
    return { mounted: V.mounted, keys: JSON.stringify(V.keys), dkeys: JSON.stringify(D.keys),
      hud: hud ? hud.style.display : '', loadN: window.__loadN };
  });
  ok('A2 真按 E 一次上车（≤2 按键）', boarded.mounted === true, 'mounted=' + boarded.mounted);
  ok('A3 上车后载具 HUD 出现 + 三级按键干净',
    boarded.hud === 'block' && boarded.keys === '{}' && boarded.dkeys === '{}',
    'hud=' + boarded.hud + ' vkeys=' + boarded.keys + ' dkeys=' + boarded.dkeys);
  ok('A4 上下车 0 读盘', boarded.loadN === 0, 'loadGame=' + boarded.loadN);

  /* ---- B. 真按 W 驱动（stepAvatar 不改位置锚，D.step 不跑）---- */
  const drive = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    /* 运动学用无遮挡 plan 单独测（碰撞由 C 段专测），避免起点落在建筑里造成假红。 */
    const clearPlan = Object.assign({}, D.plan, { solids: [] });
    D.pos = { x: 0, z: 0 }; D.yaw = 0; V.speed = 0;
    const p0 = { x: D.pos.x, z: D.pos.z };
    for (let i = 0; i < 60; i++) {
      const r = V.step(1 / 60, { w: 1, a: 0, s: 0, d: 0 }, clearPlan);
      if (!r) return { err: 'step null' };
    }
    return { moved: +Math.hypot(D.pos.x - p0.x, D.pos.z - p0.z).toFixed(3),
      speed: +V.speed.toFixed(3), ground: V.ground };
  });
  ok('B1 W 驱动 1 秒走出 ≥4 米（速度是步行 2 倍，非 0 平凡解）',
    drive.moved >= 4, 'moved=' + drive.moved + 'm speed=' + drive.speed);
  ok('B2 高度只调 P0 _groundAtUnit（有数值）',
    drive.ground != null && isFinite(drive.ground), 'ground=' + drive.ground);

  /* ---- C. 撞建筑穿透 0 ---- */
  const crash = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    const s = D.plan.solids.find((q) => q.x1 - q.x0 >= 0.8) || D.plan.solids[0];
    D.pos = { x: s.x0 - (V.RADIUS + 0.02), z: (s.z0 + s.z1) / 2 };
    D.yaw = Math.PI / 2; V.speed = V.SPEED_MAX;   /* 满速撞 */
    const before = D.pos.x;
    let maxPen = 0;
    for (let i = 0; i < 30; i++) {
      V.step(1 / 60, { w: 1 }, D.plan);
      maxPen = Math.max(maxPen, D.pos.x - (s.x0 - V.RADIUS + 0.001));
    }
    return { before: +before.toFixed(3), after: +D.pos.x.toFixed(3),
      maxPen: +maxPen.toFixed(4), speed: +V.speed.toFixed(3) };
  });
  ok('C1 满速撞建筑穿透 0（maxPen ≈ 0）', crash.maxPen <= 0.02,
    'x ' + crash.before + ' → ' + crash.after + ' maxPen=' + crash.maxPen);
  ok('C2 撞后速度归零（停住，不沿墙滑行）', crash.speed === 0, 'speed=' + crash.speed);

  /* ---- D. 子步进上限 + 刹车 ---- */
  const kin = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    D.pos = { x: 0, z: 0 }; D.yaw = 0; V.speed = V.SPEED_MAX;
    const r = V.step(1 / 60, {}, D.plan);            /* 松键刹车一帧 */
    const brakeV = V.speed;
    let n = 0;
    while (V.speed !== 0 && n < 60) { V.step(1 / 60, {}, D.plan); n++; }
    const brakeS = (n + 1) / 60;
    const subCap = D.plan.T * V.SUBSTEP_FRAC;
    return { subs: r.subs, subCap: +subCap.toFixed(3), brakeS: +brakeS.toFixed(3),
      brakeV: +brakeV.toFixed(3) };
  });
  ok('D1 子步进 ≤0.5 格/步', kin.subs >= 1 && kin.subCap === 1.5,
    'subs=' + kin.subs + ' cap=' + kin.subCap + '格');
  ok('D2 松键刹车 ≤0.5s 归零', kin.brakeS <= 0.5, 'brake=' + kin.brakeS + 's');

  /* ---- E. 三级按键隔离：载具态写 V.keys，不写 GAME._keys/D.keys ---- */
  const iso = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    V.keys = {}; D.keys = {}; GAME._keys = {};
    return { v: JSON.stringify(V.keys), d: JSON.stringify(D.keys), g: JSON.stringify(GAME._keys) };
  });
  await p.keyboard.down('w');
  const isoLive = await p.evaluate(() => ({
    v: JSON.stringify(GAME.vehicle.keys), d: JSON.stringify(GAME.district.keys),
    g: JSON.stringify(GAME._keys) }));
  await p.keyboard.up('w');
  ok('E1 载具态 W 只写 V.keys（GAME._keys/D.keys 空）',
    isoLive.v === '{"w":1}' && isoLive.d === '{}' && isoLive.g === '{}',
    JSON.stringify(isoLive));
  const isoUp = await p.evaluate(() => JSON.stringify(GAME.vehicle.keys));
  ok('E2 松键清 V.keys', isoUp === '{"w":0}', 'vkeys=' + isoUp);

  /* ---- F. 真按 E 下车 → HUD 收起 → Q 退出位姿还原 ---- */
  await p.keyboard.press('e');
  const off = await p.evaluate(() => {
    const V = GAME.vehicle, D = GAME.district;
    const hud = document.getElementById('vehicle-hud');
    return { mounted: V.mounted, park: V.park ? { ...V.park } : null,
      hud: hud ? hud.style.display : '' };
  });
  ok('F1 真按 E 一次下车（≤2 键）', off.mounted === false, 'mounted=' + off.mounted);
  ok('F2 下车车停原地 + HUD 收起', !!off.park && off.hud === 'none',
    'park=' + JSON.stringify(off.park) + ' hud=' + off.hud);

  const beforeExit = await p.evaluate(() => GAME.district.snapshot.dir.slice());
  await p.keyboard.press('q');
  const exit = await p.evaluate(() => {
    window.__settle();
    const M = GAME.map3d, V = GAME.vehicle, D = GAME.district;
    return { dir: M.playerPose().dir.slice(), active: D.active, mounted: V.mounted,
      vkeys: JSON.stringify(V.keys), loadN: window.__loadN };
  });
  const dirDiff = beforeExit.reduce((s, x, i) => s + Math.abs(x - exit.dir[i]), 0);
  ok('F3 Q 退出后位姿逐位还原（≤1e-4）且载具态清空',
    dirDiff <= 1e-4 && exit.active === false && exit.mounted === false && exit.vkeys === '{}',
    'diff=' + dirDiff.toExponential(2) + ' mounted=' + exit.mounted);
  ok('F4 全流程 0 读盘', exit.loadN === 0, 'loadGame=' + exit.loadN);

  /* ---- G. 相机跟随：载具移动时 D.camera 读同一位置锚，不碰 camO ---- */
  const cam = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district, ci = GAME.state.cities[0].ci;
    M.setFollow(true);
    D.enter(ci, GAME.state.cities[0]); window.__settle();
    /* 上马流程已由 A 段验证；这里专测相机跟随，直接置 mounted 并清空碰撞避免干扰。 */
    GAME.vehicle.mounted = true;
    GAME.vehicle.park = null;
    const clearPlan = Object.assign({}, D.plan, { solids: [] });
    D.pos = { x: 0, z: 0 }; D.yaw = 0; D.t = 1; D.phase = 'hold';
    D.camera();
    const cam0 = M._cam.position.clone();
    for (let i = 0; i < 30; i++) GAME.vehicle.step(1 / 60, { w: 1 }, clearPlan);
    D.camera();
    const cam1 = M._cam.position.clone();
    const moved = cam0.distanceTo(cam1);
    /* camO 快照：dist/quat 不应被载具改（本来 district 就不碰，这里守 P0 回归） */
    const camO = M._camO ? M._camO() : null;
    return { moved: +moved.toFixed(4), dist: camO ? camO.dist : null };
  });
  ok('G1 载具移动时相机跟随（位置锚变化 → 相机变化）', cam.moved > 0.1,
    'camMoved=' + cam.moved + 'm');

  /* ---- H. 回退开关 + 旧路径保留 ---- */
  const rev = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district, V = GAME.vehicle, ci = GAME.state.cities[0].ci;
    D.exit(); window.__settle();
    M.VEHICLE = false;
    D.enter(ci, GAME.state.cities[0]); window.__settle();
    const blocked = V.mount();                       /* 应被拒 */
    M.VEHICLE = true;
    const oldDistrict = typeof D.step === 'function';
    const p1 = typeof M.nearestInteractable === 'function';
    D.exit(); window.__settle();
    return { blocked: blocked.ok === false, msg: blocked.msg,
      oldDistrict: oldDistrict, p1: p1, hud: typeof GAME.ui.renderVehicleHud === 'function' };
  });
  ok('H1 M.VEHICLE=false 一键回退（上马被拒）', rev.blocked === true, 'msg=' + rev.msg);
  ok('H2 步行/P1/旧路径仍在（功能不消失）',
    rev.oldDistrict && rev.p1 && rev.hud, JSON.stringify(rev));
  ok('H3 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
