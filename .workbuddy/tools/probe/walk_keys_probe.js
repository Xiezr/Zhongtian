/* ============================================================
 * v158.14 走查探针：人物怎么走（老板「我至今没有发现操作选项 / 我键盘的上下左右还是什么样」）
 * ------------------------------------------------------------
 * 全走真实入口：Tab 进人物视角 →（城格上自动进街区）→ page.keyboard 真按
 *   ↑ ↓ ← →。检查：
 *     ① Tab 进跟随态 · 城格上自动落到街区（不再埋在城墙里）
 *     ② 屏幕上**常驻**操作说明（不再只有 2 秒 toast），且写明方向键
 *     ③ ↑ 真让街区里的人前进（带下限：≥1 米，防 0===0 平凡解）
 *     ④ 松手即停（键位归零 + 再推 45 帧零位移）
 *     ⑤ ← 真转向（≥30°）
 *     ⑥ ↓ 同一条通道
 *     ⑦ Q 退出街区后，左下跟随条恢复
 *     ⑧ 退出街区后球面上的 ↑ 也能走（GAME._keys 那条通道）
 *     ⑨ Tab 退出：所有 HUD 收起、键位状态清空
 * ⚠️ 两个已知坑（探针自身，不写下来必再踩）：
 *   · 不许先 click canvas —— 会开地块面板，弹窗守卫把 Tab 交给焦点圈，setFollow 收不到；
 *   · headless 下 rAF 被节流（1.4s 只出 1 帧），位移必须按固定步长手动推同一出口，
 *     不能拿墙钟当帧数。
 * 用法：NODE_PATH=... node .workbuddy/tools/probe/walk_keys_probe.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = 'E:/Deepseekdb';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = path.join(ROOT, '.workbuddy/tmp/v15814_walk');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const rows = [];
function ok(id, title, cond, detail) {
  cond ? pass++ : fail++;
  rows.push({ id, title, ok: !!cond, detail: detail || '' });
  console.log('  ' + (cond ? '✅' : '❌') + ' ' + id + '  ' + title + (detail ? '   [' + detail + ']' : ''));
}

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--window-size=1400,900']
  });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e && e.message || e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const shot = async (n) => { await p.screenshot({ path: path.join(OUT, n + '.png') }); };

  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'walk', cityName: '灰岗', mapSeed: 20261125 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2400);

  /* ---------- ① Tab 进人物态（真按键） ---------- */
  await p.keyboard.press('Tab');
  await p.waitForTimeout(2600);   /* 让街区淡入 + 加载条走完 */
  const s1 = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district;
    return {
      follow: !!M.FOLLOW,
      district: !!(D && D.active),
      ci: M.playerCi(),
      cityCi: (GAME.state.cities[0] || {}).ci,
      spawn: D && D.pos ? { x: +D.pos.x.toFixed(2), z: +D.pos.z.toFixed(2) } : null
    };
  });
  ok('①', 'Tab 进入人物视角（球面跟随态）', s1.follow === true, 'FOLLOW=' + s1.follow);
  ok('②', '城格上进入 → 自动落到街区（不再埋在城墙里）',
    s1.district === true && s1.ci === s1.cityCi,
    'ci=' + s1.ci + '/' + s1.cityCi + ' · spawn=' + JSON.stringify(s1.spawn));

  /* ---------- ② 常驻操作说明 ---------- */
  const s2 = await p.evaluate(() => {
    const fh = document.getElementById('follow-hud');
    const dh = document.getElementById('district-hud');
    const vis = (e) => !!(e && getComputedStyle(e).display !== 'none');
    return {
      followVis: vis(fh), followTxt: fh ? (fh.textContent || '').replace(/\s+/g, ' ').trim() : '',
      districtVis: vis(dh), districtTxt: dh ? (dh.textContent || '').replace(/\s+/g, ' ').trim() : ''
    };
  });
  /* 街区态由 district-hud 接管、左下跟随条收起（一屏两处「WASD 走动」是啰嗦）。
     ⚠️ 判据认「方向键」三字或箭头符号皆可 —— 街区条为省横向空间写的是「WASD / 方向键」，
        跟随条写的是「或 ↑ ↓ ← →」，两者是等价信息，不要拿一种去卡另一种。 */
  ok('③', '街区态屏幕上有常驻操作说明，且写明方向键',
    s2.districtVis === true && /(方向键|↑ ↓ ← →)/.test(s2.districtTxt) && s2.followVis === false,
    '「' + s2.districtTxt + '」');
  await shot('01_in_district_hud');

  /* ---------- ③ ↑ 街区真走（手动推同一出口步进） ---------- */
  const pos0 = s1.spawn;
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(160);
  const kDown = await p.evaluate(() => JSON.parse(JSON.stringify(GAME.district.keys || {})));
  const w1 = await p.evaluate(() => {
    const D = GAME.district, k = GAME.district.keys;
    let n = 0;
    for (let i = 0; i < 45; i++) { if (D.step(0.016, k)) n++; }
    /* 补一帧：街区 tick / 相机覆盖都在 M.render 里（rAF 被 headless 节流），
       不补这一帧截图和步进前的画面长得一模一样，只看图会误判"没走"。 */
    try { if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); } catch (eR) { }
    return { n: n, pos: { x: +D.pos.x.toFixed(3), z: +D.pos.z.toFixed(3) } };
  });
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(140);
  const kUp = await p.evaluate(() => JSON.parse(JSON.stringify(GAME.district.keys || {})));
  const moved = Math.hypot(w1.pos.x - pos0.x, w1.pos.z - pos0.z);
  /* 45 帧 × 0.016s × 4.5 m/s ≈ 3.2 米；下限 1 米 */
  ok('④', '按 ↑（方向键）在街区里真的向前走（45 帧 ≥1 米）',
    kDown.w === 1 && w1.n === 45 && moved >= 1.0,
    '_keys.w=' + kDown.w + ' · 步进 ' + w1.n + ' 帧 · 位移 ' + moved.toFixed(2) + ' 米');
  ok('⑤', '松手即停（街区键位归零，不残留一直往前走）', kUp.w === 0, 'w=' + kUp.w);
  await shot('02_walked');

  const w2 = await p.evaluate(() => {
    const D = GAME.district, k = GAME.district.keys || {};
    const a = { x: D.pos.x, z: D.pos.z };
    let n = 0;
    for (let i = 0; i < 45; i++) { if (D.step(0.016, k)) n++; }
    return { n: n, drift: Math.hypot(D.pos.x - a.x, D.pos.z - a.z) };
  });
  ok('⑥', '松手后 45 帧零位移（真停 · 且上面已走过 ≥1 米，非平凡解）',
    moved >= 1.0 && w2.drift < 1e-4, '静止位移 ' + w2.drift.toFixed(6) + ' 米');

  /* ---------- ④ ← 转向 + ↓ 通道 ---------- */
  const yaw0 = await p.evaluate(() => GAME.district.yaw || 0);
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(150);
  const t1 = await p.evaluate(() => {
    const D = GAME.district, k = GAME.district.keys;
    for (let i = 0; i < 45; i++) D.step(0.016, k);
    try { if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); } catch (eR) { }
    return D.yaw || 0;
  });
  await p.keyboard.up('ArrowLeft');
  await p.waitForTimeout(140);
  const dyaw = Math.abs(t1 - yaw0) * 180 / Math.PI;
  ok('⑦', '按 ← 转向（≥30° · 1.8rad/s ≈ 103°/s，45 帧约 74°）', dyaw >= 30, 'Δyaw=' + dyaw.toFixed(1) + '°');
  await shot('03_turned');

  await p.keyboard.down('ArrowDown');
  await p.waitForTimeout(140);
  const sDown = await p.evaluate(() => JSON.parse(JSON.stringify(GAME.district.keys || {})));
  await p.keyboard.up('ArrowDown');
  await p.waitForTimeout(140);
  ok('⑧', '↓ 走同一条通道（方向键四向都进状态位）', sDown.s === 1, 's=' + sDown.s);

  /* ---------- ⑤ Q 退出街区 → 左下跟随条恢复 ---------- */
  await p.keyboard.press('KeyQ');
  await p.waitForTimeout(1200);
  const s5 = await p.evaluate(() => {
    const fh = document.getElementById('follow-hud');
    const dh = document.getElementById('district-hud');
    const vis = (e) => !!(e && getComputedStyle(e).display !== 'none');
    return { follow: !!GAME.map3d.FOLLOW, district: !!GAME.district.active, fVis: vis(fh), dVis: vis(dh) };
  });
  /* v158.14 规则变更：Q = 回星球 —— 球面城格没有可行走层，只退街区会把人
     留在城中心的墙里（实测 Q 之后画面又是一堵墙）。所以 Q 必须同时退跟随。 */
  ok('⑨', 'Q 回星球：街区与跟随态一起退出（不在城中心的墙里停留）',
    s5.follow === false && s5.district === false && s5.fVis === false && s5.dVis === false,
    JSON.stringify(s5));
  await shot('04_back_to_globe');

  /* ---------- ⑥ 球面 ↑ 也能走（GAME._keys 通道） ----------
     必须先离开城格：城格上进跟随态会自动落街区（测的是 D.keys，不是 GAME._keys）。
     这里用游戏的「传送」出口挪到最近的野地格，再真按 Tab 进人物态。 */
  const away = await p.evaluate(() => {
    const G2 = GAME, M = G2.map3d, SP = G2.mapSphere;
    const cityCis = {};
    (G2.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let pick = -1;
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i];
      if (!c || cityCis[i]) continue;
      if (['plain', 'caoyuan', 'forest'].indexOf(c.type) < 0) continue;
      if (!((G2.fog && G2.fog.get(i)) > 0)) continue;
      pick = i; break;
    }
    if (pick < 0) return { ok: false };
    M.teleportTo(pick);
    return { ok: true, ci: pick, standCi: M.playerCi() };
  });
  ok('⑨b', '传送到城外野地（离开城格，⑤ 才能测到球面那条通道）',
    away.ok === true && away.standCi === away.ci, JSON.stringify(away));
  await p.keyboard.press('Tab');
  await p.waitForTimeout(1500);
  const atWild = await p.evaluate(() => ({ follow: !!GAME.map3d.FOLLOW, district: !!GAME.district.active }));
  ok('⑨c', '野地进人物态不触发街区（只有城格才落街区）',
    atWild.follow === true && atWild.district === false, JSON.stringify(atWild));

  const g0 = await p.evaluate(() => {
    const p0 = GAME.map3d.playerPose();
    return { dir: p0.dir.slice(), R: GAME.map3d.R };
  });
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(160);
  const gKeys = await p.evaluate(() => JSON.parse(JSON.stringify(GAME._keys || {})));
  const g1 = await p.evaluate(() => {
    const M = GAME.map3d;
    let n = 0;
    for (let i = 0; i < 45; i++) { if (M.stepAvatar(0.016, GAME._keys)) n++; }
    return { n: n, dir: M.playerPose().dir.slice() };
  });
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(140);
  const chord = Math.sqrt(
    Math.pow(g0.dir[0] - g1.dir[0], 2) + Math.pow(g0.dir[1] - g1.dir[1], 2) + Math.pow(g0.dir[2] - g1.dir[2], 2)
  ) * g0.R;
  ok('⑩', '球面上按 ↑ 也真的走（GAME._keys 通道 · 45 帧 ≥1 米）',
    gKeys.w === 1 && g1.n === 45 && chord >= 1.0,
    '_keys.w=' + gKeys.w + ' · 步进 ' + g1.n + ' 帧 · 位移 ' + chord.toFixed(2) + ' 米');

  /* ---------- ⑦ Tab 退出 ---------- */
  await p.keyboard.press('Tab');
  await p.waitForTimeout(900);
  const s7 = await p.evaluate(() => {
    const fh = document.getElementById('follow-hud');
    const dh = document.getElementById('district-hud');
    const vis = (e) => !!(e && getComputedStyle(e).display !== 'none');
    const z = (o) => Object.keys(o || {}).every((k) => !o[k]);
    return {
      follow: !!GAME.map3d.FOLLOW, district: !!GAME.district.active,
      fVis: vis(fh), dVis: vis(dh),
      clean: z(GAME._keys) && z(GAME.district.keys)
    };
  });
  ok('⑪', 'Tab 退出：HUD 全收、两级键位状态清空',
    s7.follow === false && s7.district === false && s7.fVis === false && s7.dVis === false && s7.clean,
    JSON.stringify(s7));
  await shot('05_exited');

  ok('⑫', '全流程零运行时错误', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');

  /* 自包含走查页 */
  const imgs = fs.readdirSync(OUT).filter((x) => /\.png$/.test(x)).sort();
  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64');
  const html = '<!doctype html><meta charset="utf-8"><title>v158.14 人物走动键位走查</title>'
    + '<style>body{background:#12161c;color:#e8e2d2;font:14px/1.7 system-ui,"Microsoft YaHei";margin:24px}'
    + 'h1{font-size:20px}.row{background:#1a2029;border:1px solid #333;border-radius:8px;padding:10px 14px;margin:8px 0}'
    + '.ok{color:#5ddc8a}.bad{color:#ff6b6b}img{max-width:100%;border:1px solid #333;border-radius:6px;margin:10px 0}</style>'
    + '<h1>v158.14 人物走动键位 · 实机走查</h1>'
    + rows.map((r) => '<div class="row ' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✅' : '❌') + ' <b>'
      + r.id + '</b> ' + r.title + (r.detail ? '<br><span style="opacity:.72">' + r.detail + '</span>' : '') + '</div>').join('')
    + imgs.map((f) => '<div class="row">' + f + '</div><img src="' + b64(f) + '">').join('');
  fs.writeFileSync(path.join(OUT, 'walkthrough.html'), html);

  await b.close();
  process.exit(fail ? 1 : 0);
})();
