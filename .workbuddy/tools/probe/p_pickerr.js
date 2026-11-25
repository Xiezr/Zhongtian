/* 诊断：鼠标点下去，命中的是不是玩家看到的那一格
 * 做法：把候选格投影到屏幕 → 在投影点回车（真实鼠标坐标）→ 看命中 ci
 * 判定：同格才算准；差一格以上 = 点击偏格（严重）
 */
'use strict';
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2600);

  const r = await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere, cam = M._cam;
    const cv = document.getElementById('mapCanvas');
    const box = cv.getBoundingClientRect();
    const cc = {}; (G.state.cities || []).forEach((c) => { cc[c.ci] = 1; });
    const res = { probes: [], fogHit: { 0: 0, pos: 0 }, total: 0 };
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    /* 均匀取样：只取**正对相机**的格子（背面格投影也在屏幕内，但会被球体挡住） */
    let tried = 0;
    for (let i = 0; i < SP.cells.length && tried < 60; i += 61) {
      const c = SP.cells[i]; if (!c || !c.dir) continue;
      const facing = c.dir[0] * fwd.x + c.dir[1] * fwd.y + c.dir[2] * fwd.z;
      if (facing > -0.55) continue;              /* 只要接近正面的 */
      const P = new THREE.Vector3(c.dir[0] * M.R, c.dir[1] * M.R, c.dir[2] * M.R);
      const n = P.clone().project(cam);
      if (!(Math.abs(n.x) < 0.9 && Math.abs(n.y) < 0.9)) continue;
      const x = box.left + (n.x + 1) / 2 * box.width;
      const y = box.top + (1 - n.y) / 2 * box.height;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(n.x, n.y), cam);
      const hit = M.pickCiByRay(rc, null);
      const hc = SP.cells[hit];
      let arc = -1;
      if (hc && hc.dir) arc = Math.acos(Math.max(-1, Math.min(1, c.dir[0] * hc.dir[0] + c.dir[1] * hc.dir[1] + c.dir[2] * hc.dir[2]))) * M.R;
      const fog = (G.fog && G.fog.get(hit)) || 0;
      fog > 0 ? res.fogHit.pos++ : res.fogHit[0]++;
      res.probes.push({ want: i, wantT: c.type, got: hit, gotT: hc ? hc.type : '-', arcM: +arc.toFixed(1), same: hit === i });
      tried++;
    }
    res.total = tried;
    res.sameN = res.probes.filter((x) => x.same).length;
    return res;
  });
  console.log('取样 ' + r.total + ' 格 · 同格命中 ' + r.sameN + ' · 命中未探明格 ' + r.fogHit[0] + ' / 已探明 ' + r.fogHit.pos);
  r.probes.slice(0, 14).forEach((x) => console.log(`  want=${x.want}(${x.wantT}) → got=${x.got}(${x.gotT}) 弧距 ${x.arcM}m ${x.same ? '✓' : '✗'}`));
  const arcs = r.probes.filter((x) => x.arcM >= 0).map((x) => x.arcM).sort((a, b2) => a - b2);
  if (arcs.length) console.log('弧距分布: min=' + arcs[0] + ' 中位=' + arcs[arcs.length >> 1] + ' max=' + arcs[arcs.length - 1] + ' 米（格宽约 ' + (2 * Math.PI * 300 / 200).toFixed(1) + 'm）');
  await b.close();
})();
