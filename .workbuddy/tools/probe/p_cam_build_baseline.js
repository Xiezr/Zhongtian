'use strict';
/* v158.39 基线探针：戴森球式建造 / 取消边缘转换角度 / 向上看相机不沉地下。
   目标：先量当前真实行为，不预先假设已实现。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_cam_build_baseline.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pcambuild';
const fs = require('fs');

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (ok) pass++; else fail++;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
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

  /* 真滚轮推进地表 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(45); }
  await p.waitForTimeout(1200);

  const snapCam = () => p.evaluate(() => {
    const M = GAME.map3d;
    const cam = M._camObj ? M._camObj() : M._cam;
    const pp = M.playerPose();
    cam.updateMatrixWorld();
    const cr = Math.hypot(cam.position.x, cam.position.y, cam.position.z);
    const cu = [cam.position.x / cr, cam.position.y / cr, cam.position.z / cr];
    const dr = Math.hypot(pp.dir[0], pp.dir[1], pp.dir[2]);
    const du = [pp.dir[0] / dr, pp.dir[1] / dr, pp.dir[2] / dr];
    const groundAtCam = M._groundAtUnit(cu);
    const groundAtPlayer = M._groundAtUnit(du);
    const pr = M.R + (pp.h || 0);
    return {
      surf: !!M._surf,
      avatar: M.SURF_AVATAR !== false,
      orbitYaw: +(M._surfOrbitYaw || 0).toFixed(4),
      el: +M.SURF_CAM_EL.toFixed(4),
      distConst: M.SURF_CAM_DIST,
      camR: +cr.toFixed(3),
      camGround: +groundAtCam.toFixed(3),
      camGap: +(cr - M.R - groundAtCam).toFixed(3),
      playerR: +pr.toFixed(3),
      playerGround: +groundAtPlayer.toFixed(3),
      playerEyeGap: +(pr - M.R - groundAtPlayer).toFixed(3),
      camToPlayer: +Math.hypot(cam.position.x - du[0] * pr, cam.position.y - du[1] * pr, cam.position.z - du[2] * pr).toFixed(3)
    };
  });

  const s0 = await snapCam();
  console.log('地表基线: ' + JSON.stringify(s0));
  check('BASE ① 已进地表且星露谷相机接管', s0.surf && s0.avatar,
    'surf=' + s0.surf + ' avatar=' + s0.avatar);
  check('BASE ② 相机离地为正（当前下限 0.42 rad 理论不钻地）', s0.camGap > 0,
    'camGap=' + s0.camGap + 'm camToPlayer=' + s0.camToPlayer + 'm');

  /* A. 地表边缘推镜是否还在改角度 */
  await p.mouse.move(1434, 450);
  await p.waitForTimeout(120);
  const edge = await p.evaluate(() => {
    const M = GAME.map3d;
    const a = { yaw: M._surfOrbitYaw, el: M.SURF_CAM_EL };
    let n = 0;
    for (let i = 0; i < 42; i++) { if (M.edgePanTick(1 / 60)) n++; }
    return { n, a, yaw: M._surfOrbitYaw, el: M.SURF_CAM_EL };
  });
  const dYaw = Math.abs(edge.yaw - edge.a.yaw);
  const dEl = Math.abs(edge.el - edge.a.el);
  console.log('边缘推镜: ' + JSON.stringify(edge));
  check('BASE ③ 地表边缘推镜当前仍会改角度（待取消）', edge.n >= 30 && (dYaw > 0.2 || dEl > 0.01),
    'dYaw=' + dYaw.toFixed(4) + ' dEl=' + dEl.toFixed(4));
  await p.mouse.move(720, 450);
  await p.waitForTimeout(250);

  /* B. 真右键上拖：俯角/相机距离/离地高度 */
  const beforeLook = await snapCam();
  await p.mouse.move(720, 560);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720, 560 - i * 18); await p.waitForTimeout(22); }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(500);
  const afterLook = await snapCam();
  console.log('右键上拖前: ' + JSON.stringify(beforeLook));
  console.log('右键上拖后: ' + JSON.stringify(afterLook));
  check('BASE ④ 右键上拖会改变相机仰角', Math.abs(afterLook.el - beforeLook.el) > 0.01,
    'el ' + beforeLook.el + ' → ' + afterLook.el);
  check('BASE ⑤ 右键上拖后相机没有沉到地面下', afterLook.camGap > 0,
    'camGap=' + afterLook.camGap + 'm');

  /* C. 直接扫仰角：当前距离是否固定、机位是否始终在地平线之上 */
  const sweep = await p.evaluate(() => {
    const M = GAME.map3d;
    const cam = M._camObj ? M._camObj() : M._cam;
    const keep = M.SURF_CAM_EL;
    const out = [];
    [0.42, 0.60, 1.00, 1.35].forEach((el) => {
      M.SURF_CAM_EL = el;
      M._surfCamAnchor = null;
      M._surfAvatarCam();
      cam.updateMatrixWorld();
      const cr = Math.hypot(cam.position.x, cam.position.y, cam.position.z);
      const cu = [cam.position.x / cr, cam.position.y / cr, cam.position.z / cr];
      out.push({ el, dist: M.SURF_CAM_DIST,
        camGap: +(cr - M.R - M._groundAtUnit(cu)).toFixed(3) });
    });
    M.SURF_CAM_EL = keep;
    M._surfCamAnchor = null;
    M._surfAvatarCam();
    return out;
  });
  console.log('仰角扫描: ' + JSON.stringify(sweep));
  check('BASE ⑥ 当前相机距离是固定常量（不随仰角缩短）',
    sweep.every((x) => x.dist === sweep[0].dist), 'dist=' + sweep.map((x) => x.dist).join(','));
  check('BASE ⑦ 当前最低仰角相机仍在地面之上',
    sweep.every((x) => x.camGap > 0), 'gaps=' + sweep.map((x) => x.camGap).join(','));

  /* D. 建造：先切建造模式（建造栏默认隐藏），再选物品 → 悬停幽灵 → 点击落位 → 右键取消 → 左键拖连铺 */
  await p.click('[data-action="mode-toggle"]');
  await p.waitForTimeout(400);
  const modeNow = await p.evaluate(() => ({
    mode: GAME.map3d.mode,
    build: GAME.map3d.MODE_BUILD,
    barHidden: (document.getElementById('build-bar') || {}).classList
      ? document.getElementById('build-bar').classList.contains('hidden') : null
  }));
  console.log('建造模式: ' + JSON.stringify(modeNow));
  check('BASE ⑧ 建造模式已打开且建造栏可见', modeNow.mode === modeNow.build && modeNow.barHidden === false,
    JSON.stringify(modeNow));
  await p.evaluate(() => GAME.ui.renderBuildBar('item'));
  await p.click('[data-action="bb-tab"][data-bbtab="item"]');
  await p.waitForTimeout(200);
  const pickBtn = await p.$('[data-action="place-pick"][data-item="tree"]');
  check('BASE ⑨ 建造栏能找到 tree 槽位', !!pickBtn, pickBtn ? 'tree' : 'missing');
  if (pickBtn) {
    await pickBtn.click();
    await p.waitForTimeout(220);
    await p.mouse.move(700, 470);
    await p.waitForTimeout(220);
    const held = await p.evaluate(() => ({
      item: GAME.ui._placeItem || null,
      ghostIJ: GAME.map3d._ghostIJ ? GAME.map3d._ghostIJ.slice() : null,
      count: GAME.place.count(),
      mode: GAME.map3d.mode,
      build: GAME.map3d.MODE_BUILD
    }));
    console.log('建造手持: ' + JSON.stringify(held));
    check('BASE ⑩ 建造模式下能拿物品',
      !!held.item, 'item=' + held.item);
    await p.mouse.down({ button: 'left' });
    await p.mouse.up({ button: 'left' });
    await p.waitForTimeout(260);
    const afterClick = await p.evaluate(() => ({ count: GAME.place.count(), item: GAME.ui._placeItem || null }));
    console.log('点击落位: ' + JSON.stringify(afterClick));
    check('BASE ⑪ 手持物品在地图左键点击能落位', afterClick.count > held.count,
      'count ' + held.count + ' → ' + afterClick.count);

    await p.mouse.down({ button: 'right' });
    await p.mouse.up({ button: 'right' });
    await p.waitForTimeout(220);
    const afterRight = await p.evaluate(() => ({ item: GAME.ui._placeItem || null }));
    console.log('右键后: ' + JSON.stringify(afterRight));
    check('BASE ⑫ 当前右键单击不会取消手持物（待补戴森式取消）', !!afterRight.item,
      'item=' + afterRight.item);

    const beforeDrag = await p.evaluate(() => GAME.place.count());
    await p.mouse.down({ button: 'left' });
    for (let i = 1; i <= 6; i++) { await p.mouse.move(700 + i * 12, 470 + i * 5); await p.waitForTimeout(22); }
    await p.mouse.up({ button: 'left' });
    await p.waitForTimeout(300);
    const afterDrag = await p.evaluate(() => GAME.place.count());
    console.log('左键拖铺: count ' + beforeDrag + ' → ' + afterDrag);
    check('BASE ⑬ 当前左键拖不会连续铺（待补戴森式按住连铺）', afterDrag === beforeDrag,
      'count ' + beforeDrag + ' → ' + afterDrag);
    await p.screenshot({ path: OUT + '/baseline.png' });
  }

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + (e && e.stack || e)); process.exit(1); });
