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
import './core.js';
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  /* ============================================================
   * v90.96（老板 · 城市/地图解耦）：**可多实例工厂** —— 同一份拓扑/地形代码可造**多颗球面**：
   *   · GAME.sphere     = **逻辑球面**（当前"经营城"所在星球）—— 城市/建造/科技/募兵/距离 读它；
   *   · GAME.mapSphere  = **地图球面**（地图正在看的星球）—— map3d 渲染/拾取/出征选址 读它。
   * 两者**各带全套可变态**（PLANET / _seedOverride / _seaCache / _built* / _grid / _xyCi / _dArr…），
   * 故切地图星球不碰逻辑球面（城市界面保持）。纯函数（h3/n3/fbm3/icoSpheres…）各实例各一份，无副作用。
   * ============================================================ */
  function makeSphere() {
    var SP = {};

  /* v152：细分**保持 6**（40962 格）。
     老板那句"六边形边在缩小 1 倍"紧接着说的是
     "地块不再高出地表而是全部贴近地形…圆形放射出来的六边形，在地表上切出的边"——
     要的是**六边形贴地、无缝铺满地形**（见下方网格壳改造），不是改格网密度。
     改密度会改动全图距离语义（行军/迷雾/据点间距都按格数算），得不偿失。 */
  /* v153（老板：「看着格子增大了，我想要格子变小」）——
     v152 把 40962 改成了 10242（格子放大一倍），方向反了。退回 **40962**：
     细分 6 = 10×4^6+2 格，每格线性尺寸只有 10242 方案的一半。
     ⚠️ 想再细一档是 sub=7（163842 格），实测构建 5.9s / +360MB，浏览器扛不住 ——
     真要更细，得走"惰性分面生成"，不是改这一个常数。 */
  var SUB = 6;                    /* icosphere 细分（固定）：顶点/地块数 = 10×4^6+2 = 40962 */
  SP.sub = SUB;
  var R = 300;                    /* 星球海平面半径（世界单位） */
  var HSC = 26;                   /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  SP.R = R; SP.HSC = HSC;
  /* 星球规格（单星球）：换参数=换一颗星球的环境（海陆比/山脉/颗粒/气候）。
     v90.81（老板 4）：扩到 L0~L4 分层的完整要素（旧四参 seaFrac/ridge/detail/temp 兼容保留）。*/
  SP.PLANET = {
    seaFrac: 0.45,          /* L1 海洋占比 */
    contCount: 0,           /* L1 大陆数量（0=自然；少=超大陆，多=碎陆 → 气候差极大）*/
    ridge: 1.5,             /* L1 山脉强度 */
    mountain: 'fold',       /* L1 山脉成因：fold 褶皱 / volcano 火山 / block 断块 / impact 撞击 */
    oceanDepth: 1.0,        /* L1 海深剖面（0.4 浅…1.6 深）*/
    temp: 1.0,              /* L2 气候（纬度温差）*/
    tempBands: 3,           /* L2 温度带数量 */
    cloud: 1.0,             /* L2 云量 */
    detail: 0.7,            /* 颗粒细节 */
    /* L0 骨架 */
    radius: 300, spinSec: 60, tilt: 23, atmo: 1.0, starColor: 0xffe6b8, impact: 0,
    /* L3 生态标签（3 轴 + 经典）*/
    ecoNature: '', ecoCiv: '', ecoMood: '', ecoClassic: '',
    /* L4 游戏性 */
    artifact: ''            /* 奇观 */
  };

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
  function seed3() {
    if (SP._seedOverride != null) return SP._seedOverride | 0;      /* v90.73：星球生成器注入的种子 */
    return ((GAME.state && GAME.state.map && GAME.state.map.seed) || 1) | 0;
  }
  SP.seed3 = seed3;
  SP.PLANET_DEFAULT = JSON.parse(JSON.stringify(SP.PLANET));
  /* v90.73（老板 9）：星球生成器 —— 用指定 seed + 参数重建内核（换一颗星球）。
     v90.81：参数**合并**到默认（缺省项沿用默认可选值；可只传部分）。*/
  SP.setPlanet = function (seed, planet) {
    if (seed == null) SP._seedOverride = null; else SP._seedOverride = (seed | 0) || 1;
    var base = JSON.parse(JSON.stringify(SP.PLANET_DEFAULT));
    if (planet) for (var k in planet) { if (planet[k] != null) base[k] = planet[k]; }
    SP.PLANET = base;
    _seaCache = null;                                   /* 海平面随 seed/seaFrac 重算 */
    build(SP.sub);                                      /* 重建（seed 变 → 缓存失效）*/
  };
  var _seaCache = null, _seaSeed = null;
  /* 大陆场（掩膜后）：fbm 大陆 + N 块掩膜。seaLevel 与 sphElev **共用同一份** → 海洋占比才准。 */
  function contField(d, s) {
    var c = fbm3(d, 1.1, s + 11);
    var N = (SP.PLANET && SP.PLANET.contCount) | 0;
    if (N >= 1) { var cm = contMask(d, N, s); c = c * 0.55 + cm * 0.9 - 0.3; }
    return c;
  }
  function seaLevel() {
    var s = seed3();
    var N = (SP.PLANET && SP.PLANET.contCount) | 0;
    var key = s + '|' + N + '|' + ((SP.PLANET && SP.PLANET.seaFrac) || 0.45);
    if (_seaCache != null && _seaSeed === key) return _seaCache;
    /* 各面粗采样估 cont 的均值+标准差 → 海平面 ≈ 均值 + k·σ 使约 seaFrac 的格在海面下。 */
    var sum = 0, sum2 = 0, n = 0;
    for (var f = 0; f < 6; f++) {
      var u0 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][f];
      for (var i = 0; i < 256; i++) {
        var a = (i * 0.618) % 1, b = (i * 0.382 + f * 0.13) % 1;
        var d = [u0[0] + (a - .5) * 2, u0[1] + (b - .5) * 2, u0[2] + ((a + b) - 1)];
        var L = Math.hypot(d[0], d[1], d[2]) || 1; d = [d[0] / L, d[1] / L, d[2] / L];
        var c = contField(d, s); sum += c; sum2 += c * c; n++;
      }
    }
    var mean = sum / n, sd = Math.sqrt(Math.max(1e-6, sum2 / n - mean * mean));
    var sf = (SP.PLANET && SP.PLANET.seaFrac) || 0.45;
    var z = sf < 0.5 ? -(0.5 - sf) * 2.6 : (sf - 0.5) * 2.6;   /* 目标占比→分位数→海平面 */
    _seaCache = mean + z * sd; _seaSeed = key;
    return _seaCache;
  }
  SP.seaLevel = seaLevel;
  /* v90.81（老板 4）：大陆掩膜 —— 取 N 个种子中心方向，靠中心处抬高 → 大约 N 块大陆。
     N<=0 = 自然（纯 fbm，不加掩膜，与旧口径一致）。 */
  function _ctrDir(s, i) {
    var a = h3(i * 7 + 1, i * 13 + 3, s, 991), b = h3(i * 5 + 2, i * 11 + 7, s, 883);
    var z = a * 2 - 1, t = b * 2 * Math.PI, r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(t), z, r * Math.sin(t)];
  }
  function contMask(d, N, s) {
    if (!(N >= 1)) return 0;
    var best = -2;
    for (var i = 0; i < N; i++) {
      var c = _ctrDir(s, i), dt = d[0] * c[0] + d[1] * c[1] + d[2] * c[2];
      if (dt > best) best = dt;
    }
    return (best + 1) / 2;                                /* 0..1（靠中心高）*/
  }
  /* v90.81：山脉成因 —— 不同形态明显不同。
     fold 褶皱（脊状）· volcano 火山（尖峰簇）· block 断块（阶梯平顶）· impact 撞击（陨坑环）*/
  function mountainField(d, type, s, land, P) {
    var ridgeW = (P.ridge == null ? 1.5 : P.ridge);
    if (type === 'volcano') {
      var v = fbm3(d, 3.4, s + 55); v = Math.max(0, v - 0.42); return v * v * 22 * land * ridgeW / 1.5;
    }
    if (type === 'block') {
      var r = 1 - Math.abs(2 * fbm3(d, 2.4, s + 77) - 1);
      r = Math.floor(r * 5) / 5;                           /* 阶梯 → 平顶断块 */
      return r * 4.2 * land * ridgeW / 1.5;
    }
    if (type === 'impact') {
      var q = fbm3(d, 4.2, s + 66);                        /* 撞击：坑 + 环 */
      var ring = Math.abs(Math.sin(q * Math.PI * 3));
      return (1 - ring) * 3.4 * land * ridgeW / 1.5;
    }
    var ridged = 1 - Math.abs(2 * fbm3(d, 2.8, s + 77) - 1);   /* fold 褶皱（默认）*/
    return ridged * ridged * 1.5 * land * 3.2 * ridgeW / 1.5;
  }
  function sphElev(d) {
    var s = seed3();
    var P = SP.PLANET || {};
    var cont = contField(d, s);                           /* 大陆场（含 N 块掩膜；与 seaLevel 同源）*/
    var sea = seaLevel();
    var land = Math.max(0, cont - sea);
    var e = (cont - sea) * 3.0 + mountainField(d, P.mountain || 'fold', s, land, P);
    var det = (fbm3(d, 6.5, s + 191) - 0.5) * 0.5 * land;
    var fine = (fbm3(d, 16.0, s + 331) - 0.5) * 0.35 * land;            /* 高频细节 */
    e = e + det + fine;
    if (e < 0) e *= (P.oceanDepth == null ? 1 : P.oceanDepth);          /* v90.81：海深剖面 */
    return Math.max(-0.6, e);
  }
  SP.sphElev = sphElev;

  /* ============================================================
   * v154 · 地形分类与配色**同源**（老板：「黄黄的一看以为是荒漠，结果一点是森林」）
   * ------------------------------------------------------------
   * 病根：分类（cellType）只看高度+纬度；上色（sphBiome）按另一套高度色带 ——
   * 两条路径算的地区根本不是一回事，于是"看起来是沙漠，点下去是森林"。
   *
   * 现在：**一个格子的样子 = 它的类型**。先算出一个三元组：
   *   temp（温度 0~1，纬度 + 海拔）、moist（湿度 0~1，噪声 + 近水）、alt（海拔 0~1）
   * 由这三样决定类型；同一套阈值反推颜色（见 map3d.climateOf）。
   *
   * 类型与样子（颜色在 map3d 里按类型取基色，再叠一点同类型的明暗噪声）：
   *   山地 hill    高海拔        → 灰岩 / 高处积雪
   *   森林 forest  海拔中 + 湿   → 深绿（黄绿一律不叫森林）
   *   草原 caoyuan 海拔中 + 干   → 黄绿 / 草黄
   *   荒漠 desert  热 + 极干     → 沙黄
   *   平地 plain   低海拔 + 中湿 → 浅土黄（能立城的那种"空地"）
   *   沼泽 zhaoze  低 + 很湿     → 墨绿 / 浑浊青
   *   湖泊 lake    海平面以下     → 深蓝
   * ============================================================ */
  var TYPE_NAME = { lake: '湖泊', zhaoze: '沼泽', plain: '平地', caoyuan: '草原', forest: '森林', desert: '荒漠', hill: '山地' };
  SP.TYPE_NAME = TYPE_NAME;

  /* ============================================================
   * v155 · **地形划分流水线**（老板给的因子表 → 一条有序的推导）
   * ------------------------------------------------------------
   * 因子与它真正影响的东西：
   *
   *   纬度          → 热量带（主导外力：冰/水/风）
   *   海拔          → 温度直减率；植被垂直带；高差决定切割强度
   *   坡度 / 坡向   → 陡坡侵蚀强、难积土（→ 裸岩）；阳坡暖、阴坡湿
   *   距水源距离    → 近水＝沉积/湿润（→ 沼泽、冲积平地）；远水＝风蚀干旱
   *   距海远近 / 风 → 水汽输送：近海湿润、内陆干旱（大陆性）
   *   岩石/土壤     → 硬岩陡峻保留；松软易蚀成丘谷（此处并入"坡度"）
   *   植被覆盖      → 有林固土、裸地加速侵蚀（此处并入"湿度/坡度"反馈）
   *   人类活动      → 属于**玩家**，不在地形生成里
   *
   * 流水线（顺序固定，缺一不可）：
   *   ① 海拔 e            （已有：contField + mountainField + 细节噪声）
   *   ② 距海岸 BFS        （从所有海格一次多源 BFS）
   *   ③ 坡度 = 与邻居的最大高差（归一化）
   *   ④ 气候场：
   *        温度 T = f(纬度) − 海拔直减率
   *        湿度 W = f(噪声, 距海, 距水源, 风带)
   *      **三者都转成"分位数 0~1"** —— 这样类型比例由地类表决定，不看运气。
   *   ⑤ 地类表（按海拔带 → 温度带 → 湿度带 → 坡度 的顺序短路）
   *   ⑥ 连续性平滑：邻域投票（同类邻居不够就并进主流类型）—— 保证"成片"
   *   ⑦ 落库：cells[ci].type（颜色/掉落/场景/立城全部读它）
   *
   * 改比例只改 ⑤ 的数；改"样子"只改 map3d.TERRAIN_RGB。两处不会打架。
   * ============================================================ */
  var TYPE_NAME = { lake: '湖泊', zhaoze: '沼泽', plain: '平地', caoyuan: '草原', forest: '森林', desert: '荒漠', hill: '山地' };
  SP.TYPE_NAME = TYPE_NAME;

  /* 地类表（**唯一**的判定规则；按顺序短路） */
  SP.TERRAIN_RULES = [
    { when: 'sea',                                    id: 'lake',    why: '海平面以下' },
    { when: 'alt > 0.86',                             id: 'hill',    why: '雪线以上裸岩' },
    { when: 'alt > 0.70 && slope > 0.62',             id: 'hill',    why: '陡坡：侵蚀强、积不住土' },
    { when: 'coast <= 1 && wet > 0.55',                id: 'zhaoze',  why: '近水低地：沉积+滞水' },
    { when: 'alt < 0.16 && wet > 0.62',               id: 'zhaoze',  why: '低洼湿地' },
    { when: 'heat > 0.60 && wet < 0.38',              id: 'desert',  why: '热+干（内陆/背风）' },
    { when: 'alt < 0.32 && slope < 0.46 && wet < 0.66', id: 'plain', why: '低平冲积：能立城' },
    { when: 'wet > 0.56',                             id: 'forest',  why: '湿润：成林' },
    { when: 'cold > 0.72',                            id: 'forest',  why: '高纬/高寒：针叶林' },
    { when: '*',                                      id: 'caoyuan', why: '其余：草原' }
  ];

  /* 分位数归一（0~1）：用排序 + 二分，O(n log n)，40k 格无压力 */
  function rank01(vals, idxs) {
    var rank = new Float32Array(vals.length);
    var arr = idxs.map(function (i) { return vals[i]; }).sort(function (a, b) { return a - b; });
    var n = arr.length || 1;
    for (var k = 0; k < idxs.length; k++) {
      var i2 = idxs[k], v = vals[i2], lo = 0, hi = n;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
      rank[i2] = lo / n;
    }
    return rank;
  }

  /* 主流水线：给定顶点/邻接/高程，产出类型数组 */
  SP.buildTerrainTypes = function (V, adj, eArr, emax) {
    var nv = V.length, i;
    var land = [], sea = [];
    for (i = 0; i < nv; i++) { if (eArr[i] >= 0) land.push(i); else sea.push(i); }
    SP._emax = emax || 1;
    if (!land.length) return new Array(nv).fill('lake');

    /* ---- ② 距海岸：从所有海格做一次**多源 BFS**（陆地上的距离；海上为 0） ---- */
    var coast = new Int16Array(nv); coast.fill(999);
    var q = sea.slice(), head = 0;
    for (i = 0; i < q.length; i++) coast[q[i]] = 0;
    while (head < q.length) {
      var cur = q[head++], an = adj[cur];
      for (var j = 0; j < an.length; j++) {
        var nb = an[j];
        if (coast[nb] > coast[cur] + 1) { coast[nb] = coast[cur] + 1; q.push(nb); }
      }
    }

    /* ---- ③ 坡度：与邻居的最大高差（按全星高差归一） ---- */
    var slopeRaw = new Float32Array(nv), dmax = 0.01;
    for (i = 0; i < nv; i++) {
      var an2 = adj[i], m = 0;
      for (var j2 = 0; j2 < an2.length; j2++) {
        var d2 = Math.abs(eArr[i] - eArr[an2[j2]]);
        if (d2 > m) m = d2;
      }
      slopeRaw[i] = m; if (m > dmax) dmax = m;
    }
    for (i = 0; i < nv; i++) slopeRaw[i] = slopeRaw[i] / dmax;

    /* ---- ④ 气候场（温度/湿度/海拔/距海），再统一转分位 ---- */
    var P = SP.PLANET || {}, s = seed3();
    var altRaw = new Float32Array(nv), heatRaw = new Float32Array(nv), wetRaw = new Float32Array(nv);
    for (i = 0; i < nv; i++) {
      var dd = V[i], e3 = Math.max(0, eArr[i]);
      var alt = e3 / (emax || 1);
      altRaw[i] = alt;
      /* 温度：先看纬度（热量带），再按海拔直减（每升一档更冷） */
      var lat = Math.abs(dd[1]);
      heatRaw[i] = (1 - lat * lat) * (P.temp == null ? 1 : P.temp) - alt * 0.55;
      /* 湿度：① 噪声（季风/地形雨） ② 离海越远越干 ③ 风带（信风带干、西风带湿） */
      var m1 = fbm3(dd, 2.0, s + 811), m2 = fbm3(dd, 5.1, s + 977);
      var wind = 0.5 + 0.22 * Math.sin(dd[1] * Math.PI * 2.2);     /* 纬度风带 */
      var sea7 = Math.min(1, (coast[i] || 0) / 14);                /* 距海归一（14 格外算内陆） */
      wetRaw[i] = (m1 * 0.55 + m2 * 0.25 + wind * 0.20) - sea7 * 0.55 - alt * 0.10;
    }
    var altN = rank01(altRaw, land);
    var heatN = rank01(heatRaw, land);
    var wetN = rank01(wetRaw, land);
    var slopeN = rank01(slopeRaw, land);

    /* ---- ⑤ 地类表 ---- */
    var typ = new Array(nv);
    for (i = 0; i < nv; i++) typ[i] = 'lake';
    for (var li = 0; li < land.length; li++) {
      var ci = land[li], alt2 = altN[ci], heat = heatN[ci], wet = wetN[ci], sl = slopeN[ci], cst = coast[ci];
      var id = 'caoyuan';
      if (alt2 > 0.86) id = 'hill';
      else if (alt2 > 0.70 && sl > 0.62) id = 'hill';
      else if (cst <= 1 && wet > 0.55) id = 'zhaoze';
      else if (alt2 < 0.16 && wet > 0.62) id = 'zhaoze';
      else if (heat > 0.50 && wet < 0.42) id = 'desert';
      else if (alt2 < 0.42 && sl < 0.58 && wet < 0.74) id = 'plain';
      else if (wet > 0.56) id = 'forest';
      else if (heat < 0.28) id = 'forest';       /* 高寒针叶林 */
      typ[ci] = id;
    }

    /* ---- ⑥ 连续性平滑：同类邻居不够 → 并进邻居里的主流类型（迭代 2 轮） ---- */
    var PRI = { hill: 5, forest: 4, plain: 4, caoyuan: 3, desert: 2, zhaoze: 2, lake: 0 };
    for (var iter = 0; iter < 2; iter++) {
      var next = typ.slice();
      for (var li2 = 0; li2 < land.length; li2++) {
        var c2 = land[li2], nbs = adj[c2], same = 0, cnt = {};
        for (var k2 = 0; k2 < nbs.length; k2++) {
          var t2 = typ[nbs[k2]];
          if (t2 === typ[c2]) same++;
          cnt[t2] = (cnt[t2] || 0) + 1;
        }
        if (same >= 2) continue;                 /* v155b：阈值 3→2（平地太薄，会被整片吃掉） */
        var bestT = typ[c2], bestN = -1;
        for (var kk in cnt) {
          if (cnt[kk] > bestN || (cnt[kk] === bestN && (PRI[kk] || 0) > (PRI[bestT] || 0))) { bestN = cnt[kk]; bestT = kk; }
        }
        next[c2] = bestT;
      }
      typ = next;
    }
    /* 落库到每个格（颜色/掉落/场景都读这里） */
    SP._terr = { coast: coast, slope: slopeN, alt: altN, heat: heatN, wet: wetN };
    return typ;
  };

  /* 兼容旧签名（外部只用来"看一眼"某格是什么地形；真正的判定在流水线里） */
  function cellType(e, dy, emax, dir) {
    if (e < 0) return 'lake';
    try {
      var ci = (dir && SP.nearestCell) ? SP.nearestCell(dir) : -1;
      if (ci >= 0 && SP.cells && SP.cells[ci] && SP.cells[ci].type) return SP.cells[ci].type;
    } catch (e0) { }
    return 'caoyuan';
  }
  SP.cellType = cellType;

  /* ============================================================
   * v155k · cube-sphere 六面参数化 + **绕向判定**（几何唯一约定）
   * ------------------------------------------------------------
   * 老板「球体上有明显的直线分界」→「球体变成透明的了」的根因链：
   *   · 六个面**分开参数化**，其中几个面是镜像的 → 三角形的**绕向**有正有反；
   *   · 渲染改成 FrontSide 后，绕向反的面被背面剔除（直线分界 / 整球透明）。
   * 约定写在这里（sphere.js 是地形几何的唯一事实源），渲染层只消费：
   *   `SP.faceFlipOf(fn, du)` → true = 这个面的索引顺序要翻转
   * 判定方法：按**实际压入的三角形顺序** (a, c, b) 求法线，
   * 与面中心方向点乘，朝里就要翻。
   * ⚠️ 第一版判定用了 (b-a)×(c-a) —— 与实际顺序正好反号 → 六个面全被翻 → 整球透明。
   * ============================================================ */
  SP.CUBE_FACES = [
    function (u, v) { return [1, v, u]; }, function (u, v) { return [-1, v, -u]; },
    function (u, v) { return [u, 1, -v]; }, function (u, v) { return [u, -1, v]; },
    function (u, v) { return [u, v, 1]; }, function (u, v) { return [-u, v, -1]; }
  ];
  /* du = 一个格子对应的参数步长；用 (a, c, b) 的叉积（= 索引 push 的顺序） */
  SP.faceFlipOf = function (fn, du) {
    if (!fn || !(du > 0)) return false;
    var a = fn(-1, -1), c = fn(-1, -1 + du), b = fn(-1 + du, -1);
    var e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];      /* a → c */
    var e2 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];      /* a → b */
    var n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    var m = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
    return (n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) < 0;
  };

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
  var _builtSub = -1, _builtSeed = null, _builtPver = null;
  function build(sub) {
    sub = sub == null ? SUB : sub;
    var sd = seed3();
    var pver = JSON.stringify(SP.PLANET);            /* v90.81：参数变（同 seed）也要重建 */
    if (SP.cells && _builtSub === sub && _builtSeed === sd && _builtPver === pver) return SP;
    /* v91.30h（性能）：**同种子兄弟球复用**（mapSphere 与逻辑球面同星球时，地形/几何完全一致）——
       直接共享对方已建的只读大数组（cells/V/F/cent/adj/upos/fpos/faceCell…），
       免掉第二遍 40962 格噪声（~500ms）。内容同种子确定 → 无副作用。 */
    var _twin = (GAME.sphere && GAME.sphere !== SP && GAME.sphere.cells && GAME.sphere._bSub === sub
      && GAME.sphere._bSeed === sd && GAME.sphere._bPver === pver) ? GAME.sphere
      : ((GAME.mapSphere && GAME.mapSphere !== SP && GAME.mapSphere.cells && GAME.mapSphere._bSub === sub
        && GAME.mapSphere._bSeed === sd && GAME.mapSphere._bPver === pver) ? GAME.mapSphere : null);
    if (_twin) {
      SP.cells = _twin.cells; SP.V = _twin.V; SP.F = _twin.F; SP.cent = _twin.cent; SP.adj = _twin.adj;
      SP.upos = _twin.upos; SP.fpos = _twin.fpos; SP.faceCell = _twin.faceCell; SP.nv = _twin.nv;
      SP.vf = _twin.vf; SP.meanLand = _twin.meanLand; SP.shellH = _twin.shellH; SP.shellR = _twin.shellR;
      _builtSub = sub; _builtSeed = sd; _builtPver = pver; SP._bSub = sub; SP._bSeed = sd; SP._bPver = pver;
      /* ⛔ v139：复用兄弟球的数组时**也必须清坐标缓存** ——
         `_xyCi` 是每个球面自己的记忆，里面可能存着"这台球还没建好时算出的 -1"。
         实测：newGame 里 mapSphere 走了复用分支、缓存没清，
         之后 `ciOfXY(265,215)` 一直返回 -1 → 建出来的 NPC 城 ci 全是 -1
         → 城全叠在第 0 格、地形判定全错。 */
      _xyCi = null; _grid = null;
      return SP;
    }
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
    SP._emax = emax;                                  /* 分类与配色共用的归一尺 */
    for (vi = 0; vi < nv; vi++) { V[vi]._e = eArr[vi]; lvl[vi] = -1; }
    /* v155：类型**整批**由流水线产出（距海/坡度/湿度分位/地类表/连续性平滑）——
       逐格调 cellType 拿不到邻域信息，无法保证"成片"。 */
    typ = SP.buildTerrainTypes(V, adj, eArr, emax);
    /* v90.71（老板 10）：**网格浮起成球壳** —— 六边网格铺在一个**平均海拔半径**的球面上
       （构成包裹球系的完球体）；地形/建筑高于该半径的部分自然**穿出网格**。
       shellH = shellFrac × 平均陆地高程 × HSC（距球心高度）。 */
    var _msum = 0, _mcnt = 0;
    for (vi = 0; vi < nv; vi++) { var _le = eArr[vi]; if (_le >= 0) { _msum += _le; _mcnt++; } }
    var _meanLand = _mcnt ? _msum / _mcnt : 0;
    /* 地块壳半径 = R + shellFrac × 平均陆地高程 × HSC。shellFrac=1 → 恰在平均海拔面上；
       取略大于 1 让它**浮在平均面之上**（地形/建筑高于此者穿出网格）。可调 SP.shellFrac。 */
    /* v152（老板：「地块不再高出地表，而是全部贴近地形 —— 圆形放射出来的六边形，
       在地表上切出的边，本质上是等边六边形，只是地形变化导致边扭曲」）：
       网格线框**不再统一浮在平均海拔球壳上**（那会变成"套在球外面的一层铁丝笼"），
       而是每一格**按自己的地形高度**投到地表 —— 网格成了贴在地形上的六边形纹路，
       地形起伏时边自然被拉弯。抬升只留 0.25（z-fighting 余量）。 */
    var _shellH = 0;
    var _shellR = R;
    SP.meanLand = _meanLand; SP.shellH = _shellH; SP.shellR = _shellR;
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
    var upos = [], uposCell = [], fpos = [], cells = [], off = 0;
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    /* ============================================================
     * v154（老板：「地块紧贴地形，而不是高于地形一定距离」）
     * ------------------------------------------------------------
     * 改前：地块顶点 = R + 地形高度×HSC（最高 +2 个单位），于是整片六边形**浮在地表之上**，
     * 与底下的地形网格形成"两层壳"，侧看就是重影/悬空。
     * 现在：地块 = **海平面 + 极薄一层**（0.15），地形起伏由底下的地形面自己表现；
     * 六边形是"地表上的纹路"，不是"盖在球上的一层板"。
     * ============================================================ */
    /* v154e：地块"紧贴地形" —— 几何上只离 0.05（几乎重合），
       看得见靠的是线框材质的 **polygonOffset**（往镜头方向拉一点深度），
       而不是把整块六边形抬高成"桌面"。 */
    var PLATEAU = 0.05;
    /* 跟随地形，但只离地 0.15（原来 0.5 → 现在几乎贴着；压平到海平面会让网格沉进地下）。 */
    function terrainR(d) { return R + Math.max(0, sphElev(d)) * HSC + PLATEAU; }
    for (var vs in vf) {
      vi = +vs; var n = V[vi], fs = vf[vs];
      if (fs.length < 3) continue;
      var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var tx = cross(up, n), tl = Math.hypot(tx[0], tx[1], tx[2]); tx = [tx[0] / tl, tx[1] / tl, tx[2] / tl];
      var ty2 = cross(n, tx);
      fs.sort(function (A, B) { var cA = cent[A], cB = cent[B]; return Math.atan2(dot(cA, ty2), dot(cA, tx)) - Math.atan2(dot(cB, ty2), dot(cB, tx)); });
      var rn = terrainR(n), P = [n[0] * rn, n[1] * rn, n[2] * rn];      /* 顶点坐在地形高度上（拾取碰撞体用）*/
      var mm = fs.length, RIM = [], RIM_UI = [];
      /* ============================================================
       * v154（老板：「地块紧贴地形，而不是高于地形一定距离」）
       * ------------------------------------------------------------
       * 面（拾取/地皮）逐顶点贴地形：已知。
       * 线框原来按**每个角点自己的**地形高度抬 0.25 —— 起伏大的地方，
       * 同一条边在两格各算一次、高度不同 → 视觉上出现两条错开的边（重影）。
       * 现在：角点高度 = **相邻几格地形高度的平均**（同一条边两侧算出的值相同），
       * 只抬 0.12 做 z-fight 余量 → 边压在地形上、并且**不会重影**。
       * ============================================================ */
      var _lift = 0.05;
      for (var i3 = 0; i3 < mm; i3++) { var cc3 = cent[fs[i3]], rr3 = terrainR(cc3); RIM.push([cc3[0] * rr3, cc3[1] * rr3, cc3[2] * rr3]); }
      /* 用「顶点位置(取整) → 高度」的全局表求平均：同一条边两侧共享同一批采样点 */
      if (!SP._rimHMap) SP._rimHMap = {};
      for (var e2 = 0; e2 < mm; e2++) {
        var s1c = cent[fs[e2]], s2c = cent[fs[(e2 + 1) % mm]];
        var k1 = [Math.round(s1c[0] * 1000), Math.round(s1c[1] * 1000), Math.round(s1c[2] * 1000)].join(',');
        var k2 = [Math.round(s2c[0] * 1000), Math.round(s2c[1] * 1000), Math.round(s2c[2] * 1000)].join(',');
        if (SP._rimHMap[k1] == null) SP._rimHMap[k1] = sphElev(s1c);
        if (SP._rimHMap[k2] == null) SP._rimHMap[k2] = sphElev(s2c);
        /* v154：线框跟随地形，但用**共享的顶点高度表**（同一条边两侧算出同一个值 → 无重影），
           只比面高 0.05 做 z-fight 余量。 */
        var r1 = R + Math.max(0, SP._rimHMap[k1]) * HSC + PLATEAU + _lift;
        var r2 = R + Math.max(0, SP._rimHMap[k2]) * HSC + PLATEAU + _lift;
        upos.push(s1c[0] * r1, s1c[1] * r1, s1c[2] * r1, s2c[0] * r2, s2c[1] * r2, s2c[2] * r2);
        /* v92：线框**逐段归属格**（与 upos 同步 push，一条线一个 ci）。
           map3d 用它在未探明区域把线框染黑 —— 否则线框球壳会从雾面里穿出来，
           暗区满屏白点（实测截图确认）。 */
        uposCell.push(vi);
      }
      var dep = lvl[vi] < 0 ? 0 : lvl[vi];
      var lv = 6 + Math.min(4, dep);                       /* 6~10 级：中央(离异类边界远)高、边缘低 */
      for (var t2 = 0; t2 < mm; t2++) {
        var s1 = RIM[t2], s2 = RIM[(t2 + 1) % mm];
        fpos.push(P[0], P[1], P[2], s1[0], s1[1], s1[2], s2[0], s2[1], s2[2]);
      }
      /* 球系坐标（经纬度）。⚠️ 平面格坐标 x/y 为过渡遗留。*/
      var lonDeg = (Math.atan2(n[2], n[0]) * 180 / Math.PI + 360) % 360;
      var latDeg = Math.asin(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI;
      /* 平面格坐标 x/y：**仅供旧口径过渡**（拾取/行政城/前哨落位经它反查 ci）。
         ⚠️ 必须与 SP.lonLatOfXY 严格互逆 —— 北在 y 小（0.5 - lat/180）。
         曾用 (lat/180+0.5)（北→大 y）与反查符号相反 → 3D 拾取→筑城**纬度翻面**（已修）。*/
      var cgx = Math.round(lonDeg / 360 * mw()) % mw();
      var cgy = Math.round((0.5 - latDeg / 180) * mh()) % mh();
      cells[vi] = { dir: n, pos: P, rim: RIM, type: typ[vi], name: TYPE_NAME[typ[vi]], level: lv, e: n._e,
        off: off, nt: mm, lon: lonDeg, lat: latDeg,
        x: ((cgx % mw()) + mw()) % mw(), y: ((cgy % mh()) + mh()) % mh() };
      off += mm;
    }
    var faceCell = new Int32Array(fpos.length / 9);
    for (var c2 in cells) if (cells[c2]) for (var j2 = 0; j2 < cells[c2].nt; j2++) faceCell[cells[c2].off + j2] = +c2;

    SP.V = V; SP.F = F; SP.cent = cent; SP.adj = adj; SP.cells = cells;
    SP.upos = upos; SP.uposCell = uposCell; SP.fpos = fpos; SP.faceCell = faceCell; SP.nv = nv;
    _builtSub = sub; _builtSeed = sd; _builtPver = pver; SP._bSub = sub; SP._bSeed = sd; SP._bPver = pver;
    SP.sub = sub;
    _grid = null;                                    /* 空间哈希随之失效（V 已换）*/
    _xyCi = null;                                    /* (x,y)→ci 记忆随之失效（地形已换）*/
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
    /* v152：格网只认当前 SUB（老档 sub=6 的 40962 格不能铺新格网）；
       旧记录的 ci 由 `GAME.migrateSphereSub` 按经纬重落。 */
    build(SUB);                                       /* 建骨架（几何/邻接）；随后覆盖地形 */
    var cs = SP.cells, src = blob.cells;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], b = src[i];
      if (c && b) { c.type = b.type; c.level = b.level; c.e = b.e; }
    }
    SP.TYPE_NAME = TYPE_NAME;
    return true;
  };

  /* 方向 → 最近格索引（0..nv-1）· **空间哈希加速**（v90.76：供平面投影/距离大量查询）。 */
  var _grid = null, _GS = 0.04;
  function _gkey(d) { return Math.floor(d[0] / _GS) + ',' + Math.floor(d[1] / _GS) + ',' + Math.floor(d[2] / _GS); }
  function _buildGrid() {
    _grid = {}; var v = SP.V, n = v.length;
    for (var i = 0; i < n; i++) { var d = v[i]; if (!d) continue; var k = _gkey(d); (_grid[k] = _grid[k] || []).push(i); }
  }
  function nearestCell(dir) {
    var v = SP.V; if (!v) return -1;
    if (!_grid) _buildGrid();
    var ix = Math.floor(dir[0] / _GS), iy = Math.floor(dir[1] / _GS), iz = Math.floor(dir[2] / _GS);
    var best = -1, bd = -2;
    for (var R = 0; R <= 3; R++) {
      for (var dx = -R; dx <= R; dx++) for (var dy = -R; dy <= R; dy++) for (var dz = -R; dz <= R; dz++) {
        if (R > 0 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== R) continue;   /* 只扫第 R 层壳 */
        var arr = _grid[(ix + dx) + ',' + (iy + dy) + ',' + (iz + dz)];
        if (!arr) continue;
        for (var j = 0; j < arr.length; j++) { var c = v[arr[j]]; var dt = c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2]; if (dt > bd) { bd = dt; best = arr[j]; } }
      }
      if (best >= 0 && R >= 1) break;   /* 至少扫到 1 层壳（含对角近邻）后即信任 */
    }
    if (best < 0) {                     /* 兜底：全扫（极罕见） */
      for (var i = 0; i < v.length; i++) { var d = v[i]; if (!d) continue; var t2 = d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2]; if (t2 > bd) { bd = t2; best = i; } }
    }
    return best;
  }
  SP.nearestCell = nearestCell;

  /* 经纬 → 单位球方向（与 map3d 一致） */
  SP.dirOfLonLat = function (lon, lat) {
    var a = lat * Math.PI / 180, b = lon * Math.PI / 180, cl = Math.cos(a);
    return [cl * Math.cos(b), Math.sin(a), cl * Math.sin(b)];
  };
  /* ============================================================
   * v92.247（老板）：「给星球定一个南北极，适配上下左右按键。现在是乱走的」
   * ------------------------------------------------------------
   * **南北极是唯一的，就在 +Y 轴上** —— 这不是新规矩，而是既有口径的显式化：
   *   `dirOfLonLat` = [cosφcosλ, sinφ, cosφsinλ] → 纬度 φ 是 asin(y)，
   *   即 +Y = 北极、−Y = 南极；经度 λ = atan2(z, x)（+X 为 0°，+Z 为 90°）。
   *   （`PLANET.tilt` 是**轴倾角设定**，渲染里未施加旋转，所以视觉北极也就是 +Y。）
   *
   * **为什么"乱走"**：旧的方向键是在"经纬差"上判方位
   *   （`dLon = ((nc.lon - pc.lon + 540) % 360) - 180; dLat = ...`）——
   *   · 靠近两极时经度线收拢，正北的邻格能算出 dLon=180 → 被叫成"东/西"；
   *   · 复合名"东北"同时含"北"和"东"，上键与右键抢同一个邻格；
   *   · 匹配不到时回落 `nbs[0]`（排序后的第一个）→ 按左键却往北走。
   * 正解：在**该格自己的切平面**里量"到北极的方位角"，
   *   0°=北、90°=东、180°=南、270°=西，按最小夹角取邻格 —— 极点附近也成立。
   * ============================================================ */
  SP.NORTH = [0, 1, 0];                     /* 星球北极方向（球系坐标） */
  /* 某点处的切平面基：up = 指向北极的切向，east = 向东的切向（n × up）。*/
  SP.tangentOf = function (dir) {
    var n = dir;
    var N = SP.NORTH;
    var d = n[0] * N[0] + n[1] * N[1] + n[2] * N[2];
    var up = [N[0] - n[0] * d, N[1] - n[1] * d, N[2] - n[2] * d];
    var ul = Math.hypot(up[0], up[1], up[2]);
    if (ul < 1e-6) {
      /* 正好站在极点上：切平面里"北"无定义，任取一条经线方向当北，
         保证"左右"仍然绕极轴转、"上下"沿那条经线走。 */
      var ref = Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
      up = [ref[0] - n[0] * (ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2]),
            ref[1] - n[1] * (ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2]),
            ref[2] - n[2] * (ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2])];
      ul = Math.hypot(up[0], up[1], up[2]) || 1;
    }
    up = [up[0] / ul, up[1] / ul, up[2] / ul];
    /* east = n × up：在赤道 n=(1,0,0)、up=(0,1,0) 时得 (0,0,1)，
       与"经度 λ=atan2(z,x) 向东增大"一致。 */
    var east = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]];
    return { up: up, east: east };
  };
  /* 从 fromCi 看 toCi 的方位角（度 · 0=北 90=东 180=南 270=西 · 顺时针）*/
  SP.bearingOf = function (fromCi, toCi) {
    var a = SP.cellOf(fromCi), b = SP.cellOf(toCi);
    if (!a || !b || !a.dir || !b.dir) return null;
    var T = SP.tangentOf(a.dir);
    var t = [b.dir[0] - a.dir[0], b.dir[1] - a.dir[1], b.dir[2] - a.dir[2]];
    var l = Math.hypot(t[0], t[1], t[2]);
    if (l < 1e-9) return null;
    t = [t[0] / l, t[1] / l, t[2] / l];
    var nE = t[0] * T.east[0] + t[1] * T.east[1] + t[2] * T.east[2];
    var nN = t[0] * T.up[0] + t[1] * T.up[1] + t[2] * T.up[2];
    var deg = Math.atan2(nE, nN) * 180 / Math.PI;
    return (deg + 360) % 360;
  };
  /* 方位角 → 八向中文名（与 bearingOf 同一把尺，极区也不会串）*/
  SP.dirNameOfBearing = function (deg) {
    if (deg == null) return '';
    var names = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  };
  /* 方向键 → 方位角（度）。keys: up/down/left/right（WASD 同义）*/
  /* 键名一律小写比对（`ev.key.toLowerCase()`）：arrowup / w 都算"北" */
  SP.KEY_BEARING = {
    arrowup: 0, up: 0, w: 0,
    arrowright: 90, right: 90, d: 90,
    arrowdown: 180, down: 180, s: 180,
    arrowleft: 270, left: 270, a: 270
  };
  /* 球面地形查询（按世界格坐标 x,y）—— **地形判据的唯一出口**（所见即所得）。
     世界格 → 经纬（与 GAME.map.lonlatOf 同一映射）→ 最近六边格 → 该格球面地形。
     逻辑层（占领记录/建城判据/建城按钮）读它，永不读平面 s.map.grid。 */
  SP.terrainAt = function (worldX, worldY) {
    if (!SP.cells || worldX == null || worldY == null) return null;
    var ci = SP.ciOfXY(worldX, worldY);
    var c = SP.cellOf(ci);
    return c ? { ci: ci, type: c.type, level: c.level } : null;
  };
  /* 格索引 → 经纬 */
  SP.dirOf = function (ci) { var c = SP.cells && SP.cells[ci]; return c ? c.dir : null; };
  /* ============================================================
   * 球系坐标唯一映射（SSOT）：平面世界格 (x,y) ↔ 经纬 (lon,lat)。
   * 北在 y=0（纬度向上为正）。反查 ciOfXY / 界面 coordText / 地图定位
   * mapGoto **全走这两个纯函数**，勿再各写一份。
   * ⚠️ 历史 bug 根因：生成 cell.x/y 曾用 (lat/180+0.5)（北→大 y），
   *    反查用 (0.5-lat/180)（北→小 y），正负相反 → 拾取→存档→渲染**纬度翻面**。
   * ============================================================ */
  SP.lonLatOfXY = function (x, y) {
    var W = mw(), H = mh();
    return { lon: ((x / W) * 360 + 360) % 360, lat: (0.5 - y / H) * 180 };
  };
  SP.xyOfLonLat = function (lon, lat) {
    var W = mw(), H = mh();
    return { x: ((Math.round(lon / 360 * W) % W) + W) % W, y: ((Math.round((0.5 - lat / 180) * H) % H) + H) % H };
  };
  /* ci（唯一身份）↔ 单元格对象 */
  SP.cellOf = function (ci) { return (SP.cells && ci >= 0 && ci < SP.cells.length) ? SP.cells[ci] : null; };

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
  /* ============================================================
   * v94.1：**便宜的距离**（用经纬度近似，O(1)）
   * ------------------------------------------------------------
   * 起因：hexDist 是一次 BFS（无缓存）。单次调用很便宜，
   *   但在"每座城 × 每个村社"这种双重循环里就是 25000 次 BFS ——
   *   smoke §v89.107 的 100 城 tickOnce 直接飙到 271ms。
   *
   * 用途边界（必须守住）：
   *   · 只用于"挑最近的目标 / 判断是否在附近"这类**筛选用途**；
   *   · 任何要显示给玩家的距离、任何驱动数值的距离，仍然走 hexDist。
   * ============================================================ */
  var _degPerCell = 0;
  SP.degPerCell = function () {
    if (_degPerCell) return _degPerCell;
    var nv = SP.nv || (SP.cells && SP.cells.length) || 6000;
    _degPerCell = Math.sqrt(4 * Math.PI / nv) * 180 / Math.PI;
    return _degPerCell;
  };
  SP.roughDistOf = function (e1, e2) {
    var c1 = (e1 && e1.ci != null) ? SP.cellOf(e1.ci) : null;
    var c2 = (e2 && e2.ci != null) ? SP.cellOf(e2.ci) : null;
    if (!c1 || !c2 || c1.lon == null || c2.lon == null) return 9999;
    if (e1.ci === e2.ci) return 0;
    var dLon = Math.abs(c1.lon - c2.lon);
    if (dLon > 180) dLon = 360 - dLon;
    var dLat = Math.abs(c1.lat - c2.lat);
    var mid = (c1.lat + c2.lat) / 2 * Math.PI / 180;
    var deg = Math.sqrt(dLon * dLon * Math.cos(mid) * Math.cos(mid) + dLat * dLat);
    return deg / SP.degPerCell();
  };
  /* 与某格相距 ≤hops 环的全部格（含自身）—— 据点保护区 / 半径族用。 */
  SP.hopsWithin = function (ci, hops) {
    var adj = SP.adj, nv = SP.nv, out = [];
    if (!adj || ci < 0 || ci >= nv || hops < 0) return out;
    if (!_dArr) { _dArr = new Int32Array(nv); _dStamp = new Int32Array(nv); }
    var stamp = ++_dVer, q = [ci], head = 0; _dArr[ci] = 0; _dStamp[ci] = stamp; out.push(ci);
    while (head < q.length) {
      var cur = q[head++], d = _dArr[cur] + 1; if (d > hops) break;
      var an = adj[cur];
      for (var i = 0; i < an.length; i++) { var nb = an[i]; if (_dStamp[nb] !== stamp) { _dStamp[nb] = stamp; _dArr[nb] = d; q.push(nb); out.push(nb); } }
    }
    return out;
  };
  /* 世界格坐标 → 六边格索引（地形查询同一映射）。带 memo（nearestCell 为 O(nv)，
     行军距离预览等会重复问同一点）。*/
  var _xyCi = null;
  SP.ciOfXY = function (worldX, worldY) {
    if (!SP.cells || worldX == null || worldY == null) return -1;
    var ll = SP.lonLatOfXY(worldX, worldY);
    if (!_xyCi) _xyCi = {};
    var key = worldX + ',' + worldY;
    var v = _xyCi[key];
    if (v === undefined) {
      v = nearestCell(SP.dirOfLonLat(ll.lon, ll.lat));
      /* v139：**查不到（-1）不写进缓存** —— 缓存一个失败结果等于永久判死：
         球面还没建好时的第一次查询会把 -1 钉死，之后哪怕球面建好了也一直返回 -1。 */
      if (v >= 0) _xyCi[key] = v;
    }
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

  /* ============================================================
   * v90.81（老板 4）：**星球体检报告** + **自动生态标签** + **自动奇观**。
   * 生成星球后即时计算（不缓存，按当前 cells 现算）。
   * ============================================================ */
  var _NAT = [['lake', '以水为主'], ['zhaoze', '以水为主'], ['desert', '以地貌为主'],
    ['hill', '以地貌为主'], ['forest', '以生命为主'], ['caoyuan', '以生命为主']];
  SP.ecoNatureOf = function () {
    var cnt = {}, tot = 0;
    for (var i = 0; i < SP.cells.length; i++) { var c = SP.cells[i]; if (c) { cnt[c.type] = (cnt[c.type] || 0) + 1; tot++; } }
    var mx = '', mn = -1; for (var k in cnt) if (cnt[k] > mn) { mn = cnt[k]; mx = k; }
    var nat = '以水为主';
    _NAT.forEach(function (p) { if (p[0] === mx) nat = p[1]; });
    var domCell = { lake: '海洋世界', desert: '沙丘之海', hill: '台地方山', forest: '丛林世界', caoyuan: '草原世界', plain: '群岛世界', zhaoze: '沼泽湿地' };
    return { nature: nat, dominant: domCell[mx] || '未知', domKey: mx, landPct: Math.round((1 - (cnt.lake || 0) / tot) * 100) };
  };
  SP.report = function () {
    if (!SP.cells || !SP.cells.length) return null;
    var cnt = {}, tot = 0, eMax = 0.01, hillN = 0;
    for (var i = 0; i < SP.cells.length; i++) { var c = SP.cells[i]; if (!c) continue; cnt[c.type] = (cnt[c.type] || 0) + 1; if (c.e > eMax) eMax = c.e; if (c.type === 'hill') hillN++; tot++; }
    var land = tot - (cnt.lake || 0), P = SP.PLANET || {};
    var plainPct = (cnt.plain || 0) / tot, seaPct = (cnt.lake || 0) / tot, domHill = hillN / tot;
    var habit = Math.round(Math.max(0, Math.min(100, 40 + plainPct * 300 - domHill * 120 - Math.abs(seaPct - 0.4) * 120)));
    var colon = Math.round(Math.max(0, Math.min(100, (land / tot) * 100 + plainPct * 80)));
    var danger = Math.round(Math.max(0, Math.min(100, domHill * 260 + (P.impact || 0) * 30 + (P.mountain === 'volcano' ? 25 : 0))));
    var res = Math.round(Math.max(0, Math.min(100, plainPct * 200 + domHill * 90 + (cnt.desert || 0) / tot * 120)));
    var note = habit >= 60 ? '温润宜居，移民乐土。' : (danger >= 60 ? '凶险异常，非精锐不可涉足。' : (res >= 60 ? '矿藏丰饶，值得开采。' : '中规中矩的一颗星。'));
    return { habit: habit, colon: colon, danger: danger, res: res, note: note, landPct: Math.round((land / tot) * 100), eMax: eMax };
  };
  var _ART = ['戴森残片', '上古神殿', '陨落母舰', '巨构水晶', '沉没方舟', '千柱圣殿', '坠星峡谷', '永动熔炉'];
  SP.artifactOf = function () {
    var re = SP.report(); if (!re) return '无名奇观';
    return _ART[(SP.seed3() + Math.round(re.danger)) % _ART.length];
  };
    return SP;
  }

  GAME.createSphere = makeSphere;
  GAME.sphere = makeSphere();       /* 逻辑球面（当前"经营城"所在星球）—— 城市/建造/科技/距离 读它 */
  GAME.mapSphere = makeSphere();    /* 地图球面（地图在看/渲染/出征选址）—— map3d 读它；切地图星球不碰逻辑球面 */
})();
