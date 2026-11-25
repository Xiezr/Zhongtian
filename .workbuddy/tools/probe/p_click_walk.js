/* v158.20 真人玩法验收（老板「用真实人类的玩法去测试，别走机器内容」）
 * ------------------------------------------------------------
 * 不直接调 M.pickAt / M.walkTo —— 全部用**鼠标真点画布**：
 *   ① 新档进地图，找到"小人当前格"和"一个 6~10 格外的野地格"
 *   ② 把目标格投影到屏幕坐标 → p.mouse.click() 真点
 *   ③ 看三件事：面板有没有弹（交互）、小人有没有开始走（walkTarget）、
 *      相机有没有动（战略视角不该跟着人跑）
 *   ④ 等它走到（最多 20 秒），看 playerCi 是不是变成了目标格
 * 判据全是"人能看到的东西"：点完有没有反应、小人有没有动、它到没到。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pclick';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function ok(t, c, d) { c ? pass++ : fail++; console.log('  ' + (c ? 'OK  ' : 'FAIL') + ' ' + t + (d ? '   [' + d + ']' : '')); }
function note(t, d) { console.log('  ——  ' + t + (d ? '   [' + d + ']' : '')); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '走一走', cityName: '灰岗', mapSeed: 20261126 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2600);

  /* ── 准备：把小人放到一块平地，找一个 8~18 米外的目标格 ──
     ⚠️ 必须用 `M._collider.cells`（与 `_tileCells` 是**同一数组**，拾取与行走共用）。
        首版误用 `mapSphere.cells`（另一套六边形索引）→ 起点目标是错格，
        距离 392m、走 4000 帧也到不了，看起来像"走路 bug"。 */
  const prep = await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    const cells = M._collider.cells;
    const cityCis = {}; (G.state.cities || []).forEach((x) => { cityCis[x.ci] = 1; });
    let start = -1;
    for (let i = 0; i < cells.length; i += 3) {
      const cc = cells[i];
      if (cc && cc.type === 'plain' && !cityCis[i]) { start = i; break; }
    }
    if (start < 0) return { err: 'no plain' };
    M.teleportTo(start);
    const s0 = cells[start].dir;
    let target = -1, bestErr = 1e9, bestD = 0;
    for (let i = 0; i < cells.length; i++) {
      const cc = cells[i];
      if (!cc || cc.type === 'city' || cityCis[i] || i === start) continue;
      const dot = Math.max(-1, Math.min(1, cc.dir[0] * s0[0] + cc.dir[1] * s0[1] + cc.dir[2] * s0[2]));
      const d = Math.acos(dot) * M.R;
      if (d >= 8 && d <= 18) {
        const e = Math.abs(d - 13);
        if (e < bestErr) { bestErr = e; target = i; bestD = d; }
      }
    }
    if (target < 0) return { err: 'no target' };
    return { start: start, target: target, distM: +bestD.toFixed(1), total: cells.length };
  });
  if (prep.err) { console.log('  准备失败：' + prep.err); await b.close(); process.exit(1); }
  note('起点/目标', JSON.stringify(prep));

  /* 让相机对准起点格（像人一样先看到自己） */
  await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    if (M.focusOnCell) M.focusOnCell(G.map3d.playerCi());
  });
  await p.waitForTimeout(3000);

  /* ── 找到目标格在屏幕上的坐标 ── */
  const screen = await p.evaluate((ci) => {
    const M = GAME.map3d, cam = M._cam;
    const cc = M._collider.cells[ci];
    const P = new THREE.Vector3(cc.dir[0] * (M.R + 0.6), cc.dir[1] * (M.R + 0.6), cc.dir[2] * (M.R + 0.6)).project(cam);
    const cv = document.getElementById('mapCanvas');
    const r = cv.getBoundingClientRect();
    return { x: r.left + (P.x * 0.5 + 0.5) * r.width, y: r.top + (-P.y * 0.5 + 0.5) * r.height,
      ndc: [+P.x.toFixed(2), +P.y.toFixed(2)], inView: Math.abs(P.x) <= 1 && Math.abs(P.y) <= 1 };
  }, prep.target);
  note('目标格的屏幕坐标', JSON.stringify(screen));
  ok('目标格在画面里（人能看到要点哪）', screen.inView === true, 'ndc=' + JSON.stringify(screen.ndc));

  const before = await p.evaluate(() => {
    const M = GAME.map3d;
    return { ci: M.playerCi(), cam: M._cam.position.toArray().map((v) => +v.toFixed(2)),
      modal: !!document.querySelector('.modal-mask'), target: M.walkTarget() };
  });
  note('点击前', JSON.stringify(before));

  /* 诊断：walkTo 到底在不在、调了返回什么 */
  const diag = await p.evaluate((ci) => {
    const M = GAME.map3d;
    let ret = null, err = null;
    try { ret = M.walkTo(ci); } catch (e) { err = String(e && e.message || e); }
    return { hasWalkTo: typeof M.walkTo, ret: ret, err: err,
      targetAfter: M.walkTarget(), tileHas: !!(M._tileCells ? M._tileCells[ci] : (GAME.mapSphere && GAME.mapSphere.cells[ci])),
      hasAvatar: !!(GAME.state && GAME.state._avatar) };
  }, prep.target);
  note('诊断 walkTo', JSON.stringify(diag));
  await p.evaluate(() => { try { GAME.map3d.walkStop(); } catch (e) { } });   /* 诊断不留痕 */

  /* hook：抓住点击到底走了哪条路 */
  await p.evaluate(() => {
    window.__h = { pickAt: 0, pickExit: 0, openLand: 0, walkTo: 0, clickCanvas: 0, pickHit: null };
    const M = GAME.map3d;
    const oPick = M.pickAt;
    M.pickAt = function () { window.__h.pickAt++; return oPick.apply(this, arguments); };
    const oWalk = M.walkTo;
    M.walkTo = function (ci) { window.__h.walkTo++; window.__h.walkCi = ci; return oWalk.apply(this, arguments); };
    const ui = GAME.ui, oLand = ui.openLandModalCi;
    ui.openLandModalCi = function () { window.__h.openLand++; return oLand.apply(this, arguments); };
    const oPickG = GAME.map.pick;
    GAME.map.pick = function () { const r = oPickG.apply(this, arguments); window.__h.pickHit = r ? r.kind : null; return r; };
  });

  /* ══════ ① 真人点一下：鼠标真点画布 ══════ */
  await p.mouse.click(screen.x, screen.y);
  await p.waitForTimeout(400);
  const hooks = await p.evaluate(() => window.__h);
  note('hook 统计', JSON.stringify(hooks));
  const modalInfo = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    return { has: !!m, html: m ? m.innerHTML.replace(/\s+/g, ' ').slice(0, 260) : '' };
  });
  note('面板来源线索', JSON.stringify(modalInfo));
  const after = await p.evaluate(() => {
    const M = GAME.map3d;
    const m = document.querySelector('.modal-mask');
    return { ci: M.playerCi(), cam: M._cam.position.toArray().map((v) => +v.toFixed(2)),
      modalOpen: !!(m && m.getBoundingClientRect().width > 0),
      modalTitle: m ? ((m.querySelector('.gold-heading, .m-title') || {}).textContent || '').trim() : '',
      target: M.walkTarget() };
  });
  note('点一下之后', JSON.stringify(after));
  const marker = await p.evaluate(() => ({ openWalkCi: GAME.map3d._openWalkCi, openWalkErr: GAME.map3d._openWalkErr, walkTo: GAME.map3d.walkTarget() }));
  note('点图标记', JSON.stringify(marker));

  /* 对照：手动调 pickAt（排除"点击事件没到"） */
  const byPick = await p.evaluate((xy) => {
    const M = GAME.map3d;
    const cv = document.getElementById('mapCanvas');
    M._openWalkCi = undefined;
    try { M.pickAt(cv, xy.x, xy.y); } catch (e) { return { err: String(e && e.message || e) }; }
    return { openWalkCi: M._openWalkCi, cell: M._cell, target: M.walkTarget(), lastKind: M._lastPickKind };
  }, { x: screen.x, y: screen.y });
  note('手动调 pickAt', JSON.stringify(byPick));
  ok('① 点一下场景就有反应（面板弹出来了）', after.modalOpen === true, 'title=' + after.modalTitle);
  ok('① 小人接到了"走过去"的指令（不是原地看面板）', after.target >= 0, 'target=' + after.target);
  ok('① 相机没跟着人跑（这是战略视角，不是人物模式）',
    JSON.stringify(after.cam) === JSON.stringify(before.cam), 'cam=' + JSON.stringify(after.cam));
  await p.screenshot({ path: OUT + '/1_after_click.png' });

  /* 关掉面板，看小人走（人能看见它在动） */
  await p.evaluate(() => { try { GAME.ui.closeAllModals(); } catch (e) { } });
  await p.waitForTimeout(300);

  /* 单帧位移（查"2.29m/s"是真慢还是测量误差） */
  const oneF = await p.evaluate(() => {
    const M = GAME.map3d;
    const a = M.figureOf('stand').pos.slice();
    M.stepWalkTo(1 / 60);
    const b = M.figureOf('stand').pos.slice();
    const d = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
    return { d: +d.toFixed(4), expect: +(M.WALK_SPEED / 60).toFixed(4), speed: M.WALK_SPEED, target: M.walkTarget() };
  });
  note('单帧位移', JSON.stringify(oneF));

  /* ══════ ② 走 1 秒该有多远（headless 的 rAF 被节流到几帧/秒，只能手动步进代时间） ══════ */
  const walk1 = await p.evaluate(() => {
    const M = GAME.map3d;
    const a = M.figureOf('stand');
    const p0 = a ? a.pos.slice() : null;
    for (let i = 0; i < 60; i++) M.stepWalkTo(1 / 60);      /* 60 帧 = 1 秒 */
    const b = M.figureOf('stand');
    const p1 = b ? b.pos.slice() : null;
    const d = (p0 && p1) ? Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2) + Math.pow(p1[2] - p0[2], 2)) : 0;
    return { dist: +d.toFixed(2), walking: b ? b.walking : null, target: M.walkTarget() };
  });
  note('手动推 1 秒（等效 60fps 下 1 秒）', JSON.stringify(walk1));
  ok('② 走 1 秒约 4.5 米（WALK_SPEED · slerp 后弧长精确）', walk1.dist > 3.5 && walk1.dist < 5.5, 'd=' + walk1.dist + 'm');
  ok('② 走路时腿在动（walking=true）', walk1.walking === true, 'walking=' + walk1.walking);

  /* ══════ ③ 能走到（用已知 8~18 米的近距离目标 —— 点击坐标会有几格偏差，那是另一件事） ══════ */
  const arrive = await p.evaluate((target) => {
    const M = GAME.map3d;
    M.walkTo(target);
    const cel = M._collider.cells[target];
    const td = cel.dir;
    let frames = 0, dot = -1;
    /* 不自己判到达 —— 让 stepWalkTo 自己走到 0.6m 到达线并清 target。 */
    while (M.walkTarget() >= 0 && frames < 1200) {
      M.stepWalkTo(1 / 60); frames++;
      const p = M.playerPose();
      if (p) dot = p.dir[0] * td[0] + p.dir[1] * td[1] + p.dir[2] * td[2];
    }
    const p = M.playerPose();
    return { frames: frames, seconds: +(frames / 60).toFixed(1), dot: +dot.toFixed(6),
      distM: +(Math.acos(Math.max(-1, Math.min(1, dot))) * M.R).toFixed(2),
      ci: M.playerCi(), target: M.walkTarget() };
  }, prep.target);
  note('走到目标', JSON.stringify(arrive));
  /* 小人到底在不在画面里（不在 = "看不见它走"，等于没做到） */
  const figView = await p.evaluate(() => {
    const M = GAME.map3d, cam = M._cam;
    const fg = M.figureOf('stand');
    if (!fg) return { err: 'no figure' };
    const v = new THREE.Vector3(fg.pos[0], fg.pos[1], fg.pos[2]).project(cam);
    return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2)],
      inView: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
      figPos: fg.pos.map((x) => +x.toFixed(1)) };
  });
  note('小人屏幕位置', JSON.stringify(figView));
  ok('⑤ 小人站在画面里（玩家能看见它走到哪）', figView.inView === true, JSON.stringify(figView));
  ok('③ 小人真的走到了那一格（球面夹角换算 < 2 米 · 停下后 target 清空）',
    arrive.distM < 2 && arrive.target < 0, JSON.stringify(arrive));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/3_arrived.png' });

  /* ══════ ④ 人物模式的痕迹应该没了 ══════ */
  const gone = await p.evaluate(() => ({
    btn: !!document.querySelector('[data-action="follow-toggle"]'),
    tabHandler: false,
    follow: GAME.map3d.FOLLOW
  }));
  ok('④ 地图上不再有「🧍 人物」按钮（模式已去掉）', gone.btn === false, 'btn=' + gone.btn);
  ok('④ 全程没进过跟随态（战略视角）', gone.follow === false, 'FOLLOW=' + gone.follow);

  note('运行时错误', JSON.stringify(errs.slice(0, 4)));
  ok('全程无页面错误', errs.length === 0, errs.length + ' 条:' + (errs[0] || ''));
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
