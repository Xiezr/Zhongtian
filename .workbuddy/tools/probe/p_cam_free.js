/* 轨道相机自由度验收：能否自由连续到达任何角度（星球固定、只动相机） */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pcamfree';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
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
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '相机', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(1200);

  /* ============================================================
   * ⚠️ 必须先等 `#boot-loading` 撤掉：首次进地图要分帧构建 94 步（实测 6.4 秒），
   *    期间它是一层 z-index:60、86% 黑的整屏遮罩 —— 鼠标按下去只是在按遮罩，
   *    `drag` 永远不置位。上一版探针只等 3.2 秒，所有拖拽都打在遮罩上，
   *    于是"竖直拖零响应"被误判成相机 bug（实际是探针在错误时机操作）。
   * ============================================================ */
  const tBoot = Date.now();
  for (let i = 0; i < 100; i++) {
    const on = await p.evaluate(() => {
      const ov = document.getElementById('boot-loading');
      return ov ? ov.classList.contains('on') : false;
    });
    if (!on) break;
    await p.waitForTimeout(200);
  }
  const bootMs = Date.now() - tBoot;
  const hit = await p.evaluate(() => {
    const el = document.elementFromPoint(720, 450);
    return el ? el.id || el.tagName : null;
  });
  console.log('—— 遮罩撤除用时 ' + bootMs + 'ms · 画面中心命中 ' + hit);
  if (hit !== 'mapCanvas') throw new Error('遮罩仍在，拖拽会打在遮罩上');

  const snap = () => p.evaluate(() => {
    const M = GAME.map3d, o = M.camO, c = M._cam;
    const d = o.dir || [0, 0, 1];
    const camR = Math.sqrt(c.position.x ** 2 + c.position.y ** 2 + c.position.z ** 2);
    /* 星球本体是否固定：取最大的那个 mesh 的世界矩阵 */
    let globeQ = null;
    try {
      const sc = M._scene();
      let big = null, best = 0;
      sc.children.forEach((ch) => { if (ch.isMesh && ch.geometry && ch.geometry.attributes.position && ch.geometry.attributes.position.count > best) { best = ch.geometry.attributes.position.count; big = ch; } });
      if (big) { big.updateMatrixWorld(); globeQ = big.matrixWorld.elements.slice(0, 12).map((v) => +v.toFixed(4)); }
    } catch (e) { }
    return { dir: [+d[0].toFixed(4), +d[1].toFixed(4), +d[2].toFixed(4)],
      surf: M._surf, camR: +camR.toFixed(2), hasQuat: !!o.quat, globeQ: globeQ };
  });

  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

  const s0 = await snap();
  console.log('—— 初始  ' + JSON.stringify({ dir: s0.dir, camR: s0.camR, hasQuat: s0.hasQuat }));

  /* ══════ ① 竖直连续拖：翻过极点进另一半球 ══════ */
  /* ⚠️ 起点必须在**画面中央**：y=780 落在底部 HUD 上，pointerdown 被 UI 吃掉，
     实测 dir 一动不动（上一版就是这么假红的）。 */
  /* ⚠️ 起点必须在**画布**上：y=160 命中的是顶部 DIV 遮挡层，pointerdown 被它吃掉
     （实测 drag 没置位、dir 一动不动）。画布从 y≈230 起。 */
  const vert = [];
  for (let round = 0; round < 4; round++) {
    await p.mouse.move(720, 300);
    await p.mouse.down();                          /* 每轮重新按下：回位那一下不能算拖拽 */
    for (let i = 1; i <= 20; i++) {
      await p.mouse.move(720, 300 + i * 26);       /* 300 → 820，共 520px ≈ 2.6 rad */
      if (i % 2 === 0) vert.push((await snap()).dir);
    }
    await p.mouse.up();
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(400);
  const sV = await snap();
  const minY = Math.min(...vert.map((d) => d[1]), sV.dir[1]);
  const maxY = Math.max(...vert.map((d) => d[1]), sV.dir[1]);
  const vertSteps = [];
  for (let i = 1; i < vert.length; i++) vertSteps.push(ang(vert[i - 1], vert[i]));
  console.log('—— ① 竖直拖  dir.y 范围 ' + minY.toFixed(3) + ' ~ ' + maxY.toFixed(3)
    + ' · 采样 ' + vert.length + ' 次 · 最大单步 ' + Math.max(...vertSteps).toFixed(3) + ' rad');
  ok('① 能翻过极点进另一半球（dir.y 出现负值）', minY < -0.5, 'minY=' + minY.toFixed(3));
  ok('① 也可以上到北极（dir.y > 0.5）', maxY > 0.5, 'maxY=' + maxY.toFixed(3));
  ok('① 全程连续：相邻采样角距 < 0.6 rad（无"折回/跳变"）', Math.max(...vertSteps) < 0.6,
    'maxStep=' + Math.max(...vertSteps).toFixed(3));
  await p.screenshot({ path: OUT + '/1_after_vertical.png' });

  /* ══════ ② 水平连续拖满 360°：回到起点 ══════ */
  await p.evaluate(() => { const M = GAME.map3d; M.camO.quat = null; M.camO.yaw = 0.8; M.camO.pitch = 0.42; });
  await p.waitForTimeout(300);
  const h0 = await snap();
  await p.mouse.move(200, 450);
  await p.mouse.down();
  const horiz = [];
  for (let i = 0; i < 90; i++) {
    const x = 200 + ((i % 70) * 16);
    await p.mouse.move(Math.min(1420, x), 450);
    if (i % 5 === 0) horiz.push((await snap()).dir);
  }
  await p.mouse.up();
  await p.waitForTimeout(400);
  const h1 = await snap();
  const totalH = horiz.reduce((s, d, i) => i ? s + ang(horiz[i - 1], d) : 0, 0);
  console.log('—— ② 水平拖  累计转过 ' + (totalH * 180 / Math.PI).toFixed(1) + '° · dir '
    + JSON.stringify(h0.dir) + ' → ' + JSON.stringify(h1.dir));
  ok('② 水平能连续转过大半圈（> 180°）', totalH > Math.PI, 'total=' + (totalH * 180 / Math.PI).toFixed(0) + '°');

  /* ══════ ③ 星球本身不动（只动相机） ══════ */
  const same = s0.globeQ && h1.globeQ && s0.globeQ.every((v, i) => Math.abs(v - h1.globeQ[i]) < 1e-6);
  ok('③ 星球在场景中固定（世界矩阵逐位不变）', same === true, 'globeQ same=' + same);

  /* ══════ ④ 相机始终绕球心（位置 = dir * dist） ══════ */
  const geo = await p.evaluate(() => {
    const M = GAME.map3d, c = M._cam, o = M.camO;
    const camR = Math.sqrt(c.position.x ** 2 + c.position.y ** 2 + c.position.z ** 2);
    const d = o.dir;
    const exp = [d[0] * o.dist, d[1] * o.dist, d[2] * o.dist];
    const err = Math.sqrt((c.position.x - exp[0]) ** 2 + (c.position.y - exp[1]) ** 2 + (c.position.z - exp[2]) ** 2);
    return { camR: +camR.toFixed(2), dist: +o.dist.toFixed(2), err: +err.toFixed(3), quat: !!o.quat };
  });
  console.log('—— ④ 相机几何  ' + JSON.stringify(geo));
  ok('④ 相机位置 = dir × dist（始终绕球心，不漂移）', geo.err < 0.5, 'err=' + geo.err + 'm');
  ok('④ 轨迹球模式下 quat 保留（不再被清空退回转台）', geo.quat === true, 'quat=' + geo.quat);

  console.log('=== 页面错误 ===', JSON.stringify(errs.slice(0, 5)));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
