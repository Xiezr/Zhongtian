/* 地表层顶点色分布：到底画的是海还是地 */
'use strict';
const { chromium } = require('playwright-core');
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
    const M = GAME.map3d, sc = M._scene();
    const out = { layers: [] };
    sc.children.forEach((ch) => {
      let tris = 0, meshes = [];
      ch.traverse((o) => { if (o.isMesh && o.geometry) { const g = o.geometry; tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3; meshes.push(o); } });
      if (!(tris > 5000 && tris < 40000)) return;
      meshes.forEach((o) => {
        const g = o.geometry, ca = g.attributes.color;
        if (!ca) { out.layers.push({ tris: Math.round(tris), noColor: true, matColor: o.material.color ? o.material.color.getHexString() : null }); return; }
        const hist = {};
        for (let i = 0; i < ca.count; i += Math.max(1, Math.floor(ca.count / 400))) {
          const key = [Math.round(ca.getX(i) * 255), Math.round(ca.getY(i) * 255), Math.round(ca.getZ(i) * 255)].join(',');
          hist[key] = (hist[key] || 0) + 1;
        }
        const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6);
        out.layers.push({ tris: Math.round(tris), sampled: 400, topColors: top, vc: o.material.vertexColors, matColor: o.material.color ? o.material.color.getHexString() : null });
      });
    });
    /* 玩家所在格的类型与颜色 */
    const ci = M.playerCi();
    const cells = M._collider.cells;
    out.player = { ci: ci, type: cells[ci] ? cells[ci].type : null };
    /* 周边格类型统计（半径 2 格内） */
    const pd = cells[ci].dir;
    const cnt = {};
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; if (!c) continue;
      const dot = Math.max(-1, Math.min(1, c.dir[0] * pd[0] + c.dir[1] * pd[1] + c.dir[2] * pd[2]));
      if (Math.acos(dot) * M.R < 40) cnt[c.type] = (cnt[c.type] || 0) + 1;
    }
    out.nearby40m = cnt;
    return out;
  });
  console.log(JSON.stringify(d, null, 1).slice(0, 2000));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
