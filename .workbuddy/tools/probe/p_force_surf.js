/* 强制进地表层，逐项量：相机高度/朝向、各层在不在场景、小人屏幕位置 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/psurfre';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
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
  await p.evaluate(() => { GAME.newGame({ name: '地表', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(800);

  /* 让玩家小人站到一块平原上 */
  const where = await p.evaluate(() => {
    const M = GAME.map3d, cells = M._collider.cells;
    const cityCis = {}; (GAME.state.cities || []).forEach((x) => { cityCis[x.ci] = 1; });
    let ci = -1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c && c.type === 'plain' && !cityCis[i]) { ci = i; break; }
    }
    if (ci < 0) return { err: 'no plain' };
    M.teleportTo(ci);
    return { ci: ci, type: cells[ci].type };
  });
  console.log('=== 站位 ===', JSON.stringify(where));

  /* 强制进地表 */
  const on = await p.evaluate(() => {
    const M = GAME.map3d;
    let err = null;
    try { M.surfaceMode(true); } catch (e) { err = e.message; }
    return { surf: M._surf, stats: (M.surfStats ? M.surfStats() : null), err: err };
  });
  console.log('=== surfaceMode(true) ===', JSON.stringify(on));
  await p.waitForTimeout(2500);

  const st = await p.evaluate(() => {
    const M = GAME.map3d, c = M._cam, o = M.camO;
    const sc = M._scene();
    const camR = Math.sqrt(c.position.x * c.position.x + c.position.y * c.position.y + c.position.z * c.position.z);
    /* 各层是否在场景里 */
    let layers = {};
    sc.children.forEach((ch) => {
      let tris = 0; ch.traverse((x) => { if (x.isMesh && x.geometry) tris += (x.geometry.index ? x.geometry.index.count : (x.geometry.attributes.position ? x.geometry.attributes.position.count : 0)) / 3; });
      const k = Math.round(tris);
      if (k > 800 && k < 200000) layers[k] = (layers[k] || 0) + 1;
    });
    /* 小人屏幕位置 */
    let fig = null, ndc = null;
    const fg = M.figureOf('stand');
    if (fg) {
      fig = { pos: fg.pos.map((v) => +v.toFixed(1)), walking: fg.walking };
      const v = new THREE.Vector3(fg.pos[0], fg.pos[1], fg.pos[2]).project(c);
      ndc = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)];
    }
    return { surf: M._surf, camR: +camR.toFixed(2), R: M.R, eyeAbove: +(camR - M.R).toFixed(2),
      camPos: c.position.toArray().map((v) => +v.toFixed(1)),
      dist: +o.dist.toFixed(2), surfDir: o.dir ? o.dir.map((v) => +v.toFixed(4)) : null,
      fov: c.fov, near: c.near, far: c.far,
      sceneChildren: sc.children.length, fig: fig, figNdc: ndc,
      surfDirVec: M._surfDir ? { x: +M._surfDir.x.toFixed(3), y: +M._surfDir.y.toFixed(3), z: +M._surfDir.z.toFixed(3) } : null,
      layers: layers };
  });
  console.log('=== 地表态 ===');
  console.log(JSON.stringify(st, null, 1).slice(0, 1400));

  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/2_forced_surf.png' });
  console.log('=== 错误 ===', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
