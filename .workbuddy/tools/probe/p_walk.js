/* v158.19 手感取证探针（老板「走的好像老年痴呆一样」）
 * ------------------------------------------------------------
 * 量四件事，全部用数值（不靠目测）：
 *   ① 球面跟随态：按 W 推 N 帧的实际位移速度（m/s）
 *   ② 球面跟随态：按 A 推 N 帧的实际转向速率（°/s）
 *   ③ 球面小人：走路时腿/臂的 rotation.x 是否真的在变（还是纯滑行）
 *   ④ 街区：avatar.phase 的增速（rad/s）与位移速度是否匹配（步幅 = v / 步频）
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pwalk';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const FPS = 60, DT = 1 / FPS;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '手感', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2200);

  /* 先落到一块非城格，避免自动进街区 */
  const prep = await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere;
    const c = G.state.cities[0];
    const cityCis = {}; (G.state.cities || []).forEach((x) => { cityCis[x.ci] = 1; });
    let far = -1, best = Infinity;
    for (let i = 0; i < SP.cells.length; i += 5) {
      const cc = SP.cells[i]; if (!cc || cc.type === 'city' || cityCis[i]) continue;
      const d = cc.dir[0] * SP.cells[c.ci].dir[0] + cc.dir[1] * SP.cells[c.ci].dir[1] + cc.dir[2] * SP.cells[c.ci].dir[2];
      if (d < best) { best = d; far = i; }
    }
    M.teleportTo(far);
    M.setFollow(true);
    return { ci: far, WALK_SPEED: M.WALK_SPEED, FOLLOW: M.FOLLOW };
  });
  console.log('  ——  前置  [' + JSON.stringify(prep) + ']');

  /* ① 按 W 推 60 帧：量位移 */
  const walk = await p.evaluate((n) => {
    const G = GAME, M = G.map3d;
    const a0 = M.playerPose();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { G._keys = { w: 1 }; M.stepAvatar(1 / 60, G._keys); }
    G._keys = {};
    const a1 = M.playerPose();
    /* 球面弧长：夹角 × R */
    const dot = Math.max(-1, Math.min(1, a0.dir[0] * a1.dir[0] + a0.dir[1] * a1.dir[1] + a0.dir[2] * a1.dir[2]));
    const ang = Math.acos(dot);
    const dist = ang * M.R;
    const secs = n / 60;
    return { dist: +dist.toFixed(3), secs: +secs.toFixed(3), mps: +(dist / secs).toFixed(3), R: M.R };
  }, 60);
  console.log('  ——  ① 球面按 W 1 秒  [' + JSON.stringify(walk) + ']');

  /* ② 按 A 推 60 帧：量转向 */
  const turn = await p.evaluate((n) => {
    const G = GAME, M = G.map3d;
    const y0 = (M.playerPose() || {}).yaw || 0;
    for (let i = 0; i < n; i++) { G._keys = { a: 1 }; M.stepAvatar(1 / 60, G._keys); }
    G._keys = {};
    const y1 = (M.playerPose() || {}).yaw || 0;
    const secs = n / 60;
    const deg = ((y1 - y0) * 180 / Math.PI);
    return { deg: +deg.toFixed(2), secs: +secs.toFixed(3), dps: +(deg / secs).toFixed(2),
      deg90Sec: +(90 / Math.abs(deg / secs)).toFixed(3) };
  }, 60);
  console.log('  ——  ② 球面按 A 1 秒  [' + JSON.stringify(turn) + ']');

  /* ③ 球面小人：摆腿相位是否真的在推进（figureOf 只给数据，phase 是唯一可读证据） */
  const legs = await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    const step = (n, keys) => {
      for (let i = 0; i < n; i++) {
        G._keys = keys;
        const o = M.stepAvatar(1 / 60, keys);
        M.followAvatar(1 / 60, o);
      }
    };
    const ph0 = M._figPhase || 0;
    step(10, { w: 1 }); const ph1 = M._figPhase || 0;
    step(10, { w: 1 }); const ph2 = M._figPhase || 0;
    const walkingFlag = (M.figureOf('stand') || {}).walking;
    step(1, {}); const phStop = M._figPhase || 0;
    const walkingAfterStop = (M.figureOf('stand') || {}).walking;
    return { ph0: +ph0.toFixed(2), ph1: +ph1.toFixed(2), ph2: +ph2.toFixed(2),
      advanced: ph1 > ph0 && ph2 > ph1, walkingFlag: walkingFlag,
      phStop: +phStop.toFixed(2), walkingAfterStop: walkingAfterStop };
  });
  console.log('  ——  ③ 球面小人摆腿相位  [' + JSON.stringify(legs) + ']');
  console.log('     ' + (legs.advanced ? '✅' : '❌') + ' 走时相位推进 · '
    + (legs.walkingFlag ? '✅' : '❌') + ' walking=true · '
    + (legs.phStop === 0 ? '✅' : '❌') + ' 停下归零');

  /* ④ 进街区：phase 增速 + 位移速度 */
  const dist = await p.evaluate(() => {
    const G = GAME, M = G.map3d, D = G.district;
    const c = G.state.cities[0];
    /* 站到城格 → 自动落街区 */
    M.teleportTo(c.ci);
    try { D.enter(c.ci, c); } catch (e) { }
    if (!D.active) return { err: 'district not active' };
    const ph0 = D.avatar ? D.avatar.phase : null;
    const z0 = D.pos.z;
    /* D.tick 用 Date.now() 算 dt —— 循环里连续调用会得到 dt≈0。
       这里每次把时钟回拨 16.7ms，保证每拍都是真 1/60 秒（60 拍 = 1 秒）。 */
    for (let i = 0; i < 60; i++) { D.keys = { w: 1 }; D._clock = Date.now() - 16.7; D.tick(); }
    D.keys = {};
    const ph1 = D.avatar ? D.avatar.phase : null;
    const z1 = D.pos.z;
    const secs = 1;
    const dz = Math.abs(z1 - z0);
    /* 一步 = π 相位（sin 一个 2π 周期是左右各一步），不是 2π —— 首版算错过一次。 */
    return { dPhase: +(ph1 - ph0).toFixed(2), steps: +((ph1 - ph0) / Math.PI).toFixed(2),
      disp: +dz.toFixed(3), mps: +dz.toFixed(3),
      stride: +(dz / Math.max(0.01, (ph1 - ph0) / Math.PI)).toFixed(3),
      walkSpeed: M.WALK_SPEED };
  });
  console.log('  ——  ④ 街区 1 秒  [' + JSON.stringify(dist) + ']');

  console.log('');
  console.log('  真人基准：步行 1.3-1.5 m/s · 转身 90° 约 0.5s（180°/s）· 步幅 0.7-0.8m · 步频 1.8-2.0 步/s');
  console.log('  运行时错误：' + JSON.stringify(errs.slice(0, 4)));
  await p.screenshot({ path: OUT + '/walk.png' });
  await b.close();
  process.exit(0);
})();
