/* 区域加载实况探针（v158.8 前置取证）
 * 目标：用数据回答「近地面是否在重复全球加载」。
 * 测三点：
 *   A. 进入地表时 rebuildSurf 建了多少顶点 / 花了多久（是"区域"级还是"全球"级）
 *   B. 反复缩放（高空↔近地面）5 轮，全球几何 buildGlobe/buildTiles 是否被触发重建
 *      （通过 M.rebuild 计数 + built 是否可观测；用 _pver 不变作旁证）
 *   C. 每轮 patch 重建的分段耗时（terr/plate/scatter），定位真卡点
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : ''))) : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : ''))); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'zone', cityName: '灰岗', mapSeed: 20261023 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(2500);

  /* 给 map3d 打桩：数 rebuildSurf 与 rebuild 的调用次数 */
  await p.evaluate(() => {
    const M = GAME.map3d;
    window.__cnt = { rebuildSurf: 0, rebuild: 0, surfMsSum: 0, surfVertsSum: 0 };
    const origRebuild = M.rebuild;
    M.rebuild = function () { window.__cnt.rebuild++; return origRebuild.apply(this, arguments); };
    const origRebuildSurf = M.rebuildSurf;
    M.rebuildSurf = function () {
      window.__cnt.rebuildSurf++;
      const r = origRebuildSurf.apply(this, arguments);
      if (M._sr) { window.__cnt.surfMsSum += M._sr.builtMs; window.__cnt.surfVertsSum += M._sr.verts; }
      return r;
    };
  });

  /* A. 进入地表，读 surfStats */
  await p.evaluate(() => { GAME.map3d.setZoom(0.004); });
  await p.waitForTimeout(800);
  const A = await p.evaluate(() => {
    const M = GAME.map3d;
    const st = M.surfStats ? M.surfStats() : null;
    return {
      surf: !!M._surf, verts: st ? st.verts : null, ms: st ? st.ms : null,
      timing: st ? st.timing : null, ci: st ? st.ci : null, cnt: window.__cnt
    };
  });
  ok('A1 已进入地表模式', A.surf === true, 'surf=' + A.surf);
  ok('A2 地表 patch 顶点数（区域级，应 < 10 万，非 4 万格全球）',
    A.verts != null && A.verts < 100000, 'verts=' + A.verts);
  ok('A3 patch 重建耗时（应 < 50ms）', A.ms != null && A.ms < 50, 'ms=' + A.ms);
  console.log('    └ 分段 timing=' + JSON.stringify(A.timing));

  /* B. 反复缩放 5 轮，观察 rebuild 是否被触发（全球重建） */
  for (let i = 0; i < 5; i++) {
    await p.evaluate(() => { GAME.map3d.setZoom(0.5); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { GAME.map3d.setZoom(0.004); });
    await p.waitForTimeout(700);
  }
  const B = await p.evaluate(() => {
    const M = GAME.map3d;
    return { cnt: window.__cnt, pver: M._pver, surf: !!M._surf };
  });
  ok('B1 5 轮缩放 rebuild（全球重建）0 次', B.cnt.rebuild === 0, 'rebuild=' + B.cnt.rebuild);
  ok('B2 rebuildSurf 被调用 ≥ 5 次（区域 patch 随进入地表重建）', B.cnt.rebuildSurf >= 5, 'rebuildSurf=' + B.cnt.rebuildSurf);
  const avgMs = B.cnt.rebuildSurf > 0 ? (B.cnt.surfMsSum / B.cnt.rebuildSurf) : 0;
  const avgVerts = B.cnt.rebuildSurf > 0 ? (B.cnt.surfVertsSum / B.cnt.rebuildSurf) : 0;
  console.log('    └ 平均 patch 重建 ' + avgMs.toFixed(1) + 'ms / ' + Math.round(avgVerts) + ' 顶点 / 共 ' + B.cnt.rebuildSurf + ' 次');

  /* C. 连续快速缩放（模拟玩家狂滚轮），看会不会卡 */
  await p.evaluate(() => {
    window.__frames = [];
    const M = GAME.map3d;
    let t0 = performance.now();
    const step = () => {
      const dt = performance.now() - t0;
      window.__frames.push(dt);
      if (dt < 3000) requestAnimationFrame(step);
      else window.__done = true;
    };
    for (let i = 0; i < 10; i++) {
      setTimeout(() => { try { M.setZoom(Math.random() < 0.5 ? 0.004 : 0.6); } catch (e) {} }, i * 300);
    }
    requestAnimationFrame(step);
  });
  await p.waitForFunction('window.__done === true', null, { timeout: 10000 });
  const C = await p.evaluate(() => {
    const f = window.__frames;
    let maxGap = 0;
    for (let i = 1; i < f.length; i++) maxGap = Math.max(maxGap, f[i] - f[i - 1]);
    return { maxGap: +maxGap.toFixed(1), frames: f.length };
  });
  ok('C1 狂缩放 3 秒内最大帧间隔 < 100ms（无明显卡顿）', C.maxGap < 100, 'maxGap=' + C.maxGap + 'ms / ' + C.frames + '帧');

  console.log('    └ 运行时错误: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('探针崩溃:', e); process.exit(2); });
