'use strict';
/* v158.56 实机截图探针：巡航（鼠标指示准星 + 战舰在下方 2/5）/ 起飞 / 降落
   跑法：NODE_PATH="..." node .workbuddy/tools/probe/p_fly_v15856_shot.js
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
  await p.evaluate(() => { GAME.newGame({ name: 'SHOT56', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe && GAME.map3d._colTex))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1600);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);

  /* --- A：巡航 + 鼠标指向右上（准星 + 战舰位置） --- */
  /* 先回中心：真实玩家鼠标总在画布上；也让"从哪来"的首次派发不落在 body 上 */
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(120);
  await p.mouse.move(CX + 260, CY - 150);
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOTS + 'v15856-A-cruise-aim.png' });
  const stA = await p.evaluate(() => {
    const M = GAME.map3d, cam = M._cam, f = M._fly;
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(f.pos[0], f.pos[1], f.pos[2]).project(cam);
    const cx = document.getElementById('fly-cross');
    const hd = document.getElementById('fly-hud');
    return { screenY: (1 - v.y) / 2, ndcX: v.x, aim: !!f.aim,
      cross: !!cx, crossDisp: cx ? cx.style.display : 'no-el',
      hudDisp: hd ? hd.style.display : 'no-el',
      hud: hd ? (hd.textContent || '') : '' };
  });
  ok('A巡航：准星在册且显示、HUD 有新键位、战舰 screenY∈[0.60,0.72]',
    stA.cross && stA.crossDisp === 'block' && stA.aim
      && /加减速/.test(stA.hud) && /空格 起降/.test(stA.hud)
      && stA.screenY > 0.60 && stA.screenY < 0.72,
    'screenY=' + stA.screenY.toFixed(3) + ' ndcX=' + stA.ndcX.toFixed(3)
      + ' cross=' + stA.crossDisp + ' hud=' + stA.hudDisp
      + ' aim=' + stA.aim + ' txt=' + stA.hud.slice(0, 40));

  /* --- B：起飞程序（地表 → 爬升中） --- */
  await p.evaluate(() => { GAME.map3d.surfaceMode(true); });
  await p.waitForTimeout(600);
  await p.mouse.move(CX, CY);
  await p.evaluate(() => { GAME.map3d.flyToggle(); });
  await p.waitForTimeout(1100);
  const stB = await p.evaluate(() => ({
    phase: GAME.map3d._fly.phase, v: GAME.map3d._fly.v,
    alt: GAME.map3d.flyProbe().alt,
    hud: (document.getElementById('fly-hud') || {}).innerText || ''
  }));
  await p.screenshot({ path: SHOTS + 'v15856-B-takeoff.png' });
  ok('B起飞中：phase=takeoff、速度在爬、HUD 显示「起飞中」',
    stB.phase === 'takeoff' && stB.v > 5 && /起飞中/.test(stB.hud),
    'phase=' + stB.phase + ' v=' + (stB.v || 0).toFixed(1) + ' alt=' + (stB.alt || 0).toFixed(1));

  /* --- C：巡航稳定后（等程序结束） --- */
  await p.waitForTimeout(2200);
  const stC0 = await p.evaluate(() => ({ phase: GAME.map3d._fly.phase, alt: GAME.map3d.flyProbe().alt }));
  await p.mouse.move(CX - 200, CY - 90);
  await p.waitForTimeout(800);
  await p.screenshot({ path: SHOTS + 'v15856-C-cruise.png' });
  ok('C起飞结束：phase=cruise、alt>60m、准星仍工作',
    stC0.phase === 'cruise' && stC0.alt > 60,
    'phase=' + stC0.phase + ' alt=' + (stC0.alt || 0).toFixed(1));

  /* --- D：降落程序（下降中） --- */
  const altD0 = await p.evaluate(() => GAME.map3d.flyProbe().alt);
  await p.evaluate(() => { GAME.map3d.flyToggle(); });
  await p.waitForTimeout(1500);
  const stD = await p.evaluate(() => {
    const hd = document.getElementById('fly-hud');
    return { phase: GAME.map3d._fly.phase, alt: GAME.map3d.flyProbe().alt,
      hud: hd ? (hd.textContent || '') : '' };
  });
  await p.screenshot({ path: SHOTS + 'v15856-D-landing.png' });
  ok('D降落中：phase=landing、高度低于触发点、HUD 显示「降落中」',
    stD.phase === 'landing' && stD.alt < altD0 && /降落中/.test(stD.hud),
    'phase=' + stD.phase + ' alt ' + (altD0 || 0).toFixed(1) + '→' + (stD.alt || 0).toFixed(1)
      + ' hud=' + (stD.hud ? stD.hud.slice(0, 24) : 'no-el'));

  await p.waitForTimeout(2600);
  const stE = await p.evaluate(() => ({ phase: GAME.map3d._fly.phase, surf: !!GAME.map3d._surf }));
  await p.screenshot({ path: SHOTS + 'v15856-E-landed.png' });
  ok('E落地：phase=dock 且已交回地表层(_surf=true)', stE.phase === 'dock' && stE.surf === true,
    'phase=' + stE.phase + ' surf=' + stE.surf);

  ok('F无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/shot_v15856.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
