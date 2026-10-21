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
import './core.js';
import './data.js';
import './state.js';
import './gltf.js';
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  if (typeof THREE === 'undefined') { GAME.map3d = { enabled: false, why: 'no-three' }; return; }
  var SP = GAME.mapSphere;                         /* v90.97（双球面）：地图渲染走**地图球面**（与逻辑球面 GAME.sphere 解耦）*/
  var M = GAME.map3d = { enabled: true };

  var R = (SP && SP.R) || 300;                    /* 星球海平面半径 */
  var HSC = (SP && SP.HSC) || 26;                 /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  var K = 200;                   /* cube-sphere 每面细分（更细 → 放大看得到地形细节）*/
  /* 地块细分（固定）：icosphere 顶点数 = 10×4^6+2 = **40962 个地块** —— SSOT 在 sphere.js。*/
  var TILE_SUB = (SP && SP.sub) || 6;
  /* v90.97（双球面）：球面内核别名**调用时解引用 SP** —— 地图切星球后地形/噪声须随地图球面走；
     若像旧版冻结 `SP.sphElev` 的绑定，切球后地形色/高仍按**逻辑球面**算（双球面错配）。
     地形/噪声一律走 sphere.js，别在此重算。*/
  var sphElev = function (d) { return SP.sphElev(d); };
  var seed3 = function () { return SP.seed3(); };
  var nearestCell = function (d) { return SP.nearestCell(d); };
  var h3 = function () { return SP.h3.apply(SP, arguments); };
  var n3 = function () { return SP.n3.apply(SP, arguments); };
  var fbm3 = function () { return SP.fbm3.apply(SP, arguments); };
  var TYPE_NAME = SP.TYPE_NAME;                   /* 地形名表（各星球一致，静态即可）*/

  /* 球面原生生物群系色（按高度 + 纬度）—— 连续、无接缝。*/
  function sphBiome(e, dy, d) {
    var s = seed3();
    var P = SP.PLANET || {};
    var lat = Math.abs(dy), temp = (1 - lat * lat) * (P.temp != null ? P.temp : 1);
    if (e < 0) return e < -0.15 ? [22, 50, 84] : [40, 84, 126];           /* 深海 / 浅海 */
    if (e < 0.05) return [226, 214, 158];                  /* 滩 */
    var m = ramp(Math.min(1, e / 1.15));
    if (temp < 0.28 && e < 0.5) m = [m[0] * 0.8 + 44, m[1] * 0.8 + 40, m[2] * 0.8 + 36];   /* 苔原 */
    else if (temp > 0.68 && e < 0.32) m = [m[0] * 0.78 + 74, m[1] * 0.78 + 58, m[2] * 0.78 + 8]; /* 沙 / 荒漠 */
    /* v90.67（老板 1）：高频**颗粒斑驳** —— 近看有花草 / 岩石细节（顶点级，无贴图）。 */
    if (d) {
      var spk = fbm3(d, 55.0, s + 701) - 0.5;
      var k = 1 + spk * (P.detail != null ? P.detail : 0.7) * 0.6;
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
  /* v90.98（老板）：**地图视野缩放**区间（与滚轮/缩放条同源）。
     dist = 相机到球心距离：越小越近 = 视野越小；越大越远 = 视野越大。 */
  M.ZOOM_MIN = R * 1.2;                                   /* 极小视野（贴脸看细节）*/
  M.ZOOM_MAX = R * 8;                                     /* 极大视野（整星总览）*/

  /* v91.33（性能）：版本戳（把 M.render 里的内联拼串抽出，预建时可预盖）。 */
  M._pverOf = function () { return (SP.seed3 ? SP.seed3() : 0) + '|' + (SP.sub || 0) + '|' + (SP.PLANET ? JSON.stringify(SP.PLANET) : ''); };
  M._mkVerOf = function () { return (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).map(function (c) { return c.id + ':' + c.x + ',' + c.y; }).join('|') + '#' + _tileSub; };
  M._flVerOf = function () { var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {}; var fp = Object.keys(sl.forts || {}).sort().join(','); var wp = (sl.wilds || []).map(function (w) { return w.ci; }).sort(function (a, b) { return a - b; }).join('|'); var _ck = ''; if (GAME.camp && GAME.camp.found) { var cf = GAME.camp.found(); var n = 0, dm = 0; Object.keys(cf).forEach(function (k) { n++; if (cf[k].mode) dm++; }); _ck = '#c' + n + '/' + dm; } return fp + '#' + wp + '#' + _tileSub + '#' + (GAME.memorial ? GAME.memorial.total() : 0) + _ck; };
  M._arVerOf = function () { var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {}; return (sl.marches || []).map(function (m) { return m.id + ':' + m.cityId + '>' + m.tci; }).join('|') + '#' + _tileSub; };
  /* v91.33：**后台预建**全场景（进游戏后调用）—— 含**全部版本戳**（否则首次 M.render 会全量重建）。
     v91.35：拆成**可分段**的步骤（`preloadSteps`）—— 每段之间让出事件循环，避免一次性同步阻塞主线程。
     段序 = 原同步 preload 的展开（严格同序，结果一致）。 */
  M.preloadSteps = function () {
    if (built) return [];               /* 已建 → 零步骤 */
    if (typeof THREE === 'undefined') return [];
    /* ⚠️ v91.35：**先建渲染器，失败即零步骤** —— jsdom（无 WebGL）下 `ensure()` 会抛、
       scene/R3 保持 undefined；若不在此拦下，分帧运行器会吞掉抛错、继续跑完 `finish`，
       把 `built` 置成 true（此时 scene 是 undefined）→ 之后 `M.rebuild()` 里
       `scene.remove(_wonderGrp)` 必崩（"Cannot read properties of undefined"）。
       实测该坑曾让「存档往返」e2e 断言整条红。 */
    try { ensure(); } catch (e) { return []; }
    if (!R3 || !scene) return [];
    var steps = [
      { label: 'sphere', run: function () { if (SP && SP.build) SP.build(SP.sub); } },
      /* v91.46（老板）：「星环加载很慢，一开始没出来、过一会突然出现」——
         奇观 .glb.js 是 2~7MB 的 base64 脚本，**异步加载**（注入 script 即返回）。
         此前它排在**最后**（sphere→globe→tiles→regions→markers→wonder）→ 脚本要等前面
         ~1.6s 的重活跑完才开始下载 → 地图已现、奇观却迟迟不来。
         现**提前到第 2 步**：脚本立刻开始下载，其下载/解析与后续 globe/tiles/regions 重活
         **并行** → 地图出现时奇观基本就绪（buildWonder 只注入脚本、即时返回，不阻塞后续）。
         仅依赖 sphere 已建（cells 就位），不依赖 tiles/markers。 */
      { label: 'wonder', run: function () { buildWonder(); } },
      { label: 'globe+tiles', run: function () { buildGlobe(); buildTiles(TILE_SUB); } },
      { label: 'regions', run: function () { buildRegions(); } },
      { label: 'markers', run: function () { buildMarkers(); buildFlags(); buildMarchArrows(); } },
      /* v91.46：**等奇观就绪再出图**（轮询让出主线程 → glb onload + 解析能跑完）。
         放在最后重活（regions/markers）之后 —— 那时脚本多半已下载完，只需等解析，
         首帧即"地图 + 奇观"一起出现，不再分两次"蹦"。超时（maxWait）则先出地图。 */
      { label: 'wonder-ready', run: function () { }, waitFor: function () {
        if (!M._wonderGrp) return true;                     /* 无奇观/已失败 → 不等 */
        return !!(M._wonderBody && M._wonderSpin && M._wonderSpin.material && M._wonderSpin.material.map);
      }, maxWait: 2500 },
      { label: 'finish', run: function () {
        M._pver = M._pverOf(); M._mkVer = M._mkVerOf(); M._flVer = M._flVerOf(); M._arVer = M._arVerOf();
        try {
          placeCamera();
          if (wcv && typeof window !== 'undefined') {
            wcv.width = window.innerWidth || 1680; wcv.height = window.innerHeight || 900;
            R3.setSize(wcv.width, wcv.height, false); cam.aspect = wcv.width / wcv.height; cam.updateProjectionMatrix();
          }
          R3.render(scene, cam);
        } catch (e) { }
        if (R3 && scene) built = true;   /* 只有渲染器真就绪才认"已建" */
      } },
    ];
    return steps;
  };
  M.preload = function () {
    if (built) return;
    var steps = M.preloadSteps();
    for (var i = 0; i < steps.length; i++) steps[i].run();
  };
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
    scene.add(new THREE.AmbientLight(0xdfe8f0, 0.22));
    scene.add(new THREE.HemisphereLight(0xd8e4f0, 0x2a2a30, 0.20));
    /* v91.38（老板「奇观表面糊成一片、色彩无层次」）——
       球体（globe/water/tiles/markers 等）一律 **MeshBasicMaterial（不受光）**，改光照**只影响
       奇观天体**（现为 MeshStandardMaterial）。原光照**太软太平**（ambient 0.30 + hemi 0.26 +
       dir 2.9），配合 Basic 无所谓、但会**把奇观的明暗层次压平**。
       现：调低环境光、调高**主光方向强度** → 奇观看得出受光面/背光面与凹凸。 */
    var sun = new THREE.DirectionalLight(0xfff0d8, 3.6);
    sun.position.set(-800, 500, -500); scene.add(sun); M._sun = sun;
    /* 侧后方补一盏弱平行光：勾出**轮廓边**（避免背光面纯黑、也让圆面有转折）。 */
    var fill = new THREE.DirectionalLight(0xbcd2e8, 1.0);
    fill.position.set(700, -300, 600); scene.add(fill); M._fillLight = fill;
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
    /* v92：线框**顶点色** —— 迷雾遮罩靠它，不靠多画一层几何。
       暗区把线框染成近黑（不是纯黑：留一点点轮廓，球面才不像一块死黑饼）；
       半明略暗；全明保留原本的冷蓝。
       为什么要走顶点色：线框画在 `_shellR` 球壳上，比地形表面高；
       雾面若只贴地，线框就从雾里穿出来 —— 实测截图里暗区满屏白点就是这个。
       而靠"把雾面抬高"去盖，盖住的是**整颗球**（含已探明区），越修越错。 */
    var ucol = new Float32Array(upos.length);
    for (var ui0 = 0; ui0 < ucol.length; ui0++) ucol[ui0] = 1;
    var lineColAttr = new THREE.Float32BufferAttribute(ucol, 3);
    ugeo.setAttribute('color', lineColAttr);
    M._lineColAttr = lineColAttr;
    var mat = new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
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
   * v92：迷雾层
   * ------------------------------------------------------------
   * 未探明（fog 0）→ 近黑的雾壳，看不见地形
   * 半明  （fog 1）→ 灰纱，看得见起伏，不知道上面有什么
   * 全明  （fog 2）→ 不遮
   *
   * 几何直接用 SP.fpos（每面 3 顶点 · faceCell 面→格）沿格子法线外扩：
   * 雾必须浮在地形之上，否则山脊会穿破它。
   * 只在 fog.ver() 变化时重建 —— 全量 24 万个面片，不能每帧跑。
   * ============================================================ */
  var _fogDark = null, _fogHalf = null;
  function buildFog() {
    var kill = function (m) { if (m) { scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); } };
    kill(_fogDark); kill(_fogHalf); _fogDark = _fogHalf = null;
    var F = GAME.fog, SPn = GAME.sphere;
    if (!F || !SPn || !SPn.fpos || !SPn.faceCell) return;
    F.ensure();
    var fpos = SPn.fpos, fc = SPn.faceCell, cells = SPn.cells;
    var dark = [], half = [], t, v;
    for (t = 0; t < fc.length; t++) {
      v = F.get(fc[t]);
      if (v === 0) dark.push(t); else if (v === 1) half.push(t);
    }
    function makeMesh(list, lift, color, opacity, order) {
      if (!list.length) return null;
      var arr = new Float32Array(list.length * 9), o = 0, i, k, b, d;
      for (i = 0; i < list.length; i++) {
        t = list[i];
        var cx = cells[fc[t]];
        d = (cx && cx.dir) || [0, 1, 0];
        for (k = 0; k < 3; k++) {
          b = t * 9 + k * 3;
          arr[o++] = fpos[b] + d[0] * lift;
          arr[o++] = fpos[b + 1] + d[1] * lift;
          arr[o++] = fpos[b + 2] + d[2] * lift;
        }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: opacity,
        side: THREE.DoubleSide, depthWrite: false
      }));
      m.renderOrder = order;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    }
    /* 外扩量：雾面只需盖住**自己脚下那格的地形**（山脊），不必去盖线框 ——
       线框现在由顶点色自己熄掉（paintLineFog）。
       上一版把 lift 提到 14 想盖线框，结果雾壳膨胀到把已探明区也挡住（截图确认）。 */
    _fogDark = makeMesh(dark, 4, 0x070b11, 0.94, 21);
    _fogHalf = makeMesh(half, 2.5, 0x2a3444, 0.5, 20);
    paintLineFog();
  }

  /* 线框按探明度上色（与雾面同一把尺子：fog.get） */
  function paintLineFog() {
    var attr = M._lineColAttr, SPn = GAME.sphere;
    if (!attr || !SPn || !SPn.uposCell) return;
    var arr = attr.array, uc = SPn.uposCell, F = GAME.fog;
    for (var i = 0; i < uc.length; i++) {
      var v = F ? F.get(uc[i]) : 2;
      var r, g, b;
      if (v === 0) { r = 0.02; g = 0.03; b = 0.05; }        /* 未探明：近黑，只剩极淡轮廓 */
      else if (v === 1) { r = 0.28; g = 0.36; b = 0.45; }   /* 半明：灰蓝 */
      else { r = 0.56; g = 0.70; b = 0.84; }                /* 全明：原冷蓝 */
      var o = i * 6;                                        /* 每段 2 顶点 × 3 分量 */
      arr[o] = r; arr[o + 1] = g; arr[o + 2] = b;
      arr[o + 3] = r; arr[o + 4] = g; arr[o + 5] = b;
    }
    attr.needsUpdate = true;
  }
  /* 该格是否被迷雾遮住（未探明）。标记/标签/点击都用这一把尺子。 */
  function fogHides(ci) {
    return !!(GAME.fog && GAME.fog.get(ci) === 0);
  }

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
    /* v90.99（老板）：**每颗星球独立的省市区** —— 省名走废土名池（seed 决定，各星不重样）。
       旧口径 `PROV_NAMES = DATA.START_STATES` 是**全仓一份**的常量 → 所有星球行省重名（老板验收发现）。
       母星保留其「出生区」体系（STATE_SPECIALTY 等，按计划地块读 `stateOfCity`），与本 3D 行政层无关。 */
    var ni = 0, _nameUsed = {};
    var _n0 = (seed >>> 0) % WAS_PRE.length;             /* v90.99：起始前缀随 seed → 各星球名字不重样 */
    function genName() {                                  /* 废土名 · 前后缀快速轮换（自然混合）· 唯一 */
      var ln = WAS_PRE.length * WAS_SUF.length;
      for (var tries = 0; tries < ln; tries++) {
        var n = WAS_PRE[(_n0 + ni * 7) % WAS_PRE.length] + WAS_SUF[(ni * 13) % WAS_SUF.length];
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
    /* ============================================================
     * v91.44（老板）：「行省/市/区的**首府/首市/首区**竟然不在该辖区内」——
     *   根因：中心点取的是 kmeans **质心方向**，而行政区是**非凸连通块**，
     *   质心常落在辖区外（甚至落进别的区）→ `nearestCell(质心)` 取到的格子不在本区。
     * 修：`groupCenterDir(cent, members)` = 取**该组成员方向求平均 → 再取离平均最近的成员格**，
     *   保证返回的**一定落在组内**（成员本身）。省/市/区三级中心统一走它。
     * ============================================================ */
    function groupCenterDir(cent, members) {
      if (!members || !members.length) return { dir: cent, ci: -1 };
      var sx = 0, sy = 0, sz = 0;
      for (var gi = 0; gi < members.length; gi++) { var gd = M._vdirs[members[gi]]; if (!gd) continue; sx += gd[0]; sy += gd[1]; sz += gd[2]; }
      var gl = Math.hypot(sx, sy, sz) || 1, gc = [sx / gl, sy / gl, sz / gl];
      var best = null, bci = -1, bd = -2;
      for (var gj = 0; gj < members.length; gj++) { var dd = M._vdirs[members[gj]]; if (!dd) continue; var dt = dd[0] * gc[0] + dd[1] * gc[1] + dd[2] * gc[2]; if (dt > bd) { bd = dt; best = dd; bci = members[gj]; } }
      return { dir: best || cent, ci: bci };
    }
    /* v90.99（老板）：**省/市/区数量随星球陆地面积缩放** —— 老家（~45% 陆地）为 1.0 基准，
       小星球省更少、大星球省更多（不必与老家一致）。再按「每省 2~6 市、每市 2~4 区」配面积。 */
    var landFrac = dirs.length / Math.max(1, nv);
    var scale = landFrac / 0.45;
    var nProv = Math.max(3, Math.min(18, Math.round(scale * 12)));
    nProv = Math.min(nProv, dirs.length);                 /* 省数不得超过陆地格数 */
    if (nProv < 1) return empty;
    var MC = []; for (var q0 = 0; q0 < nProv; q0++) MC.push(2);
    var targetM = Math.max(nProv * 2, Math.min(nProv * 6, Math.round(scale * 48)));
    var pool = targetM - nProv * 2;
    for (var jj = 0; pool > 0; jj++) { var ix = Math.floor(rh(100 + jj, seed) * nProv); if (MC[ix] < 6) { MC[ix]++; pool--; } }
    var DC = [], PD = [];
    for (var pp = 0; pp < nProv; pp++) { var arr = [], tot = 0; for (var qq = 0; qq < MC[pp]; qq++) { var dv = 2 + Math.floor(rh((pp * 97 + qq) * 13 + 5, seed) * 3); arr.push(dv); tot += dv; } DC.push(arr); PD.push(tot); }
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
    /* v90.99：省数 = nProv（随星球陆地面积缩放，见上）—— 互相接壤、覆盖全陆 · 省面积 ∝ 省总区数 PD */
    var provCent = sphereKmeans(dirs, nProv, 10);
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
      var pNode = { name: genName(), cent: provCent[p], markets: [] };   /* v90.99：省名走废土名池（各星唯一） */
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
    /* v91.44：**行政中心一律落回本辖区**（kmeans 质心可能落在辖区外/别区）——
       用最终归属数组反推每级成员，把中心改成"组内离组质心最近的格"，并**记下该格的 ci**。
       中心格 = 组内成员本身 → 一定落在本辖区；且 `_ci` 直供落点，免 `nearestCell` 再反查
       （反查在边界上可能落到邻格 → 少数市/区"中心跑到邻区"的残留）。 */
    (function () {
      var _pM = [], _mM = [], _dM = [];
      for (var z = 0; z < provCent.length; z++) _pM.push([]);
      for (var z2 = 0; z2 < marketCent.length; z2++) _mM.push([]);
      for (var z3 = 0; z3 < districtCent.length; z3++) _dM.push([]);
      for (var ci = 0; ci < nv; ci++) {
        if (provOf[ci] >= 0 && _pM[provOf[ci]]) _pM[provOf[ci]].push(ci);
        if (marketOf[ci] >= 0 && _mM[marketOf[ci]]) _mM[marketOf[ci]].push(ci);
        if (districtOf[ci] >= 0 && _dM[districtOf[ci]]) _dM[districtOf[ci]].push(ci);
      }
      for (var pi = 0; pi < provCent.length; pi++) { var g1 = groupCenterDir(provCent[pi], _pM[pi]); provCent[pi] = g1.dir; if (table.prov[pi]) table.prov[pi].cent = g1.dir; }
      for (var mi = 0; mi < marketCent.length; mi++) { var g2 = groupCenterDir(marketCent[mi], _mM[mi]); marketCent[mi] = g2.dir; if (table.market[mi]) table.market[mi].cent = g2.dir; }
      for (var di = 0; di < districtCent.length; di++) { var g3 = groupCenterDir(districtCent[di], _dM[di]); districtCent[di] = g3.dir; if (table.district[di]) table.district[di].cent = g3.dir; }
    })();
    M.adminTable = table;
    /* 行政中心**城对象**（旧都/省府/市府/区）—— 占据地块、可点弹出征界面 */
    var admCities = [], EGT = { old: 22, prov: 18, market: 14, district: 9 };
    function tierOf(lv) { return lv === 'old' ? 'capital' : lv === 'prov' ? 'zhou' : lv === 'market' ? 'jun' : 'county'; }
    /* v91.44：落点 ci = **在最终归属数组里属于本辖区 idx、且方向离该中心最近的格** ——
       无论如何都能保证"中心格 ∈ 本辖区"（省/市/区同一把尺）。 */
    function cellInGroup(arr, idx, cent) {
      var best = -1, bd = -2;
      for (var k = 0; k < nv; k++) {
        if (arr[k] !== idx) continue;
        var d = M._vdirs[k]; if (!d) continue;
        var dt = d[0] * cent[0] + d[1] * cent[1] + d[2] * cent[2];
        if (dt > bd) { bd = dt; best = k; }
      }
      return best;
    }
    function addAdm(lv, name, cent, idx, hintArr) {
      var ci = (hintArr ? cellInGroup(hintArr, idx, cent) : -1);
      if (ci < 0) ci = nearestCell(cent);
      if (ci < 0) return;
      var cell = _tileCells[ci]; if (!cell) return;
      var tier = tierOf(lv), lvl = EGT[lv];
      var c = { id: 'adm_' + lv + '_' + idx, name: name, x: cell.x, y: cell.y, ci: ci,
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
      addAdm('prov', pv2.name + '府', pv2.cent, pa, provOf);
      pv2.markets.forEach(function (mi) { var m = table.market[mi]; addAdm('market', m.name, m.cent, mi, marketOf); });
      pv2.markets.forEach(function (mi) { table.market[mi].districts.forEach(function (di) { var d = table.district[di]; addAdm('district', d.name, d.cent, di, districtOf); }); });
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
    /* v90.97（双球面）：据点按**地图星球**的球面/种子/分片算（未必 = 当前城所在星球）。 */
    var mctx = GAME.map._pctx(GAME.mapPlanetOf ? GAME.mapPlanetOf().id : null);
    var mark = {};                                          /* cellIndex → [r,g,b]（平涂地块）*/
    /* 地块**属性索引**：每格 = 野地 / 城市 / 据点（明确区分）*/
    var cellKind = {}, cellRef = {};
    for (var vi0 = 0; vi0 < M._vdirs.length; vi0++) if (M._vdirs[vi0] && S.provOf[vi0] >= 0) { cellKind[vi0] = 'wild'; }   /* 默认：陆地块 = 野地 */
    /* 据点 = 黄 */
    for (var fi = 0; fi < _tileCells.length; fi++) { var fc = _tileCells[fi]; if (fc && GAME.map.fortAt(fc.ci, mctx)) { mark[fi] = [226, 202, 64]; cellKind[fi] = 'fort'; } }
    /* v90.70：实体 → 六边格索引。带 .ci 直用（球系唯一身份）；否则按 (x,y) 现算（旧档/未标注）。 */
    function ciOfRef(ref) {
      if (!ref) return -1;
      if (ref.ci != null && ref.ci >= 0 && SP.cells && SP.cells[ref.ci]) return ref.ci;
      if (ref.x == null || ref.y == null) return -1;
      return nearestCell(dirOfCell(ref.x, ref.y));
    }
    /* NPC 名城 = 红
       v91.09（老板「新星球名城没有守兵」根因）：marker 的 cellRef 直接传 **DATA.NPC_CITIES 原始模板**
       （无 `garrison` 字段）→ 弹出征/攻打时 `npcCity.garrison` 为空（**0 守军、免战可占**）。
       2D 路径走 `s.map.cities`（buildNpcCities 产、**带守军**）故无此问题 —— 根因是 3D 走了原始模板。
       守军按城 id 派生（`genGarrison` 与星球无关）→ 缺则现算，一次补齐（幂等）。 */
    (GAME.DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.lon == null || c.lat == null) { var d = dirOfCell(c.x, c.y); c.lon = (Math.atan2(d[2], d[0]) * 180 / Math.PI + 360) % 360; c.lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI; }
      if (!c.garrison && GAME.genGarrison) { c.garrison = GAME.genGarrison(c); c.maxArmy = c.garrison; }
      var ci = ciOfRef(c); if (ci >= 0) { mark[ci] = [220, 70, 60]; cellKind[ci] = 'npc'; cellRef[ci] = c; }
    });
    /* 行政中心城 = 紫色（按球面质心方向取格）*/
    (M.admCities || []).forEach(function (c) { var ci = (c.ci != null && c.ci >= 0) ? c.ci : nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c; } });
    /* 己方城 = 蓝：落在其**球面六边格索引 ci**（球系唯一身份，免 (x,y) 往返）
       v90.97（双球面）：读**地图星球分片**的城（未必 = 当前城所在星球）。 */
    M._ownCells = {};
    ((GAME.mapSliceOf() || {}).cities || []).forEach(function (c) {
      var ci = ciOfRef(c);
      var dir = (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(c.x, c.y);
      c.lon = (Math.atan2(dir[2], dir[0]) * 180 / Math.PI + 360) % 360;
      c.lat = Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
      if (ci < 0) return;
      mark[ci] = [80, 150, 230]; cellKind[ci] = 'own'; cellRef[ci] = c; M._ownCells[ci] = c;
    });
    /* v92：**未探明的格子一律不出标记**。
       只把地形画暗却照样显示每座城/每块野地，迷雾就只是"地图变暗"，
       玩家仍然一眼看尽 —— 那不是未知，是滤镜。
       己方城豁免（自家地盘必然已点亮，兜底防"自家城凭空消失"）。 */
    Object.keys(mark).forEach(function (k) {
      if (cellKind[k] === 'own') return;
      if (fogHides(+k)) { delete mark[k]; delete cellKind[k]; delete cellRef[k]; }
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
      /* v92：未探明格**不浮名**。否则雾里还飘着"灰烬城 / 某某府"，
         等于把整张地图的行省结构白送 —— 迷雾就形同虚设了。
         ⚠️ 必须用 **SP**（= GAME.mapSphere）反查，不能用 GAME.sphere：
         双球面下逻辑球面可能还没 build（nv=0，nearestCell 恒返回 -1）→ 过滤静默失效，
         未探明区照样飘城名（实测截图确认）。 */
      if (GAME.fog && dir && SP.nearestCell) {
        var _fci = SP.nearestCell(dir);
        if (_fci >= 0 && GAME.fog.get(_fci) === 0) return;
      }
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
    /* v91.36（老板「有名称的名城被占领后，同时冒出 2 个名称标签」）——
       被占名城**不再画原（金）标签**，只留「本城」的蓝标签（下方 own 循环画），
       避免同名双标签叠在一起。判据：本星球分片里已拥有的城，其 `origId` = 该名城的 id。 */
    var _ownOrig = {};
    (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).forEach(function (c) { if (c && c.origId) _ownOrig[c.origId] = 1; });
    (GAME.DATA.NPC_CITIES || []).forEach(function (c) { if (_ownOrig[c.id]) return; if (c.type === 'capital' || c.type === 'zhou') floatName(dirOfRef(c), c.name || '', '#ffd76a'); });
    var ol = M.admCities || [];
    ol.forEach(function (c) { if (c.admLevel === 'old' || c.admLevel === 'prov') floatName(c._cent, c.name, c.admLevel === 'old' ? '#ffd76a' : '#cfe6ff'); });
    /* v90.57（老板）：**己方城市**也引出名称（像名城一样）—— 亮蓝＝己方色。
       v90.97（双球面）：名称取**地图星球分片**的城。 */
    (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).forEach(function (c) { floatName(dirOfCell(c.x, c.y), c.name || '城', '#8fd4ff'); });
    if (lp.length) { var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.92, depthWrite: false }))); }
    M._labels = grp; scene.add(grp);
  }
  /* v91.12（老板 16）：**出征弧形箭头** —— 城市1 → 目标，地图上画一道**导弹打击曲线**。
     数据 = 当前地图星球的 `s.marches`（在途行军）：出发城(cityId) → 目标(tx,ty)。
     弧线走球面：起点/终点方向球面插值（slerp）并**沿法线外拱**（越高越像弹道）。
     淡金线 + 悬浮箭头头（Sprite）；随行军增减/抵达而重建（版本键 _arVer）。 */
  function buildMarchArrows() {
    if (M._arrows) { scene.remove(M._arrows); M._arrows = null; }
    if (!GAME.map || !GAME.map.lonlatOf || !_tileCells || !_tileCells.length) return;
    var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {};
    var marches = sl.marches || [];
    var cities = sl.cities || [];
    function cityOf(id) { for (var i = 0; i < cities.length; i++) if (cities[i].id === id) return cities[i]; return null; }
    /* 世界格 → 球面单位方向（走球系坐标唯一出口，与标记同源） */
    function dirAt(x, y) {
      var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
      var L = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / L, d[1] / L, d[2] / L];
    }
    function slerp(a, b, t) {          /* 球面插值（防跨球弦切穿地表） */
      var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      var th = Math.acos(dot);
      if (th < 1e-4) return a.slice();
      var s = Math.sin(th), w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
      var v = [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
      var L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L];
    }
    var grp = new THREE.Group(), segs = [], heads = [];
    marches.forEach(function (m) {
      if (!m) return;
      var c0 = cityOf(m.cityId); if (!c0 || m.tx == null || m.ty == null) return;
      var a = dirAt(c0.x, c0.y), b = dirAt(m.tx, m.ty);
      var R0 = (typeof R === 'number' ? R : 300) + 6;
      var N = 26, pts = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N, d = slerp(a, b, t);
        var arc = Math.sin(t * Math.PI) * 0.16;   /* 弹道外拱 */
        var r = R0 * (1 + arc);
        pts.push(new THREE.Vector3(d[0] * r, d[1] * r, d[2] * r));
      }
      /* 用**带状（ribbon）**画弧 —— LineBasicMaterial 的 linewidth 在 WebGL 被忽略（恒 1px），
         单线太细看不见；改三角带（每点沿"侧向"±半宽）→ 明确可见的弹道曲线。 */
      var halfW = R0 * 0.0035;
      var vpos = [], vcol = [], idx = [], A = [0.98, 0.82, 0.32], A2 = [0.72, 0.55, 0.12];
      for (var k = 0; k <= N; k++) {
        var p = pts[k];
        var rad = p.clone().normalize();
        var tan = (k < N ? pts[k + 1].clone().sub(p) : p.clone().sub(pts[k - 1])).normalize();
        var side = new THREE.Vector3().crossVectors(rad, tan).normalize().multiplyScalar(halfW);
        vpos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
        vcol.push(A2[0], A2[1], A2[2], A[0], A[1], A[2]);
        if (k < N) { var o = k * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3));
      geo.setIndex(idx);
      grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })));
      /* 箭头头：终点沿切线方向 */
      var tip = pts[N], prev = pts[N - 1];
      var tang = new THREE.Vector3(tip.x - prev.x, tip.y - prev.y, tip.z - prev.z).normalize();
      var spr = arrowHeadSprite();
      spr.position.copy(tip).add(tang.clone().multiplyScalar(R0 * 0.02));
      grp.add(spr);
      heads.push(spr);
      segs.push(geo);
    });
    M._arrows = grp; scene.add(grp);
  }
  function arrowHeadSprite() {
    var SS = 2, w = 20 * SS, h = 26 * SS;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.beginPath(); g.moveTo(w / 2, 2 * SS); g.lineTo(w - 3 * SS, h - 2 * SS); g.lineTo(w / 2, h - 8 * SS); g.lineTo(3 * SS, h - 2 * SS); g.closePath();
    g.fillStyle = '#ffcf4d'; g.fill();
    g.lineWidth = 2 * SS; g.strokeStyle = 'rgba(10,14,20,.95)'; g.stroke();
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false }));
    spr.userData = { asp: w / h, arrow: true };
    return spr;
  }
  /* 平面格 (x,y) → 球面方向（走 GAME.map 的**球系坐标单一出口**）*/
  function dirOfCell(x, y) {
    var c = GAME.map.lonlatOf(x, y);
    return GAME.map.dirOf(c.lon, c.lat);
  }

  /* v91.05（老板）：「为己方据点、野地在地图上插个小旗子」——
     小旗 Sprite（旗杆 + 三角旗 + 底座），己方**据点=琥珀金 / 野地=绿**。
     屏幕尺寸由 scaleLabels 每帧归一（同名称标签）→ 恒定大小、随缩放不飘。 */
  function flagSprite(colorHex) {
    var SS = 3, w = 22 * SS, h = 30 * SS;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    var poleX = 6 * SS;
    /* 旗杆 */
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(poleX, 2 * SS); g.lineTo(poleX, h - 2 * SS);
    g.lineWidth = 3.2 * SS; g.strokeStyle = 'rgba(6,9,13,.95)'; g.stroke();
    g.lineWidth = 1.6 * SS; g.strokeStyle = '#cfd8e2'; g.stroke();
    /* 三角旗（右向） */
    var fw = w - poleX - 3 * SS, fh = 13 * SS;
    g.beginPath(); g.moveTo(poleX, 3 * SS); g.lineTo(poleX + fw, 3 * SS + fh * 0.5); g.lineTo(poleX, 3 * SS + fh); g.closePath();
    g.lineWidth = 2.4 * SS; g.strokeStyle = 'rgba(6,9,13,.95)'; g.stroke();
    g.fillStyle = colorHex; g.fill();
    /* 底座圆点 */
    g.beginPath(); g.arc(poleX, h - 3 * SS, 2.6 * SS, 0, 6.283);
    g.fillStyle = colorHex; g.fill();
    g.lineWidth = 1.5 * SS; g.strokeStyle = 'rgba(6,9,13,.9)'; g.stroke();
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: true }));
    spr.userData = { asp: w / h, flag: true };
    return spr;
  }
  /* 己方据点/野地 → 插旗（按**地图星球**；坐标走六边格中心）。*/
  function buildFlags() {
    if (M._flags) { scene.remove(M._flags); M._flags = null; }
    if (!_tileCells || !_tileCells.length) return;
    var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {};
    var grp = new THREE.Group();
    function place(ref, colorHex) {
      /* v91.25（球系）：**以 ci 直接落格**（旧法 dirOfCell(x,y) 经 (x,y)→经纬→最近格 往返，
         会落到邻格 → 棋子错位）。缺 ci 的旧档才回退坐标往返。 */
      var ci = (ref && ref.ci != null && ref.ci >= 0) ? ref.ci : ((ref && ref.x != null && ref.y != null) ? nearestCell(dirOfCell(ref.x, ref.y)) : -1);
      var cell = (ci >= 0) ? _tileCells[ci] : null; if (!cell || !cell.pos) return;
      var P = cell.pos, L = Math.hypot(P[0], P[1], P[2]) || 1, lift = 1.5;
      var spr = flagSprite(colorHex);
      spr.position.set(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      grp.add(spr);
    }
    var fo = sl.forts || {};
    Object.keys(fo).forEach(function (k) { place(fo[k], '#ffcf4d'); });   /* 己方据点 = 琥珀金 */
    (sl.wilds || []).forEach(function (w) { place(w, '#7bd88f'); });      /* 己方野地 = 绿 */
    /* v92：**阵亡地点**留一面暗红的旗 —— 地图上看得见"这一带死过人"。
       不做数字标签（"42 人"）挂在旗上：旗帜是纪念，不是战绩榜。 */
    if (GAME.memorial && GAME.memorial.byPlace) {
      var bp = GAME.memorial.byPlace();
      Object.keys(bp).forEach(function (k) {
        var ci = +k; if (!(ci >= 0)) return;
        var cell0 = _tileCells[ci];
        if (!cell0 || !cell0.pos) return;
        if (GAME.fog && GAME.fog.get(ci) === 0) return;   /* 未探明的地方不显示（否则等于免费探图）*/
        place({ ci: ci }, '#9c3b34');
      });
    }
    M._flags = grp; scene.add(grp);
    /* ============================================================
     * v92.6（构想 A2：半信息痕迹）—— 迷雾边缘的"有东西"暗示
     * ------------------------------------------------------------
     * 文档原话：「未点亮区能看到烟柱、脚印、无线电杂音，知道『有东西』
     * 但不知是什么」。
     *
     * 这是纯视觉，不带任何情报：不给地形、不给等级、点不开、不进 info 条。
     * 它只回答"往哪走"这个方向问题 —— 全黑的球玩家不知道往哪推。
     * 位置由哈希决定（确定性），玩家可以记住"那根烟一直在那边"。
     * ============================================================ */
    if (GAME.fog && GAME.DATA && GAME.DATA.FOG && GAME.DATA.FOG.traceChance) {
      var _tc = GAME.DATA.FOG.traceChance;
      var _tn = _tileCells.length;
      for (var _ti = 0; _ti < _tn; _ti++) {
        if (GAME.fog.get(_ti) !== 0) continue;          /* 只看未探明格 */
        var _tc0 = _tileCells[_ti];
        if (!_tc0 || !_tc0.pos || !_tc0.nt) continue;
        /* 必须紧贴已探明区（更远的地方，玩家连"那边有东西"都没理由知道） */
        var _near = false;
        for (var _adj = 0; _adj < _tc0.nt; _adj++) {
          var _nb = SP.adj[_ti] && SP.adj[_ti][_adj];
          if (_nb != null && _nb >= 0 && GAME.fog.get(_nb) > 0) { _near = true; break; }
        }
        if (!_near) continue;
        /* 确定性：同一格永远有/没有这根烟 */
        var _hx = (_ti * 2654435761 + (_tileSub + 7) * 40503) >>> 0;
        _hx ^= _hx >>> 13; _hx = (_hx * 1274126177) >>> 0; _hx ^= _hx >>> 16;
        if ((_hx >>> 0) / 4294967296 >= _tc) continue;
        var _P = _tc0.pos, _L = Math.hypot(_P[0], _P[1], _P[2]) || 1, _lf = 5;
        var _tm = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0x9c5a3c, transparent: true, opacity: 0.75 }));
        _tm.position.set(_P[0] + _P[0] / _L * _lf, _P[1] + _P[1] / _L * _lf, _P[2] + _P[2] / _L * _lf);
        grp.add(_tm);
      }
    }
    /* v92.4：已发现的幸存者营地 —— 金珠（待交涉）/ 绿珠（已招募）/ 暗红珠（已洗劫）。
       只在已探明处显示：探明度掉了（换星球/重置）就不画，不泄露位置。 */
    if (GAME.camp && GAME.camp.found) {
      var _cf = GAME.camp.found();
      Object.keys(_cf).forEach(function (k) {
        var ci = +k, rec = _cf[k];
        var cell0 = _tileCells[ci];
        if (!cell0 || !cell0.pos) return;
        if (GAME.fog && GAME.fog.get(ci) <= 0) return;
        var col = rec && rec.mode === 'recruit' ? 0x7bd88f : (rec && rec.mode === 'raid' ? 0x9c3b34 : 0xffc857);
        var P = cell0.pos, L = Math.hypot(P[0], P[1], P[2]) || 1, lift = 4;
        var mesh = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
        mesh.position.set(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
        grp.add(mesh);
      });
    }
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
    [M._labels, M._hl, M._flags, M._wonderGrp ? { children: M._wonderBody ? [M._wonderBody] : [] } : null].forEach(function (grp) {
      if (!grp || !grp.children) return;
      grp.children.forEach(function (ch) {
        if (!ch.isSprite) return;
        var d = cam.position.distanceTo(ch.position);
        /* 小旗 ≈ 名称标签同高；箭头头略小（指向终点） */
        var kf = (ch.userData && ch.userData.flag) ? 1.05 : ((ch.userData && ch.userData.arrow) ? 0.9 : 1);
        var hW = k * d * kf;
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
    var _pver = M._pverOf();
    if (_pver !== M._pver) {
      M._pver = _pver; built = false; M._mkVer = null; M.region = null; M.clearBeam();
      if (M._sun && SP.PLANET && SP.PLANET.starColor != null) M._sun.color.setHex(SP.PLANET.starColor);   /* 恒星色温 → 光色 */
    }
    if (!built) { buildGlobe(); buildTiles(TILE_SUB); buildRegions(); buildMarkers(); buildFlags(); buildMarchArrows(); built = true; }
    /* v92：迷雾层 —— 探明度一变就重建（行军点亮 / 侦查 / 占城都会推 ver）。
       放在 built 之后：换星球时 buildTiles 换了 cells，雾层必须跟着重量。 */
    var _fv = GAME.fog ? GAME.fog.ver() : 0;
    if (_fv !== M._fogVer) {
      M._fogVer = _fv; buildFog();
      M._mkVer = null;   /* 迷雾变了 → 标记/浮名的可见集也变了，下一行强制重建 */
    }
    buildWonder();   /* v91.30：奇观天体（按当前地图星球 · 幂等） */
    /* v90.81（老板 4 · L0 自转）：地图页静止 10s 无操作 → 星球按 PLANET.spinSec 自动旋转。
       见下方 insetInterval 驱动器（每 33ms 步进 + 重绘）。 */
    if (M._lastAct == null) M._lastAct = Date.now();
    placeCamera();
    /* 地块数**固定**（老板）：不再随缩放切换级别 —— 恒定 TILE_SUB（= 40962 块）。*/
    /* 城市/据点增减/迁移（占领/迁址/放弃）→ 重建标记。v90.62（老板「移动后新城2 无色块/名称」）：
       旧判据只数**城市条数** —— 迁址时条数不变 → 标记不重建 → 旧色块/名称留在原地。
       改：把各城的 **id + 坐标** 拼进版本号，任一城移动即触发重建（色块与连线随城走）。 */
    var _mkVer = M._mkVerOf();
    if (_mkVer !== M._mkVer) { M._mkVer = _mkVer; buildMarkers(); }
    /* v91.05（老板）：己方**据点/野地插旗** —— 归属随占/放/迁变，同款"坐标拼版本号"触发重建。 */
    var _flVer = M._flVerOf();
    if (_flVer !== M._flVer) { M._flVer = _flVer; buildFlags(); }
    /* v91.12（老板 16）：**出征弧形箭头** —— 在途行军增减/改向即重建（id+起止坐标拼版本号）。 */
    var _arVer = M._arVerOf();
    if (_arVer !== M._arVer) { M._arVer = _arVer; buildMarchArrows(); }
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
    /* v90.83：**当前星球标识**（左下常驻）—— 换球后一眼可辨"现在是哪颗"（生成/进入星球后即时更新）。
       放左下：右上被地形/行政检索栏占用。 */
    if (GAME.state && GAME.state.planets) {
      var _ap = GAME.activePlanetOf ? GAME.activePlanetOf() : null;
      if (_ap) {
        var _pt = '🪐 ' + _ap.name + ' · 种子 ' + _ap.seed;
        ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        var _pw = ctx.measureText(_pt).width;
        ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(14, ch - 40, _pw + 22, 28);
        ctx.strokeStyle = 'rgba(255,215,106,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, ch - 40, _pw + 22, 28);
        ctx.fillStyle = '#ffd76a'; ctx.fillText(_pt, 25, ch - 32);
        /* v92：**行迹**（已探明 % + 当前视野半径），挂在星球标识同一行右侧。
           放在地图上而不是藏在军务页里：探索度是这张地图的主状态，
           玩家抬头就该看见"我还认识多少"。 */
        if (GAME.fog && GAME.fog.stats) {
          var _fs2 = GAME.fog.stats();
          /* 顺带报"下一档还差多少" —— 里程碑只落一条日志很容易被错过，
             常驻在 HUD 上玩家才知道"再探 2.7% 视野就 +1"。 */
          var _nextT = null;
          ((GAME.DATA.FOG || {}).tiers || []).forEach(function (t) {
            if (!_nextT && _fs2.pct < t.pct) _nextT = t;
          });
          var _ft = '🗺 行迹 ' + _fs2.pct + '%　· 视野 ' + GAME.fog.radiusOf() + ' 格'
            + (_nextT ? ('　· 再 ' + (Math.round((_nextT.pct - _fs2.pct) * 10) / 10) + '% → ' + _nextT.r + ' 格') : '');
          var _fx = 14 + _pw + 30;
          ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          var _fw = ctx.measureText(_ft).width;
          ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(_fx, ch - 40, _fw + 22, 28);
          ctx.strokeStyle = 'rgba(143,180,214,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(_fx, ch - 40, _fw + 22, 28);
          ctx.fillStyle = '#8fb4d6'; ctx.fillText(_ft, _fx + 11, ch - 32);
        }
      }
    }
    /* 点击选中 → 画信息条（地块类型 + 等级）*/
    if (M._cell) {
      var _kname = { wild: '野地', fort: '据点', npc: '名城', adm: '行政城', own: '己方城' }[M._cellKind] || '野地';
      /* v92：未探明格**连地形名与海拔都不给** —— 否则信息条就成了免费的探图工具。 */
      /* v92.5：这一格归哪家军阀 —— 与点击面板同一出口（faction.controlOf），
         不在这里另算一遍距离。未探明的格子不给（连地形都不给，更不会给归属）。 */
      var _facName = '';
      if (M._cellKind !== 'unknown' && GAME.faction && GAME.faction.controlOf) {
        var _fid = GAME.faction.controlOf(M._cell.ci != null ? M._cell.ci : -1);
        if (_fid) { var _fd = GAME.faction.defOf(_fid); _facName = (_fd && _fd.name) || _fid; }
      }
      var txt = (M._cellKind === 'unknown')
        ? '【未探明】这一带地图上没有记载'
        : ('【' + _kname + '】' + M._cell.name + ' · 等级 ' + M._cell.level
          + ' · 球系坐标 ' + (GAME.map.coordText ? GAME.map.coordText(M._cell.x, M._cell.y) : (Math.round(M._cell.lon) + '°E ' + Math.round(M._cell.lat) + '°'))
          + (_facName ? ('　⚔ ' + _facName + ' 的地盘') : ''));
      /* v90.66（老板）：字号缩到与底部导航栏一致（原 bold 20px 偏大）。 */
      ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(14, 12, tw + 22, 28);
      ctx.strokeStyle = 'rgba(200,230,255,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 12, tw + 22, 28);
      ctx.fillStyle = '#eaf4ff'; ctx.fillText(txt, 25, 20);
    }
    /* v90.81：自转驱动器 —— 地图页静止 10s 后**每 33ms 步进 + 重绘**（setInterval，稳）。
       非自转态（有操作 / 非地图页）自动停。 */
    function _spinTick() {
      var ok = GAME.ui && GAME.ui.view === 'map' && GAME.state && (Date.now() - (M._lastAct || 0) > 10000);
      if (!ok) {
        if (M._spinTimer) { clearInterval(M._spinTimer); M._spinTimer = null; }
        return;
      }
      var _spin = (SP.PLANET && SP.PLANET.spinSec) || 60;
      camO.yaw += (2 * Math.PI / _spin) * 0.033;             /* 每 33ms 一步 → spinSec 秒一圈 */
      wonderStep();                                          /* v91.30：奇观轨行 + 出场/离场动画 */
      if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }
    if (!M._spinTimer && typeof setInterval !== 'undefined') M._spinTimer = setInterval(_spinTick, 33);
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
      camO.dist = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, camO.dist * (e.deltaY < 0 ? 0.9 : 1.11)));
      touch(); redraw();
    }, { passive: false });
  };
  /* v90.98（老板）：缩放条 ↔ 相机距离的**唯一换算**（滚轮也用同一对区间）。
     zoomFrac()：0 = 极小视野（最近）→ 1 = 极大视野（最远）—— 供底栏滑块落位。 */
  M.zoomFrac = function () {
    var d = camO.dist; return Math.max(0, Math.min(1, (d - M.ZOOM_MIN) / (M.ZOOM_MAX - M.ZOOM_MIN)));
  };
  /* setZoom(frac)：滑块拖动 → 设视野（0 近 · 1 远）；不动朝向。返回当前 frac。 */
  M.setZoom = function (frac) {
    frac = Math.max(0, Math.min(1, Number(frac) || 0));
    camO.dist = M.ZOOM_MIN + (M.ZOOM_MAX - M.ZOOM_MIN) * frac;
    if (M._lastAct != null) M._lastAct = Date.now();       /* 视为一次操作（重置自转计时）*/
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return frac;
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
    /* v91.30：先判**奇观天体**（点击开奇观菜单）——比地块优先。 */
    if (M._wonderBody) {
      var wh = rc.intersectObject(M._wonderBody, true);
      if (wh && wh.length && GAME.ui && GAME.ui.openWonder) { GAME.ui.openWonder(_wonderPid()); return; }
    }
    var hit = rc.intersectObject(M._collider, false);
    if (!hit.length) { M._cell = null; if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    var face = hit[0].face, ci = M._collider.faceCell[face.a / 3 | 0];
    var cell = M._collider.cells[ci];
    if (!cell) return;
    /* v92：**未探明的格子点不进去** —— 这是迷雾真正的玩法后果。
       不做成"点开发现是空的"：那只是把信息藏一层，玩家照样能靠点击扫图。
       整片未探明 = 地图上没有这一带，得先派人过去（这里连地形都不给看）。 */
    if (fogHides(ci)) {
      M._cell = cell; M._cellKind = 'unknown';
      if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🌫 ' + GAME.fog.unknownMsg());
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    M._cell = cell;
    var kind = (M.cellKind && M.cellKind[ci]) || 'wild';   /* 地块属性：野地/城市/据点/行政城/己方城 */
    M._cellKind = kind;
    var reg = M.regionAt(ci);                                  /* 该地块的省/市/区归属 */
    /* 链接到游戏弹窗（照抄 main.js:2534 的 2D 分发）*/
    var ui = GAME.ui;
    if (ui) {
      var ref = M.cellRef && M.cellRef[ci];
      if (kind === 'own' && ref && ui.openCityPanel) ui.openCityPanel(ref);
      else if (kind === 'npc' && ref && ui.openAttackModal) ui.openAttackModal(ref);
      else if (kind === 'adm' && ref && ui.openAttackModal) ui.openAttackModal(ref);
      else if (kind === 'fort' && GAME.map.fortAt) { var ff = GAME.map.fortAt(ci, GAME.map._pctx(GAME.mapPlanetOf ? GAME.mapPlanetOf().id : null)); if (ff && ui.openFortModal) ui.openFortModal(ff); else if (ui.openLandModalCi) { GAME.map._terrOverride = cell.type; GAME.map._regionOverride = reg; ui.openLandModalCi(ci); } }
      /* v92.4：已发现的营地**优先于野地** —— 同一格上，营地才是这一带真正的事。
         没发现的营地不拦（照旧按野地处理），免得"点了没反应"。 */
      else if (GAME.camp && GAME.camp.isFound(ci) && ui.openCampModal) ui.openCampModal(ci);
      else if (ui.openLandModalCi) {
        /* 野地：球面地块地形/等级 + 行政区归属 + 球系坐标（球系：按 ci） */
        GAME.map._terrOverride = cell.type;
        GAME.map._regionOverride = reg;
        ui.openLandModalCi(ci);
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
  /* ============================================================
   * v91.30 奇观天体（绕星球轨道 · 出场/离场动画 · 点击开奇观菜单）
   * ------------------------------------------------------------
   * 今日奇观按**当前地图星球**取（GAME.wonderOf(mapPlanetId)）。.glb 经 gltf.js 极简解析，
   * 几何缓存于 M._wonderGeo[id]（一次解析多次用）。载入失败/无 THREE → 静默缺席（不阻塞地图）。
   * ⚠️ .glb 走 fetch：http 服务下正常；纯 file:// 双击可能被浏览器拦（届时天体缺席，地图不受影响）。
   * ============================================================ */
  M._wonderGeo = M._wonderGeo || {};
  /* base64 → ArrayBuffer（GLB 字节）。 */
  function _wonderB64Buf(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function _wonderPid() {
    var s = GAME.state || {};
    return (s.mapPlanetId != null) ? s.mapPlanetId : (s.activePlanet || 1);
  }
  function buildWonder() {
    var pid = _wonderPid();
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    if (!wd) { if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; M._wonderId = null; } return; }
    if (M._wonderId === wd.id && M._wonderGrp) return;             /* 幂等：同星球同奇观不重建 */
    if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; }
    M._wonderId = wd.id;
    var grp = new THREE.Group();
    M._wonderGrp = grp; M._wonderAngle = 0.6; M._wonderT0 = (GAME.utils && GAME.utils.now ? GAME.utils.now() : Date.now());
    scene.add(grp);
    /* 天体网格：几何缓存/异步载入 */
    function place(geo) {
      if (M._wonderId !== wd.id) return;
      var mode = wd.place || 'space';
      M._wonderMode = mode;
      var mesh = new THREE.Mesh(geo, geo._mat);
      var body = new THREE.Group(); body.add(mesh);
      M._wonderSpin = mesh;                                       /* v91.34：自旋目标 = 几何体本身（绕自身竖轴） */
      if (wd.planetRing) {
        /* v91.44（老板）：「星环套在球体上了，不该与地表接触，建议离地心 2.5 个半径；
           并且星环应在三维空间中相对不动，看着中间球体转动」——
           · **尺寸**：外径 = 2.5R（远在球外，绝不接触地表）。
           · **姿态**：环模型在 Y-Z 平面（轴沿 X）→ 绕 Z 转 90° 后落在 **X-Z 赤道面**，
             且**不另加倾角** —— 水平环对 Y 轴**旋转对称**，相机绕 Y 自转（= 自动"星球自转"）
             时环的**轮廓保持不动**，只有中间球面的地形在转 → 正是"环静、球转"的观感。
           · 位置恒在**球心**；世界坐标不旋转（静态）。 */
        var _r0 = 0.5;
        try {
          geo.computeBoundingBox(); var _bb = geo.boundingBox;
          _r0 = Math.max(Math.abs(_bb.max.y), Math.abs(_bb.min.y), Math.abs(_bb.max.z), Math.abs(_bb.min.z)) || 0.5;
        } catch (e) { }
        mesh.scale.setScalar(R * 2.5 / _r0);
        body.rotation.z = Math.PI / 2;          /* 放平到赤道面（不倾） */
        M._planetRing = true; M._wonderUp = [0, 1, 0]; M._wonderR = 0;
      } else if (mode === 'space') {
        M._planetRing = false;
        mesh.scale.setScalar(R * 0.64);   /* v91.30g：×2 放大 */                          /* 太空天体 R 的 32% */
      } else {
        M._planetRing = false;
        /* 地表/海面：落在星球某格上 —— 贴地(海拔) + 按法线立起 + 按包围盒**底面**坐地。
           v91.38：模型**已由解析器应用节点旋转**（gltf.js 读 nodes[].rotation）→ 标准 **Y-up**，
           故把 **+Y** 对齐球面法线 d（老板「角度颠倒」的根因是解析器漏读节点旋转，非本处对齐）。 */
        var sc = _wonderSurfaceCell(mode, wd.id);
        var d = (sc && sc.dir) ? sc.dir : [0, 1, 0];
        var S = R * 0.30;
        mesh.scale.setScalar(S);
        var tg = new THREE.Group(); tg.add(mesh);
        tg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0], d[1], d[2]).normalize());
        body.add(tg);
        /* 落点：按包围盒 8 角沿法线的最小投影 `low`（< 0 = 有部分在原点之下）反推 ——
           rr = surfR − low + margin → **最低点坐在地表上**。海面给负 margin（半潜入水）。 */
        var surfR = R + Math.max(0, sphElev(d)) * HSC;
        if (mode === 'water') surfR = R + 2.0;                   /* 浮在水面 */
        var low = 0;
        try {
          geo.computeBoundingBox();
          var bb = geo.boundingBox, cs = [];
          for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++)
            cs.push(new THREE.Vector3((xi ? bb.max.x : bb.min.x) * S, (yi ? bb.max.y : bb.min.y) * S, (zi ? bb.max.z : bb.min.z) * S).applyQuaternion(tg.quaternion));
          for (var ci = 0; ci < cs.length; ci++) { var dt2 = cs[ci].x * d[0] + cs[ci].y * d[1] + cs[ci].z * d[2]; if (dt2 < low) low = dt2; }
        } catch (e) { }
        var margin = (mode === 'water') ? -R * 0.015 : 0.6;      /* 陆地贴地 + 微抬；海面略沉（半潜） */
        var rr = surfR - low + margin;
        M._wonderUp = d; M._wonderR = rr;
      }
      /* 名称标签（浮在主体上方）。 */
      var lbl = null;
      try {
        lbl = nameSprite('✨ ' + wd.name, '#ffe6a8');
        if (wd.planetRing) { var _eh = R * 1.15; lbl.position.set(0, _eh, 0); }   /* 星环：标在环外顶（环外径 2.5R） */
        else {
          var _lh = R * (mode === 'space' ? 0.2 : 0.16);
          if (mode === 'space') lbl.position.set(0, _lh, 0);
          else lbl.position.set(d[0] * _lh, d[1] * _lh, d[2] * _lh);
        }
        body.add(lbl);
      } catch (e) { }
      M._wonderBody = body;
      grp.add(body);
      M._wonderLam = lbl;
      wonderStep();   /* 放置后立即定位（否则等自转才移出原点，埋在球里不可见） */
    }
    var geo0 = M._wonderGeo[wd.id];
    if (geo0) { place(geo0); return; }
    if (!GAME.gltf) return;
    function useBytes(ab) {
      if (M._wonderId !== wd.id) return;
      try {
        var parsed = GAME.gltf.parse(ab);
        if (!parsed.parts.length) return;
        var part = parsed.parts[0];
        var geo = GAME.gltf.bakeGeometry(part, THREE, 1);
        geo._mat = GAME.gltf.buildMaterial(THREE, part, function () { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); });
        M._wonderGeo[wd.id] = geo;
        place(geo);
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      } catch (e) { /* 解析失败：静默缺席 */ }
    }
    /* v91.30：**按需注入 base64 模块**（`assets/wonders/<id>.glb.js` 设 window.__WONDER_GLB[id]）——
       双击 file:// 也能出（<script> 不受 fetch 的 CORS 限制），且只加载当前奇观这一个（不拖首屏）。 */
    var gb = window.__WONDER_GLB && window.__WONDER_GLB[wd.id];
    if (gb) { useBytes(_wonderB64Buf(gb)); return; }
    if (!document || !document.createElement) return;
    var sc = document.createElement('script');
    /* v91.38 修复（老板「奇观角度颠倒、颜色糊」）：本 asset 脚本此前**不带 ?v=** →
       index.html bump 后浏览器仍命中**旧缓存**的 .glb.js（旧的 Y-up 朝向 + 512px 糊贴图），
       于是"改了没用"。锚定到 index.html 的构建号（同源同串），随每次 bump 自动失效。
       取法：页面上任一 `?v=NNNN`（js/*.js 由 bump 脚本统一写同号）。 */
    var _bv = 0;
    try {
      var _any = document.querySelector('script[src*="?v="]');
      if (_any) { var _m = /[?&]v=(\d+)/.exec(_any.getAttribute('src') || ''); if (_m) _bv = _m[1]; }
    } catch (e) { }
    sc.src = 'assets/wonders/' + wd.id + '.glb.js' + (_bv ? ('?v=' + _bv) : '');
    sc.onload = function () { var b = window.__WONDER_GLB && window.__WONDER_GLB[wd.id]; if (b) useBytes(_wonderB64Buf(b)); };
    (document.head || document.body || document.documentElement).appendChild(sc);
  }
  /* 地表/海面落点：按 place 在该星球球面找一格（决定论）。water→湖/沼；land→陆地形。 */
  function _wonderSurfaceCell(kind, wid) {
    var SP2 = GAME.mapSphere && GAME.mapSphere.cells ? GAME.mapSphere : (GAME.sphere || null);
    var cells = SP2 && SP2.cells; if (!cells) return null;
    var want = (kind === 'water') ? ['lake', 'zhaoze'] : ['plain', 'caoyuan', 'forest', 'hill', 'desert'];
    /* ============================================================
     * v91.43（老板）：「哪有奇观落在家门口」——**不再锚定出生地附近**，改为
     *   **确定性随机**落在本星球任意一块合适地形上（可能落在球背面）。
     * · 确定性 = 星球种子 × 奇观 id 哈希 → 同一星球·同一奇观**每次落同一格**
     *   （重载/重建不跳位）；奇观按日一换 → 落点随之变，合"奇观常有常新"。
     * · 取"合适地形格集合"里的第 (hash % N) 个：一次 O(nv) 线性扫描（~1ms），
     *   无 BFS、无逐格求距（老版本那个 12 秒死循环不会再回来）。
     * · 无合适地形（如该球无湖）→ 退回"任意非城市格"，保证仍能落位。
     * ============================================================ */
    var seed = (SP2.seed3 ? SP2.seed3() : 0) >>> 0;
    var str = String(wid || '');
    var h = (seed ^ 2166136261) >>> 0;
    for (var si = 0; si < str.length; si++) h = Math.imul(h ^ str.charCodeAt(si), 16777619) >>> 0;   /* FNV-1a */
    var matches = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; if (!c) continue;
      if (want.indexOf(c.type) >= 0) matches.push(c);
    }
    if (!matches.length) {                              /* 回退：任意非城市格（含海/山） */
      for (var j = 0; j < cells.length; j++) { var c2 = cells[j]; if (c2 && c2.type !== 'city') matches.push(c2); }
    }
    if (!matches.length) return null;
    return matches[h % matches.length];
  }
  /* 每 33ms：太空轨行 / 地表·海面微旋 + 出场 scale 动画。 */
  function wonderStep() {
    if (!M._wonderBody || !M._wonderGrp) return;
    var mode = M._wonderMode || 'space';
    if (M._planetRing) {
      /* v91.40 行星环：恒在**球心**（环对称，环面内自旋不可见 → 不转，静置）。 */
      M._wonderBody.position.set(0, 0, 0);
    } else if (mode === 'space') {
      M._wonderAngle = (M._wonderAngle || 0) + 0.004;
      var a = M._wonderAngle, R_W = R * 1.6;
      var dir = [Math.cos(a), 0.22, Math.sin(a)];
      var L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      M._wonderBody.position.set(dir[0] / L * R_W, dir[1] / L * R_W, dir[2] / L * R_W);
    } else {
      /* 地表/海面：位置固定（贴地/入海），绕**自身竖轴**（= 所在处法线 d）慢转（活气）。
         v91.38：模型为 **Y-up**（解析器已应用节点旋转）—— tg 把 +Y 映到法线 d，
         故 `mesh.rotation.y` 即绕 d 自旋。 */
      var d = M._wonderUp || [0, 1, 0];
      var r = M._wonderR || (R + 2);
      M._wonderBody.position.set(d[0] * r, d[1] * r, d[2] * r);
      var mesh = M._wonderSpin;
      if (mesh) mesh.rotation.y += 0.003;
    }
    /* 出场：0.6s 内 scale 0→1（ease-out）。 */
    var t = (Date.now() - (M._wonderT0 || 0)) / 600; if (t > 1) t = 1;
    var e = 1 - Math.pow(1 - t, 3);
    M._wonderBody.scale.setScalar(0.2 + 0.8 * e);
    M._wonderBody.visible = e > 0.02;
  }
  M.wonderStep = wonderStep;
  /* 奇观天体 → 屏幕坐标（相机投影）。返回 {ndcX,ndcY,behind} 或 null。 */
  M.wonderScreen = function () {
    if (!M._wonderBody || !cam) return null;
    var v = new THREE.Vector3().copy(M._wonderBody.position).project(cam);
    return { ndcX: v.x, ndcY: v.y, behind: v.z > 1 };
  };
  M.buildWonder = buildWonder;

  M.rebuild = function () { built = false; _tileSub = -1; M._mkVer = null; M._flVer = null; M._arVer = null;
    M._fogVer = -1;
    /* v91.30：清奇观天体 → 下次 M.render 按当前星球重建。 */
    if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; M._wonderLam = null; } };
})();
