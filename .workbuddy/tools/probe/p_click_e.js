/* ============================================================
 * p_click_e.js · 左键点野地只走、按 E 才弹
 * ------------------------------------------------------------
 * 老板：「左键一点就弹出来地块的信息，那这还能走吗？键位全他妈是冲突的」
 *
 * 判据：
 *   ① 点野地：面板**不弹**，且 `walkTarget` 有值（真的开始走）
 *   ② 点城格：面板弹出（实体格是"看目标"），且不把人拽过去
 *   ③ 站到野地上按 E：面板弹出（查看入口还在）
 * ============================================================ */
'use strict';
const { chromium } = require('playwright-core');
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pclicke';
const fs = require('fs');
let PASS = 0, FAIL = 0;
function ok(t, c, d) {
  if (c) { PASS++; console.log('OK   ' + t + (d ? '   [' + d + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + t + (d ? '   [' + d + ']' : '')); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '北辰', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((x) => {
      if (/知道了|跳过|关闭|开始/.test(x.textContent || '')) x.click();
    });
  });
  await p.waitForTimeout(900);
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false };
    });
    if (st.c && !st.boot) break;
    await p.waitForTimeout(200);
  }

  /* 拉近到地表，让"走路"有意义 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 62; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }
  await p.waitForTimeout(1500);

  const state = () => p.evaluate(() => {
    const M = GAME.map3d;
    const modal = document.querySelector('.modal-mask');
    return {
      surf: !!M._surf,
      ci: M.playerCi ? M.playerCi() : -1,
      kind: (M.cellKind && M._cell != null) ? (M.cellKind[M._cell] || 'wild') : null,
      cell: M._cell,
      modal: !!modal,
      modalText: modal ? (modal.textContent || '').replace(/\s+/g, ' ').slice(0, 40) : '',
      walk: M.walkTarget ? M.walkTarget() : -1
    };
  });

  /* 找一个**屏幕内**的野地格（用投影筛） */
  const pickWild = () => p.evaluate(() => {
    const M = GAME.map3d, cam = (M._camObj ? M._camObj() : M._cam);
    const cells = (M._collider && M._collider.cells) || [];
    const ci0 = M.playerCi ? M.playerCi() : -1;
    cam.updateMatrixWorld();
    let best = null;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c || !c.dir) continue;
      if ((M.cellKind && (M.cellKind[i] || 'wild') !== 'wild')) continue;
      if (ci0 >= 0 && i === ci0) continue;
      const R2 = M.R + 3;
      const v = new THREE.Vector3(c.dir[0] * R2, c.dir[1] * R2, c.dir[2] * R2);
      if (cam.position.distanceTo(v) > 46) continue;        /* 只在近景里找 */
      const s = v.clone().project(cam);
      if (Math.abs(s.x) > 0.55 || Math.abs(s.y) > 0.35 || s.z > 1) continue;
      const d = cam.position.distanceTo(v);
      if (!best || d < best.d) best = { d: d, ci: i, x: (s.x * 0.5 + 0.5) * 1440, y: (-s.y * 0.5 + 0.5) * 900 };
    }
    return best;
  });

  const w = await pickWild();
  console.log('—— 目标野地 ' + JSON.stringify(w));
  if (!w) { console.log('FATAL 近景找不到野地格'); await b.close(); return; }

  const s0 = await state();
  await p.mouse.click(w.x, w.y);
  await p.waitForTimeout(600);
  const s1 = await state();
  await p.screenshot({ path: OUT + '/1_click_wild.png' });
  ok('① 点野地：面板不弹', s1.modal === false, 'modal=' + s1.modal + ' text=' + s1.modalText);
  ok('① 点野地：真的开始走过去（walkTarget 有值）', s1.walk >= 0, 'walk=' + s1.walk + ' (点的是 ci=' + w.ci + ')');

  /* 站到野地上 → 按 E */
  const eRes = await p.evaluate(() => {
    const M = GAME.map3d;
    const before = !!document.querySelector('.modal-mask');
    return { before: before, near: !!(M.nearestInteractable && M.nearestInteractable()) };
  });
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(700);
  const s2 = await state();
  await p.screenshot({ path: OUT + '/2_press_e.png' });
  ok('③ 按 E：面板弹出（查看入口还在）', s2.modal === true,
    'modal=' + s2.modal + ' text=' + s2.modalText + ' near=' + eRes.near);

  /* ④ 屏幕上必须有操作说明，且文案是当前键位 */
  const hud = await p.evaluate(() => {
    const el = document.getElementById('follow-hud');
    return el ? { d: el.style.display, t: (el.textContent || '').replace(/\s+/g, ' ') } : null;
  });
  ok('④ 地表显示操作条（屏幕上唯一的操作说明）',
    !!hud && hud.d === 'block' && /左键 点哪走哪/.test(hud.t || ''),
    JSON.stringify(hud));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  if (errs.length) console.log('页面错误 ' + errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
