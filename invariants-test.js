/* ============================================================
 * invariants-test.js  守恒律 / 不变量 **属性测试**（node 运行）
 * 用法: node invariants-test.js
 * ------------------------------------------------------------
 * 定位：**第四件套**（audit 结构 · chain-audit 链路 · smoke 手写 case · 本件随机不变式）
 *
 * 为什么要有这一件：
 *   smoke 是「人想到的 case 穷举」—— 3,634 条断言很强，但**只覆盖人想到的输入**。
 *   本项目近几轮的真实故障形态是「守恒关系被打破」：
 *     · v91.88 装备占输出 89.5% → 守将补偿表越打越补（GUARD_FOLD/POWER_COMP 三层）
 *     · v91.67 城市资源 29 处裸写 → 负库存 / 超仓容
 *     · v91.62 背包 62 个写点 → 负库存
 *   这类缺陷的共同点：**单点都对，随机输入下不变量破裂**。
 *   本件用「种子随机 + 不变式断言 + 反例收缩」打这五类面：
 *     ① 战斗：兵力不增 / 账实相符 / 回合有界 / 输入不被吃 / 同输入同结果
 *     ② 资源：加减账实相符 / take 原子 / 封顶不削存量 / 归一
 *     ③ 背包：下界恒 0 / take 原子 / 归一
 *     ④ 战舰：造舰扣费精确 / 拆舰返还精确 / 升级账实相符 / 属性单调 / 满级封顶 /
 *        modifier 管道（出厂数据干净 / 迁移保真 / 可插拔 / 坏数据拒绝 / 异常免疫）
 *     ⑤ 策略层：纯函数 / 输出域闭合 / 空侧不抛错
 *
 * 与 fast-check 的关系：本件是**零依赖自实现**（mulberry32 PRNG + 收缩器），
 *   不引外部包 —— 与本仓「零外链依赖」同构（tests 只吃 node 标准库）。
 *
 * 判据（与 smoke 完全一致，供 gate.py 识别）：
 *   退出码 0/1；末行输出 `结果：N 通过 / M 失败`；**N 必须 > 0**（分母为 0 的绿不算绿）。
 *
 * 失败可复现：失败行带 `seed=<n>`，把该值填进文件末尾 SEED_OVERRIDE 即可复放。
 * ============================================================ */
(function () {
  /* ---- 浏览器环境 stub：与 smoke-test.js 第 8~46 行**同一份**（改动需两边同步） ---- */
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = makeEl('DIV'); return this._q[sel]; },
      querySelectorAll: function (sel) { return sel === '.sgr-bg' ? [makeEl('DIV'), makeEl('DIV')] : []; },
      getContext: function () {
        return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} };
      },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!_elCache[k]) _elCache[k] = makeEl(); return _elCache[k]; },
    addEventListener: function () {},
    readyState: 'complete',
    _cache: _elCache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var PASS = 0, FAIL = 0;
  function check(name, cond, extra) {
    if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
  }

  /* ---- 加载游戏模块（与 smoke 同一套三包） ---- */
  require('./js/bundle-core.js');
  require('./js/bundle-war.js');
  require('./js/bundle-ui.js');
  if (!window.GAME || !window.GAME.DATA || !window.GAME.utils) {
    console.log('结果：0 通过 / 1 失败');
    console.log('  ❌ bundle 求值顺序异常：GAME.DATA / GAME.utils 缺失');
    process.exit(1);
  }
  var G = global.GAME, DATA = G.DATA, U = G.utils;

  /* ============================================================
   * §0 确定性环境（与 smoke 同口径，逐条复制其理由）
   * ============================================================ */
  /* 钉天气恒晴：雨/雾/雪改战斗与产量口径，否则断言偶发假红（smoke v89.89 实测 1/13）。 */
  if (G.story && G.story.rollWeather) {
    G.story.rollWeather = function () {
      var st = G.state;
      if (st && st.world) { st.world.weather = 'clear'; st.world.weatherLeft = DATA.CALENDAR.secPerYear / 4; }
      return DATA.WEATHERS.clear;
    };
  }
  /* 钉地图 seed：mapSeed = U.now() % 100000 是毫秒时间戳，不钉则每次布局不同（smoke v89.89）。 */
  var _ng = G.newGame;
  G.newGame = function (opts) {
    opts = opts || {};
    if (opts.mapSeed == null) opts.mapSeed = 20260921;
    return _ng.call(this, opts);
  };
  /* 测试默认关闭战斗观战：战斗走即算/自动路径（smoke v89.87 同口径）。 */
  if (DATA.DEFAULT_SETTINGS) DATA.DEFAULT_SETTINGS.battleWatch = false;

  /* ============================================================
   * §0.1 共享对局（**只建一次** —— newGame 要生成整颗星球球面，很重；
   *   各性质对自己的输入自带快照/期望账，不依赖全局干净）
   * ============================================================ */
  var ST = G.newGame({ name: '不变量', avatar: '🧔', gender: 'male', region: 'random' });

  /* ============================================================
   * §0.2 PRNG（mulberry32）—— 种子随机，失败可复现
   * ============================================================ */
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /* ============================================================
   * §0.3 性质执行器
   *   prop(name, cases, gen, fn, shrinkers, brief)
   *     · gen(rng)  造随机输入；fn(input)  true=不变式成立（false/抛错=破裂）
   *     · shrinkers [{apply}]  反例简化候选；brief(input)  紧凑描述（便于打印）
   * ============================================================ */
  function prop(name, cases, gen, fn, shrinkers, brief) {
    var n = cases || 60, firstBad = null, firstSeed = 0, badErr = null;
    for (var i = 0; i < n; i++) {
      var seed = ((0x9e3779b9 ^ (i * 2654435761)) >>> 0) + i;
      var rng = prng(seed);
      var input;
      try { input = gen(rng); } catch (e) { firstBad = null; firstSeed = seed; badErr = e; break; }
      var ok = false;
      try { ok = fn(input) !== false; } catch (e) { ok = false; badErr = e; }
      if (!ok) { firstBad = input; firstSeed = seed; break; }
    }
    if (!firstBad && !badErr) { check(name + '（' + n + ' 例随机）', true); return; }

    /* 反例收缩：按候选序列简化，保留仍破裂的最小输入 */
    var shrunk = firstBad;
    if (firstBad && shrinkers) {
      for (var s = 0; s < shrinkers.length; s++) {
        var cand = shrinkers[s].apply(shrunk);
        if (cand === shrunk) continue;
        var still = false;
        try { still = fn(cand) !== false; } catch (e) { still = false; }
        if (still) shrunk = cand;
      }
    }
    var detail = 'seed=' + firstSeed
      + (badErr ? ' 抛错=' + String(badErr && badErr.message || badErr) : '')
      + (firstBad && brief ? ' ' + brief(shrunk) : '');
    check(name + '（' + n + ' 例随机）', false, detail);
    console.log('      ↳ 复放：把 invariants-test.js 顶部 SEED_OVERRIDE 设为 ' + firstSeed);
  }
  function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sumBy(map) { var n = 0; for (var k in (map || {})) n += (map[k] || 0); return n; }
  function briefArmy(a) { return JSON.stringify(a); }

  /* ============================================================
   * §1 战斗不变量（battle.simulate → tactic 引擎）
   * ------------------------------------------------------------
   * 结果字段口径（实测）：winner / atkLoss / defLoss / atkRemain / defRemain /
   *   rounds / roundsLog / strips / atkLossBy / defLossBy /
   *   atkStartBy / defStartBy / atkRemainBy / defRemainBy / defSortieStart / defSortieLeft
   * ⚠️ **没有 atkStart / defStart 总量字段** —— 总量口径 = Σ*StartBy。
   * ⚠️ 侦察单元（nocombat）不进账（scoutOnly 单独报），所以 Σ*StartBy 已剔除它们。
   * ============================================================ */
  console.log('\n===== 1. 战斗不变量（兵力不增 / 账实相符 / 回合有界 / 输入不被吃 / 确定性） =====');

  var COMBAT = Object.keys(DATA.TROOPS).filter(function (k) { return !DATA.TROOPS[k].nocombat; });
  var SCOUTS = Object.keys(DATA.TROOPS).filter(function (k) { return !!DATA.TROOPS[k].nocombat; });
  var DEFVALS = [0, 10, 40, 60, 90, 110];
  function randArmy(rng) {
    var a = {}, n = ri(rng, 1, 4);
    var pool = COMBAT.slice();
    for (var i = 0; i < n && pool.length; i++) {
      var k = pick(rng, pool); pool.splice(pool.indexOf(k), 1);
      a[k] = ri(rng, 1, 3000);
    }
    if (SCOUTS.length && rng() < 0.25) a[pick(rng, SCOUTS)] = ri(rng, 1, 500);   /* 侦察单元：不参战也不阵亡 */
    return a;
  }
  function genBattle(rng) {
    return {
      atk: randArmy(rng),
      def: randArmy(rng),
      atkGen: rng() < 0.3 ? ST.generals[0] : null,
      defGen: rng() < 0.2 ? ST.generals[0] : null,
      defVal: pick(rng, DEFVALS),
      opts: rng() < 0.3 ? { sieging: true } : {}
    };
  }
  function runBattle(b) {
    return G.battle.simulate(U.deep(b.atk), b.atkGen, U.deep(b.def), b.defVal, b.defGen, b.opts);
  }

  /* §1.1 兵力不增：总量与分兵种都不许比战前多（战斗只能减员，不能凭空生兵） */
  prop('战斗·兵力不增（总量+分兵种）', 50, genBattle, function (b) {
    var r = runBattle(b);
    if (r.atkRemain > sumBy(r.atkStartBy)) return false;
    if (r.defRemain > sumBy(r.defStartBy)) return false;
    for (var k in r.atkRemainBy) if ((r.atkRemainBy[k] || 0) > (r.atkStartBy[k] || 0)) return false;
    for (var k2 in r.defRemainBy) if ((r.defRemainBy[k2] || 0) > (r.defStartBy[k2] || 0)) return false;
    return true;
  }, [{
    apply: function (b) {
      var c = { atk: {}, def: {}, atkGen: null, defGen: null, defVal: 0, opts: {} };
      var ka = Object.keys(b.atk)[0], kd = Object.keys(b.def)[0];
      if (ka) c.atk[ka] = 1;
      if (kd) c.def[kd] = 1;
      return c;
    }
  }], function (b) { return 'atk=' + briefArmy(b.atk) + ' def=' + briefArmy(b.def) + ' defVal=' + b.defVal; });

  /* §1.2 账实相符：loss = Σstart − remain；remain = ΣremainBy；loss = ΣlossBy；
         分兵种 start − remain = lossBy（四处口径必须自洽） */
  prop('战斗·账实相符（loss/remain/remainBy/lossBy 四口径自洽）', 50, genBattle, function (b) {
    var r = runBattle(b);
    if (r.atkLoss !== sumBy(r.atkStartBy) - r.atkRemain) return false;
    if (r.defLoss !== sumBy(r.defStartBy) - r.defRemain) return false;
    if (r.atkRemain !== sumBy(r.atkRemainBy)) return false;
    if (r.defRemain !== sumBy(r.defRemainBy)) return false;
    if (r.atkLoss !== sumBy(r.atkLossBy)) return false;
    if (r.defLoss !== sumBy(r.defLossBy)) return false;
    if (r.atkLoss < 0 || r.defLoss < 0) return false;
    for (var k in r.atkLossBy) if ((r.atkStartBy[k] || 0) - (r.atkRemainBy[k] || 0) !== (r.atkLossBy[k] || 0)) return false;
    for (var k2 in r.defLossBy) if ((r.defStartBy[k2] || 0) - (r.defRemainBy[k2] || 0) !== (r.defLossBy[k2] || 0)) return false;
    return true;
  }, [{
    apply: function (b) {
      var c = { atk: {}, def: {}, atkGen: null, defGen: null, defVal: 0, opts: {} };
      var ka = Object.keys(b.atk)[0], kd = Object.keys(b.def)[0];
      if (ka) c.atk[ka] = 1;
      if (kd) c.def[kd] = 1;
      return c;
    }
  }], function (b) { return 'atk=' + briefArmy(b.atk) + ' def=' + briefArmy(b.def); });

  /* §1.3 回合有界：rounds ≥ 1；roundsLog/strips 与 rounds 同长（防死循环 / 防漏记） */
  prop('战斗·回合有界（rounds ≥ 1 且与 roundsLog/strips 同长）', 50, genBattle, function (b) {
    var r = runBattle(b);
    if (!(r.rounds >= 1) || r.rounds > 400) return false;
    if ((r.roundsLog || []).length !== r.rounds) return false;
    if ((r.strips || []).length !== r.rounds) return false;
    return true;
  }, null, function (b) { return 'atk=' + briefArmy(b.atk) + ' def=' + briefArmy(b.def) + ' rounds?'; });

  /* §1.4 输入不被修改：simulate 必须吃副本（否则调用方 army 被战斗改坏） */
  prop('战斗·输入不被修改（simulate 不吃调用方对象）', 50, genBattle, function (b) {
    var a0 = U.deep(b.atk), d0 = U.deep(b.def);
    G.battle.simulate(b.atk, b.atkGen, b.def, b.defVal, b.defGen, b.opts);
    return deepEq(a0, b.atk) && deepEq(d0, b.def);
  });

  /* §1.5 确定性：同输入两次 → 同结果（战报可复现 / 沙盘回放不漂移的前提） */
  prop('战斗·确定性（同输入两次结果深相等）', 50, genBattle, function (b) {
    return deepEq(runBattle(b), runBattle(b));
  });

  /* ============================================================
   * §2 城市资源不变量（GAME.city.add/sub/take）
   * ============================================================ */
  console.log('\n===== 2. 城市资源不变量（账实相符 / take 原子 / 封顶不削存量 / 归一） =====');

  /* 只追账面里"本次会动"的键：gold/pop 走各自出口，不在 city.add/sub/take 的管辖内 */
  var RES_K = (G.RES_KEYS || ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'])
    .filter(function (k) { return k !== 'gold' && k !== 'pop'; });
  function cityOf() { var c = ST.cities[0]; c.extGrid = c.extGrid || []; return c; }

  /* §2.1 加减账实相符：随机序列后，实际值 = 序列前 + Σ有效加减（sub 只扣到 0） */
  prop('资源·加减账实相符（随机序列追踪期望账）', 60, function (rng) {
    var ops = [], i;
    for (i = 0; i < ri(rng, 1, 12); i++) ops.push({ k: pick(rng, RES_K), n: ri(rng, 1, 5000), add: rng() < 0.5 });
    return { ops: ops };
  }, function (b) {
    var c = cityOf(), exp = {}, k, i;
    RES_K.forEach(function (x) { exp[x] = c.res[x] || 0; });
    for (i = 0; i < b.ops.length; i++) {
      var o = b.ops[i];
      if (o.add) { G.city.add(c, o.k, o.n); exp[o.k] += o.n; }
      else { var cut = G.city.sub(c, o.k, o.n); exp[o.k] = Math.max(0, exp[o.k] - cut); }
    }
    for (k in exp) if ((c.res[k] || 0) !== exp[k]) return false;
    return true;
  }, [{
    apply: function (b) { return { ops: b.ops.slice(0, 1) }; }
  }], function (b) { return 'ops=' + JSON.stringify(b.ops); });

  /* §2.2 take 原子性：任一不足 → 整单拒绝且账一毫不动；成功 → 逐项精确扣减 */
  prop('资源·take 原子性（拒绝不动账 / 成功精确扣）', 60, function (rng) {
    var cost = {}, n = ri(rng, 1, 3), i;
    for (i = 0; i < n; i++) cost[pick(rng, RES_K)] = ri(rng, 1, 60000);
    return { cost: cost };
  }, function (b) {
    var c = cityOf(), before = {};
    RES_K.forEach(function (k) { before[k] = c.res[k] || 0; });
    var r = G.city.take(c, b.cost);
    var lackAny = false;
    for (var k in b.cost) if ((b.cost[k] || 0) > (before[k] || 0)) lackAny = true;
    if (lackAny) {
      if (r.ok) return false;
      for (var k2 in before) if ((c.res[k2] || 0) !== before[k2]) return false;   /* 整单拒绝：一毫不动 */
      return true;
    }
    if (!r.ok) return false;
    for (var k3 in b.cost) if ((c.res[k3] || 0) !== before[k3] - (b.cost[k3] || 0)) return false;
    return true;
  }, null, function (b) { return 'cost=' + JSON.stringify(b.cost); });

  /* §2.3 封顶不削存量：add(cap=true) 只封增长；存量已超上限时一点不加 */
  prop('资源·封顶不削存量（cap 只封增长，不削存量）', 50, function (rng) {
    var c = cityOf(), k = pick(rng, RES_K), cap = G.storeCapOf(c, k);
    if (rng() < 0.5) c.res[k] = cap + ri(rng, 1, 1000);        /* 存量已超上限 */
    return { k: k, cap: cap, n: ri(rng, 1, 5000) };
  }, function (b) {
    var c = cityOf(), before = c.res[b.k] || 0;
    var after = G.city.add(c, b.k, b.n, true);
    if (after < before) return false;                        /* 不许削存量 */
    if (before >= b.cap && after !== before) return false;   /* 已满：一点不加 */
    if (before < b.cap && after > b.cap) return false;       /* 未满：不许超上限 */
    if (after !== (c.res[b.k] || 0)) return false;           /* 返回值与账面一致 */
    return true;
  }, null, function (b) { return 'k=' + b.k + ' cap=' + b.cap + ' n=' + b.n; });

  /* §2.4 归一：0 / 负数不入账；正小数 floor 后入账（口径 = floor 再保留下界 0） */
  prop('资源·加减归一（0/负不入账，正小数取 floor）', 50, function (rng) {
    return { k: pick(rng, RES_K), n: pick(rng, [0, -1, -9999, 0.4, 2.9, -0.5, 7]) };
  }, function (b) {
    var c = cityOf(), before = c.res[b.k] || 0;
    var expectAdd = b.n >= 1 ? before + Math.floor(b.n) : before;
    if (G.city.add(c, b.k, b.n) !== expectAdd) return false;
    if ((c.res[b.k] || 0) !== expectAdd) return false;
    return true;
  });

  /* ============================================================
   * §3 背包不变量（GAME.items.add/sub/take）
   * ============================================================ */
  console.log('\n===== 3. 背包不变量（下界恒 0 / take 原子 / 归一） =====');

  var ITEM_IDS = Object.keys(DATA.ITEM_BY_ID || {}).slice(0, 40);

  /* §3.1 下界恒 0：任意加减序列后，持有量恒 ≥ 0 且为整数 */
  prop('背包·下界恒 0（随机加减后 count ≥ 0 且为整数）', 60, function (rng) {
    var ops = [], i;
    for (i = 0; i < ri(rng, 1, 15); i++) ops.push({ id: pick(rng, ITEM_IDS), n: ri(rng, 1, 100), add: rng() < 0.5 });
    return { ops: ops };
  }, function (b) {
    b.ops.forEach(function (o) { o.add ? G.items.add(o.id, o.n) : G.items.sub(o.id, o.n); });
    return G.items.list(function (id, n) { return n < 0 || n !== Math.floor(n); }).length === 0;
  }, [{
    apply: function (b) { return { ops: b.ops.slice(0, 1) }; }
  }], function (b) { return 'ops=' + JSON.stringify(b.ops); });

  /* §3.2 take 原子性（与 city.take 同构） */
  prop('背包·take 原子性（拒绝不动账 / 成功精确扣）', 60, function (rng) {
    var req = {}, n = ri(rng, 1, 3), i;
    for (i = 0; i < n; i++) req[pick(rng, ITEM_IDS)] = ri(rng, 1, 5);
    return { req: req };
  }, function (b) {
    var before = {}; for (var id in b.req) before[id] = G.items.count(id);
    var r = G.items.take(b.req);
    var lackAny = false;
    for (var id2 in b.req) if ((b.req[id2] || 0) > before[id2]) lackAny = true;
    if (lackAny) {
      if (r.ok) return false;
      for (var id3 in before) if (G.items.count(id3) !== before[id3]) return false;
      return true;
    }
    if (!r.ok) return false;
    for (var id4 in b.req) if (G.items.count(id4) !== before[id4] - (b.req[id4] || 0)) return false;
    return true;
  }, null, function (b) { return 'req=' + JSON.stringify(b.req); });

  /* §3.3 归一：负/0 add 不入账；正小数 floor；sub 越界只扣到 0 */
  prop('背包·add/sub 归一（负与 0 不入账，正小数取 floor，sub 不越下界）', 50, function (rng) {
    return { id: pick(rng, ITEM_IDS), n: pick(rng, [-1, 0, 2.9, 7]) };
  }, function (b) {
    var before = G.items.count(b.id);
    var expect = b.n >= 1 ? before + Math.floor(b.n) : before;
    if (G.items.add(b.id, b.n) !== expect) return false;
    if (G.items.count(b.id) !== expect) return false;
    var cur = G.items.count(b.id);
    if (G.items.sub(b.id, 1e9) !== cur) return false;
    if (G.items.count(b.id) !== 0) return false;
    return true;
  });

  /* ============================================================
   * §4 战舰不变量（ship.build / scrap / upgradePart / statsOf）
   * ============================================================ */
  console.log('\n===== 4. 战舰不变量（扣费精确 / 返还精确 / 属性单调 / 满级封顶 / modifier 管道） =====');

  var PART_MATS = (DATA.SHIP_PARTS || []).map(function (p) { return p.mat; }).filter(Boolean);
  var HULL_MAT = (DATA.SHIP_COST || {}).hullMat || 'w_stariron';
  /* 材料/蓝图**置为已知量**（先清零再给）—— 否则多轮累积会让「缺蓝图」用例假绿真红 */
  function grantAll() {
    G.items.sub(HULL_MAT, 1e9); G.items.add(HULL_MAT, 100000);
    PART_MATS.forEach(function (m) { G.items.sub(m, 1e9); G.items.add(m, 100000); });
    (DATA.SHIP_CLASSES || []).forEach(function (c) {
      if (!c.bp) return;
      G.items.sub(c.bp, 1e9); G.items.add(c.bp, 1);
    });
  }
  /* 当前可建的最低档舰（稳定，不依赖随机） */
  function buildableClass() {
    var out = null;
    (DATA.SHIP_CLASSES || []).forEach(function (c) { if (!out && c.tier <= G.ship.tierCapNow()) out = c; });
    return out;
  }
  /* 清空船坞（本节的账都从"只有一艘新舰"起算） */
  function clearDock() {
    G.ship.ships().forEach(function (s) { G.ship.scrap(s.id); });
    if (G.ship.ships().length) ST.station.ships.length = 0;
  }

  /* §4.1 造舰扣费精确 + 蓝图门槛：成功扣 hullCost；缺蓝图/缺料时拒绝且不动账 */
  prop('战舰·造舰扣费精确（成功= hullCost，缺蓝图拒绝且不动账）', 40, function (rng) {
    clearDock(); grantAll();
    return { cls: buildableClass(), denyBp: rng() < 0.5 };
  }, function (b) {
    var before = G.items.count(HULL_MAT);
    if (b.denyBp) G.items.sub(b.cls.bp, 1);          /* 抽掉蓝图 */
    var r = G.ship.build(b.cls.id);
    if (b.denyBp) {
      if (r.ok) return false;
      return G.items.count(HULL_MAT) === before;     /* 拒绝：材料一毫不动 */
    }
    if (!r.ok) return false;
    if (G.items.count(HULL_MAT) !== before - G.ship.hullCost(b.cls)) return false;
    if (G.ship.ships().length !== 1) return false;
    return true;
  }, null, function (b) { return 'cls=' + b.cls.id + ' denyBp=' + b.denyBp; });

  /* §4.2 拆舰返还精确：返还 = floor(hullCost × scrapPct)，船坞同步减一 */
  prop('战舰·拆舰返还精确（floor(hullCost × scrapPct)）', 40, function (rng) {
    clearDock(); grantAll();
    var cls = buildableClass(), r = G.ship.build(cls.id);
    return { cls: cls, built: r.ok, shipId: r.ship ? r.ship.id : null };
  }, function (b) {
    if (!b.built) return false;
    var before = G.items.count(HULL_MAT);
    var pct = (DATA.SHIP_COST || {}).scrapPct == null ? 0.5 : DATA.SHIP_COST.scrapPct;
    var r = G.ship.scrap(b.shipId);
    if (!r.ok) return false;
    if (G.items.count(HULL_MAT) - before !== Math.floor(G.ship.hullCost(b.cls) * pct)) return false;
    if (G.ship.ships().length !== 0) return false;
    return true;
  }, null, function (b) { return 'cls=' + b.cls.id + ' built=' + b.built; });

  /* §4.3 部件升级：扣费精确 + enh 精确 + 满级封顶 + 属性/战力单调不减 */
  prop('战舰·部件升级（扣费精确 / enh 精确 / 满级封顶 / 属性单调）', 30, function (rng) {
    clearDock(); grantAll();
    G.ship.build(buildableClass().id);
    var parts = (DATA.SHIP_PARTS || []).filter(function (p) { return p.id !== 'hull'; });
    var order = [];
    while (parts.length) order.push(parts.splice(Math.floor(rng() * parts.length), 1)[0]);
    return { order: order, steps: ri(rng, 1, 8) };
  }, function (b) {
    var ship = G.ship.ships()[0];
    if (!ship) return false;
    var stats = G.ship.statsOf(ship), power = G.ship.powerOf(ship);
    var keys = (DATA.SHIP_STATS || []).map(function (s) { return s.k; });
    for (var i = 0; i < b.steps; i++) {
      var p = b.order[i % b.order.length];
      var cur = G.ship.partLvOf(ship, p.id);
      if (cur >= (p.max || 10)) {
        if (G.ship.canUpgrade(ship.id, p.id).ok) return false;      /* 满级必须拒绝 */
        continue;
      }
      var matBefore = G.items.count(p.mat);
      var chk = G.ship.canUpgrade(ship.id, p.id);
      if (!chk.ok) return false;
      var cost = G.ship.partCost(p, cur + 1);
      if (!G.ship.upgradePart(ship.id, p.id).ok) return false;
      if (G.items.count(p.mat) !== matBefore - cost) return false;  /* 扣费精确 */
      if (G.ship.partLvOf(ship, p.id) !== cur + 1) return false;    /* enh 精确 */
      var s2 = G.ship.statsOf(ship), p2 = G.ship.powerOf(ship);
      for (var j = 0; j < keys.length; j++) if ((s2[keys[j]] || 0) < (stats[keys[j]] || 0)) return false;  /* 属性单调 */
      if (p2 < power) return false;                                 /* 战力单调 */
      stats = s2; power = p2;
    }
    (DATA.SHIP_PARTS || []).forEach(function (pp) {
      if (G.ship.partLvOf(ship, pp.id) > (pp.max || 10)) return false;
    });
    return true;
  }, null, function (b) { return 'order=' + b.order.map(function (p) { return p.id; }).join('>') + ' steps=' + b.steps; });

  /* §4.4 modifier 管道（v142.4 C 期试点）：出厂数据干净 / 迁移保真 / 可插拔 / 坏数据拒绝 / 异常免疫 */
  ST.station.lv = 9;                     /* 开全档位（tierCap 9→4），让随机舰种覆盖 12 种 */
  var MOD_SRC = [];                      /* 本节注册的测试来源（每个 gen 起点 + 节末统一摘除） */
  function modReg(id, fn) { G.ship.mod.add(id, fn); MOD_SRC.push(id); }
  function modClear() {
    MOD_SRC.forEach(function (id) { G.ship.mod.add(id, null); });
    MOD_SRC = [];
  }
  /* 随机建一艘全部件等级随机的舰（直接钉 enh —— 本节只测属性口径，不走扣费链路） */
  function modShip(rng) {
    clearDock(); grantAll(); modClear();
    var cls = pick(rng, DATA.SHIP_CLASSES || []);
    if (!G.ship.build(cls.id).ok) throw new Error('build failed: ' + cls.id);
    var ship = G.ship.ships()[0];
    var enh = {};
    (DATA.SHIP_PARTS || []).forEach(function (p) {
      if (p.id !== 'hull') enh[p.id] = ri(rng, 0, p.max || 10);
    });
    ship.enh = enh;
    return { cls: cls, shipId: ship.id };
  }
  function modFind(b) {
    var ship = null;
    G.ship.ships().forEach(function (s) { if (s.id === b.shipId) ship = s; });
    return ship;
  }

  /* ① 出厂数据零坏修饰：全部舰种 × 全部件满级，statsOf 全程零拒绝。
     （坏修饰是**静默不生效**的 —— 键名写错/值写错只会进 bad()；这条把那种
       "数据 typo 悄悄掉属性" 变成门禁红。※ 必须是 §4.4 第一条：依赖 bad()
       尚未被 ③ 的故意污染；若因此红，说明有人在本条之前加了产废数据的来源） */
  prop('战舰·modifier 管道出厂数据干净（12 舰种 × 满配 → bad() 零记录）', 12, function (rng) {
    var pool = DATA.SHIP_CLASSES || [];
    return { classId: pool[Math.floor(rng() * pool.length)].id };
  }, function (b) {
    var ship = { id: 'probe', classId: b.classId, enh: {} };
    (DATA.SHIP_PARTS || []).forEach(function (p) {
      if (p.id !== 'hull') ship.enh[p.id] = p.max || 10;
    });
    var s = G.ship.statsOf(ship);
    if (G.ship.mod.bad().length !== 0) return false;
    var keys = (DATA.SHIP_STATS || []).map(function (x) { return x.k; });
    for (var i = 0; i < keys.length; i++) if (typeof s[keys[i]] !== 'number') return false;
    return true;
  }, null, function (b) { return 'classId=' + b.classId; });

  /* ②③④ 起（含① 迁移保真）：**摘掉 C 期的三个生产来源**
     ------------------------------------------------------------
     v144.2：管道里现在常驻母港共振 / 部件协同 / 编队共鸣三条 ——
     它们本来就是要让属性偏离旧公式的。本节（§4.4）测的是**管道本身**
     （迁移保真 / 可插拔 / 坏数据 / 异常免疫），生产数据由 smoke §356 单独钉。
     不摘的后果：② 的"精确翻倍"写成 base0.atk*2、③ 的"好修饰 +7"写成
     base0.atk+7 —— 那两个式子只在**零 pct** 下成立，生产 pct 一进来就假红。
       ① 出厂数据干净（上一条）**在生产态**跑 —— 它盯的就是生产数据不出坏修饰。 */
  var PROD_SNAP = G.ship.mod.snapshot();
  PROD_SNAP.forEach(function (s) { G.ship.mod.add(s.id, null); });

  /* ① 迁移保真：statsOf（管道）与 v142.4 前旧公式手算逐位相等（防迁移漂移） */
  prop('战舰·modifier 管道零行为变化（statsOf = 旧公式手算逐位相等）', 40, function (rng) {
    return modShip(rng);
  }, function (b) {
    var ship = modFind(b);
    if (!ship) return false;
    var got = G.ship.statsOf(ship);
    /* 旧公式（v142.4 前实现逐字复刻，用于对拍） */
    var cls = G.ship.classOf(b.cls.id);
    var base = (DATA.SHIP_BASE || {})[cls.role] || {};
    var tmul = (G.ship.tierOf(cls.tier).mul) || 1;
    var want = {};
    (DATA.SHIP_STATS || []).forEach(function (st) { want[st.k] = (base[st.k] || 0) * tmul; });
    (DATA.SHIP_PARTS || []).forEach(function (p) {
      if (p.id === 'hull') return;
      var lv = (ship.enh || {})[p.id] || 0;
      if (lv <= 0) return;
      for (var k in (p.per || {})) want[k] = (want[k] || 0) + p.per[k] * lv;
    });
    (DATA.SHIP_STATS || []).forEach(function (st) {
      var v = want[st.k] || 0;
      want[st.k] = st.pct ? Math.round(v * 100) / 100 : Math.round(v);
    });
    var keys = Object.keys(want);
    if (keys.length !== Object.keys(got).length) return false;
    for (var i = 0; i < keys.length; i++) if (got[keys[i]] !== want[keys[i]]) return false;
    return true;
  }, null, function (b) { return 'cls=' + b.cls.id; });

  /* ② 可插拔：apply 单验（flat 先加 / pct 后乘 / 顺序无关 / 多 pct 相加）
        + 端到端（注册→精确翻倍→摘除复原；C 期新系统就这条路径，不改公式） */
  prop('战舰·modifier 管道可插拔（pct 后乘 / 多源相加 / 摘除复原 / 顺序无关）', 30, function (rng) {
    var b = modShip(rng);
    b.pv = rng() < 0.5 ? 1 : 2;          /* 翻倍或翻三倍（整数路径，绕开取整歧义） */
    return b;
  }, function (b) {
    var ship = modFind(b);
    if (!ship) return false;
    var r1 = G.ship.mod.apply({ atk: 100 }, [{ k: 'atk', op: 'pct', v: 0.5 }, { k: 'atk', op: 'flat', v: 20 }]);
    var r2 = G.ship.mod.apply({ atk: 100 }, [{ k: 'atk', op: 'flat', v: 20 }, { k: 'atk', op: 'pct', v: 0.5 }]);
    if (r1.out.atk !== 180 || r2.out.atk !== 180) return false;        /* (100+20)×1.5，顺序无关 */
    var r3 = G.ship.mod.apply({ hp: 50 }, [{ k: 'hp', op: 'pct', v: 0.1 }, { k: 'hp', op: 'pct', v: 0.2 }]);
    if (r3.out.hp !== 65) return false;                                /* 50×1.3，两个 pct 相加 */
    var base0 = G.ship.statsOf(ship);
    modReg('inv_t1', function () { return [{ k: 'atk', op: 'pct', v: 1, src: 'inv_t1' }]; });
    if (G.ship.statsOf(ship).atk !== base0.atk * 2) { modClear(); return false; }
    modReg('inv_t2', function () { return [{ k: 'atk', op: 'pct', v: b.pv - 1, src: 'inv_t2' }]; });
    if (G.ship.statsOf(ship).atk !== base0.atk * (b.pv + 1)) { modClear(); return false; }   /* 多源 pct 相加：1+Σpct */
    G.ship.mod.add('inv_t1', null);
    if (G.ship.statsOf(ship).atk !== base0.atk * b.pv) { modClear(); return false; }   /* 摘一个 → 少一份（1+(pv-1)=pv） */
    modClear();
    if (G.ship.statsOf(ship).atk !== base0.atk) return false;                           /* 全摘 → 复原 */
    return true;
  }, null, function (b) { return 'cls=' + b.cls.id + ' pv=' + b.pv; });

  /* ③ 坏数据拒绝：未知键 / 非数值 / 非有限 → 拒绝且记录，好修饰照常，out 不污染 */
  prop('战舰·modifier 管道坏数据拒绝（未知键/非数值不进 out · 好修饰照常 · bad 有记录）', 25, function (rng) {
    return modShip(rng);
  }, function (b) {
    var ship = modFind(b);
    if (!ship) return false;
    var base0 = G.ship.statsOf(ship);
    modReg('inv_bad', function () { return [
      { k: 'nosuchstat', op: 'flat', v: 5 },
      { k: 'atk', op: 'flat', v: 'x' },
      { k: 'hp', op: 'pct', v: Infinity },
      null,
      { k: 'atk', op: 'flat', v: 7 }
    ]; });
    var s = G.ship.statsOf(ship);
    /* 证据判据看**末尾 4 条**（有界缓冲只删最旧，坏条目永远在末尾）——
       不用 delta 计数：满 50 后每例"加 4 删 4"，计数恒 0 会假红 */
    var fresh = G.ship.mod.bad().slice(-4);
    modClear();
    if (fresh.length !== 4) return false;
    if (!fresh[0] || fresh[0].k !== 'nosuchstat') return false;
    if (!fresh[1] || fresh[1].k !== 'atk' || fresh[1].v !== 'x') return false;
    if (!fresh[2] || fresh[2].k !== 'hp' || fresh[2].v !== Infinity) return false;
    if (fresh[3] !== null) return false;              /* 4 条坏修饰被拒且按序记录 */
    if (s.atk !== base0.atk + 7) return false;         /* 好修饰照常生效 */
    if (s.hp !== base0.hp) return false;               /* 被拒的不污染 out */
    if ('nosuchstat' in s) return false;
    return true;
  }, null, null);

  /* ④ 来源异常免疫：抛错的来源被跳过，好来源照常，statsOf 自己不抛 */
  prop('战舰·modifier 管道来源异常免疫（抛错来源被跳过 · 其余来源照常 · statsOf 不抛）', 20, function (rng) {
    return modShip(rng);
  }, function (b) {
    var ship = modFind(b);
    if (!ship) return false;
    var base0 = G.ship.statsOf(ship);
    modReg('inv_boom', function () { throw new Error('boom'); });
    modReg('inv_ok', function () { return [{ k: 'atk', op: 'flat', v: 3 }]; });
    var s = null;
    try { s = G.ship.statsOf(ship); } catch (e) { modClear(); return false; }
    modClear();
    if (!s) return false;
    if (s.atk !== base0.atk + 3) return false;
    var keys = Object.keys(base0);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === 'atk') continue;
      if (s[keys[i]] !== base0[keys[i]]) return false;
    }
    return true;
  }, null, null);
  modClear();
  G.ship.mod.restore(PROD_SNAP);        /* 生产来源归位（见上：不许留成摘除态） */
  ST.station.lv = 1;                    /* 复原：本节把空间站临时开到了 9 级 */

  /* ============================================================
   * §5 策略层不变量（strat.plan / planSide）
   * ============================================================ */
  console.log('\n===== 5. 策略层不变量（纯函数 / 输出域闭合 / 空侧不抛错） =====');

  function genSnap(rng) {
    function side(n) {
      var out = [], pool = COMBAT.slice(), i;
      for (i = 0; i < n && pool.length; i++) {
        var id = pick(rng, pool); pool.splice(pool.indexOf(id), 1);
        var t = DATA.TROOPS[id] || {};
        out.push({ id: id, count: ri(rng, 1, 800), adv: ri(rng, 0, 600),
          hpPer: t.hp || 10, atkPct: 0, er: t.range || 100, start: 0 });
      }
      return out;
    }
    return { field: pick(rng, [800, 1500, 2000, 3000]), atk: side(ri(rng, 0, 4)), def: side(ri(rng, 0, 4)) };
  }
  var STANCES = { advance: 1, hold: 1, retreat: 1 };

  /* §5.1 纯函数：同一快照两次规划结果深相等 */
  prop('策略·纯函数（同快照两次规划深相等）', 80, genSnap, function (snap) {
    return deepEq(G.strat.plan(snap), G.strat.plan(snap));
  });

  /* §5.2 输出域闭合：键 ⊆ 该侧存活单位；目标 ∈ 对方存活单位 ∪ {front}；stance ∈ 白名单 */
  prop('策略·输出域闭合（单位/目标/姿态三界）', 80, genSnap, function (snap) {
    var plan = G.strat.plan(snap);
    return ['atk', 'def'].every(function (side) {
      var mine = snap[side], foes = snap[side === 'atk' ? 'def' : 'atk'];
      var mineIds = {}, foeIds = {};
      mine.forEach(function (u) { if (u.count > 0) mineIds[u.id] = 1; });
      foes.forEach(function (u) { if (u.count > 0) foeIds[u.id] = 1; });
      return Object.keys(plan[side]).every(function (id) {
        if (!mineIds[id]) return false;                            /* 不许给死人/不存在单位下指令 */
        var cmd = plan[side][id];
        if (!STANCES[cmd.s]) return false;                         /* 姿态白名单 */
        return cmd.t === 'front' || !!foeIds[cmd.t];               /* 目标必须在对方存活单位里 */
      });
    });
  }, null, function (snap) { return 'atk=' + snap.atk.length + ' def=' + snap.def.length + ' field=' + snap.field; });

  /* §5.3 空侧不抛错：任一侧空数组时仍返回完整结构（键数 = 该侧存活单位数） */
  prop('策略·空侧不抛错（单侧/双侧空仍有完整结构）', 40, function (rng) {
    var snap = genSnap(rng);
    if (rng() < 0.5) snap.atk = [];
    if (rng() < 0.5) snap.def = [];
    return snap;
  }, function (snap) {
    var plan = G.strat.plan(snap);
    function alive(side) { return side.filter(function (u) { return u.count > 0; }).length; }
    return !!plan && !!plan.atk && !!plan.def
      && Object.keys(plan.atk).length === alive(snap.atk)
      && Object.keys(plan.def).length === alive(snap.def);
  });

  /* ============================================================
   * §6 战斗日志 / 转移表不变量（battlelog · v142.3）
   * ------------------------------------------------------------
   * battlelog 把战斗会话的状态迁移收成一张**转移表白名单**（MOVES），
   * 每个动作往 rec.blog 记一笔。这里验三层：
   *   ① 表自身闭合（状态机没有悬空/多终态）
   *   ② can() 判据与表一致
   *   ③ check() 能抓出 5 类非法日志（破坏测试实证过）
   *   ④ 真实战斗（派队→抵达→步进→落账）整条链的日志自洽
   * ============================================================ */
  console.log('\n===== 6. 战斗日志 / 转移表不变量（表白名单 / can / check / 真实链路） =====');
  var BL = G.battlelog;

  /* §6.1 表白名单自身闭合 */
  check('日志·转移表闭合（唯一终态 settle · from/to 都是已知状态）', (function () {
    var known = {}, k, m;
    for (k in BL.MOVES) { m = BL.MOVES[k]; known[m.to] = 1; m.from.forEach(function (f) { known[f] = 1; }); }
    var toDone = Object.keys(BL.MOVES).filter(function (x) { return BL.MOVES[x].to === 'done'; });
    var fromOk = Object.keys(BL.MOVES).every(function (x) {
      return BL.MOVES[x].from.every(function (f) { return known[f]; }) && known[BL.MOVES[x].to];
    });
    return toDone.length === 1 && toDone[0] === 'settle'
      && BL.MOVES.settle.from.length === 1 && BL.MOVES.settle.from[0] === 'settling'
      && BL.MOVES.create.from.length === 0 && fromOk;
  })(), '终态动作 = ' + Object.keys(BL.MOVES).filter(function (x) { return BL.MOVES[x].to === 'done'; }).join(','));

  /* §6.2 can() 判据：合法给过、非法给拦、未知动作给拦
     （create 的 from 为空数组 = **无前置状态约束** —— 新建会话不设闸，故任何状态都放行） */
  check('日志·can() 判据（live 放行 / done·settling 拦截 / 未知动作拦截 / create 无前置）', (function () {
    return BL.can('step', 'live').ok === true
      && BL.can('auto', 'live').ok === true
      && BL.can('finish', 'live').ok === true
      && BL.can('retreat', 'live').ok === true
      && BL.can('settle', 'settling').ok === true
      && BL.can('create', 'live').ok === true
      && BL.can('step', 'done').ok === false
      && BL.can('step', 'settling').ok === false
      && BL.can('finish', 'settling').ok === false
      && BL.can('settle', 'live').ok === false
      && BL.can('teleport', 'live').ok === false;
  })());

  /* §6.3 check() 抓非法日志：5 类必须红、1 类必须绿 */
  check('日志·check() 抓非法日志（双落账 / 落账后还打 / 未知动作 / 停在 settling / 回合回退）', (function () {
    function L(arr) { return arr.map(function (x, i) { return { seq: i + 1, move: x[0], round: x[1], at: 0, detail: null }; }); }
    var good = L([['create', 0], ['step', 1], ['step', 2], ['finish', 3], ['settle', 3]]);
    var doubleSettle = L([['create', 0], ['step', 1], ['finish', 2], ['settle', 2], ['settle', 2]]);
    var afterSettle = L([['create', 0], ['step', 1], ['finish', 2], ['settle', 2], ['step', 3]]);
    var unknownMove = L([['create', 0], ['step', 1], ['teleport', 1], ['settle', 1]]);
    var stuckSettling = L([['create', 0], ['step', 1], ['finish', 2]]);
    var roundBack = L([['create', 0], ['step', 2], ['step', 1], ['finish', 2], ['settle', 2]]);
    return BL.check(good).ok === true
      && BL.check(doubleSettle).ok === false
      && BL.check(afterSettle).ok === false
      && BL.check(unknownMove).ok === false
      && BL.check(stuckSettling).ok === false
      && BL.check(roundBack).ok === false;
  })());

  /* §6.4 老档兼容：没有 blog 字段时不抛错，读为空、自检报"空日志"（明示，不静默） */
  check('日志·老档兼容（无 blog 字段 → 读为空 / 自检明确报空）', (function () {
    return BL.of('bt_no_such_battle').length === 0
      && BL.check([]).ok === false && BL.check([]).why === '空日志（老档或未建档）'
      && Array.isArray(BL.overflow());
  })());

  /* §6.5 真实链路集成：派队 → 抵达 → 步进 → 落账，整条链的日志自洽
     （夹具与 smoke v89.87 同构：钉 seed 局 + 晴 + 观战开 + 行军到野地）
     v142.3 补：落账清场后日志仍可按 id 读到（settle 即封版 → DONE 快照） */
  var _s65 = '?';
  check('日志·真实链路（派队→抵达→步进→落账，blog 首 create 尾 settle 且自检通过）', (function () {
    var c = ST.cities[0];
    var gen = ST.generals[0];
    if (!c || !gen) return false;
    gen.status = 'idle'; gen.cityId = c.id;
    if (gen.staMax) gen.sta = gen.staMax;
    ST.settings.battleWatch = true;
    ST.marches = [];
    c.army = { buxingji: 600 };
    /* 找首都附近一块非城、非野地的可通行格（与 smoke §87 同一找法） */
    var wt = null;
    for (var dy = 13; dy <= 16 && !wt; dy++) {
      for (var dx = 13; dx <= 16 && !wt; dx++) {
        var tl = G.map.tile(c.x + dx, c.y + dy);
        var ci = G.sphere.ciOfXY(c.x + dx, c.y + dy);
        if (tl && tl.terrain !== 'city' && ci >= 0 && !G.map.wildAt(ci)) wt = { x: c.x + dx, y: c.y + dy, ci: ci };
      }
    }
    if (!wt) { ST.settings.battleWatch = false; return false; }
    var d = G.march.dispatch({ kind: 'wild', ci: wt.ci }, 'raid', { buxingji: 300 }, gen.id);
    if (!d || !d.ok) { ST.settings.battleWatch = false; return false; }
    var m = ST.marches[0];
    m.elapsed = m.totalTime;
    G.march.tick();
    var rec = (ST.battles || [])[0];
    if (!rec || rec.state !== 'live') { ST.settings.battleWatch = false; G.ui.closeModal(); return false; }
    /* 步进两回合，再自动跑完 */
    G.battle.stepBattle(rec.id);
    G.battle.stepBattle(rec.id);
    var logMid = BL.of(rec.id);
    G.battle.autoBattle(rec.id);
    var logEnd = BL.of(rec.id);
    var closed = (ST.battles || []).length === 0;
    ST.settings.battleWatch = false;
    G.ui.closeModal();
    if (!closed) return false;
    /* ① 首笔 create、末笔 settle；② 自检通过；③ 汇总自洽；④ 无溢出（落账后没有被丢的条目） */
    if (!logEnd.length || logEnd[0].move !== 'create') return false;
    if (logEnd[logEnd.length - 1].move !== 'settle') return false;
    if (!BL.check(logEnd).ok) return false;
    var sum = BL.summarize(logEnd);
    if (!sum.ended || sum.steps < 2) return false;
    if (BL.overflow().length !== 0) return false;
    /* ⑤ 日志回合号与 rec.round 终值一致（推进了几回合就记到几） */
    if (logEnd[logEnd.length - 1].round !== rec.round) return false;
    _s65 = logEnd.length + ' 笔 / ' + sum.rounds + ' 回合 / ' + rec.round + ' 终回合';
    return true;
  })(), '封版日志 ' + _s65);

  /* ============================================================
   * 汇总（判据与 smoke 一致：N 必须 > 0）
   * ============================================================ */
  console.log('\n性质数：' + (PASS + FAIL) + ' · 每性质 30~80 例随机输入 · 共享一个钉 seed 对局');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
