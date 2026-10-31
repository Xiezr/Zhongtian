/* ============================================================
 * js/planetgen.js — **星球生成流水线（强规范）**
 * ------------------------------------------------------------
 * 老板原话：「将星球生成规划一个标准化流程 —— 从星球参数到生成后，
 *   它相应地根据星球特征生成大气、海洋、省市区分野等等；
 *   把现有星球的要素（或者说一个地球的要素）从头到尾规范起来。
 *   目前是在这个过程当中进行很多修补，但这个修补不是一个顺序性的、规范性的。
 *   要求是这种强规范性的：我们把流程规定下来，然后如果有细调的话，可以由玩家自行细调。」
 *
 * ⛔ 本模块的定位（务必按此使用，别再各处打补丁）
 * ------------------------------------------------------------
 *   · 这里是**唯一的顺序定义处**。任何"生成某样东西"的新代码，先在此登记成一级，
 *     再实现；不许在 newGame / switchPlanet / ensure 里随手插一段。
 *   · 每级声明：id / 层 / 名字 / 依赖 / 输入参数 / 产出 / 执行体 / 校验体。
 *   · 执行**严格按 STAGES 的声明顺序**，不得跳级；依赖未满足即视为失败。
 *   · 玩家细调 = 改参数后 `PG.restage(级id)`：从该级重跑到末尾（上游不动）。
 *
 * ⚠️ 诚实地标注现状：**L0~L5 共用一个"球面内核重建"**（sphere.js 的 `SP.setPlanet`
 *    一次就把地形/海陆/地类全部重算，目前没有分层粒度）。所以这几级在物理上
 *    不可单独重跑 —— `restage` 对它们会**从 L0 整段重跑**并在回执里写清楚。
 *    这是"把现状规定下来"，不是粉饰：下游（L6/L7/L8）才是真正可单级重跑的。
 * ============================================================ */
(function () {
  var GAME = (typeof window !== 'undefined' ? (window.GAME || {}) : (global.GAME || {}));
  if (!GAME) return;
  var PG = GAME.planetgen = GAME.planetgen || {};

  function SP() { return GAME.sphere || null; }
  function DATA() { return GAME.DATA || (GAME.data) || {}; }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function clamp(v, a, b) { v = num(v, a); return v < a ? a : v > b ? b : v; }

  /* ============================================================
   * 一、参数规格（SPEC）—— 星球参数的**唯一口径**
   *   玩家细调改的是这里；各级只准从 ctx.spec 读，不准自己去摸 DOM / 全局变量。
   * ============================================================ */
  PG.SPEC = {
    /* L0 骨架 */
    seed: 1, radius: 300, spinSec: 60, tilt: 23, atmo: 1.0, starColor: 0xffe6b8, impact: 0,
    /* L1 岩石圈（形貌）*/
    seaFrac: 0.45, contCount: 0, ridge: 1.5, mountain: 'fold', oceanDepth: 1.0, detail: 0.7,
    /* L2 水圈 */
    /* 海平面由 seaFrac 反推（sphere.js 内部算），这里放"可细调的偏置"：
       ±0.05 相当于把海岸线整体推/拉一点点，用来修"岛太多/太少"而不动地貌。 */
    seaBias: 0,
    /* L3 大气圈 */
    cloud: 1.0,                  /* 云量 */
    /* L4 气候 */
    temp: 1.0, tempBands: 3,
    /* L5 生物圈 / 地类 */
    ecoNature: '', ecoCiv: '', ecoMood: '', ecoClassic: '',
    /* L6 行政区划 */
    admin: 1,                    /* 1=划定区·镇·聚落 */
    /* L7 地标 */
    wonder: 1,                   /* 1=生成奇观 */
    npc: 1,                      /* 1=生成名城/聚落 */
    /* L8 轨道系（陨石带）*/
    belt: null                   /* null → 用 GAME.belt.SPEC 默认；详见 BL.specOf */
  };
  PG.SPEC_DEFAULT = JSON.parse(JSON.stringify(PG.SPEC));

  /* 规范化：合并默认 + 传入参数（null/undefined 项沿用默认）*/
  PG.specOf = function (planet) {
    var s = {}, k;
    var SPd = (SP() && SP().PLANET) || {};
    for (k in PG.SPEC_DEFAULT) {
      var d = PG.SPEC_DEFAULT[k];
      if (SPd[k] != null && PG.SPEC_DEFAULT[k] === PG.SPEC_DEFAULT[k]) { /* 结构缺省先取默认 */ }
      s[k] = (typeof d === 'object' && d) ? JSON.parse(JSON.stringify(d)) : d;
    }
    /* 星球规格（SP.PLANET）覆盖 —— 它是"这颗星球当前生效的规格" */
    for (k in s) if (SPd[k] != null) s[k] = SPd[k];
    var P = (planet && planet.params) || planet || {};
    for (k in s) if (P[k] != null) s[k] = P[k];
    s.seed = num((planet && planet.seed) != null ? planet.seed : s.seed, 1) | 0;
    s.radius = clamp(s.radius, 120, 900);
    s.seaFrac = clamp(s.seaFrac, 0.02, 0.95);
    s.ridge = clamp(s.ridge, 0.2, 4);
    s.temp = clamp(s.temp, 0.2, 2.5);
    s.atmo = clamp(s.atmo, 0, 2.5);
    s.cloud = clamp(s.cloud, 0, 2.5);
    s.tempBands = Math.max(1, Math.min(12, s.tempBands | 0));
    s.contCount = Math.max(0, Math.min(24, s.contCount | 0));
    /* v92.246（复核补口）：**数值兜底**。`ui._planetParamsFrom()` 是 `Number(f.starColor)`，
       表单没填过时 f 是空对象 → `Number(undefined)` = **NaN**，一路传进 setPlanet，
       最终喂给 `light.color.setHex(NaN)`（灯变黑）与几何参数。所有数值型规格在此收口。 */
    if (!isFinite(+s.starColor)) s.starColor = 0xffe6b8;
    s.spinSec = Math.max(5, Math.min(1200, +s.spinSec || 60));
    s.tilt = Math.max(-90, Math.min(90, isFinite(+s.tilt) ? +s.tilt : 23));
    s.detail = Math.max(0, Math.min(3, isFinite(+s.detail) ? +s.detail : 0.7));
    s.oceanDepth = Math.max(0.2, Math.min(2.5, isFinite(+s.oceanDepth) ? +s.oceanDepth : 1));
    return s;
  };

  /* ============================================================
   * 二、派生量 —— **根据星球特征**算出下游要用的数（大气高度/浓度、海深…）
   *   这里是"特征 → 要素"的明文公式，改观感只改这里，不要散到渲染里。
   * ============================================================ */
  PG.derive = function (spec) {
    var R = num(spec.radius, 300);
    var atmo = clamp(spec.atmo, 0, 2.5);
    var cloud = clamp(spec.cloud, 0, 2.5);
    var impact = clamp(spec.impact, 0, 1);
    /* 大气层高度：= 最高峰之上一点点（峰高 ≈ 0.15R×ridge），再随大气密度增厚。
       改前是写死的 55 —— 换个半径/山脉强度的星球就穿帮（山捅破大气壳）。 */
    var peak = R * 0.055 * clamp(spec.ridge, 0.2, 4) * clamp(spec.detail + 0.6, 0.4, 2.2);
    var atmH = Math.round(R * 0.055 + peak + atmo * R * 0.045);
    /* 大气浓度：0（真空）~ 0.5（浓密遮天）；云量再叠一层。 */
    var atmA = +(clamp(0.10 + atmo * 0.16 + cloud * 0.06, 0, 0.55)).toFixed(3);
    /* 海深剖面 → 深海占比（oceanDepth 大 = 更深 = 浅滩更少）*/
    var deepFrac = clamp(0.30 + (clamp(spec.oceanDepth, 0.4, 1.6) - 0.4) * 0.42, 0.1, 0.8);
    return {
      R: R, peak: +peak.toFixed(2), atmH: atmH, atmA: atmA,
      seaBias: clamp(spec.seaBias, -0.2, 0.2),
      deepFrac: +deepFrac.toFixed(3),
      /* 陨石带：撞击史重的星球带更密更富（BL.specOf 里具体乘）*/
      beltSpec: (GAME.belt && GAME.belt.specOf)
        ? GAME.belt.specOf(spec.belt, { params: spec }) : null
    };
  };

  /* ============================================================
   * 三、流水线定义 —— **顺序即规范**
   * ============================================================ */
  PG.STAGES = [
    /* ---- L0 ---- */
    {
      id: 'L0', layer: 'L0 骨架', name: '球体与自转', group: 'core',
      deps: [], params: ['seed', 'radius', 'spinSec', 'tilt', 'starColor', 'impact'],
      out: ['SP.PLANET', 'SP.R', 'SP.PLANET.spinSec', 'SP.PLANET.tilt'],
      desc: '定种子/半径/自转周期/轴倾角/恒星色温/撞击史 —— 下游一切的地基',
      run: function () { return true; },
      verify: function (ctx) { return !!(SP() && SP().PLANET && SP().R > 0); }
    },
    /* ---- L1 ---- */
    {
      id: 'L1', layer: 'L1 岩石圈', name: '大陆与山脉', group: 'core',
      deps: ['L0'], params: ['contCount', 'ridge', 'mountain', 'detail'],
      out: ['SP.cells[].e', 'SP._emax', 'contField'],
      desc: '大陆掩膜 + 褶皱/火山/断块/撞击四型山脉 + 颗粒细节 → 高程场',
      run: function () { return true; },
      verify: function (ctx) { var s = SP(); return !!(s && s.cells && s._emax > 0); }
    },
    /* ---- L2 ---- */
    {
      id: 'L2', layer: 'L2 水圈', name: '海平面与海深', group: 'core',
      deps: ['L1'], params: ['seaFrac', 'oceanDepth', 'seaBias'],
      out: ['SP.seaLevel()', 'deepFrac'],
      desc: '按目标海洋占比反推海平面（+ 玩家细调偏置），海深剖面决定深海/浅滩比',
      run: function (ctx) {
        if (SP() && SP().seaLevel) { SP().seaLevel(); return true; }
        return false;
      },
      verify: function (ctx) { return !!(SP() && typeof SP().seaLevel === 'function' && isFinite(SP().seaLevel())); }
    },
    /* ---- L3 ---- */
    {
      id: 'L3', layer: 'L3 大气圈', name: '大气层与云', group: 'core',
      deps: ['L2'], params: ['atmo', 'cloud', 'radius', 'ridge', 'detail'],
      out: ['SP.ATM_H', 'SP.ATM_A'],
      desc: '大气高度/浓度由半径·山脉强度·大气密度·云量派生（改前是写死的 55 / 0.30）',
      run: function (ctx) {
        var s = SP(); if (!s) return false;
        var d = ctx.d;
        s.ATM_H = d.atmH; s.ATM_A = d.atmA;
        if (GAME.map3d && GAME.map3d.invalidateAtmo) GAME.map3d.invalidateAtmo();
        return true;
      },
      verify: function (ctx) { var s = SP(); return !!(s && s.ATM_H > 0 && s.ATM_A >= 0); }
    },
    /* ---- L4 ---- */
    {
      id: 'L4', layer: 'L4 气候', name: '温度带', group: 'core',
      deps: ['L3'], params: ['temp', 'tempBands'],
      out: ['SP.PLANET.temp', 'SP.PLANET.tempBands'],
      desc: '纬度温差 + 温度带数量（气候带）→ 下游地类的地带性',
      run: function () { return !!(SP() && SP().PLANET); },
      verify: function (ctx) { var s = SP(); return !!(s && s.PLANET && s.PLANET.tempBands >= 1); }
    },
    /* ---- L5 ---- */
    {
      id: 'L5', layer: 'L5 生物圈', name: '地类与生态', group: 'core',
      deps: ['L4'], params: ['ecoNature', 'ecoCiv', 'ecoMood', 'ecoClassic'],
      out: ['SP.cells[].type', 'SP.cells[].name', 'SP.ecoNatureOf()'],
      desc: '整批定地类（距海/坡度/湿度分位/连续性平滑）→ 成片而非逐格噪点；再挂生态三轴标签',
      run: function () { return true; },
      verify: function (ctx) { var s = SP(); return !!(s && s.cells && s.cells.length && s.cells[0] && s.cells[0].type != null); }
    },
    /* ---- L6 ---- */
    {
      id: 'L6', layer: 'L6 行政区划', name: '区 · 镇 · 聚落', group: 'regions',
      deps: ['L5'], params: ['admin'],
      out: ['GAME.map._countyField()', 'GAME.regionOf(ci)'],
      desc: '**顺次划定**：必须在地形与地类定型之后。多源 BFS 铺区域场 → 任一格 O(1) 归属',
      run: function (ctx) {
        if (!ctx.spec.admin) return true;
        if (GAME.map && GAME.map._countyField) { GAME.map._countyField(); return true; }
        return !!GAME.regionOf;
      },
      verify: function (ctx) { return typeof GAME.regionOf === 'function'; }
    },
    /* ---- L7 ---- */
    {
      id: 'L7', layer: 'L7 地标', name: '奇观与名城', group: 'landmarks',
      deps: ['L6'], params: ['wonder', 'npc'],
      out: ['planet.report', 'planet.artifact'],
      desc: '按地形/危险度出奇观；名城落位（必须晚于行政区划，否则归属漂移）',
      run: function (ctx) {
        var pl = ctx.planet;
        if (!pl) return true;
        var s = SP();
        if (ctx.spec.wonder && s && s.artifactOf) { pl.artifact = s.artifactOf(); if (pl.params) pl.params.artifact = pl.artifact; }
        if (s && s.report) pl.report = s.report();
        return true;
      },
      verify: function (ctx) { return !ctx.planet || ctx.planet.report != null || !(SP() && SP().report); }
    },
    /* ---- L8 ---- */
    {
      id: 'L8', layer: 'L8 轨道系', name: '陨石带', group: 'orbit',
      deps: ['L5'], params: ['belt', 'impact', 'atmo'],
      out: ['GAME.belt.current()', 'rocks'],
      desc: '由撞击史/大气派生带宽与富度，确定性生成（不进存档）—— 星际采矿的数据源',
      run: function (ctx) {
        if (!GAME.belt) return false;
        GAME.belt.invalidate();
        var b = GAME.belt.current(ctx.spec.seed, ctx.d.beltSpec, ctx.d.R);
        if (ctx.planet && ctx.planet.params) ctx.planet.params.belt = ctx.d.beltSpec;
        return !!(b && b.rocks);
      },
      verify: function (ctx) { return !!(GAME.belt && GAME.belt.current(null, ctx.d.beltSpec, ctx.d.R)); }
    }
  ];
  PG.STAGE_OF = {};
  PG.STAGES.forEach(function (st, i) { st.order = i; PG.STAGE_OF[st.id] = st; });
  /* 核心组：L0~L5 共用一次球面重建，物理上不可分 */
  PG.CORE_IDS = PG.STAGES.filter(function (s) { return s.group === 'core'; }).map(function (s) { return s.id; });

  /* ============================================================
   * 四、执行器
   * ============================================================ */
  function coreRebuild(ctx) {
    var s = SP(); if (!s || !s.setPlanet) return false;
    var sp = {};
    ['radius', 'spinSec', 'tilt', 'atmo', 'starColor', 'impact', 'seaFrac', 'contCount',
      'ridge', 'mountain', 'oceanDepth', 'detail', 'temp', 'tempBands', 'cloud',
      'ecoNature', 'ecoCiv', 'ecoMood', 'ecoClassic', 'artifact'].forEach(function (k) {
        if (ctx.spec[k] != null) sp[k] = ctx.spec[k];
      });
    s.setPlanet(ctx.spec.seed, sp);
    /* ⚠️ 只重建**逻辑球面**。地图球面由 `GAME.enterPlanet` 统一对齐 ——
       在这里也 setPlanet 会多花一次全量重建（~1.6s），且与"只算不切"的调用者（生成副本后不进入）
       语义冲突：那会把 `_planetDoCreate` 的"算完还原"路径打乱。 */
    return true;
  }

  PG.last = null;
  /* 按序跑完整条流水线。opts: { planet, only:'L6'（从该级起）, silent } */
  PG.generate = function (seed, spec, opts) {
    opts = opts || {};
    var s = PG.specOf(spec ? (spec.seed == null ? Object.assign({}, spec, { seed: seed }) : spec) : { seed: seed });
    if (seed != null) s.seed = num(seed, s.seed) | 0;
    var ctx = { seed: s.seed, spec: s, d: PG.derive(s), planet: opts.planet || null, done: {}, log: [] };
    var from = opts.only ? (PG.STAGE_OF[opts.only] ? PG.STAGE_OF[opts.only].order : 0) : 0;
    var coreDone = (from > 0);   /* 单级重跑时不重建内核（除非该级属于核心组）*/
    var i, st, t0, ok;
    for (i = from; i < PG.STAGES.length; i++) {
      st = PG.STAGES[i]; t0 = Date.now(); ok = false;
      /* 依赖检查：不得跳级。
         ⛔ v92.246（全面复核修）：原判据是
             `from>0 && CORE_IDS.indexOf(d)>=0 && CORE_IDS.indexOf(d) < CORE_IDS.indexOf(st.id)`
         对**非核心级**（L6/L7/L8）永远不成立 —— 因为它们不在 CORE_IDS 里，
         `indexOf(st.id)` 是 -1，任何下标都不会 < -1。后果：`restage('L6'|'L7'|'L8')`
         全部被判"依赖未满足"而**静默跳过**，也就是我声称"可单级重跑"的那三级其实跑不动。
         正解：单级重跑时球面内核早已在位（L0~L5 的产物是既成事实），核心依赖一律视为满足。 */
      var depOK = st.deps.every(function (d) {
        if (ctx.done[d]) return true;
        if (from > 0 && PG.CORE_IDS.indexOf(d) >= 0) return true;
        return false;
      });
      if (!depOK) { ctx.log.push({ id: st.id, ok: false, ms: 0, note: '依赖未满足：' + st.deps.join(',') }); continue; }
      /* 核心组：整段一次性重建，只在第一次遇到时真正执行 */
      if (st.group === 'core') {
        if (!coreDone) { coreRebuild(ctx); coreDone = true; PG.CORE_IDS.forEach(function (id) { ctx.done[id] = true; }); }
        try { ok = !!st.run(ctx); } catch (e) { ok = false; ctx.log.push({ id: st.id, ok: false, ms: 0, note: '抛错：' + (e && e.message) }); continue; }
      } else {
        try { ok = !!st.run(ctx); } catch (e) { ok = false; ctx.log.push({ id: st.id, ok: false, ms: 0, note: '抛错：' + (e && e.message) }); continue; }
        ctx.done[st.id] = true;
      }
      var vOK = true;
      try { vOK = st.verify ? !!st.verify(ctx) : true; } catch (e2) { vOK = false; }
      ctx.log.push({ id: st.id, name: st.layer + ' ' + st.name, ok: ok && vOK, ms: Date.now() - t0,
        note: ok ? (vOK ? '' : '执行成功但校验不过') : '执行失败' });
    }
    PG.last = { at: Date.now(), seed: ctx.seed, spec: ctx.spec, derived: ctx.d, stages: ctx.log,
      ok: ctx.log.every(function (r) { return r.ok; }) };
    return PG.last;
  };

  /* 玩家细调入口：改了参数后从某一级重跑。
     核心组（L0~L5）共用一次球面重建 → 会**从 L0 整段重跑**（回执里写明）。*/
  PG.restage = function (stageId, seed, spec, opts) {
    var st = PG.STAGE_OF[stageId];
    if (!st) return { ok: false, msg: '未知的级：' + stageId };
    var from = st.id;
    var note = '';
    if (st.group === 'core') { from = 'L0'; note = 'L0~L5 共用一次球面内核重建，不可单级重跑 —— 已整体重跑'; }
    var r = PG.generate(seed, spec, Object.assign({}, opts || {}, { only: from }));
    r.restageNote = note || ('已从 ' + from + ' 重跑到末尾');
    return r;
  };

  /* ============================================================
   * 五、自检 —— 保证"规范"本身是成立的（顺序/依赖/参数/产出）
   * ============================================================ */
  PG.audit = function () {
    var errs = [], ids = {}, i, st, k;
    for (i = 0; i < PG.STAGES.length; i++) {
      st = PG.STAGES[i];
      if (ids[st.id]) errs.push('级 id 重复：' + st.id); ids[st.id] = 1;
      if (!st.run) errs.push(st.id + ' 缺 run');
      if (!st.verify) errs.push(st.id + ' 缺 verify');
      if (!st.layer || !st.name) errs.push(st.id + ' 缺 layer/name');
      if (!st.params || !st.params.length) errs.push(st.id + ' 未声明 params');
      if (!st.out || !st.out.length) errs.push(st.id + ' 未声明 out');
      /* 依赖必须**在前**（顺序即规范）*/
      (st.deps || []).forEach(function (d) {
        if (!PG.STAGE_OF[d]) errs.push(st.id + ' 依赖了不存在的级 ' + d);
        else if (PG.STAGE_OF[d].order >= st.order) errs.push(st.id + ' 的依赖 ' + d + ' 排在它之后（违反顺序）');
      });
      /* 声明的参数必须在 SPEC 里有定义（否则玩家无从细调）*/
      (st.params || []).forEach(function (p) {
        if (!(p in PG.SPEC_DEFAULT)) errs.push(st.id + ' 声明了 SPEC 里没有的参数 ' + p);
      });
    }
    /* 每个 SPEC 参数都应至少被一级声明（否则是死参数）*/
    var used = {};
    PG.STAGES.forEach(function (s2) { (s2.params || []).forEach(function (p) { used[p] = 1; }); });
    for (k in PG.SPEC_DEFAULT) if (!used[k] && k !== 'seed') errs.push('SPEC 参数 ' + k + ' 没有任何一级声明使用');
    return { ok: !errs.length, errors: errs, stages: PG.STAGES.length };
  };

  /* 人读的流程报告（给 UI「流程」页用）*/
  PG.report = function () {
    var last = PG.last;
    var rows = PG.STAGES.map(function (st) {
      var r = null;
      if (last) last.stages.forEach(function (x) { if (x.id === st.id) r = x; });
      return {
        id: st.id, layer: st.layer, name: st.name, group: st.group,
        deps: st.deps.join(','), params: st.params.join(','), out: st.out.join(' / '),
        desc: st.desc,
        state: r ? (r.ok ? 'done' : 'fail') : (last ? 'skipped' : 'idle'),
        ms: r ? r.ms : 0, note: r ? r.note : ''
      };
    });
    return { ok: !!(last && last.ok), at: last ? last.at : 0, seed: last ? last.seed : 0,
      derived: last ? last.derived : PG.derive(PG.specOf(null)), rows: rows };
  };
})();
