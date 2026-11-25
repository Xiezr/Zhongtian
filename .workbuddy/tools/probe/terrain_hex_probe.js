'use strict';
/* ============================================================
 * 地表"地块分块感"取证探针（v158.15 · 老板「六边形地块碍事」评估用）
 * ------------------------------------------------------------
 * 不是断言集 —— 只出证据：
 *   ① 跟随视角（老板实际看到的画面）
 *   ② 中景（相机后拉 20m / 俯角 35°）
 *   ③ 近战略（60m / 45°）——看地表是不是"一格一格"
 * 同时量化：地表平台格数、地形高程层级数、相邻格高差落点占比。
 * ============================================================ */
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const OUT = ROOT + '/.workbuddy/tmp/v15815_hex';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String((e && e.message) || e)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 40000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'hex', cityName: '灰岗', mapSeed: 20261125 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  await p.waitForTimeout(3000);

  /* 选一块已探明的森林野地（远离城格，避免城墙占满画面） */
  const pick = await p.evaluate(() => {
    const G = GAME, SP = G.mapSphere, cityCis = {};
    (G.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i];
      if (!c || cityCis[i]) continue;
      if (['forest', 'hill', 'caoyuan'].indexOf(c.type) < 0) continue;
      if (!((G.fog && G.fog.get(i)) > 0)) continue;
      return { ci: i, type: c.type };
    }
    return null;
  });
  console.log('PICK ' + JSON.stringify(pick));

  await p.evaluate((ci) => { GAME.map3d.teleportTo(ci); }, pick.ci);
  await p.waitForTimeout(900);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(2600);

  /* ① 跟随视角原样 */
  await p.screenshot({ path: OUT + '/01_follow.png' });

  const stat = await p.evaluate(() => {
    const M = GAME.map3d, SR = M._sr;
    const out = {
      follow: !!M.FOLLOW, dist: M.FOLLOW_DIST, pitch: M.FOLLOW_PITCH,
      surfRange: M.SURF_GRID_RANGE, buildCell: M.BUILD_CELL,
      tileLines: M.TILE_LINES, surfLines: M.SURF_LINES, buildGrid: M.BUILD_GRID
    };
    try {
      const g = SR && SR.plate && SR.plate.geometry;
      out.plateVerts = g ? g.attributes.position.count : 0;
      out.plateTris = g && g.index ? g.index.count / 3 : 0;
      /* 平台格数：每格 4 顶点（若按格铺）→ 粗算 */
      out.cells = SR && SR.cells || 0;
      /* 高程层级：取所有顶点到球心距离的唯一值数量（量化台阶感） */
      const pos = g.attributes.position.array;
      const set = new Set();
      for (let i = 0; i < pos.length; i += 3) {
        const r = Math.sqrt(pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]);
        set.add(Math.round((r - 300) * 2) / 2);   /* 0.5m 分桶 */
      }
      out.elevBuckets = set.size;
      const arr = Array.from(set).sort((a, c) => a - c);
      out.elevMin = arr[0]; out.elevMax = arr[arr.length - 1];
    } catch (e) { out.err = String(e); }
    return out;
  });
  console.log('STAT ' + JSON.stringify(stat));

  /* ② 中景：后拉 20m、俯 35° */
  await p.evaluate(() => {
    const M = GAME.map3d;
    M.FOLLOW_DIST = 20; M.FOLLOW_PITCH = 35; M._followPos = null;
    for (let i = 0; i < 3; i++) { try { M.render && M.render(0.016); } catch (e) { } }
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/02_mid.png' });

  /* ③ 近战略：60m、45° */
  await p.evaluate(() => {
    const M = GAME.map3d;
    M.FOLLOW_DIST = 60; M.FOLLOW_PITCH = 45; M._followPos = null;
    for (let i = 0; i < 3; i++) { try { M.render && M.render(0.016); } catch (e) { } }
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/03_high.png' });

  /* ④ 悬停高亮：模拟鼠标停在地面，看有没有六边形亮块 */
  const hi = await p.evaluate(() => {
    const M = GAME.map3d;
    return { hasGridHi: typeof M._gridHiVisible === 'function' ? M._gridHiVisible() : null,
             hiCell: M._hiCell || null, hoverCell: M._hoverCell || null };
  });
  console.log('HIGHLIGHT ' + JSON.stringify(hi));
  await p.mouse.move(700, 520);
  await p.waitForTimeout(700);
  const hi2 = await p.evaluate(() => {
    const M = GAME.map3d;
    return { hasGridHi: M._gridHiVisible ? M._gridHiVisible() : null, hiCell: M._hiCell || null };
  });
  console.log('HIGHLIGHT_AFTER_MOVE ' + JSON.stringify(hi2));
  await p.screenshot({ path: OUT + '/04_hover.png' });

  console.log('ERR ' + JSON.stringify(errs.slice(0, 4)));
  await b.close();
})();
