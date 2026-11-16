/* 穿云全过程扫掠：验证「穿云是事件不是状态」。
   判据：
     ① 连续滚轮跨层时，veil 出现峰值（>0.3）—— 穿云感还在
     ② 停在云层高度 2 秒后，veil 必须回到 0（旧版这里恒 1.000，就是"色斑"）
     ③ 停在 hC±1.5 米抖动时不许反复触发（滞回）
     ④ haze 最多 0.08，且只在 hC±5 米内
   另出 3 张图：穿层瞬间 / 停住 / 总览。 */
const { chromium } = require('playwright-core');
const OUT = '.workbuddy/tmp/';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.setSpin(false); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(4500);

  const box = await p.evaluate(function () {
    var c = document.querySelector('#map-canvas') || document.querySelector('canvas');
    var r = c.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  const st = () => p.evaluate(function () {
    var M = window.GAME.map3d;
    return { agl: +(M.camO.dist - M.R).toFixed(1), veil: +(M._cloudVeil || 0).toFixed(3),
      haze: +(M._cloudHaze || 0).toFixed(3), surf: !!M._surf,
      puffs: M._puffs ? M._puffs.visible : null };
  });

  await p.mouse.move(box.cx, box.cy);
  console.log('起始 ' + JSON.stringify(await st()));

  console.log('=== ① 连续滚轮拉近（跨越云层）===');
  let peak = 0, samples = [];
  for (let i = 0; i < 12; i++) {
    await p.mouse.wheel(0, -420);   /* 负 = 拉近（实测：正 deltaY 是拉远） */
    await p.waitForTimeout(120);
    const s = await st();
    samples.push(s);
    if (s.veil > peak) peak = s.veil;
    if (i === 3) await p.screenshot({ path: OUT + 'v15784_cross_mid.png' });
  }
  samples.forEach(function (s, i) {
    if (i % 2 === 0) console.log('  #' + i + ' agl=' + s.agl + ' veil=' + s.veil + ' haze=' + s.haze + ' puffs=' + s.puffs);
  });
  console.log('  → 穿层峰值 veil = ' + peak.toFixed(3));

  console.log('=== ② 停在云层高度 2.2 秒（旧版这里恒 1.000）===');
  await p.evaluate(function () {
    var M = window.GAME.map3d;
    var d = M.R + 55;
    var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
    M.setZoom(f);
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  });
  await p.waitForTimeout(400);
  const mid = await st();
  await p.waitForTimeout(2200);
  const settled = await st();
  await p.screenshot({ path: OUT + 'v15784_hold55.png' });
  console.log('  0.4s 后 ' + JSON.stringify(mid));
  console.log('  2.6s 后 ' + JSON.stringify(settled));

  console.log('=== ③ 在 hC 上下来回微调 20 次（滞回）===');
  let triggers = 0, prevVeil = settled.veil;
  for (let i = 0; i < 20; i++) {
    await p.evaluate(function (k) {
      var M = window.GAME.map3d;
      var d = M.R + (k % 2 ? 53.6 : 56.4);
      var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
      M.setZoom(f);
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }, i);
    await p.waitForTimeout(90);
    const s = await st();
    if (s.veil > 0.5 && prevVeil < 0.5) triggers++;
    prevVeil = s.veil;
  }
  console.log('  ±1.4 米来回 20 次：触发次数 = ' + triggers + '（滞回应为 0）');

  console.log('=== ④ 拉远到总览 ===');
  await p.mouse.wheel(0, 4000);   /* 正 = 拉远到总览 */
  await p.waitForTimeout(1500);
  const far = await st();
  await p.screenshot({ path: OUT + 'v15784_far.png' });
  console.log('  ' + JSON.stringify(far));

  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  const ok = peak > 0.3 && settled.veil === 0 && mid.haze <= 0.081 && triggers === 0 && far.veil < 0.10 && errs.length === 0;
  console.log(ok ? 'CROSS_PASS' : 'CROSS_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
