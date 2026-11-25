/* 地表层为什么看不见：透明度/可见性/覆盖范围取证 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pstardew';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(900);
  await p.mouse.move(720, 450);
  for (let i = 0; i < 46; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(70); }
  await p.waitForTimeout(2200);

  const d = await p.evaluate(() => {
    const M = GAME.map3d;
    const sc = M._scene();
    let fade = M._surfFade;
    const out = { surf: M._surf, fadeType: typeof fade,
      fade: (typeof fade === 'number' ? +fade.toFixed(3) : String(fade)),
      eyeAbove: null, stats: M.surfStats ? M.surfStats() : null, layers: [] };
    const camR = Math.sqrt(M._cam.position.x ** 2 + M._cam.position.y ** 2 + M._cam.position.z ** 2);
    out.eyeAbove = +(camR - M.R).toFixed(1);
    /* 按三角形数识别各层，输出 opacity/visible/material */
    sc.children.forEach((ch) => {
      let tris = 0;
      const mats = [];
      ch.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
        if (o.material) mats.push({ t: o.material.type, op: o.material.opacity, tr: o.material.transparent, vis: o.visible });
      });
      const k = Math.round(tris);
      if (k > 500 && k < 300000) out.layers.push({ tris: k, childVis: ch.visible, mats: mats.slice(0, 3) });
    });
    out.layers.sort((a, b) => a.tris - b.tris);
    /* 小人 */
    const pp = M.playerPose();
    if (pp) {
      const v = new THREE.Vector3(pp.dir[0] * (M.R + pp.h), pp.dir[1] * (M.R + pp.h), pp.dir[2] * (M.R + pp.h)).project(M._cam);
      out.figNdc = [+v.x.toFixed(2), +v.y.toFixed(2)];
    }
    out.figNear = M.figureOf('stand') ? 1 : 0;
    /* 每层几何的包围球半径（判断覆盖范围） */
    out.spheres = [];
    sc.children.forEach((ch) => {
      let tris = 0;
      ch.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
        if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch (e) { } }
        if (g.boundingSphere && tris > 500 && tris < 300000) {
          out.spheres.push({ tris: Math.round(tris), r: +g.boundingSphere.radius.toFixed(2),
            c: [+g.boundingSphere.center.x.toFixed(1), +g.boundingSphere.center.y.toFixed(1), +g.boundingSphere.center.z.toFixed(1)],
            op: o.material ? o.material.opacity : null });
        }
      });
    });
    /* 城市格在哪 */
    const c = GAME.currentCity();
    if (c && c.ci != null && M._collider && M._collider.cells[c.ci]) {
      const cd = M._collider.cells[c.ci].dir;
      const v2 = new THREE.Vector3(cd[0] * M.R, cd[1] * M.R, cd[2] * M.R).project(M._cam);
      out.cityNdc = [+v2.x.toFixed(2), +v2.y.toFixed(2)];
      out.distFigCity = +(Math.acos(Math.max(-1, Math.min(1,
        cd[0] * pp.dir[0] + cd[1] * pp.dir[1] + cd[2] * pp.dir[2]))) * M.R).toFixed(1);
    }
    return out;
  });
  console.log(JSON.stringify(d, null, 1));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/3_diag.png' });
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
