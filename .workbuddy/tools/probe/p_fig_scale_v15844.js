'use strict';
/* v158.44 验收探针：人物屏占比固定 —— 高空放大、地面真实比例（小于树）。
   真实开局 → 读 stand 人偶 scale → 滚轮升空/贴地 → 各高度采样屏占比。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fig_scale_v15844.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (ok) pass++; else fail++;
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.c && !st.boot) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(900);

  const figProbe = () => p.evaluate(() => {
    const M = GAME.map3d;
    const fp = M.figScaleProbe ? M.figScaleProbe() : {};
    return {
      stand: fp.stand == null ? null : +fp.stand.toFixed(2),
      city: fp.city == null ? null : +fp.city.toFixed(2),
      base: fp.base == null ? null : +fp.base.toFixed(2),
      dist: +(M._figDist || 0).toFixed(1),
      err: fp.err || M._fsErr1 || null
    };
  });

  /* ① 高空基线（开局 dist≈870）：放大 ≥ 8× */
  await p.waitForTimeout(400);
  const sHi = await figProbe();
  console.log('高空: ' + JSON.stringify(sHi));
  check('① 高空人偶放大 ≥ 8×（stand scale ≥ 8）且无运行时错误',
    sHi.stand != null && sHi.stand >= 8 && !sHi.err, JSON.stringify(sHi));

  /* ② 屏占比恒定：实际 stand 人偶高 / 屏对应世界高 ≈ 2.5% */
  const fracHi = await p.evaluate(() => {
    const M = GAME.map3d;
    const fp = M.figScaleProbe();
    const H = 1.2 * fp.stand;
    const d = M._figDist || 1;
    return H / (2 * d * Math.tan(42 * Math.PI / 360));
  });
  check('② 高空屏占比 ≈ 2.5%（恒定口径）',
    fracHi > 0.02 && fracHi < 0.03, (fracHi * 100).toFixed(2) + '%');

  /* ③ 滚轮降到地表：人偶回真实比例 0.5（人 0.6m，v158.46d「再一半」） */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(45); }
  await p.waitForTimeout(300);   /* 滚轮后短等：高度 HUD 仍在显示窗口内（<3s） */
  const sLo = await figProbe();
  console.log('地表: ' + JSON.stringify(sLo));
  check('③（v158.46d 口径）地表人偶回基准 0.5（人 0.6m、比例尺更大）',
    sLo.stand != null && sLo.stand >= 0.45 && sLo.stand <= 0.55
    && sLo.base != null && sLo.base <= 0.5, JSON.stringify(sLo));

  /* ④ 缩放只作用于 stand：城市人偶保持基准，不随高度放大 */
  const sCity = await figProbe();
  check('④ 城市人偶不被屏占比缩放（city scale 恒 ≤ 0.5，与高空 stand 不同源）',
    sCity.city != null && sCity.city <= 0.5 && sHi.stand > sCity.city,
    'city=' + sCity.city + ' standHi=' + sHi.stand);

  /* ⑤ 高度 HUD：常驻显示、海拔口径（数值随滚轮变化） */
  const altHud = await p.evaluate(() => {
    const el = document.getElementById('alt-hud');
    const M = GAME.map3d;
    return {
      visible: !!el && el.style.display !== 'none',
      text: el ? (el.textContent || '') : '',
      rAlt: +(M._rAlt || 0).toFixed(1)
    };
  });
  console.log('高度 HUD: ' + JSON.stringify(altHud));
  check('⑤ 相机高度 HUD 常驻显示且为海拔口径（文本含数值 ≈ _rAlt）',
    altHud.visible && /海拔/.test(altHud.text) && /\d+/.test(altHud.text)
    && Math.abs(parseInt((altHud.text.match(/\d+/) || [])[0], 10) - Math.round(altHud.rAlt)) <= 1,
    altHud.text + ' rAlt=' + altHud.rAlt);

  /* ⑥（v158.46c 老板「不要占据用户的心智」）：静止 3 秒后高度 HUD 淡出；
     键位条（follow-hud）首次进地表 8 秒后淡出 —— 游戏外内容不长久挂屏 */
  await p.waitForTimeout(4200);   /* 距最后高度变化已 > 4.5s（3s 阈值 + 淡出余量） */
  const altGone = await p.evaluate(() => {
    const el = document.getElementById('alt-hud');
    return !el || el.style.display === 'none' || el.style.opacity === '0';
  });
  await p.waitForTimeout(5500);   /* 进地表已 > 10s */
  const fhGone = await p.evaluate(() => {
    const el = document.getElementById('follow-hud');
    return !el || el.style.display === 'none' || el.style.opacity === '0';
  });
  check('⑥ 静止 3 秒后高度 HUD 淡出、键位条 8 秒后淡出（不长久挂载）',
    altGone && fhGone, 'altGone=' + altGone + ' fhGone=' + fhGone);

  check('⑤ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
