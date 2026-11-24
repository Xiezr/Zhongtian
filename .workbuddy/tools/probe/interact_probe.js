/* P1 走近即交互探针（v158.1）
 * 判据：
 *   A 命中 —— 正前方 ≤1 格命中；背对/超距 0 误触
 *   B 提示条 —— #interact-hint 随目标显隐、data-ci 正确
 *   C 真键盘 E —— keydown→openCellPanel ≤100ms，且打开的是原来那个面板
 *   D 回退 —— INTERACT_NEAR=false 静默；旧点格路径仍可用；E 键零背包写入
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/interact_probe.js > .workbuddy/tmp/interact_probe.log 2>&1
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'interact', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);
  /* 用游戏内同一个 avatarBasis 算朝向，别在探针里另造一套基 ——
     P1 首轮就是这样把"正对"算成"背对"的（east 差 90°）。 */
  await p.evaluate(() => {
    window.__aimYaw = function (d, t) {
      const fr = GAME.map3d.avatarBasis(d);
      const tg = [t[0] - d[0], t[1] - d[1], t[2] - d[2]];
      let se = 0, ss = 0;
      for (let i = 0; i < 3; i++) { se += tg[i] * fr.east[i]; ss += tg[i] * fr.south[i]; }
      return Math.atan2(se, -ss);
    };
  });

  /* ---- A. 命中判据：站在城的邻格、正对城 ---- */
  const setup = await p.evaluate(() => {
    const M = GAME.map3d, S = GAME.mapSphere;
    const home = (GAME.state.cities && GAME.state.cities[0] && GAME.state.cities[0].ci) | 0;
    const stand = (S.adj[home] || [])[0];
    if (!(home >= 0) || !(stand >= 0)) return { home, stand, err: 'no neighbor' };
    [home, stand].forEach((ci) => { try { GAME.fog.bump(ci, 3); } catch (e) { } });
    const d = S.cells[stand].dir, t = S.cells[home].dir;
    const yaw = window.__aimYaw(d, t);
    M.INTERACT_NEAR = true;
    M.setPlayerPose({ dir: d.slice(), h: M._groundAtUnit(d), yaw: yaw, v: [0, 0, 0], ci: stand });
    return { home, stand, yaw, hit: M.nearestInteractable() };
  });
  console.log('  [DBG] ' + JSON.stringify(setup));
  ok('A1 站位与朝向建立（有邻格 + yaw 有限）',
    setup.home >= 0 && setup.stand >= 0 && isFinite(setup.yaw),
    'home=' + setup.home + ' stand=' + setup.stand);
  ok('A2 正前方命中目标（≤1 格，返回结构完整）',
    !!(setup.hit && setup.hit.ci >= 0 && setup.hit.kind && setup.hit.name && setup.hit.verb
      && setup.hit.hex <= 1 && setup.hit.angle <= 30),
    JSON.stringify(setup.hit));

  const back = await p.evaluate(() => {
    const M = GAME.map3d, q = M.playerPose();
    M.setPlayerPose({ dir: q.dir, yaw: q.yaw + Math.PI, v: [0, 0, 0] });
    return M.nearestInteractable();
  });
  ok('A3 背对不误触（30° 锥外原目标被排除）',
    !back || back.ci !== setup.home, 'back=' + JSON.stringify(back));

  const far = await p.evaluate(() => {
    const M = GAME.map3d, S = GAME.mapSphere;
    const home = (GAME.state.cities && GAME.state.cities[0] && GAME.state.cities[0].ci) | 0;
    const ring1 = S.adj[home] || [];
    let farCi = -1;
    for (let i = 0; i < ring1.length && farCi < 0; i++) {
      for (let j = 0; j < (S.adj[ring1[i]] || []).length; j++) {
        const c2 = S.adj[ring1[i]][j];
        if (c2 !== home && ring1.indexOf(c2) < 0) { farCi = c2; break; }
      }
    }
    if (farCi < 0) return { err: 'no 2-ring' };
    try { GAME.fog.bump(farCi, 3); } catch (e) { }
    const d = S.cells[farCi].dir, t = S.cells[home].dir;
    const yaw = window.__aimYaw(d, t);
    M.setPlayerPose({ dir: d.slice(), h: M._groundAtUnit(d), yaw: yaw, v: [0, 0, 0], ci: farCi });
    const hit = M.nearestInteractable();
    return { farCi, hit: hit && hit.ci, hexDist: S.hexDist(farCi, home) };
  });
  ok('A4 超距不误触（2 环外不命中城格）',
    !far.err && far.hexDist === 2 && far.hit !== setup.home, JSON.stringify(far));

  /* ---- B. 提示条显隐 ---- */
  const hint = await p.evaluate(() => {
    const M = GAME.map3d, S = GAME.mapSphere;
    const home = (GAME.state.cities && GAME.state.cities[0] && GAME.state.cities[0].ci) | 0;
    const stand = (S.adj[home] || [])[0];
    const d = S.cells[stand].dir, t = S.cells[home].dir;
    const yaw = window.__aimYaw(d, t);
    M.setPlayerPose({ dir: d.slice(), h: M._groundAtUnit(d), yaw: yaw, v: [0, 0, 0], ci: stand });
    const hit = M.nearestInteractable();
    const el = GAME.ui.renderInteractHint(hit);
    const on = el ? { disp: el.style.display, ci: el.getAttribute('data-ci'), html: el.innerHTML } : null;
    GAME.ui.renderInteractHint(null);
    const off = el ? { disp: el.style.display, ci: el.getAttribute('data-ci') } : null;
    return { on, off, hit };
  });
  ok('B1 提示条出现且带正确格号/E 标识',
    !!(hint.on && hint.on.disp === 'block' && +hint.on.ci === hint.hit.ci
      && hint.on.html.indexOf('>E<') >= 0),
    JSON.stringify(hint.on && { disp: hint.on.disp, ci: hint.on.ci }));
  ok('B2 离开目标提示条收起（display=none 且无残留格号）',
    !!(hint.off && hint.off.disp === 'none' && !hint.off.ci), JSON.stringify(hint.off));

  /* ---- C. 真键盘 E：keydown → openCellPanel 耗时（页面内打点，排除 Playwright 往返） ---- */
  await p.evaluate(() => {
    const M = GAME.map3d;
    window.__eTrace = { t0: 0, t1: 0, ci: -1 };
    document.addEventListener('keydown', (ev) => {
      if (ev.code === 'KeyE' && !window.__eTrace.t0) window.__eTrace.t0 = performance.now();
    }, true);
    const orig = M.openCellPanel;
    M.openCellPanel = function (ci) {
      if (!window.__eTrace.t1) {
        window.__eTrace.t1 = performance.now();
        window.__eTrace.ci = ci;
      }
      return orig.apply(this, arguments);
    };
    M.setFollow(true);
    const S = GAME.mapSphere;
    const home = (GAME.state.cities && GAME.state.cities[0] && GAME.state.cities[0].ci) | 0;
    const stand = (S.adj[home] || [])[0];
    const d = S.cells[stand].dir, t = S.cells[home].dir;
    const yaw = window.__aimYaw(d, t);
    M.setPlayerPose({ dir: d.slice(), h: M._groundAtUnit(d), yaw: yaw, v: [0, 0, 0], ci: stand });
    window.__bagBefore = JSON.stringify(GAME.state.items || {});
  });
  await p.keyboard.press('e');
  await p.waitForTimeout(250);
  const eTrace = await p.evaluate(() => ({
    t0: window.__eTrace.t0, t1: window.__eTrace.t1, ci: window.__eTrace.ci,
    modal: !!(GAME.ui.modalVisible && GAME.ui.modalVisible()),
    bagSame: JSON.stringify(GAME.state.items || {}) === window.__bagBefore,
    follow: GAME.map3d.FOLLOW
  }));
  const latency = eTrace.t1 ? +(eTrace.t1 - eTrace.t0).toFixed(2) : -1;
  ok('C1 真按 E 触发分派（非 0 命中、落在城格）',
    eTrace.t1 > 0 && eTrace.ci === setup.home, 'ci=' + eTrace.ci + ' t0=' + eTrace.t0.toFixed(1));
  ok('C2 按键→面板打开 ≤100ms（页面内打点）',
    latency >= 0 && latency <= 100, 'latency=' + latency + 'ms');
  ok('C3 打开的是原来那个面板（模态可见 + 跟随态保留）',
    eTrace.modal === true && eTrace.follow === true, JSON.stringify({ modal: eTrace.modal, follow: eTrace.follow }));
  ok('C4 E 键本身零背包写入（采集仍由面板动作走 items.add）',
    eTrace.bagSame === true, 'bag unchanged=' + eTrace.bagSame);

  /* ---- D. 回退开关 + 旧路径反向证据 ---- */
  const back2 = await p.evaluate(() => {
    const M = GAME.map3d;
    if (GAME.ui.modalVisible && GAME.ui.modalVisible()) GAME.ui.closeModal();
    M.INTERACT_NEAR = false;
    const silent = M.nearestInteractable();
    M.INTERACT_NEAR = true;
    const before = !!(GAME.ui.modalVisible && GAME.ui.modalVisible());
    M.openCellPanel((GAME.state.cities[0] || {}).ci | 0);
    const after = !!(GAME.ui.modalVisible && GAME.ui.modalVisible());
    if (after) GAME.ui.closeModal();
    return { silent, before, after, hasOpen: typeof M.openCellPanel === 'function' };
  });
  ok('D1 开关关闭后无命中（一键回退不误触）',
    back2.silent === null, 'silent=' + JSON.stringify(back2.silent));
  ok('D2 旧点格面板路径仍可用（删按键后功能不消失）',
    back2.hasOpen && back2.before === false && back2.after === true, JSON.stringify(back2));
  ok('D3 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
