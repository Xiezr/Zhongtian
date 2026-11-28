'use strict';
/* v158.58 实机截图：巡航 / 按 A 转向瞬间（飞行器应偏出画面中心）/ 松手后追上
   跑法：NODE_PATH="..." node .workbuddy/tools/probe/p_fly_v15858_shot.js
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const SHOTS = ROOT + '/.workbuddy/shots/';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const L = []; const log = (s) => { L.push(String(s)); console.log(s); };
let pass = 0, fail = 0;
function ok(n, c, d) { log((c ? '✅' : '❌') + ' ' + n + (d ? ' · ' + d : '')); c ? pass++ : fail++; }

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'SHOT58', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe && GAME.map3d._colTex))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1600);
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

  /* 战舰位置**恒定居中**（机位吊在滞后尾向的正后方），所以"转向看得见"
     体现为**机头相对相机视向偏出**：量 camTail 与 −head 的夹角。
     战舰在屏幕上的水平位移是 0 —— 那是设计，不是没转向。 */
  const proj = async () => p.evaluate(() => {
    const M = GAME.map3d, f = M._fly, cam = M._cam;
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(f.pos[0], f.pos[1], f.pos[2]).project(cam);
    const h = f.head, ct = f.camTail || [0, 0, 0];
    const dot = h[0] * (-ct[0]) + h[1] * (-ct[1]) + h[2] * (-ct[2]);
    return { ndcX: v.x, screenY: (1 - v.y) / 2,
      offDeg: Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI };
  });

  /* --- A：直飞（战舰应在正中） --- */
  await setLevel(50, 190);
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SHOTS + 'v15858-A-straight.png' });
  const A = await proj();
  ok('A直飞：战舰水平居中（|ndcX|<0.05）、在下 2/5',
    Math.abs(A.ndcX) < 0.05 && A.screenY > 0.60 && A.screenY < 0.72,
    'ndcX=' + A.ndcX.toFixed(3) + ' screenY=' + A.screenY.toFixed(3));

  /* --- B：按住 A 0.45s（飞行器应偏出画面、相机还没跟上） --- */
  await p.keyboard.down('a');
  await p.waitForTimeout(450);
  const B = await proj();
  await p.screenshot({ path: SHOTS + 'v15858-B-turning.png' });
  await p.keyboard.up('a');
  ok('B按 A 转向瞬间：机头相对相机视向偏出 ≥12°（转向看得见）、位置仍居中',
    B.offDeg >= 12 && Math.abs(B.ndcX) < 0.05,
    '机头偏出=' + B.offDeg.toFixed(1) + '° 直飞时=' + A.offDeg.toFixed(1) + '° ndcX=' + B.ndcX.toFixed(3));

  /* --- C：松手 1.6s 后（相机追上，战舰回中心） --- */
  await p.waitForTimeout(1600);
  await p.screenshot({ path: SHOTS + 'v15858-C-settled.png' });
  const C = await proj();
  ok('C松手后相机追上：机头偏出回落到 <5°、位置仍居中',
    C.offDeg < 5 && Math.abs(C.ndcX) < 0.06,
    'ndcX=' + C.ndcX.toFixed(3) + ' screenY=' + C.screenY.toFixed(3));

  ok('D无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/shot_v15858.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
