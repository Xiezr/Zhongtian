'use strict';
/* v158.47 验收探针：地表滚轮连续调相机高度 + 与右键仰角协同。
   真实开局 → 滚轮降地表 → 真滚轮连续性 → 右键抬头收缩 → 协同断言 → 升空衔接。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_surf_cam_v15847.js */
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
    const cam = M._camObj ? M._camObj() : M._cam;
    const pp = M.playerPose();
    const pr = M.R + ((pp && pp.h != null && isFinite(pp.h)) ? pp.h : 0);
    const d = pp ? Math.hypot(
      cam.position.x - pp.dir[0] * pr,
      cam.position.y - pp.dir[1] * pr,
      cam.position.z - pp.dir[2] * pr) : 0;
    return {
      surf: !!M._surf,
      el: +M.SURF_CAM_EL.toFixed(3),
      live: M._surfCamDist == null ? null : +M._surfCamDist.toFixed(2),
      camDist: +d.toFixed(2),
      agl: +(cam.position.length() - M.R).toFixed(2)
    };
  });

  /* ① 滚轮降到地表（降的过程中 live 已被地表滚轮连续压到 3.2 底 —— 合理） */
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(45); }
  await p.waitForTimeout(1000);
  const s0 = await snap();
  console.log('进地表: ' + JSON.stringify(s0));
  check('① 滚轮降进地表；降途中 live 被连续压到 3.2m 底（滚轮全程有效）',
    s0.surf && s0.live === 3.2, 'surf=' + s0.surf + ' live=' + s0.live);

  /* ② 真滚轮拉近：预置 16m → 内滚 12 格 → live 与机位距离同步连续下降 */
  await p.evaluate(() => { GAME.map3d._surfCamDist = 16; });
  await p.waitForTimeout(200);
  const sPre = await snap();
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, -80); await p.waitForTimeout(40); }
  await p.waitForTimeout(300);
  const s1 = await snap();
  console.log('内滚 12 格: ' + JSON.stringify(s1));
  check('② 内滚 12 格：live 16→<10、机位距离同步拉近（滚轮不再无效）',
    sPre.live === 16 && s1.live < 10 && s1.camDist < sPre.camDist - 3,
    'live ' + sPre.live + '→' + s1.live + ' camDist ' + sPre.camDist + '→' + s1.camDist);

  /* ③ 连续性：逐格采样相邻差 ≤ 13%、单调 */
  const series = [];
  for (let i = 0; i < 8; i++) {
    await p.mouse.wheel(0, -60);
    series.push((await snap()).live);
  }
  await p.waitForTimeout(150);
  let mono = true, cont = true;
  for (let i = 1; i < series.length; i++) {
    if (series[i] >= series[i - 1]) mono = false;
    const r = series[i - 1] / Math.max(0.01, series[i]);
    if (r > 1.13 || r < 1.0) cont = false;
  }
  console.log('连续采样: ' + JSON.stringify(series));
  check('③ 滚轮高度调节连续单调（相邻差 ≤ 13%，无跳变）',
    mono && cont, 'series=' + JSON.stringify(series));

  /* ④ 右键抬头：任意 live 下距离收缩到 3.2m（硬闸在坡上可抬 ~1m） */
  await p.evaluate(() => { GAME.map3d.SURF_CAM_EL = 1.0; });
  await p.waitForTimeout(200);
  await p.mouse.move(720, 800);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 30; i++) { await p.mouse.move(720, 800 - i * 18); await p.waitForTimeout(16); }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(500);
  const sLook = await snap();
  console.log('右键抬头: ' + JSON.stringify(sLook));
  check('④ 右键抬头（el→0.06）机位收缩到人物腰部（距离 ≤ 4.3m 含硬闸）',
    sLook.el <= 0.1 && sLook.camDist <= 4.3 && sLook.camDist >= 3.0,
    'el=' + sLook.el + ' camDist=' + sLook.camDist);

  /* ⑤ 协同：预置 live=16 + 高仰角 → 距离 ≈ 16m；抬头则压到 3.2m（互不覆盖） */
  await p.evaluate(() => { GAME.map3d._surfCamDist = 16; GAME.map3d.SURF_CAM_EL = 1.2; });
  await p.waitForTimeout(400);
  const sFar = await snap();
  console.log('live16+高仰角: ' + JSON.stringify(sFar));
  check('⑤ 滚轮 16m + 高仰角 → 距离 ≈ 16m（滚轮定上限、右键定比例）',
    sFar.camDist > 13.5 && sFar.camDist < 17.5,
    'camDist=' + sFar.camDist + ' el=' + sFar.el);

  /* ⑥ 到顶继续向外滚 → 升空出地表（衔接轨道态） */
  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); }
  await p.waitForTimeout(800);
  const sUp = await snap();
  console.log('继续外滚: ' + JSON.stringify(sUp));
  check('⑥ 到最远仍向外滚 → 升空出地表（衔接轨道态）',
    !sUp.surf, 'surf=' + sUp.surf + ' agl=' + sUp.agl);

  check('⑦ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
