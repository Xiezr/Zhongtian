/* 玩家视角走查 A · 走动全链（v158.14 新功能）
 * ------------------------------------------------------------
 * 规则：只用**玩家看得见的东西**和**玩家的手**。内部调用只用于读数/补帧。
 * 三条玩家路径分别测，不混：
 *   ① 城格上点「人物」→ 自动进街区 → 街区里走/转身/撞边界
 *   ② 「退出街区（Q）」→ 回高空星球视野
 *   ③ 野地上点「人物」→ 球面行走（stepAvatar 通道）
 * ⚠️ headless 下 rAF 被节流：按键只负责写状态位，位移必须手动推 45 帧同一出口。
 *    拿墙钟量位移会得到 0，那是探针的错，不是游戏的。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pjourney';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
const rows = [];
function ok(t, c, d) {
  c ? pass++ : fail++;
  rows.push({ kind: c ? 'ok' : 'fail', t, d: d == null ? '' : String(d) });
  console.log('  ' + (c ? 'OK  ' : 'FAIL') + ' ' + t + (d ? '   [' + d + ']' : ''));
}
/* 观察项：不算通过/失败，但要进报告（玩家体验的"手感"事实） */
function note(t, d) {
  rows.push({ kind: 'note', t, d: d == null ? '' : String(d) });
  console.log('  ——  ' + t + (d ? '   [' + d + ']' : ''));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  const shot = async (n) => {
    try { if (await p.evaluate(() => !!(GAME.ui && GAME.ui.renderMapCanvas))) await p.evaluate(() => GAME.ui.renderMapCanvas()); } catch (e) { }
    await p.screenshot({ path: OUT + '/' + n + '.png' });
    await p.screenshot({ path: OUT + '/' + n + '.jpg', type: 'jpeg', quality: 82 });
  };
  /* 玩家读到的字：分别读两条 HUD，不混 */
  const see = () => p.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05;
    };
    const T = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const o = { followHud: '', districtHud: '', districtBtn: '', hint: '' };
    const fh = document.getElementById('follow-hud'), dh = document.getElementById('district-hud');
    if (fh && vis(fh)) o.followHud = T(fh);
    if (dh && vis(dh)) {
      o.districtHud = T(dh.querySelector('span') || dh);
      const bt = dh.querySelector('[data-action="district-exit"]');
      o.districtBtn = bt ? T(bt) : '';
    }
    const ih = document.getElementById('interact-hint');
    if (ih && vis(ih)) o.hint = T(ih);
    return o;
  });
  const st = () => p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district;
    const q = M.playerPose ? M.playerPose() : null;
    return {
      follow: !!M.FOLLOW, district: !!(D && D.active),
      ci: M.playerCi ? M.playerCi() : -1,
      cityCi: (GAME.state.cities[0] || {}).ci,
      dir: q ? q.dir.map((x) => +x.toFixed(5)) : null,
      yaw: q ? +(q.yaw || 0).toFixed(4) : 0,
      dYaw: D && D.active ? +(D.yaw || 0).toFixed(4) : 0,
      dPos: D && D.pos ? { x: +D.pos.x.toFixed(3), z: +D.pos.z.toFixed(3) } : null,
      R: M.R, dist: +(+((M.camO && M.camO.dist) || 0)).toFixed(0), surf: !!M._surf
    };
  });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '玩家', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2500);

  /* ══════ 幕一 · 我第一眼能不能找到走路的入口 ══════ */
  const s0 = await see();
  const btnTxt = await p.evaluate(() => {
    const el = document.querySelector('[data-action="follow-toggle"]');
    return el ? (el.textContent || '').trim() : '';
  });
  ok('幕一 · 底栏第一屏就有「人物」按钮（不用翻菜单）', /人物/.test(btnTxt), '按钮「' + btnTxt + '」');
  ok('幕一 · 没进人物态时不乱塞操作说明', s0.followHud === '' && s0.districtHud === '', '');
  await shot('01_first_sight');

  /* ══════ 幕二 · 城格上点「人物」→ 街区 ══════ */
  const a0 = await st();
  await p.click('[data-action="follow-toggle"]');
  await p.waitForTimeout(2400);
  const a1 = await st();
  const s1 = await see();
  ok('幕二 · 点「人物」→ 真的进入可操作状态（跟随态）', a1.follow === true, 'FOLLOW=' + a1.follow);
  ok('幕二 · 站在城格上会自动切到街区（不再被人脸/城墙挡）', a1.district === true, 'district=' + a1.district + ' ci=' + a1.ci + '/' + a1.cityCi);
  ok('幕二 · 屏幕上有常驻操作说明（不是一闪而过的 toast）', s1.districtHud.length > 0, '「' + s1.districtHud + '」');
  ok('幕二 · 说明里写了「方向键」（玩家不用去猜 WASD）', /方向键/.test(s1.districtHud), '');
  ok('幕二 · 给出可点的「退出街区（Q）」按钮', /退出/.test(s1.districtBtn), '「' + s1.districtBtn + '」');
  await shot('02_district_hud');

  /* 街区里按 ↑ 走 45 帧 */
  const d0 = (await st()).dPos;
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(150);
  const dk = await p.evaluate(() => JSON.parse(JSON.stringify(GAME.district.keys || {})));
  const d1 = await p.evaluate(() => {
    const D = GAME.district; let n = 0;
    for (let i = 0; i < 45; i++) if (D.step(0.016, GAME.district.keys)) n++;
    return { n, pos: { x: +D.pos.x.toFixed(3), z: +D.pos.z.toFixed(3) } };
  });
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(120);
  const dku = await p.evaluate(() => JSON.parse(JSON.stringify(GAME.district.keys || {})));
  const moved = Math.hypot(d1.pos.x - d0.x, d1.pos.z - d0.z);
  ok('幕二 · 按 ↑ 真的往前走（45 帧 ≥1 米，带下限防平凡解）',
    dk.w === 1 && d1.n === 45 && moved >= 1.0, 'w=' + dk.w + ' 帧=' + d1.n + ' 位移=' + moved.toFixed(2) + 'm');
  ok('幕二 · 松手键位归零（不会自己一直走）', dku.w === 0, 'w=' + dku.w);
  await shot('03_district_walked');

  /* 松手后 45 帧零位移 */
  const dStill = await p.evaluate(() => {
    const D = GAME.district, a = { x: D.pos.x, z: D.pos.z };
    for (let i = 0; i < 45; i++) D.step(0.016, GAME.district.keys || {});
    return Math.hypot(D.pos.x - a.x, D.pos.z - a.z);
  });
  ok('幕二 · 松手后完全停住（零漂移）', dStill < 1e-6, '漂移 ' + dStill.toFixed(6) + 'm');

  /* ← 转身 */
  const y0 = (await st()).dYaw;
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(150);
  const y1 = await p.evaluate(() => {
    const D = GAME.district;
    for (let i = 0; i < 45; i++) D.step(0.016, GAME.district.keys);
    return D.yaw;
  });
  await p.keyboard.up('ArrowLeft');
  await p.waitForTimeout(120);
  const dyaw = Math.abs(y1 - y0) * 180 / Math.PI;
  ok('幕二 · 按 ← 转身（≥30°）', dyaw >= 30, '转了 ' + dyaw.toFixed(1) + '°');
  await shot('04_district_turned');

  /* 一直往前走 → 会被街区边界顶住（能不能走出去？） */
  const wall = await p.evaluate(() => {
    const D = GAME.district;
    D.yaw = 0;
    const k = { w: 1 };
    const a = { x: D.pos.x, z: D.pos.z };
    for (let i = 0; i < 900; i++) D.step(0.016, k);   /* 14 秒的走量 */
    return { pos: { x: +D.pos.x.toFixed(2), z: +D.pos.z.toFixed(2) }, active: !!D.active,
      moved: Math.hypot(D.pos.x - a.x, D.pos.z - a.z),
      b: D.plan && D.plan.bounds ? D.plan.bounds : null };
  });
  note('幕二 · 一直往前走会撞到街区边界顶住（走不出去）',
    '走了 ' + wall.moved.toFixed(1) + 'm 停在 z=' + wall.pos.z + '（边界 z1=' + (wall.b && wall.b.z1) + '）· 街区仍是 active，没有"走出城"的提示');

  /* ══════ 幕三 · 退出街区（玩家最怕回不去） ══════ */
  await p.keyboard.press('KeyQ');
  await p.waitForTimeout(2600);
  const c1 = await st();
  const s3 = await see();
  ok('幕三 · 按 Q → 退出街区与人物态', c1.district === false && c1.follow === false, 'district=' + c1.district + ' follow=' + c1.follow);
  ok('幕三 · 相机回到高空看球（不是贴地看一片蓝/一堵墙）', c1.dist > 400 && c1.surf === false, '相机距=' + c1.dist + ' _surf=' + c1.surf);
  ok('幕三 · 操作说明跟着收起（不留残影）', s3.followHud === '' && s3.districtHud === '', '');
  await shot('05_back_globe');

  /* 用底栏「退出街区」按钮那条路也验一次（玩家可能不按 Q 而是点按钮） */
  await p.click('[data-action="follow-toggle"]');
  await p.waitForTimeout(2400);
  const e0 = await st();
  const btnOk = await p.evaluate(() => {
    const bt = document.querySelector('[data-action="district-exit"]');
    if (!bt) return false;
    bt.click(); return true;
  });
  await p.waitForTimeout(2200);
  const e1 = await st();
  ok('幕三 · 点「退出街区」按钮与按 Q 等效',
    e0.district === true && btnOk === true && e1.district === false && e1.follow === false,
    '点前 district=' + e0.district + ' → 点后 ' + e1.district + '/' + e1.follow);

  /* ══════ 幕四 · 野地（球面通道） ══════
     玩家侧入口 = 顶栏「定位己方野地」；这里用同一条传送出口把玩家放到野地，
     再点「人物」——野地不该触发街区。 */
  const wild = await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere || G.sphere;
    const cityCis = {}; (G.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let pick = -1;
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i];
      if (!c || cityCis[i]) continue;
      if (['plain', 'caoyuan', 'forest'].indexOf(c.type) < 0) continue;
      if (!((G.fog && G.fog.get(i)) > 0)) continue;
      pick = i; break;
    }
    if (pick < 0) return { ok: false };
    let r = false;
    for (let k = 0; k < 4 && !r; k++) r = M.teleportTo(pick);
    return { ok: !!r, ci: pick, standCi: M.playerCi() };
  });
  ok('幕四 · 把人放到城外野地（离开城格这条路径存在）', wild.ok === true && wild.standCi === wild.ci,
    'ci=' + wild.ci + ' stand=' + wild.standCi);

  await p.click('[data-action="follow-toggle"]');
  await p.waitForTimeout(2000);
  const f0 = await st();
  const s4 = await see();
  ok('幕四 · 野地上点「人物」不触发街区（只有城格才切街区）',
    f0.follow === true && f0.district === false, 'follow=' + f0.follow + ' district=' + f0.district);
  ok('幕四 · 野地操作说明里给了方向键箭头（与街区条不同一条）',
    /↑|↓|←|→/.test(s4.followHud), '「' + s4.followHud + '」');
  await shot('06_wild_follow');

  const g0 = await p.evaluate(() => GAME.map3d.playerPose().dir.slice());
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(150);
  const gk = await p.evaluate(() => JSON.parse(JSON.stringify(GAME._keys || {})));
  const g1 = await p.evaluate(() => {
    const M = GAME.map3d; let n = 0;
    for (let i = 0; i < 45; i++) if (M.stepAvatar(0.016, GAME._keys)) n++;
    return { n, dir: M.playerPose().dir.slice() };
  });
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(120);
  const chord = Math.sqrt((g0[0] - g1.dir[0]) ** 2 + (g0[1] - g1.dir[1]) ** 2 + (g0[2] - g1.dir[2]) ** 2) * f0.R;
  ok('幕四 · 球面上按 ↑ 也真的走（45 帧 ≥1 米）',
    gk.w === 1 && g1.n === 45 && chord >= 1.0, 'w=' + gk.w + ' 帧=' + g1.n + ' 位移=' + chord.toFixed(2) + 'm');
  await shot('07_wild_walked');

  /* 野地 ← 转身走的是球面 yaw */
  const wy0 = await p.evaluate(() => +(GAME.map3d.playerPose().yaw || 0));
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(150);
  const wy1 = await p.evaluate(() => {
    const M = GAME.map3d;
    for (let i = 0; i < 45; i++) M.stepAvatar(0.016, GAME._keys);
    return +(M.playerPose().yaw || 0);
  });
  await p.keyboard.up('ArrowLeft');
  await p.waitForTimeout(120);
  ok('幕四 · 球面上按 ← 转身', Math.abs(wy1 - wy0) > 0.2, 'Δyaw=' + (Math.abs(wy1 - wy0) * 180 / Math.PI).toFixed(1) + '°');
  await shot('08_wild_turned');

  ok('全程零运行时错误', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : '无');

  console.log('\n==== 玩家走查 A（走动全链）：' + pass + ' 通过 / ' + fail + ' 失败 ====');
  fs.writeFileSync(OUT + '/rows_a.json', JSON.stringify({ pass, fail, rows }, null, 1));
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('崩溃:', e); process.exit(2); });
