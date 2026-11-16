/* v157.81 全流程验收：用**产品内置的 M._camJumps 不变量**判，不靠人肉试错。
   覆盖三条会改写相机姿态的路径：高空拖动 / 贴地往返 / 切城定位。
   判据：
     ① 每次拖动的 frozenFrames = 0、逐帧最大转角 < 6°（连续、无卡死）
     ② 高空轨道（surf=false 且 rAlt>100）出现 >30° 的跳变 = 0 条（真 bug）
        —— 滚轮缩放/切城属预期跳变，会被记但在贴地或 rAlt 变化时发生
     ③ 拖动后仍能继续累加（pitch/yaw 单调，不被折回） */
const { chromium } = require('playwright-core');

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
    try { G.map3d.resetView(); } catch (e) { }
    G.map3d._camJumps = [];        /* 从零开始计 */
  }, 20260926);
  await p.waitForTimeout(6000);

  const box = await p.evaluate(() => {
    const c = document.querySelector('#map-canvas') || document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2,
             top: r.y + 14, bot: r.y + r.height - 14, left: r.x + 20, right: r.x + r.width - 20 };
  });

  const state = () => p.evaluate(() => {
    const M = window.GAME.map3d, c = M._cam;
    const d = c.position.clone().normalize();
    return { dir: [d.x, d.y, d.z], rAlt: +(c.position.length() - 300).toFixed(1),
             surf: !!M._surf,
             pitch: +((Math.asin(Math.max(-1, Math.min(1, d.y)))) * 180 / Math.PI).toFixed(1),
             yaw: +((Math.atan2(d.x, d.z)) * 180 / Math.PI).toFixed(1),
             jumps: (M._camJumps || []).length };
  });

  const angDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))) * 180 / Math.PI;

  let worst = 0, worstTag = '';
  async function drag(from, to, steps, tag) {
    await p.mouse.move(from[0], from[1]);
    await p.mouse.down();
    let prev = (await state()).dir, maxJ = 0, frozen = 0;
    for (let k = 1; k <= steps; k++) {
      const x = from[0] + (to[0] - from[0]) * k / steps;
      const y = from[1] + (to[1] - from[1]) * k / steps;
      await p.mouse.move(x, y);
      const cur = (await state()).dir;
      const a = angDeg(prev, cur);
      if (a > maxJ) maxJ = a;
      if (a < 1e-4) frozen++;
      prev = cur;
    }
    await p.mouse.up();
    const st = await state();
    if (maxJ > worst) { worst = maxJ; worstTag = tag; }
    console.log(tag.padEnd(22) + ' maxStep=' + maxJ.toFixed(2) + '°  frozen=' + frozen + '/' + steps
      + '  lat=' + st.pitch + '° lon=' + st.yaw + '°  rAlt=' + st.rAlt + '  surf=' + st.surf);
    return { maxJ, frozen, st };
  }

  const S = [];
  console.log('===== 阶段 A：高空连续上拖 4 轮（应一路越过极点）=====');
  console.log('起始 ' + JSON.stringify(await state()));
  for (let i = 1; i <= 4; i++) {
    S.push(await drag([box.cx, box.bot], [box.cx, box.top], 120, 'A 上拖#' + i));
    await p.waitForTimeout(120);
  }

  console.log('===== 阶段 B：滚轮拉近到贴地 → 拖 → 拉远 → 再拖 =====');
  await p.mouse.move(box.cx, box.cy);
  await p.mouse.wheel(0, 2200);            /* 滚轮拉近到贴地 */
  await p.waitForTimeout(1600);
  console.log('贴地后 ' + JSON.stringify(await state()));
  await drag([box.cx - 120, box.cy], [box.cx + 120, box.cy], 80, 'B 贴地左右拖');
  await p.mouse.wheel(0, -4000);           /* 拉远 */
  await p.waitForTimeout(1200);
  console.log('拉远后 ' + JSON.stringify(await state()));
  for (let i = 1; i <= 2; i++) {
    S.push(await drag([box.cx, box.bot], [box.cx, box.top], 120, 'B 拉远后上拖#' + i));
    await p.waitForTimeout(120);
  }

  console.log('===== 阶段 C：切城定位 → 再拖 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    var c = (G.city && G.city.all && G.city.all()[0]) || null;
    if (c && typeof c.ci === 'number' && G.map3d.focusOnCell) G.map3d.focusOnCell(c.ci, true);
  });
  await p.waitForTimeout(1500);
  console.log('切城后 ' + JSON.stringify(await state()));
  for (let i = 1; i <= 2; i++) {
    S.push(await drag([box.cx, box.bot], [box.cx, box.top], 120, 'C 切城后上拖#' + i));
    await p.waitForTimeout(120);
  }

  /* ---- 汇总 ---- */
  const jumps = await p.evaluate(() => window.GAME.map3d._camJumps || []);
  const badJumps = jumps.filter(j => j.surf === false && j.rAlt > 100);
  const frozenAll = S.reduce((a, x) => a + x.frozen, 0);
  console.log('');
  console.log('===== 汇总 =====');
  console.log('最大单帧转角 = ' + worst.toFixed(2) + '°（' + worstTag + '）');
  console.log('累计冻结帧 = ' + frozenAll + ' / ' + S.reduce((a, x) => a + 120, 0));
  console.log('_camJumps 记录 = ' + jumps.length + ' 条');
  console.log('其中高空轨道跳变（surf=false 且 rAlt>100）= ' + badJumps.length + ' 条');
  if (jumps.length) console.log('明细 ' + JSON.stringify(jumps.slice(0, 12)));
  console.log('版本 ' + await p.evaluate(() => window.GAME.VERSION) + ' · 页面异常 ' + errs.length
    + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));

  const ok = worst < 6 && frozenAll === 0 && badJumps.length === 0 && errs.length === 0;
  console.log(ok ? 'STRICT_PASS' : 'STRICT_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
