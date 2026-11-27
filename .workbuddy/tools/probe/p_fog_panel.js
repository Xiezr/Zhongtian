'use strict';
/* v158.43（老板「不要再弹出这个了『未探明地块』」）：点未探明格**静默**——
   不弹一级面板、不弹出征调配、不 toast。按诉求 2 拍板口径「常规点击地面无响应」。
   （v158.38 版本曾断言"先弹一级面板→派队探索"，面板已整条退役。）
   真实开局 → 真射线找雾格 → 真点 → 断言零弹窗。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fog_panel.js */
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'P', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    const busy = await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent));
    if (!busy) break;
  }
  await p.waitForTimeout(2600);

  let pass = 0, fail = 0;
  const check = (name, ok, extra) => {
    console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (ok) pass++; else fail++;
  };
  const snap = () => p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const txt = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    return {
      open: !!m,
      head: m ? ((m.querySelector('.gold-heading') || {}).textContent || '').trim() : '',
      txt: txt.slice(0, 120)
    };
  });

  /* ① 找一块玩家视野里 fog=0 的格子（真射线拾取，真屏幕坐标） */
  const fogTile = await p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere;
    const cv = document.getElementById('mapCanvas'), r = cv.getBoundingClientRect();
    for (let gy = 0.25; gy < 0.8; gy += 0.02) {
      for (let gx = 0.25; gx < 0.8; gx += 0.02) {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(gx * 2 - 1, -(gy * 2 - 1)), M._cam);
        const ci = M.pickCiByRay(rc, null);
        if (ci == null || !SP.cells[ci]) continue;
        if (GAME.fog && GAME.fog.get(ci) === 0)
          return { ci, x: Math.round(r.left + r.width * gx), y: Math.round(r.top + r.height * gy) };
      }
    }
    return null;
  });
  check('① 找到未探明格靶位', !!fogTile, fogTile ? ('ci=' + fogTile.ci) : 'no fog cell');

  if (fogTile) {
    await p.mouse.click(fogTile.x, fogTile.y);
    await p.waitForTimeout(900);
    const a = await snap();
    const cellMark = await p.evaluate(() => GAME.map3d._cellKind);
    console.log('未探明格点击后: modal=' + JSON.stringify(a) + ' cellKind=' + cellMark);
    check('② 点未探明格零弹窗（无一级面板、无出征调配）',
      !a.open, 'open=' + a.open + ' head=' + a.head);
    check('③ 点击仍被记录（_cellKind=unknown，静默≠没点到）',
      cellMark === 'unknown', 'cellKind=' + cellMark);
    /* 对照口径：战略态点野地无响应由 v158.43 §617② + p_fly_v15843⑩ 已覆盖，
       这里只守雾格这条（本需求核心）。 */
  }
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
