/* P4 NPC 生态与事件探针（v158.4）
 * 判据：A 同屏≥12 且真有 3D 网格 / B 4 段日程位置差 / C 走近代言真按 E /
 *       D 敌对开打真按 E（DU.play 唯一出口）/ E 误报 0 / F tick p95≤2ms /
 *       G 位置不入档 + 读档重建 / H 回退开关 + P0~P3 保留
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/npc_probe.js > .workbuddy/tmp/npc_probe.log 2>&1
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
  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'npc', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);

  await p.evaluate(() => {
    window.__loadN = 0;
    const o = GAME.loadGame;
    GAME.loadGame = function () { window.__loadN++; return o.apply(this, arguments); };
    window.__settle = function () {
      const D = GAME.district;
      D.TRANSITION_MS = 1;
      for (let i = 0; i < 8 && D.active; i++) D.tick();
      D.TRANSITION_MS = 240;
      D.camera();
    };
    window.__put = function (id, x, z) {
      const np = GAME.npc.list.find((v) => v.id === id);
      if (!np) return false;
      np.x = x; np.z = z;
      np.anchors = [{ x, z }, { x, z }, { x, z }, { x, z }];
      return true;
    };
    window.__far = function () {
      GAME.npc.list.forEach((np, i) => {
        np.x = 80 + i; np.z = 80 + i;
        np.anchors = np.anchors.map(() => ({ x: 80 + i, z: 80 + i }));
      });
    };
  });

  const city = await p.evaluate(() => {
    const c = (GAME.state.cities || [])[0];
    GAME.map3d.setFollow(true);
    GAME.district.enter(c.ci, c);
    window.__settle();
    /* 载具停在远处，确保 E 键不会被 P3 分支吃掉 */
    GAME.vehicle.park = { x: 90, z: 90 };
    return { id: c.id, ci: c.ci };
  });
  ok('A0 街区就绪', await p.evaluate(() => GAME.district.active), 'ci=' + city.ci);

  /* ---- A. 同屏 ≥12 且真有网格 ---- */
  const a = await p.evaluate(() => ({
    n: GAME.npc.list.length,
    meshes: GAME.npc._meshes.length,
    active: GAME.npc.active,
    hostile: GAME.npc.list.filter((x) => x.hostile).length,
    phase: GAME.npc.phase()
  }));
  ok('A1 同屏 ≥12 NPC（非 0 平凡解）', a.n >= 12 && a.active, 'n=' + a.n + ' phase=' + a.phase);
  ok('A2 12 套 3D 网格真挂上街区 root · 敌对可辨识', a.meshes >= 12 && a.hostile >= 1,
    'meshes=' + a.meshes + ' hostile=' + a.hostile);

  /* ---- B. 4 段日程位置差 ---- */
  const bs = await p.evaluate(() => {
    const N = GAME.npc, w = GAME.state.world;
    const run = (h) => {
      w.elapsed = h * 3600;
      for (let i = 0; i < 240; i++) N.tick(1 / 60);
      return { phase: N.phase(), pos: N.list.map((x) => [x.x, x.z]) };
    };
    const seq = [run(2), run(8), run(13), run(18)];
    let diff = 0, minJump = 1e9;
    for (let i = 0; i < 12; i++) for (let k = 1; k < 4; k++) {
      const d = Math.hypot(seq[k].pos[i][0] - seq[k - 1].pos[i][0],
        seq[k].pos[i][1] - seq[k - 1].pos[i][1]);
      if (d >= 0.5) diff++;
      if (d < minJump) minJump = d;
    }
    return { phases: seq.map((x) => x.phase), diff, minJump: +minJump.toFixed(3) };
  });
  ok('B1 日程四段齐（night/dawn/day/dusk）',
    bs.phases.join(',') === 'night,dawn,day,dusk', bs.phases.join('→'));
  ok('B2 切段位置差 ≥12 人次 × ≥0.5m（非 0 平凡解）', bs.diff >= 12,
    'diff=' + bs.diff + '/36 min=' + bs.minJump + 'm');

  /* ---- C. 走近平民真按 E → 对话 ---- */
  await p.evaluate(() => {
    GAME.state.world.elapsed = 13 * 3600;
    window.__far();
    window.__put(0, 0, -1.6);
    GAME.district.pos = { x: 0, z: 0 };
    GAME.district.yaw = 0;
    window.__logBefore = (GAME.state.log || []).length;
  });
  const cNear = await p.evaluate(() => GAME.npc.nearest());
  ok('C1 正前方 1.6m 命中平民', cNear && cNear.id === 0 && cNear.verb === '交谈', JSON.stringify(cNear));
  await p.keyboard.press('e');
  const cTalk = await p.evaluate(() => ({
    top: (GAME.state.log || [])[0] ? GAME.state.log[0].msg : '',
    grew: (GAME.state.log || []).length > window.__logBefore
  }));
  ok('C2 真按 E 出对话（走 GAME.log，不新开面板）',
    cTalk.grew && cTalk.top.indexOf('：') > 0, cTalk.top);

  /* ---- D. 敌对真按 E → 开打（唯一出口 DU.play） ---- */
  await p.evaluate(() => {
    window.__far();
    window.__put(4, 0, -1.6);
    GAME.district.pos = { x: 0, z: 0 };
    GAME.district.yaw = 0;
    window.__duelCalls = 0;
    window.__origPlay = GAME.duel.play;
    GAME.duel.play = function () { window.__duelCalls++; return window.__origPlay.apply(this, arguments); };
  });
  const dNear = await p.evaluate(() => GAME.npc.nearest());
  ok('D1 正前方命中敌对', dNear && dNear.hostile === true && dNear.verb === '挑战', JSON.stringify(dNear));
  await p.keyboard.press('e');
  const dFight = await p.evaluate(() => {
    const r = { calls: window.__duelCalls, top: (GAME.state.log || [])[0] ? GAME.state.log[0].msg : '' };
    GAME.duel.play = window.__origPlay;
    return r;
  });
  ok('D2 真按 E 只经 DU.play 判定一次 + 落账', dFight.calls === 1 && dFight.top.indexOf('街边冲突') === 0,
    'calls=' + dFight.calls + ' · ' + dFight.top);

  /* ---- E. 误报 0（远处 / 背后 / 载具态 / 无目标按 E） ---- */
  const e0 = await p.evaluate(() => {
    window.__far();
    const far = GAME.npc.nearest();
    window.__put(0, 0, 2);                       /* 背后 */
    GAME.district.pos = { x: 0, z: 0 }; GAME.district.yaw = 0;
    const back = GAME.npc.nearest();
    window.__put(0, 0, -1.6);
    GAME.vehicle.mounted = true;                 /* 载具态 */
    const mounted = GAME.npc.nearest();
    GAME.vehicle.mounted = false;
    window.__far();
    window.__logBefore = (GAME.state.log || []).length;
    return { far: far, back: back, mounted: mounted };
  });
  await p.keyboard.press('e');
  const e1 = await p.evaluate(() => (GAME.state.log || []).length > window.__logBefore);
  ok('E1 远处/背后/载具态皆 null', e0.far === null && e0.back === null && e0.mounted === null,
    JSON.stringify(e0));
  ok('E2 无目标按 E 不记账（零误报）', e1 === false, 'logGrew=' + e1);

  /* ---- F. p95 ≤2ms ---- */
  const f = await p.evaluate(() => {
    const N = GAME.npc, ts = [];
    window.__put(0, 0, -8);
    for (let i = 0; i < 400; i++) {
      const t0 = performance.now();
      N.tick(1 / 60);
      ts.push(performance.now() - t0);
    }
    ts.sort((x, y) => x - y);
    return { p95: +ts[Math.floor(ts.length * 0.95)].toFixed(3),
      max: +ts[ts.length - 1].toFixed(3), n: N.list.length };
  });
  ok('F1 NPC 更新 p95 ≤2ms（400 帧实测）', f.p95 <= 2, 'p95=' + f.p95 + 'ms max=' + f.max + 'ms n=' + f.n);

  /* ---- G. 不入档 + 读档重建 ---- */
  const g = await p.evaluate(() => {
    const N = GAME.npc, D = GAME.district, M = GAME.map3d;
    window.__put(0, -7.5, 3.5);                 /* 挪到非默认位置，读档后必须重建 */
    const before = [N.list[0].x, N.list[0].z];
    const raw = JSON.stringify(GAME.savePayload ? GAME.savePayload() : GAME.state);
    GAME.saveGame && GAME.saveGame();
    D.exit(); window.__settle();
    const cleared = N.list.length === 0 && N.active === false;
    GAME.loadGame();
    D.enter(GAME.state.cities[0].ci, GAME.state.cities[0]); window.__settle();
    const after = [N.list[0].x, N.list[0].z];
    return { before, after, cleared, npcPos: raw.indexOf('npcPos') >= 0,
      count: N.list.length, seed: N.seed, loads: window.__loadN };
  });
  ok('G1 存档无 npcPos（位置不入档）', g.npcPos === false, 'npcPos=' + g.npcPos);
  ok('G2 退街区清空 + 读档重建 12 人（位置由 plan+seed 派生）',
    g.cleared && g.count >= 12 && g.loads >= 1, 'cleared=' + g.cleared + ' count=' + g.count + ' loads=' + g.loads);

  /* ---- H. 回退开关 + 旧路径保留 ---- */
  const h = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district, N = GAME.npc, ci = GAME.state.cities[0].ci;
    M.NPC = false;
    const blocked = N.spawn(D.plan, null, ci);
    const nearOff = N.nearest();
    M.NPC = true;
    D.exit(); window.__settle();
    return {
      blocked: blocked.ok === false, nearOff: nearOff === null,
      p0: typeof M.playerPose === 'function' && typeof M.setPlayerPose === 'function',
      p1: typeof M.nearestInteractable === 'function' && typeof GAME.ui.renderInteractHint === 'function',
      p2: typeof D.step === 'function' && typeof GAME.ui.renderDistrictHud === 'function',
      p3: typeof GAME.vehicle.toggle === 'function' && typeof GAME.ui.renderVehicleHud === 'function',
      hint: typeof GAME.ui.renderNpcHint === 'function'
    };
  });
  ok('H1 M.NPC=false 一键回退（生成被拒 + 无交互）', h.blocked && h.nearOff, JSON.stringify(h));
  ok('H2 P0~P3 与 NPC 提示逐字仍在（功能不消失）',
    h.p0 && h.p1 && h.p2 && h.p3 && h.hint, JSON.stringify(h));
  ok('H3 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
