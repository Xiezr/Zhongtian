/* v157.83 实机取证：球体跟不跟手 + 画面有没有 roll。
   判据（不看截图，只看数值）：
     ① turntable 姿态：|pitch|<75° 时画面 roll ≈ 0（v157.82 是 10°~39°，随俯角漂）
     ② 跟手契约：右拖 → 相机经度减小（内容左移）；下拖 → 纬度增大（内容下移）
     ③ 逐帧连续：单帧 dir 转角 < 6°，无冻结帧
     ④ 自转不打架：开自转 2s 后拖 1px，dir 只该动 ≈0.29°（旧版会跳回自转前角度）
   另外出 3 张截图供人看地平线是否水平。 */
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
    try { G.map3d.setSpin(false); } catch (e) { }      /* 先关自转，测纯拖动 */
    G.map3d._camJumps = [];
  }, 20260926);
  await p.waitForTimeout(5000);

  const box = await p.evaluate(() => {
    const c = document.querySelector('#map-canvas') || document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2,
             top: r.y + 14, bot: r.y + r.height - 14, left: r.x + 20, right: r.x + r.width - 20 };
  });

  const state = () => p.evaluate(() => {
    const M = window.GAME.map3d, c = M._cam, T = window.THREE;
    const f = new T.Vector3(0, 0, -1).applyQuaternion(c.quaternion).normalize();
    const up = new T.Vector3(0, 1, 0).applyQuaternion(c.quaternion).normalize();
    const yUp = new T.Vector3(0, 1, 0);
    const ref = yUp.clone().addScaledVector(f, -yUp.dot(f));
    const roll = ref.lengthSq() > 1e-9
      ? Math.acos(Math.max(-1, Math.min(1, up.dot(ref.normalize())))) * 180 / Math.PI : NaN;
    const d = c.position.clone().normalize();
    return {
      dir: [d.x, d.y, d.z],
      rAlt: +(c.position.length() - 300).toFixed(1),
      surf: !!M._surf,
      pitch: +((Math.asin(Math.max(-1, Math.min(1, d.y)))) * 180 / Math.PI).toFixed(2),
      yaw: +((Math.atan2(d.x, d.z)) * 180 / Math.PI).toFixed(2),
      roll: +roll.toFixed(2),
      camPitch: +(M.camO.pitch * 180 / Math.PI).toFixed(2),
      quat: [c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w],
      jumps: (M._camJumps || []).length
    };
  });

  const angDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))) * 180 / Math.PI;

  async function drag(from, to, steps, tag) {
    await p.mouse.move(from[0], from[1]);
    await p.mouse.down();
    let prev = (await state()).dir, maxJ = 0, frozen = 0, maxRoll = 0;
    for (let k = 1; k <= steps; k++) {
      const x = from[0] + (to[0] - from[0]) * k / steps;
      const y = from[1] + (to[1] - from[1]) * k / steps;
      await p.mouse.move(x, y);
      const s = await state();
      const a = angDeg(prev, s.dir);
      if (a > maxJ) maxJ = a;
      if (a < 1e-4) frozen++;
      if (isFinite(s.roll) && s.roll > maxRoll) maxRoll = s.roll;
      prev = s.dir;
    }
    await p.mouse.up();
    const st = await state();
    console.log(tag.padEnd(20) + ' maxStep=' + maxJ.toFixed(2) + '°  frozen=' + frozen + '/' + steps
      + '  maxRoll=' + maxRoll.toFixed(2) + '°  lat=' + st.pitch + '° lon=' + st.yaw + '°');
    return { maxJ, frozen, maxRoll, st };
  }

  console.log('起始 ' + JSON.stringify(await state()));
  await p.screenshot({ path: '.workbuddy/tmp/v15783_a_start.png' });

  console.log('===== ① 右拖 200px（契约：内容左移 → 经度减小）=====');
  const before = await state();
  const R1 = await drag([box.cx - 100, box.cy], [box.cx + 100, box.cy], 100, '右拖');
  const dYaw = ((R1.st.yaw - before.yaw + 540) % 360) - 180;
  console.log('  Δlon = ' + dYaw.toFixed(2) + '°（应 < 0）· Δroll = ' + (R1.st.roll - before.roll).toFixed(2) + '°');

  console.log('===== ② 下拖 200px（契约：内容下移 → 纬度增大 / pitch 增大）=====');
  const b2 = await state();
  const R2 = await drag([box.cx, box.cy - 100], [box.cx, box.cy + 100], 100, '下拖');
  console.log('  Δlon = ' + (((R2.st.yaw - b2.yaw + 540) % 360) - 180).toFixed(2)
    + '° · Δlat = ' + (R2.st.pitch - b2.pitch).toFixed(2) + '°（应 > 0）');

  console.log('===== ③ 连续上拖 3 轮（越过极点），看 roll 过渡与冻结 =====');
  for (let i = 1; i <= 3; i++) {
    await drag([box.cx, box.bot], [box.cx, box.top], 130, '上拖#' + i);
    await p.waitForTimeout(150);
  }
  await p.screenshot({ path: '.workbuddy/tmp/v15783_b_pole.png' });

  console.log('===== ④ 自转 2s 后拖 1px（旧版会跳回自转前角度）=====');
  await p.evaluate(() => { const M = window.GAME.map3d; M.resetView(); M._camJumps = []; });
  await p.waitForTimeout(800);
  await p.evaluate(() => { window.GAME.map3d.setSpin(true); });
  await p.waitForTimeout(2200);
  const s4 = await state();
  const s5 = await (async () => {
    await p.mouse.move(box.cx, box.cy);
    await p.mouse.down();
    await p.mouse.move(box.cx + 1, box.cy);
    const r = await state();
    await p.mouse.up();
    return r;
  })();
  const spinJump = angDeg(s4.dir, s5.dir);
  console.log('  自转后 dir=' + s4.dir.map(x => x.toFixed(3)).join(',')
    + '  拖 1px 后 dir=' + s5.dir.map(x => x.toFixed(3)).join(',')
    + '  跳变=' + spinJump.toFixed(3) + '°（应 ≈0.29°，>2° 即为打架）');
  await p.evaluate(() => { window.GAME.map3d.setSpin(false); });

  console.log('===== ⑤ 中/远两张图 =====');
  await p.evaluate(() => { const M = window.GAME.map3d; M.resetView(); M._camJumps = []; });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/tmp/v15783_c_far.png' });
  await p.mouse.move(box.cx, box.cy);
  await p.mouse.wheel(0, 1400);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '.workbuddy/tmp/v15783_d_near.png' });

  const jumps = await p.evaluate(() => window.GAME.map3d._camJumps || []);
  const bad = jumps.filter(j => j.surf === false && j.rAlt > 100);
  console.log('');
  console.log('高空轨道跳变 = ' + bad.length + ' 条 · 全部记录 = ' + jumps.length
    + (jumps.length ? ' :: ' + JSON.stringify(jumps.slice(0, 8)) : ''));
  console.log('版本 ' + await p.evaluate(() => window.GAME.VERSION)
    + ' · 页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));

  const ok = R1.maxRoll < 1.0 && Math.abs(dYaw) > 5 && dYaw < 0
    && spinJump < 2 && R2.maxJ < 6 && bad.length === 0 && errs.length === 0;
  console.log(ok ? 'ROLLFIX_PASS' : 'ROLLFIX_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
