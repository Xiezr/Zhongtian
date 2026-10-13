/* ============================================================
 * map3d.js — Three.js **星球 3D 地图**（cube-sphere 地形 + 等面积地块）
 * ------------------------------------------------------------
 * 老板口径：地形卷成**球形**（星球表面地形）；地形与地块都**不在两极收敛**；
 *   地块**等面积**、随数量缩小；地块**依附地形高度**（距球心 = 海平面 R + 地形高）。
 * 地形：**cube-sphere**（立方体 6 面细分投影球面 → 顶点全球均匀，无极性挤压）。
 * 地块：**斐波那契球面均匀分布**（等面积 · 无极性收敛）。
 * 数据：高度/深度来自 GAME.map.heightAt / depthAt（单一出口）；地形读 GAME.map.tile。
 * 相机：轨道（左键拖动转向 · 滚轮缩放）。回退：GAME.map3d.enabled=false → 二维。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  if (typeof THREE === 'undefined') { GAME.map3d = { enabled: false, why: 'no-three' }; return; }
  var SP = GAME.sphere;                            /* 球面世界内核（拓扑/地形/几何 SSOT，见 js/sphere.js）*/
  var M = GAME.map3d = { enabled: true };

  var R = (SP && SP.R) || 300;                    /* 星球海平面半径 */
  var HSC = (SP && SP.HSC) || 26;                 /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  var K = 200;                   /* cube-sphere 每面细分（更细 → 放大看得到地形细节）*/
  /* 地块细分（固定）：icosphere 顶点数 = 10×4^6+2 = **40962 个地块** —— SSOT 在 sphere.js。*/
  var TILE_SUB = (SP && SP.sub) || 6;
  /* 球面内核函数别名（渲染复用）—— 地形/噪声/球面高度一律走 sphere.js，别在此重算。*/
  var sphElev = SP.sphElev, seed3 = SP.seed3, nearestCell = SP.nearestCell;
  var TYPE_NAME = SP.TYPE_NAME, h3 = SP.h3, n3 = SP.n3, fbm3 = SP.fbm3;
  M.PLANET = SP.PLANET;                           /* 星球规格（SSOT 在 sphere.js）*/

  /* 球面原生生物群系色（按高度 + 纬度）—— 连续、无接缝。*/
  function sphBiome(e, dy, d) {
    var s = seed3();
    var lat = Math.abs(dy), temp = (1 - lat * lat) * (M.PLANET && M.PLANET.temp != null ? M.PLANET.temp : 1);
    if (e < 0) return e < -0.15 ? [22, 50, 84] : [40, 84, 126];           /* 深海 / 浅海 */
    if (e < 0.05) return [226, 214, 158];                  /* 滩 */
    var m = ramp(Math.min(1, e / 1.15));
    if (temp < 0.28 && e < 0.5) m = [m[0] * 0.8 + 44, m[1] * 0.8 + 40, m[2] * 0.8 + 36];   /* 苔原 */
    else if (temp > 0.68 && e < 0.32) m = [m[0] * 0.78 + 74, m[1] * 0.78 + 58, m[2] * 0.78 + 8]; /* 沙 / 荒漠 */
    /* v90.67（老板 1）：高频**颗粒斑驳** —— 近看有花草 / 岩石细节（顶点级，无贴图）。 */
    if (d) {
      var spk = fbm3(d, 55.0, s + 701) - 0.5;
      var k = 1 + spk * (M.PLANET && M.PLANET.detail != null ? M.PLANET.detail : 0.7) * 0.6;
      m = [m[0] * k, m[1] * k, m[2] * k];
    }
    return [Math.max(0, Math.min(255, m[0])), Math.max(0, Math.min(255, m[1])), Math.max(0, Math.min(255, m[2]))];
  }

  /* 高度色带（海蓝 → 滩 → 草 → 黄 → 岩 → 雪）*/
  function hx(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  var RAMP = [[0, hx('#3a6ea5')], [0.02, hx('#e8dfae')], [0.06, hx('#6a9a44')], [0.22, hx('#4f8a38')],
    [0.42, hx('#b3ab6a')], [0.62, hx('#a07a52')], [0.82, hx('#9c8f7e')], [1.0, hx('#eef2f2')]];
  function ramp(h) {
    for (var i = 1; i < RAMP.length; i++) if (h <= RAMP[i][0]) {
      var a = RAMP[i - 1][1], b = RAMP[i][1], t = (h - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    return RAMP[RAMP.length - 1][1];
  }
  var R3, scene, cam, globe, water, tiles, wcv, built = false, _tileSub = 0;
  var camO = { yaw: 0.8, pitch: 0.42, dist: R * 2.9 };
  M.camO = camO;                                          /* 暴露以便脚本/调试设视角 */

  function ensure() {
    if (R3) return;
    wcv = document.createElement('canvas');
    R3 = new THREE.WebGLRenderer({ canvas: wcv, antialias: true, preserveDrawingBuffer: true });
    R3.setPixelRatio(1);
    if (THREE.SRGBColorSpace) R3.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping != null) { R3.toneMapping = THREE.ACESFilmicToneMapping; R3.toneMappingExposure = 1.05; }
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1020);
    cam = new THREE.PerspectiveCamera(42, 1, 1, 6000);
    scene.add(new THREE.AmbientLight(0xdfe8f0, 0.30));
    scene.add(new THREE.HemisphereLight(0xd8e4f0, 0x2a2a30, 0.26));
    var sun = new THREE.DirectionalLight(0xffe6b8, 2.9);
    sun.position.set(-800, 500, -500); scene.add(sun); M._sun = sun;
  }

  /* v90.67（老板 1 · 方案B）：**细节纹理** —— 可平铺的多倍频值噪声，乘到地形顶点色上，
     近看有"花草 / 岩石"颗粒（比纯顶点色强一档；cube 面间因纹理可平铺而无缝）。*/
  function makeDetailTex() {
    var N = 384, L8 = null, L16 = null, L32 = null;
    function lattice(g, salt) { var a = new Float32Array(g * g); for (var i = 0; i < g * g; i++) a[i] = h3(i % g, (i / g) | 0, salt, 13); return a; }
    L8 = lattice(8, 11); L16 = lattice(16, 22); L32 = lattice(32, 33);
    function samp(L, g, x, y) {
      var gx = x * g, gy = y * g, x0 = Math.floor(gx), y0 = Math.floor(gy);
      var fx = gx - x0, fy = gy - y0, x1 = (x0 + 1) % g, y1 = (y0 + 1) % g, x0m = ((x0 % g) + g) % g, y0m = ((y0 % g) + g) % g;
      var v00 = L[y0m * g + x0m], v10 = L[y0m * g + x1], v01 = L[y1 * g + x0m], v11 = L[y1 * g + x1];
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var t = v00 + (v10 - v00) * u, b = v01 + (v11 - v01) * u;
      return t + (b - t) * v;
    }
    var cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var cx = cv.getContext('2d'); var img = cx.createImageData(N, N);
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var x = xx / N, y = yy / N;
      var n = samp(L8, 8, x, y) * 0.5 + samp(L16, 16, x, y) * 0.3 + samp(L32, 32, x, y) * 0.2;
      var c = Math.round((0.74 + n * 0.26) * 255);
      var o = (yy * N + xx) * 4; img.data[o] = c; img.data[o + 1] = c; img.data[o + 2] = c; img.data[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /* cube-sphere 地形（**球面原生噪声 · 连续无缝**）：顶点全球均匀，地形直接在球面生成。*/
  function buildGlobe() {
    /* v90.78：重建安全 —— 换星球时先移除旧的星球网格与海面（否则会**叠加**多颗球）。 */
    if (globe) { scene.remove(globe); if (globe.geometry) globe.geometry.dispose(); globe = null; }
    if (water) { scene.remove(water); if (water.geometry) water.geometry.dispose(); water = null; }
    var VW = K + 1;
    var FACES = [
      function (u, v) { return [1, v, u]; }, function (u, v) { return [-1, v, -u]; },
      function (u, v) { return [u, 1, -v]; }, function (u, v) { return [u, -1, v]; },
      function (u, v) { return [u, v, 1]; }, function (u, v) { return [-u, v, -1]; }
    ];
    var pos = [], col = [], nor = [], idx = [], uv = [];
    FACES.forEach(function (fn) {
      var base = pos.length / 3;
      for (var j = 0; j < VW; j++) for (var i = 0; i < VW; i++) {
        var u = -1 + 2 * i / K, v = -1 + 2 * j / K, p = fn(u, v);
        var L = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        var dx = p[0] / L, dy = p[1] / L, dz = p[2] / L;
        var e = sphElev([dx, dy, dz]);                     /* 球面原生高度（连续 · 无接缝 · 不来自平面地图）*/
        var rr = R + Math.max(0, e) * HSC;
        pos.push(dx * rr, dy * rr, dz * rr);
        nor.push(dx, dy, dz);                              /* 法线=位置方向（球面朝外 · 不受绕向影响）*/
        uv.push(i / K, j / K);
        var c = sphBiome(e, dy, [dx, dy, dz]);
        col.push(c[0] / 255, c[1] / 255, c[2] / 255);
      }
      for (var z = 0; z < K; z++) for (var x = 0; x < K; x++) {
        var a = base + z * VW + x, b = a + 1, c2 = a + VW, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    globe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));   /* 无光照 → 球面亮度一致 */
    /* v90.67（方案B）：细节纹理**乘**到顶点色上（MeshBasicMaterial: color×vertexColor×map）——近看有颗粒。 */
    try {
      var dtex = makeDetailTex(); dtex.repeat.set(7, 7);
      globe.material.map = dtex; globe.material.needsUpdate = true;
    } catch (e) { /* 纹理生成失败 → 退回纯顶点色 */ }
    M._globeMat = globe.material;
    scene.add(globe);
    var wg = new THREE.SphereGeometry(R + 0.4, 96, 64);
    /* v90.58（老板「星球不透明，背面的城市不要看到」）：海面球**不透明**（原 transparent 0.9 会透出背面）。 */
    water = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0x4a7fa0 }));
    scene.add(water);
  }

  /* ---- 构建六边球地块（拓扑/地形/几何一律取自 sphere.js）----
     每条边由相邻两格**共享**（Goldberg 对偶）→ 真正**边嵌合**；透明六边线框，衬在彩色地形上。
     几何数据（upos 线框段 / fpos 拾取面 / faceCell 面→格）由 GAME.sphere 产出后转 THREE 缓冲。 */
  function buildTiles(sub) {
    if (tiles) { scene.remove(tiles); if (tiles.geometry) tiles.geometry.dispose(); }
    if (M._collider) { scene.remove(M._collider); if (M._collider.geometry) M._collider.geometry.dispose(); }
    if (M._fill) { scene.remove(M._fill); if (M._fill.geometry) M._fill.geometry.dispose(); }
    SP.build(sub);                                   /* 球面内核构建（幂等）*/
    var cells = SP.cells, upos = SP.upos, fpos = SP.fpos;
    /* 地块 = **纯线框**（老板：不要地块上色）· 只声明地块边界 */
    var ugeo = new THREE.BufferGeometry();
    ugeo.setAttribute('position', new THREE.Float32BufferAttribute(upos, 3));
    var mat = new THREE.LineBasicMaterial({ color: 0x8fb4d6, transparent: true, opacity: 0.6, depthWrite: false });
    M._shellMat = mat;
    tiles = new THREE.LineSegments(ugeo, mat);
    scene.add(tiles);
    /* 拾取碰撞体（隐形填充几何 · 供 Raycaster · 不上色）*/
    var fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    M._collider = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    M._collider.cells = cells; M._collider.nv = SP.nv;
    M._collider.faceCell = SP.faceCell;
    scene.add(M._collider);
    _tileSub = sub; _tileCells = cells; M._vdirs = SP.V; M._cent = SP.cent; M._icoF = SP.F;
  }
  var _tileCells = [];

  /* ============================================================
   * 球面聚落层级：1 旧都（全球）→ 12 行省 → 36 市 → 240 区
   *   自然划分（球面 k-means）· 按面积分配（州下市数 ∝ 州面积、市下区数 ∝ 市面积）。
   * ============================================================ */
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sphereKmeans(dirs, k, iters) {
    k = Math.min(k, dirs.length); if (k <= 0) return [];
    var cent = [];
    for (var i = 0; i < k; i++) cent.push(dirs[Math.floor((i + 0.5) / k * dirs.length)]);
    for (var it = 0; it < (iters || 8); it++) {
      var sums = [], cnt = [];
      for (var j = 0; j < k; j++) { sums.push([0, 0, 0]); cnt.push(0); }
      for (var d = 0; d < dirs.length; d++) {
        var best = 0, bd = -2, D = dirs[d];
        for (var j2 = 0; j2 < k; j2++) { var dt = dot3(D, cent[j2]); if (dt > bd) { bd = dt; best = j2; } }
        sums[best][0] += D[0]; sums[best][1] += D[1]; sums[best][2] += D[2]; cnt[best]++;
      }
      for (var j3 = 0; j3 < k; j3++) { var s = sums[j3], L = Math.hypot(s[0], s[1], s[2]) || 1; cent[j3] = [s[0] / L, s[1] / L, s[2] / L]; }
    }
    return cent;
  }
  /* 域扭曲：用一个**平滑噪声**微调方向（相邻格扭曲相近 → 边界平滑蜿蜒，不逐格乱跳）*/
  function warpDir(dir, salt) {
    var F = 3.5, A = 0.45;
    return [dir[0] + (n3(dir[0] * F, dir[1] * F, dir[2] * F, salt) - 0.5) * A,
      dir[1] + (n3(dir[0] * F + 7.7, dir[1] * F + 3.1, dir[2] * F + 5.5, salt + 11) - 0.5) * A,
      dir[2] + (n3(dir[0] * F + 2.3, dir[1] * F + 9.9, dir[2] * F + 1.7, salt + 22) - 0.5) * A];
  }
  function nearestCentNoisy(dir, cent, salt) {
    var wd = warpDir(dir, salt), best = 0, bd = -9;
    for (var j = 0; j < cent.length; j++) { var dt = dot3(wd, cent[j]); if (dt > bd) { bd = dt; best = j; } }
    return best;
  }
  /* 层级聚落：**嵌套分区**（省→市在其省内分 → 区在其市内分），成员数组保证不重叠、边界连续。*/
  /* 废土风地名池（前缀×后缀，组合足够多 → 48市+139区 不撞名）*/
  var WAS_PRE = '灰烬 锈铁 焦土 残垣 断壁 死寂 荒漠 骸骨 血砂 断岭 哑雷 幽谷 裂隙 熔炉 钢渣 尘沙 寒霜 暗礁 枯枝 腐沼 孤崖 湮墟 碎穹 蚀岸 烬渡 砾城 塌方 荒冢 蚀骨 噬风 焦关 铁砧 血锈 哑钟 残炉 险滩 流沙'.split(' ');
  var WAS_SUF = '堡 垒 坞 镇 驿 哨 坑 场 关 陉 坡 陲 墟 垠 岬 望 台 仓 栈 洼 隘'.split(' ');
  function genSettlements() {
    if (M._settle && M._settleSeed === seed3()) return M._settle;
    var nv = (M._vdirs || []).length, idxs = [], dirs = [];
    for (var i = 0; i < nv; i++) if (M._vdirs[i] && sphElev(M._vdirs[i]) >= 0.05) { idxs.push(i); dirs.push(M._vdirs[i]); }   /* 只分陆地 */
    var empty = { old: [0, 1, 0], provCent: [], marketCent: [], districtCent: [],
      provOf: new Int16Array(0), marketOf: new Int16Array(0), districtOf: new Int16Array(0), table: { old: null, prov: [], market: [], district: [] } };
    if (!dirs.length) return empty;
    var seed = seed3();
    function rh(a, b) { var h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    var PROV_NAMES = (GAME.DATA.START_STATES || []).slice(0);
    var ni = 0, _nameUsed = {};
    function genName() {                                  /* 废土名 · 前后缀快速轮换（自然混合）· 唯一 */
      var ln = WAS_PRE.length * WAS_SUF.length;
      for (var tries = 0; tries < ln; tries++) {
        var n = WAS_PRE[(ni * 7) % WAS_PRE.length] + WAS_SUF[(ni * 13) % WAS_SUF.length];
        ni++;
        if (!_nameUsed[n]) { _nameUsed[n] = 1; return n; }
      }
      return '废邑' + (ni++);
    }
    /* 加权就近：权重越大 → 该区面积越大（面积 ∝ 权重）· 域扭曲 → 边界平滑 */
    function weightedNearest(dir, cent, wts, salt) {
      var wd = warpDir(dir, salt), best = 0, bs = 1e9;
      for (var j = 0; j < cent.length; j++) {
        var d = 1 - dot3(wd, cent[j]) + 0.02;
        var s = d / wts[j];
        if (s < bs) { bs = s; best = j; }
      }
      return best;
    }
    /* 先定 **市数(2~6)** 与 **每市区数(2~4)** → 得省总区数 → **按区数分配省/市面积** */
    var MC = []; for (var q0 = 0; q0 < 12; q0++) MC.push(2);
    var pool = 48 - 12 * 2;
    for (var jj = 0; pool > 0; jj++) { var ix = Math.floor(rh(100 + jj, seed) * 12); if (MC[ix] < 6) { MC[ix]++; pool--; } }
    var DC = [], PD = [];
    for (var pp = 0; pp < 12; pp++) { var arr = [], tot = 0; for (var qq = 0; qq < MC[pp]; qq++) { var dv = 2 + Math.floor(rh((pp * 97 + qq) * 13 + 5, seed) * 3); arr.push(dv); tot += dv; } DC.push(arr); PD.push(tot); }
    /* 顶点邻接（供连通性修复）*/
    var adj = new Array(nv);
    for (var ai = 0; ai < nv; ai++) adj[ai] = [];
    var fAdj = M._icoF || [];
    for (var af = 0; af < fAdj.length; af++) {
      var TF = fAdj[af];
      adj[TF[0]].push(TF[1], TF[2]); adj[TF[1]].push(TF[0], TF[2]); adj[TF[2]].push(TF[0], TF[1]);
    }
    /* 连通性修复：把每级的**孤岛碎片**并进相邻最大区（保证每省/市/区**相邻连续**）。
       parent = 上级归属数组（市/区修复时只在**同一父区**内合并，不破坏辖地嵌套）。*/
    function repairConn(mem, land, parent) {
      var groups = {};
      for (var li = 0; li < land.length; li++) { var g = mem[land[li]]; if (g < 0) continue; (groups[g] = groups[g] || []).push(land[li]); }
      for (var gk in groups) {
        var gid = +gk, members = groups[gk], seen = {}, comps = [];
        for (var mi = 0; mi < members.length; mi++) {
          var ci = members[mi]; if (seen[ci]) continue;
          var stack = [ci], comp = []; seen[ci] = 1;
          while (stack.length) { var c = stack.pop(); comp.push(c); var anb = adj[c]; for (var k = 0; k < anb.length; k++) { var nb = anb[k]; if (!seen[nb] && mem[nb] === gid && (!parent || parent[nb] === parent[c])) { seen[nb] = 1; stack.push(nb); } } }
          comps.push(comp);
        }
        if (comps.length <= 1) continue;
        comps.sort(function (a, b) { return b.length - a.length; });
        for (var kk = 1; kk < comps.length; kk++) {
          var isl = comps[kk], cnt = {}, bg = -1, bc = 0;
          for (var ii = 0; ii < isl.length; ii++) { var an2 = adj[isl[ii]]; for (var q = 0; q < an2.length; q++) { var n2 = an2[q]; if (mem[n2] !== gid && mem[n2] >= 0 && (!parent || parent[n2] === parent[isl[ii]])) { cnt[mem[n2]] = (cnt[mem[n2]] || 0) + 1; } } }
          for (var g2 in cnt) if (cnt[g2] > bc) { bc = cnt[g2]; bg = +g2; }
          for (var i3 = 0; i3 < isl.length; i3++) mem[isl[i3]] = bg;
        }
      }
    }
    /* 省 12（互相接壤、覆盖全陆）—— **省面积 ∝ 省总区数 PD** */
    var provCent = sphereKmeans(dirs, 12, 10);
    var provOf = new Int16Array(nv).fill(-1), provMembers = [];
    for (var js = 0; js < provCent.length; js++) provMembers.push([]);
    /* v90.58（老板「海面也应该有行政划分，归入行省管理范围」）：
       行省归属**覆盖全球**（陆 + 海）—— 海面按**最近省心**并入行省；省界因此延伸到海面。
       市/区仍只划在陆地（下方按 provMembers=陆地成员 分市）。 */
    for (var dj = 0; dj < nv; dj++) { var _vd = M._vdirs[dj]; if (!_vd) continue; provOf[dj] = weightedNearest(_vd, provCent, PD, 4100 + seed); }
    repairConn(provOf, idxs);                                  /* 省 connectivity（只修陆地；海面 Voronoi 本就连通） */
    for (var d2 = 0; d2 < idxs.length; d2++) if (provOf[idxs[d2]] >= 0) provMembers[provOf[idxs[d2]]].push(idxs[d2]);
    var marketCent = [], marketOf = new Int16Array(nv).fill(-1), districtCent = [], districtOf = new Int16Array(nv).fill(-1);
    var table = { old: null, prov: [], market: [], district: [] };
    var lc = [0, 0, 0], ln = 0;
    for (var i2 = 0; i2 < dirs.length; i2++) if (sphElev(dirs[i2]) > 0.4) { lc[0] += dirs[i2][0]; lc[1] += dirs[i2][1]; lc[2] += dirs[i2][2]; ln++; }
    if (ln) { var L = Math.hypot(lc[0], lc[1], lc[2]) || 1; lc = [lc[0] / L, lc[1] / L, lc[2] / L]; } else lc = dirs[0];
    table.old = null;   /* v90.59（老板「怎么有 2 个灰烬城」）：旧都是 **NPC 名城 灰烬城**（NPC_CITIES.cap），
                           行政层不再另造一个同名「灰烬城」中心（原 addAdm('old') 位置由质心算出、与 NPC 城错位 → 重名两款）。 */
    /* 各省分市（市数 = MC[p]）；**市面积 ∝ 该市区数 DC[p][q]** · 市在本省内（连通修复限同省）*/
    for (var p = 0; p < provCent.length; p++) {
      var pm = provMembers[p]; if (!pm.length) continue;
      var pNode = { name: PROV_NAMES[p] || ('行省' + (p + 1)), cent: provCent[p], markets: [] };
      var mn = Math.max(1, Math.min(MC[p], pm.length));
      var pmd = pm.map(function (ci) { return M._vdirs[ci]; });
      var mc = sphereKmeans(pmd, mn, 6), mdc = DC[p].slice(0, mn);
      var mBase = marketCent.length;
      for (var t = 0; t < pm.length; t++) { var ci2 = pm[t], a2 = weightedNearest(M._vdirs[ci2], mc, mdc, 7300 + seed); marketOf[ci2] = mBase + a2; }
      repairConn(marketOf, pm, provOf);                        /* 市 connectivity（限同省）*/
      var mm = [];
      for (var q2 = 0; q2 < mn; q2++) mm.push([]);
      for (var t2b = 0; t2b < pm.length; t2b++) { var ci2b = pm[t2b], a2b = marketOf[ci2b] - mBase; if (a2b >= 0 && a2b < mn) mm[a2b].push(ci2b); else { /* 越界兜底：并入最近 */ mm[Math.max(0, Math.min(mn - 1, a2b))].push(ci2b); marketOf[ci2b] = mBase + Math.max(0, Math.min(mn - 1, a2b)); } }
      for (var q3 = 0; q3 < mn; q3++) {
        var mIdx = marketCent.length; marketCent.push(mc[q3]);
        var mmb = mm[q3] || [], mNode = { name: genName(), cent: mc[q3], prov: p, districts: [] };
        var dn = Math.max(1, Math.min(mdc[q3], mmb.length || 1));
        if (mmb.length) {
          var mmd = mmb.map(function (ci) { return M._vdirs[ci]; });
          var dc = sphereKmeans(mmd, dn, 5), dBase = districtCent.length;
          for (var t3 = 0; t3 < mmb.length; t3++) districtOf[mmb[t3]] = dBase + nearestCentNoisy(M._vdirs[mmb[t3]], dc, 9500 + seed);
          repairConn(districtOf, mmb, marketOf);               /* 区 connectivity（限同市）*/
          for (var q4 = 0; q4 < dc.length; q4++) { districtCent.push(dc[q4]); mNode.districts.push(districtCent.length - 1); table.district.push({ name: genName(), cent: dc[q4], market: mIdx }); }
        }
        pNode.markets.push(table.market.length); table.market.push(mNode);
      }
      table.prov.push(pNode);
    }
    M.adminTable = table;
    /* 行政中心**城对象**（旧都/省府/市府/区）—— 占据地块、可点弹出征界面 */
    var admCities = [], EGT = { old: 22, prov: 18, market: 14, district: 9 };
    function tierOf(lv) { return lv === 'old' ? 'capital' : lv === 'prov' ? 'zhou' : lv === 'market' ? 'jun' : 'county'; }
    function addAdm(lv, name, cent, idx) {
      var ci = nearestCell(cent); if (ci < 0) return;
      var cell = _tileCells[ci]; if (!cell) return;
      var tier = tierOf(lv), lvl = EGT[lv];
      var c = { id: 'adm_' + lv + '_' + idx, name: name, x: cell.x, y: cell.y,
        type: tier, owner: 'npc', level: lvl, admLevel: lv, admIndex: idx, _cent: cent };
      c.garrison = GAME.genGarrison ? GAME.genGarrison(c) : {};   /* 旧设定：按城档守军 */
      c.maxArmy = c.garrison;
      admCities.push(c);
    }
    /* v90.59（老板「怎么有 2 个灰烬城」）：旧都 = **NPC 名城 灰烬城**（NPC_CITIES.cap）——
       行政层不再另造同名「灰烬城」中心（原 addAdm('old') 按质心算出、与 NPC 城错位 → 重名两款）。 */
    var pa;
    for (pa = 0; pa < provCent.length; pa++) {
      var pv2 = table.prov[pa]; if (!pv2) continue;
      addAdm('prov', pv2.name + '府', pv2.cent, pa);
      pv2.markets.forEach(function (mi) { var m = table.market[mi]; addAdm('market', m.name, m.cent, mi); });
      pv2.markets.forEach(function (mi) { table.market[mi].districts.forEach(function (di) { var d = table.district[di]; addAdm('district', d.name, d.cent, di); }); });
    }
    M.admCities = admCities;
    M._settle = { old: lc, oldName: '灰烬城', provCent: provCent, marketCent: marketCent, districtCent: districtCent,
      provOf: provOf, marketOf: marketOf, districtOf: districtOf, table: table, admCities: admCities };
    M._settleSeed = seed;
    return M._settle;
  }

  /* ---- 区域 **边界线**：只画"两侧地块属于不同区"的共享六边形边（对偶边 = 干净连续单线）
     parent/target 给定 → 只画**该父区内**的子级边界（选省时只画本省内的市界）。---- */
  function regionLineSegs(mem, parent, target) {
    var F = M._icoF, cent = M._cent;
    if (!F || !cent) return [];
    function cp(f) { var d = cent[f], r = R + Math.max(0, sphElev(d)) * HSC + 2.2; return [d[0] * r, d[1] * r, d[2] * r]; }
    var emap = {}, seg = [];
    for (var f = 0; f < F.length; f++) {
      var T = F[f];
      for (var e = 0; e < 3; e++) {
        var i = T[e], j = T[(e + 1) % 3], key = i < j ? i + '_' + j : j + '_' + i;
        if (emap[key] === undefined) { emap[key] = f; continue; }
        if (mem[i] < 0 || mem[j] < 0) continue;           /* 海/无分区 → 不画 */
        if (mem[i] === mem[j]) continue;                 /* 同区 → 非边界 */
        if (parent && (parent[i] !== target || parent[j] !== target)) continue;   /* 限父区内部 */
        var a = cp(emap[key]), b = cp(f);                /* 共享边两侧两面的对偶点 = 六边形边 */
        seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    return seg;
  }
  function buildRegions() {
    if (M._regions) { scene.remove(M._regions); M._regions = null; }
    if (!M._vdirs || !M._icoF) return;
    var lv = M.regionLevel == null ? 3 : M.regionLevel;   /* 分级显示：1=仅省界 2=+市 3=+区（逐步生成）*/
    var S = genSettlements();
    var grp = new THREE.Group();
    function addLines(mem, col, op) {
      var seg = regionLineSegs(mem); if (!seg.length) return;
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })));
    }
    addLines(S.provOf, 0x2a6fff, 1.0);                        /* 行省界 = 强蓝 */
    if (lv >= 2) addLines(S.marketOf, 0xff40c0, 0.9);        /* 市界 = 品红 */
    if (lv >= 3) addLines(S.districtOf, 0x156a26, 0.6);      /* 区界 = 深绿 */
    M._regions = grp; scene.add(grp);
  }

  /* 据点(黄) / 城市(红) / 己方城(蓝) —— 各自地块的抬升点位（中心小六边）。*/
  /* 聚落层级柱子尺寸：旧都最大 → 省府 → 市 → 区 逐渐缩小 */
  function buildMarkers() {
    if (M._markers) { scene.remove(M._markers); M._markers = null; }
    if (M._labels) { scene.remove(M._labels); M._labels = null; }
    if (!_tileCells || !_tileCells.length || !M._vdirs) return;
    var S = genSettlements(); if (!S) return;
    var mark = {};                                          /* cellIndex → [r,g,b]（平涂地块）*/
    /* 地块**属性索引**：每格 = 野地 / 城市 / 据点（明确区分）*/
    var cellKind = {}, cellRef = {};
    for (var vi0 = 0; vi0 < M._vdirs.length; vi0++) if (M._vdirs[vi0] && S.provOf[vi0] >= 0) { cellKind[vi0] = 'wild'; }   /* 默认：陆地块 = 野地 */
    /* 据点 = 黄 */
    for (var fi = 0; fi < _tileCells.length; fi++) { var fc = _tileCells[fi]; if (fc && GAME.map.fortAt(fc.x, fc.y)) { mark[fi] = [226, 202, 64]; cellKind[fi] = 'fort'; } }
    /* v90.70：实体 → 六边格索引。带 .ci 直用（球系唯一身份）；否则按 (x,y) 现算（旧档/未标注）。 */
    function ciOfRef(ref) {
      if (!ref) return -1;
      if (ref.ci != null && ref.ci >= 0 && SP.cells && SP.cells[ref.ci]) return ref.ci;
      if (ref.x == null || ref.y == null) return -1;
      return nearestCell(dirOfCell(ref.x, ref.y));
    }
    /* NPC 名城 = 红 */
    (GAME.DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.lon == null || c.lat == null) { var d = dirOfCell(c.x, c.y); c.lon = (Math.atan2(d[2], d[0]) * 180 / Math.PI + 360) % 360; c.lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI; }
      var ci = ciOfRef(c); if (ci >= 0) { mark[ci] = [220, 70, 60]; cellKind[ci] = 'npc'; cellRef[ci] = c; }
    });
    /* 行政中心城 = 紫色（按球面质心方向取格）*/
    (M.admCities || []).forEach(function (c) { var ci = nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c; } });
    /* 己方城 = 蓝：落在其**球面六边格索引 ci**（球系唯一身份，免 (x,y) 往返） */
    M._ownCells = {};
    (GAME.state.cities || []).forEach(function (c) {
      var ci = ciOfRef(c);
      var dir = (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(c.x, c.y);
      c.lon = (Math.atan2(dir[2], dir[0]) * 180 / Math.PI + 360) % 360;
      c.lat = Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
      if (ci < 0) return;
      mark[ci] = [80, 150, 230]; cellKind[ci] = 'own'; cellRef[ci] = c; M._ownCells[ci] = c;
    });
    M.cellKind = cellKind; M.cellRef = cellRef;
    /* 平涂：每格六边形填色（贴地形 · 微抬）*/
    var pos = [], col = [], idx = [], base = 0;
    for (var ci2 in mark) {
      var c = _tileCells[ci2]; if (!c || !c.rim) continue;
      var rim = c.rim, mm = rim.length, P = c.pos, up = null, cL = Math.hypot(P[0], P[1], P[2]) || 1; up = [P[0] / cL, P[1] / cL, P[2] / cL];
      var rgb2 = mark[ci2], lift = 0.4;
      pos.push(P[0] + up[0] * lift, P[1] + up[1] * lift, P[2] + up[2] * lift); col.push(rgb2[0] / 255, rgb2[1] / 255, rgb2[2] / 255);
      var start = base, apex = base;
      for (var j = 0; j < mm; j++) { var p = rim[j], L = Math.hypot(p[0], p[1], p[2]) || 1; pos.push(p[0] + p[0] / L * lift, p[1] + p[1] / L * lift, p[2] + p[2] / L * lift); col.push(rgb2[0] / 255, rgb2[1] / 255, rgb2[2] / 255); }
      for (var t = 0; t < mm; t++) idx.push(apex, apex + 1 + t, apex + 1 + (t + 1) % mm);
      base = apex + 1 + mm;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      M._markers = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      scene.add(M._markers);
    }
    /* 名城：**指示线 + 悬浮名称**（在球外悬浮）*/
    var grp = new THREE.Group();
    var lp = [];
    function floatName(dir, text, colHex) {
      var r = R + Math.max(0, sphElev(dir)) * HSC;
      var g0 = [dir[0] * r, dir[1] * r, dir[2] * r];                 /* 地面点 */
      var g1 = [dir[0] * (r + 46), dir[1] * (r + 46), dir[2] * (r + 46)];   /* 悬浮点 */
      lp.push(g0[0], g0[1], g0[2], g1[0], g1[1], g1[2]);
      var spr = nameSprite(text, colHex || '#ffffff');
      spr.position.set(g1[0], g1[1], g1[2]);
      grp.add(spr);
    }
    /* v90.70：名称引线也走 ci（= 标记所在格），免 (x,y) 往返；无 ci 的旧档回退 dirOfCell。 */
    function dirOfRef(ref) {
      var ci = ciOfRef(ref);
      return (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(ref.x, ref.y);
    }
    (GAME.DATA.NPC_CITIES || []).forEach(function (c) { if (c.type === 'capital' || c.type === 'zhou') floatName(dirOfRef(c), c.name || '', '#ffd76a'); });
    var ol = M.admCities || [];
    ol.forEach(function (c) { if (c.admLevel === 'old' || c.admLevel === 'prov') floatName(c._cent, c.name, c.admLevel === 'old' ? '#ffd76a' : '#cfe6ff'); });
    /* v90.57（老板）：**己方城池**也引出名称（像名城一样）—— 亮蓝＝己方色。 */
    (GAME.state.cities || []).forEach(function (c) { floatName(dirOfCell(c.x, c.y), c.name || '城', '#8fd4ff'); });
    if (lp.length) { var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.92, depthWrite: false }))); }
    M._labels = grp; scene.add(grp);
  }
  /* 平面格 (x,y) → 球面方向（走 GAME.map 的**球系坐标单一出口**）*/
  function dirOfCell(x, y) {
    var c = GAME.map.lonlatOf(x, y);
    return GAME.map.dirOf(c.lon, c.lat);
  }

  /* 名称标签（画布文字 → 贴图 → Sprite）。
     v90.57（老板）：canvas **按文字裁宽**（长名不挤）；屏幕尺寸由 `scaleLabels()` 每帧按相机距离归一
     → **不随星球缩放变大小**（恒定可读）。
     v90.58（老板）：字号**减半**、**去粗体**；`depthTest:true` 让**星球遮挡背面**的名称（背面城市不再透出来）。 */
  function nameSprite(text, color) {
    /* v90.71（老板）：名称清晰化 —— 画布**超采样 3×**（纹理分辨率 ≫ 屏幕尺寸 → 缩小后锐利）；
       字体换**清晰 CJK 字族**（雅黑/苹方/系统 UI）；仍不加粗（老板："可以不加粗看看"）。 */
    var SS = 3, fs = 15 * SS, pad = 10 * SS, h = 26 * SS;
    var FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Segoe UI",sans-serif';
    var c = document.createElement('canvas');
    var probe = c.getContext('2d');
    probe.font = fs + 'px ' + FONT;
    var tw = Math.max(40 * SS, Math.ceil(probe.measureText(text).width) + pad * 2);
    c.width = tw; c.height = h;
    var g = c.getContext('2d');
    g.font = fs + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3 * SS; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(10,14,20,.92)'; g.strokeText(text, tw / 2, h / 2);
    g.fillStyle = color || '#ffffff'; g.fillText(text, tw / 2, h / 2);
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: true }));
    spr.userData = { asp: tw / h };   /* 宽高比 —— scaleLabels 按屏高定尺寸时用 */
    return spr;
  }
  /* v90.57（老板）：把名称 Sprite 的**屏幕尺寸钉死**（不随星球缩放变大小）——
     世界尺寸 ∝ 相机到标签的距离（透视下 = 恒定屏幕占比）。每帧调用。 */
  function scaleLabels() {
    if (!cam) return;
    var frac = 0.028;                                   /* 标签高 ≈ 屏幕高的 2.8%（v90.58 老板：再小一半） */
    var k = 2 * Math.tan(cam.fov * Math.PI / 360) * frac;
    [M._labels, M._hl].forEach(function (grp) {
      if (!grp || !grp.children) return;
      grp.children.forEach(function (ch) {
        if (!ch.isSprite) return;
        var d = cam.position.distanceTo(ch.position);
        var hW = k * d;
        ch.scale.set(hW * ((ch.userData && ch.userData.asp) || 5.3), hW, 1);
      });
    });
  }
  /* 某层级中心的球面世界点（贴地形 + 抬升）*/
  function centerWorld(centDir, H) {
    var r = R + Math.max(0, sphElev(centDir)) * HSC + (H || 7);
    return [centDir[0] * r, centDir[1] * r, centDir[2] * r];
  }
  /* ---- 检索高亮：选定 省/市/区 → 该区地块增亮、其余地形调暗；
     并显示**下一级**内部边界 + 首府点 + 名称。---- */
  function buildHighlight() {
    if (M._hl) { scene.remove(M._hl); M._hl = null; }
    /* v90.71：地形高亮在时，星球调暗由它掌管（勿被省市区高亮复位）。 */
    if (M._globeMat && !M._terrainHl) M._globeMat.color.setHex(0xffffff);
    var S = genSettlements(); if (!S) return;
    var sel = M._region; if (!sel) return;
    if (M._globeMat && !M._terrainHl) M._globeMat.color.setHex(0x5a5a5a);       /* 其余地形调暗 */
    var T = S.table, V = M._vdirs, F = M._icoF; if (!V || !F) return;
    var grp = new THREE.Group();
    /* ① 亮层（选中区顶盖）*/
    var mem = sel.level === 'prov' ? S.provOf : sel.level === 'market' ? S.marketOf : S.districtOf;
    var tgt = sel.index;
    var pos = [], idx = [], base = 0, H = 5, cent = M._cent;
    var vor = {};
    for (var f = 0; f < F.length; f++) for (var k = 0; k < 3; k++) { var vv = F[f][k]; (vor[vv] = vor[vv] || []).push(f); }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dt(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    for (var vs in vor) {
      var vi = +vs; if (mem[vi] !== tgt) continue;
      var n = V[vi], fs = vor[vi]; if (fs.length < 3) continue;
      var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var tx2 = cross(up, n), tl = Math.hypot(tx2[0], tx2[1], tx2[2]) || 1; tx2 = [tx2[0] / tl, tx2[1] / tl, tx2[2] / tl];
      var ty = cross(n, tx2);
      fs.sort(function (A, B) { var cA = cent[A], cB = cent[B]; return Math.atan2(dt(cA, ty), dt(cA, tx2)) - Math.atan2(dt(cB, ty), dt(cB, tx2)); });
      var rn = R + Math.max(0, sphElev(n)) * HSC, P = [n[0] * rn, n[1] * rn, n[2] * rn];
      var mm = fs.length, start = base;
      for (var j = 0; j < mm; j++) { var p = cent[fs[j]], rr = R + Math.max(0, sphElev(p)) * HSC; pos.push(p[0] * rr, p[1] * rr, p[2] * rr); }
      for (var j2 = 0; j2 < mm; j2++) pos.push(pos[(start + j2) * 3] + n[0] * H, pos[(start + j2) * 3 + 1] + n[1] * H, pos[(start + j2) * 3 + 2] + n[2] * H);
      for (var t = 1; t < mm - 1; t++) idx.push(base + mm, base + mm + t, base + mm + t + 1);
      base += mm * 2;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe070, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })));
    }
    /* ② 下一级：边界线 + 首府点 + 名称 */
    function addChildLines(segArr, col, op) {
      if (!segArr.length) return;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segArr, 3));
      grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })));
    }
    function addCapitalPoint(centDir, col, sz) {
      var P = centerWorld(centDir, 5), g = new THREE.SphereGeometry(sz, 8, 8);
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(P[0], P[1], P[2]); grp.add(m);
    }
    function addText(centDir, text) {
      var P = centerWorld(centDir, 12), spr = nameSprite(text); spr.position.set(P[0], P[1], P[2]); grp.add(spr);
    }
    if (sel.level === 'prov') {
      addChildLines(regionLineSegs(S.marketOf, S.provOf, tgt), 0xff40c0, 0.9);   /* 本省内的市界 */
      var pv = T.prov[tgt];
      pv.markets.forEach(function (mi) { var m = T.market[mi]; addCapitalPoint(m.cent, 0xff40c0, 2.2); addText(m.cent, m.name); });
    } else if (sel.level === 'market') {
      addChildLines(regionLineSegs(S.districtOf, S.marketOf, tgt), 0x156a26, 0.9);   /* 本市内的区界 */
      var mk = T.market[tgt];
      mk.districts.forEach(function (di) { var dd = T.district[di]; addCapitalPoint(dd.cent, 0x156a26, 1.8); addText(dd.cent, dd.name); });
    }
    M._hl = grp; scene.add(grp);
  }
  M.setHighlight = function (sel) {                          /* sel: null 或 {level,index} */
    M._region = sel || null;
    if (sel) M.clearBeam();   /* v90.71：选省/市/区 = 其他操作 → 定位线消失 */
    buildHighlight();
    /* 相机**自动转到该区域正面**（该区中心朝向相机）*/
    if (sel) {
      var S = genSettlements(), T = S && S.table, c = null;
      if (T) c = sel.level === 'prov' ? T.prov[sel.index] && T.prov[sel.index].cent
        : sel.level === 'market' ? T.market[sel.index] && T.market[sel.index].cent
          : T.district[sel.index] && T.district[sel.index].cent;
      if (c) {
        var latA = Math.asin(Math.max(-1, Math.min(1, c[1])));
        camO.yaw = Math.atan2(c[0], c[2]);                 /* 水平角 → 首府朝向相机 */
        camO.pitch = Math.max(-1.35, Math.min(1.35, latA));/* 俯角 = 首府纬度 → 首府居中 */
        camO.dist = sel.level === 'district' ? R * 1.8 : sel.level === 'market' ? R * 2.03 : R * 2.3;
      }
    }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };

  /* v90.66（老板 0a）：**地形高亮**。
     v90.71（老板 6）：改为**选中地形提亮 · 其余区域整体调暗**（类似省/市/区选择效果）——
     把整颗星球材质调暗，再把该地形的地块**亮色满铺**叠上去 → 选中地形是亮块、其余沉下去。 */
  var _TERRAIN_HL_COLOR = {
    lake: 0x4aa6e0, zhaoze: 0x6f8f4a, plain: 0xd8cfa0, caoyuan: 0x9db24a,
    forest: 0x3f8a52, desert: 0xd9b45c, hill: 0x9a8f82,
  };
  function resetGlobeDim() {
    if (!M._globeMat) return;
    M._globeMat.color.setHex(M._region ? 0x5a5a5a : 0xffffff);
  }
  M.setTerrainHighlight = function (type) {                  /* type: 地形 key 或 null/'' = 清除 */
    M._terrainHl = type || null;
    if (M._terrainHl) M.clearBeam();   /* v90.71：选地形 = 其他操作 → 定位线消失 */
    if (M._thl) { scene.remove(M._thl); if (M._thl.geometry) M._thl.geometry.dispose(); M._thl = null; }
    if (!M._terrainHl || !_tileCells || !_tileCells.length) {
      resetGlobeDim();                  /* 清除：星球恢复原亮度（省市区高亮若在则保留其调暗）*/
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    if (M._globeMat) M._globeMat.color.setHex(0x454545);   /* 其余区域整体调暗 */
    var col = _TERRAIN_HL_COLOR[M._terrainHl] || 0xffffff;
    var pos = [], idx = [], base = 0;
    for (var i = 0; i < _tileCells.length; i++) {
      var c = _tileCells[i];
      if (!c || c.type !== M._terrainHl || !c.rim) continue;
      var rim = c.rim, mm = rim.length, P = c.pos, L = Math.hypot(P[0], P[1], P[2]) || 1;
      var lift = 0.9;                                        /* 微抬，浮在底面之上不 z-fight */
      pos.push(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      var apex = base;
      for (var j = 0; j < mm; j++) { var p = rim[j], l2 = Math.hypot(p[0], p[1], p[2]) || 1; pos.push(p[0] + p[0] / l2 * lift, p[1] + p[1] / l2 * lift, p[2] + p[2] / l2 * lift); }
      for (var t = 0; t < mm; t++) idx.push(apex, apex + 1 + t, apex + 1 + (t + 1) % mm);
      base = apex + 1 + mm;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      /* 选中地形满铺亮块（0.92 不透）+ 细描边 → 「亮块 vs 暗底」对比强烈。 */
      M._thl = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
      scene.add(M._thl);
    }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };

  function placeCamera() {
    var cp = Math.cos(camO.pitch), sp = Math.sin(camO.pitch);
    cam.position.set(camO.dist * cp * Math.sin(camO.yaw), camO.dist * sp, camO.dist * cp * Math.cos(camO.yaw));
    cam.lookAt(0, 0, 0);
  }

  M.render = function (target2d) {
    try { ensure(); } catch (e) { M.enabled = false; return false; }
    var cw = target2d.width, ch = target2d.height;
    if (wcv.width !== cw || wcv.height !== ch) { wcv.width = cw; wcv.height = ch; R3.setSize(cw, ch, false); cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    /* v90.78（老板「换星球后地图没变」）：**星球身份**变（种子/规格/细分）→ 强制重建几何。
       v90.81：规格含全部要素（大陆数/山脉成因/海深/恒星色温…）→ 序列化比对。 */
    var _pver = (SP.seed3 ? SP.seed3() : 0) + '|' + (SP.sub || 0) + '|' + (SP.PLANET ? JSON.stringify(SP.PLANET) : '');
    if (_pver !== M._pver) {
      M._pver = _pver; built = false; M._mkVer = null; M.region = null; M.clearBeam();
      if (M._sun && SP.PLANET && SP.PLANET.starColor != null) M._sun.color.setHex(SP.PLANET.starColor);   /* 恒星色温 → 光色 */
    }
    if (!built) { buildGlobe(); buildTiles(TILE_SUB); buildRegions(); buildMarkers(); built = true; }
    /* v90.81（老板 4 · L0 自转）：地图页**静止 10 秒无操作** → 星球自动旋转（周期 = PLANET.spinSec）。
       仅在地图页 + 已进入游戏时；任何交互（拖/滚/点）即时归零计时。 */
    var _now = Date.now();
    if (M._lastAct == null) M._lastAct = _now;
    if (GAME.ui && GAME.ui.view === 'map' && GAME.state) {
      if (_now - M._lastAct > 10000) {
        var _spin = (SP.PLANET && SP.PLANET.spinSec) || 10;
        camO.yaw += (2 * Math.PI / _spin) * 0.016;           /* ~60fps 步进（周期=spinSec 秒一圈）*/
      }
    }
    placeCamera();
    /* 地块数**固定**（老板）：不再随缩放切换级别 —— 恒定 TILE_SUB（= 40962 块）。*/
    /* 城市/据点增减/迁移（占领/迁址/放弃）→ 重建标记。v90.62（老板「移动后新城2 无色块/名称」）：
       旧判据只数**城池条数** —— 迁址时条数不变 → 标记不重建 → 旧色块/名称留在原地。
       改：把各城的 **id + 坐标** 拼进版本号，任一城移动即触发重建（色块与连线随城走）。 */
    var _mkVer = (GAME.state.cities || []).map(function (c) { return c.id + ':' + c.x + ',' + c.y; }).join('|') + '#' + _tileSub;
    if (_mkVer !== M._mkVer) { M._mkVer = _mkVer; buildMarkers(); }
    /* 线框随相机拉近**渐隐**：远看网格，近看透明消失（好观察地形）*/
    if (M._shellMat) {
      var near = R * 1.45, far = R * 2.7;
      var o = Math.max(0, Math.min(0.6, 0.6 * (camO.dist - near) / (far - near)));
      M._shellMat.opacity = o;
      if (tiles) tiles.visible = o > 0.02;
    }
    scaleLabels();   /* v90.57：名称标签**钉死屏幕尺寸**（不随缩放变大小），每帧归一 */
    /* v90.71（老板 7）：定位光束远端发光点**红光脉动闪烁**（每帧按世界时间调制大小/透明度）。*/
    if (M._beamPos) {
      var ph = (Date.now() % 900) / 900;                       /* 0~1 周期 0.9s */
      var k = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);          /* 0~1 脉动 */
      var base = Math.max(5, camO.dist * 0.02);
      M._beamPos.scale.set(base * (0.6 + 0.7 * k), base * (0.6 + 0.7 * k), 1);
      if (M._beamPos.material) M._beamPos.material.opacity = 0.4 + 0.6 * k;
    }
    R3.render(scene, cam);
    var ctx = target2d.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(wcv, 0, 0, cw, ch);
    /* 点击选中 → 画信息条（地块类型 + 等级）*/
    if (M._cell) {
      var _kname = { wild: '野地', fort: '据点', npc: '名城', adm: '行政城', own: '己方城' }[M._cellKind] || '野地';
      var txt = '【' + _kname + '】' + M._cell.name + ' · 等级 ' + M._cell.level
        + ' · 球系坐标 ' + (GAME.map.coordText ? GAME.map.coordText(M._cell.x, M._cell.y) : (Math.round(M._cell.lon) + '°E ' + Math.round(M._cell.lat) + '°'));
      /* v90.66（老板）：字号缩到与底部导航栏一致（原 bold 20px 偏大）。 */
      ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(14, 12, tw + 22, 28);
      ctx.strokeStyle = 'rgba(200,230,255,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 12, tw + 22, 28);
      ctx.fillStyle = '#eaf4ff'; ctx.fillText(txt, 25, 20);
    }
    /* v90.81：自转时自调度重绘（链式 rAF）—— 非自转态取消。 */
    var _spinning = (GAME.ui && GAME.ui.view === 'map' && GAME.state && (Date.now() - M._lastAct > 10000));
    if (_spinning) {
      if (!M._spinRAF && window.requestAnimationFrame) M._spinRAF = window.requestAnimationFrame(function () {
        M._spinRAF = null; if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      });
    } else if (M._spinRAF) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(M._spinRAF);
      M._spinRAF = null;
    }
    return true;
  };

  M.bindControls = function (canvas) {
    if (!canvas || canvas._m3dBound) return;
    canvas._m3dBound = true;
    var drag = 0, lx = 0, ly = 0, moved = false;
    function redraw() { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); }
    function touch() { M._lastAct = Date.now(); }            /* v90.81：无操作计时（自转）*/
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('mousedown', function (e) { drag = 1; moved = false; lx = e.clientX; ly = e.clientY; touch(); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      camO.yaw -= dx * 0.006;
      camO.pitch = Math.max(-1.4, Math.min(1.4, camO.pitch + dy * 0.006));
      touch(); redraw();
    });
    window.addEventListener('mouseup', function (e) {
      var wasDrag = drag; drag = 0;
      if (wasDrag && !moved) M.pickAt(canvas, e.clientX, e.clientY);   /* 没拖动 = 点击 → 选地块 */
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      camO.dist = Math.max(R * 1.2, Math.min(R * 8, camO.dist * (e.deltaY < 0 ? 0.9 : 1.11)));
      touch(); redraw();
    }, { passive: false });
  };

  /* 地块 → 行政归属（省/市/区）；vi = 地块顶点索引 */
  M.regionAt = function (vi) {
    var S = M._settle; if (!S || !S.table || vi == null) return null;
    var T = S.table, pi = S.provOf[vi], mi = S.marketOf[vi], di = S.districtOf[vi];
    if (pi < 0) return null;
    return {
      prov: T.prov[pi] ? T.prov[pi].name : '', market: (mi >= 0 && T.market[mi]) ? T.market[mi].name : '',
      district: (di >= 0 && T.district[di]) ? T.district[di].name : '', provIndex: pi, marketIndex: mi, districtIndex: di
    };
  };
  /* 行政中心城（旧都/省府/市府/区）by 格坐标 */
  M.admCityAt = function (x, y) {
    var list = M.admCities; if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return list[i];
    return null;
  };
  /* 点击拾取：Raycaster 打到地块填充 → 取格类型/等级 → 存为选中（画在画布上）*/
  M.pickAt = function (canvas, clientX, clientY) {
    M.clearBeam();   /* v90.71（老板 7）：点选其他地块 = 其他操作 → 定位指示线消失 */
    if (!M._collider) return;
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
    var hit = rc.intersectObject(M._collider, false);
    if (!hit.length) { M._cell = null; if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    var face = hit[0].face, ci = M._collider.faceCell[face.a / 3 | 0];
    var cell = M._collider.cells[ci];
    if (!cell) return;
    M._cell = cell;
    var kind = (M.cellKind && M.cellKind[ci]) || 'wild';   /* 地块属性：野地/城市/据点/行政城/己方城 */
    M._cellKind = kind;
    var reg = M.regionAt(ci);                                  /* 该地块的省/市/区归属 */
    /* 链接到游戏弹窗（照抄 main.js:2534 的 2D 分发）*/
    var x = cell.x, y = cell.y, ui = GAME.ui;
    if (ui) {
      var ref = M.cellRef && M.cellRef[ci];
      GAME.map._coordOverride = { lon: cell.lon, lat: cell.lat };   /* 球系坐标 → 弹窗 */
      if (kind === 'own' && ref && ui.openCityPanel) ui.openCityPanel(ref);
      else if (kind === 'npc' && ref && ui.openAttackModal) ui.openAttackModal(ref);
      else if (kind === 'adm' && ref && ui.openAttackModal) ui.openAttackModal(ref);
      else if (kind === 'fort' && GAME.map.fortAt) { var ff = GAME.map.fortAt(x, y); if (ff && ui.openFortModal) ui.openFortModal(ff); else if (ui.openLandModal) { GAME.map._terrOverride = cell.type; GAME.map._wildLvOverride = cell.level; GAME.map._regionOverride = reg; ui.openLandModal(x, y); } }
      else if (ui.openLandModal) {
        /* 野地：球面地块地形/等级 + 行政区归属 + 球系坐标 */
        GAME.map._terrOverride = cell.type; GAME.map._wildLvOverride = cell.level;
        GAME.map._regionOverride = reg;
        ui.openLandModal(x, y);
      }
    }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };

  M.centerOn = function (x, y) {                            /* 相机对准某格（回主城/回本城/灰烬城）· 不高亮 */
    var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
    camO.yaw = Math.atan2(d[0], d[2]);
    camO.pitch = Math.max(-1.35, Math.min(1.35, c.lat * Math.PI / 180));
    camO.dist = R * 1.9;
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };
  /* v90.68（老板）：**定位光束** —— 从某格**向外射出一道**提示玩家 + 相机对准该格。
     v90.71（老板 7）：远端加**红光持续闪烁**的发光点（醒目好找）；做其他操作后指示线消失。
     换目标先清旧束；传 null 清除。 */
  function glowSprite() {
    var N = 128, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    gr.addColorStop(0, 'rgba(255,120,100,1)'); gr.addColorStop(0.32, 'rgba(255,52,40,.85)');
    gr.addColorStop(0.66, 'rgba(210,30,20,.32)'); gr.addColorStop(1, 'rgba(190,16,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    var tx = new THREE.CanvasTexture(cv); tx.needsUpdate = true;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    spr.userData.glow = true;
    return spr;
  }
  M.clearBeam = function () {
    if (M._beam) { scene.remove(M._beam); if (M._beam.geometry) M._beam.geometry.dispose(); M._beam = null; }
    if (M._beamPos) { scene.remove(M._beamPos); if (M._beamPos.material) M._beamPos.material.dispose(); M._beamPos = null; }
  };
  M.beamTo = function (x, y) {
    M.clearBeam();
    if (x == null || y == null) { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    try {
      var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
      var r = R + Math.max(0, sphElev(d)) * HSC;
      var g0 = [d[0] * r, d[1] * r, d[2] * r];
      var g1 = [d[0] * (r + 160), d[1] * (r + 160), d[2] * (r + 160)];   /* 向外射出一道 */
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([g0[0], g0[1], g0[2], g1[0], g1[1], g1[2]], 3));
      M._beam = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5236, transparent: true, opacity: 0.97, depthWrite: false }));
      scene.add(M._beam);
      M._beamPos = glowSprite();                     /* 远端发光点（红光闪烁，见 render 每帧脉动）*/
      M._beamPos.position.set(g1[0], g1[1], g1[2]);
      scene.add(M._beamPos);
    } catch (e) { /* 忽略 */ }
    M.centerOn(x, y);
  };
  M.rebuild = function () { built = false; _tileSub = -1; };
})();
