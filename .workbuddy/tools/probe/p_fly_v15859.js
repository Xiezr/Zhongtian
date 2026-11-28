'use strict';
/* v158.59 行为探针 —— 老板：「地面不要切换成人。做一个飞行器着陆，然后出来之后
   才是人。我要画面不跳变，还是 60-40 这一段。我要从设计上出发，不允许有高空和
   地面之分，这是一个连续的空间，有一个连续的运动过程。」
   ------------------------------------------------------------
   核心验证：
     ② **60→40 段连续**：俯冲穿过该区间时 `_surf` 必须全程 false
        （没有任何模式切换）、相机单帧位移无尖峰、地表层 alpha 单调加深；
     ③ 着陆 → 'landed'：停在地上、飞行器仍在、**不切地表**；
     ④ 下机（flyExit）才是进地表的唯一入口：`_surf` 变 true、飞行器收起；
     ⑤ 下机后可以再起飞，且起飞会切回连续空间（`_surf` false）。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15859.js
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

(async () => {
  const src = fs.readFileSync(ROOT + '/js/map3d.js', 'utf8');

  /* ---------- ① 源码结构 ---------- */
  const S = [
    ['飞行态永不切地表', /var _onShip = !!\(M\._fly && M\._fly\.active\);/.test(src)
      && /var _surfNow = _onShip \? false/.test(src)],
    ['landed 状态存在', /fly\.phase = 'landed'/.test(src)],
    ['着陆不再 surfaceMode', !/fly\.phase = 'dock'; fly\.phaseT = 0; fly\.v = 0;\s*\n\s*_commitFlight\(fly, pos, head, bank, dt\);/.test(src)],
    ['flyExit 是唯一入口', /M\.flyExit = function \(\)/.test(src)],
    ['flyToggle 先下机', /if \(f\.phase === 'landed'\) return M\.flyExit\(\);/.test(src)],
    ['预览 alpha 连续', /_capP59 = _onShip59/.test(src) && /\(65 - _aglP\) \/ 17/.test(src)],
    ['登机提示', /登机 · 🚀 起飞程序启动/.test(src)],
    ['launch→landed 全链', /'takeoff'/.test(src) && /'landing'/.test(src) && /'landed'/.test(src)]
  ];
  const bad0 = S.filter((x) => !x[1]).map((x) => x[0]);
  ok('①源码结构锁 8 条（飞行态不切地表 / landed / 下机唯一入口 / alpha 连续）',
    bad0.length === 0, bad0.length ? ('缺: ' + bad0.join(', ')) : '8/8');

  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V1459', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe && GAME.map3d._colTex))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1400);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);
  const DN_Y = Math.min(Math.round(box.y + box.height) - 110, CY + 220);

  const setLevel = async (v, altM) => p.evaluate((arg) => {
    const M = GAME.map3d, f = M._fly;
    if (M._surf) { try { M.surfaceMode(false); } catch (e) { } }
    let pos = f.pos || [0, 300, 0], r = Math.hypot(pos[0], pos[1], pos[2]);
    if (!(r > 1)) { pos = [0, 300, 0]; r = 300; }
    if (arg.alt != null) { const k = (300 + arg.alt) / r; pos = [pos[0] * k, pos[1] * k, pos[2] * k]; r = 300 + arg.alt; }
    const rad = pos.map((x) => x / r);
    let t = [rad[1] * 0 - rad[2], 0, rad[0]];
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    t = t.map((x) => x / tl);
    f.pos = pos.slice(); f.head = t.slice(); f.vel = t.slice(); f.up = rad.slice();
    f.v = arg.v; f.aim = null; f.aimPitch = null; f.pitch = 0;
    f.holdR = r; f.sink = 0; f.autoLand = 0; f.active = true; f.phase = 'cruise'; f.phaseT = 0;
    f.camTail = [-t[0], -t[1], -t[2]];
    GAME._flyKeys = {};
    return { alt: r - 300 };
  }, { v: v, alt: (altM == null ? null : altM) });

  /* ---------- ② 60→40 段连续 ---------- */
  await setLevel(30, 64);
  await p.mouse.move(CX, CY); await p.waitForTimeout(200);
  await p.evaluate(() => {
    const M = GAME.map3d, f = M._fly;
    window.__rec = [];
    const tick = () => {
      const c = M._cam;
      window.__rec.push({
        alt: Math.hypot(f.pos[0], f.pos[1], f.pos[2]) - 300,
        surf: !!M._surf,
        fade: M._surfFade ? M._surfFade() : -1,
        cx: c.position.x, cy: c.position.y, cz: c.position.z,
        phase: f.phase
      });
      if (window.__rec.length < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.mouse.move(CX, DN_Y);       /* 俯冲，穿过 60→40 */
  await p.waitForTimeout(3200);
  const rec = await p.evaluate(() => window.__rec);
  const seg = rec.filter((x) => x.alt <= 60 && x.alt >= 40);
  const anySurf = rec.some((x) => x.surf);
  let maxStep = 0, maxJumpRatio = 0;
  const steps = [];
  for (let i = 1; i < rec.length; i++) {
    const dx = rec[i].cx - rec[i - 1].cx, dy = rec[i].cy - rec[i - 1].cy, dz = rec[i].cz - rec[i - 1].cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    steps.push(d); if (d > maxStep) maxStep = d;
  }
  const sorted = steps.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length * 0.5)] || 0.0001;
  maxJumpRatio = maxStep / med;
  /* 该段 alpha 单调不减（允许 2% 抖动） */
  let fadeMono = true;
  for (let i = 1; i < seg.length; i++) {
    if (seg[i].fade + 0.02 < seg[i - 1].fade) { fadeMono = false; break; }
  }
  const alt0 = seg.length ? seg[0].alt : -1, alt1 = seg.length ? seg[seg.length - 1].alt : -1;
  ok('②60→40 段：全程 `_surf` 恒 false（无模式切换）、相机单帧位移无尖峰、alpha 单调加深',
    seg.length >= 20 && !anySurf && maxStep < 6 && maxJumpRatio < 6 && fadeMono,
    '采样 ' + rec.length + '（该段 ' + seg.length + '）· surf 出现过=' + anySurf
      + ' · 单帧位移 max=' + maxStep.toFixed(2) + 'm 峰值/中位=' + maxJumpRatio.toFixed(1)
      + ' · alpha单调=' + fadeMono + ' · alt ' + alt0.toFixed(1) + '→' + alt1.toFixed(1)
      + ' · fade ' + (seg.length ? seg[0].fade.toFixed(2) + '→' + seg[seg.length - 1].fade.toFixed(2) : 'n/a'));

  /* ---------- ③ 着陆 → landed，且不切地表 ---------- */
  await setLevel(40, 140);
  await p.mouse.move(CX, CY); await p.waitForTimeout(200);
  await p.evaluate(() => { GAME.map3d.flyLand(); });
  let landed = null;
  for (let i = 0; i < 90; i++) {
    landed = await p.evaluate(() => ({
      phase: GAME.map3d._fly.phase, surf: !!GAME.map3d._surf,
      active: !!GAME.map3d._fly.active,
      ship: !!(GAME.map3d._shipMesh && GAME.map3d._shipMesh.visible),
      alt: GAME.map3d.flyProbe().alt
    }));
    if (landed.phase === 'landed') break;
    await p.waitForTimeout(150);
  }
  ok('③着陆后 phase=landed：停在地上、飞行器仍可见、**没有**切地表',
    landed && landed.phase === 'landed' && landed.surf === false && landed.active === true && landed.ship === true,
    landed ? ('phase=' + landed.phase + ' surf=' + landed.surf + ' active=' + landed.active
      + ' 飞行器可见=' + landed.ship + ' alt=' + (landed.alt == null ? 'null' : landed.alt.toFixed(1))) : 'null');

  /* ---------- ④ 下机才是进地表的唯一入口 ---------- */
  const beforeExit = await p.evaluate(() => ({ surf: !!GAME.map3d._surf, active: !!GAME.map3d._fly.active }));
  const ex = await p.evaluate(() => GAME.map3d.flyExit());
  await p.waitForTimeout(700);
  const afterExit = await p.evaluate(() => ({
    surf: !!GAME.map3d._surf, active: !!GAME.map3d._fly.active,
    phase: GAME.map3d._fly.phase,
    ship: !!(GAME.map3d._shipMesh && GAME.map3d._shipMesh.visible)
  }));
  ok('④下机（flyExit）后才进地表：_surf true、飞行器收起、phase=dock',
    ex === true && beforeExit.surf === false && afterExit.surf === true
      && afterExit.active === false && afterExit.phase === 'dock' && afterExit.ship === false,
    'exit=' + ex + ' surf ' + beforeExit.surf + '→' + afterExit.surf
      + ' active=' + afterExit.active + ' phase=' + afterExit.phase + ' 飞行器=' + afterExit.ship);

  /* ---------- ⑤ 下机后再起飞：回到连续空间 ---------- */
  const up = await p.evaluate(() => { const M = GAME.map3d; const r = M.flyToggle(); return r; });
  await p.waitForTimeout(1200);
  const afterUp = await p.evaluate(() => ({
    phase: GAME.map3d._fly.phase, surf: !!GAME.map3d._surf, active: !!GAME.map3d._fly.active
  }));
  ok('⑤下机后可再起飞：phase=takeoff、`_surf` 回 false（连续空间重建）',
    up === true && afterUp.phase === 'takeoff' && afterUp.surf === false && afterUp.active === true,
    'toggle=' + up + ' phase=' + afterUp.phase + ' surf=' + afterUp.surf);

  /* ---------- ⑥ 无异常 ---------- */
  ok('⑥无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');

  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_v15859_result.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
