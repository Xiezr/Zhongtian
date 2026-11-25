/* 玩家路径取证：「回本城」到底把我带回去没有
 * 场景 A：跟随态（人在野地）点「回本城」→ 人在哪？
 * 场景 B：非跟随态（高空）点「回本城」→ 人在哪？
 * 场景 C：人在城格点「人物」→ 进街区（对照组）
 */
'use strict';
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2500);

  const st = () => p.evaluate(() => {
    const M = GAME.map3d;
    return {
      follow: !!M.FOLLOW, district: !!(GAME.district && GAME.district.active),
      ci: M.playerCi(), cityCi: (GAME.state.cities[0] || {}).ci,
      dist: +M.camO.dist.toFixed(0)
    };
  });

  console.log('起始       :', JSON.stringify(await st()));

  /* 先挪到野地 */
  await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere;
    const cc = {}; (G.state.cities || []).forEach((c) => { cc[c.ci] = 1; });
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i];
      if (!c || cc[i] || ['plain', 'caoyuan', 'forest'].indexOf(c.type) < 0) continue;
      if (!((G.fog && G.fog.get(i)) > 0)) continue;
      for (let k = 0; k < 4; k++) if (M.teleportTo(i)) break;
      break;
    }
    M.setFollow(true);
  });
  await p.waitForTimeout(2000);
  const wild = await st();
  console.log('A0 野地跟随:', JSON.stringify(wild));

  /* 场景 A：跟随态点「回本城」 */
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(3200);
  const A = await st();
  console.log('A1 点回本城:', JSON.stringify(A));
  console.log('   → 人跟着回去了吗？', A.ci === A.cityCi ? 'YES' : 'NO（仍在 ci=' + A.ci + '，城在 ' + A.cityCi + '）');

  /* 场景 A2：这时再点「人物」会进街区吗 */
  await p.click('[data-action="follow-toggle"]');
  await p.waitForTimeout(2600);
  const A2 = await st();
  console.log('A2 再点人物:', JSON.stringify(A2), A2.district ? '→ 进街区' : '→ 没进街区（人不在城格）');

  /* 场景 B：退出后高空点「回本城」 */
  await p.keyboard.press('KeyQ');
  await p.waitForTimeout(2000);
  console.log('B0 退出后  :', JSON.stringify(await st()));
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(3200);
  console.log('B1 点回本城:', JSON.stringify(await st()));

  /* 场景 C：把相机贴到城格（focusOnCell，玩家点「灰烬城」按钮等价）再点人物 */
  await p.evaluate((ci) => { GAME.map3d.focusOnCell(ci, true); }, A.cityCi);
  await p.waitForTimeout(2600);
  console.log('C0 贴城    :', JSON.stringify(await st()));
  await p.click('[data-action="follow-toggle"]');
  await p.waitForTimeout(2600);
  const C = await st();
  console.log('C1 点人物  :', JSON.stringify(C), C.district ? '→ 进街区' : '→ 没进街区');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/pjourney/09_district_check.png' });

  /* 街区态下主角投影 */
  if (C.district) {
    const proj = await p.evaluate(() => {
      const M = GAME.map3d, cam = M._cam, q = M.playerPose();
      const by = M.R + q.h + 0.9;
      const B = new THREE.Vector3(q.dir[0] * by, q.dir[1] * by, q.dir[2] * by);
      const n = B.clone().project(cam);
      return { dist: +cam.position.distanceTo(B).toFixed(2), ndc: { x: +n.x.toFixed(2), y: +n.y.toFixed(2), z: +n.z.toFixed(2) },
        inView: Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && n.z < 1,
        dPos: { x: +GAME.district.pos.x.toFixed(2), z: +GAME.district.pos.z.toFixed(2) },
        camPos: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(2)) };
    });
    console.log('C2 主角投影:', JSON.stringify(proj));
  }
  await b.close();
})();
