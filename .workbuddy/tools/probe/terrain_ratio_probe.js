/* 地形占比探针 —— S2 调平地占比的基线与验收尺
 * 用法：node .workbuddy/tools/probe/terrain_ratio_probe.js
 * 输出：多 seed 下各类型占比 + plain 连片均值 + 立城资格格数
 */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };

  /* 源码模式：直接读 js/sphere.js（调阈值时免重建 bundle，迭代快）
     —— 参数 --bundle 时改读 bundle-core.js，用于验收「产物与源码一致」
     ⚠️ sphere.js 首行是 ESM `import './core.js'`，浏览器由 build_bundle 剥掉；
        这里同一口径剥掉 import 行后 eval，避免 "import outside a module"。 */
  var useBundle = process.argv.indexOf('--bundle') >= 0;
  var srcs = useBundle ? ['bundle-core.js'] : ['sphere.js'];
  srcs.forEach(function (f) {
    var src = fs.readFileSync(path.join('E:/Deepseekdb', 'js', f), 'utf8');
    if (f === 'sphere.js') src = src.replace(/^\s*import\s+[^\n]*\n/gm, '');
    try { (0, eval)(src); } catch (e) { console.log('LOAD_ERR ' + f, e.message); process.exit(1); }
  });
  if (!GAME.sphere) { console.log('GAME.sphere 未挂载'); process.exit(1); }

  var SP = GAME.sphere;
  var SEEDS = [1, 7, 42, 101, 2026, 20261016];
  var NAME = SP.TYPE_NAME;
  var TYPES = ['lake', 'zhaoze', 'plain', 'caoyuan', 'forest', 'desert', 'hill'];

  console.log('== 地形占比（' + SEEDS.length + ' seed 平均） ==');
  var agg = {}; TYPES.forEach(function (t) { agg[t] = 0; });
  var rows = [];

  SEEDS.forEach(function (sd) {
    GAME.state = { map: { seed: sd }, activePlanet: 1 };
    SP._seedOverride = sd;
    SP.setPlanet(sd);
    var cells = SP.cells || [];
    var n = cells.length, cnt = {};
    TYPES.forEach(function (t) { cnt[t] = 0; });
    var land = 0;
    for (var i = 0; i < n; i++) {
      var t = (cells[i] && cells[i].type) || 'lake';
      cnt[t] = (cnt[t] || 0) + 1;
      if (t !== 'lake') land++;
    }
    /* plain 连片：对每个 plain 簇算平均规模（全簇） */
    var seen = new Uint8Array(n), sizes = [];
    var adj = SP.adj || [];
    for (var a = 0; a < n; a++) {
      if (seen[a] || !cells[a] || cells[a].type !== 'plain') continue;
      var q = [a]; seen[a] = 1;
      for (var h = 0; h < q.length; h++) {
        var c = q[h], an = adj[c] || [];
        for (var k = 0; k < an.length; k++) {
          var nb = an[k];
          if (!seen[nb] && cells[nb] && cells[nb].type === 'plain') { seen[nb] = 1; q.push(nb); }
        }
      }
      sizes.push(q.length);
    }
    var sum = 0; sizes.forEach(function (s) { sum += s; });
    rows.push({ seed: sd, n: n, cnt: cnt, land: land, plainClusters: sizes.length, plainAvg: sizes.length ? (sum / sizes.length) : 0, plainMax: sizes.length ? Math.max.apply(null, sizes) : 0 });
    TYPES.forEach(function (t) { agg[t] += cnt[t] / n; });
  });

  rows.forEach(function (r) {
    var parts = TYPES.map(function (t) { return NAME[t] + ' ' + (r.cnt[t] / r.n * 100).toFixed(1) + '%'; });
    console.log('seed ' + r.seed + '：' + parts.join(' | '));
    console.log('       陆 ' + (r.land / r.n * 100).toFixed(1) + '% · plain 簇 ' + r.plainClusters + ' 个 · 均 ' + r.plainAvg.toFixed(1) + ' 格 · 最大 ' + r.plainMax + ' 格');
  });

  console.log('== 平均占比 ==');
  TYPES.forEach(function (t) {
    var p = agg[t] / SEEDS.length * 100;
    console.log('  ' + NAME[t] + '( ' + t + ' )：' + p.toFixed(2) + '%');
  });

  /* ---- 平原内部单调性：随机 plain 格 ±5 网格内的地形种类数 ----
     意图：老板要「增大平原占比」，但出生点周围不能只有一种颜色（看不出地形）。
     smoke 有一条「±5 内 ≥3 种地形」的老断言，这条指标就是它的量化版。 */
  console.log('== 平原视野多样性（随机 plain 格 ±5 网格内地形种类） ==');
  SEEDS.forEach(function (sd) {
    GAME.state = { map: { seed: sd }, activePlanet: 1 };
    SP._seedOverride = sd;
    SP.setPlanet(sd);
    var cells = SP.cells || [], n = cells.length;
    var plains = [];
    for (var i = 0; i < n; i++) if (cells[i] && cells[i].type === 'plain') plains.push(i);
    if (!plains.length) return;
    var step = Math.max(1, Math.floor(plains.length / 200));
    var hist = {};
    var mn = 99;
    for (var s = 0; s < plains.length; s += step) {
      var c0 = cells[plains[s]], seenT = {};
      for (var dy = -5; dy <= 5; dy++) for (var dx = -5; dx <= 5; dx++) {
        var t = cells[(SP.ciOfXY ? SP.ciOfXY(c0.x + dx, c0.y + dy) : -1)];
        if (t && t.type) seenT[t.type] = 1;
      }
      var k = Object.keys(seenT).length;
      hist[k] = (hist[k] || 0) + 1;
      if (k < mn) mn = k;
    }
    var tot = 0; for (var hk in hist) tot += hist[hk];
    var parts = Object.keys(hist).sort().map(function (k) {
      return k + '种:' + (hist[k] / tot * 100).toFixed(0) + '%';
    });
    console.log('seed ' + sd + '：最少 ' + mn + ' 种 | ' + parts.join(' '));
  });
})();
