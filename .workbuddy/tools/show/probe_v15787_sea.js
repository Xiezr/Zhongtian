/* v157.87 海面场景取证：
   ① 打开水域格 → 是否换成透视相机 + 自带海面
   ② 截图（近景 / 拖动后 / 俯视）
   ③ 人站的高度是否 = CPU 浪高（同一函数）
   ④ 拖动是否只转镜头、不让人乱走；滚轮是否改远近
   ⑤ WASD 是否相机相对（W 永远往画面里走） */
const { chromium } = require('playwright-core');
const OUT = '.workbuddy/tmp/';
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 200)); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });

  const boot = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '海试', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    st.world.elapsed = 12 * 3600;   /* 固定在**白天**取证：夜里看不出发色 */
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
    /* 找一个水域格（lake） */
    var SP = G.sphere, ci = -1;
    for (var i = 0; i < SP.cells.length; i++) {
      if (SP.cells[i] && SP.cells[i].type === 'lake') { ci = i; break; }
    }
    window.__ci = ci;
    var r = G.scene3d.open('lake', {
      ci: ci, actId: 'lake_scene', terrain: 'lake',
      availableActs: ['lake_scene', 'cai', 'xiu'], live: true
    });
    return { ok: r.ok, scene: r.scene, name: r.name, ci: ci };
  });
  console.log('open = ' + JSON.stringify(boot));

  await p.waitForTimeout(4000);   /* 等骨骼角色 + 首帧 */
  const s1 = await p.evaluate(() => window.GAME.scene3d._sea());
  console.log('state1 = ' + JSON.stringify(s1));
  await p.screenshot({ path: OUT + 'v15787_sea_start.png' });

  /* ② 拖动转镜头（应只转不改位置） */
  const before = await p.evaluate(() => window.GAME.scene3d._sea());
  const box = await p.evaluate(() => {
    const c = document.querySelector('#scene-layer canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.55);
  await p.mouse.down();
  for (let i = 0; i < 12; i++) {
    await p.mouse.move(box.x + box.w * 0.5 - i * 14, box.y + box.h * 0.55 + i * 3);
    await p.waitForTimeout(16);
  }
  await p.mouse.up();
  await p.waitForTimeout(600);
  const afterDrag = await p.evaluate(() => window.GAME.scene3d._sea());
  console.log('drag: yaw ' + before.yaw + ' → ' + afterDrag.yaw
    + ' · pitch ' + before.pitch + ' → ' + afterDrag.pitch
    + ' · 位置移动 ' + Math.abs(afterDrag.player[0] - before.player[0]).toFixed(3)
    + ',' + Math.abs(afterDrag.player[2] - before.player[2]).toFixed(3));
  await p.screenshot({ path: OUT + 'v15787_sea_drag.png' });

  /* ③ 滚轮改远近 */
  await p.mouse.wheel(0, -420);
  await p.waitForTimeout(500);
  const afterWheel = await p.evaluate(() => window.GAME.scene3d._sea());
  console.log('wheel: dist ' + afterDrag.dist + ' → ' + afterWheel.dist);

  /* ④ WASD 相机相对 + 站在浪上 */
  const posA = await p.evaluate(() => window.GAME.scene3d._sea());
  await p.keyboard.down('w');
  await p.waitForTimeout(1100);
  await p.keyboard.up('w');
  await p.waitForTimeout(300);
  const posB = await p.evaluate(() => window.GAME.scene3d._sea());
  const dx = posB.player[0] - posA.player[0], dz = posB.player[2] - posA.player[2];
  console.log('walk: Δ=(' + dx.toFixed(2) + ',' + dz.toFixed(2) + ') 长度 ' + Math.hypot(dx, dz).toFixed(2)
    + ' · 玩家 y ' + posB.player[1] + ' vs 浪高 ' + posB.waveAtPlayer
    + ' · Δy ' + (posB.player[1] - posB.waveAtPlayer).toFixed(3));
  /* 相机朝向的前方（-sin yaw, -cos yaw）与位移方向是否同向 */
  const fx = -Math.sin(posB.yaw), fz = -Math.cos(posB.yaw);
  const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
  console.log('W 与镜头前方同向度 = ' + dot.toFixed(3) + '（应≈1）');
  await p.screenshot({ path: OUT + 'v15787_sea_walk.png' });

  /* ⑤ 拉高俯视一张（看海面纹理/军舰） */
  await p.evaluate(function () {
    var M = window.GAME.scene3d;
    /* 直接改内部参数没有出口，用滚轮语义代替：连滚几下 */
  });
  await p.mouse.wheel(0, 900);
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'v15787_sea_far.png' });
  const sFar = await p.evaluate(() => window.GAME.scene3d._sea());
  console.log('far = ' + JSON.stringify(sFar));

  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  const pass = boot.ok && s1.on && s1.persp && s1.oceanVerts > 10000 && s1.ships === 3
    && Math.abs(posB.player[1] - posB.waveAtPlayer - 0.10) < 0.03
    && Math.hypot(dx, dz) > 3 && dot > 0.85
    && Math.abs(afterDrag.player[0] - before.player[0]) < 0.05
    && errs.length === 0;
  console.log('SEA_PROBE_' + (pass ? 'PASS' : 'FAIL'));
  await b.close();
})();
