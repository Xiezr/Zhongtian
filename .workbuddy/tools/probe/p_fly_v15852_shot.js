'use strict';
/* v158.52 实机截图：三角锥战舰自由惯性飞行（可见形体 + 尾迹 + HUD + 第三人称机位）
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15852_shot.js
   产物：.workbuddy/shots/v15852-A-ship-flight.png / v15852-B-after-turn.png */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
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

  /* A. 加速飞行 + 爬升，让战舰/尾迹/HUD 都可见 */
  await p.keyboard.down('ArrowRight');
  await p.waitForTimeout(1500);
  await p.keyboard.up('ArrowRight');
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(600);
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(500);
  const A = await p.evaluate(() => {
    const M = GAME.map3d, f = M.flyProbe();
    const hud = document.getElementById('fly-hud');
    return {
      v: +f.v.toFixed(1), alt: +f.alt.toFixed(1), trail: f.trail,
      ship: !!(M._shipMesh && M._shipMesh.visible),
      eng: !!(M._shipEngine && M._shipEngine.visible),
      trailMesh: !!(M._shipTrail && M._shipTrail.visible),
      hud: hud ? hud.style.display !== 'none' : false,
      hudTxt: hud ? hud.textContent.trim() : '',
      cam: !!M._flyCam, err: M._flErr1 || null
    };
  });
  await p.screenshot({ path: SHOTS + 'v15852-A-ship-flight.png' });
  ok('A1 战舰形体在册（三角锥 + 引擎球 + 尾迹线）', A.ship && A.eng && A.trailMesh, JSON.stringify(A));
  ok('A2 飞行 HUD 直印 ←→/↑↓/W/S/A/D', A.hud && A.hudTxt.includes('←→ 加减速') && A.hudTxt.includes('↑↓ 升降'), A.hudTxt);
  ok('A3 飞行中速度/海拔/尾迹均非平凡', A.v > 40 && A.alt > 100 && A.trail > 5 && !A.err,
    'v=' + A.v + ' alt=' + A.alt + ' trail=' + A.trail);

  /* B. 转向制造弧线轨迹，再截图 */
  await p.keyboard.down('KeyA');
  await p.waitForTimeout(1200);
  await p.keyboard.up('KeyA');
  await p.waitForTimeout(400);
  const B = await p.evaluate(() => {
    const M = GAME.map3d, f = M.flyProbe();
    const cam = M._flyCam;
    let side = null, behind = null;
    if (cam && f.pos && f.head) {
      const d = [cam.pos[0] - f.pos[0], cam.pos[1] - f.pos[1], cam.pos[2] - f.pos[2]];
      behind = -(d[0] * f.head[0] + d[1] * f.head[1] + d[2] * f.head[2]);
      side = +(Math.hypot(d[0], d[1], d[2])).toFixed(2);
    }
    return { v: +f.v.toFixed(1), trail: f.trail, behind: behind == null ? null : +behind.toFixed(2),
      camDist: side, err: M._flErr1 || null };
  });
  await p.screenshot({ path: SHOTS + 'v15852-B-after-turn.png' });
  ok('B1 转向后速度恒定（无外力不衰减）', Math.abs(B.v - A.v) < 3, 'v ' + A.v + ' → ' + B.v);
  ok('B2 尾迹持续累积 + 第三人称机位在战舰后方', B.trail > A.trail && B.behind > 10, JSON.stringify(B));
  ok('B3 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('截图：' + SHOTS + 'v15852-A-ship-flight.png');
  console.log('截图：' + SHOTS + 'v15852-B-after-turn.png');
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
