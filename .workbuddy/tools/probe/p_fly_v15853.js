'use strict';
/* v158.53 验收探针：无人深空式飞行操控（老板「可操纵性差、上不是上、
   下不是下、完全没有坐标原点、玩家不知道自己在哪里」）。
   ①开局飞行态 + HUD 常驻星球方位 ②鼠标右键真转机头（看哪飞哪）
   ③速度瞬时对齐零侧滑 ④W/S 推进刹车 ⑤A/D 横滚 banking + 协调转弯
   ⑥↑ 辅助升降 ⑦双击右键回正平飞 ⑧方位随转头更新 ⑨地表态隔离 ⑩无运行时错误
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15853.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (ok) pass++; else fail++;
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1,
  dot(a, b) / (norm(a) * norm(b))))) * 180 / Math.PI;

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files'] });
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
  await p.waitForTimeout(800);

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    const f = M.flyProbe ? M.flyProbe() : {};
    const hud = document.getElementById('fly-hud');
    const r = (x) => x == null ? null : +x.toFixed(3);
    return {
      surf: !!M._surf, v: r(f.v), alt: r(f.alt), active: !!f.active,
      pos: f.pos ? f.pos.map(r) : null, head: f.head ? f.head.map(r) : null,
      vel: f.vel ? f.vel.map(r) : null, up: f.up ? f.up.map(r) : null,
      bank: r(f.bank), lookYaw: r(f.lookYaw), lookPitch: r(f.lookPitch),
      nav: f.nav ? {
        bearing: r(f.nav.bearing), elev: r(f.nav.elev), dir8: f.nav.dir8,
        vertical: f.nav.vertical, alt: r(f.nav.alt), range: r(f.nav.range),
        toward: r(f.nav.toward), bank: r(f.nav.bank)
      } : null,
      hud: hud ? hud.style.display !== 'none' : false,
      hudTxt: hud ? hud.textContent : '', rmb: !!M._rmbLook,
      err: M._flErr1 || M._shipErr || null
    };
  });

  const s0 = await snap();
  console.log('基线: ' + JSON.stringify(s0));
  check('①开局飞行态 + HUD 常驻星球方位指示（静止也看得见参照）',
    !s0.surf && s0.active && s0.hud && s0.hudTxt.includes('🌍 星球')
      && s0.hudTxt.includes('离地') && s0.nav && !s0.err,
    'active=' + s0.active + ' hud=' + s0.hud + ' dir8=' + (s0.nav && s0.nav.dir8) + ' err=' + s0.err);

  /* ② 鼠标右键拖 = 真转机头（旧版只改 lookYaw，机头 0°） */
  await p.mouse.move(720, 450);
  const h0 = await snap();
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(920, 450, { steps: 8 });
  await p.waitForTimeout(120);
  const h1 = await snap();
  await p.mouse.up({ button: 'right' });
  const headTurn = ang(h0.head, h1.head);
  check('②鼠标右键拖 200px 真转机头 ≥30°（旧版机头 0°=看这边飞那边）',
    headTurn > 30 && Math.abs(h1.lookYaw - h0.lookYaw) < 0.01,
    '机头转 ' + headTurn.toFixed(1) + '° · lookYaw ' + h0.lookYaw + '→' + h1.lookYaw);

  /* ③ 速度矢量瞬时对齐机头（旧版侧滑 20.8°） */
  check('③速度矢量瞬时对齐机头：vel/head 夹角 <1°（旧版 20.8° 侧滑）',
    ang(h1.vel, h1.head) < 1, '夹角 ' + ang(h1.vel, h1.head).toFixed(3) + '°');

  /* ④ W/S 推进刹车 */
  await p.evaluate(() => { GAME._flyKeys = {}; });
  const w0 = await snap();
  await p.keyboard.down('w');
  await p.waitForTimeout(1100);
  const w1 = await snap();
  await p.keyboard.up('w');
  await p.keyboard.down('s');
  await p.waitForTimeout(1500);
  const w2 = await snap();
  await p.keyboard.up('s');
  check('④W/S 推进刹车：W 1.1s 加速 ≥35 m/s、S 1.5s 回落 ≥35 m/s',
    w1.v - w0.v > 35 && w2.v < w1.v - 35,
    'v ' + w0.v + ' → ' + w1.v + ' → ' + w2.v);

  /* ⑤ A/D 横滚 + 协调转弯（旧版 A/D 只水平转头，无 banking） */
  await p.evaluate(() => { GAME._flyKeys = {}; });
  const a0 = await snap();
  await p.keyboard.down('a');
  await p.waitForTimeout(750);
  const a1 = await snap();
  await p.keyboard.up('a');
  const headRoll = ang(a0.head, a1.head), upRoll = ang(a0.up, a1.up);
  check('⑤A/D 横滚 + 协调转弯：banking ≥8°、机头同向转 ≥8°、机体 up 变 ≥8°',
    a1.bank > 8 && headRoll > 8 && upRoll > 8,
    'bank=' + a1.bank + '° headΔ=' + headRoll.toFixed(1) + '° upΔ=' + upRoll.toFixed(1) + '°');

  /* ⑥ ↑ 辅助升降 */
  const u0 = await snap();
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(1100);
  const u1 = await snap();
  await p.keyboard.up('ArrowUp');
  check('⑥↑ 辅助升降：1.1s 海拔升 ≥18m（不再是抬头电梯以外的唯一操作）',
    u1.alt - u0.alt > 18, 'alt ' + u0.alt + ' → ' + u1.alt);

  /* ⑦ 双击右键 = 回正平飞（up 归径向、机头朝向不变） */
  await p.evaluate(() => { GAME._flyKeys = {}; });
  await p.keyboard.down('d');
  await p.waitForTimeout(650);
  await p.keyboard.up('d');
  const r0 = await snap();
  await p.mouse.move(720, 450);
  await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(60);
  await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(120);
  const r1 = await snap();
  check('⑦双击右键回正平飞：bank 从 ≥8° 归 <1°、机头朝向保持（差 <5°）',
    r0.bank > 8 && r1.bank < 1 && ang(r0.head, r1.head) < 5,
    'bank ' + r0.bank + '° → ' + r1.bank + '° · 机头Δ ' + ang(r0.head, r1.head).toFixed(1) + '°');

  /* ⑧ 星球方位指示随俯仰刷新（HUD 不是死文案）。
     注意：绕径向偏航时星球恰在机体正下方，八方位角退化（bearing 是浮点噪声），
     所以判据用「机头→星球夹角」——上下拖 = 真正抬头/低头，必然大变。 */
  await p.mouse.move(720, 450);
  const v0 = await snap();
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(720, 250, { steps: 8 });
  await p.waitForTimeout(120);
  const v1 = await snap();
  await p.mouse.up({ button: 'right' });
  const tDelta = Math.abs(v1.nav.toward - v0.nav.toward);
  check('⑧星球方位指示随俯仰刷新：机头→星球夹角变化 ≥20°、方位文案同步',
    tDelta > 20 && typeof v1.nav.dir8 === 'string' && v1.nav.dir8.length > 0
      && /机头→星球/.test(v1.hudTxt),
    'toward ' + v0.nav.toward + '° → ' + v1.nav.toward + '° · '
      + v0.nav.dir8 + '→' + v1.nav.dir8);

  /* ⑨ 导航出口/HUD 随飞行态开关隔离（地表不串线） */
  const g = await p.evaluate(() => {
    const M = GAME.map3d;
    const before = !!M._flyNavState();
    const saved = M._fly.active;
    M._fly.active = false;
    const after = !!M._flyNavState();
    M._fly.active = saved;
    GAME.ui.renderFlyHud(null);
    const hud = document.getElementById('fly-hud');
    return { before: before, after: after, hidden: hud ? hud.style.display === 'none' : false };
  });
  check('⑨地表态隔离：飞行态有导航快照、退出后为空、HUD 隐藏',
    g.before && !g.after && g.hidden,
    'before=' + g.before + ' after=' + g.after + ' hidden=' + g.hidden);

  /* ⑩ 无运行时错误 */
  const e0 = await snap();
  check('⑩全程无页面异常 / 飞行 tick 无错', !e0.err && errs.length === 0,
    'tick=' + (e0.err || 'ok') + ' page=' + (errs[0] || 'ok'));

  console.log('\n结果: ' + pass + '/' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('PROBE ERROR', e); process.exit(2); });
