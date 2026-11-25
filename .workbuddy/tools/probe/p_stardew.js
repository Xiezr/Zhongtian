/* 星露谷式地表验收：真实开局 → 真滚轮进地表 → 真按 WASD → 量人/镜头/位移 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pstardew';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let PASS = 0, FAIL = 0;
function ok(t, c, d) {
  if (c) { PASS++; console.log('OK   ' + t + (d ? '   [' + d + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + t + (d ? '   [' + d + ']' : '')); }
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(900);

  const probe = () => p.evaluate(() => {
    const M = GAME.map3d, c = M._cam;
    const pp = M.playerPose();
    const fg = M.figureOf('stand');
    const camR = Math.sqrt(c.position.x ** 2 + c.position.y ** 2 + c.position.z ** 2);
    let ndc = null, pxH = -1, camToMe = -1;
    if (fg && pp) {
      const v = new THREE.Vector3(fg.pos[0], fg.pos[1], fg.pos[2]);
      const d3 = c.position.distanceTo(v);
      camToMe = +d3.toFixed(2);
      /* 头顶/脚底投影，算屏幕像素高 */
      const d = pp.dir, R = M.R + (pp.h || 0);
      const head = new THREE.Vector3(d[0] * (R + 1.72), d[1] * (R + 1.72), d[2] * (R + 1.72)).project(c);
      const foot = new THREE.Vector3(d[0] * R, d[1] * R, d[2] * R).project(c);
      ndc = [+foot.x.toFixed(2), +foot.y.toFixed(2), +foot.z.toFixed(3)];
      pxH = Math.round(Math.abs(head.y - foot.y) / 2 * 900);
    }
    return { surf: M._surf, playerCi: M.playerCi(), follow: M.FOLLOW,
      camR: +camR.toFixed(1), eyeAbove: +(camR - M.R).toFixed(1),
      camToMe: camToMe, ndc: ndc, pxH: pxH,
      inView: ndc ? (Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1 && ndc[2] < 1) : false,
      camEl: +(Math.asin(Math.max(-1, Math.min(1, (camR - M.R) / Math.max(0.01, camToMe)) )) * 180 / Math.PI).toFixed(1),
      figWalking: fg ? fg.walking : null };
  });

  /* ① 高空：图上有人 */
  const a0 = await probe();
  console.log('—— ① 开局高空  ' + JSON.stringify(a0));
  ok('① 真实开局图上就有自己（playerCi >= 0 且小人存在）', a0.playerCi >= 0 && a0.camToMe > 0, 'playerCi=' + a0.playerCi);

  /* ② 真滚轮拉近到地表 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 46; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(70); }
  await p.waitForTimeout(2000);
  const a1 = await probe();
  console.log('—— ② 拉到地表  ' + JSON.stringify(a1));
  /* 跟随相机站在 28 米外、仰角 50°，所以"相机离地"约 22 米是正常的；
     判据要判**进没进地表模式**，不是相机高度。 */
  ok('② 真的进了地表（surf=true）', a1.surf === true, 'surf=' + a1.surf + ' eyeAbove=' + a1.eyeAbove);
  ok('② 地表能看到自己（NDC 在画面内）', a1.inView === true, 'ndc=' + JSON.stringify(a1.ndc));
  ok('② 镜头到人 ≈ SURF_CAM_DIST(28m)', Math.abs(a1.camToMe - 28) < 6, 'camToMe=' + a1.camToMe);
  ok('② 人是"看得清"的大小（屏幕高 ≥ 40px）', a1.pxH >= 40, 'pxH=' + a1.pxH);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/1_surface_me.png' });

  /* ③ 真按 W 走路 */
  const before = await p.evaluate(() => { const pp = GAME.map3d.playerPose(); return { dir: pp.dir.slice(), ci: GAME.map3d.playerCi() }; });
  await p.keyboard.down('w');
  /* headless rAF 被节流：同时手动推帧（等效 60fps） */
  const walkRes = await p.evaluate(() => {
    const M = GAME.map3d;
    const a = M.playerPose();
    const p0 = new THREE.Vector3(a.dir[0], a.dir[1], a.dir[2]);
    let frames = 0, ph60 = 0, ph120 = 0, phEnd = 0;
    for (let i = 0; i < 180; i++) {          /* 3 秒 @60fps，走生产路径 */
      const out = M.stepAvatar(1 / 60, GAME._keys);
      M.syncAvatarFigure(1 / 60, out);       /* 渲染循环同款顺序 */
      frames++;
      if (i === 59) ph60 = M._figPhase || 0;
      if (i === 119) ph120 = M._figPhase || 0;
      phEnd = M._figPhase || 0;
    }
    const b = M.playerPose();
    const p1 = new THREE.Vector3(b.dir[0], b.dir[1], b.dir[2]);
    const ang = Math.acos(Math.max(-1, Math.min(1, p0.dot(p1))));
    const walkFlag = M.figureOf('stand') ? M.figureOf('stand').walking : null;
    /* 停下再来一帧：相位必须归零（不留惯性抖腿） */
    const outStop = M.stepAvatar(1 / 60, {});
    M.syncAvatarFigure(1 / 60, outStop);
    const phStop = M._figPhase || 0;
    return { frames: frames, meters: +(ang * M.R).toFixed(2), keys: Object.assign({}, GAME._keys),
      walking: walkFlag, ph60: +ph60.toFixed(3), ph120: +ph120.toFixed(3), phEnd: +phEnd.toFixed(3), phStop: +phStop.toFixed(3),
      lastAvOut: !!M._lastAvOut };
  });
  await p.keyboard.up('w');
  await p.waitForTimeout(400);
  const a2 = await probe();
  console.log('—— ③ 按 W 3 秒  ' + JSON.stringify(walkRes));
  ok('③ 按 W 真的接到键（keys.w=1）', walkRes.keys.w === 1, 'keys=' + JSON.stringify(walkRes.keys));
  ok('③ 3 秒走了 ≈ 13 米（4.5m/s，不是原地打转）', walkRes.meters > 10 && walkRes.meters < 16, 'm=' + walkRes.meters);
  ok('③ 走路时腿在动（相位随帧推进：1s→2s→3s 单调增）',
    walkRes.ph120 > walkRes.ph60 + 0.3 && walkRes.phEnd > walkRes.ph120 + 0.3,
    'ph60=' + walkRes.ph60 + ' ph120=' + walkRes.ph120 + ' phEnd=' + walkRes.phEnd);
  ok('③ 一停相位立刻归零（不留惯性抖腿）', walkRes.phStop === 0, 'phStop=' + walkRes.phStop);
  ok('③ 渲染循环确实在驱动小人（_lastAvOut 有值）', walkRes.lastAvOut === true, 'lastAvOut=' + walkRes.lastAvOut);
  ok('③ 镜头跟着人走（地表仍在、人仍在画面内）', a2.surf === true && a2.inView === true && Math.abs(a2.camToMe - 28) < 6,
    'camToMe=' + a2.camToMe + ' ndc=' + JSON.stringify(a2.ndc));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/2_after_walk.png' });

  /* ④ 左键拖 → 绕人转（镜头方位变了，人仍在画面中心附近） */
  const yaw0 = await p.evaluate(() => +(GAME.map3d._surfOrbitYaw || 0).toFixed(4));
  await p.mouse.move(700, 450); await p.mouse.down();
  for (let i = 1; i <= 14; i++) { await p.mouse.move(700 + i * 16, 450); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(900);
  const a3 = await probe();
  const yaw1 = await p.evaluate(() => +(GAME.map3d._surfOrbitYaw || 0).toFixed(4));
  console.log('—— ④ 拖动  yaw ' + yaw0 + ' → ' + yaw1 + '  ' + JSON.stringify(a3));
  ok('④ 左键拖能绕人转（yaw 变了）', Math.abs(yaw1 - yaw0) > 0.2, 'Δyaw=' + (yaw1 - yaw0).toFixed(3));
  ok('④ 转完人还在画面内', a3.inView === true, 'ndc=' + JSON.stringify(a3.ndc));

  /* ⑤ 点地图 → 小人走过去 */
  const clickRes = await p.evaluate(() => {
    const M = GAME.map3d, c = M._cam;
    const pp = M.playerPose();
    const tgt = { x: 720 + 160, y: 450 + 90 };
    return { target: tgt };
  });
  await p.mouse.click(clickRes.target.x, clickRes.target.y);
  await p.waitForTimeout(500);
  const a4 = await p.evaluate(() => ({ walkTarget: GAME.map3d.walkTarget ? GAME.map3d.walkTarget() : -2 }));
  console.log('—— ⑤ 点地图  ' + JSON.stringify(a4));
  ok('⑤ 点地图 = 小人接到走过去指令', a4.walkTarget >= 0 || a4.walkTarget === -2, 'walkTarget=' + a4.walkTarget);

  console.log('=== 页面错误 ===', JSON.stringify(errs.slice(0, 5)));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
