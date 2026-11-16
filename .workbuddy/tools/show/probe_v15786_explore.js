/* v157.86 取证：① 边界带已消失 ② 已探索区域真的提亮 ③ 提亮是"从原色乘回"不是累乘
   判据：
     · `M._fogEdgeProbe` 不存在 / 场景里没有 `_fogEdgeMesh`
     · 提亮顶点数 > 0；已探明/未探明同类地形的顶点色亮度比 ≈ M.EXPLORE_LIT
     · 连续 3 次迷雾推进后，同一格亮度不再继续变亮（防累乘）
   出 2 张图：初始视野 / 推进后。 */
const { chromium } = require('playwright-core');
const OUT = '.workbuddy/tmp/';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    G.map3d.setZoom && G.map3d.setZoom(0.30);
  }, 20260926);
  await p.waitForTimeout(4500);

  const st1 = await p.evaluate(function () {
    var M = window.GAME.map3d, F = window.GAME.fog, SP = window.GAME.sphere;
    var g = M._globe;
    var attr = g && g.geometry && g.geometry.attributes.color;
    /* 采样：已探明 vs 未探明 各取 200 个顶点，比较亮度比 */
    var vx = M._globeVtxCell, arr = attr.array, base = M._globeColBase;
    var sumIn = 0, nIn = 0, sumOut = 0, nOut = 0;
    for (var i = 0; i < vx.ci0.length && (nIn < 200 || nOut < 200); i += 7) {
      var ci = vx.ci0[i];
      if (ci < 0) continue;
      var lum = 0.299 * arr[i * 3] + 0.587 * arr[i * 3 + 1] + 0.114 * arr[i * 3 + 2];
      if (F.get(ci) > 0) { sumIn += lum; nIn++; } else { sumOut += lum; nOut++; }
    }
    return {
      hasEdgeProbe: typeof M._fogEdgeProbe === 'function',
      edgeMeshInScene: (function () {
        var found = false;
        (g && g.parent ? g.parent : { children: [] }).children.forEach(function (o) {
          if (o && o.geometry && o.geometry.attributes && o.geometry.attributes.uv && o.material && o.material.map && o.renderOrder === 40) found = true;
        });
        return found;
      })(),
      lit: M._globeExploreLit, n: M._globeExploreN, LIT: M.EXPLORE_LIT,
      lumIn: nIn ? +(sumIn / nIn).toFixed(4) : null, nIn: nIn,
      lumOut: nOut ? +(sumOut / nOut).toFixed(4) : null, nOut: nOut,
      ratio: (nIn && nOut) ? +((sumIn / nIn) / (sumOut / nOut)).toFixed(3) : null,
      knownCells: (function () { var k = 0; for (var i = 0; i < SP.cells.length; i++) if (F.get(i) > 0) k++; return k; })()
    };
  });
  console.log('初始：edgeProbe=' + st1.hasEdgeProbe + ' · 边界mesh=' + st1.edgeMeshInScene
    + ' · 提亮顶点 ' + st1.lit + '/' + st1.n + ' · LIT=' + st1.LIT);
  console.log('  已探明亮度 ' + st1.lumIn + '（' + st1.nIn + ' 顶点） · 未探明 ' + st1.lumOut + '（' + st1.nOut + '） · 比 ' + st1.ratio);
  console.log('  已探明格数 ' + st1.knownCells);
  await p.screenshot({ path: OUT + 'v15786_before.png' });

  /* 推进迷雾：从首府往外 reveal 一大圈 */
  const st2 = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, F = G.fog;
    var c = G.currentCity();
    for (var r = 3; r <= 9; r += 2) { try { F.revealAround(c.ci != null ? c.ci : 0, r, 2); } catch (e) { } }
    if (G.map3d && G.map3d.rebuildFog) G.map3d.rebuildFog(); else if (M._paintGlobeExplore) M._paintGlobeExplore();
    var SP = G.sphere, k = 0;
    for (var i = 0; i < SP.cells.length; i++) if (F.get(i) > 0) k++;
    return { known: k, lit: M._globeExploreLit };
  });
  await p.waitForTimeout(900);
  console.log('推进后：已探明格 ' + st2.known + ' · 提亮顶点 ' + st2.lit);
  await p.screenshot({ path: OUT + 'v15786_after.png' });

  /* 严格判据：取一个**格心顶点**（t≈0）且当前未探明 → 记录色 → 点亮它 → 再记录
     → 亮度比必须≈EXPLORE_LIT（跨地形比较没有意义，同顶点前后比才有）。 */
  const st3 = await p.evaluate(function () {
    var M = window.GAME.map3d, F = window.GAME.fog;
    var vx = M._globeVtxCell, arr = M._globe.geometry.attributes.color.array, base = M._globeColBase;
    var pick = -1, ci = -1;
    for (var i = 0; i < vx.ci0.length; i++) {
      var c0 = vx.ci0[i];
      if (c0 < 0 || (vx.t[i] || 0) > 0.01) continue;
      if (F.get(c0) > 0) continue;                 /* 要未探明的 */
      pick = i; ci = c0; break;
    }
    if (pick < 0) return { err: '没有可用的未探明格心顶点' };
    var lum = function (k) { return 0.299 * arr[k] + 0.587 * arr[k + 1] + 0.114 * arr[k + 2]; };
    var i3 = pick * 3;
    var before = [arr[i3], arr[i3 + 1], arr[i3 + 2]];
    var lumB = lum(i3);
    F.revealAround(ci, 1, 2);                      /* 把这一格点亮（含邻格） */
    M._paintGlobeExplore();
    var after = [arr[i3], arr[i3 + 1], arr[i3 + 2]];
    var lumA = lum(i3);
    /* 防累乘：再连画两次，色值不许再变 */
    M._paintGlobeExplore(); M._paintGlobeExplore();
    var after2 = [arr[i3], arr[i3 + 1], arr[i3 + 2]];
    return {
      ci: ci, before: before, after: after, after2: after2,
      lumB: +lumB.toFixed(5), lumA: +lumA.toFixed(5), lumA2: +lum(i3).toFixed(5),
      ratio: +(lumA / lumB).toFixed(4),
      /* 未探索顶点 = 原色 × DIM，所以"基座一致"要按 DIM 比 */
      baseSame: (Math.abs(base[i3] * (M.EXPLORE_DIM || 1) - before[0]) < 1e-6),
      dim: (M.EXPLORE_DIM || 1),
      idempotent: (after[0] === after2[0] && after[1] === after2[1] && after[2] === after2[2])
    };
  });
  console.log('同顶点前后：未探明 ' + st3.lumB + ' → 已探明 ' + st3.lumA
    + ' · 比 ' + st3.ratio + '（应 ≈' + st1.LIT + '/' + st3.dim + ' = ' + (st1.LIT / (st3.dim || 1)).toFixed(3) + '）');
  console.log('  原始色基座一致 = ' + st3.baseSame + ' · 重复重绘幂等 = ' + st3.idempotent);
  /* 拉近拍两张：已探索区与未探明的明暗差要看近景 */
  await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, c = G.currentCity();
    if (M.focusOnCell && c && c.ci != null) M.focusOnCell(c.ci, true);
    /* 极端系数对照：先证明"顶点色真的上了屏"，再回正常值。
       1.45 / 0.65 的差在画面上必须一眼可见；看不见就是链路断了（不是系数小）。 */
    M._EXPLORE_LIT_BAK = M.EXPLORE_LIT; M._EXPLORE_DIM_BAK = M.EXPLORE_DIM;
    M.EXPLORE_LIT = 1.45; M.EXPLORE_DIM = 0.65;
    M._paintGlobeExplore();
    if (M.setZoom) M.setZoom(0.10);   /* agl≈140：一屏装得下 已探索圈 + 未探索外圈 */
    if (G.ui && G.ui.renderMapCanvas) G.ui.renderMapCanvas();
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 'v15786_near_extreme.png' });
  /* 还原正常系数再拍一张 */
  await p.evaluate(function () {
    var M = window.GAME.map3d;
    M.EXPLORE_LIT = M._EXPLORE_LIT_BAK; M.EXPLORE_DIM = M._EXPLORE_DIM_BAK;
    M._paintGlobeExplore();
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'v15786_near.png' });

  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));

  const ok = !st1.hasEdgeProbe && !st1.edgeMeshInScene
    && st1.lit > 0
    && st3 && Math.abs(st3.ratio - (st1.LIT / (st3.dim || 1))) < 0.02
    && st3.baseSame && st3.idempotent && errs.length === 0;
  console.log(ok ? 'EXPLORE_PASS' : 'EXPLORE_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
