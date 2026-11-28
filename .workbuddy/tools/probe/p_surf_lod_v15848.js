'use strict';
/* v158.48 验收探针：海拔 60~40 景物加载无跳变（提前加载 + 预览淡入 + 分档缩略）
   + 近地滚轮每格 1~2m。
   真实开局 → 滚轮从高空逐档降到 60/55/48/40 → 每档断言：地表层已构建、
   预览 alpha 渐入、分档（先树后草石）、滚轮精度。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_surf_lod_v15848.js */
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
  await p.waitForTimeout(600);
  await p.mouse.move(720, 450);

  /* 直接写 zoom 目标到指定海拔（滚轮连续路径另有 §243①q/滚轮探针覆盖，
     这里聚焦"高度→加载状态"的对应关系；走公开入口 M._zoomTo(球心距离)） */
  const goAgl = async (agl) => {
    await p.evaluate((a) => {
      const M = GAME.map3d;
      M._zoomTo(M.R + a, false);
      M.camFree = true;
    }, agl);
    await p.waitForTimeout(1500);
  };
  const snap = () => p.evaluate(() => {
    const M = GAME.map3d;
    const st = M.surfStats ? M.surfStats() : null;
    const meshes = (M._surfScat && M._surfScat.meshes) ? M._surfScat.meshes : [];
    let grassVis = null, treeVis = null;
    meshes.forEach((im) => {
      if (!im || !im.name) return;
      if (im.name === 'surfScatter_trunk') treeVis = im.visible;
      if (im.name === 'surfScatter_grass') grassVis = im.visible;
    });
    return {
      surf: !!M._surf,
      rAlt: +(M._rAlt || 0).toFixed(1),
      alpha: +(M.surfAlpha ? M.surfAlpha() : -1).toFixed(3),
      built: !!st,
      grassVis: grassVis, treeVis: treeVis,
      step50: +((M._zoomCurveProbe(50, 100) / 50) - 1).toFixed(3),
      step40: +((M._zoomCurveProbe(40, 100) / 40) - 1).toFixed(3)
    };
  });

  /* ① 海拔 60m（轨道态、<65）：地表层已提前构建，alpha 渐入中段（≈0.26） */
  await goAgl(60);
  const s60 = await snap();
  console.log('60m: ' + JSON.stringify(s60));
  check('① 海拔 60m（轨道态）地表层已提前构建、alpha 渐入中段（无"突然 new"）',
    !s60.surf && s60.built && s60.alpha > 0.20 && s60.alpha < 0.35,
    JSON.stringify(s60));

  /* ② 海拔 55m：预览 alpha 封顶 0.45（缩略感）；仍轨道态 */
  await goAgl(55);
  const s55 = await snap();
  console.log('55m: ' + JSON.stringify(s55));
  check('② 海拔 55m：预览 alpha 已到 0.45 缩略感上限',
    s55.alpha > 0.40 && s55.alpha <= 0.46, 'alpha=' + s55.alpha);

  /* ③ 海拔 48m（surf 态）：alpha 继续上升（>0.5）；分档开启——草石可见 */
  await goAgl(48);
  const s48 = await snap();
  console.log('48m: ' + JSON.stringify(s48));
  check('③ 海拔 48m：地表态 alpha 上升（>0.5）、细节分档开启（草可见）',
    s48.surf && s48.alpha > 0.5 && s48.grassVis === true && s48.treeVis === true,
    JSON.stringify(s48));

  /* ④ 海拔 40m：全实；分档维持 */
  await goAgl(40);
  const s40 = await snap();
  console.log('40m: ' + JSON.stringify(s40));
  check('④ 海拔 40m：全实 alpha≈1',
    s40.surf && s40.alpha > 0.9, 'alpha=' + s40.alpha);

  /* ⑤ 分档在高空（轨道态预览时）草石隐藏：回到 62m（轨道）看 grassVis */
  await goAgl(62);
  const s62 = await snap();
  console.log('62m: ' + JSON.stringify(s62));
  check('⑤ 海拔 62m（轨道态预览）：只显树（草隐藏）——先大件后细节',
    !s62.surf && s62.built && s62.grassVis === false && s62.treeVis === true,
    JSON.stringify(s62));

  /* ⑥ 近地滚轮精度：50m 处每格 ≈2m（≤4.5%）、40m 处 ≤5.5% */
  check('⑥ 近地滚轮精度：50m 每格 ≤4.5%（≈2m）、40m 每格 ≤5.5%（≈1.8m）',
    s60.step50 > 0.03 && s60.step50 < 0.045 && s60.step40 > 0.035 && s60.step40 < 0.055,
    'step50=' + s60.step50 + ' step40=' + s60.step40);

  check('⑦ 全程无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
