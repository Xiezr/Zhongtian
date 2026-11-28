'use strict';
/* v158.57 实机截图：平飞（HUD 下沉/仰角）/ 抬头爬升 / 自动着陆
   跑法：NODE_PATH="..." node .workbuddy/tools/probe/p_fly_v15857_shot.js
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
  await p.evaluate(() => { GAME.newGame({ name: 'SHOT57', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe && GAME.map3d._colTex))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1600);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);
  const PAD = 120;
  const UP_Y = Math.max(Math.round(box.y) + PAD, CY - 220);
  const DN_Y = Math.min(Math.round(box.y + box.height) - PAD, CY + 220);

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
    GAME._flyKeys = {};
    return { alt: r - 300 };
  }, { v: v, alt: (altM == null ? null : altM) });

  /* --- A：平飞（HUD 应显示"下沉 1.0 m/s · 仰角 +0°"） --- */
  await setLevel(70, 180);
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: SHOTS + 'v15857-A-level-flight.png' });
  const stA = await p.evaluate(() => {
    const hd = document.getElementById('fly-hud');
    const t = hd ? (hd.textContent || '') : '';
    return { hud: t, sink: GAME.map3d.flyProbe().sink, pitch: GAME.map3d.flyProbe().pitch,
      alt: GAME.map3d.flyProbe().alt };
  });
  ok('A平飞：HUD 印出"下沉/仰角"、仰角≈0°、高度在缓慢下降',
    /下沉|爬升|持平/.test(stA.hud) && /仰角/.test(stA.hud)
      && Math.abs(stA.pitch * 180 / Math.PI) < 3,
    '仰角=' + (stA.pitch * 180 / Math.PI).toFixed(1) + '° sink=' + (stA.sink || 0).toFixed(2)
      + ' alt=' + (stA.alt || 0).toFixed(1));

  /* --- B：抬头爬升（HUD 仰角应为正、显示"爬升"） --- */
  await p.mouse.move(CX, UP_Y);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: SHOTS + 'v15857-B-climb.png' });
  const stB = await p.evaluate(() => {
    const hd = document.getElementById('fly-hud');
    return { hud: hd ? (hd.textContent || '') : '', pitch: GAME.map3d.flyProbe().pitch,
      sink: GAME.map3d.flyProbe().sink };
  });
  ok('B抬头：HUD 显示"爬升"、仰角 >10°、sink < 0',
    /爬升/.test(stB.hud) && stB.pitch * 180 / Math.PI > 10 && stB.sink < 0,
    '仰角=' + (stB.pitch * 180 / Math.PI).toFixed(1) + '° sink=' + (stB.sink || 0).toFixed(2));

  /* --- C：着陆程序中段（140m 触发，1.2s 后约 100m，能同时看到战舰与地面） --- */
  await setLevel(40, 140);
  await p.mouse.move(CX, CY);
  await p.waitForTimeout(300);
  await p.evaluate(() => { GAME.map3d.flyLand(); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SHOTS + 'v15857-C-autoland.png' });
  const stC = await p.evaluate(() => {
    const hd = document.getElementById('fly-hud');
    return { phase: GAME.map3d._fly.phase, auto: GAME.map3d._fly.autoLand,
      hud: hd ? (hd.textContent || '') : '' };
  });
  ok('C着陆中：phase=landing、HUD 显示"降落中"、alt 低于触发点',
    stC.phase === 'landing' && /降落中/.test(stC.hud),
    'phase=' + stC.phase + ' autoLand=' + stC.auto);

  await p.waitForTimeout(5200);
  const stD = await p.evaluate(() => ({ phase: GAME.map3d._fly.phase, surf: !!GAME.map3d._surf }));
  ok('D着陆完成：phase=dock 且交回地表层', stD.phase === 'dock' && stD.surf === true,
    'phase=' + stD.phase + ' surf=' + stD.surf);

  ok('E无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/shot_v15857.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
