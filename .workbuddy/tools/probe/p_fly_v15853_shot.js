'use strict';
/* v158.53 实机截图：无人深空式操控 + 星球方位指示。
   A. 鼠标转机头 + W 推进 → HUD 罗盘/八方位/离地距离在册
   B. A 横滚 banking → 画面倾斜 + 机头转 + 方位指示刷新
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15853_shot.js
   产物：.workbuddy/shots/v15853-A-nav-hud.png / v15853-B-banking.png */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
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
  await p.waitForTimeout(700);

  const grab = () => p.evaluate(() => {
    const M = GAME.map3d, f = M.flyProbe();
    const hud = document.getElementById('fly-hud');
    const svg = hud ? hud.querySelector('svg') : null;
    const dot = svg ? svg.querySelector('circle[fill="#ffb648"]') : null;
    const r = (x) => x == null ? null : +x.toFixed(3);
    return {
      v: r(f.v), alt: r(f.alt), bank: r(f.bank), up: f.up ? f.up.map(r) : null,
      head: f.head ? f.head.map(r) : null, nav: f.nav,
      trail: f.trail, ship: !!(M._shipMesh && M._shipMesh.visible),
      hud: hud ? hud.style.display !== 'none' : false,
      hudTxt: hud ? hud.textContent.trim() : '',
      hasSvg: !!svg, planetDot: dot ? { x: dot.getAttribute('cx'), y: dot.getAttribute('cy') } : null,
      cam: !!M._flyCam, err: M._flErr1 || null
    };
  });

  /* A. 鼠标转机头 + W 推进，让方位罗盘和星球标记都在画面上 */
  await p.mouse.move(700, 450);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(790, 380, { steps: 6 });
  await p.mouse.up({ button: 'right' });
  await p.keyboard.down('w');
  await p.waitForTimeout(1500);
  await p.keyboard.up('w');
  await p.waitForTimeout(350);
  const A = await grab();
  await p.screenshot({ path: SHOTS + 'v15853-A-nav-hud.png' });
  ok('A1 战舰 + 尾迹 + 第三人称机位在册',
    A.ship && A.trail > 3 && A.cam && !A.err,
    'ship=' + A.ship + ' trail=' + A.trail + ' cam=' + A.cam + ' err=' + A.err);
  ok('A2 HUD 常驻星球方位指示（罗盘 SVG + 星球标记 + 八方位 + 离地/球心距离）',
    A.hud && A.hasSvg && A.planetDot && A.nav
      && /🌍 星球/.test(A.hudTxt) && /离地/.test(A.hudTxt) && /球心/.test(A.hudTxt),
    A.hudTxt.slice(0, 130));
  ok('A3 HUD 直印新键位（看哪飞哪 / 推进刹车 / 横滚 / 双击回正）',
    /鼠标 看哪飞哪/.test(A.hudTxt) && /W\/S 推进刹车/.test(A.hudTxt)
      && /A\/D 横滚/.test(A.hudTxt) && /双击右键回正/.test(A.hudTxt),
    A.hudTxt.slice(-90));
  ok('A4 W 推进真加速（非平凡下限）', A.v > 35, 'v=' + A.v);

  /* B. A 横滚 banking：画面随机体 up 倾斜，方位指示刷新 */
  const b0 = await grab();
  await p.keyboard.down('a');
  await p.waitForTimeout(900);
  const B = await grab();
  await p.keyboard.up('a');
  await p.screenshot({ path: SHOTS + 'v15853-B-banking.png' });
  const upAng = Math.acos(Math.max(-1, Math.min(1,
    b0.up[0] * B.up[0] + b0.up[1] * B.up[1] + b0.up[2] * B.up[2]))) * 180 / Math.PI;
  ok('B1 A 横滚产生可见 banking（机体 up 转 ≥20°、横滚角 ≥20°）',
    upAng > 20 && B.bank > 20, 'upΔ=' + upAng.toFixed(1) + '° bank=' + B.bank + '°');
  ok('B2 横滚同时协调转弯（机头跟转 ≥8°）',
    (function () {
      const d = b0.head[0] * B.head[0] + b0.head[1] * B.head[1] + b0.head[2] * B.head[2];
      return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI > 8;
    })(),
    'head ' + JSON.stringify(b0.head) + ' → ' + JSON.stringify(B.head));
  ok('B3 方位指示随姿态刷新（离地/机头夹角文本仍在册）',
    /机头→星球/.test(B.hudTxt) && /横滚/.test(B.hudTxt) && B.v > 0,
    B.hudTxt.slice(0, 110));
  ok('B4 全程无页面运行时错误', errs.length === 0 && !B.err,
    errs.slice(0, 2).join(' | ') + ' ' + (B.err || ''));

  console.log('截图：' + SHOTS + 'v15853-A-nav-hud.png');
  console.log('截图：' + SHOTS + 'v15853-B-banking.png');
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
