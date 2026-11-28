'use strict';
/* v158.55 行为探针：右键拖过球心不再 180° 翻转（老板「越过屏幕中线，
   一下正面一下背面快速切换」）
   ------------------------------------------------------------
   根因：旧 pitch 轴 = cross(radial, head)，head∥radial 时退化翻转（数学对照
   实测 50 步翻 31 次）；新轴 = cross(head, up)（机体 right），与 head 恒正交。
   本探针：
     ① 纯数学对照：同初态同拖动，旧式必须有翻转、新式必须零翻转（防"探针没测到"）；
     ② 新式 head·rad 必须真正扫过球心到另一侧（>0.8 后回落，不卡极点）；
     ③ 产品源码形态：退化轴整条退役（静态锁）；
     ④ 真浏览器右键拖动无异常、head 与 up 保持正交、无 NaN；
     ⑤ 地表态右键不串飞行通道。
   跑法：NODE_PATH="..." node .workbuddy/tools/probe/p_fly_look_v15855.js
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const L = []; const log = (s) => { L.push(String(s)); console.log(s); };
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  log((cond ? '✅' : '❌') + ' ' + name + (detail ? ' · ' + detail : ''));
  cond ? pass++ : fail++;
}
const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const rot = (v, ax, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang), cr = cross(ax, v), d = dot(ax, v);
  return { x: v.x * c + cr.x * s + ax.x * d * (1 - c),
           y: v.y * c + cr.y * s + ax.y * d * (1 - c),
           z: v.z * c + cr.z * s + ax.z * d * (1 - c) };
};
const rad = norm(V([1 / Math.SQRT2, 1 / Math.SQRT2, 0]));
function simulate(mode) {
  let head = norm(V([0, 0, -1]));
  head = norm({ x: head.x - rad.x * dot(head, rad), y: head.y - rad.y * dot(head, rad), z: head.z - rad.z * dot(head, rad) });
  let up = V([rad.x, rad.y, rad.z]);
  const S = [], K = 0.0042, STEP = 20;
  for (let i = 0; i < 50; i++) {
    let axis;
    if (mode === 'old') {
      axis = cross(rad, head);
      if (Math.hypot(axis.x, axis.y, axis.z) < 1e-4) axis = V([1, 0, 0]);
      axis = norm(axis);
    } else {
      up = norm({ x: up.x - head.x * dot(up, head), y: up.y - head.y * dot(up, head), z: up.z - head.z * dot(up, head) });
      axis = norm(cross(head, up));
    }
    S.push({ d: +dot(head, rad).toFixed(4), right: [axis.x, axis.y, axis.z] });
    head = rot(norm(head), axis, -STEP * K);
    if (mode === 'new') up = rot(norm(up), axis, -STEP * K);
  }
  let flips = 0, minDot = 1;
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1].right, b2 = S[i].right;
    const d = a[0] * b2[0] + a[1] * b2[1] + a[2] * b2[2];
    minDot = Math.min(minDot, d);
    if (d < -0.5) flips++;
  }
  return { flips, minDot: +minDot.toFixed(3), dMin: Math.min(...S.map((s) => s.d)),
    dMax: Math.max(...S.map((s) => s.d)), dEnd: S[S.length - 1].d };
}
(async () => {
  const oldR = simulate('old'), newR = simulate('new');
  ok('①旧式退化轴确实翻转（对照有效，≥10 次）', oldR.flips >= 10,
    '旧翻转=' + oldR.flips + ' 最小right点积=' + oldR.minDot);
  ok('②新式机体轴零翻转（相邻 right 点积 ≥ -0.5）', newR.flips === 0,
    '新翻转=' + newR.flips + ' 最小right点积=' + newR.minDot);
  /* 关键是"能越过 0.8 且继续变化不卡住"——50 步未必走完整圈，
     只要 d 越过 0.8 且后续 dMin<0（扫到另一侧）即证明没卡在极点 */
  ok('③新式机头扫过球心不卡极点（越过 0.8 且到过另一侧）',
    newR.dMax > 0.8 && newR.dMin < -0.5,
    'd 范围=' + newR.dMin + '~' + newR.dMax + ' 末值=' + newR.dEnd);
  const src = fs.readFileSync(ROOT + '/js/map3d.js', 'utf8');
  ok('④源码锁：新机体基在岗、旧 radial 退化轴退役',
    /crossVectors\(_fh, _fu\)\.normalize\(\)/.test(src)
      && /_qLook\.setFromAxisAngle\(_fu, -_dx \* _K\)/.test(src)
      && /_qLook\.setFromAxisAngle\(_fright, -_dy \* _K\)/.test(src)
      && /M\._fly\.up = \[_fu\.x, _fu\.y, _fu\.z\]/.test(src)
      && !/crossVectors\(_frad, _fh\)/.test(src)
      && !/_fh\.applyAxisAngle\(_frad/.test(src), '新轴 + head/up 同步 + 旧轴消失');
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'L', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(700);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = box.x + box.width / 2, CY = box.y + box.height / 2;
  await p.mouse.move(CX, CY);
  await p.mouse.down({ button: 'right' });
  let maxOrtho = 0, anyNaN = false;
  for (let i = 0; i < 40; i++) {
    await p.mouse.move(CX, CY - (i + 1) * 8);
    await p.waitForTimeout(12);
    const st = await p.evaluate(() => {
      const f = GAME.map3d._fly, h = f.head, u = f.up;
      return { hd: h[0] * u[0] + h[1] * u[1] + h[2] * u[2],
        nan: !h.every(Number.isFinite) || !u.every(Number.isFinite) };
    });
    maxOrtho = Math.max(maxOrtho, Math.abs(st.hd));
    if (st.nan) anyNaN = true;
  }
  await p.mouse.up({ button: 'right' });
  ok('⑤真浏览器右键拖动：head⊥up 保持、无 NaN', maxOrtho < 0.05 && !anyNaN,
    '最大|head·up|=' + maxOrtho.toFixed(4) + ' NaN=' + anyNaN);
  await p.evaluate(() => { GAME.map3d.surfaceMode && GAME.map3d.surfaceMode(true); });
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => ({ surf: GAME.map3d._surf, head: GAME.map3d._fly.head.slice() }));
  await p.mouse.move(CX, CY);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(CX + 80, CY + 40);
  await p.mouse.up({ button: 'right' });
  const after = await p.evaluate(() => ({ surf: GAME.map3d._surf, head: GAME.map3d._fly.head.slice() }));
  ok('⑥地表态右键不串飞行通道', after.surf === true
    && before.head.every((v, i) => Math.abs(v - after.head[i]) < 1e-9), 'surf=' + after.surf);
  ok('⑦无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  log('【结果】' + pass + '/' + fail);
  fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_fly_look_v15855.log', L.join('\n'), 'utf8');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
