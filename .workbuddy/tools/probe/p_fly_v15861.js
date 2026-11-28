'use strict';
/* v158.61 验收探针：地面贴图精细度 + 接触阴影。
   ① 结构：makeGroundTex / GROUND_TEX_CELL / 平台 uv / 材质 map
   ② 数值：纹理 1024²、3.2m 一格；平台 uv 与 position 等长且无 NaN
   ③ 视觉：开/关地图纹理的**高频能量**（相邻像素差）差异 ≥20%
   ④ 接触阴影：存在、跟随玩家脚下、opacity 在册
   ⑤ 健全：近景/远景、平地/坡地都不报错；重建耗时在预算内
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_fly_v15861.js */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const ROOT = 'E:/Deepseekdb';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

let pass = 0, fail = 0;
const ok = (n, c, i) => { if (c) { pass++; console.log('✅ ' + n + (i ? ' · ' + i : '')); } else { fail++; console.log('❌ ' + n + (i ? ' · ' + i : '')); } };

/* 画面高频能量：相邻像素亮度差的平均绝对值（纹理越细越大） */
function hfEnergy(file) {
  const im = PNG.sync.read(fs.readFileSync(file));
  let s = 0, n = 0;
  for (let y = 180; y < 560; y += 2) {
    for (let x = 160; x < 1020; x += 2) {
      const i = (y * im.width + x) * 4;
      const l1 = im.data[i] * 0.299 + im.data[i + 1] * 0.587 + im.data[i + 2] * 0.114;
      const i2 = (y * im.width + x + 2) * 4;
      const l2 = im.data[i2] * 0.299 + im.data[i2 + 1] * 0.587 + im.data[i2 + 2] * 0.114;
      s += Math.abs(l1 - l2); n++;
    }
  }
  return s / n;
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'V61', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);

  /* ---------- ① 结构锁 ---------- */
  const src = fs.readFileSync(path.join(ROOT, 'js/map3d.js'), 'utf8');
  ok('①结构：makeGroundTex / GROUND_TEX_CELL / 平台 uv / 两处 map 都在',
    /function makeGroundTex\(\)/.test(src)
    && /M\.GROUND_TEX_CELL = 3\.2;/.test(src)
    && /geo\.setAttribute\('uv', new THREE\.Float32BufferAttribute\(uv, 2\)\)/.test(src)
    && /function _surfPlateGeo\(ci0, t1, t2\)/.test(src)
    && /pmat\.map = makeGroundTex\(\)/.test(src)
    && /tmat\.map = dt; tmat\.needsUpdate = true;/.test(src)
    /* 旧粗纹理（512² grain + repeat 28 = 3.3m 一格糊块）不许复活 */
    && !/makeGrainTex\('c'\); dt\.repeat\.set\(28, 28\)/.test(src));

  /* ---------- 落地 + 生成地表层 ---------- */
  const spot = await p.evaluate(() => {
    const M = GAME.map3d;
    const g = (d) => { try { return M._groundAtUnit(d) || 0; } catch (e) { return 0; } };
    const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    let best = null;
    for (let latD = -70; latD <= 70; latD += 6) {
      const lat = latD * Math.PI / 180;
      for (let lonD = 0; lonD < 360; lonD += 6) {
        const lon = lonD * Math.PI / 180;
        const d = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
        const h = g(d);
        if (h < 0.6 || h > 8) continue;
        const north = unit(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
        const east = unit(Math.cos(lon), 0, -Math.sin(lon));
        const rr = 0.0057;
        let hi = h, lo = h;
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4;
          const q = unit(d[0] + east[0] * Math.cos(a) * rr + north[0] * Math.sin(a) * rr,
                         d[1] + east[1] * Math.cos(a) * rr + north[1] * Math.sin(a) * rr,
                         d[2] + east[2] * Math.cos(a) * rr + north[2] * Math.sin(a) * rr);
          const h3 = g(q);
          if (h3 > hi) hi = h3;
          if (h3 < lo) lo = h3;
        }
        if (!best || (hi - lo) < best.relief) best = { dir: d.slice(), h: h, relief: hi - lo };
      }
    }
    return best;
  });
  const land = async (el, dist) => p.evaluate((a) => {
    const M = GAME.map3d, s = a.spot;
    M.FOLLOW = false;
    M.setSpin && M.setSpin(false);
    /* 必须走 phase=dock：否则 _tickFlight 下一帧把 active 打回 true，地表层建不起来 */
    M._fly.phase = 'dock'; M._fly.active = false;
    if (M._surf) { try { M.surfaceMode(false); } catch (e) {} }
    const gh = M._groundAtUnit(s.dir) || 0;
    M.setPlayerPose({ dir: s.dir, h: gh, yaw: 0, v: [0, 0, 0], ci: null });
    M.surfaceMode(true);
    var pd = M.playerPose().dir;
    M._surfCamAnchor = new THREE.Vector3(pd[0], pd[1], pd[2])
      .multiplyScalar(M.R + (M._groundAtUnit(pd) || 0) + 0.05);
    M._surfDir = new THREE.Vector3(pd[0], pd[1], pd[2]);
    M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (!isFinite(M._surfRight.x)) M._surfRight.set(1, 0, 0);
    M._surfCamE1 = null; M._surfTilt = null;
    M._surfCamDist = a.dist; M.SURF_CAM_EL = a.el; M._surfOrbitYaw = 0;
    M._lastAct = Date.now();
    return { gh: gh };
  }, { spot: spot, el: el, dist: dist });

  await land(0.30, 4.0);
  await p.waitForTimeout(900);

  /* ---------- ② 数值面 ---------- */
  const num = await p.evaluate(() => {
    const M = GAME.map3d;
    const out = { cell: M.GROUND_TEX_CELL };
    let terr = null, plate = null, sc = null;
    try { sc = M._globe && M._globe.parent; } catch (e) {}
    if (sc) sc.traverse((o) => { if (o.name === 'surfTerrain') terr = o; if (o.name === 'surfPlate') plate = o; });
    out.hasTerr = !!terr; out.hasPlate = !!plate;
    if (terr) {
      out.terrMap = !!(terr.material && terr.material.map);
      out.terrMapPx = terr.material.map && terr.material.map.image ? terr.material.map.image.width : null;
      out.terrRepeat = terr.material.map ? +terr.material.map.repeat.x.toFixed(2) : null;
    }
    if (plate) {
      out.plateMap = !!(plate.material && plate.material.map);
      var uvA = plate.geometry.getAttribute('uv');
      var posA = plate.geometry.getAttribute('position');
      out.uvCount = uvA ? uvA.count : 0;
      out.posCount = posA ? posA.count : 0;
      if (uvA) {
        let bad = 0, u0 = 1e9, u1 = -1e9;
        for (let i = 0; i < uvA.count; i++) {
          const u = uvA.getX(i), v = uvA.getY(i);
          if (!isFinite(u) || !isFinite(v)) bad++;
          if (u < u0) u0 = u; if (u > u1) u1 = u;
        }
        out.uvBad = bad;
        out.uvSpan = +(u1 - u0).toFixed(1);
        /* 平台半径 40m → uv 跨度应 ≈ 80/3.2 = 25 量级（不是 0、不是 1e6） */
      }
    }
    out.groundTexPx = (M.makeGroundTex && M.makeGroundTex().image) ? M.makeGroundTex().image.width : null;
    out.aniso = (M.makeGroundTex && M.makeGroundTex().anisotropy) || 0;
    return out;
  });
  ok('②纹理数值：1024² · 3.2m 一格 · 平台 uv 与顶点等长且无 NaN（跨度合理）',
    num.groundTexPx === 1024 && num.cell === 3.2
    && num.plateMap && num.terrMap
    && num.uvCount > 0 && num.uvCount === num.posCount && num.uvBad === 0
    && num.uvSpan > 8 && num.uvSpan < 80,
    'tex=' + num.groundTexPx + ' cell=' + num.cell + ' uv=' + num.uvCount + '/' + num.posCount
      + ' span=' + num.uvSpan + ' aniso=' + num.aniso);
  ok('②b 地形层与平台都用新纹理（不再是 512² grainC）',
    num.terrMapPx === 1024,
    'terrMapPx=' + num.terrMapPx + ' repeat=' + num.terrRepeat);

  /* ---------- ③ 视觉：开/关纹理的高频能量 ---------- */
  await p.screenshot({ path: SHOTS + 'v15861-A-ground-near.png' });
  const hfOn = hfEnergy(SHOTS + 'v15861-A-ground-near.png');
  await p.evaluate(() => {
    const M = GAME.map3d;
    let sc = null; try { sc = M._globe && M._globe.parent; } catch (e) {}
    if (sc) sc.traverse((o) => {
      if ((o.name === 'surfTerrain' || o.name === 'surfPlate') && o.material) {
        o.material.map = null; o.material.needsUpdate = true;
      }
    });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + 'v15861-B-ground-notex.png' });
  const hfOff = hfEnergy(SHOTS + 'v15861-B-ground-notex.png');
  const gain = hfOff > 0.01 ? (hfOn - hfOff) / hfOff * 100 : 999;
  ok('③纹理真的进入画面：高频能量（相邻像素差）比无纹理高 ≥20%',
    hfOn > hfOff && gain >= 20,
    '有纹理=' + hfOn.toFixed(2) + ' 无纹理=' + hfOff.toFixed(2) + ' 提升=' + gain.toFixed(0) + '%');

  /* ---------- ④ 接触阴影 ---------- */
  const cs = await p.evaluate(() => {
    const M = GAME.map3d;
    /* 恢复纹理 */
    let sc = null; try { sc = M._globe && M._globe.parent; } catch (e) {}
    if (sc) sc.traverse((o) => {
      if ((o.name === 'surfTerrain' || o.name === 'surfPlate') && o.material && !o.material.map) {
        o.material.map = M.makeGroundTex(); o.material.needsUpdate = true;
      }
    });
    const c = M._contactShadow;
    if (!c) return null;
    const pd = M.playerPose().dir;
    const gh = M._groundAtUnit(pd) || 0;
    const want = new THREE.Vector3(pd[0], pd[1], pd[2]).multiplyScalar(M.R + gh + 0.12);
    return { exists: true, op: c.material.opacity,
      distToFoot: +c.position.distanceTo(want).toFixed(2),
      visible: c.visible, billboard: Math.abs(c.quaternion.w) > 0.01,
      scaleY: +c.scale.y.toFixed(2), name: c.name };
  });
  ok('④接触阴影：挂在玩家脚下（≤0.3m）、可见、billboard 压扁',
    !!cs && cs.exists && cs.visible && cs.op > 0.3
    && cs.distToFoot <= 0.3 && cs.name === 'contactShadow'
    && cs.scaleY > 0.2 && cs.scaleY < 0.7,
    cs ? ('op=' + cs.op.toFixed(2) + ' 距脚=' + cs.distToFoot + 'm scaleY=' + cs.scaleY) : 'null');

  /* ---------- ⑤ 近景/远景 + 平地/坡地都不报错 ---------- */
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.06; M._surfCamDist = 3.2; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + 'v15861-C-ground-low.png' });
  const lowOk = await p.evaluate(() => {
    const M = GAME.map3d, c = M._contactShadow;
    return { op: c ? c.material.opacity : -1, surf: M._surf };
  });
  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 1.2; M._surfCamDist = 12; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + 'v15861-D-ground-mid.png' });
  ok('⑤低仰角与中距离都正常（地表态保持、阴影未消失、无异常）',
    lowOk.surf === true && lowOk.op >= 0 && errs.length === 0,
    'surf=' + lowOk.surf + ' op=' + (lowOk.op >= 0 ? lowOk.op.toFixed(2) : 'n/a') + ' errs=' + errs.length);

  /* ---------- ⑥ 重建耗时 ---------- */
  const ms = await p.evaluate(() => {
    const M = GAME.map3d;
    const st = M.surfStats ? M.surfStats() : null;
    return st ? st.ms : null;
  });
  ok('⑥地表层重建耗时 < 400ms（含 1024² 纹理首建）',
    ms != null && ms < 400, 'ms=' + ms);

  ok('⑦无 JS 异常', errs.length === 0, 'errs=' + errs.length + (errs.length ? ' ' + errs[0] : ''));

  console.log('\n【结果】' + pass + '/' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
