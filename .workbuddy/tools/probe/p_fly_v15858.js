'use strict';
/* v158.58 行为探针 —— 老板：「AD 不再改变相机朝向，而是改变飞行器方向」
   ------------------------------------------------------------
   旧行为：A/D = 横滚 + 一点点协调转弯（0.75 rad/s），且机位 = shipPos − head×26，
   head 一转相机立刻绕过去 → 画面跟着转，看着像"世界在转"。
   新行为：
     ① A/D 真改飞行器方向：A 左、D 右（偏航 1.5 rad/s）；
     ② 相机尾向 camTail 滞后跟随（2.2 rad/s > 1.5，会追上但不瞬间到），
        所以转向瞬间**飞行器在画面里先偏出去**；
     ③ 松手后相机追上（残差收敛）；
     ④ A/D 接管方向时清掉鼠标指示；
     ⑤ 相机落点不变（screenY 0.66、水平居中）。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15858.js
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

  /* ---------- ⓪ 源码结构 ---------- */
  const S = [
    ['FLY_YAW_RATE 在册', /M\.FLY_YAW_RATE = 1\.5;/.test(src)],
    ['FLY_CAM_TURN 在册', /M\.FLY_CAM_TURN = 4\.0;/.test(src)],
    ['FLY_BANK_TURN 退役', !/M\.FLY_BANK_TURN\s*=/.test(src)],
    ['A=左转符号', /var _yawDir = a \? 1 : -1;/.test(src)],
    ['偏航用 YAW_RATE', /head\.applyAxisAngle\(radial, _yawDir \* \(M\.FLY_YAW_RATE \|\| 1\.5\) \* dt\)/.test(src)],
    ['A-D 清 aim', /fly\.aim = null; fly\.aimPitch = null;\s*\n\s*\} else \{/.test(src)],
    ['camTail 一阶跟随', /var _kC = \(M\.FLY_CAM_TURN \|\| 4\.0\) \* _dtC;/.test(src)],
    ['机位用 camTail', /addScaledVector\(_tailV, \(M\.FLY_CAM_BACK \|\| 26\)\)/.test(src)],
    ['camTail 切平面投影', /_want\.addScaledVector\(radial, -_want\.dot\(radial\)\);/.test(src)]
  ];
  const bad0 = S.filter((x) => !x[1]).map((x) => x[0]);
  ok('⓪源码结构锁 9 条（A/D 偏航 / 相机滞后 / BANK_TURN 退役）',
    bad0.length === 0, bad0.length ? ('缺: ' + bad0.join(', ')) : '9/9');

  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V1458', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1200);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);

  const setLevel = async (v, altM) => p.evaluate((arg) => {
    const M = GAME.map3d, f = M._fly;
    if (M._surf) { try { M.surfaceMode(false); } catch (e) { } }
    let pos = f.pos || [0, 300, 0], r = Math.hypot(pos[0], pos[1], pos[2]);
    if (!(r > 1)) { pos = [0, 300, 0]; r = 300; }
    if (arg.alt != null) { const k = (300 + arg.alt) / r; pos = [pos[0] * k, pos[1] * k, pos[2] * k]; r = 300 + arg.alt; }
    const rad = pos.map((x) => x / r);
    let t = [rad[1] * 0 - rad[2], 0, rad[0]];
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    t = t.map((x) => x / tl);
    f.pos = pos.slice(); f.head = t.slice(); f.vel = t.slice(); f.up = rad.slice();
    f.v = arg.v; f.aim = null; f.aimPitch = null; f.pitch = 0;
    f.holdR = r; f.sink = 0; f.autoLand = 0; f.active = true; f.phase = 'cruise'; f.phaseT = 0;
    f.camTail = [-t[0], -t[1], -t[2]];
    GAME._flyKeys = {};
    return { alt: r - 300 };
  }, { v: v, alt: (altM == null ? null : altM) });

  /* 采样：head 相对初始 right 的偏转、camTail 与 -head 的夹角、屏幕位置 */
  const sample = async () => p.evaluate(() => {
    const M = GAME.map3d, f = M._fly, cam = M._cam;
    const pos = f.pos, r = Math.hypot(pos[0], pos[1], pos[2]);
    const rad = pos.map((x) => x / r);
    const head = f.head.slice();
    const right = [head[1] * rad[2] - head[2] * rad[1],
      head[2] * rad[0] - head[0] * rad[2],
      head[0] * rad[1] - head[1] * rad[0]];
    const ct = f.camTail ? f.camTail.slice() : null;
    const negHead = [-head[0], -head[1], -head[2]];
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(pos[0], pos[1], pos[2]).project(cam);
    return { head, rad, right, camTail: ct, negHead,
      screenY: (1 - v.y) / 2, ndcX: v.x,
      aim: f.aim ? f.aim.slice() : null };
  });

  /* ---------- ① A = 左转、D = 右转 ---------- */
  await setLevel(0, 200);
  const s0 = await sample();
  await p.keyboard.down('a');
  await p.waitForTimeout(900);
  const sA = await sample();
  await p.keyboard.up('a');
  /* head 在初始 right 上的分量：左偏=负 */
  const aSide = sA.head[0] * s0.right[0] + sA.head[1] * s0.right[1] + sA.head[2] * s0.right[2];
  ok('①A 键让飞行器**左转**（新机头在初始 right 上分量为负、偏转 ≥30°）',
    aSide < -0.3 && ang(s0.head, sA.head) >= 30,
    '偏转=' + ang(s0.head, sA.head).toFixed(1) + '° right分量=' + aSide.toFixed(3));

  await setLevel(0, 200);
  const s1 = await sample();
  await p.keyboard.down('d');
  await p.waitForTimeout(900);
  const sD = await sample();
  await p.keyboard.up('d');
  const dSide = sD.head[0] * s1.right[0] + sD.head[1] * s1.right[1] + sD.head[2] * s1.right[2];
  ok('①b D 键让飞行器**右转**（right 分量为正、偏转 ≥30°）',
    dSide > 0.3 && ang(s1.head, sD.head) >= 30,
    '偏转=' + ang(s1.head, sD.head).toFixed(1) + '° right分量=' + dSide.toFixed(3));

  /* ---------- ② 相机滞后：转向瞬间 camTail 明显落后于 -head ---------- */
  await setLevel(0, 200);
  await p.keyboard.down('a');
  await p.waitForTimeout(700);
  const sLag = await sample();
  await p.keyboard.up('a');
  const lagDeg = sLag.camTail ? ang(sLag.camTail, sLag.negHead) : 0;
  ok('②转向瞬间相机尾向滞后 ≥8°（飞行器先偏出去，转向才看得见）',
    lagDeg >= 8, 'camTail↔−head=' + lagDeg.toFixed(1) + '°');

  /* ---------- ③ 松手后相机追上 ---------- */
  await p.waitForTimeout(1500);
  const sCatch = await sample();
  const catchDeg = sCatch.camTail ? ang(sCatch.camTail, sCatch.negHead) : 999;
  ok('③松手 1.5s 后相机追上机尾（残差 <6°）',
    catchDeg < 6, '残差=' + catchDeg.toFixed(1) + '°');

  /* ---------- ④ A/D 接管时清掉鼠标指示 ---------- */
  await setLevel(0, 200);
  await p.mouse.move(CX, CY); await p.waitForTimeout(120);
  await p.mouse.move(CX + 280, CY - 120);   /* 产生 aim */
  await p.waitForTimeout(300);
  const aimBefore = await p.evaluate(() => !!GAME.map3d._fly.aim);
  await p.keyboard.down('a');
  await p.waitForTimeout(260);
  const aimAfter = await p.evaluate(() => !!GAME.map3d._fly.aim);
  await p.keyboard.up('a');
  ok('④A/D 接管方向时清掉鼠标指示（否则下一帧 aim 会把机头拉回去）',
    aimBefore === true && aimAfter === false, 'aim ' + aimBefore + ' → ' + aimAfter);

  /* ---------- ⑤ 相机落点没被打破 ---------- */
  await setLevel(60, 200);
  await p.mouse.move(CX, CY); await p.waitForTimeout(200);
  const sPos = await sample();
  ok('⑤相机落点不变：战舰仍在屏幕下 2/5、水平居中（screenY 0.60~0.72、|ndcX|<0.05）',
    sPos.screenY > 0.60 && sPos.screenY < 0.72 && Math.abs(sPos.ndcX) < 0.05,
    'screenY=' + sPos.screenY.toFixed(3) + ' ndcX=' + sPos.ndcX.toFixed(3));

  /* ---------- ⑥ 无异常 ---------- */
  ok('⑥无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');

  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_v15858_result.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
