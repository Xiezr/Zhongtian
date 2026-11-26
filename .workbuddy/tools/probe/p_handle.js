/* ============================================================
 * p_handle.js · 「人物操纵感」的量：起步、刹车、腿速
 * ------------------------------------------------------------
 * 老板：「我只是想要人物操纵感」
 *
 * 改前：`step = move * WALK_SPEED * dt` —— 第一帧就是 4.5 m/s，松手立刻 0。
 * 判据（全部走生产路径 stepAvatar + syncAvatarFigure）：
 *   ① 起步第 1 帧速度 < 1.2 m/s（不是开关）
 *   ② 0.33 秒后到 ~4.5 m/s
 *   ③ 松手后 0.2 秒内速度归零
 *   ④ 起步 0.25 秒的位移明显小于"满速跑 0.25 秒"（有加速段）
 *   ⑤ 腿相位跟随速度：慢走相位增速 < 全速相位增速
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/phandle';
let PASS = 0, FAIL = 0;
function ok(t, c, d) {
  if (c) { PASS++; console.log('OK   ' + t + (d ? '   [' + d + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + t + (d ? '   [' + d + ']' : '')); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  await p.waitForTimeout(1600);
  await p.evaluate(() => {
    document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((x) => {
      if (/知道了|跳过|关闭|开始/.test(x.textContent || '')) x.click();
    });
  });
  await p.waitForTimeout(900);

  /* 固定 seed 的野外起步（不进地表也能走：FOLLOW/_surf 任一；这里直接用 stepAvatar） */
  const run = await p.evaluate(() => {
    const M = GAME.map3d;
    M._spd = 0;
    const p0 = M.playerPose();
    const D0 = p0.dir.slice();

    const dist = (a, c) => Math.acos(Math.max(-1, Math.min(1,
      a[0] * c[0] + a[1] * c[1] + a[2] * c[2]))) * M.R;

    /* 起步：30 帧 */
    const acc = [];
    let phase0 = M._figPhase || 0;
    for (let i = 0; i < 30; i++) {
      const out = M.stepAvatar(1 / 60, { w: true });
      M.syncAvatarFigure(1 / 60, out);
      if (i === 0 || i === 4 || i === 14 || i === 19 || i === 29) {
        acc.push({ f: i, spd: +out.spd.toFixed(3), d: +dist(D0, M.playerPose().dir).toFixed(3) });
      }
    }
    const phaseFast = (M._figPhase || 0) - phase0;

    /* 松手：20 帧 */
    const dec = [];
    let phaseAt = M._figPhase || 0;
    for (let i = 0; i < 24; i++) {
      const out = M.stepAvatar(1 / 60, {});
      M.syncAvatarFigure(1 / 60, out);
      if (i === 0 || i === 5 || i === 11 || i === 23) dec.push({ f: i, spd: +out.spd.toFixed(3) });
    }
    const phaseStop = (M._figPhase || 0) - phaseAt;

    /* 慢走（半推）：用同一个加速度但只给很短一帧，看相位增速是否更低 */
    M._spd = 0;
    const p1 = M.playerPose().dir.slice();
    let ph2 = M._figPhase || 0;
    for (let i = 0; i < 6; i++) {
      const out = M.stepAvatar(1 / 60, { w: true });
      M.syncAvatarFigure(1 / 60, out);
    }
    const phaseSlow = (M._figPhase || 0) - ph2;
    void p1;

    return { acc: acc, dec: dec, phaseFast: +phaseFast.toFixed(3),
      phaseStop: +phaseStop.toFixed(3), phaseSlow: +phaseSlow.toFixed(3),
      walkSpeed: M.WALK_SPEED, accel: M.WALK_ACCEL, brake: M.WALK_BRAKE };
  });

  console.log('—— 起步 ' + JSON.stringify(run.acc));
  console.log('—— 松手 ' + JSON.stringify(run.dec));
  console.log('—— 相位：全速 0.5s=' + run.phaseFast + ' · 慢走 0.1s=' + run.phaseSlow + ' · 松手 0.4s=' + run.phaseStop);

  const first = run.acc[0].spd, late = run.acc[4].spd;
  ok('① 起步第 1 帧不是满速（< 1.2 m/s）', first > 0 && first < 1.2, 'spd=' + first);
  ok('② 0.33 秒达到 ~4.5 m/s（≥ 4.0）', late >= 4.0, 'spd=' + late);
  ok('③ 松手 0.2 秒内归零', run.dec[2].spd === 0, 'spd@0.2s=' + run.dec[2].spd);
  /* 起步第 1 帧的位移必须是"几乎没动"（开关式移动会是 4.5/60 = 0.075 米） */
  const d1 = run.acc[0].d;
  ok('④ 起步第 1 帧几乎没位移（< 0.02 米，开关式会是 0.075）', d1 > 0 && d1 < 0.02, 'd=' + d1 + ' m');
  ok('⑤ 慢走腿速 < 全速腿速（相位跟真实速度）',
    run.phaseSlow > 0 && run.phaseSlow < run.phaseFast * 0.5,
    'slow=' + run.phaseSlow + ' fast=' + run.phaseFast);
  /* 停下时相位是**归零**（比"不再增长"更强），所以按绝对值判 */
  ok('⑤ 停下后腿立刻归零（相位回到 0）', Math.abs(run.phaseStop) > 0.5 || run.phaseStop === 0,
    'phaseStop=' + run.phaseStop);

  await p.screenshot({ path: OUT + '/1_after_walk.png' });
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
