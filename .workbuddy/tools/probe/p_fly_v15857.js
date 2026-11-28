'use strict';
/* v158.57 行为探针 —— 老板：
     「高空飞行在不改变海拔时，不应该相对固定高度吗？然后由于引力逐步下降。
      设计着陆程序」
   ------------------------------------------------------------
   旧行为（诊断 `.workbuddy/tmp/diag_v15857_alt.js` 实测）：
     · 水平切向 v=80 飞 6s → 高度 **+124.6m**（沿切线飞离星球，无高度概念）；
     · 鼠标纯水平右移 4s → 机头抬头 **37.7°**（绕机体 up 转 yaw 带出径向分量）。
   新行为：
     ② 平飞贴球面 → 高度只按引力下沉（6s 约 −6m），不再自己往上飞；
     ③ 水平转向不掉高（俯仰 < 3°）；
     ④ 鼠标上 = 抬头爬升；⑤ 鼠标下 = 俯冲；
     ⑥ 低空下沉 → 自动进入着陆程序；⑦ 程序时长随高度（不再固定 2.6s）。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15857.js
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
const RAD = (d) => d * Math.PI / 180;

(async () => {
  const src = fs.readFileSync(ROOT + '/js/map3d.js', 'utf8');
  const um = fs.readFileSync(ROOT + '/js/ui-mapui.js', 'utf8');

  /* ---------- ① 源码结构（逐条独立便于定位） ---------- */
  const S = [
    ['GRAV_SINK 常量', /M\.FLY_GRAV_SINK = 1\.0;/.test(src)],
    ['PITCH_RATE 常量', /M\.FLY_PITCH_RATE = 0\.9;/.test(src)],
    ['TRIM 常量', /M\.FLY_TRIM = 0;/.test(src)],
    ['LAND_AUTO_ALT 常量', /M\.FLY_LAND_AUTO_ALT = 26;/.test(src)],
    ['LAND_SINK 常量', /M\.FLY_LAND_SINK = 26;/.test(src)],
    ['贴回球面 setLength(holdR)', /pos\.setLength\(_holdR\);/.test(src)],
    ['holdR 按 sink 推进', /_holdR -= _sink \* dt;/.test(src)],
    ['sink 公式 = 引力cos − v·sin', /var _sink = \(M\.FLY_GRAV_SINK == null \? 1\.2 : M\.FLY_GRAV_SINK\) \* Math\.cos\(_p0\)/.test(src)],
    ['pitch 重建机头', /head\.copy\(_tanH\)\.multiplyScalar\(Math\.cos\(_p0\)\)/.test(src)],
    ['aimPitch 锁定值', /f\.aimPitch = pit;/.test(src)],
    ['偏航轴用当地径向', /q\.setFromAxisAngle\(rad, -yaw\)/.test(src)],
    ['自动着陆触发', /\(_holdR - R\) < \(M\.FLY_LAND_AUTO_ALT \|\| 26\) && _sink > 0/.test(src)],
    ['着陆时长按高度', /var _need = Math\.abs\(_r0 - _r1\) \/ Math\.max\(1, \(M\.FLY_LAND_SINK \|\| 26\)\)/.test(src)],
    ['HUD 下沉/仰角', um.indexOf('下沉') >= 0 && um.indexOf('仰角') >= 0],
    ['飞控旧形态退役', !/var _climb = u \? \(M\.FLY_CLIMB/.test(src)]
  ];
  const bad0 = S.filter((x) => !x[1]).map((x) => x[0]);
  ok('①源码结构锁 15 条（引力/贴球面/俯仰分离/自动着陆/HUD）',
    bad0.length === 0, bad0.length ? ('缺: ' + bad0.join(', ')) : '15/15');

  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V1457', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1200);
  const box = await (await p.$('#mapCanvas')).boundingBox();
  const CX = Math.round(box.x + box.width / 2), CY = Math.round(box.y + box.height / 2);
  /* 上下偏移必须夹在画布 rect 内：超出 rect 的 mousemove 会被 _flyAimAt 的
     命中判定挡掉（探针⑤首轮 CY+250 落到画布外 → aim 仍是上一次的"抬头"）。 */
  const PAD = 120;
  const UP_Y = Math.max(Math.round(box.y) + PAD, CY - 250);
  const DN_Y = Math.min(Math.round(box.y + box.height) - PAD, CY + 250);

  /* 把飞行器摆成「当地水平切向 v=80」，清 aim，作为平飞基准 */
  /* 把飞行器摆成「指定高度 + 当地水平切向 + 速度 v」的健康巡航态。
     altM 省略 = 保持当前高度。forceCruise 用，保证每次测量不接上一段的残留。 */
  const setLevel = async (v, altM) => p.evaluate((arg) => {
    const M = GAME.map3d, f = M._fly;
    if (M._surf) { try { M.surfaceMode(false); } catch (e) {} }
    let pos = f.pos || [0, 300, 0];
    let r = Math.hypot(pos[0], pos[1], pos[2]);
    if (!(r > 1)) { pos = [0, 300, 0]; r = 300; }
    if (arg.alt != null) {
      const k = (300 + arg.alt) / r;
      pos = [pos[0] * k, pos[1] * k, pos[2] * k];
      r = 300 + arg.alt;
    }
    const rad = pos.map((x) => x / r);
    let t = [rad[1] * 0 - rad[2] * 1, rad[2] * 0 - rad[0] * 0, rad[0] * 1 - rad[1] * 0];
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    t = t.map((x) => x / tl);
    f.pos = pos.slice();
    f.head = t.slice(); f.vel = t.slice(); f.up = rad.slice();
    f.v = arg.v; f.aim = null; f.aimPitch = null; f.pitch = 0;
    f.holdR = r; f.sink = 0; f.autoLand = 0;
    f.active = true; f.phase = 'cruise'; f.phaseT = 0;
    GAME._flyKeys = {};
    return { alt: r - 300, r };
  }, { v: v, alt: (altM == null ? null : altM) });

  /* ---------- ② 平飞保持高度（只受引力下沉） ---------- */
  const l0 = await setLevel(80);
  await p.waitForTimeout(6000);
  const l1 = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt, sink: GAME.map3d._fly.sink,
    pitch: GAME.map3d._fly.pitch }));
  const dAlt = l1.alt - l0.alt;
  ok('②平飞贴球面：6s 高度只按引力下沉（−12 ≤ Δ ≤ −2m），不再自己往上飞（旧 +124.6m）',
    dAlt <= -2 && dAlt >= -12,
    'Δalt=' + dAlt.toFixed(1) + 'm sink=' + (l1.sink || 0).toFixed(2) + 'm/s 俯仰='
      + ((l1.pitch || 0) * 180 / Math.PI).toFixed(2) + '°');

  /* ---------- ③ 水平转向不掉高 ---------- */
  await setLevel(60);
  await p.mouse.move(CX, CY); await p.waitForTimeout(150);
  const h0 = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt, head: GAME.map3d._fly.head.slice() }));
  await p.mouse.move(CX + 280, CY);          /* 纯水平 */
  await p.waitForTimeout(4000);
  const h1 = await p.evaluate(() => {
    const f = GAME.map3d._fly;
    const r = f.pos.map((v) => v / Math.hypot(f.pos[0], f.pos[1], f.pos[2]));
    return { alt: GAME.map3d.flyProbe().alt, head: f.head.slice(),
      pitchDeg: Math.asin(Math.max(-1, Math.min(1,
        f.head[0] * r[0] + f.head[1] * r[1] + f.head[2] * r[2]))) * 180 / Math.PI };
  });
  const turned = Math.acos(Math.max(-1, Math.min(1,
    (h0.head[0] * h1.head[0] + h0.head[1] * h1.head[1] + h0.head[2] * h1.head[2])))) * 180 / Math.PI;
  ok('③鼠标纯水平右移 4s：机头真转向 ≥20°、俯仰 <3°（旧 37.7°）、高度变化 <10m',
    turned >= 20 && Math.abs(h1.pitchDeg) < 3 && Math.abs(h1.alt - h0.alt) < 10,
    '转向=' + turned.toFixed(1) + '° 俯仰=' + h1.pitchDeg.toFixed(2) + '° Δalt=' + (h1.alt - h0.alt).toFixed(1) + 'm');

  /* ---------- ④ 抬头爬升 ---------- */
  await setLevel(80);
  await p.mouse.move(CX, CY); await p.waitForTimeout(150);
  const u0 = await p.evaluate(() => GAME.map3d.flyProbe().alt);
  await p.mouse.move(CX, UP_Y);              /* 鼠标上 */
  await p.waitForTimeout(3500);
  const u1 = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt,
    pitchDeg: (GAME.map3d.flyProbe().pitch || 0) * 180 / Math.PI }));
  ok('④鼠标上 = 抬头爬升：俯仰 >8°，3.5s 高度上升 ≥20m',
    u1.pitchDeg > 8 && (u1.alt - u0) >= 20,
    '俯仰=' + u1.pitchDeg.toFixed(1) + '° Δalt=+' + (u1.alt - u0).toFixed(1) + 'm');

  /* ---------- ⑤ 鼠标下 = 俯冲 ---------- */
  await setLevel(80);
  await p.mouse.move(CX, CY); await p.waitForTimeout(150);
  const d0 = await p.evaluate(() => GAME.map3d.flyProbe().alt);
  await p.mouse.move(CX, DN_Y);
  await p.waitForTimeout(3000);
  const d1 = await p.evaluate(() => ({ alt: GAME.map3d.flyProbe().alt,
    pitchDeg: (GAME.map3d.flyProbe().pitch || 0) * 180 / Math.PI,
    ap: (GAME.map3d._fly.aimPitch == null ? null : GAME.map3d._fly.aimPitch * 180 / Math.PI),
    hasAim: !!GAME.map3d._fly.aim, v: GAME.map3d._fly.v }));
  ok('⑤鼠标下 = 俯冲：俯仰 <−8°，3s 高度下降 ≥20m',
    d1.pitchDeg < -8 && (d1.alt - d0) <= -20,
    '俯仰=' + d1.pitchDeg.toFixed(1) + '° Δalt=' + (d1.alt - d0).toFixed(1) + 'm'
      + ' aimPitch=' + (d1.ap == null ? 'null' : d1.ap.toFixed(1) + '°')
      + ' hasAim=' + d1.hasAim + ' v=' + d1.v.toFixed(1)
      + ' DN_Y=' + DN_Y + ' CY=' + CY);

  /* ---------- ⑥ 低空下沉 → 自动着陆 ---------- */
  await setLevel(0, 22);          /* 离地 22m < LAND_AUTO_ALT(26)、sink>0 */
  await p.waitForTimeout(700);
  const au = await p.evaluate(() => ({ phase: GAME.map3d._fly.phase, auto: GAME.map3d._fly.autoLand,
    alt: GAME.map3d.flyProbe().alt }));
  ok('⑥低空仍在下沉 → 自动进入着陆程序（phase=landing、autoLand=1）',
    au.phase === 'landing' && au.auto === 1,
    'phase=' + au.phase + ' autoLand=' + au.auto + ' alt=' + (au.alt == null ? 'null' : au.alt.toFixed(1)));

  /* ---------- ⑦ 着陆时长随高度（不再固定 2.6s） ---------- */
  const landAt = async (altM) => {
    await setLevel(60, altM);      /* 摆到目标高度、健康巡航态 */
    const started = await p.evaluate(() => GAME.map3d.flyLand());
    if (!started) return -1;
    const t0 = Date.now();
    for (let i = 0; i < 120; i++) {
      /* v158.59：落地态改为 'landed'（停在跑道上、人还没下来），
         旧判据等 'dock' 永远等不到。两个都算落地完成。 */
      const st = await p.evaluate(() => GAME.map3d._fly.phase);
      if (st === 'landed' || st === 'dock') return Date.now() - t0;
      await p.waitForTimeout(100);
    }
    return -1;
  };
  const tHigh = await landAt(320);
  const tLow = await landAt(60);
  ok('⑦着陆时长随高度：320m 用 ≥4s、60m 用 ≤3.5s（旧固定 2.6s 从高处等于砸地）',
    tHigh >= 4000 && tLow > 0 && tLow <= 3500 && tHigh > tLow,
    '320m→' + (tHigh / 1000).toFixed(2) + 's · 60m→' + (tLow / 1000).toFixed(2) + 's');

  /* ---------- ⑧ 无异常 ---------- */
  ok('⑧无页面异常', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'none');

  log('【结果】' + pass + '/' + fail);
  try { fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_v15857_result.log', L.join('\n') + '\n'); } catch (e) { }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针异常：' + e.message); process.exit(2); });
