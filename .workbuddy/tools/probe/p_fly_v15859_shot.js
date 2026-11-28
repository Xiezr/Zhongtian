'use strict';
/* v158.59 实机截图：60m 连续空间 / 40m 同段 / 着陆后（人未出现）/ 下机后（人才出现）
   跑法：NODE_PATH="..." node .workbuddy/tools/probe/p_fly_v15859_shot.js
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
  await p.evaluate(() => { GAME.newGame({ name: 'SHOT59', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
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

  const shot = async (name) => p.screenshot({ path: SHOTS + name });

  /* --- A：60m（区间上沿） --- */
  await setLevel(26, 60);
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(1100);
  await shot('v15859-A-alt60.png');
  const A = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt, surf: !!GAME.map3d._surf,
    fade: GAME.map3d._surfFade ? GAME.map3d._surfFade() : -1 }));
  ok('A 60m：仍在飞行态（_surf=false）、地表层半实渐入',
    A.surf === false && A.fade > 0.1 && A.fade < 0.9,
    'alt=' + (A.alt || 0).toFixed(1) + ' surf=' + A.surf + ' fade=' + A.fade.toFixed(2));

  /* --- B：40m（区间下沿，同一段） --- */
  await setLevel(26, 40);
  await p.waitForTimeout(1100);
  await shot('v15859-B-alt40.png');
  const B = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt, surf: !!GAME.map3d._surf,
    fade: GAME.map3d._surfFade ? GAME.map3d._surfFade() : -1 }));
  ok('B 40m：同段仍飞行态、地表层已接近全实（无模式切换）',
    B.surf === false && B.fade > A.fade,
    'alt=' + (B.alt || 0).toFixed(1) + ' surf=' + B.surf + ' fade=' + B.fade.toFixed(2));

  /* --- C：着陆后（人未出现） --- */
  await setLevel(26, 120);
  await p.mouse.move(CX, CY); await p.waitForTimeout(200);
  await p.evaluate(() => { GAME.map3d.flyLand(); });
  for (let i = 0; i < 90; i++) {
    if (await p.evaluate(() => GAME.map3d._fly.phase === 'landed')) break;
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(400);
  await shot('v15859-C-landed.png');
  const C = await p.evaluate(() => ({
    phase: GAME.map3d._fly.phase, surf: !!GAME.map3d._surf,
    ship: !!(GAME.map3d._shipMesh && GAME.map3d._shipMesh.visible),
    hud: (document.getElementById('fly-hud') || {}).textContent || ''
  }));
  ok('C 着陆后：飞行器停在地上可见、**人还没出现**（_surf 仍 false）、HUD 提示下机',
    C.phase === 'landed' && C.surf === false && C.ship === true && /已着陆/.test(C.hud),
    'phase=' + C.phase + ' surf=' + C.surf + ' 飞行器=' + C.ship);

  /* --- D：下机后（人才出现） --- */
  await p.evaluate(() => { GAME.map3d.flyExit(); });
  await p.waitForTimeout(1400);
  await shot('v15859-D-exited.png');
  const D = await p.evaluate(() => ({
    surf: !!GAME.map3d._surf, active: !!GAME.map3d._fly.active,
    ship: !!(GAME.map3d._shipMesh && GAME.map3d._shipMesh.visible),
    phase: GAME.map3d._fly.phase
  }));
  ok('D 下机后：进地表层（人出现）、飞行器收起',
    D.surf === true && D.active === false && D.ship === false && D.phase === 'dock',
    'surf=' + D.surf + ' active=' + D.active + ' 飞行器=' + D.ship + ' phase=' + D.phase);

  ok('E无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/shot_v15859.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
