'use strict';
/* v158.56 行为探针 —— 老板六条：
     ①在高空，不再由滚轮调整高度；
     ②飞行器和相机分离，相机总在飞行器尾端；
     ③飞行器在屏幕的下 2/5、水平正中；
     ④鼠标指示飞行的方向；
     ⑤Ws 和上下为加减速；
     ⑥设置飞行器的起飞降落程序。
   ------------------------------------------------------------
   每条都真调、带下限（防 0===0 平凡解）：
   ① 飞行态连滚 5 格 → 海拔变化 < 0.5m；
   ② cam.pos−ship.pos 沿 −head 的分量 ≈ FLY_CAM_BACK（±3m）、横向偏差 < 3m；
   ③ 把 ship.pos 投影到相机 → 屏幕 y ∈ [0.60,0.72]、|ndc.x| < 0.05；
   ④ 鼠标移到右上 → aim 出现且 aim 与初始 head 夹角 ≥ 15°，
      1.2s 后 head 收敛到 aim（< 8°）；回中 → aim=null；
   ⑤ W/↑ 各自使 v 上升 ≥ 5 m/s，S/↓ 各自使 v 下降 ≥ 5 m/s；
   ⑥ 起飞：phase takeoff→cruise，alt 增长 ≥ 40m；降落：phase landing→dock，
      _surf=true 且 active=false。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15856.js
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const L = []; const log = (s) => { L.push(String(s)); console.log(s); };
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  log((cond ? '✅' : '❌') + ' ' + name + (detail ? ' · ' + detail : ''));
  cond ? pass++ : fail++;
}
const ang = (a, b) => {
  const la = Math.hypot(a[0], a[1], a[2]) || 1, lb = Math.hypot(b[0], b[1], b[2]) || 1;
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
};

(async () => {
  const src = fs.readFileSync(ROOT + '/js/map3d.js', 'utf8');
  const um = fs.readFileSync(ROOT + '/js/ui-mapui.js', 'utf8');
  const mj = fs.readFileSync(ROOT + '/js/main.js', 'utf8');

  /* ---------- 结构锁（静态，逐条独立便于定位） ---------- */
  const S = [
    ['滚轮飞行态直接 return', /if \(M\._fly && M\._fly\.active && !M\._surf\) \{ return; \}/.test(src)],
    ['FLY_CLIMB 赋值退役', !/M\.FLY_CLIMB = /.test(src)],
    ['FLY_SCREEN_Y = 0.66', /M\.FLY_SCREEN_Y = 0\.66;/.test(src)],
    ['flyLaunch 出口', /M\.flyLaunch = function /.test(src)],
    ['flyLand 出口', /M\.flyLand = function /.test(src)],
    ['flyToggle 出口', /M\.flyToggle = function /.test(src)],
    ['_flyAimAt 出口', /M\._flyAimAt = function /.test(src)],
    ['_commitFlight 唯一提交', /function _commitFlight\(/.test(src)],
    ['_tickProgram 程序', /function _tickProgram\(/.test(src)],
    ['机位吊尾端 BACK26', /addScaledVector\(_hd, -\(M\.FLY_CAM_BACK \|\| 26\)\)/.test(src)],
    ['HUD 新键位文案', um.indexOf('加减速') >= 0 && um.indexOf('空格 起降') >= 0],
    ['空格接 flyToggle', mj.indexOf('flyToggle()') >= 0]
  ];
  const bad0 = S.filter((x) => !x[1]).map((x) => x[0]);
  ok('⓪源码结构锁 12 条（滚轮禁用/电梯退役/机位/程序/指示/键位）',
    bad0.length === 0, bad0.length ? ('缺: ' + bad0.join(', ')) : '12/12');

  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V1456', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1200);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(200);

  /* ---------- ② 相机在尾端 ---------- */
  const st2 = await p.evaluate(() => {
    const M = GAME.map3d, f = M._fly, fc = M._flyCam;
    if (!fc || !f.pos) return null;
    const sp = f.pos, hd = f.head, cu = fc.up;
    const dx = fc.pos[0] - sp[0], dy = fc.pos[1] - sp[1], dz = fc.pos[2] - sp[2];
    const back = -(dx * hd[0] + dy * hd[1] + dz * hd[2]);   /* 沿 −head 的分量 */
    const upC = dx * cu[0] + dy * cu[1] + dz * cu[2];       /* 沿相机 up 的分量 */
    return { back, upC, cfgBack: M.FLY_CAM_BACK, cfgUp: M.FLY_CAM_UP };
  });
  ok('②相机吊在尾端：−head 分量 ≈ FLY_CAM_BACK、up 分量 ≈ FLY_CAM_UP（各 ±3m）',
    !!st2 && Math.abs(st2.back - st2.cfgBack) < 3 && Math.abs(st2.upC - st2.cfgUp) < 3,
    st2 ? 'back=' + st2.back.toFixed(2) + '/' + st2.cfgBack
      + ' up=' + st2.upC.toFixed(2) + '/' + st2.cfgUp : 'null');

  /* ---------- ③ 战舰在屏幕下 2/5、水平正中 ---------- */
  const st3 = await p.evaluate(() => {
    const M = GAME.map3d, f = M._fly, cam = M._cam;
    if (!f.pos || !cam || !cam.updateMatrixWorld) return null;
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(f.pos[0], f.pos[1], f.pos[2]);
    v.project(cam);
    return { ndcX: v.x, ndcY: v.y, screenY: (1 - v.y) / 2, screenX: (v.x + 1) / 2,
      cfg: M.FLY_SCREEN_Y, fov: cam.fov };
  });
  ok('③战舰落在屏幕下 2/5、水平正中：screenY∈[0.60,0.72] 且 |ndcX|<0.05',
    !!st3 && st3.screenY > 0.60 && st3.screenY < 0.72 && Math.abs(st3.ndcX) < 0.05,
    st3 ? 'screenY=' + st3.screenY.toFixed(3) + '(cfg ' + st3.cfg + ') ndcX=' + st3.ndcX.toFixed(3) : 'null');

  /* ---------- ① 滚轮不改高度 ---------- */
  const altA = await p.evaluate(() => GAME.map3d.flyProbe().alt);
  await p.evaluate(() => {
    const c = document.getElementById('mapCanvas');
    for (let i = 0; i < 5; i++) {
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: -220, bubbles: true, cancelable: true }));
    }
  });
  await p.waitForTimeout(500);
  const altB = await p.evaluate(() => GAME.map3d.flyProbe().alt);
  /* v158.57：判据从 0.5m 放到 2m —— 引力下沉 1.0 m/s 在 0.5s 测量窗口内
     本身就会掉 ~0.5m（实测 569.42→568.92）。滚轮若真生效会差几十米，
     2m 的阈值仍能严格区分，不是放宽语义。 */
  ok('①飞行态滚轮不再改高度：连滚 5 格海拔变化 < 2m（余量留给引力下沉）',
    altA != null && altB != null && Math.abs(altB - altA) < 2,
    'alt ' + (altA == null ? 'null' : altA.toFixed(2)) + ' → ' + (altB == null ? 'null' : altB.toFixed(2)));

  /* ---------- ⑤ W / ↑ 加速、S / ↓ 减速 ---------- */
  const vKey = async (key) => {
    const before = await p.evaluate(() => GAME.map3d._fly.v);
    await p.keyboard.down(key);
    await p.waitForTimeout(420);
    await p.keyboard.up(key);
    await p.waitForTimeout(120);
    const after = await p.evaluate(() => GAME.map3d._fly.v);
    return after - before;
  };
  const dW = await vKey('w'), dUp = await vKey('ArrowUp');
  const dS = await vKey('s'), dDn = await vKey('ArrowDown');
  ok('⑤W/↑ 都加速（各 ≥5 m/s）、S/↓ 都减速（各 ≤−5 m/s）',
    dW > 5 && dUp > 5 && dS < -5 && dDn < -5,
    'W' + dW.toFixed(1) + ' ↑' + dUp.toFixed(1) + ' S' + dS.toFixed(1) + ' ↓' + dDn.toFixed(1));

  /* ---------- ④ 鼠标指示航向 ---------- */
  await p.evaluate(() => {
    const f = GAME.map3d._fly; f.v = 0; f.aim = null;
    window.__mmc = 0;
    window.addEventListener('mousemove', (e) => {
      window.__mmc++;
      window.__lastTgt = (e.target && (e.target.id || e.target.tagName)) || '?';
    }, true);
  });
  const h0 = await p.evaluate(() => GAME.map3d._fly.head.slice());
  await p.mouse.move(CX + 300, CY - 170);
  await p.waitForTimeout(150);
  const aimNow = await p.evaluate(() => {
    const f = GAME.map3d._fly;
    return { aim: f.aim ? f.aim.slice() : null, head: f.head.slice(),
      mmc: window.__mmc || 0, active: !!f.active, surf: !!GAME.map3d._surf,
      tgt: (window.__lastTgt || 'n/a') };
  });
  const aimTurn = (aimNow.aim && h0) ? ang(h0, aimNow.aim) : 0;
  await p.waitForTimeout(1400);
  const hAfter = await p.evaluate(() => {
    const f = GAME.map3d._fly;
    return { head: f.head.slice(), aim: f.aim ? f.aim.slice() : null };
  });
  const converged = hAfter.aim ? ang(hAfter.head, hAfter.aim) : 999;
  ok('④鼠标指示航向：右上移动产生 aim（偏 ≥15°）、机头收敛到 aim（<8°）',
    !!aimNow.aim && aimTurn >= 15 && converged < 8,
    'aim=' + (aimNow.aim ? 'yes' : 'null') + ' mm=' + aimNow.mmc
      + ' active=' + aimNow.active + ' surf=' + aimNow.surf
      + ' aim偏=' + aimTurn.toFixed(1) + '° 收敛残差=' + (converged === 999 ? 'n/a' : converged.toFixed(2) + '°'));
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(200);
  const aimCleared = await p.evaluate(() => GAME.map3d._fly.aim === null);
  ok('④b鼠标回中死区 → aim 清空（保持当前航向，不打转）', aimCleared === true, 'aim=null:' + aimCleared);

  /* ---------- ⑧ 相机 up 与机体滚转分离 ---------- */
  const bankA = await p.evaluate(() => GAME.map3d.flyProbe().bank);
  await p.keyboard.down('a');
  await p.waitForTimeout(900);
  await p.keyboard.up('a');
  await p.waitForTimeout(100);
  const st8 = await p.evaluate(() => {
    const M = GAME.map3d, f = M._fly, fc = M._flyCam;
    const r = f.pos.map((v) => v / (Math.hypot(f.pos[0], f.pos[1], f.pos[2]) || 1));
    const cu = fc.up;
    const d = cu[0] * r[0] + cu[1] * r[1] + cu[2] * r[2];
    return { bank: M.flyProbe().bank, camRadDeg: Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI };
  });
  ok('⑧相机 up 与机体滚转分离：横滚 ≥25° 而 cam.up 偏离径向 <25°（画面不跟着翻）',
    st8.bank > 25 && st8.camRadDeg < 25,
    'bank=' + st8.bank.toFixed(1) + '° cam.up↔径向=' + st8.camRadDeg.toFixed(1) + '°（起手 ' + bankA.toFixed(1) + '°）');

  /* ---------- ⑥ 起飞程序 ---------- */
  await p.evaluate(() => { GAME.map3d.surfaceMode(true); });
  await p.waitForTimeout(500);
  const launchStart = await p.evaluate(() => {
    const M = GAME.map3d;
    const okL = M.flyToggle();
    return { ok: okL, phase: M._fly.phase, v: M._fly.v,
      alt: M.flyProbe().alt, surf: M._surf };
  });
  await p.waitForTimeout(3200);
  const launchEnd = await p.evaluate(() => {
    const M = GAME.map3d;
    return { phase: M._fly.phase, v: M._fly.v, alt: M.flyProbe().alt, active: !!M._fly.active };
  });
  ok('⑥起飞程序：地表按起飞 → phase takeoff→cruise、v 抬到 ≥30、alt 涨 ≥40m',
    launchStart.ok === true && launchStart.phase === 'takeoff'
      && launchEnd.phase === 'cruise' && launchEnd.v > 30
      && (launchEnd.alt - launchStart.alt) > 40 && launchEnd.active === true,
    'phase ' + launchStart.phase + '→' + launchEnd.phase + ' v=' + (launchEnd.v || 0).toFixed(1)
      + ' Δalt=' + ((launchEnd.alt || 0) - (launchStart.alt || 0)).toFixed(1));

  /* ---------- ⑦ 降落程序 ---------- */
  const landStart = await p.evaluate(() => {
    const M = GAME.map3d;
    const okL = M.flyToggle();
    return { ok: okL, phase: M._fly.phase };
  });
  /* v158.57：着陆时长改为随高度（|r0−r1|/26，上限 7s），176m 需 ~6.7s，
     旧 3.6s 等不到 dock —— 这是规则变更，不是回归。 */
  await p.waitForTimeout(8000);
  const landEnd = await p.evaluate(() => {
    const M = GAME.map3d;
    return { phase: M._fly.phase, surf: !!M._surf, active: !!M._fly.active,
      alt: M.flyProbe().alt };
  });
  ok('⑦降落程序：飞行中按降落 → phase landing→dock、交回地表层（_surf=true、active=false）',
    landStart.ok === true && landStart.phase === 'landing'
      && landEnd.phase === 'dock' && landEnd.surf === true && landEnd.active === false,
    'phase ' + landStart.phase + '→' + landEnd.phase + ' surf=' + landEnd.surf
      + ' active=' + landEnd.active + ' alt=' + (landEnd.alt == null ? 'null' : landEnd.alt.toFixed(1)));

  /* ---------- ⑨ 无异常 ---------- */
  ok('⑨无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');

  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_v15856_result.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
