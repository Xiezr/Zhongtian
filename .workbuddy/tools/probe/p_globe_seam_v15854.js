'use strict';
/* v158.54 行为探针：球面生成层无死角（图集法线跨棱零缝）
   ------------------------------------------------------------
   真浏览器读图集 canvas，对 cube-sphere 12 条共享棱的 60 个采样点，
   比较两侧面在同一 3D 方向处的法线纹素差异。
   判据（带下限，防 0===0 平凡解）：
     ① 采样对数 ≥ 40（真有跨棱比较，不是空集）
     ② 跨棱法线平均差 / 最大差 = 0（v158.54 前是 68.65 / 358）
     ③ 颜色跨棱差仍小（回归护栏：修法线不许破坏配色）
     ④ 球面原生结构在岗（sphBasis/elevAt/中心差分/低频，源码形态锁）
     ⑤ 轴线 axisRoot 只做标识：是 Mesh、DoubleSide、depthWrite=false，
        且不在拾取链（无 raycast 覆写）—— 不参与几何判定。
     ⑥ 页面无异常 + 图集烘焙成功 + 耗时在预算内（< 4.5s，防退化为 8 octaves 全量差分）
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_globe_seam_v15854.js
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
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
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'Z', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 150; i++) {
    const st = await p.evaluate(() => ({ c: !!(GAME.map3d && GAME.map3d._colTex && GAME.map3d._nrmTex) }));
    if (st.c) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const M = GAME.map3d, tex = M._colTex, ntex = M._nrmTex;
    const cv = tex.image, N = cv.width / 4;
    const col = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const nd = ntex.image.getContext('2d').getImageData(0, 0, ntex.image.width, ntex.image.height).data;
    const F = GAME.mapSphere.CUBE_FACES;
    const px = (data, x, y) => { const o = (y * cv.width + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
    const at = (fi, u, v) => {
      const ox = (fi % 4) * N, oy = ((fi / 4) | 0) * N;
      return { x: ox + Math.max(0, Math.min(N - 1, Math.floor((u + 1) / 2 * N))),
               y: oy + Math.max(0, Math.min(N - 1, Math.floor((v + 1) / 2 * N))) };
    };
    const E = [];
    for (let f = 0; f < 6; f++) {
      for (const edge of ['u-', 'u+', 'v-', 'v+']) {
        for (let t = 0; t < 5; t++) {
          const q = -0.8 + t * 0.4;
          let u, v;
          if (edge === 'u-') { u = -1; v = q; } else if (edge === 'u+') { u = 1; v = q; }
          else if (edge === 'v-') { u = q; v = -1; } else { u = q; v = 1; }
          const pp = F[f](u, v), l = Math.hypot(pp[0], pp[1], pp[2]);
          E.push({ dir: pp.map((z) => +(z / l).toFixed(4)), px: at(f, u, v) });
        }
      }
    }
    const g = Object.create(null);
    E.forEach((e) => { const k = e.dir.join(','); (g[k] || (g[k] = [])).push(e); });
    let pairs = 0, sumN = 0, maxN = 0, sumC = 0;
    for (const k in g) {
      const list = g[k];
      if (list.length < 2) continue;
      for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) {
        const A = list[a].px, B = list[c].px;
        const na = px(nd, A.x, A.y), nb = px(nd, B.x, B.y);
        const dn = Math.abs(na[0] - nb[0]) + Math.abs(na[1] - nb[1]) + Math.abs(na[2] - nb[2]);
        const ca = px(col, A.x, A.y), cb = px(col, B.x, B.y);
        const dc = Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) + Math.abs(ca[2] - cb[2]);
        pairs++; sumN += dn; maxN = Math.max(maxN, dn); sumC += dc;
      }
    }
    const axis = M._axisRoot;
    return {
      pairs, avgN: +(sumN / (pairs || 1)).toFixed(2), maxN, avgC: +(sumC / (pairs || 1)).toFixed(2),
      bakeMs: M._colAtlasMs, atlasErr: M._colAtlasErr,
      axis: axis ? { isMesh: !!axis.isMesh, type: axis.geometry && axis.geometry.type,
        doubleSide: axis.material && axis.material.side === 2,
        depthWrite: axis.material ? axis.material.depthWrite : null,
        raycastOwn: Object.prototype.hasOwnProperty.call(axis, 'raycast') } : null
    };
  });
  const src = fs.readFileSync(ROOT + '/js/map3d.js', 'utf8');

  console.log('【v158.54 球面生成层无死角】');
  ok('① 跨棱采样对数 ≥40（真比较，非空集）', r.pairs >= 40, 'pairs=' + r.pairs);
  ok('② 跨棱法线归零：avg=0 且 max=0（旧基线 68.65/358）', r.avgN === 0 && r.maxN === 0,
    'avg=' + r.avgN + ' max=' + r.maxN);
  ok('③ 颜色跨棱差仍小（修法线不破坏配色）', r.avgC < 12, 'avgC=' + r.avgC);
  ok('④ 球面原生结构在岗（sphBasis/elevAt/中心差分/极点兜底，旧面参数差分退役）',
    /function sphBasis\(d\)/.test(src) && /function elevAt\(d, t, s\)/.test(src)
    && /var g1 = \(eT1p - eT1m\) \/ \(2 \* epsS\)/.test(src)
    && !/var dhdu = \(hArr\[yy \* N \+ xp\]/.test(src));
  ok('⑤ 轴线只做标识：Mesh + DoubleSide + depthWrite=false + 无自有 raycast',
    r.axis && r.axis.isMesh && r.axis.doubleSide && r.axis.depthWrite === false && !r.axis.raycastOwn,
    JSON.stringify(r.axis));
  ok('⑥ 图集烘焙成功且在预算内 <4.5s（防退回 8 octaves 全量差分；cached 亦算成功）',
    (r.atlasErr === 'ok' || r.atlasErr === 'cached') && r.bakeMs > 0 && r.bakeMs < 4500,
    'bake=' + r.bakeMs + 'ms err=' + r.atlasErr);
  ok('⑦ 页面无异常', errs.length === 0, errs.slice(0, 2).join(' | ') || '无');

  console.log('\n结果：' + pass + '/' + fail);
  await b.close();
  fs.writeFileSync(ROOT + '/.workbuddy/tmp/probe_globe_seam_v15854.log',
    'pass=' + pass + ' fail=' + fail + '\n' + JSON.stringify(r, null, 2), 'utf8');
  if (fail) process.exit(1);
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
