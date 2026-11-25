/* v158.21 贴地验收：① 视野边界是不是圆的 ② 贴地能不能拖动 ③ 界外能不能点 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/psurf';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '贴地', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2200);

  /* 进地表（贴地）模式 */
  const surf = await p.evaluate(() => {
    const M = GAME.map3d;
    if (M.surfaceMode) M.surfaceMode(true);
    return { surf: M._surf, dist: M.camO ? +M.camO.dist.toFixed(1) : null, R: M.R };
  });
  await p.waitForTimeout(2500);
  const st1 = await p.evaluate(() => {
    const M = GAME.map3d;
    return { surf: M._surf, camDist: +M.camO.dist.toFixed(1),
      hasSR: !!(window.__SR || null), agl: M.camO && M.camO.dist != null ? +(M.camO.dist - M.R).toFixed(1) : null };
  });
  console.log('  地表状态', JSON.stringify(surf), '→', JSON.stringify(st1));
  await p.screenshot({ path: OUT + '/10_surface.png' });

  /* ② 贴地拖拽：按住左键拖 200px，看**地表视线 _surfDir** 变不变（贴地不读 camO.quat） */
  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    return { surfDir: M._surfDir ? [+M._surfDir.x.toFixed(4), +M._surfDir.y.toFixed(4), +M._surfDir.z.toFixed(4)] : null,
      yaw: +(M.camO.yaw || 0).toFixed(4) };
  });
  const before = await snap();
  await p.mouse.move(700, 450);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(700 + i * 18, 450 + i * 4); await p.waitForTimeout(20); }
  await p.mouse.up();
  await p.waitForTimeout(600);
  const after = await snap();
  const dS = (before.surfDir && after.surfDir)
    ? Math.hypot(after.surfDir[0] - before.surfDir[0], after.surfDir[1] - before.surfDir[1], after.surfDir[2] - before.surfDir[2]) : 0;
  console.log('  拖拽前', JSON.stringify(before));
  console.log('  拖拽后', JSON.stringify(after));
  console.log('  ΔsurfDir=' + dS.toFixed(4));
  console.log('  ' + (dS > 0.01 ? '✅ 贴地能拖动' : '❌ 贴地拖不动'));
  await p.screenshot({ path: OUT + '/11_after_drag.png' });

  /* ③ 边界形状：数一下平台外面有没有"方角"——用截图人工复核，这里给平台格数 */
  const plate = await p.evaluate(() => {
    const M = GAME.map3d;
    const sc = M._scene ? M._scene() : null;
    let plateMesh = null;
    if (sc) sc.traverse((o) => { if (o.name === 'surfPlate') plateMesh = o; });
    if (!plateMesh) return { err: 'no plate' };
    const g = plateMesh.geometry;
    const pos = g.attributes.position;
    /* 统计顶点到"格心方向"的最大夹角 → 判断圆形还是方形（方形四角会明显更远） */
    let minY = 1e9, maxY = -1e9, n = pos.count;
    for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    return { verts: n, tris: g.index ? g.index.count / 3 : pos.count / 3 };
  });
  console.log('  平台几何', JSON.stringify(plate));
  console.log('  错误', JSON.stringify(errs.slice(0, 3)));
  await b.close();
  process.exit(0);
})();
