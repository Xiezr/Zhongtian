'use strict';
/* v158.61 诊断：地面贴图精细度 / "走在空中"的成因。
   量化四件事：
   ① 颜色图集空间分辨率（米/纹素）—— 决定近看糊不糊
   ② 地表细节纹理的米/格（repeat × 几何 UV 跨度）
   ③ 人物是否有投影（castShadow / 接触阴影）
   ④ 人物脚底与地形的高度差（是否悬空 / 陷入）
   并拍"近地第三人称看脚下"的实机图。 */
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';

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
  await p.evaluate(() => { GAME.newGame({ name: 'G61', cityName: '灰岗', mapSeed: 20261127 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!(GAME.map3d && GAME.map3d._globe))) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);

  /* 找一块平地（1.7m 环高差最小） */
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
        const relief = hi - lo;
        if (!best || relief < best.relief) best = { dir: d.slice(), h: h, relief: relief };
      }
    }
    return best;
  });
  console.log('平地 dir=' + JSON.stringify(spot.dir.map((x) => +x.toFixed(3))) + ' h=' + spot.h.toFixed(2) + ' relief=' + spot.relief.toFixed(2));

  /* 量化 */
  const info = await p.evaluate((s) => {
    const M = GAME.map3d, R = M.R;
    const out = {};
    /* ① 颜色图集：6 面 atlas，每面 N² 覆盖 90° 球面 → 弧长 πR/2 */
    var N = +M.COLOR_ATLAS_N || 256;
    out.atlasN = N;
    out.atlasTexPx = M._colTex && M._colTex.image ? M._colTex.image.width : null;
    var arc = Math.PI * R / 2;                     /* 单面弧长（米） */
    out.atlasMPerTexel = +(arc / N).toFixed(3);
    /* ② 地表细节纹理：repeat 与地表地形的 UV 跨度 */
    out.detailRepeat = M.DETAIL_REPEAT;
    out.detailU = M._detailU ? M._detailU.value : null;
    var dt = null, dtn = null;
    var root = (M._surfRoot || null);
    /* 找地表地形 mesh，读它 map 的 repeat 与几何 uv 范围 */
    var terr = null;
    try {
      var sc = M._globe && M._globe.parent;
      if (sc) sc.traverse(function (o) { if (o.name === 'surfTerrain') terr = o; });
    } catch (e) { }
    if (terr) {
      dt = terr.material && terr.material.map;
      out.terrRepeat = dt ? [dt.repeat.x, dt.repeat.y] : null;
      var uv = terr.geometry && terr.geometry.attributes && terr.geometry.attributes.uv;
      if (uv) {
        var u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (var i = 0; i < uv.count; i++) {
          var uu = uv.getX(i), vv = uv.getY(i);
          if (uu < u0) u0 = uu; if (uu > u1) u1 = uu;
          if (vv < v0) v0 = vv; if (vv > v1) v1 = vv;
        }
        out.terrUvSpan = [+(u1 - u0).toFixed(2), +(v1 - v0).toFixed(2)];
      }
      out.terrVerts = terr.geometry.attributes.position.count;
    }
    /* ③ 阴影：整个场景扫一遍 */
    var shadowCasters = 0, shadowReceivers = 0, shadowEnabled = false, shadowMats = 0;
    try {
      var sc2 = M._globe && M._globe.parent;
      if (sc2) sc2.traverse(function (o) {
        if (o.castShadow) shadowCasters++;
        if (o.receiveShadow) shadowReceivers++;
        if (o.material && /Shadow/.test(o.material.type || '')) shadowMats++;
      });
      out.rendererShadow = !!(M._renderer && M._renderer.shadowMap && M._renderer.shadowMap.enabled);
    } catch (e) { }
    out.shadowCasters = shadowCasters;
    out.shadowReceivers = shadowReceivers;
    out.shadowMats = shadowMats;
    /* ④ 人物与地面 */
    try {
      var pp = M.playerPose();
      out.pose = { dir: pp.dir ? pp.dir.map((x) => +x.toFixed(3)) : null, h: pp.h };
      var gh = M._groundAtUnit(pp.dir) || 0;
      out.poseGh = +gh.toFixed(3);
      out.footGap = +(pp.h - gh).toFixed(3);
    } catch (e) { }
    out._detailTexSize = (M._detailTexU && M._detailTexU.value && M._detailTexU.value.image)
      ? M._detailTexU.value.image.width : null;
    return out;
  }, spot);
  console.log(JSON.stringify(info, null, 1));

  /* 摆到平地 + 进地表 + 近景 */
  await p.evaluate((s) => {
    const M = GAME.map3d;
    M.FOLLOW = false;
    M.setSpin && M.setSpin(false);
    /* v158.61：必须走真实的"下机"路径（phase=dock）—— 只把 active 置 false
       会被 _tickFlight 下一帧打回 true，地表层永远建不起来（诊断首轮就是这样
       拍到了球面纯色）。 */
    M._fly.phase = 'dock'; M._fly.active = false;
    if (M._surf) { try { M.surfaceMode(false); } catch (e) {} }
    const gh = M._groundAtUnit([s.dir[0], s.dir[1], s.dir[2]]) || 0;
    M.setPlayerPose({ dir: [s.dir[0], s.dir[1], s.dir[2]], h: gh, yaw: 0, v: [0, 0, 0], ci: null });
    M.surfaceMode(true);
    M._surfCamAnchor = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2])
      .normalize().multiplyScalar(M.R + gh + 0.05);
    M._surfDir = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
    M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (!isFinite(M._surfRight.x)) M._surfRight.set(1, 0, 0);
    M._surfCamE1 = null; M._surfTilt = null;
    M._surfCamDist = 4.0;
    M.SURF_CAM_EL = 0.30;
    M._surfOrbitYaw = 0;
    M._lastAct = Date.now();
  }, spot);
  await p.waitForTimeout(900);
  await p.screenshot({ path: SHOTS + 'v15861-A-ground-near.png' });

  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 0.06; M._surfCamDist = 3.2; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOTS + 'v15861-B-ground-lowest.png' });

  await p.evaluate(() => { const M = GAME.map3d; M.SURF_CAM_EL = 1.2; M._surfCamDist = 8; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOTS + 'v15861-C-ground-mid.png' });

  console.log('errs=' + errs.length + (errs.length ? ' ' + errs[0] : ''));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
