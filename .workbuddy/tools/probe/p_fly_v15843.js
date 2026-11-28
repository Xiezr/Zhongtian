'use strict';
/* v158.43 验收探针：诉求1「空天飞机 WASD 飞行」+ 高空右键转头 + 地表键位隔离。
   真实开局 → 高空轨道态 → 真键盘 WASD → 真右键拖 → 真左键点击。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15843.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const fs = require('fs');

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

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    const fp = M.flyProbe ? M.flyProbe() : { v: 0 };
    const hud = document.getElementById('fly-hud');
    return {
      surf: !!M._surf,
      v: +fp.v.toFixed(2),
      yaw: +fp.yaw.toFixed(4),
      pitch: +fp.pitch.toFixed(4),
      dir: fp.dir.map((x) => +x.toFixed(5)),
      lookYaw: +(fp.lookYaw || 0).toFixed(4),
      lookPitch: +(fp.lookPitch || 0).toFixed(4),
      hud: hud ? hud.style.display !== 'none' : false,
      _flErr: M._flErr1 || null
    };
  });

  /* 高空基线：默认开局 dist=R*2.9，agl≈570m → 轨道态 */
  const s0 = await snap();
  console.log('基线: ' + JSON.stringify(s0));
  check('① 开局即高空轨道态（飞行系统就位、速度 0、无运行时错误）',
    !s0.surf && s0.v === 0 && !s0._flErr, 'surf=' + s0.surf + ' v=' + s0.v + ' err=' + s0._flErr);

  /* A. E 加速：按住 1.5s，速度平滑爬升且不超上限 */
  await p.keyboard.down('KeyE');
  await p.waitForTimeout(1500);
  const sW = await snap();
  await p.keyboard.up('KeyE');
  console.log('按住 E 1.5s: ' + JSON.stringify(sW));
  check('② E 加速 1.5s：速度爬升 60~120 m/s（有下限、不超上限 · v158.45 提速口径）',
    sW.v > 60 && sW.v <= 120.01, 'v=' + sW.v);
  check('③ 飞行中 HUD 显示速度', sW.hud, 'hud=' + sW.hud);

  /* B. 惯性衰减：松键 1s 仍滑行，5s 后滑停 */
  await p.waitForTimeout(1000);
  const sD1 = await snap();
  await p.waitForTimeout(4000);
  const sD2 = await snap();
  console.log('松键 1s: ' + JSON.stringify(sD1) + ' · 松键 5s: ' + JSON.stringify(sD2));
  check('④ 松键惯性滑行（1s 后仍 > 0 但明显减速）',
    sD1.v > 0.5 && sD1.v < sW.v * 0.98, 'v ' + sW.v + ' → ' + sD1.v);
  check('⑤ 5s 后滑停（v < 0.5）', Math.abs(sD2.v) < 0.5, 'v=' + sD2.v);

  /* C. 倒飞：按住 Q 1.5s，速度为负且 |v| ≤ 0.6×120 */
  await p.keyboard.down('KeyQ');
  await p.waitForTimeout(1500);
  const sS = await snap();
  await p.keyboard.up('KeyQ');
  console.log('按住 Q 1.5s: ' + JSON.stringify(sS));
  check('⑥ Q 减速到倒飞：v < 0 且 |v| ≤ 72（倒飞上限 · v158.45）',
    sS.v < -5 && sS.v >= -72.01, 'v=' + sS.v);
  await p.waitForTimeout(4500);   /* 等它滑停，避免污染下一段 */

  /* D. 转向（手动 tick，同步可控，headless 低帧率下不依赖 rAF）：
     预置速度 v=20，A 按住 90 tick（1.5s 模拟时间）→ lookYaw 减（左转）；
     D 同型 → lookYaw 增（右转）。转向只动视线、不动位置 dir。 */
  const sTurn = await p.evaluate(() => {
    const M = GAME.map3d;
    const run = (key) => {
      M._fly.v = 40;   /* v158.45 提速后满速 120，预置 1/3 满速验转向缩放 */
      GAME._flyKeys = {}; GAME._flyKeys[key] = 1;
      const p0 = M.flyProbe();
      let n = 0;
      for (let i = 0; i < 90; i++) { if (M.flyTick(1 / 60)) n++; }
      GAME._flyKeys = {};
      const p1 = M.flyProbe();
      const dDir = Math.hypot(p1.dir[0] - p0.dir[0], p1.dir[1] - p0.dir[1], p1.dir[2] - p0.dir[2]);
      return { n, dl: p1.lookYaw - p0.lookYaw, dDir };
    };
    const a = run('a');
    const d = run('d');
    return { a, d };
  });
  console.log('转向: ' + JSON.stringify(sTurn));
  check('⑦ A 左转 1.5s：lookYaw 减 < -0.15；D 右转：lookYaw 增 > 0.15（视线转、位置不动）',
    sTurn.a.n >= 60 && sTurn.a.dl < -0.15 && sTurn.d.dl > 0.15,
    'A: n=' + sTurn.a.n + ' dl=' + sTurn.a.dl.toFixed(3) + ' dDir=' + sTurn.a.dDir.toFixed(4)
    + ' · D: n=' + sTurn.d.n + ' dl=' + sTurn.d.dl.toFixed(3));

  /* E. 飞行推进（v158.51：E 加速 + W 抬头 = 视线近水平、投影≈满，推进最大）：
     E 按住获得速度 → W 同按 2s（抬头）→ 位置 dir 必须真变 */
  const sP0 = await snap();
  await p.keyboard.down('KeyE'); await p.waitForTimeout(1500);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2000);
  await p.keyboard.up('KeyW'); await p.keyboard.up('KeyE');
  const sP1 = await snap();
  const dDir = Math.hypot(sP1.dir[0] - sP0.dir[0], sP1.dir[1] - sP0.dir[1], sP1.dir[2] - sP0.dir[2]);
  console.log('E+W 推进: Δdir=' + dDir.toFixed(5));
  check('⑧ E 加速 + W 抬头飞行 2s：位置 dir 真推进（Δdir > 0.02）',
    dDir > 0.02, 'Δdir=' + dDir.toFixed(5));
  await p.waitForTimeout(4500);

  /* F. 高空右键 = 转头（位置不动）：拖后 lookYaw/lookPitch 变、dir 不变
     ⚠️ 先清飞行速度并等惯性停 —— 否则滑行本身会推进 dir，干扰判据 */
  await p.evaluate(() => { GAME.map3d._fly.v = 0; });
  await p.waitForTimeout(500);
  const sR0 = await snap();
  const dirBefore = sR0.dir.slice();
  await p.mouse.move(720, 450);
  await p.mouse.down({ button: 'right' });
  for (let i = 1; i <= 24; i++) { await p.mouse.move(720 + i * 12, 450); await p.waitForTimeout(16); }
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(300);
  const sR1 = await p.evaluate(() => {
    const M = GAME.map3d;
    const fp = M.flyProbe();
    return {
      dir: fp.dir.map((x) => +x.toFixed(5)),
      lookYaw: +fp.lookYaw.toFixed(4),
      lookPitch: +fp.lookPitch.toFixed(4)
    };
  });
  const dDirR = Math.hypot(sR1.dir[0] - dirBefore[0], sR1.dir[1] - dirBefore[1], sR1.dir[2] - dirBefore[2]);
  console.log('右键拖后: ' + JSON.stringify(sR1) + ' · Δdir=' + dDirR.toFixed(5));
  check('⑨ 高空右键转头：视线偏移变、位置 dir 一寸不动',
    (Math.abs(sR1.lookYaw) > 0.05 || Math.abs(sR1.lookPitch) > 0.02) && dDirR < 1e-4,
    'lookYaw=' + sR1.lookYaw + ' lookPitch=' + sR1.lookPitch + ' Δdir=' + dDirR.toFixed(5));

  /* G. 左键停止惯性：飞行中左键点击 → v 归 0 */
  await p.keyboard.down('KeyE'); await p.waitForTimeout(1000); await p.keyboard.up('KeyE');
  const sG0 = await snap();
  await p.mouse.click(720, 450);
  await p.waitForTimeout(150);
  const sG1 = await snap();
  console.log('点击前: ' + JSON.stringify(sG0) + ' · 点击后: ' + JSON.stringify(sG1));
  check('⑩ 飞行中左键点击 = 停止惯性（「直至左键操作」）',
    sG0.v > 1 && Math.abs(sG1.v) < 0.01, 'v ' + sG0.v + ' → ' + sG1.v);

  /* I. v158.51：W/S 机头俯仰 + 无操作自动调平（「脚底回星球侧」）。
     先清速度（俯仰与推进解耦，位置不动），真键盘 W 抬头 → S 低头 → 松键静置。 */
  await p.evaluate(() => { GAME.map3d._fly.v = 0; });
  await p.waitForTimeout(500);
  const sI0 = await snap();
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2000); await p.keyboard.up('KeyW');
  const sI1 = await snap();
  const dDirI1 = Math.hypot(sI1.dir[0] - sI0.dir[0], sI1.dir[1] - sI0.dir[1], sI1.dir[2] - sI0.dir[2]);
  console.log('W 抬头 2s: lookPitch ' + sI0.lookPitch + ' → ' + sI1.lookPitch + ' Δdir=' + dDirI1.toFixed(5));
  check('⑬ W 抬头 2s：lookPitch 增到 ≥ +1.3（clamp 1.55）且位置不动（无速度不推进）',
    sI1.lookPitch >= 1.3 && dDirI1 < 1e-4,
    'lookPitch=' + sI1.lookPitch + ' Δdir=' + dDirI1.toFixed(5));
  await p.keyboard.down('KeyS'); await p.waitForTimeout(4000); await p.keyboard.up('KeyS');
  const sI2 = await snap();
  console.log('S 低头 4s: lookPitch=' + sI2.lookPitch);
  check('⑭ S 低头 4s：lookPitch 减到 ≤ -1.3（从 +1.55 全程低头到下限 · 与右键同 clamp）',
    sI2.lookPitch <= -1.3, 'lookPitch=' + sI2.lookPitch);
  /* 静置：2.5s 调平延迟 + 1.55/0.5 ≈ 3.1s 回正 + 余量 */
  await p.waitForTimeout(6500);
  const sI3 = await snap();
  console.log('静置 6.5s 后: lookPitch=' + sI3.lookPitch);
  check('⑮ 无操作自动调平：lookPitch 缓慢回 0（画面正立 · 脚底是星球 · 头顶朝外太空）',
    Math.abs(sI3.lookPitch) < 0.05, 'lookPitch=' + sI3.lookPitch);

  /* H. 地表 WASD 仍归走路（通道隔离）：滚轮降到地表 → W 推人物、飞行 v=0
     （playerPose 位置量在 pp.dir —— 单位方向向量；pp.v 是瞬时速度恒 0） */
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(45); }
  await p.waitForTimeout(1500);
  const sH0 = await p.evaluate(() => {
    const M = GAME.map3d;
    const pp = M.playerPose();
    return { surf: !!M._surf, v: M._fly.v, d: pp.dir.slice() };
  });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  const sH1 = await p.evaluate(() => {
    const M = GAME.map3d;
    const pp = M.playerPose();
    return { v: M._fly.v, d: pp.dir.slice() };
  });
  const dP = Math.hypot(sH1.d[0] - sH0.d[0], sH1.d[1] - sH0.d[1], sH1.d[2] - sH0.d[2]);
  console.log('地表 W 1.2s: ' + JSON.stringify(sH0) + ' → ' + JSON.stringify(sH1) + ' Δdir=' + dP.toFixed(5));
  check('⑪ 地表 W 走人物（dir 推进 Δ>0.003 ≈ 1m）且飞行速度恒 0（通道隔离）',
    sH0.surf && dP > 0.003 && sH1.v === 0, 'surf=' + sH0.surf + ' Δdir=' + dP.toFixed(5) + ' flyV=' + sH1.v);

  check('⑫ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
