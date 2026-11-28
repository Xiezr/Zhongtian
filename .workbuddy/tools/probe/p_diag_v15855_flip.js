'use strict';
/* v158.55 决定性探针：复现右键拖动"越过屏幕中线 → 机头 180° 翻转"
   根因假设：_fright = cross(radial, head)，当 head∥radial（正对/背对球心）时退化，
   兜底 (1,0,0) 与真实 right 反向 → 垂直拖动旋转轴翻转 → 机头弹到背面。
   本探针逐步把 head 从"切向"拖过"正对球心"，记录每步 head 与 right，
   直接量出翻转点。
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const L = []; const log = (s) => { L.push(String(s)); console.log(s); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'Q', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    const ok = await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe));
    if (ok) break; await p.waitForTimeout(200);
  }
  await p.waitForTimeout(600);

  /* 在浏览器里用与产品完全相同的公式模拟拖动，无需真鼠标 */
  const r = await p.evaluate(() => {
    const M = GAME.map3d;
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const R = 300, s = 1 / Math.SQRT2;
    const pos = V([s * R * 2.6, s * R * 2.6, 0]);
    const rad = pos.clone().normalize();
    /* 起点 head：切向（沿 -Z），与 radial 垂直 */
    let head = V([0, 0, -1]);
    head.addScaledVector(rad, -head.dot(rad)).normalize();
    const steps = [];
    K = 0.0042;
    /* 用垂直拖动（-dy）把 head 从切向逐步转向 radial（正对球心），
       复刻 _fright = cross(rad, head) 退化过程 */
    for (let i = 0; i < 40; i++) {
      let fright = new THREE.Vector3().crossVectors(rad, head);
      const rawLen = fright.length();
      if (fright.lengthSq() < 1e-8) fright.set(1, 0, 0);
      fright.normalize();
      /* 记录当前状态 */
      const dotRad = head.dot(rad);
      steps.push({
        i, dotRad: +dotRad.toFixed(4),
        rawRightLen: +rawLen.toFixed(6),
        right: [+fright.x.toFixed(3), +fright.y.toFixed(3), +fright.z.toFixed(3)],
        head: [+head.x.toFixed(3), +head.y.toFixed(3), +head.z.toFixed(3)]
      });
      /* 垂直拖 20px/步，绕 fright 转（与产品 if(_dy) 分支同式，符号取 -） */
      head.applyAxisAngle(fright, -20 * K);
      head.normalize();
    }
    /* 检测 right 的翻转：相邻 right 点积 < -0.5 视为翻转 */
    let flips = [];
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].right, c = steps[i].right;
      const dot = a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
      if (dot < -0.5) flips.push({ step: i, dot: +dot.toFixed(3),
        from: a, to: c, dotRad: steps[i].dotRad });
    }
    return { steps: steps.filter((x) => x.i % 3 === 0), flips, finalDot: steps[steps.length - 1].dotRad };
  });
  log('【退化翻转模拟】翻转次数=' + r.flips.length + ' 最终 head·rad=' + r.finalDot);
  r.flips.forEach((f) => log('  翻转@step' + f.step + ' dot=' + f.dot
    + ' dotRad=' + f.dotRad + ' ' + JSON.stringify(f.from) + ' → ' + JSON.stringify(f.to)));
  log('【采样轨迹】');
  r.steps.forEach((s) => log('  i=' + String(s.i).padStart(2)
    + ' head·rad=' + String(s.dotRad).padStart(7)
    + ' |cross|=' + String(s.rawRightLen).padStart(8)
    + ' right=' + JSON.stringify(s.right)));
  fs.writeFileSync(ROOT + '/.workbuddy/tmp/diag_v15855_flip.log', L.join('\n'), 'utf8');
  await b.close();
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
