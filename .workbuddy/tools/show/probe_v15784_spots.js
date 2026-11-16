/* 色斑取证：海面上那些米黄色小块到底是什么。
   输出：
     ① 全星球地形类型分布（格数）
     ② 陆地连通簇的大小分布 —— 尤其是 1~3 格的小簇（"色斑"候选）
     ③ 小簇明细：类型 / 海拔 / 距海 / 世界坐标 → 经纬度
     ④ globe 顶点色采样：与 lake 基色差 > 40 的顶点，按 cell 类型归类
   判据：若存在大量 1~2 格沙漠/平原簇且被海包围 → 就是"色斑"的来源。 */
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
  }, 20260926);
  await p.waitForTimeout(4000);

  const out = await p.evaluate(function () {
    var SP = window.GAME.sphere, cells = SP.cells, adj = SP.adj, T = SP._terr || {};
    var n = cells.length;
    var cnt = {}, land = [];
    for (var i = 0; i < n; i++) {
      var t = cells[i].type || '?';
      cnt[t] = (cnt[t] || 0) + 1;
      if (t !== 'lake') land.push(i);
    }
    /* 陆地连通簇（BFS，只走非 lake） */
    var seen = new Uint8Array(n), clusters = [];
    for (var a = 0; a < land.length; a++) {
      var s = land[a];
      if (seen[s]) continue;
      var q = [s], mem = [], types = {};
      seen[s] = 1;
      for (var h = 0; h < q.length; h++) {
        var c = q[h]; mem.push(c);
        types[cells[c].type] = (types[cells[c].type] || 0) + 1;
        var an = adj[c] || [];
        for (var k = 0; k < an.length; k++) {
          var nb = an[k];
          if (!seen[nb] && cells[nb].type !== 'lake') { seen[nb] = 1; q.push(nb); }
        }
      }
      clusters.push({ size: mem.length, members: mem, types: types });
    }
    clusters.sort(function (x, y) { return x.size - y.size; });
    var hist = {};
    clusters.forEach(function (c) { var k = c.size <= 5 ? String(c.size) : (c.size <= 20 ? '6-20' : (c.size <= 100 ? '21-100' : '100+')); hist[k] = (hist[k] || 0) + 1; });

    /* 小簇明细（≤3 格） */
    var tiny = clusters.filter(function (c) { return c.size <= 3; }).map(function (c) {
      var c0 = cells[c.members[0]];
      var d = c0.dir || [0, 0, 1];
      var lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI;
      var lon = Math.atan2(d[0], d[2]) * 180 / Math.PI;
      return {
        size: c.size, types: c.types,
        alt: T.alt ? +T.alt[c.members[0]].toFixed(2) : null,
        coast: T.coast ? T.coast[c.members[0]] : null,
        lat: +lat.toFixed(1), lon: +lon.toFixed(1),
        ci: c.members[0]
      };
    });

    /* globe 顶点色：统计被海包围的暖色顶点 */
    var G = window.GAME.map3d, globe = G._globe || null;

    return {
      n: n, typeCount: cnt, clusters: clusters.length, clusterHist: hist,
      tinyCount: tiny.length,
      tiny: tiny.slice(0, 40),
      globeFound: !!globe
    };
  });

  console.log('格数 = ' + out.n);
  console.log('类型分布 = ' + JSON.stringify(out.typeCount));
  console.log('陆地簇 = ' + out.clusters + ' 个 · 大小分布 = ' + JSON.stringify(out.clusterHist));
  console.log('≤3 格的小簇 = ' + out.tinyCount + ' 个');
  console.log('前 40 个小簇：');
  out.tiny.forEach(function (t) {
    console.log('  size=' + t.size + ' type=' + JSON.stringify(t.types) + ' alt=' + t.alt
      + ' coast=' + t.coast + ' (' + t.lat + '°, ' + t.lon + '°) ci=' + t.ci);
  });
  console.log('globe mesh 找到 = ' + out.globeFound + ' · 页面异常 ' + errs.length
    + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  process.exit(0);
})();
