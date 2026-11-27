'use strict';
/* v158.39 验收探针：戴森球式建造 / 取消边缘转换角度 / 抬头不钻地。
   真实开局 → 固定 mapSeed → 真滚轮进地表 → 真右键上拖 → 真按键/真点击。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_cam_build_v15839.js */
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
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));

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
    const pr = M.R + (pp.h || 0);
    return {
      surf: !!M._surf,
      avatar: M.SURF_AVATAR !== false,
      orbitYaw: +(M._surfOrbitYaw || 0).toFixed(4),
      el: +M.SURF_CAM_EL.toFixed(4),
      camR: +cr.toFixed(3),
      camGap: +(cr - M.R - M._groundAtUnit(cu)).toFixed(3),
      camGapPlayer: +(cr - M.R - M._groundAtUnit(du)).toFixed(3),
      playerEyeGap: +(pr - M.R - M._groundAtUnit(du)).toFixed(3),
      camToPlayer: +Math.hypot(cam.position.x - du[0] * pr, cam.position.y - du[1] * pr, cam.position.z - du[2] * pr).toFixed(3)
    };
  });

  const s0 = await snapCam();
  console.log('地表基线: ' + JSON.stringify(s0));
  check('① 已进地表且星露谷相机接管', s0.surf && s0.avatar,
    'surf=' + s0.surf + ' avatar=' + s0.avatar);

  /* A. 地表边缘推镜不再改角度 */
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
  check('② 地表贴边 42 tick 不改任何镜头角度（取消边缘转换角度）',
    edge.n === 0 && dYaw < 1e-9 && dEl < 1e-9,
    'n=' + edge.n + ' dYaw=' + dYaw.toFixed(6) + ' dEl=' + dEl.toFixed(6));
  await p.mouse.move(720, 450);
  await p.waitForTimeout(250);

  /* B. 真右键上拖到低仰角：机位必须在眼睛与地面之间 */
  const beforeLook = await snapCam();
  await p.mouse.move(720, 800);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 30; i++) { await p.mouse.move(720, 800 - i * 18); await p.waitForTimeout(18); }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(500);
  const afterLook = await snapCam();
  console.log('右键上拖前: ' + JSON.stringify(beforeLook));
  console.log('右键上拖后: ' + JSON.stringify(afterLook));
  check('③ 右键上拖压到最低仰角 0.06rad', afterLook.el <= 0.08,
    'el ' + beforeLook.el + ' → ' + afterLook.el);
  check('④ 抬头后相机距离明显缩短（< 5m）', afterLook.camToPlayer < 5,
    'camToPlayer ' + beforeLook.camToPlayer + ' → ' + afterLook.camToPlayer);
  check('⑤ 抬头后相机不沉地下、仍在贴地近景（坡地时按较高地面径向抬升）',
    afterLook.camGap > 0 && afterLook.camGapPlayer > 0 && afterLook.camGapPlayer < 2.4,
    'camGap(玩家脚下)=' + afterLook.camGapPlayer + 'm · camGap(镜头下方)=' + afterLook.camGap
    + 'm · eye=' + afterLook.playerEyeGap + 'm');

  /* C. 扫描仰角：距离单调、离地恒正 */
  const sweep = await p.evaluate(() => {
    const M = GAME.map3d;
    const cam = M._camObj ? M._camObj() : M._cam;
    const keep = M.SURF_CAM_EL;
    const out = [];
    [0.06, 0.30, 0.60, 1.00, 1.35].forEach((el) => {
      M.SURF_CAM_EL = el;
      M._surfCamAnchor = null;
      M._surfAvatarCam();
      cam.updateMatrixWorld();
      const cr = Math.hypot(cam.position.x, cam.position.y, cam.position.z);
      const cu = [cam.position.x / cr, cam.position.y / cr, cam.position.z / cr];
      const pp = M.playerPose();
      const dr = Math.hypot(pp.dir[0], pp.dir[1], pp.dir[2]);
      const du = [pp.dir[0] / dr, pp.dir[1] / dr, pp.dir[2] / dr];
      const pr = M.R + (pp.h || 0);
      out.push({
        el,
        dist: +Math.hypot(cam.position.x - du[0] * pr, cam.position.y - du[1] * pr, cam.position.z - du[2] * pr).toFixed(3),
        gap: +(cr - M.R - M._groundAtUnit(cu)).toFixed(3),
        gapPlayer: +(cr - M.R - M._groundAtUnit(du)).toFixed(3)
      });
    });
    M.SURF_CAM_EL = keep;
    M._surfCamAnchor = null;
    M._surfAvatarCam();
    return out;
  });
  console.log('仰角扫描: ' + JSON.stringify(sweep));
  let mono = true;
  for (let i = 1; i < sweep.length; i++) if (sweep[i].dist <= sweep[i - 1].dist) mono = false;
  check('⑥ 仰角扫描：距离单调增大且每档都不沉地下（玩家脚下 + 镜头下方都 > 0）',
    mono && sweep.every((x) => x.gapPlayer > 0 && x.gap > 0),
    JSON.stringify(sweep.map((x) => x.dist + '/' + x.gapPlayer + '/' + x.gap)));

  /* D. 戴森式建造：点击落位 → 右键放下 → 按住左键连铺 */
  await p.click('[data-action="mode-toggle"]');
  await p.waitForTimeout(300);
  await p.click('[data-action="bb-tab"][data-bbtab="item"]');
  await p.waitForTimeout(180);
  const pickBtn = await p.$('[data-action="place-pick"][data-item="tree"]');
  check('⑦ 建造栏能选 tree', !!pickBtn, pickBtn ? 'tree' : 'missing');
  if (pickBtn) {
    await pickBtn.click();
    await p.waitForTimeout(180);
    /* 低机位下屏幕中心不一定落在可放格；先真射线找一个合法屏幕点，避免探针假红。 */
    const placePt = await p.evaluate(() => {
      const M = GAME.map3d, cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
      const item = GAME.ui._placeItem;
      for (let gy = 0.25; gy < 0.8; gy += 0.03) {
        for (let gx = 0.25; gx < 0.8; gx += 0.03) {
          const rc = new THREE.Raycaster();
          rc.setFromCamera(new THREE.Vector2(gx * 2 - 1, -(gy * 2 - 1)), M._cam);
          const gp = M.pickGroundPoint(rc);
          const g = gp ? M.gridAt(gp) : null;
          if (g && GAME.place.canPlace(g.i, g.j, item).ok) {
            return { x: Math.round(r.left + r.width * gx), y: Math.round(r.top + r.height * gy) };
          }
        }
      }
      return null;
    });
    check('⑦b 找到可放置的屏幕格', !!placePt, JSON.stringify(placePt));
    await p.mouse.move(placePt ? placePt.x : 700, placePt ? placePt.y : 470);
    await p.waitForTimeout(180);
    const held = await p.evaluate(() => ({ item: GAME.ui._placeItem || null, count: GAME.place.count() }));
    await p.mouse.down({ button: 'left' });
    await p.mouse.up({ button: 'left' });
    await p.waitForTimeout(220);
    const afterClick = await p.evaluate(() => GAME.place.count());
    check('⑧ 手持物品点击落位', afterClick > held.count, 'count ' + held.count + ' → ' + afterClick);

    await p.mouse.down({ button: 'right' });
    await p.mouse.up({ button: 'right' });
    await p.waitForTimeout(220);
    const afterCancel = await p.evaluate(() => {
      const m = document.querySelector('.modal-mask');
      return {
        item: GAME.ui._placeItem || null,
        plant: !!GAME.ui._plantTool,
        modal: m ? (m.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : ''
      };
    });
    console.log('右键取消后: ' + JSON.stringify(afterCancel));
    check('⑨ 右键单击放下手上的建造物', !afterCancel.item && !afterCancel.plant, JSON.stringify(afterCancel));
    if (afterCancel.modal) {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(220);
    }

    await p.click('[data-action="place-pick"][data-item="tree"]');
    await p.waitForTimeout(180);
    const beforeDrag = await p.evaluate(() => GAME.place.count());
    await p.mouse.move(600, 440);
    await p.mouse.down({ button: 'left' });
    for (let i = 1; i <= 20; i++) { await p.mouse.move(600 + i * 18, 440 + i * 8); await p.waitForTimeout(24); }
    await p.mouse.up({ button: 'left' });
    await p.waitForTimeout(300);
    const afterDrag = await p.evaluate(() => GAME.place.count());
    check('⑩ 按住左键拖过多个格连续铺（不是只放一件）', afterDrag - beforeDrag >= 2,
      'count ' + beforeDrag + ' → ' + afterDrag);
  } else {
    check('⑧ 手持物品点击落位', false, 'no tree slot');
    check('⑨ 右键单击放下手上的建造物', false, 'no tree slot');
    check('⑩ 按住左键拖过多个格连续铺', false, 'no tree slot');
  }

  /* E. 采集场快建：建造栏 → 点资源地 → 真扣费进施工队列 */
  /* 抬头镜头贴地后视野只有几米，先按滚轮拉远一点找资源靶位；建造模式不退。 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 18; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(30); }
  await p.waitForTimeout(700);
  /* 开局视野内未必有资源地：从全星资源格中选离玩家最近的一块，镜头对准它再真点。 */
  const target0 = await p.evaluate(() => {
    const M = GAME.map3d, RS = GAME.resource, SP = GAME.sphere;
    const pid = GAME.pidOf(GAME.currentCity());
    if (!RS || !RS.RES_OF_TYPE || !SP || !SP.cells) return null;
    const pp = M.playerPose();
    let best = null, bestDot = -2;
    for (let ci = 0; ci < SP.cells.length; ci++) {
      const c = SP.cells[ci], res = RS.RES_OF_TYPE[c.type];
      if (!res || !c.dir || (RS.at(ci, pid) && RS.at(ci, pid).plant)) continue;
      const dot = c.dir[0] * pp.dir[0] + c.dir[1] * pp.dir[1] + c.dir[2] * pp.dir[2];
      if (dot > bestDot) { bestDot = dot; best = { ci, res, x: c.x, y: c.y, lon: c.lon, lat: c.lat }; }
    }
    if (!best) return null;
    RS.scan(best.ci, pid);
    M.centerOn(best.x, best.y);
    return best;
  });
  await p.waitForTimeout(900);
  const target = await p.evaluate((t) => {
    if (!t) return null;
    const M = GAME.map3d, cell = GAME.sphere.cells[t.ci], cam = M._camObj ? M._camObj() : M._cam;
    cam.updateMatrixWorld();
    const cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
    const d = cell.dir;
    const v = new THREE.Vector3(d[0] * M.R, d[1] * M.R, d[2] * M.R).project(cam);
    return {
      ci: t.ci, res: t.res,
      x: Math.round(r.left + (v.x + 1) * 0.5 * r.width),
      y: Math.round(r.top + (1 - v.y) * 0.5 * r.height),
      ndc: [+v.x.toFixed(3), +v.y.toFixed(3)]
    };
  }, target0);
  console.log('采集场靶位: ' + JSON.stringify(target));
  check('⑪ 找到视野内可建的资源地', !!target, target ? ('ci=' + target.ci + ' res=' + target.res) : 'none');
  if (target) {
    await p.click('[data-action="bb-tab"][data-bbtab="plant"]');
    await p.waitForTimeout(160);
    const plantBtn = await p.$('[data-action="plant-pick"]');
    check('⑫ 建筑页签有采集场快建入口', !!plantBtn, plantBtn ? 'plant-pick' : 'missing');
    if (plantBtn) {
      await plantBtn.click();
      await p.waitForTimeout(180);
      const q0 = await p.evaluate(() => ((GAME.state.queues && GAME.state.queues.build) || []).length);
      await p.mouse.click(target.x, target.y);
      await p.waitForTimeout(500);
      const q1 = await p.evaluate(() => ((GAME.state.queues && GAME.state.queues.build) || []).length);
      const toast = await p.evaluate(() => {
        const t = document.getElementById('toast') || document.querySelector('.toast');
        return t ? (t.textContent || '').trim() : '';
      });
      check('⑬ 点资源地就进真实施工队列（不是面板假动作）', q1 > q0,
        'queue ' + q0 + ' → ' + q1 + ' toast=' + toast.slice(0, 80));
      const plantOn = await p.evaluate(() => !!GAME.ui._plantTool);
      check('⑭ 采集场快建仍保持手持，可连续建', plantOn, 'plantTool=' + plantOn);
      await p.mouse.down({ button: 'right' });
      await p.mouse.up({ button: 'right' });
      await p.waitForTimeout(180);
      const plantOff = await p.evaluate(() => !!GAME.ui._plantTool);
      check('⑮ 右键也能放下采集场工具', !plantOff, 'plantTool=' + plantOff);
    } else {
      check('⑬ 点资源地就进真实施工队列', false, 'no plant button');
      check('⑭ 采集场快建仍保持手持', false, 'no plant button');
      check('⑮ 右键也能放下采集场工具', false, 'no plant button');
    }
  } else {
    check('⑫ 建筑页签有采集场快建入口', false, 'no target');
    check('⑬ 点资源地就进真实施工队列', false, 'no target');
    check('⑭ 采集场快建仍保持手持', false, 'no target');
    check('⑮ 右键也能放下采集场工具', false, 'no target');
  }

  await p.screenshot({ path: OUT + '/v15839_after.png' });
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 4).join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + (e && e.stack || e)); process.exit(1); });
