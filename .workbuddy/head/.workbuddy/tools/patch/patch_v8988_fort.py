# -*- coding: utf-8 -*-
"""v89.88（老板需求 1~3）：野外城池（据点）改造 —— 等级分布 / 守军×10 / 满配。

① data.js：DATA.FORT —— levelMax 8→10；levelDist（8/9/10 各 30% + 1~7 均分 10%）；
   garrisonBase 50→500（×10，"总归要比野地兵多"）。
② map.js：据点段整体重写 ——
   · _fortHash 内联（与 U.rng(h)() 逐位等价，热路径去闭包）；
   · _fortBlockSet（出生点+名城保护区，按 seed+出生点缓存）；
   · hasFort（判据不变，读缓存集合）；
   · _fortCandidates（全图候选格，按 seed 缓存一次）；
   · _fortLevelTable / _fortLevelAt（构造性配额分布，按 (seed,日) 缓存）；
   · fortAt（等级表 = 据点存在的唯一事实；rafzed 检查前置）。
"""
import io

DATA = r'E:\Deepseekdb\js\data.js'
MAP = r'E:\Deepseekdb\js\map.js'

# ============================================================
# ① data.js
# ============================================================
s = io.open(DATA, encoding='utf-8', newline='').read()

old1 = """  DATA.FORT = {
    density: 1 / 12,
    levelMin: 1, levelMax: 8,
    safeRadius: 3,          // 出生点与名城周围不生成"""
new1 = """  DATA.FORT = {
    density: 1 / 12,
    /* v89.88（老板需求 3「普通城 8，9，10 级城分别占 30%」）：等级上限 8 → 10 ——
       补齐 9/10 两档（自动出征的等级候选早已是 1~10，此前这两档永远筛不出目标）。 */
    levelMin: 1, levelMax: 10,
    /* v89.88（老板需求 3）：等级分布 —— 8/9/10 各 `highPct`（合计 90%），
       1~7 级合计 `lowPct` 均分。**构造性配额**（全图按当日哈希排序切段，
       不是掷点 —— v89.72 的教训：掷点占比不成立）。 */
    levelDist: { high: [8, 9, 10], highPct: 0.30, lowPct: 0.10 },
    safeRadius: 3,          // 出生点与名城周围不生成"""
assert s.count(old1) == 1, ('data-1', s.count(old1))
s = s.replace(old1, new1, 1)

old2 = """    garrisonBase: 50,
    garrisonGrowth: 1.95,
  };"""
new2 = """    /* v89.88（老板需求 1/2「野外城池总归要比野地兵多」「兵力乘以 10 倍」）：
       50 → **500**（×10）。实测口径：每一级的守军都 ≥ 同级野地
       `DATA.WILD_DEFENSE` 的**上限**（Lv1 500 vs 76 · Lv5 7,228 vs 1,480 ·
       Lv8 53,596 vs 11,470 · Lv10 ≈ 203,900 vs 57,500）——
       "比野地还弱、不配称之为城"从根上消除（smoke 有逐级守卫）。 */
    garrisonBase: 500,
    garrisonGrowth: 1.95,
  };"""
assert s.count(old2) == 1, ('data-2', s.count(old2))
s = s.replace(old2, new2, 1)

io.open(DATA, 'w', encoding='utf-8', newline='').write(s)
print('OK data.js')

# ============================================================
# ② map.js —— 据点段整体重写
# ============================================================
m = io.open(MAP, encoding='utf-8', newline='').read()

i = m.find('  GAME.map._fortHash = function (x, y, salt) {')
j = m.find('  GAME.map.fortGarrison = function (lv) {')
assert i > 0 and j > i, ('map span', i, j)
old_seg = m[i:j]

# 保底核对：旧段必须仍含这些锚（防上游已改过）
for must in ["return U.rng(h)();", "GAME.map.hasFort = function (x, y) {",
             "    if (!GAME.map.hasFort(x, y)) return null;",
             "var lvR = GAME.map._fortHash(x, y, 101 + day);"]:
    assert must in old_seg, ('map anchor missing: ' + must)

new_seg = """  /* 据点哈希（0~1）—— **全项目唯一**的据点随机口径。
     与旧写法 `U.rng(h)()` **逐位等价**（同一条 mulberry32 序列），只是把闭包内联：
     全图 25 万格枚举与每日排序都在热路径上，每次构一个闭包太贵。
     smoke 有一条断言逐点比对"内联版 == U.rng 版"（两处实现不许漂移）。 */
  GAME.map._fortHash = function (x, y, salt) {
    var h = (x * 73856093 ^ y * 19349663 ^ ((GAME.state.map.seed || 1) * 2654435761) ^ (salt * 83492791)) >>> 0;
    var a = h || 1;
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /* ============================================================
   * 据点「保护区」（出生点半径 + 名城 3×3）—— 唯一判据
   * ------------------------------------------------------------
   * 全图枚举时不可能逐格遍历城市表（25 万格 × 174 城 = 4300 万次比较），
   * 先把保护区摊成一个集合，枚举时 O(1) 查询。判据与旧内联循环逐字等价：
   *   · 出生点：|dx| ≤ safeRadius && |dy| ≤ safeRadius
   *   · 名城：  |dx| ≤ 1 && |dy| ≤ 1
   * 按 (seed, 出生点) 缓存 —— 出生点随所选州走（v70），seed 相同、州不同
   * 也会得到不同的保护区。
   * ============================================================ */
  GAME.map._fortBlockSet = function () {
    var s = GAME.state, F = DATA.FORT, W = DATA.MAP_W, H = DATA.MAP_H;
    var sp = (s.map && s.map.startPos) || DATA.START_POS;
    var seed = s.map.seed || 1;
    var cch = GAME.map._fortBlocks;
    if (cch && cch.seed === seed && cch.spx === sp.x && cch.spy === sp.y) return cch.set;
    var set = {}, x, y, i, c, R = F.safeRadius;
    for (y = sp.y - R; y <= sp.y + R; y++) {
      if (y < 0 || y >= H) continue;
      for (x = sp.x - R; x <= sp.x + R; x++) {
        if (x < 0 || x >= W) continue;
        set[y * W + x] = 1;
      }
    }
    var cs = (s.map && s.map.cities) || [];
    for (i = 0; i < cs.length; i++) {
      c = cs[i];
      for (y = c.y - 1; y <= c.y + 1; y++) {
        if (y < 0 || y >= H) continue;
        for (x = c.x - 1; x <= c.x + 1; x++) {
          if (x < 0 || x >= W) continue;
          set[y * W + x] = 1;
        }
      }
    }
    GAME.map._fortBlocks = { seed: seed, spx: sp.x, spy: sp.y, set: set };
    return set;
  };
  GAME.map._fortBlocked = function (x, y) {
    return !!GAME.map._fortBlockSet()[y * DATA.MAP_W + x];
  };
  /* 是否生有野外城池（确定性；**位置固定** —— 与"等级每日变化"各管一头） */
  GAME.map.hasFort = function (x, y) {
    var s = GAME.state, F = DATA.FORT;
    if (!F || !s.map.grid) return false;
    var t = GAME.map.tile(x, y);
    if (!t || t.terrain === 'city') return false;
    if (GAME.map._fortBlocked(x, y)) return false;
    return GAME.map._fortHash(x, y, 1) < F.density;
  };
  /* ============================================================
   * v89.88（老板需求 3）：据点等级 —— **构造性配额分布**
   * ------------------------------------------------------------
   * 老板：「普通城 8，9，10 级城分别占 30%，其他低级城均分 10%」。
   * 占比必须构造性成立（v89.72 的教训：161 样本掷点 σ≈3.9%，肉眼可见）：
   *   ① 全图候选格（位置，不含"日"纬度）按 seed 缓存一次（约 250k 格扫一遍）；
   *   ② 每个现实日，把候选按**当日哈希**排序 → 按名额切段：
   *        前 30% → Lv8 · 次 30% → Lv9 · 再 30% → Lv10 · 末 10% → 1~7 均分；
   *   ③ 当日结果按 (seed, 日) 缓存 —— 逐日重掷（"据点等级每日变化"不退役），
   *      同日稳定（渲染 / 面板 / 出征 / 战斗读的**同一份表**）。
   * ⚠️ 日 = 现实日（`GAME.questDayIndex`），与"据点次日重置 / 掠夺限一次"同一把尺子。
   * ============================================================ */
  GAME.map._fortCandidates = function () {
    var s = GAME.state, F = DATA.FORT, W = DATA.MAP_W, H = DATA.MAP_H;
    var sp = (s.map && s.map.startPos) || DATA.START_POS;
    var seed = s.map.seed || 1;
    var cch = GAME.map._fortCand;
    if (cch && cch.seed === seed && cch.spx === sp.x && cch.spy === sp.y && cch.list) return cch.list;
    var g = s.map.grid, bset = GAME.map._fortBlockSet();
    var list = [], x, y, t;
    for (y = 0; y < H; y++) {
      var row = g[y];
      if (!row) continue;
      for (x = 0; x < W; x++) {
        t = row[x];
        if (!t || t.terrain === 'city') continue;
        if (bset[y * W + x]) continue;
        if (GAME.map._fortHash(x, y, 1) >= F.density) continue;
        list.push(y * W + x);
      }
    }
    GAME.map._fortCand = { seed: seed, spx: sp.x, spy: sp.y, list: list };
    return list;
  };
  GAME.map._fortLevelTable = function (day) {
    var s = GAME.state, F = DATA.FORT, W = DATA.MAP_W;
    var sp = (s.map && s.map.startPos) || DATA.START_POS;
    var seed = s.map.seed || 1;
    var cch = GAME.map._fortLv;
    if (cch && cch.seed === seed && cch.spx === sp.x && cch.spy === sp.y && cch.day === day) return cch.map;
    var D = F.levelDist || { high: [8, 9, 10], highPct: 0.30 };
    var highs = (D.high || [8, 9, 10]).slice();
    /* 排序键先算好再排序（比较器里现算哈希 = 每次比较两个闭包，20k 规模直接卡顿） */
    var arr = GAME.map._fortCandidates().map(function (k) {
      return { k: k, r: GAME.map._fortHash(k % W, (k / W) | 0, 9001 + day) };
    });
    arr.sort(function (a, b) { return a.r - b.r; });
    var n = arr.length, map = {};
    var nTop = Math.round(n * (D.highPct == null ? 0.30 : D.highPct));
    var idx = 0, i, k;
    for (i = 0; i < highs.length; i++) {
      var end = Math.min(n, idx + nTop);
      for (; idx < end; idx++) { k = arr[idx].k; map[k] = highs[i]; }
    }
    /* 低档：剩余名额均分到 levelMin ~（高档最低 - 1）—— 轮转分配保证均匀 */
    var lows = [];
    for (var lv = F.levelMin; lv < highs[0]; lv++) lows.push(lv);
    if (lows.length) {
      for (i = 0; idx < n; idx++, i++) { k = arr[idx].k; map[k] = lows[i % lows.length]; }
    } else {
      for (; idx < n; idx++) { k = arr[idx].k; map[k] = F.levelMin; }
    }
    GAME.map._fortLv = { seed: seed, spx: sp.x, spy: sp.y, day: day, map: map };
    return map;
  };
  /* 某格在指定日的据点等级（0 = 不是据点格）—— 测试与读档恢复都读它 */
  GAME.map._fortLevelAt = function (day, x, y) {
    return GAME.map._fortLevelTable(day)[y * DATA.MAP_W + x] || 0;
  };
  /* 今日是否仍在（被攻取的据点次日重置） */
  GAME.map.fortRazedToday = function (x, y) {
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    return (s.fortsRazed || {})[x + ',' + y] === day;
  };
  GAME.map.fortAt = function (x, y) {
    var s = GAME.state, F = DATA.FORT;
    if (!F || !s.map.grid) return null;
    if (GAME.map.fortRazedToday(x, y)) return null;
    var t = GAME.map.tile(x, y);
    if (!t || t.terrain === 'city') return null;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var level = GAME.map._fortLevelAt(day, x, y);   /* 等级表 = 据点存在的唯一事实 */
    if (!level) return null;
    var a = Math.floor(GAME.map._fortHash(x, y, 7) * F.nameA.length);
    var b = Math.floor(GAME.map._fortHash(x, y, 13) * F.nameB.length);
    return { x: x, y: y, level: level, name: F.nameA[a] + F.nameB[b], kind: 'fort' };
  };
"""
m = m[:i] + new_seg + m[j:]
io.open(MAP, 'w', encoding='utf-8', newline='').write(m)
print('OK map.js')
print('done')
