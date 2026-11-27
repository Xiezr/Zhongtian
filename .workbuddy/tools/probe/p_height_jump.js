/* ============================================================
 * v158.37 取证：地表行走的「高度跳变」
 * ------------------------------------------------------------
 * 老板：「存在高度跳变。」——不猜，逐帧量：
 *   ① 角色 h（M.playerPose().h）
 *   ② 相机离球心半径（_surfAvatarCam 之后的 cam.position）
 *   ③ 相机"相对地面"高度 = |cam| - R - h
 * 判据：相邻帧（1/60s）位移 > 0.4m 就算跳变（4.5m/s 走路一帧只有 0.075m）。
 * 同时量 4 条入口：正常走路 / 站立 / 点击自动走到 / 进地表那一帧。
 * ============================================================ */
const { chromium } = require('playwright-core');
const fs = require('fs');

const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pheightjump';
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
  const nb = await p.evaluate(() => {
    const el = document.getElementById('create-name'); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (!nb) throw new Error('找不到创角输入框');
  await p.mouse.click(nb.x, nb.y); await p.keyboard.type('北辰', { delay: 50 });
  const sb = await p.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button, .btn'))
      .find((x) => x.offsetParent && /开始新的征程/.test(x.textContent || ''));
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  if (!sb) throw new Error('找不到开始按钮');
  await p.mouse.click(sb.x, sb.y); await p.waitForTimeout(1600);
  await p.evaluate(() => { try { GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.setView('map'); } catch (e) { } });
  await p.waitForTimeout(800);
  await p.evaluate(() => { try { document.querySelectorAll('button, .btn').forEach((b) => { if (/知道了|开始建设|跳过|继续|确定/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas'), ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.c && !st.boot) break; await p.waitForTimeout(200);
  }
  await p.evaluate(() => { try { GAME.ui.setView('map'); } catch (e) { } });
  await p.waitForTimeout(600);

  /* ---- 逐帧采样：输入驱动，完全走生产出口 ---- */
  const sample = (keys, frames, opt) => p.evaluate(({ k, n, o }) => {
    const M = GAME.map3d;
    const cam = (M._camObj ? M._camObj() : M._cam);
    const rows = [];
    const R = M.R;
    if (o && o.reset) { M._spd = 0; M._lastWd = null; }
    for (let i = 0; i < n; i++) {
      if (o && o.walkTo != null && M.walkTarget() < 0) M.walkTo(o.walkTo);
      const out = M.stepAvatar(1 / 60, k);
      M.stepWalkTo(1 / 60);
      M._surfAvatarCam();
      M._lastAvOut = out; M._lastAvDt = 1 / 60;
      const pp = M.playerPose();
      const cr = Math.sqrt(cam.position.x * cam.position.x + cam.position.y * cam.position.y + cam.position.z * cam.position.z);
      rows.push({ i, h: +pp.h.toFixed(4), camR: +cr.toFixed(4),
        agl: +(cr - R - pp.h).toFixed(4),
        moved: !!(out && out.moved), slope: out ? out.slope : null,
        anchorR: M._surfCamAnchor ? +M._surfCamAnchor.length().toFixed(4) : null });
    }
    return rows;
  }, { k: keys, n: frames, o: opt || {} });

  const stat = (rows, label) => {
    let maxH = 0, maxCam = 0, maxAgl = 0, atH = 0, atCam = 0;
    for (let i = 1; i < rows.length; i++) {
      const dh = Math.abs(rows[i].h - rows[i - 1].h);
      const dc = Math.abs(rows[i].camR - rows[i - 1].camR);
      const da = Math.abs(rows[i].agl - rows[i - 1].agl);
      if (dh > maxH) { maxH = dh; atH = i; }
      if (dc > maxCam) { maxCam = dc; atCam = i; }
      if (da > maxAgl) maxAgl = da;
    }
    console.log('  ' + label + ': maxΔh=' + maxH.toFixed(4) + 'm@' + atH +
      ' · maxΔcamR=' + maxCam.toFixed(4) + 'm@' + atCam +
      ' · maxΔ离地=' + maxAgl.toFixed(4) + 'm');
    if (maxH > 0.01 || maxCam > 0.01) {
      const i = Math.max(atH, atCam);
      console.log('  邻帧: ' + JSON.stringify(rows.slice(Math.max(0, i - 2), i + 3)));
    }
    return { maxH, maxCam, maxAgl };
  };

  console.log('===== ① 进地表那一帧（起点高度是否跳）=====');
  const before = await p.evaluate(() => {
    const M = GAME.map3d, pp = M.playerPose();
    return { h: pp ? +pp.h.toFixed(4) : null, ci: M.playerCi(), surf: !!M._surf };
  });
  console.log('  地表前 ' + JSON.stringify(before));
  await p.evaluate(() => { try { GAME.map3d.surfaceMode(true); } catch (e) { } });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => {
    const M = GAME.map3d, pp = M.playerPose();
    return { h: +pp.h.toFixed(4), ci: M.playerCi(), surf: !!M._surf,
      ground: M._groundAtUnit(pp.dir) };
  });
  console.log('  地表后 ' + JSON.stringify(after));
  ok('① 进地表后角色贴地（|h-ground| < 0.05m）',
    Math.abs(after.h - after.ground) < 0.05, 'gap=' + Math.abs(after.h - after.ground).toFixed(4));

  console.log('\n===== ② 静止 60 帧 =====');
  const idle = await sample({}, 60);
  const sIdle = stat(idle, '静止');
  ok('② 静止时不跳变（Δh/ΔcamR < 0.02m）', sIdle.maxH < 0.02 && sIdle.maxCam < 0.02);

  console.log('\n===== ③ 按 W/D/S/A 各走 90 帧 =====');
  let worst = { maxH: 0, maxCam: 0, maxAgl: 0 };
  for (const key of ['w', 'd', 's', 'a']) {
    await p.evaluate(() => { const M = GAME.map3d; M._spd = 0; M._lastWd = null; M._surfCamAnchor = null; });
    const rows = await sample({ [key]: true }, 90);
    const s = stat(rows, '按 ' + key.toUpperCase());
    worst.maxH = Math.max(worst.maxH, s.maxH);
    worst.maxCam = Math.max(worst.maxCam, s.maxCam);
    worst.maxAgl = Math.max(worst.maxAgl, s.maxAgl);
  }
  ok('③ 走路高度连续（单帧 Δh < 0.4m）', worst.maxH < 0.4, 'maxΔh=' + worst.maxH.toFixed(3));
  ok('③ 相机高度连续（单帧 ΔcamR < 0.4m）', worst.maxCam < 0.4, 'maxΔcamR=' + worst.maxCam.toFixed(3));

  console.log('\n===== ④ 点击自动走到邻格 =====');
  const near = await p.evaluate(() => {
    const M = GAME.map3d, ci = M.playerCi(), SP = GAME.mapSphere;
    let best = -1, bd = 1e9;
    for (let j = 0; j < SP.cells.length; j++) {
      if (j === ci) continue;
      const a = SP.cells[ci].dir, b = SP.cells[j].dir;
      const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const d = Math.acos(dot) * M.R;
      if (d < bd && d > 2) { bd = d; best = j; }
    }
    return { ci, target: best, dist: +bd.toFixed(2) };
  });
  console.log('  ' + JSON.stringify(near));
  const rows4 = await sample({}, 240, { walkTo: near.target, reset: true });
  const s4 = stat(rows4, '自动走 ' + near.dist + 'm');
  ok('④ 自动走路高度连续（单帧 Δh < 0.4m）', s4.maxH < 0.4, 'maxΔh=' + s4.maxH.toFixed(3));

  console.log('\n===== ⑤ 自然地形本身连续吗（同一路径的高频采样）=====');
  const terrain = await p.evaluate(() => {
    const M = GAME.map3d, pp = M.playerPose();
    const fr = M.avatarBasis ? M.avatarBasis(pp.dir) : null;
    const fwd = fr ? fr.south : [0, 0, 1];
    const l = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    const hs = [];
    for (let i = 0; i < 240; i++) {
      const t = i * 0.1 / M.R;
      const d = [pp.dir[0] + fwd[0] / l * t, pp.dir[1] + fwd[1] / l * t, pp.dir[2] + fwd[2] / l * t];
      const n = Math.hypot(d[0], d[1], d[2]) || 1;
      hs.push(M._groundAtUnit([d[0] / n, d[1] / n, d[2] / n]));
    }
    let mx = 0, at = 0;
    for (let i = 1; i < hs.length; i++) if (Math.abs(hs[i] - hs[i - 1]) > mx) { mx = Math.abs(hs[i] - hs[i - 1]); at = i; }
    return { maxStep: +mx.toFixed(4), at, around: hs.slice(Math.max(0, at - 3), at + 4),
      hMin: +Math.min.apply(null, hs).toFixed(3), hMax: +Math.max.apply(null, hs).toFixed(3) };
  });
  console.log('  ' + JSON.stringify(terrain));
  ok('⑤ 自然地形 0.1m 步进连续（Δ < 0.4m）', terrain.maxStep < 0.4,
    'max=' + terrain.maxStep + 'm');

  console.log('\n===== 错误 =====');
  console.log('  pageerror=' + JSON.stringify(errs));
  ok('⑥ 无 pageerror', errs.length === 0, errs.join(' | '));
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('FATAL ' + (e && e.stack || e)); process.exit(1); });
