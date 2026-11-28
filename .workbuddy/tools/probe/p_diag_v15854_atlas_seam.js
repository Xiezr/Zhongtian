'use strict';
/* v158.54 取证探针 2：cube-sphere **图集接缝**诊断（只读）
   ------------------------------------------------------------
   探针 1 量到顶点 normal 差 0.02°、顶点 color 差 0，但图集模式下顶点 color 全是
   (1,1,1) —— 那不能证明接缝连续。真正的颜色/法线来自**图集纹理**：
     · bakeColorAtlas 六个面各占图集一块（4 列 × 2 行）；
     · 面法线用**面参数 u,v 单边差分**（v157.94 明确"不环绕"），
       六个面在共享棱上取的是各自一侧的差分 → 两侧法线方向不同；
     · 图集边界用 ClampToEdge + mipmap → 跨棱采样会混进错误邻域。
   本探针直接读图集 canvas 像素，对 12 条共享棱比较两侧面边界像素的颜色/法线差异。
   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_diag_v15854_atlas_seam.js
*/
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const L = [];
const log = (s) => { L.push(String(s)); console.log(s); };

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
    const st = await p.evaluate(() => ({ g: !!(GAME.map3d && GAME.map3d._colTex) }));
    if (st.g) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const M = GAME.map3d;
    const tex = M._colTex, ntex = M._nrmTex;
    if (!tex || !tex.image) return { err: 'no color atlas' };
    const cv = tex.image, N = cv.width / 4;
    const cx = cv.getContext('2d'), col = cx.getImageData(0, 0, cv.width, cv.height).data;
    let ndat = null, nd = null;
    if (ntex && ntex.image) { nd = ntex.image.getContext('2d').getImageData(0, 0, ntex.image.width, ntex.image.height).data; ndat = ntex.image; }
    const SP = GAME.mapSphere, F = SP.CUBE_FACES;
    const px = (data, x, y) => { const o = (y * cv.width + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
    const npx = (data, x, y) => { const o = (y * (ndat ? ndat.width : cv.width) + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
    /* 面 fi 的参数 (u,v)∈[-1,1] → 图集像素（与 bakeColorAtlas 同口径：中心 (x+.5)/N） */
    const at = (fi, u, v) => {
      const ox = (fi % 4) * N, oy = ((fi / 4) | 0) * N;
      const x = ox + Math.max(0, Math.min(N - 1, Math.floor((u + 1) / 2 * N)));
      const y = oy + Math.max(0, Math.min(N - 1, Math.floor((v + 1) / 2 * N)));
      return { x, y };
    };
    /* 对每条 cube 棱：取棱上若干采样点的方向 dir，找两个面在共享边界的像素 */
    const E = [];
    for (let f = 0; f < 6; f++) {
      const fn = F[f];
      /* 该面的四条边：u=±1 / v=±1 */
      for (const edge of ['u-', 'u+', 'v-', 'v+']) {
        for (let t = 0; t < 5; t++) {
          const q = -0.8 + t * 0.4;
          let u, v;
          if (edge === 'u-') { u = -1; v = q; } else if (edge === 'u+') { u = 1; v = q; }
          else if (edge === 'v-') { u = q; v = -1; } else { u = q; v = 1; }
          const pp = fn(u, v), l = Math.hypot(pp[0], pp[1], pp[2]);
          const dir = [pp[0] / l, pp[1] / l, pp[2] / l];
          E.push({ f, edge, u, v, dir, colPx: at(f, u, v) });
        }
      }
    }
    /* 按 dir 归组（toFixed(4)），每组应恰有 2 个面；比较它们颜色/法线像素 */
    const g = Object.create(null);
    E.forEach((e) => { const k = e.dir.map((z) => z.toFixed(4)).join(','); (g[k] || (g[k] = [])).push(e); });
    let pairs = 0, maxCol = 0, sumCol = 0, maxNrm = 0, sumNrm = 0, worst = null;
    for (const k in g) {
      const list = g[k];
      if (list.length < 2) continue;
      for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) {
        const A = list[a].colPx, B = list[c].colPx;
        const ca = px(col, A.x, A.y), cb = px(col, B.x, B.y);
        const dc = Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) + Math.abs(ca[2] - cb[2]);
        pairs++; sumCol += dc; if (dc > maxCol) maxCol = dc;
        if (nd) {
          const na = npx(nd, A.x, A.y), nb = npx(nd, B.x, B.y);
          const dn = Math.abs(na[0] - nb[0]) + Math.abs(na[1] - nb[1]) + Math.abs(na[2] - nb[2]);
          sumNrm += dn; if (dn > maxNrm) maxNrm = dn;
          if (dn > 60 && (!worst || dn > worst.dn)) worst = { dir: k, f1: list[a].f + list[a].edge, f2: list[c].f + list[c].edge, dc, dn, ca, cb, na, nb };
        }
      }
    }
    return {
      atlasW: cv.width, tileN: N, useColorAtlas: M.useColorAtlas,
      pairs, avgColDiff: +(sumCol / (pairs || 1)).toFixed(2), maxColDiff: maxCol,
      avgNrmDiff: nd ? +(sumNrm / (pairs || 1)).toFixed(2) : null, maxNrmDiff: maxNrm,
      worstNrmPair: worst, nrmType: ntex ? ntex.type : null
    };
  });
  log('【cube-sphere 图集接缝诊断】');
  Object.keys(r).forEach((k) => log('  ' + k + ': ' + JSON.stringify(r[k])));
  log('【页面异常】' + (errs.length ? errs.slice(0, 4).join(' | ') : '无'));
  await b.close();
  require('fs').writeFileSync(ROOT + '/.workbuddy/tmp/diag_v15854_atlas.log', L.join('\n'), 'utf8');
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
