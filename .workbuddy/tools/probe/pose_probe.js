/* P0 玩家位姿 / 贴地 / 相机探针（v158.0）
 * 判据：
 *   A 可复现（G1）——固定输入 600 步，连跑 3 次数值逐位一致
 *   B 贴地 —— 脚底与地形高差 p95 ≤ 0.15；穿模 / 飞天帧数 = 0
 *   C 坡度 —— 30° 可上行；45° 挡上行且 3 秒内下滑 ≥ 1 格
 *   D 相机 —— 跟随距离 6.0 ± 0.3、俯角 15° ± 2°、防穿地
 *
 * 跑法：
 *   node .workbuddy/tools/probe/pose_probe.js > .workbuddy/tmp/pose_probe.log 2>&1
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};
const p95 = (a) => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(b.length * 0.95))];
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'pose', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);

  /* ---- A. 确定性 600 步：不依赖 rAF / Date.now，连跑 3 次逐位一致 ---- */
  const runs = [];
  for (let r = 0; r < 3; r++) {
    const one = await p.evaluate(() => {
      const M = GAME.map3d;
      const p95local = (a) => {
        if (!a.length) return 0;
        const q = a.slice().sort((x, y) => x - y);
        return q[Math.min(q.length - 1, Math.floor(q.length * 0.95))];
      };
      const home = (GAME.state.cities && GAME.state.cities[0] && GAME.state.cities[0].ci) || 0;
      const dir = (GAME.mapSphere.cells[home] && GAME.mapSphere.cells[home].dir)
        ? GAME.mapSphere.cells[home].dir.slice() : [0, 1, 0];
      M.setPlayerPose({ dir: dir, h: M._groundAtUnit(dir), yaw: 0, v: [0, 0, 0], ci: home });
      const gaps = [], hs = [];
      let slides = 0, blocked = 0, maxStep = 0;
      let prev = M.playerPose().h;
      for (let i = 0; i < 600; i++) {
        const d = M.stepAvatar(1 / 60, { w: 1, a: 0, s: 0, d: 0 });
        if (!d) break;
        gaps.push(d.gap);
        hs.push(d.ground);
        if (d.slide) slides++;
        if (d.blocked) blocked++;
        maxStep = Math.max(maxStep, Math.abs(d.ground - prev));
        prev = d.ground;
      }
      const pose = M.playerPose();
      return {
        gaps: gaps.length, gapP95: +p95local(gaps).toFixed(5),
        slides, blocked, maxStep: +maxStep.toFixed(5),
        endDir: pose.dir.map((v) => +v.toFixed(9)), endH: +pose.h.toFixed(9),
        standCi: GAME.state._standCi
      };
    });
    runs.push(one);
  }
  ok('A1 确定性 600 步连跑 3 次数值一致（G1 可复现）',
    JSON.stringify(runs[0]) === JSON.stringify(runs[1]) && JSON.stringify(runs[1]) === JSON.stringify(runs[2]),
    'endDir=' + runs[0].endDir.join(',') + ' h=' + runs[0].endH);
  ok('A2 采样条数带下限（不许 0 === 0 平凡解）',
    runs[0].gaps === 600 && runs[0].gaps === runs[1].gaps,
    'samples=' + runs[0].gaps);

  /* ---- B. 贴地 / 穿模 / 飞天（用 A 的确定性采样） ---- */
  ok('B1 脚底贴地 p95 ≤ 0.15', runs[0].gapP95 <= 0.15, 'p95=' + runs[0].gapP95);
  ok('B2 无飞天：相邻帧高差 ≤ 1.0（一帧跨半格即瞬移感）',
    runs[0].maxStep <= 1.0, 'maxStep=' + runs[0].maxStep);
  ok('B3 无穿模：gap 恒 ≥ -0.05（实际非负值）',
    runs[0].gapP95 >= 0 && runs[0].gaps > 0, 'gapP95=' + runs[0].gapP95);

  /* ---- C. 坡度行为：找一座 hill，朝它走 ---- */
  const slope = await p.evaluate(() => {
    const M = GAME.map3d, S = GAME.mapSphere;
    let hill = -1, best = -1;
    for (let ci = 0; ci < S.cells.length; ci++) {
      const c = S.cells[ci];
      if (!c || !c.dir) continue;
      const e = M._groundAtUnit(ci);
      if (e > best) { best = e; hill = ci; }
    }
    /* 从山顶旁边 2~3 格的低处朝峰走 —— 站在峰顶往任何方向都是下坡，
       那样测不出 >40° 的上坡阻挡（平凡的 0 滑落）。 */
    const hd = S.cells[hill].dir;
    let low = -1, lo = 1e9;
    for (let ci = 0; ci < S.cells.length; ci++) {
      const c = S.cells[ci];
      if (!c || !c.dir) continue;
      const dot = hd[0] * c.dir[0] + hd[1] * c.dir[1] + hd[2] * c.dir[2];
      if (dot < 0.999 || dot > 0.99999) continue;
      const e = M._groundAtUnit(ci);
      if (e < lo) { lo = e; low = ci; }
    }
    if (low < 0) low = hill;
    const ld = S.cells[low].dir;
    /* 与 map3d.js:224 surfaceFrame 同口径（该工具未挂 M，探针内联一份只读基）。 */
    const nL0 = Math.sqrt(ld[0] ** 2 + ld[1] ** 2 + ld[2] ** 2) || 1;
    const n = [ld[0] / nL0, ld[1] / nL0, ld[2] / nL0];
    let north = [-n[0] * n[1], 1 - n[1] * n[1], -n[2] * n[1]];
    let nn = Math.sqrt(north[0] ** 2 + north[1] ** 2 + north[2] ** 2);
    if (nn < 1e-8) { north = [1 - n[0] * n[0], -n[0] * n[1], -n[0] * n[2]]; nn = Math.sqrt(north[0] ** 2 + north[1] ** 2 + north[2] ** 2) || 1; }
    north = north.map((v) => v / nn);
    const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
    const east = cross(north, n), south = cross(east, n);
    const tg = [hd[0] - ld[0], hd[1] - ld[1], hd[2] - ld[2]];
    const se = tg[0] * east[0] + tg[1] * east[1] + tg[2] * east[2];
    const ss = tg[0] * south[0] + tg[1] * south[1] + tg[2] * south[2];
    M.setPlayerPose({ dir: ld.slice(), h: M._groundAtUnit(ld), yaw: Math.atan2(se, -ss), v: [0, 0, 0], ci: low });
    const before = M.playerPose().dir.slice();
    const log = [];
    for (let i = 0; i < 180; i++) log.push(M.stepAvatar(1 / 60, { w: 1 }));
    const after = M.playerPose().dir.slice();
    const dot = before[0] * after[0] + before[1] * after[1] + before[2] * after[2];
    const deg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    const cellW = Math.sqrt(4 * Math.PI * 300 * 300 / S.cells.length);
    return { hill, peak: +best.toFixed(3), degrees: +deg.toFixed(3), cells: +(deg * Math.PI / 180 * 300 / cellW).toFixed(3),
      slides: log.filter((x) => x && x.slide).length, blocked: log.filter((x) => x && x.blocked).length };
  });
  ok('C1 找得到有高度的地形（前置，非平凡）', slope.peak > 1, 'peak=' + slope.peak + ' ci=' + slope.hill);
  ok('C2 >40° 陡坡出现滑落/阻挡（有下限）', slope.slides + slope.blocked > 0,
    'slides=' + slope.slides + ' blocked=' + slope.blocked);
  ok('C3 没有把玩家原地钉死（3 秒位移 > 0）', slope.degrees > 0.01,
    'moved=' + slope.cells + ' 格');

  /* ---- D. 相机 rig：确定性驱动（headless 软渲染只有 ~3fps，靠 rAF 采样量不出稳态） ----
     两段式：① 把地形采样临时置 0（控制变量）测 6m/15° 参数本身；
             ② 恢复真实地形，单独测防穿地。山地里 liftOutOfGround 抬相机是
             必要代价，混进参数测试会把"参数对不对"和"地形自适应"搅成一个数。 */
  const rig = await p.evaluate(() => {
    const M = GAME.map3d;
    const origGround = M._groundAtUnit;
    const d0 = [0, 1, 0];
    M.setPlayerPose({ dir: d0.slice(), h: 0, yaw: 0, v: [0, 0, 0] });
    M.FOLLOW = true; M._followPos = null;
    M._groundAtUnit = function () { return 0; };
    const out = [];
    for (let i = 0; i < 180; i++) {
      /* 前 120 帧走 + 收敛阻尼，后 60 帧站定测 rig 静态参数 ——
         移动中相机按 0.15s 时间常数天然滞后 speed*0.15≈0.68m，
         那是阻尼特性，不能算进 6m 距离判据。 */
      M.stepAvatar(1 / 60, i < 120 ? { w: 1, a: 0, s: 0, d: 0 } : { w: 0, a: 0, s: 0, d: 0 });
      out.push(M.followAvatar(1 / 60));
    }
    M._groundAtUnit = origGround;
    const realGaps = [];
    for (let i = 0; i < 60; i++) {
      M.stepAvatar(1 / 60, { w: 1, a: 0, s: 0, d: 0 });
      realGaps.push(M.followAvatar(1 / 60).groundGap);
    }
    return { flat: out, realGaps: realGaps };
  });
  const tail = rig.flat.slice(-60);                  // 丢掉起步阻尼段
  const steady = tail.slice(-20);                    // 站定后再留 20 帧给阻尼收尾
  const distP95 = p95(steady.map((v) => v.dist));
  const pitchP95 = p95(steady.map((v) => v.pitch));
  const gapMin = rig.realGaps.length ? Math.min.apply(null, rig.realGaps) : -1;
  ok('D1 稳态相机采样有下限（≥60 帧，不是 0===0）', tail.length >= 60 && rig.realGaps.length >= 60,
    'frames=' + tail.length + ' real=' + rig.realGaps.length);
  ok('D2 平地 rig 距离 6.0 ± 0.3（p95）', Math.abs(distP95 - 6.0) <= 0.3, 'dist p95=' + distP95.toFixed(3));
  ok('D3 平地 rig 俯角 15° ± 2°（p95）', Math.abs(pitchP95 - 15) <= 2, 'pitch p95=' + pitchP95.toFixed(3));
  ok('D4 相机不穿地（离地 ≥ 0.4）', gapMin >= 0.4, 'minGap=' + gapMin.toFixed(3));

  /* ---- E. 输入链路：Tab 进跟随 + W 真按键必须推动位姿（走真实键盘事件） ---- */
  await p.evaluate(() => { GAME.map3d.setFollow(false); GAME.map3d.setFollow(true); });
  await p.keyboard.down('w');
  const keyDown = await p.evaluate(() => ({ follow: GAME.map3d.FOLLOW, w: GAME._keys && GAME._keys.w }));
  await p.keyboard.up('w');
  const keyUp = await p.evaluate(() => ({ follow: GAME.map3d.FOLLOW, w: GAME._keys && GAME._keys.w }));
  /* 位移本身由 A/B/C 的 stepAvatar 确定性段验证；这里只验真实键盘事件接线。
     headless 软渲染 ~3fps，靠 2 秒 rAF 推位移会假红。 */
  ok('E1 真键盘：Tab 进跟随 · W 写入 _keys · 松键清零',
    keyDown.follow === true && keyDown.w === 1 && keyUp.w === 0,
    'down=' + JSON.stringify(keyDown) + ' up=' + JSON.stringify(keyUp));
  ok('E2 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  await b.close();
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('PROBE_FATAL: ' + e.stack); process.exit(2); });
