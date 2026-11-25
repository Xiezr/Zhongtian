/* 把地表两层强制染成亮色/不透明，看它们到底在不在画面里 */
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

  const info = await p.evaluate(() => {
    const M = GAME.map3d, sc = M._scene();
    const out = { painted: [], cam: M._cam.position.toArray().map((v) => +v.toFixed(1)) };
    sc.children.forEach((ch) => {
      let tris = 0, meshes = [];
      ch.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
        meshes.push(o);
      });
      if (tris > 5000 && tris < 40000) {
        meshes.forEach((o, idx) => {
          const m = o.material;
          if (!m) return;
          m.color = new THREE.Color(idx === 0 ? 0xff00ff : 0x00ff00);
          m.vertexColors = false;
          m.opacity = 1; m.transparent = false;
          m.needsUpdate = true;
          o.visible = true;
        });
        out.painted.push({ tris: Math.round(tris), meshes: meshes.length, camDist: +M._cam.position.distanceTo(meshes[0]).toFixed(1), frustumCulled: meshes[0].frustumCulled, side: meshes[0].material.side });
      }
    });
    return out;
  });
  console.log(JSON.stringify(info));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/4_painted.png' });
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
