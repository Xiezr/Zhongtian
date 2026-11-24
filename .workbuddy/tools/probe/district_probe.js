/* P2 城市街区 L1 探针（v158.2）
 * 判据：A 标架同源 / B 真点按钮进入·0 读盘 / C 相机 6m·15° / D 步行与碰撞 /
 *       E Q 退出·位姿逐位还原 / F 20 次进出无堆漂移 / G 总开关回退与旧路径保留
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/district_probe.js > .workbuddy/tmp/district_probe.log 2>&1
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
    GAME.newGame({ name: 'district', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);

  /* 计数 loadGame：整个进出过程必须是 0 次（无读盘感） */
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
    window.__heap = function () {
      if (window.gc) window.gc();
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    };
  });

  const city = await p.evaluate(() => {
    const c = (GAME.state.cities || [])[0];
    GAME.map3d.setFollow(true);
    return { id: c.id, ci: c.ci, name: c.name };
  });

  /* ---- A. 标架与布局同源 ---- */
  const a = await p.evaluate(() => {
    const D = GAME.district, M = GAME.map3d, ci = GAME.state.cities[0].ci;
    const fr = D.frameOf(ci), ref = M.avatarBasis(GAME.mapSphere.cells[ci].dir);
    const eq = (u, v) => u.reduce((s, x, i) => s + Math.abs(x - v[i]), 0);
    const plan = D.planOf(GAME.state.cities[0]);
    const sp = GAME.scene3d.cityPlan(GAME.state.cities[0]);
    return { up: eq(fr.up, ref.up), east: eq(fr.east, ref.east), south: eq(fr.south, ref.south),
      solids: plan.solids.length, spSolids: sp.solids.length, cells: plan.cells.length };
  });
  ok('A1 街区标架逐位复用 P0 avatarBasis(up/east/south)',
    a.up === 0 && a.east === 0 && a.south === 0, JSON.stringify(a));
  ok('A2 布局与碰撞盒复用 scene3d.cityPlan（同一本账）',
    a.solids === a.spSolids && a.cells > 0, 'solids=' + a.solids + ' sp=' + a.spSolids);

  /* ---- B. 真点面板按钮进入（不是直接调内部函数）+ 0 读盘 ---- */
  const enter = await p.evaluate(() => {
    const M = GAME.map3d, ci = GAME.state.cities[0].ci;
    M.openCellPanel(ci);
    const btn = document.querySelector('[data-action="district-enter"]');
    if (!btn) return { btn: false };
    const t0 = performance.now();
    btn.click();
    const D = GAME.district;
    const tClick = performance.now() - t0;
    window.__settle();
    const hud = document.getElementById('district-hud');
    return { btn: true, tClick: +tClick.toFixed(2), active: D.active, ci: D.ci, phase: D.phase,
      hud: hud ? hud.style.display : '', snap: D.snapshot ? D.snapshot.dir.slice() : null,
      loadN: window.__loadN, modal: GAME.ui.modalVisible ? GAME.ui.modalVisible() : false };
  });
  ok('B1 城面板真有"走进街区"按钮且点击生效',
    enter.btn === true && enter.active === true && enter.ci === city.ci,
    'btn=' + enter.btn + ' active=' + enter.active + ' ci=' + enter.ci);
  ok('B2 进入过程 0 次 loadGame（无读盘）', enter.loadN === 0, 'loadGame=' + enter.loadN);
  ok('B3 面板关闭 + 街区 HUD 出现', enter.modal === false && enter.hud === 'block',
    'modal=' + enter.modal + ' hud=' + enter.hud);
  ok('B4 进入前位姿已快照（非空且 3 维）',
    !!enter.snap && enter.snap.length === 3, JSON.stringify(enter.snap));
  ok('B5 点击→状态切换 ≤100ms', enter.tClick >= 0 && enter.tClick <= 100, 'click=' + enter.tClick + 'ms');

  /* ---- C. 相机 rig：6.218m / 15°（跟 P0 同一口径） ---- */
  const cam = await p.evaluate(() => {
    const D = GAME.district, M = GAME.map3d, cam = M._cam;
    D.t = 1; D.phase = 'hold'; D.camera();
    const eye = D.world(D.frame, D.pos.x, 1.7, D.pos.z);
    const dx = cam.position.x - eye[0], dy = cam.position.y - eye[1], dz = cam.position.z - eye[2];
    const u = D.frame.up;
    const vert = dx * u[0] + dy * u[1] + dz * u[2];
    const hv = [dx - u[0] * vert, dy - u[1] * vert, dz - u[2] * vert];
    const horiz = Math.hypot(hv[0], hv[1], hv[2]);
    return { dist: +Math.hypot(dx, dy, dz).toFixed(3),
      pitch: +(Math.atan2(vert, horiz) * 180 / Math.PI).toFixed(3) };
  });
  ok('C1 街区相机距离 6.218 ± 0.3（6m 身后 + 1.7m 眼高）',
    Math.abs(cam.dist - 6.218) <= 0.3, 'dist=' + cam.dist);
  ok('C2 街区相机俯角 15° ± 2°', Math.abs(cam.pitch - 15) <= 2, 'pitch=' + cam.pitch);

  /* ---- D. 局部步行与建筑碰撞 ---- */
  const walk = await p.evaluate(() => {
    const D = GAME.district;
    D.pos = { x: 0, z: D.plan.spawn.z }; D.yaw = 0;
    const x0 = D.pos.x, z0 = D.pos.z;
    for (let i = 0; i < 60; i++) D.step(1 / 60, { w: 1 });
    const moved = Math.hypot(D.pos.x - x0, D.pos.z - z0);
    /* 朝第一座实心建筑正面撞：分轴推进应挡住，不允许穿透 */
    const s = D.plan.solids.find((q) => q.x1 - q.x0 >= 0.8) || D.plan.solids[0];
    D.pos = { x: s.x0 - 0.31, z: (s.z0 + s.z1) / 2 }; D.yaw = Math.PI / 2;
    const before = D.pos.x;
    for (let i = 0; i < 30; i++) D.step(1 / 60, { w: 1 });
    return { moved: +moved.toFixed(3), blocked: D.pos.x <= s.x0 - 0.29,
      before: +before.toFixed(3), after: +D.pos.x.toFixed(3) };
  });
  ok('D1 1 秒 W 真的走出 ≥1 米（非 0 平凡解）', walk.moved >= 1, 'moved=' + walk.moved + 'm');
  ok('D2 撞建筑被挡住（穿透 0）', walk.blocked,
    'x ' + walk.before + ' → ' + walk.after);

  /* ---- E. Q 真按键退出 → 位姿逐位还原 ---- */
  const beforeExit = await p.evaluate(() => GAME.district.snapshot.dir.slice());
  await p.keyboard.press('q');
  const exit = await p.evaluate(() => {
    window.__settle();
    const D = GAME.district, M = GAME.map3d;
    const now = M.playerPose().dir;
    const hud = document.getElementById('district-hud');
    return { active: D.active, phase: D.phase, dir: now.slice(), loadN: window.__loadN,
      hud: hud ? hud.style.display : '', keys: JSON.stringify(GAME._keys), dkeys: JSON.stringify(D.keys) };
  });
  const dirDiff = beforeExit.reduce((s, x, i) => s + Math.abs(x - exit.dir[i]), 0);
  ok('E1 Q 真按键退出街区', exit.active === false, 'active=' + exit.active);
  ok('E2 退出后 _avatar.dir 与进入前误差 ≤1e-4', dirDiff <= 1e-4, 'diff=' + dirDiff.toExponential(2));
  ok('E3 HUD 收起 + 两级按键都清空', exit.hud === 'none' && exit.keys === '{}' && exit.dkeys === '{}',
    'hud=' + exit.hud + ' keys=' + exit.keys + ' dkeys=' + exit.dkeys);
  ok('E4 退出仍 0 次 loadGame', exit.loadN === 0, 'loadGame=' + exit.loadN);

  /* ---- F. 20 次进出 heap 漂移 ≤2MB ---- */
  const heap = await p.evaluate(() => {
    const D = GAME.district, M = GAME.map3d, ci = GAME.state.cities[0].ci;
    M.setFollow(true);
    const h0 = window.__heap();
    for (let i = 0; i < 20; i++) {
      D.enter(ci, GAME.state.cities[0]);
      window.__settle();
      D.exit();
      window.__settle();
    }
    const h1 = window.__heap();
    return { mb: +((h1 - h0) / 1048576).toFixed(3), active: D.active, loadN: window.__loadN };
  });
  ok('F1 同一城进出 20 次 heap 漂移 ≤2MB', heap.mb <= 2, 'drift=' + heap.mb + 'MB');
  ok('F2 20 次后状态机干净（active=false）', heap.active === false, 'active=' + heap.active);
  ok('F3 20 次进出仍 0 读盘', heap.loadN === 0, 'loadGame=' + heap.loadN);

  /* ---- G. 回退开关 + 旧路径反向证据 ---- */
  const rev = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district, ci = GAME.state.cities[0].ci;
    const before = D.active;
    M.DISTRICT = false;
    const off = D.enter(ci, GAME.state.cities[0]);
    M.DISTRICT = true;
    const old3d = typeof GAME.scene3d.openCity === 'function';
    const p1 = typeof M.nearestInteractable === 'function';
    return { before: before, offOk: off.ok, offMsg: off.msg, old3d: old3d, p1: p1,
      hud: typeof GAME.ui.renderDistrictHud === 'function' };
  });
  ok('G1 M.DISTRICT=false 一键回退（街区不建）', rev.before === false && rev.offOk === false,
    'off=' + rev.offMsg);
  ok('G2 旧 city-enter-3d 与 P1 交互仍在（功能不消失）',
    rev.old3d === true && rev.p1 === true && rev.hud === true, JSON.stringify(rev));
  ok('G3 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
