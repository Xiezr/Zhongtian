'use strict';
/* v158.49 验收探针：拉近落地 = 相机指向处（不跳回人物所在地）。
   真实开局 → 高空把相机指向远处 → 拉近进地表 → 断言锚点/机位在指向处、
   与玩家距离 > 50m（旧行为会跳回人物）。再按 W 走一步 → 锚点向玩家靠拢。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_land_spot_v15849.js */
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

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    const pp = M.playerPose();
    const R2 = M.R + ((pp && pp.h != null && isFinite(pp.h)) ? pp.h : 0);
    const P = pp ? [pp.dir[0] * R2, pp.dir[1] * R2, pp.dir[2] * R2] : null;
    const A = M._surfCamAnchor;
    let anchorDist = null;
    if (A && P) {
      anchorDist = Math.hypot(A.x - P[0], A.y - P[1], A.z - P[2]);
    }
    const cam = M._camObj ? M._camObj() : M._cam;
    let camDistP = null;
    if (cam && P) {
      camDistP = Math.hypot(cam.position.x - P[0], cam.position.y - P[1], cam.position.z - P[2]);
    }
    return {
      surf: !!M._surf,
      rAlt: +(M._rAlt || 0).toFixed(1),
      anchorDist: anchorDist == null ? null : +anchorDist.toFixed(1),
      camDistP: camDistP == null ? null : +camDistP.toFixed(1),
      anchor: A ? [+A.x.toFixed(1), +A.y.toFixed(1), +A.z.toFixed(1)] : null
    };
  });

  /* ① 高空把相机指向远处（绕 yaw 转 ~90°，落在离玩家远的地方） */
  await p.evaluate(() => {
    const M = GAME.map3d;
    const pp = M.playerPose();
    /* 取玩家切平面的垂直方向 = 东向转 90°（大致远离玩家出生区） */
    const up = pp.dir;
    let e = [0, 1, 0].map((v, i) => v - up[i] * (up[0] * 0 + up[1] * 1 + up[2] * 0));
    const L = Math.hypot(e[0], e[1], e[2]) || 1;
    e = [e[0] / L, e[1] / L, e[2] / L];
    const n = [up[1] * e[2] - up[2] * e[1], up[2] * e[0] - up[0] * e[2], up[0] * e[1] - up[1] * e[0]];
    const d = [up[0] * 0.35 + n[0] * 0.93, up[1] * 0.35 + n[1] * 0.93, up[2] * 0.35 + n[2] * 0.93];
    const L2 = Math.hypot(d[0], d[1], d[2]);
    M.lookAtDir([d[0] / L2, d[1] / L2, d[2] / L2]);
  });
  await p.waitForTimeout(400);

  /* ② 拉近进地表（落点应为指向处） */
  await p.evaluate(() => {
    const M = GAME.map3d;
    M._zoomTo(M.R + 40, false);
    M.camFree = true;
  });
  await p.waitForTimeout(2500);
  const s1 = await snap();
  console.log('落地: ' + JSON.stringify(s1));
  check('① 已进地表', s1.surf, 'surf=' + s1.surf);
  check('② 落地锚点 = 指向处（与玩家距离 > 50m，不回跳人物所在地）',
    s1.anchorDist != null && s1.anchorDist > 50,
    'anchorDist=' + s1.anchorDist);
  check('③ 机位同样远离玩家（画面在落点，不在人物身上）',
    s1.camDistP != null && s1.camDistP > 40,
    'camDistP=' + s1.camDistP);

  /* ③ 玩家按 W 走 → 锚点向玩家靠拢（移动才跟） */
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(1000);
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(500);
  const s2 = await snap();
  console.log('按 W 1s 后: ' + JSON.stringify(s2));
  check('④ 玩家移动后锚点向玩家靠拢（走动才跟随）',
    s2.anchorDist != null && s2.anchorDist < s1.anchorDist - 5,
    'anchorDist ' + s1.anchorDist + ' → ' + s2.anchorDist);

  check('⑤ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
