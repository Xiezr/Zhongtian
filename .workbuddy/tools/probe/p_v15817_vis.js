/* 视觉核对：街区里主角的**屏幕占比**与外观（数值 + 截图）
 * 判据：1.72m 的人在 6.85m 处、fov=50 → 约占画面高度 27%。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/p15817';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '玩家', cityName: '灰岗', mapSeed: 20261125 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2600);

  const m = await p.evaluate(() => {
    const G = GAME, M = G.map3d, D = G.district, c = G.state.cities[0];
    M.teleportTo(c.ci); M.setFollow(true);
    for (let i = 0; i < 40; i++) { try { D.tick(); } catch (e) { } }
    /* 站到街心、朝北（面向衙门）—— 比出生点更能看清人与建筑的比例 */
    D.pos.x = 0; D.pos.z = 6; D.yaw = 0;
    for (let i = 0; i < 3; i++) { try { D.tick(); } catch (e) { } }
    try { D.camera(); } catch (e) { }
    const cam = M._cam;
    const a = D.avatarOf();
    /* 头顶 / 脚底 都投到屏幕，算屏幕占比（canvas 高度像素） */
    const top = D.world(D.frame, D.pos.x, 1.21 * D.AVATAR_SCALE, D.pos.z);
    const bot = D.world(D.frame, D.pos.x, 0, D.pos.z);
    const pv = new THREE.Vector3(top[0], top[1], top[2]).project(cam);
    const bv = new THREE.Vector3(bot[0], bot[1], bot[2]).project(cam);
    /* 最大的那个 canvas 就是 3D 视口 */
    let cv = null, bestA = 0;
    document.querySelectorAll('canvas').forEach(function (e) {
      const ar = e.clientWidth * e.clientHeight;
      if (ar > bestA) { bestA = ar; cv = e; }
    });
    const hpx = cv ? cv.clientHeight : 0;
    const frac = Math.abs((pv.y - bv.y) / 2);
    return { avatar: a, t: +D.t.toFixed(2), heightM: +(1.21 * D.AVATAR_SCALE).toFixed(2),
      frac: +frac.toFixed(3), px: Math.round(frac * hpx), canvasH: hpx,
      ndcTop: [+pv.x.toFixed(2), +pv.y.toFixed(2)], ndcBot: [+bv.x.toFixed(2), +bv.y.toFixed(2)] };
  });
  console.log('主角屏幕占比', JSON.stringify(m));
  await p.screenshot({ path: OUT + '/20_street_me.png' });

  /* 第二张：往南走到门口（看门/墙有没有画出来） */
  await p.evaluate(() => {
    const D = GAME.district;
    D.pos.x = 0; D.pos.z = D.plan.hd - 3.5; D.yaw = Math.PI;   /* 背对衙门、面向南门 */
    for (let i = 0; i < 3; i++) { try { D.tick(); } catch (e) { } }
    try { D.camera(); } catch (e) { }
  });
  await p.screenshot({ path: OUT + '/21_gate_view.png' });
  await b.close();
  process.exit(0);
})();
