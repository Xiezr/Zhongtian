/* ============================================================
 * js/belt.js — **陨石带 / 轨道系**
 * ------------------------------------------------------------
 * 老板：「在星球周围生成陨石带。后续发展星际采矿，将陨石带生成加入到星球生成器当中。」
 *
 * 设计原则（与本项目其它生成器一致）：
 *   ① **确定性**：同 (seed, spec) → 同一条带。因此**不必进存档** —— 读档时按
 *      planet.params.belt 重算即得，存档体积零增长，也不会出现"存档里的带和星球对不上"。
 *   ② **纯数据**：本模块只产数据，不碰 THREE / 不碰 DOM。渲染由 map3d 读 BL.posOf() 画。
 *   ③ **为采矿预留**：每块石头自带 ore 储量与 mass，P1 不做玩法，但字段先定死，
 *      后续「星际采矿」直接读 BL.rockOf(id) / BL.yieldOf(rock) 即可，不用再改数据结构。
 *   ④ **由星球特征派生**（不是独立随机）：带宽/倾角/富度都乘星球参数
 *      （impact 撞击史 → 带更密更富；atmo 大气 → 无大气的星球碎屑更粗糙）。
 * ============================================================ */
(function () {
  var GAME = (typeof window !== 'undefined' ? (window.GAME || {}) : (global.GAME || {}));
  if (!GAME) return;
  var BL = GAME.belt = GAME.belt || {};

  /* ---- 规格默认值（玩家可在星球生成器「L5 轨道系」里细调）---- */
  BL.SPEC = {
    enabled: 1,        /* 0 = 不生成带；1 = 生成 */
    count: 240,        /* 石块数量 */
    innerMul: 1.55,    /* 内缘半径 = 星球半径 × 此值（R=300 → 465）*/
    widthMul: 0.62,    /* 带宽 = 星球半径 × 此值 */
    inclDeg: 16,       /* 轨道倾角上限（度）*/
    thickMul: 0.05,    /* 带厚（法向散布）= 星球半径 × 此值 */
    /* v92.245（老板：「星空中物体应有体积」）：原来 0.5~3.4 世界单位，
       在 R=300 / 视距 870 下只有 1~2 像素 —— 看着像噪点、更没有"体积"。
       现在 2.2~13（≈ 屏幕高度的 1%~6%，肉眼能读出是块石头）。
       两个值按 **R=300 基准**写，实际按 `R/300` 等比缩放（见 BL.gen）。 */
    sizeMin: 2.2,      /* 最小石块半径（世界单位 @R=300）*/
    sizeMax: 13,       /* 最大石块半径 */
    clump: 0.55,       /* 成团程度 0=沿带均匀 1=聚成几团 */
    periodSec: 900,    /* 内缘绕行一圈的秒数（外缘按开普勒第三定律更慢）*/
    oreRich: 1.0       /* 矿石富度总系数 */
  };
  BL.SPEC_DEFAULT = JSON.parse(JSON.stringify(BL.SPEC));

  /* ---- 确定性随机（mulberry32）—— 与球面噪声解耦，改带参数不会动地形 ---- */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  BL.rng = rng;

  /* ---- 规格规范化：合并默认 + 玩家细调 + **星球特征修正** ---- */
  BL.specOf = function (raw, planet) {
    var s = {}, k;
    for (k in BL.SPEC_DEFAULT) s[k] = BL.SPEC_DEFAULT[k];
    if (raw) for (k in raw) if (raw[k] != null) s[k] = raw[k];
    /* 星球特征 → 带的形态（"根据星球特征生成"）*/
    var P = (planet && planet.params) || {};
    var imp = Number(P.impact) || 0;                 /* 撞击史：撞得狠 → 碎屑多、更富矿 */
    var atmo = (P.atmo == null) ? 1 : Number(P.atmo);
    if (imp > 0) {
      s.count = Math.round(s.count * (1 + imp * 0.9));
      s.oreRich = +(s.oreRich * (1 + imp * 0.6)).toFixed(3);
      s.sizeMax = +(s.sizeMax * (1 + imp * 0.35)).toFixed(3);
    }
    /* 无大气 = 没有烧蚀/风化的筛选 → 碎屑棱角分明（视觉上更"糙"），这里体现为尺寸方差更大 */
    if (atmo < 0.4) s.clump = Math.min(1, +(s.clump + 0.15).toFixed(3));
    s.count = Math.max(0, Math.min(2000, s.count | 0));
    return s;
  };

  /* ---- 矿石谱：内缘富金属/稀有，外缘富石料/冰晶（贴合真实小行星带）---- */
  var ORE_KEYS = ['stone', 'iron', 'rare', 'crystal'];
  BL.ORE_KEYS = ORE_KEYS;
  BL.ORE_NAME = { stone: '石料', iron: '铁', rare: '稀有金属', crystal: '晶石' };

  function oreOf(u, rich, r) {
    /* u = 归一化半径位置(0 内缘 → 1 外缘) */
    var stone = 60 + 90 * u;                 /* 外圈石头多 */
    var iron = 70 - 45 * u;                  /* 内圈金属多 */
    var rare = 6 + 26 * (1 - u);
    var crystal = 4 + 22 * u;
    var m = 1 + 0.5 * (r() - 0.5);           /* ±25% 个体差 */
    return {
      stone: Math.round(stone * m * rich),
      iron: Math.round(iron * m * rich),
      rare: Math.round(rare * m * rich),
      crystal: Math.round(crystal * m * rich)
    };
  }

  /* ---- 生成一条带 ---- */
  /* seed：星球种子（与地形同一个，保证"这颗星球的带"唯一）
     spec：BL.specOf 的产物
     R   ：星球半径（缺省读 SP.R）*/
  BL.gen = function (seed, spec, R) {
    var sd = (Math.round(Number(seed)) || 1) | 0;
    var s = spec || BL.specOf(null, null);
    var RR = (R != null) ? R : ((GAME.sphere && GAME.sphere.R) || 300);
    if (!s.enabled) return { seed: sd, spec: s, R: RR, rocks: [], ver: 0 };

    var r = rng(sd ^ 0x5bf03635);
    var rIn = RR * s.innerMul, rOut = rIn + RR * s.widthMul;
    var n = s.count | 0, out = [], i;
    /* 成团：先抽 K 个"团心相位"，多数石块落在团心附近（clump 越大越集中）*/
    var K = Math.max(1, Math.round(3 + s.clump * 9));
    var clumpPh = [], clumpU = [];
    for (i = 0; i < K; i++) { clumpPh.push(r() * Math.PI * 2); clumpU.push(r()); }
    for (i = 0; i < n; i++) {
      var u, ph;
      if (r() < s.clump) {
        var cix = (r() * K) | 0;
        u = Math.max(0, Math.min(1, clumpU[cix] + (r() - 0.5) * 0.10));
        ph = clumpPh[cix] + (r() - 0.5) * 0.30;
      } else {
        /* 均匀成分：u 取 sqrt 分布 → 环带面积均匀（不然内圈会挤成一团）*/
        u = Math.sqrt(r());
        ph = r() * Math.PI * 2;
      }
      var a = rIn + (rOut - rIn) * u;                       /* 半长轴 */
      var inc = (r() * 2 - 1) * s.inclDeg * Math.PI / 180;  /* 轨道倾角 */
      var node = r() * Math.PI * 2;                          /* 升交点 */
      var thick = (r() * 2 - 1) * RR * s.thickMul * 0.5;     /* 离带中面的法向偏移 */
      /* 尺寸：幂律分布（小石块远多于大石块）—— 真实小行星带的尺寸谱。
         v92.245：再乘 `R/300`，换了星球半径石块跟着等比变，不会"大星球上全是沙粒"。 */
      var t = Math.pow(r(), 2.6);
      var size = (s.sizeMin + (s.sizeMax - s.sizeMin) * t) * (RR / 300);
      var ore = oreOf(u, s.oreRich, r);
      out.push({
        id: 'b' + sd + '_' + i,
        a: a, u: u, phase: ph, inc: inc, node: node, off: thick,
        size: size, shape: (r() * 1e6) | 0,
        spin: (r() * 2 - 1) * 0.9,
        /* 开普勒第三定律：T ∝ a^1.5 —— 外圈绕得更慢，带看着才"活" */
        w: (Math.PI * 2 / Math.max(30, s.periodSec)) * Math.pow(rIn / a, 1.5),
        ore: ore,
        mass: Math.round(size * size * size * 12)           /* 质量 ∝ 体积（采矿/牵引用）*/
      });
    }
    return { seed: sd, spec: s, R: RR, rIn: rIn, rOut: rOut, rocks: out, ver: (sd ^ (n * 2654435761)) >>> 0 };
  };

  /* ---- 缓存（按 seed+spec 指纹；确定性 → 不进存档）---- */
  var _cache = null, _cacheKey = '';
  function keyOf(seed, spec, R) {
    return [seed, R, spec.enabled, spec.count, spec.innerMul, spec.widthMul, spec.inclDeg,
      spec.thickMul, spec.sizeMin, spec.sizeMax, spec.clump, spec.periodSec, spec.oreRich].join('|');
  }
  BL.current = function (seed, spec, R) {
    var s = spec || BL.specOf(null, null);
    var RR = (R != null) ? R : ((GAME.sphere && GAME.sphere.R) || 300);
    var k = keyOf(seed, s, RR);
    if (_cache && _cacheKey === k) return _cache;
    _cache = BL.gen(seed, s, RR); _cacheKey = k;
    return _cache;
  };
  BL.invalidate = function () { _cache = null; _cacheKey = ''; };

  /* ---- 位置：给定"带内时刻 t(秒)"求世界坐标 ----
     轨道 = 半径 a 的圆，绕倾角 inc 的轴；node 决定倾角轴的朝向。 */
  BL.posOf = function (rock, t, out) {
    var th = rock.phase + rock.w * (t || 0);
    var x = Math.cos(th) * rock.a, z = Math.sin(th) * rock.a, y = rock.off;
    var ci = Math.cos(rock.inc), si = Math.sin(rock.inc);
    /* 绕 node 轴（位于赤道面内，方位角 node）旋转 inc */
    var cn = Math.cos(rock.node), sn = Math.sin(rock.node);
    /* 先把点转到 node 轴为 x 的坐标系 → 绕 x 转 inc → 转回 */
    var x1 = x * cn + z * sn, z1 = -x * sn + z * cn;
    var y2 = y * ci - z1 * si, z2 = y * si + z1 * ci;
    var x2 = x1 * cn - z2 * sn, z3 = x1 * sn + z2 * cn;
    out = out || [0, 0, 0]; out[0] = x2; out[1] = y2; out[2] = z3;
    return out;
  };

  BL.rockOf = function (id) {
    var c = _cache; if (!c) return null;
    for (var i = 0; i < c.rocks.length; i++) if (c.rocks[i].id === id) return c.rocks[i];
    return null;
  };
  /* 采矿预留：某种矿的可采量 = 储量（后续再乘 采集效率/距离惩罚）*/
  BL.yieldOf = function (rock, kind) {
    if (!rock || !rock.ore) return 0;
    return (kind ? (rock.ore[kind] || 0) : rock.ore);
  };

  /* ---- 汇总（给 UI / 后续采矿面板用）---- */
  BL.summary = function (belt) {
    var b = belt || _cache; if (!b || !b.rocks) return null;
    var tot = { stone: 0, iron: 0, rare: 0, crystal: 0 }, mass = 0, i, k;
    for (i = 0; i < b.rocks.length; i++) {
      mass += b.rocks[i].mass;
      for (k = 0; k < ORE_KEYS.length; k++) tot[ORE_KEYS[k]] += b.rocks[i].ore[ORE_KEYS[k]];
    }
    var big = 0;
    for (i = 0; i < b.rocks.length; i++) if (b.rocks[i].size >= (b.spec.sizeMin + b.spec.sizeMax) * 0.5) big++;
    return {
      count: b.rocks.length, mass: mass, ore: tot, big: big,
      rIn: Math.round(b.rIn || 0), rOut: Math.round(b.rOut || 0),
      innerMul: b.spec.innerMul, widthMul: b.spec.widthMul, inclDeg: b.spec.inclDeg
    };
  };

  BL.ver = function () { return _cache ? _cache.ver : 0; };
})();
