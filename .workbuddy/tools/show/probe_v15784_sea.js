/* 海面异常点反查：相机停在 agl=55 看纯海，屏幕打网格射线 → 每点落到哪一格、
   什么类型、顶点色多少。用来回答"那些深色六边形块 / 浅色斑到底是什么"。
   输出：类型分布、非 lake 点的屏幕坐标与类型、以及每种类型的平均顶点色。 */
const { chromium } = require('playwright-core');
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
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.setSpin(false); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(4500);

  /* 第一步：先对准纯海 + 拉到 agl 55，等渲染落定 */
  await p.evaluate(function () {
    var M = window.GAME.map3d, SP = window.GAME.sphere;
    var spot = null;
    for (var i = 0; i < SP.cells.length; i++) {
      if (SP.cells[i].type !== 'lake') continue;
      var an = SP.adj[i] || [], ok = true;
      for (var k = 0; k < an.length; k++) if (SP.cells[an[k]].type !== 'lake') { ok = false; break; }
      if (ok && SP.cells[i].dir) { spot = SP.cells[i].dir; break; }
    }
    M.lookAtDir(spot);
    var d0 = M.R + 56;
    var f = (Math.log(d0) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
    M.setZoom(Math.max(0, Math.min(1, f)));
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  });
  await p.waitForTimeout(1500);

  const res = await p.evaluate(function () {
    var M = window.GAME.map3d, SP = window.GAME.sphere, T = window.THREE;

    var cv = document.querySelector('#map-canvas') || document.querySelector('canvas');
    var rc = cv.getBoundingClientRect();
    var cam = M._camObj();
    var globe = M._globe;
    var ray = new T.Raycaster();
    var out = [], types = {}, colSum = {};
    for (var gy = 0; gy < 20; gy++) {
      for (var gx = 0; gx < 32; gx++) {
        var sx = rc.left + rc.width * (0.08 + 0.84 * gx / 31);
        var sy = rc.top + rc.height * (0.12 + 0.76 * gy / 19);
        var nx = ((sx - rc.left) / rc.width) * 2 - 1;
        var ny = -((sy - rc.top) / rc.height) * 2 + 1;
        ray.setFromCamera(new T.Vector2(nx, ny), cam);
        var hit = ray.intersectObject(globe, false);
        if (!hit.length) continue;
        var pt = hit[0].point.clone().normalize();
        var ci = SP.nearestCell ? SP.nearestCell([pt.x, pt.y, pt.z]) : -1;
        if (ci < 0) continue;
        var tp = SP.cells[ci].type;
        types[tp] = (types[tp] || 0) + 1;
        if (!colSum[tp]) colSum[tp] = { r: 0, g: 0, b: 0, n: 0 };
        var cc = M.cellColorOf(ci) || [0, 0, 0];
        colSum[tp].r += cc[0]; colSum[tp].g += cc[1]; colSum[tp].b += cc[2]; colSum[tp].n++;
        /* 记录非 lake 点（屏幕相对坐标） */
        out.push({ tp: tp, u: +(gx / 31).toFixed(2), v: +(gy / 19).toFixed(2),
          ci: ci, col: [Math.round(cc[0]), Math.round(cc[1]), Math.round(cc[2])],
          alt: SP._terr && SP._terr.alt ? +SP._terr.alt[ci].toFixed(2) : null });
      }
    }
    var avg = {};
    Object.keys(colSum).forEach(function (k) {
      var c = colSum[k];
      avg[k] = [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)];
    });
    return { n: Object.keys(types).reduce(function (a, k) { return a + types[k]; }, 0),
      types: types, avg: avg, nonLake: out,
      veil: +(M._cloudVeil || 0).toFixed(3), haze: +(M._cloudHaze || 0).toFixed(3) };
  });

  console.log('采样点数 = ' + res.n + ' · cloudVeil=' + res.veil + ' cloudHaze=' + res.haze);
  console.log('类型分布 = ' + JSON.stringify(res.types));
  console.log('各类型平均格色 = ' + JSON.stringify(res.avg));
  /* 找格色离群点：与全图中位色差 > 26 */
  var all = res.nonLake.map(function (o) { return o.col; });
  var med = [0, 1, 2].map(function (k) {
    var a = all.map(function (c) { return c[k]; }).sort(function (x, y) { return x - y; });
    return a[Math.floor(a.length / 2)] || 0;
  });
  var outl = res.nonLake.map(function (o) {
    var d = Math.abs(o.col[0] - med[0]) + Math.abs(o.col[1] - med[1]) + Math.abs(o.col[2] - med[2]);
    return { o: o, d: d };
  }).filter(function (x) { return x.d > 26; }).sort(function (a, b) { return b.d - a.d; });
  console.log('中位格色 = RGB(' + med.join(',') + ') · 离群点 = ' + outl.length + ' / ' + res.nonLake.length);
  outl.slice(0, 16).forEach(function (x) {
    var o = x.o;
    console.log('  (' + o.u + ',' + o.v + ') ' + o.tp + ' RGB(' + o.col.join(',') + ') Δ=' + x.d + ' alt=' + o.alt + ' ci=' + o.ci);
  });
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
