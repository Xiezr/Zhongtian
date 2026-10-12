/* ============================================================
 * sphere.js — **球面世界内核**（纯 JS · 无 THREE · 逻辑与渲染共用 SSOT）
 * ------------------------------------------------------------
 * 这是全项目**唯一的地形与地块几何出口**：
 *   · 拓扑：icosphere（icosahedron 逐级细分）→ V/F → 六边球对偶 → cells
 *   · 地形：球面原生 3D 噪声（fbm3）→ sphElev → cellType（9 种）→ 每格类型/等级
 *   · 几何：每格世界坐标 pos/rim（贴地形高度），线框段 upos、拾取面 fpos/faceCell
 *   · 坐标：经纬 lon/lat（由格方向现算）· nearestCell(dir)
 * map3d.js 只做**渲染**（材质/光照/贴图/相机/标注/拾取），拓扑与地形一律读本模块。
 * 逻辑层（map/state/domain/battle/ui）读 GAME.sphere.cells 取地形 —— 不再有平面 500×500 中介。
 * ⚠️ 必须纯 JS：smoke/e2e 在 node 下跑（无 THREE / 无 DOM）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var SP = GAME.sphere = {};

  var SUB = 6;                    /* icosphere 细分（固定）：顶点/地块数 = 10×4^6+2 = 40962 */
  SP.sub = SUB;
  var R = 300;                    /* 星球海平面半径（世界单位） */
  var HSC = 26;                   /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  SP.R = R; SP.HSC = HSC;
  /* 星球规格（单星球）：换参数=换一颗星球的环境（海陆比/山脉/颗粒/气候）。*/
  SP.PLANET = { seaFrac: 0.45, ridge: 1.5, detail: 0.7, temp: 1.0 };

  function mw() { return (GAME.DATA && GAME.DATA.MAP_W) || 500; }
  function mh() { return (GAME.DATA && GAME.DATA.MAP_H) || 500; }

  /* ---- 球面原生 3D 噪声（地形直接在球面生成 · 连续无缝 · 不来自平面地图）---- */
  function h3(i, j, k, salt) {
    var h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x2545f491);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 13; return (h >>> 8) / 16777216;
  }
  function n3(x, y, z, s) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function L(a, b, t) { return a + (b - a) * t; }
    var c000 = h3(xi, yi, zi, s), c100 = h3(xi + 1, yi, zi, s), c010 = h3(xi, yi + 1, zi, s), c110 = h3(xi + 1, yi + 1, zi, s);
    var c001 = h3(xi, yi, zi + 1, s), c101 = h3(xi + 1, yi, zi + 1, s), c011 = h3(xi, yi + 1, zi + 1, s), c111 = h3(xi + 1, yi + 1, zi + 1, s);
    var x00 = L(c000, c100, u), x10 = L(c010, c110, u), x01 = L(c001, c101, u), x11 = L(c011, c111, u);
    return L(L(x00, x10, v), L(x01, x11, v), w);
  }
  function fbm3(d, f, s) {
    var v = 0, a = 0.5, sum = 0;
    for (var i = 0; i < 8; i++) { v += a * n3(d[0] * f, d[1] * f, d[2] * f, s + i * 131); sum += a; a *= 0.5; f *= 2.03; }
    return v / sum;
  }
  SP.h3 = h3; SP.n3 = n3; SP.fbm3 = fbm3;
  function seed3() { return ((GAME.state && GAME.state.map && GAME.state.map.seed) || 1) | 0; }
  SP.seed3 = seed3;
  var _seaCache = null, _seaSeed = null;
  function seaLevel() {
    var s = seed3();
    if (_seaCache != null && _seaSeed === s) return _seaCache;
    /* 各面粗采样估 cont 的均值+标准差 → 海平面 ≈ 均值 + k·σ 使约 seaFrac 的格在海面下。 */
    var sum = 0, sum2 = 0, n = 0;
    for (var f = 0; f < 6; f++) {
      var u0 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][f];
      for (var i = 0; i < 256; i++) {
        var a = (i * 0.618) % 1, b = (i * 0.382 + f * 0.13) % 1;
        var d = [u0[0] + (a - .5) * 2, u0[1] + (b - .5) * 2, u0[2] + ((a + b) - 1)];
        var L = Math.hypot(d[0], d[1], d[2]) || 1; d = [d[0] / L, d[1] / L, d[2] / L];
        var c = fbm3(d, 1.1, s + 11); sum += c; sum2 += c * c; n++;
      }
    }
    var mean = sum / n, sd = Math.sqrt(Math.max(1e-6, sum2 / n - mean * mean));
    var sf = (SP.PLANET && SP.PLANET.seaFrac) || 0.45;
    var z = sf < 0.5 ? -(0.5 - sf) * 2.6 : (sf - 0.5) * 2.6;   /* 目标占比→分位数→海平面 */
    _seaCache = mean + z * sd; _seaSeed = s;
    return _seaCache;
  }
  SP.seaLevel = seaLevel;
  function sphElev(d) {
    var s = seed3();
    var cont = fbm3(d, 1.1, s + 11);                      /* 大陆/海洋（低频）*/
    var ridged = 1 - Math.abs(2 * fbm3(d, 2.8, s + 77) - 1);
    var sea = seaLevel(), P = SP.PLANET || {};
    var land = Math.max(0, cont - sea);
    var e = (cont - sea) * 3.0 + ridged * ridged * 1.5 * land * 3.2 * (P.ridge == null ? 1.5 : P.ridge) / 1.5;   /* 山脉（脊状 · 更强）*/
    var det = (fbm3(d, 6.5, s + 191) - 0.5) * 0.5 * land;
    var fine = (fbm3(d, 16.0, s + 331) - 0.5) * 0.35 * land;            /* 高频细节（放大可见）*/
    return Math.max(-0.6, e + det + fine);
  }
  SP.sphElev = sphElev;

  /* 球面地块 → **游戏 7 地形**（按高度+纬度最大近似分配）：湖泊/沼泽/平原/草原/森林/荒漠/山地。*/
  var TYPE_NAME = { lake: '湖泊', zhaoze: '沼泽', plain: '平地', caoyuan: '草原', forest: '森林', desert: '荒漠', hill: '山地' };
  SP.TYPE_NAME = TYPE_NAME;
  function cellType(e, dy, emax) {
    var en = emax > 0 ? e / emax : 0;                     /* 归一化高度 0~1 */
    if (e < 0) return 'lake';                             /* 海 → 湖泊 */
    if (e < 0.025) return 'zhaoze';                       /* 低平湿岸 → 沼泽 */
    var temp = 1 - dy * dy;
    /* v90.67（老板 1）：荒漠先于平地判（原 `en<0.16 → plain` 在前 + `e<0.25` 与量纲冲突 → 荒漠恒 0）。 */
    if (temp > 0.62 && en < 0.34) return 'desert';        /* 低纬干热 → 荒漠 */
    if (en < 0.16) return 'plain';
    if (en < 0.34) return 'caoyuan';
    if (en < 0.56) return 'forest';
    return 'hill';                                        /* 高 → 山地 */
  }
  SP.cellType = cellType;

  /* ---- icosphere 拓扑 ---- */
  function icoSpheres(sub) {
    var t = (1 + Math.sqrt(5)) / 2, V, F, cache;
    V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
    F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    cache = {};
    function mid(a, b) {
      var k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] != null) return cache[k];
      var p = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2];
      var l = Math.hypot(p[0], p[1], p[2]); V.push([p[0] / l, p[1] / l, p[2] / l]); return (cache[k] = V.length - 1);
    }
    for (var s = 0; s < sub; s++) {
      var NF = [];
      for (var i = 0; i < F.length; i++) {
        var a = F[i][0], b = F[i][1], c = F[i][2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      F = NF;
    }
    return { V: V, F: F };
  }
  SP.icoSpheres = icoSpheres;

  /* ---- 构建（幂等 · 随 seed 与 sub 重建）---- */
  var _builtSub = -1, _builtSeed = null;
  function build(sub) {
    sub = sub == null ? SUB : sub;
    var sd = seed3();
    if (SP.cells && _builtSub === sub && _builtSeed === sd) return SP;
    var ico = icoSpheres(sub);
    var V = ico.V, F = ico.F, nf = F.length, f, nv = V.length;
    var cent = [];
    for (f = 0; f < nf; f++) {
      var a = V[F[f][0]], b = V[F[f][1]], c = V[F[f][2]];
      var px = (a[0] + b[0] + c[0]) / 3, py = (a[1] + b[1] + c[1]) / 3, pz = (a[2] + b[2] + c[2]) / 3;
      var l = Math.hypot(px, py, pz); cent.push([px / l, py / l, pz / l]);
    }
    var vf = {}, adj = new Array(nv);
    for (var vi = 0; vi < nv; vi++) adj[vi] = [];
    for (f = 0; f < nf; f++) {
      var T = F[f];
      for (var k = 0; k < 3; k++) { var vv = T[k]; (vf[vv] = vf[vv] || []).push(f); }
      adj[T[0]].push(T[1], T[2]); adj[T[1]].push(T[0], T[2]); adj[T[2]].push(T[0], T[1]);
    }
    /* 类型 + 等级（BFS：同类区域内，离异类越远越高）*/
    var typ = new Array(nv), lvl = new Int16Array(nv), eArr = new Float32Array(nv), emax = 0.01;
    for (vi = 0; vi < nv; vi++) { eArr[vi] = sphElev(V[vi]); if (eArr[vi] > emax) emax = eArr[vi]; }
    for (vi = 0; vi < nv; vi++) {
      var e = eArr[vi];
      typ[vi] = cellType(e, V[vi][1], emax); lvl[vi] = -1;
      V[vi]._e = e;
    }
    var q = [];
    for (vi = 0; vi < nv; vi++) {
      var an = adj[vi];
      for (var m2 = 0; m2 < an.length; m2++) if (typ[an[m2]] !== typ[vi]) { lvl[vi] = 0; q.push(vi); break; }
    }
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      for (var n2 = 0; n2 < adj[cur].length; n2++) {
        var w = adj[cur][n2];
        if (typ[w] === typ[cur] && lvl[w] === -1) { lvl[w] = lvl[cur] + 1; q.push(w); }
      }
    }
    var upos = [], fpos = [], cells = [], off = 0;
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    /* 地块**贴地形**：某方向的表面半径 = 海平面 + max(0, 球面高度)×HSC + 微抬升 */
    function terrainR(d) { return R + Math.max(0, sphElev(d)) * HSC + 0.5; }
    for (var vs in vf) {
      vi = +vs; var n = V[vi], fs = vf[vs];
      if (fs.length < 3) continue;
      var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var tx = cross(up, n), tl = Math.hypot(tx[0], tx[1], tx[2]); tx = [tx[0] / tl, tx[1] / tl, tx[2] / tl];
      var ty2 = cross(n, tx);
      fs.sort(function (A, B) { var cA = cent[A], cB = cent[B]; return Math.atan2(dot(cA, ty2), dot(cA, tx)) - Math.atan2(dot(cB, ty2), dot(cB, tx)); });
      var rn = terrainR(n), P = [n[0] * rn, n[1] * rn, n[2] * rn];      /* 顶点坐在地形高度上 */
      var mm = fs.length, RIM = [];
      for (var i2 = 0; i2 < mm; i2++) { var cc = cent[fs[i2]], rr2 = terrainR(cc); RIM.push([cc[0] * rr2, cc[1] * rr2, cc[2] * rr2]); }
      for (var e2 = 0; e2 < mm; e2++) { var r1 = RIM[e2], r2 = RIM[(e2 + 1) % mm]; upos.push(r1[0], r1[1], r1[2], r2[0], r2[1], r2[2]); }
      var dep = lvl[vi] < 0 ? 0 : lvl[vi];
      var lv = 6 + Math.min(4, dep);                       /* 6~10 级：中央(离异类边界远)高、边缘低 */
      for (var t2 = 0; t2 < mm; t2++) {
        var s1 = RIM[t2], s2 = RIM[(t2 + 1) % mm];
        fpos.push(P[0], P[1], P[2], s1[0], s1[1], s1[2], s2[0], s2[1], s2[2]);
      }
      /* 球系坐标（经纬度）。⚠️ 平面格坐标 x/y 为过渡遗留，M1 后移除。*/
      var lonDeg = (Math.atan2(n[2], n[0]) * 180 / Math.PI + 360) % 360;
      var latDeg = Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI;
      var cgx = Math.round(lonDeg / 360 * mw()) % mw();
      var cgy = Math.round((latDeg / 180 + 0.5) * mh()) % mh();
      cells[vi] = { dir: n, pos: P, rim: RIM, type: typ[vi], name: TYPE_NAME[typ[vi]], level: lv, e: n._e,
        off: off, nt: mm, lon: lonDeg, lat: latDeg,
        x: ((cgx % mw()) + mw()) % mw(), y: ((cgy % mh()) + mh()) % mh() };
      off += mm;
    }
    var faceCell = new Int32Array(fpos.length / 9);
    for (var c2 in cells) if (cells[c2]) for (var j2 = 0; j2 < cells[c2].nt; j2++) faceCell[cells[c2].off + j2] = +c2;

    SP.V = V; SP.F = F; SP.cent = cent; SP.adj = adj; SP.cells = cells;
    SP.upos = upos; SP.fpos = fpos; SP.faceCell = faceCell; SP.nv = nv;
    _builtSub = sub; _builtSeed = sd;
    SP.sub = sub;
    return SP;
  }
  SP.build = build;

  /* 确保已构建（幂等；seed/sub 变则重建）。建局/读档后调用。 */
  SP.ensure = function (sub) { return build(sub); };
  /* 保存/恢复 —— 球面地形**原样**随存档往返（不重摇 → 同一颗星球；也免掉 build 的 40962 计算）。*/
  SP.save = function () {
    if (!SP.cells) return null;
    return { sub: SP.sub, seed: _builtSeed,
      cells: SP.cells.map(function (c) { return c && { dir: c.dir, type: c.type, level: c.level, e: c.e, lon: c.lon, lat: c.lat, off: c.off, nt: c.nt }; }) };
  };
  SP.load = function (blob) {
    if (!blob || !blob.cells) return false;
    build(blob.sub == null ? SUB : blob.sub);         /* 建骨架（几何/邻接）；随后覆盖地形 */
    var cs = SP.cells, src = blob.cells;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], b = src[i];
      if (c && b) { c.type = b.type; c.level = b.level; c.e = b.e; }
    }
    SP.TYPE_NAME = TYPE_NAME;
    return true;
  };

  /* 方向 → 最近格索引（0..nv-1） */
  function nearestCell(dir) {
    var v = SP.V; if (!v) return -1;
    var best = -1, bd = -2;
    for (var i = 0; i < v.length; i++) { var d = v[i]; if (!d) continue; var dt = d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2]; if (dt > bd) { bd = dt; best = i; } }
    return best;
  }
  SP.nearestCell = nearestCell;

  /* 经纬 → 单位球方向（与 map3d 一致） */
  SP.dirOfLonLat = function (lon, lat) {
    var a = lat * Math.PI / 180, b = lon * Math.PI / 180, cl = Math.cos(a);
    return [cl * Math.cos(b), Math.sin(a), cl * Math.sin(b)];
  };
  /* 球面地形查询（按世界格坐标 x,y）—— **地形判据的唯一出口**（所见即所得）。
     世界格 → 经纬（与 GAME.map.lonlatOf 同一映射）→ 最近六边格 → 该格球面地形。
     逻辑层（占领记录/建城判据/建城按钮）读它，永不读平面 s.map.grid。 */
  SP.terrainAt = function (worldX, worldY) {
    if (!SP.cells || worldX == null || worldY == null) return null;
    var ci = SP.ciOfXY(worldX, worldY);
    var c = ci >= 0 && SP.cells[ci];
    return c ? { ci: ci, type: c.type, level: c.level } : null;
  };
  /* 格索引 → 经纬 */
  SP.dirOf = function (ci) { var c = SP.cells && SP.cells[ci]; return c ? c.dir : null; };

  /* ============================================================
   * 六边相邻距离（环数）—— 世界距离的唯一出口。
   * 在 icosphere 六边格图上 BFS：两个格的**相邻跳数**（"隔几格"）。
   * 复用距离/戳数组，按调用自增戳 → 免清空（O(访问) 而非 O(nv)）。
   * ============================================================ */
  var _dArr = null, _dStamp = null, _dVer = 0;
  function hexDist(a, b) {
    if (a === b) return 0;
    var adj = SP.adj, nv = SP.nv;
    if (!adj || a < 0 || b < 0 || a >= nv || b >= nv) return 0;
    if (!_dArr) { _dArr = new Int32Array(nv); _dStamp = new Int32Array(nv); }
    var stamp = ++_dVer;
    var q = [a], head = 0; _dArr[a] = 0; _dStamp[a] = stamp;
    while (head < q.length) {
      var cur = q[head++];
      if (cur === b) return _dArr[cur];
      var an = adj[cur], d = _dArr[cur] + 1;
      for (var i = 0; i < an.length; i++) {
        var nb = an[i];
        if (_dStamp[nb] !== stamp) { _dStamp[nb] = stamp; _dArr[nb] = d; q.push(nb); }
      }
    }
    return -1;
  }
  SP.hexDist = hexDist;
  /* 世界格坐标 → 六边格索引（地形查询同一映射）。带 memo（nearestCell 为 O(nv)，
     行军距离预览等会重复问同一点）。*/
  var _xyCi = null;
  SP.ciOfXY = function (worldX, worldY) {
    if (!SP.cells || worldX == null || worldY == null) return -1;
    var W = (GAME.DATA && GAME.DATA.MAP_W) || 500, H = (GAME.DATA && GAME.DATA.MAP_H) || 500;
    var lon = ((worldX / W) * 360 + 360) % 360, lat = (0.5 - worldY / H) * 180;
    if (!_xyCi) _xyCi = {};
    var key = worldX + ',' + worldY;
    var v = _xyCi[key];
    if (v === undefined) { v = _xyCi[key] = nearestCell(SP.dirOfLonLat(lon, lat)); }
    return v;
  };
  /* 两点（世界格坐标）的六边环数距离；无内核时回退切比雪夫（与旧口径一致）。 */
  SP.hexDistAt = function (x1, y1, x2, y2) {
    var a = SP.ciOfXY(x1, y1), b = SP.ciOfXY(x2, y2);
    if (a < 0 || b < 0) return Math.max(Math.abs((x1 || 0) - (x2 || 0)), Math.abs((y1 || 0) - (y2 || 0)));
    return hexDist(a, b);
  };
  /* 两个实体（城/野地/据点，含 .ci 则直用，否则按 x,y 反查）的六边环数。 */
  SP.distOf = function (e1, e2) {
    if (!e1 || !e2) return 1;
    if (e1.ci != null && e1.ci >= 0 && e2.ci != null && e2.ci >= 0) return hexDist(e1.ci, e2.ci);
    return SP.hexDistAt(e1.x, e1.y, e2.x, e2.y);
  };
})();
