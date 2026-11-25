/* 真实玩家路径：开局 → 滚轮拉近 → 进地表。看小人到底在不在画面里 */
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
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(800);

  const dump = () => p.evaluate(() => {
    const M = GAME.map3d, c = M._cam, o = M.camO;
    const pp = M.playerPose();
    const fg = M.figureOf('stand');
    const camR = Math.sqrt(c.position.x ** 2 + c.position.y ** 2 + c.position.z ** 2);
    let ndc = null, angDeg = null;
    if (fg && pp) {
      const v = new THREE.Vector3(fg.pos[0], fg.pos[1], fg.pos[2]).project(c);
      ndc = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)];
      const d0 = o.dir || [0, 1, 0];
      const dot = Math.max(-1, Math.min(1, pp.dir[0] * d0[0] + pp.dir[1] * d0[1] + pp.dir[2] * d0[2]));
      angDeg = +(Math.acos(dot) * 180 / Math.PI).toFixed(1);
    }
    return { surf: M._surf, dist: +o.dist.toFixed(1), camR: +camR.toFixed(1), eyeAbove: +(camR - M.R).toFixed(1),
      playerCi: M.playerCi(), figPos: fg ? fg.pos.map((v) => +v.toFixed(1)) : null,
      lensAngToPlayer: angDeg, figNdc: ndc,
      inView: ndc ? (Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1 && ndc[2] < 1) : false };
  });

  console.log('=== 开局（高空） ===', JSON.stringify(await dump()));

  /* 真实滚轮：一次滚 -120，连滚 26 次（模拟玩家拉近） */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 26; i++) {
    await p.mouse.wheel(0, -120);
    await p.waitForTimeout(90);
    if (i % 6 === 5) console.log('  滚动' + (i + 1) + '次:', JSON.stringify(await dump()));
  }
  await p.waitForTimeout(1800);
  const s1 = await dump();
  console.log('=== 拉近后 ===', JSON.stringify(s1));
  await p.screenshot({ path: OUT + '/3_real_wheel_in.png' });

  /* 继续滚到地表 */
  for (let i = 0; i < 26; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(70); }
  await p.waitForTimeout(1800);
  const s2 = await dump();
  console.log('=== 到地表 ===', JSON.stringify(s2));
  await p.screenshot({ path: OUT + '/4_real_surface.png' });

  /* 存档留档供后续检查 */
  fs.writeFileSync(OUT + '/state.json', JSON.stringify({ s1: s1, s2: s2 }, null, 1));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
