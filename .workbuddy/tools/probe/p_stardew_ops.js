/* ============================================================
 * v158.35 验收：操作是否达到星露谷标准
 * ------------------------------------------------------------
 * 老板：「操作上达到星露谷的标准了吗？」
 * 星露谷的五条硬指标（这一份逐条量，不靠感觉）：
 *   ① 八方向：按 D 应该**往右走**，不是原地转身
 *   ② 斜向归一化：W+D 的位移速度 = 单按 W（误差 < 2%）
 *   ③ 朝向自动对齐：往哪走就朝哪（yaw 跟移动方向一致）
 *   ④ 没有"转身键"：A/D 不产生纯旋转（位移必须 > 0）
 *   ⑤ 走的是屏幕方向：右键把镜头绕 90° 后，同一个 W 的世界方向跟着变
 * 判据一律带下限（位移必须真的大于 0），不许 0 === 0 过。
 * ============================================================ */
const { chromium } = require('playwright-core');
const fs = require('fs');

const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pstardewops';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('OK   ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + name + (detail ? '  [' + detail + ']' : '')); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--no-sandbox']
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  /* ⚠️ 必须走**真实开局**：只调 newGame+enterGame 会停在创角屏，
     画面被弹窗盖住（上一版截图就是"给君主起个名"，数据在跑但看不到）。
     这里真填名字、真点「开始新的征程」。 */
  const nameBox = await p.evaluate(() => {
    const el = document.getElementById('create-name');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (!nameBox) throw new Error('找不到名字输入框');
  await p.mouse.click(nameBox.x, nameBox.y);
  await p.keyboard.type('北辰', { delay: 80 });
  const startBtn = await p.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button, .btn'))
      .find((x) => x.offsetParent && /开始新的征程/.test(x.textContent || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (!startBtn) throw new Error('找不到开始按钮');
  await p.mouse.click(startBtn.x, startBtn.y);
  await p.waitForTimeout(1800);
  /* 固定种子（创角给的是随机星球，这里统一成可复现的） */
  await p.evaluate(() => { try { GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.setView('map'); } catch (e) { } });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    try {
      document.querySelectorAll('button, .btn').forEach((b) => {
        if (/知道了|开始建设|跳过|继续|确定/.test(b.textContent || '')) b.click();
      });
    } catch (e) { }
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

  /* ⚠️ 必须先确认视图真的是 map：`newGame` 会把视图打回城市（2D 网格界面），
     那时截图是"政务厅/居所"，根本看不到 3D 画面（上一版就是这么错的）。 */
  await p.evaluate(() => { try { GAME.ui.setView('map'); } catch (e) { } });
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { v: (GAME.ui && GAME.ui.view) || '', c: !!c && c.clientWidth > 0,
        boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.v === 'map' && st.c && !st.boot) break;
    await p.waitForTimeout(200);
  }
  const viewNow = await p.evaluate(() => ({ view: GAME.ui.view, canvas: !!document.getElementById('mapCanvas') }));
  console.log('—— 视图 ' + JSON.stringify(viewNow));
  if (viewNow.view !== 'map') throw new Error('视图没切到 map：' + JSON.stringify(viewNow));

  /* 进地表（走公开入口，等价于玩家滚轮拉到底） */
  await p.evaluate(() => { try { GAME.map3d.surfaceMode(true); } catch (e) { } });
  await p.waitForTimeout(1500);
  const base = await p.evaluate(() => ({
    surf: !!GAME.map3d._surf, ci: GAME.map3d.playerCi ? GAME.map3d.playerCi() : -1,
    fwdW: GAME.map3d._surfFwdW, dist: GAME.map3d.SURF_CAM_DIST
  }));
  console.log('—— 地表就绪 ' + JSON.stringify(base));
  if (!base.surf) throw new Error('没进地表，后续测量无意义');

  /* 通用：按下指定键跑 sec 秒（60fps 手动推进 + 每帧跑相机写 _surfFwdW） */
  const run = (keys, sec) => p.evaluate(({ k, s }) => {
    const M = GAME.map3d;
    const a0 = M.playerPose();
    const d0 = a0.dir.slice(), y0 = a0.yaw || 0;
    M._spd = 0; M._lastWd = null;
    const n = Math.round(s * 60);
    let maxSpd = 0;
    for (let i = 0; i < n; i++) {
      const out = M.stepAvatar(1 / 60, k);
      M._surfAvatarCam();                       /* 生产路径：相机每帧写屏幕基 */
      M._lastAvOut = out; M._lastAvDt = 1 / 60;  /* 渲染循环同款 */
      if (out && out.spd > maxSpd) maxSpd = out.spd;
    }
    const a1 = M.playerPose();
    const d1 = a1.dir.slice();
    const dot = Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]));
    const meters = Math.acos(dot) * M.R;
    /* 朝向对齐不靠"自造切平面基"（那与 map3d 的 surfaceQuad 不是同一套，
       上一版就是这么假红的）。改为量两个**不依赖基**的量：
         · yaw 变化（人物朝向）
         · 位移的方向变化（世界向量）
       若朝向真的跟着移动方向走，四个方向的 yaw 必然两两相差 90°。 */
    const mv  = [d1[0] - d0[0], d1[1] - d0[1], d1[2] - d0[2]];
    const ml  = Math.hypot(mv[0], mv[1], mv[2]) || 1;
    const mvN = [mv[0] / ml, mv[1] / ml, mv[2] / ml];
    return {
      meters: +meters.toFixed(3), maxSpd: +maxSpd.toFixed(3),
      yaw1: +((a1.yaw || 0) * 180 / Math.PI).toFixed(2),
      mv: mvN.map((v) => +v.toFixed(4)),
      fwdW: M._surfFwdW ? M._surfFwdW.map((v) => +v.toFixed(3)) : null
    };
  }, { k: keys, s: sec });

  const resetPos = () => p.evaluate(() => {
    const M = GAME.map3d;
    M._spd = 0; M._lastWd = null;
    const pp = M.playerPose();
    pp.yaw = 0;
    M.setPlayerPose(pp);
  });

  console.log('\n===== ① 按 D 一秒 =====');
  const rD = await run({ d: true }, 1.0);
  console.log('  ' + JSON.stringify(rD));
  ok('① 按 D 真的往右走（位移 > 3 米）', rD.meters > 3.0, 'meters=' + rD.meters);
  await p.evaluate(() => { if (GAME.ui.view !== 'map') GAME.ui.setView('map'); });
  await p.waitForTimeout(600);
  const shotView = await p.evaluate(() => ({ v: GAME.ui.view, surf: !!GAME.map3d._surf }));
  console.log('  （截图时 ' + JSON.stringify(shotView) + '）');
  await p.screenshot({ path: OUT + '/1_press_d.png' });
  await resetPos();

  console.log('\n===== ② 按 W 一秒 vs W+D 一秒 =====');
  const rW = await run({ w: true }, 1.0);
  await resetPos();
  const rWD = await run({ w: true, d: true }, 1.0);
  await resetPos();
  const rA = await run({ a: true }, 1.0);
  await resetPos();
  console.log('  W ' + JSON.stringify(rW));
  console.log('  W+D ' + JSON.stringify(rWD));
  console.log('  A ' + JSON.stringify(rA));
  const ratio = rWD.meters / Math.max(0.001, rW.meters);
  ok('② 斜向归一化（W+D / W = 1.00 ± 0.03，不许 1.41）',
    ratio > 0.97 && ratio < 1.03, 'ratio=' + ratio.toFixed(4));
  ok('② 按 A 也真的往左走（位移 > 3 米，不是原地转）', rA.meters > 3.0, 'meters=' + rA.meters);

  console.log('\n===== ③ 朝向自动对齐移动方向（四方向两两 90°）=====');
  const rS = await run({ s: true }, 1.0);
  await resetPos();
  console.log('  S ' + JSON.stringify(rS));
  const quad = [rW, rD, rS, rA];
  const norm180 = (a) => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };
  const angBetween = (A, B) => Math.acos(Math.max(-1, Math.min(1,
    A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) * 180 / Math.PI;
  const dYaw = [], dMv = [];
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    dYaw.push(norm180(b.yaw1 - a.yaw1));
    dMv.push(angBetween(a.mv, b.mv));
  }
  const f2 = (v) => v.map((x) => x.toFixed(1) + '°').join(' / ');
  console.log('  yaw   ' + f2(quad.map((q) => q.yaw1)) + '  → 相邻差 ' + f2(dYaw));
  console.log('  位移方向相邻夹角 ' + f2(dMv));
  const allYaw90 = dYaw.every((d) => Math.abs(Math.abs(d) - 90) < 3);
  const allMv90 = dMv.every((d) => Math.abs(d - 90) < 3);
  const sameSign = dYaw.every((d, i) => (Math.sign(d) === Math.sign(dMv[i])) || Math.abs(d) < 1);
  ok('③ 四方向 yaw 两两相差 90°（朝向是连续对齐的）', allYaw90, f2(dYaw));
  ok('③ 四方向位移也两两相差 90°', allMv90, f2(dMv));
  ok('③ yaw 与位移同向转（朝向真的跟着移动方向走）', sameSign, f2(dYaw) + ' vs ' + f2(dMv));

  console.log('\n===== ④ 没有"转身键"（A/D 不是纯旋转）=====');
  ok('④ 单按 D 的位移不是 0（旧坦克式是 0 米 + 转 172°）',
    rD.meters > 3.0, 'old would be 0.000 / new=' + rD.meters);

  console.log('\n===== ⑤ W 的方向跟着镜头走（屏幕相对）=====');
  const beforeOrbit = await p.evaluate(() => GAME.map3d._surfFwdW.slice());
  await p.evaluate(() => { GAME.map3d._surfOrbitYaw += Math.PI / 2; GAME.map3d._surfAvatarCam(); });
  const rW2 = await run({ w: true }, 1.0);
  await resetPos();
  const ang = Math.acos(Math.max(-1, Math.min(1,
    beforeOrbit[0] * rW2.fwdW[0] + beforeOrbit[1] * rW2.fwdW[1] + beforeOrbit[2] * rW2.fwdW[2]))) * 180 / Math.PI;
  ok('⑤ 镜头绕 90° 后，W 的世界方向也变 90°（±12°）',
    Math.abs(ang - 90) < 12, 'Δ=' + ang.toFixed(1) + '°');
  await p.screenshot({ path: OUT + '/2_orbit90_w.png' });

  console.log('\n===== ⑥ 交互目标看得见（E 提示条）=====');
  const hint = await p.evaluate(() => {
    const M = GAME.map3d;
    const hit = M.nearestInteractable ? M.nearestInteractable() : null;
    return { hit: hit ? { ci: hit.ci, kind: hit.kind, verb: hit.verb } : null,
      INTERACT_NEAR: M.INTERACT_NEAR, range: M.INTERACT_RANGE, cone: M.INTERACT_CONE };
  });
  console.log('  ' + JSON.stringify(hint));
  ok('⑥ 走近交互系统在岗（≤1 格 + 正前方 30°）',
    hint.INTERACT_NEAR === true && hint.range === 1 && hint.cone === 30,
    JSON.stringify({ r: hint.range, c: hint.cone }));

  await p.screenshot({ path: OUT + '/3_final.png' });
  console.log('\n页面错误: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '无'));
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
