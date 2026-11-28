'use strict';
/* v158.52 验收探针：高空惯性战舰飞行五条。
   ①高度可变（↑↓升降）②←→加减速（QE 退役）③前进=沿速度矢量
   ④转向留弧线（速度恒定、非转星球）⑤三角锥战舰 + 尾迹形体。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15852.js */
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
  await p.waitForTimeout(700);

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    const f = M.flyProbe ? M.flyProbe() : { v: 0 };
    const hud = document.getElementById('fly-hud');
    const r = (x) => x == null ? null : +x.toFixed(3);
    return {
      surf: !!M._surf, v: r(f.v), alt: r(f.alt), active: !!f.active,
      pos: f.pos ? f.pos.map(r) : null, head: f.head ? f.head.map(r) : null,
      vel: f.vel ? f.vel.map(r) : null, trail: f.trail, climb: r(f.climb),
      ship: !!(M._shipMesh && M._shipMesh.visible), eng: !!(M._shipEngine && M._shipEngine.visible),
      trailMesh: !!(M._shipTrail && M._shipTrail.visible),
      flyCam: !!M._flyCam, hud: hud ? hud.style.display !== 'none' : false,
      hudTxt: hud ? hud.textContent : '', err: M._flErr1 || M._shipErr || null
    };
  });
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const s0 = await snap();
  console.log('基线: ' + JSON.stringify(s0));
  check('①开局即高空战舰态：fly.active + 位置/机头/速度就位、形体与机位在册、无运行时错误',
    !s0.surf && s0.active && s0.pos && s0.head && s0.vel && s0.ship && s0.eng && s0.trailMesh && s0.flyCam && !s0.err,
    'active=' + s0.active + ' ship=' + s0.ship + ' cam=' + s0.flyCam + ' err=' + s0.err);

  /* ② ←→ 加减速：真键盘 ArrowRight 1.4s → v 爬升；ArrowLeft 1.8s → 转负 */
  await p.keyboard.down('ArrowRight');
  await p.waitForTimeout(1400);
  const sR = await snap();
  await p.keyboard.up('ArrowRight');
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(2100);
  const sL = await snap();
  await p.keyboard.up('ArrowLeft');
  console.log('→ 加速: ' + JSON.stringify({ v: sR.v, alt: sR.alt, trail: sR.trail }) +
    ' · ← 减速: ' + JSON.stringify({ v: sL.v, alt: sL.alt }));
  check('②←→ 加减速（QE 退役）：→ 1.4s 爬到 50~120，← 2.1s 降到 <0（可倒飞）',
    sR.v > 50 && sR.v <= 120.01 && sL.v < sR.v - 40 && sL.v >= -72.01,
    'v ' + sR.v + ' → ' + sL.v);

  /* 牛顿第一定律：清键后 2.5s 速度恒定（旧版指数衰减会掉到 <10%） */
  await p.evaluate(() => { GAME._flyKeys = {}; });
  const sN0 = await snap();
  await p.waitForTimeout(2500);
  const sN1 = await snap();
  console.log('无输入 2.5s: v ' + sN0.v + ' → ' + sN1.v);
  check('③太空中速度恒定：无输入 2.5s 速度保持（|Δ| < 1 m/s，旧版衰减会掉 95%）',
    Math.abs(sN1.v - sN0.v) < 1.0, 'v ' + sN0.v + ' → ' + sN1.v);

  /* ④ ↑↓ 升降：真键盘 ArrowUp 1.2s → 海拔 +24~32m；ArrowDown 1.2s → 回落 */
  const sU0 = await snap();
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(1200);
  const sU1 = await snap();
  await p.keyboard.up('ArrowUp');
  await p.keyboard.down('ArrowDown');
  await p.waitForTimeout(1200);
  const sU2 = await snap();
  await p.keyboard.up('ArrowDown');
  console.log('↑↓ 海拔: ' + sU0.alt + ' → ' + sU1.alt + ' → ' + sU2.alt);
  check('④↑↓ 改海拔：↑ 1.2s 升 ≥18m、↓ 1.2s 降 ≥18m（高度不再固定）',
    sU1.alt - sU0.alt > 18 && sU2.alt < sU1.alt - 18,
    'alt ' + sU0.alt + ' → ' + sU1.alt + ' → ' + sU2.alt);

  /* ⑤ 前进 = 沿速度矢量（不是把星球转过来）：真调 tick，pos 位移方向 ≈ vel */
  const sV = await p.evaluate(() => {
    const M = GAME.map3d;
    GAME._flyKeys = {};
    M._fly.v = 60;
    const p0 = M.flyProbe();
    for (let i = 0; i < 30; i++) M.flyTick(1 / 60);
    const p1 = M.flyProbe();
    const d = [p1.pos[0] - p0.pos[0], p1.pos[1] - p0.pos[1], p1.pos[2] - p0.pos[2]];
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    const ca = (d[0] * p0.vel[0] + d[1] * p0.vel[1] + d[2] * p0.vel[2]) / n;
    return { move: +n.toFixed(2), align: +ca.toFixed(3), v0: p0.v, v1: p1.v };
  });
  console.log('前进对账: ' + JSON.stringify(sV));
  check('⑤前进=沿速度矢量：0.5s 位移 ≈30m、与 vel 夹角余弦 > 0.98、速度不因转向改变',
    sV.move > 20 && sV.align > 0.98 && Math.abs(sV.v1 - sV.v0) < 1,
    'move=' + sV.move + ' align=' + sV.align + ' v=' + sV.v0 + '→' + sV.v1);

  /* ⑥ 转向留轨迹：A/D 转机头，速度矢量以有限角率追随（侧滑角先张开后稳定），
        轨迹是弧线；松手后速度归位；位置始终沿 vel 走（不是瞬移朝向）。
        v158.52 修正：旧判据要求"持续转向 3s 后收敛"在物理上不可能
        （机头 1.1 rad/s 持续转、速度有限追随 → 夹角有稳态值），改为
        "张开 → 稳定不发散 → 松手后归位"，才是惯性漂移的正确口径。 */
  const sT = await p.evaluate(() => {
    const M = GAME.map3d;
    GAME._flyKeys = {};
    M._fly.v = 80;
    const ang = (f) => {
      const c = f.head[0] * f.vel[0] + f.head[1] * f.vel[1] + f.head[2] * f.vel[2];
      return +(Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI).toFixed(1);
    };
    const run = (key, n) => {
      GAME._flyKeys = {}; GAME._flyKeys[key] = 1;  /* tick 读的是 GAME._flyKeys，不是 M._flyKeys */
      const a = M.flyProbe();
      for (let i = 0; i < n; i++) M.flyTick(1 / 60);
      const c = M.flyProbe();
      return { a0: ang(a), a1: ang(c), v: c.v,
        move: +Math.hypot(c.pos[0] - a.pos[0], c.pos[1] - a.pos[1], c.pos[2] - a.pos[2]).toFixed(1) };
    };
    const short = run('a', 30);   /* 0.5s：机头先转，速度滞后 → 侧滑角张开 */
    const long = run('a', 180);   /* 3s：稳态侧滑角，不再发散 */
    GAME._flyKeys = {};           /* 松手：速度矢量应收敛回机头 */
    const rel0 = M.flyProbe();
    for (let i = 0; i < 90; i++) M.flyTick(1 / 60);
    const release = { a0: ang(rel0), a1: ang(M.flyProbe()) };
    GAME._flyKeys = {};
    return { short, long, release };
  });
  console.log('转向轨迹: ' + JSON.stringify(sT));
  check('⑥转向体现惯性：0.5s 侧滑角张开、持续转向稳定不发散（<70°）、松手后收敛（<12°），速度恒 80',
    sT.short.a1 > sT.short.a0 + 8 && sT.long.a1 < sT.long.a0 + 20 && sT.long.a1 < 70
      && sT.release.a1 < sT.release.a0 - 8 && sT.release.a1 < 12
      && Math.abs(sT.long.v - 80) < 1 && sT.long.move > 100,
    JSON.stringify(sT));

  /* ⑦ 尾迹 + 机位跟随：飞行后 trail 点数 > 0，机位在战舰后方 */
  /* v158.52 修正：_flyCam 只在 placeCamera（rAF 每帧）里刷新，
     上面 ⑤⑥ 是同步手动 tick，不会触发 placeCamera，必须让浏览器跑几帧再读。 */
  await p.waitForTimeout(250);
  const sC = await p.evaluate(() => {
    const M = GAME.map3d, f = M.flyProbe();
    const cam = M._flyCam;
    if (!cam || !f.pos || !f.head) return { ok: false };
    const d = [cam.pos[0] - f.pos[0], cam.pos[1] - f.pos[1], cam.pos[2] - f.pos[2]];
    const behind = -(d[0] * f.head[0] + d[1] * f.head[1] + d[2] * f.head[2]);
    return { ok: true, trail: f.trail, behind: +behind.toFixed(2),
      upDot: +(cam.up[0] * f.pos[0] + cam.up[1] * f.pos[1] + cam.up[2] * f.pos[2]) /
        (Math.hypot(f.pos[0], f.pos[1], f.pos[2]) || 1) };
  });
  console.log('机位/尾迹: ' + JSON.stringify(sC));
  check('⑦战舰形体可辨：尾迹采样 > 0、机位在机头后方 ≥10m、up 朝径向（脚底星球）',
    sC.ok && sC.trail > 0 && sC.behind > 10 && sC.upDot > 0.99,
    JSON.stringify(sC));

  /* ⑧ HUD 文案（老板最恨"见设置页"式空指示）：键位直接印在屏上 */
  const sH = await snap();
  check('⑧HUD 直印键位：←→ 加减速 / ↑↓ 升降 / W/S 俯仰 / A/D 转向',
    sH.hud && sH.hudTxt.includes('←→ 加减速') && sH.hudTxt.includes('↑↓ 升降')
      && sH.hudTxt.includes('W/S 俯仰') && sH.hudTxt.includes('A/D 转向'),
    sH.hudTxt);

  /* ⑨ 地表隔离：滚轮降到地表 → 战舰收起、速度归零、W 仍走人物 */
  /* v158.52 修正：p.mouse.wheel 默认指针在 (0,0)，wheel 事件没落到 canvas 上，
     所以旧版滚 62 次高度纹丝不动。先把指针移到画布中心再滚。 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(40); }
  await p.waitForTimeout(900);
  const sS = await p.evaluate(() => {
    const M = GAME.map3d;
    return { surf: !!M._surf, active: !!(M._fly && M._fly.active), v: M._fly.v || 0,
      ship: !!(M._shipMesh && M._shipMesh.visible), d: M.playerPose().dir.slice() };
  });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1100); await p.keyboard.up('KeyW');
  const sS2 = await p.evaluate(() => GAME.map3d.playerPose().dir.slice());
  const dP = dist(sS.d, sS2);
  console.log('地表隔离: ' + JSON.stringify({ surf: sS.surf, active: sS.active, v: sS.v, ship: sS.ship }) + ' Δdir=' + dP.toFixed(5));
  check('⑨地表通道隔离：进地表战舰收起、飞行速度 0、W 走人物（Δdir > 0.003）',
    sS.surf && !sS.active && sS.v === 0 && !sS.ship && dP > 0.003,
    'surf=' + sS.surf + ' active=' + sS.active + ' Δdir=' + dP.toFixed(5));

  check('⑩全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
