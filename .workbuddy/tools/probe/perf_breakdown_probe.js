/* 性能分解探针（v158.8）：定位 _surfTerrainGeo 剩余 58ms 的真实构成
 * 分别统计：
 *   1. SP.nearestCell 调用次数（增量缓存是否生效）
 *   2. sphElev / groundHAt 调用次数
 *   3. fbm3 调用次数（高频噪声是重活）
 * 通过打桩统计调用次数 + 用 performance 测总耗时，反推瓶颈。
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'perf', cityName: '灰岗', mapSeed: 20261023 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(2500);

  /* 打桩：统计 nearestCell / sphElev / fbm3 调用次数，并计时 */
  const res = await p.evaluate(() => {
    const M = GAME.map3d;
    const SP = GAME.sphere;
    if (!SP) return { err: 'no SP' };

    window.__stat = { nearestCell: 0, sphElev: 0, fbm3: 0, groundHAt: 0 };
    const _nc = SP.nearestCell.bind(SP);
    SP.nearestCell = function () { window.__stat.nearestCell++; return _nc.apply(SP, arguments); };
    const _se = SP.sphElev.bind(SP);
    SP.sphElev = function () { window.__stat.sphElev++; return _se.apply(SP, arguments); };
    const _fbm = SP.fbm3.bind(SP);
    SP.fbm3 = function () { window.__stat.fbm3++; return _fbm.apply(SP, arguments); };

    // 触发进入地表（先高空再贴地）
    M.setZoom(0.5);
    return new Promise((resolve) => {
      setTimeout(() => {
        // 记录打桩前基线
        const base = { nearestCell: window.__stat.nearestCell, sphElev: window.__stat.sphElev, fbm3: window.__stat.fbm3 };
        // 计时进入地表
        const t0 = performance.now();
        M.setZoom(0.004);
        // 等一帧让 rebuildSurf 跑完
        setTimeout(() => {
          const ms = performance.now() - t0;
          const after = { nearestCell: window.__stat.nearestCell, sphElev: window.__stat.sphElev, fbm3: window.__stat.fbm3 };
          const st = M.surfStats ? M.surfStats() : null;
          resolve({
            ms: +ms.toFixed(1),
            base, after,
            delta: {
              nearestCell: after.nearestCell - base.nearestCell,
              sphElev: after.sphElev - base.sphElev,
              fbm3: after.fbm3 - base.fbm3
            },
            timing: st ? st.timing : null,
            verts: st ? st.verts : null
          });
        }, 100);
      }, 500);
    });
  });

  console.log(JSON.stringify(res, null, 2));
  console.log('运行时错误: ' + (errs.length ? errs.join(' | ') : '无'));
  await b.close();
})().catch(e => { console.error('探针崩溃:', e); process.exit(2); });
