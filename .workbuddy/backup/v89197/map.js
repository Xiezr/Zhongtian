/* ============================================================
 * map.js  全国地图（500×500 · 真实坐标 · 7地形 · 野地）
 * v42：地块改 2.5D「顶面 + 土色侧壁」两片；观察框内逐格绘制（不再用离屏全图层）
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  GAME.map = {};

  /* ============================================================
   * v89.43：**地形集中走势**（老板：「不要随机地形，按山地/湖泊/草原/荒漠等的
   *   集中走势，模拟实际地形」）
   * ------------------------------------------------------------
   * 旧做法：逐格独立掷点（TERRAIN_WEIGHTS）→ 相邻格几乎不相关，
   *   是"椒盐噪声"不是"地形"。
   * 新做法：**连续场 + 分位切分** ——
   *   ① 两张 fBm 连续场（elev 高程 / moist 湿度），由 seed 决定、逐点确定性；
   *      主波长 64 格（一条山脉/一片湖的尺度），叠 32 / 16 两层细节；
   *   ② 按 TERRAIN_WEIGHTS 的**目标占比**取分位点切分 —— 于是
   *      "成片"与"占比"同时成立：**场决定形状，权重决定多少**；
   *   ③ 切分顺序模拟真实地势：低洼 → 水（最深为湖泊、其次沼泽）·
   *      高地 → 山地 · 陆地中段按湿度：干 → 荒漠、湿 → 森林、居中 → 草原/平地。
   *   ④ 出生点 ±2 仍强制平原（P2-10：只有平原能筑新城，见下）。
   * ============================================================ */
  function nhash(ix, iy, salt) {
    var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2545f491);
    h ^= h >>> 13;
    return (h >>> 8) / 16777216;                 /* 0 ~ 1 */
  }
  /* 值噪声（格点哈希 + smoothstep 插值）。
     线性插值会让等值线出折角（看着像"方块田"），所以用 smoothstep。 */
  function vnoise(x, y, step, salt) {
    var fx = x / step, fy = y / step;
    var ix = Math.floor(fx), iy = Math.floor(fy);
    var tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    var a = nhash(ix, iy, salt), b = nhash(ix + 1, iy, salt);
    var c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt);
    var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx;
    return t0 + (t1 - t0) * ty;
  }
  /* fBm：三层叠加。
     波长口径（实测标定，探针 tools/probe/probe_terrain_size.js）：
       主波长 64 时团块平均 435 格（≈20×20）、最大 3700 —— 一屏 13×7 只剩一种地形，
       看着像"色块分区"而不是地形；收到 32 后团块均值实测 274（连片度 0.907）。
       v89.46（老板：「同类型地块太大，缩到 1/2~1/3」）：主波长 32 → 21，
       团块均值 274 → 139（≈1/2）、连片度 0.907 → 0.867；一屏可见更多片不同地形，
       既有走势又不单调。候选档位（探针实测）已记录在 AI工作备忘 §68。 */
  var FIELD_OCT = [[21, 0.55], [11, 0.30], [6, 0.15]];
  function fbm(x, y, salt) {
    var v = 0;
    for (var i = 0; i < FIELD_OCT.length; i++) {
      v += FIELD_OCT[i][1] * vnoise(x, y, FIELD_OCT[i][0], salt + i * 101);
    }
    return v;
  }
  /* 直方图分位点（bins 个桶，frac 为累计占比） */
  function qOf(hist, total, frac) {
    var want = total * frac, acc = 0;
    for (var i = 0; i < hist.length; i++) {
      acc += hist[i];
      if (acc >= want) return (i + 0.5) / hist.length;
    }
    return 1;
  }

  /* 生成地形网格（可复现 seed） */
  GAME.map.generate = function () {
    var s = GAME.state;
    if (!s.map.grid) {
      var w = DATA.MAP_W, h = DATA.MAP_H;
      var grid = [];
      /* ---- ① 连续场（按 2 格步长采样后双线性插值：25 万格只算 6 万次 fBm） ---- */
      var ST = 2, gw = Math.ceil(w / ST) + 1, gh = Math.ceil(h / ST) + 1;
      var seed0 = (s.map.seed || 1) | 0;
      var fe = new Float32Array(gw * gh), fm = new Float32Array(gw * gh);
      for (var gy2 = 0; gy2 < gh; gy2++) {
        for (var gx2 = 0; gx2 < gw; gx2++) {
          var px = gx2 * ST, py = gy2 * ST, kk = gy2 * gw + gx2;
          fe[kk] = fbm(px, py, seed0 * 7 + 11);      /* 高程场 */
          fm[kk] = fbm(px, py, seed0 * 7 + 77);      /* 湿度场 */
        }
      }
      function sampleF(arr, x, y) {
        var fx = x / ST, fy = y / ST;
        var ix = fx | 0, iy = fy | 0;
        var tx = fx - ix, ty = fy - iy;
        var x1 = Math.min(gw - 1, ix + 1), y1 = Math.min(gh - 1, iy + 1);
        var a = arr[iy * gw + ix], b = arr[iy * gw + x1];
        var c = arr[y1 * gw + ix], d = arr[y1 * gw + x1];
        var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx;
        return t0 + (t1 - t0) * ty;
      }
      var elev = new Float32Array(w * h), moist = new Float32Array(w * h);
      var BINS = 512, eh = new Int32Array(BINS), mh = new Int32Array(BINS);
      for (var yy = 0; yy < h; yy++) {
        for (var xx = 0; xx < w; xx++) {
          var id2 = yy * w + xx;
          var e = sampleF(fe, xx, yy), m = sampleF(fm, xx, yy);
          elev[id2] = e; moist[id2] = m;
          eh[Math.min(BINS - 1, (e * BINS) | 0)]++;
        }
      }
      /* ---- ② 按目标占比取分位点（场决定形状、权重决定多少） ---- */
      var TW = DATA.TERRAIN_WEIGHTS, WM = {};
      for (var wi = 0; wi < TW.length; wi++) WM[TW[wi][0]] = TW[wi][1];
      var total2 = w * h;
      var qLake = qOf(eh, total2, WM.lake);
      var qWater = qOf(eh, total2, WM.lake + WM.zhaoze);
      var qHill = qOf(eh, total2, 1 - WM.hill);
      /* 陆地（非水非山）单独建湿度直方图 —— 占比要按陆地数折算 */
      var landN = 0, landFrac = 1 - WM.lake - WM.zhaoze - WM.hill;
      for (var i2 = 0; i2 < total2; i2++) {
        if (elev[i2] >= qWater && elev[i2] < qHill) { mh[Math.min(BINS - 1, (moist[i2] * BINS) | 0)]++; landN++; }
      }
      var qDes = qOf(mh, landN, WM.desert / landFrac);
      var qFor = qOf(mh, landN, 1 - WM.forest / landFrac);
      var qCao = qOf(mh, landN, 1 - (WM.forest + WM.caoyuan) / landFrac);

      for (var y = 0; y < h; y++) {
        var row = [];
        for (var x = 0; x < w; x++) {
          var id3 = y * w + x, e3 = elev[id3], m3 = moist[id3], terrain;
          if (e3 < qLake) terrain = 'lake';
          else if (e3 < qWater) terrain = 'zhaoze';
          else if (e3 >= qHill) terrain = 'hill';
          else if (m3 < qDes) terrain = 'desert';
          else if (m3 >= qFor) terrain = 'forest';
          else if (m3 >= qCao) terrain = 'caoyuan';
          else terrain = 'plain';
          /* 出生点脚下一小片强制平原。
             ------------------------------------------------------------------
             为何要有这段：玩家开局只有一座城，而**只有平原才能筑新城**（P2-10）；
             若出生点恰好被湖泊/山地围住，会陷入"无地可拓"的死局。
             但原范围是 ±5（11×11 = 121 格），在 500×500 地图上一眼看过去
             "周边全是平地"、显得地图很假 —— 现收紧到 ±2（5×5 = 25 格），
             只保证城池脚下与紧邻一圈可用，四周立刻恢复真实地形。 */
          /* v70：出生点随"所选州"走（state.map.startPos）；旧档回退固定点 */
          var sp0 = s.map.startPos || DATA.START_POS;
          var sx = sp0.x, sy = sp0.y;
          if (Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2) terrain = 'plain';
          row.push({ x: x, y: y, terrain: terrain });
        }
        grid.push(row);
      }
      s.map.grid = grid;
      /* NPC 城由 seed 确定性重建（不入存档）。重建后要剔除**已被我方占领**的城，
         否则读档后刚打下的城会「复活」成 NPC 城。
         判定依据：玩家城池的 origId（onConquer 时写入）就是原 NPC 城 id。 */
      if (!s.map.cities) {
        s.map.cities = GAME.buildNpcCities(s.map.seed);
        var taken = {};
        (s.cities || []).forEach(function (c) { if (c.origId) taken[c.origId] = 1; });
        s.map.cities = s.map.cities.filter(function (c) { return !taken[c.id]; });
      }
      /* 城格标记 */
      s.cities.forEach(function (c) { var t = GAME.map.tile(c.x, c.y); if (t) t.terrain = 'city'; });
      s.map.cities.forEach(function (c) { var t = GAME.map.tile(c.x, c.y); if (t) t.terrain = 'city'; });
    }
    return s.map.grid;
  };

  GAME.map.tile = function (x, y) {
    var s = GAME.state;
    if (!s.map.grid) return null;
    if (x < 0 || y < 0 || y >= s.map.grid.length || x >= s.map.grid[0].length) return null;
    return s.map.grid[y][x];
  };

  GAME.map.playerCity = function () {
    return GAME.state.cities[0];
  };

  /* v89.43：城池位图 tier 取值口（地图渲染的唯一口径）。
     own 城 type 'self'（自建/首城）按 **county 档**出图 —— 玩家的城就是一座小城；
     攻占来的系统城保留原 type（capital/zhou/jun/county 各归各档）。 */
  GAME.map.cityArtKeyAt = function (x, y) {
    var s = GAME.state;
    var i, c;
    for (i = 0; i < (s.cities || []).length; i++) {
      c = s.cities[i];
      if (c.x === x && c.y === y) {
        return 'city_' + (!c.type || c.type === 'self' ? 'county' : c.type);
      }
    }
    for (i = 0; i < (s.map.cities || []).length; i++) {
      c = s.map.cities[i];
      if (c.x === x && c.y === y) return 'city_' + c.type;
    }
    return null;
  };

  /* v23（需求 1）：**玩家自己的城**在任何坐标 ——
     此前只认 state.cities[0]，于是自己攻下的第二座城在地图上被当成 NPC，
     点它反而弹出"出征"面板，等于能打自己。 */
  GAME.map.ownCityAt = function (x, y) {
    var cs = (GAME.state && GAME.state.cities) || [];
    for (var i = 0; i < cs.length; i++) if (cs[i].x === x && cs[i].y === y) return cs[i];
    return null;
  };

  GAME.map.npcAt = function (x, y) {
    var s = GAME.state;
    for (var i = 0; i < s.map.cities.length; i++) {
      var c = s.map.cities[i];
      if (c.x === x && c.y === y) return c;
    }
    return null;
  };

  /* 该格是否已被占领为野地 */
  GAME.map.wildAt = function (x, y) {
    var s = GAME.state;
    for (var i = 0; i < (s.wilds || []).length; i++) {
      if (s.wilds[i].x === x && s.wilds[i].y === y) return s.wilds[i];
    }
    return null;
  };

  /* 野地等级（可复现：seed 随机） */
  /* ============================================================
   * 野外城池（动态生成，不入存档）
   * ============================================================ */
  /* 据点哈希（0~1）—— **全项目唯一**的据点随机口径。
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
    if (!s || !s.map || !s.map.grid) return [];        /* 地图未生成 → 无候选 */
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
    if (!s || !s.map || !s.map.grid) return {};        /* 地图未生成 → 空表 */
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
  /* ============================================================
   * v89.196（老板 6）：前哨辐射范围 = **覆盖格的地块边界折线**（唯一出口）。
   * ------------------------------------------------------------
   * 老板原话：「不要（旋转扫描线），有点晃眼，静态圈就行，已涉及到最远的地块
   *   格子边界为边界（因此外周不是圆弧，而是地块的边界折线）」。
   * 口径：边界 = 覆盖格集合（dx²+dy² ≤ R²，与 GAME.fortAuraAt 判定**同源**）
   *   的**外轮廓** —— 每格的 4 条边中"邻格不在集合内"的那几条；
   *   等距投影下每条格边都是菱形斜线 → 外周呈锯齿折线（不再是圆弧）。
   * 缓存：段集合只与前哨**半径**有关（相对前哨中心的格坐标）→ 按 R 缓存，
   *   渲染时平移 + 投影（gxy 是线性映射，半整数角标可直代）。
   * 返回 { segs:[[x1,y1,x2,y2]…]（相对格坐标，含 ±0.5 角标）,
   *        ring:[[x,y]…]（外轮廓环，供填充）}。
   * ============================================================ */
  GAME.map.fortRingOf = function (R) {
    R = Math.max(1, Math.round(R || 0));
    var cache = GAME.map._fortRing = GAME.map._fortRing || {};
    if (cache[R]) return cache[R];
    var inside = {}, list = [];
    for (var dy = -R; dy <= R; dy++) {
      for (var dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= R * R) { inside[dx + ',' + dy] = 1; list.push([dx, dy]); }
      }
    }
    var segs = [];
    list.forEach(function (p) {
      var dx = p[0], dy = p[1];
      /* 四邻检查 → 外露边（端点用半整数角坐标：格 (dx,dy) 的角 = (dx±0.5, dy±0.5)） */
      if (!inside[dx + ',' + (dy - 1)]) segs.push([dx - 0.5, dy - 0.5, dx + 0.5, dy - 0.5]);
      if (!inside[dx + ',' + (dy + 1)]) segs.push([dx - 0.5, dy + 0.5, dx + 0.5, dy + 0.5]);
      if (!inside[(dx - 1) + ',' + dy]) segs.push([dx - 0.5, dy - 0.5, dx - 0.5, dy + 0.5]);
      if (!inside[(dx + 1) + ',' + dy]) segs.push([dx + 0.5, dy - 0.5, dx + 0.5, dy + 0.5]);
    });
    /* 环连接（填充用）：**无向走法** —— 段的方向不保证首尾同向（按格序生成），
       所以沿"当前端点 → 找另一条以它为端点的未用段 → 跳到该段另一端"走；
       网格边界的角点度数为 2（无对角接触时），必走出一个闭合环。
       ⚠️ 首版按"有向链"走（每段终点接下一段起点）——在端点方向不一致时会提前断链
       （实测 R1 环只连出 5/12 段，smoke 抓出）。 */
    var ends = {}, k2 = function (x, y) { return x + '|' + y; };
    segs.forEach(function (sg, i) {
      var a = k2(sg[0], sg[1]), b = k2(sg[2], sg[3]);
      (ends[a] = ends[a] || []).push(i);
      (ends[b] = ends[b] || []).push(i);
    });
    var ring = [], used = {}, guard = 0;
    var pt = [segs[0][0], segs[0][1]];
    var startK = k2(pt[0], pt[1]);
    while (guard++ < segs.length + 8) {
      var pk = k2(pt[0], pt[1]);
      var hit = -1;
      (ends[pk] || []).forEach(function (i2) { if (hit < 0 && !used[i2]) hit = i2; });
      if (hit < 0) break;
      used[hit] = 1;
      var sg2 = segs[hit];
      var npt = (k2(sg2[0], sg2[1]) === pk) ? [sg2[2], sg2[3]] : [sg2[0], sg2[1]];
      ring.push(pt);
      pt = npt;
      if (k2(pt[0], pt[1]) === startK) break;       /* 回起点 = 闭合 */
    }
    var out = { segs: segs, ring: ring };
    cache[R] = out;
    return out;
  };
  GAME.map.fortRazedToday = function (x, y) {
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    return (s.fortsRazed || {})[x + ',' + y] === day;
  };
  GAME.map.fortAt = function (x, y) {
    var s = GAME.state, F = DATA.FORT;
    if (!F || !s.map.grid) return null;
    if (GAME.map.fortRazedToday(x, y)) return null;
    /* v89.103（老板「拔除据点可以占据该据点」）：已据为己有的格子**永久**不再生成据点 ——
       与 fortsRazed（当日标记，次日重置）不同：那一格现在是我方一座城（s.cities 里）。 */
    if ((s.fortsTaken || {})[x + ',' + y]) return null;
    var t = GAME.map.tile(x, y);
    if (!t || t.terrain === 'city') return null;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var level = GAME.map._fortLevelAt(day, x, y);   /* 等级表 = 据点存在的唯一事实 */
    if (!level) return null;
    var a = Math.floor(GAME.map._fortHash(x, y, 7) * F.nameA.length);
    var b = Math.floor(GAME.map._fortHash(x, y, 13) * F.nameB.length);
    return { x: x, y: y, level: level, name: F.nameA[a] + F.nameB[b], kind: 'fort' };
  };
  GAME.map.fortGarrison = function (lv) {
    var F = DATA.FORT;
    var mul = (DATA.EXPEDITION && DATA.EXPEDITION.garrisonMul) || 1;
    var base = Math.round(F.garrisonBase * Math.pow(F.garrisonGrowth, lv - 1) * mul);
    return {
      yibing: Math.round(base * 0.35), changqiang: Math.round(base * 0.25),
      daodun: Math.round(base * 0.2), gongjian: Math.round(base * 0.2),
      qingji: lv >= 4 ? Math.round(base * 0.1) : 0,
    };
  };
  /* ============================================================
   * v89.129（老板：「任何野外目标（野地，城池，名城等）均应有将领带领，
   *   根据等级配备相称资质和等级的将领」）——**据点守将**（唯一出口）：
   * ------------------------------------------------------------
   * 缺口修复：此前据点只有守军没有守将 ——
   *   ① 战斗侧 `scGen = t.guard || null` 恒 null（守方不吃将领加成、不参加斗将）；
   *   ② 侦查面板"守将"行恒显示「无（守军无将，即无加成）」——与其他野外目标不一致。
   * 口径（"相称" = 按据点等级配置 · v89.185 老板 2 定稿）：
   *   · 资质：**名世**（`GAME.guardRankIdxOf('fort', lv)`；老板：「据点则为名世」）；
   *   · 等级：`base + (lv−1)×perLv + rand(jit)`（DATA.FORT_GUARD_LV）
   *     —— lv1 → 60~69、lv10 → 150~159（老板：「等级60起步-150级」）；
   *   · **必有**（非概率：野地贼寇可无大当家，据点是有建制的守备军）；
   *   · **确定性**：名字 / 资质 / 等级 / 特性 / 四维全部按 (x, y, level) + map seed
   *     经 `_fortHash` 派生 —— 同一天"侦查看到的"与"打起来遇到的"必然是同一人；
   *   · 每日随据点等级刷新（level 变则人变）；不存档、不占 generals 列表
   *     （与 npcCityGuard / wildDefenseAt 同族 —— 接触时派生）。
   * ============================================================ */
  GAME.fortGuardOf = function (fort) {
    if (!fort) return null;
    var lv = Math.max(1, Math.min(10, fort.level | 0));
    /* 确定性 rng 流：同一 (x,y,level) 每次产出同一个人（含四维）。
       level 混进种子 —— 每个"据点形态"是一位独立的守备官
       （不同等级不再是"同一个人忽高忽低"，而是不同规模的守备军官）。 */
    var rand = U.rng((Math.floor(GAME.map._fortHash(fort.x, fort.y, 23) * 4294967295) ^ (lv * 83492791)) >>> 0);
    var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('fort', lv)];   /* v89.129：唯一出口 */
    /* v89.185（老板 2）：「据点则为名世，等级60起步-150级」—— DATA.FORT_GUARD_LV */
    var LG = DATA.FORT_GUARD_LV || { base: 60, perLv: 10, jit: 10 };
    var gLv = LG.base + Math.max(0, lv - 1) * LG.perLv + Math.floor(rand() * LG.jit);
    /* 名字走守备军官系池（太守/都尉一系；与野地贼寇、客栈招募都不重名） */
    var sn = DATA.NPC_GUARD_SURNAME, gv = DATA.NPC_GUARD_GIVEN, tt = DATA.NPC_GUARD_TITLE;
    var name = sn[Math.floor(rand() * sn.length)] + gv[Math.floor(rand() * gv.length)];
    /* 特性：抽一门（与 npcCityGuard 同款权重抽签 —— 猛将/智将有偏科，战报有戏） */
    var styles = DATA.GEN_STYLES || [{ id: 'balance', name: '均衡', w: 1, mul: { tong: 1, nz: 1, yw: 1, zm: 1 } }];
    var stTotal = 0;
    styles.forEach(function (x) { stTotal += (x.w || 0); });
    var rollS = rand() * (stTotal || 1), st = styles[0];
    for (var si = 0; si < styles.length; si++) {
      rollS -= (styles[si].w || 0);
      if (rollS <= 0) { st = styles[si]; break; }
    }
    var g = GAME.makeGeneral(name, gLv, 'guard', null, false, rk.id, st.id, rand);
    GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：等级/资质真转战力（野外守将折损半折） */
    g.npcGuard = true;                        /* 系统派生标记（与 npcCityGuard 同） */
    g.title = tt[Math.floor(rand() * tt.length)];
    return g;
  };
  GAME.map.razeFort = function (x, y) {
    var s = GAME.state;
    s.fortsRazed = s.fortsRazed || {};
    s.fortsRazed[x + ',' + y] = GAME.questDayIndex ? GAME.questDayIndex() : 0;
  };
  /* v89.103（老板「拔除据点可以占据该据点」）：**永久**占据登记（唯一出口）。
     与 fortsRazed 的分工：那张表只管"今天不再出现"，次日重置；
     这张表是"这格已经是我的城了"，永不失效 —— `fortAt` 读到它就直接返回 null，
     于是渲染 / 出征目标 / 自动出征 / 侦查**全部**看不到它（一个出口，处处生效）。 */
  GAME.map.markFortTaken = function (x, y, cityId) {
    var s = GAME.state;
    if (!s) return null;
    s.fortsTaken = s.fortsTaken || {};
    s.fortsTaken[x + ',' + y] = { day: GAME.questDayIndex ? GAME.questDayIndex() : 0, cityId: cityId || null };
    return s.fortsTaken[x + ',' + y];
  };
  /* ============================================================
   * 野外城池的**每日掠夺上限**（v63 · 老板：「野外城每天只能被掠夺一次」）
   * ------------------------------------------------------------
   * 与 `fortsRazed` 同一套记法：键 = 'x,y'，值 = 游戏日索引。
   * 只按"日"比较，过一天自动失效 —— 不需要定时清理，也不会随存档膨胀
   * （每天最多留几行，且同一格只会被覆盖）。
   * 之所以要拦：掠夺（raid）**不破城**（只有占领才 raze），同一座据点
   * 一天内可以反复刷 —— 财货、材料、珠宝、军械全部可以无限取。
   * ============================================================ */
  GAME.map.fortRaidedToday = function (x, y) {
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    return (s.fortRaids || {})[x + ',' + y] === day;
  };
  GAME.map.markFortRaided = function (x, y) {
    var s = GAME.state;
    s.fortRaids = s.fortRaids || {};
    s.fortRaids[x + ',' + y] = GAME.questDayIndex ? GAME.questDayIndex() : 0;
  };
  /* 视口内所有野外城池（供渲染与提示） */
  GAME.map.fortsInView = function (vx, vy, spanX, spanY) {
    var out = [];
    if (spanY == null) spanY = spanX;              // 旧调用（方形视口）保持可用
    for (var y = vy; y < vy + spanY; y++) {
      for (var x = vx; x < vx + spanX; x++) {
        var f = GAME.map.fortAt(x, y);
        if (f) out.push(f);
      }
    }
    return out;
  };

  /* ------------------------------------------------------------
   * 野地等级（v15：动态）
   *  · 无主野地：基础 hash + 现实日 —— **每日 +1 级**（模 11 循环），
   *    因此无需为 25 万格存储状态，且"高等级野地会自己长出来"
   *  · 被占野地：用 state.wilds[].level（占领时快照），**每现实日 −1 级**，
   *    由 GAME.decayWilds() 结算 —— 迫使玩家轮换争夺
   *  · 取"当前实际等级"一律用 GAME.wildLevelNow(x,y)
   * ------------------------------------------------------------ */
  /* v89.56（老板）：野地等级**局部成团、按类型分野、居中更高**——
     旧做法（v89.43）用「到地图中心的归一化距离」做基准（中心 9 → 边角 0），
     结果整张地图中央一大片高等级、四边一大片低等级，且不分地形类型全都一样 ——
     老板判定"异常集中、不合常理"。
     新做法：
       · 去掉全局中心距离项，改用**局部值噪声场**（两层 octave，主波长 ~9~17 格），
         等级随坐标平滑起伏 —— 自然形成"小范围团块"，块内中心高、边缘低，
         正合老板要的"在小范围同类地块中，越居中的等级越高"；
       · **按地形类型加盐**（per-terrain salt），使不同地形有各自独立的等级场，
         避免"所有地块不分类型等级高的聚拢在一起"；
       · 保留少量确定性例外（约 4% 边陲秘境 8~10 级、约 4% 腹地弱地 0~2 级），
         让地图有可远征的高价值点与新手软柿子，用坐标哈希、同 seed 完全复现。 */
  GAME.map.wildLevelBase = function (x, y) {
    var sd = (GAME.state.map.seed || 1) | 0;
    var tile = GAME.map.tile(x, y);
    var tn = tile ? (tile.terrain || 'plain') : 'plain';
    /* 地形名 → 稳定盐（让每种地形有独立的等级场） */
    var tSalt = 0;
    for (var _i = 0; _i < tn.length; _i++) tSalt = (tSalt * 31 + tn.charCodeAt(_i)) >>> 0;
    /* 局部平滑场（两层 octave）：主波长稍小 → 团块尺度 ~9~17 格，
       既"成团"又不会一大片同值；频率错开避免栅格感 */
    var n1 = vnoise(x, y, 9, sd * 13 + (tSalt % 997));
    var n2 = vnoise(x, y, 17, sd * 7 + (tSalt % 991));
    var field = n1 * 0.72 + n2 * 0.28;
    var lv = Math.round(field * 10);
    /* 少量确定性例外（坐标哈希，跨引擎一致） */
    var r = nhash(x, y, sd * 3 + 991);
    if (r < 0.04) lv = 8 + Math.floor(nhash(x, y, sd + 771) * 3);       /* 边陲秘境 */
    else if (r > 0.96) lv = Math.floor(nhash(x, y, sd + 772) * 3);      /* 腹地弱地 */
    return Math.max(0, Math.min(10, lv));
  };
  GAME.map.wildLevel = function (x, y) {
    var day = Math.floor(Date.now() / 86400000);
    return (GAME.map.wildLevelBase(x, y) + day) % 11;   // 每日 +1 级（模 11 循环）
  };
  /* 当前实际等级：已占野地用记录值（会衰减），无主野地用日盐值 */
  GAME.map.wildLevelNow = function (x, y) {
    var w = GAME.map.wildAt(x, y);
    if (w && w.level != null) return w.level;
    return GAME.map.wildLevel(x, y);
  };

  /* --------- 离屏地形层（v22 遗留，v42 删除） ---------
     当年为"25 万格每帧重绘太慢"做过一整块离屏地形层（offCanvas + 一次性
     putImageData）；v26 改**观察框**后每帧只画 span×span 格，这块就再没被调用，
     连它的 hexToRgb / TERRAIN_RGB 缓存一起成了死代码 —— 至此整簇删除。
     （audit 只看 GAME.x = / ui.x = 这类赋值，闭包内的局部函数它看不见，
      所以这类残留只能靠"局部函数零调用"普查来抓。） */

  /* ============================================================
   * 视口渲染：只绘制 span×span 格（默认 12×12，每格 44px）
   * 全图 500×500 直接铺满 canvas 时每格不足 2px，图标变像素点、无法点击；
   * 改为观察框 + 平移导航后，格子足够大，图标与点击都可用。
   * ============================================================ */
  /* --------- 矢量绘制：野地与城池（不再使用 emoji 字体） ---------
     v42：`tri`（三点多边形）随 v30 的装饰重绘一起失去调用点 —— 一并删除。 */
  function dot(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function seg(ctx, x1, y1, x2, y2, col, w) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.lineTo(x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.lineTo(x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.lineTo(x, y + h - r);
    ctx.lineTo(x, y + r); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }
  /* ============================================================
   * v30 贴图升级：对齐原版「暗框亮画面」——
   *   草丛/小花、塔形密林、层叠山体、波光湖面、沙丘、芦苇泽。
   * ============================================================ */
  /* 草丛：三笔草叶（固定形状，无随机，保证每帧渲染一致） */
  function grassTuft(ctx, x, y, u) {
    ctx.strokeStyle = 'rgba(58,96,30,.85)';
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 1.6 * u, y - 2.6 * u, x - 2.6 * u, y - 5.2 * u);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.4 * u, y - 3.4 * u, x + 0.2 * u, y - 6.2 * u);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1.8 * u, y - 2.6 * u, x + 3.0 * u, y - 4.6 * u);
    ctx.stroke();
  }
  /* 小花：白瓣黄心 */
  function flower(ctx, x, y, u) {
    dot(ctx, x, y, 1.6 * u, 'rgba(248,244,224,.95)');
    dot(ctx, x, y, 0.75 * u, '#e0b23e');
  }
  /* 松塔一层：三角形，左亮右暗 */
  function tier(ctx, x, yBase, hw, hh, hi, lo) {
    var g = ctx.createLinearGradient(x - hw, yBase - hh, x + hw, yBase);
    g.addColorStop(0, hi); g.addColorStop(1, lo);
    ctx.beginPath();
    ctx.moveTo(x, yBase - hh);
    ctx.lineTo(x + hw, yBase);
    ctx.lineTo(x - hw, yBase);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
  }
  /* 一棵塔形松树（v30：三层塔冠 + 落影 + 亮暗面） */
  function drawTree(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(28,52,18,.28)';
    ctx.beginPath(); ctx.ellipse(x + 1 * s, y + 0.8 * s, 5.4 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5f3d1f';
    ctx.fillRect(x - 1.1 * s, y - 3.6 * s, 2.2 * s, 4 * s);
    tier(ctx, x, y - 2.2 * s, 6.0 * s, 6.6 * s, '#31622a', '#1f441c');
    tier(ctx, x, y - 6.6 * s, 4.8 * s, 5.8 * s, '#3d7434', '#295422');
    tier(ctx, x, y - 10.6 * s, 3.5 * s, 4.8 * s, '#4c8a3e', '#33642a');
  }
  /* 山体：主三角 + 左上受光面 + 山脊折线 */
  function mountain(ctx, xBase, yBase, hw, hh, hi, lo) {
    var g = ctx.createLinearGradient(xBase - hw, yBase - hh, xBase + hw, yBase);
    g.addColorStop(0, hi); g.addColorStop(1, lo);
    ctx.beginPath();
    ctx.moveTo(xBase, yBase - hh);
    ctx.lineTo(xBase + hw, yBase);
    ctx.lineTo(xBase - hw, yBase);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xBase, yBase - hh);
    ctx.lineTo(xBase + hw * 0.30, yBase - hh * 0.40);
    ctx.lineTo(xBase - hw * 0.08, yBase - hh * 0.26);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,252,238,.32)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,60,40,.30)';
    ctx.lineWidth = Math.max(1, hw * 0.05);
    ctx.beginPath();
    ctx.moveTo(xBase, yBase - hh);
    ctx.lineTo(xBase + hw * 0.16, yBase - hh * 0.62);
    ctx.lineTo(xBase + hw * 0.05, yBase - hh * 0.40);
    ctx.stroke();
  }
  /* ============================================================
   * v50-c：**等距立体绘制**的原语（老板："通过绘图呈现立体感"）
   * ------------------------------------------------------------
   * 之前城池是把"正交俯视平面图"做等距变换 —— 轮廓贴合了，但建筑没有高度。
   * 现在全部程序化绘制：每个构件都是一个**等距盒体**
   *   （顶面菱形 + 左下立面 + 右下立面），由下往上堆叠。
   * 立体感来自三件事：
   *   ① 顶面 > 左面 > 右面 的明度差（光源取左上）；
   *   ② 构件之间的高低差（主楼高于角楼、角楼高于城墙）；
   *   ③ 每层顶面留一道受光亮线，构件分界一眼可辨。
   * 所有尺寸以**地块顶面宽 baseW** 为基准，不写死像素 —— 换分辨率自适应。
   * ============================================================ */
  /* 等距盒体的三块几何（底面中心 (cx,cy)，底面宽 w、高 w/2，向上挤出 h） */
  function isoBoxFaces(cx, cy, w, h) {
    var hw = w / 2, hh = w / 4, ty = cy - h;
    return {
      hw: hw, hh: hh, ty: ty,
      top: [[cx, ty - hh], [cx + hw, ty], [cx, ty + hh], [cx - hw, ty]],
      left: [[cx - hw, ty], [cx, ty + hh], [cx, cy + hh], [cx - hw, cy]],
      right: [[cx, ty + hh], [cx + hw, ty], [cx + hw, cy], [cx, cy + hh]]
    };
  }
  function polyFill(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  /* 画一个等距盒体：右面 → 左面 → 顶面（顶面最后画，上棱才干净）
     col = [顶面色, 左面色, 右面色]；lit = 顶棱亮线颜色。返回几何供上层堆叠（ty 即下层顶面中心）。 */
  function isoBox(ctx, cx, cy, w, h, col, lit) {
    var f = isoBoxFaces(cx, cy, w, h);
    polyFill(ctx, f.right, col[2]);
    polyFill(ctx, f.left, col[1]);
    polyFill(ctx, f.top, col[0]);
    if (lit) {
      ctx.strokeStyle = lit;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(f.top[3][0], f.top[3][1] + 0.5);
      ctx.lineTo(f.top[0][0], f.top[0][1] + 0.5);
      ctx.lineTo(f.top[1][0], f.top[1][1] + 0.5);
      ctx.stroke();
    }
    return f;
  }
  /* 四坡屋顶：底菱形 → 顶脊小菱形。只画朝南的两个坡 + 脊面（背面被自身挡住）。 */
  function isoRoof(ctx, cx, cy, w, h, col) {
    var hw = w / 2, hh = w / 4, ty = cy - h;
    var tw = w * 0.20, thw = tw / 2, thh = tw / 4;
    polyFill(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, ty + thh], [cx - thw, ty]], col[1]);
    polyFill(ctx, [[cx, cy + hh], [cx + hw, cy], [cx + thw, ty], [cx, ty + thh]], col[2]);
    polyFill(ctx, [[cx, ty - thh], [cx + thw, ty], [cx, ty + thh], [cx - thw, ty]], col[0]);
  }
  function drawTerrainArt(ctx, terrain, px, py, S) {
    var u = S / 44, cx = px + S / 2, by = py + S * 0.82;
    switch (terrain) {
      case 'plain':
        grassTuft(ctx, px + 0.22 * S, by, u);
        grassTuft(ctx, px + 0.56 * S, by - 3 * u, u * 0.9);
        grassTuft(ctx, px + 0.78 * S, by + 1.6 * u, u * 0.75);
        flower(ctx, px + 0.38 * S, by - 4.6 * u, u);
        flower(ctx, px + 0.70 * S, by - 0.6 * u, u * 0.85);
        break;
      case 'caoyuan':
        grassTuft(ctx, px + 0.18 * S, by, u * 1.05);
        grassTuft(ctx, px + 0.40 * S, by - 2.6 * u, u);
        grassTuft(ctx, px + 0.60 * S, by, u * 1.1);
        grassTuft(ctx, px + 0.80 * S, by - 1.8 * u, u * 0.9);
        flower(ctx, px + 0.30 * S, by - 5 * u, u);
        flower(ctx, px + 0.70 * S, by - 4 * u, u);
        break;
      case 'zhaoze':
        /* 两处浅洼 + 三茎芦苇（穗顶） */
        ctx.fillStyle = 'rgba(52,96,88,.78)';
        ctx.beginPath(); ctx.ellipse(px + 0.30 * S, py + 0.68 * S, 0.16 * S, 0.085 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(96,150,140,.5)';
        ctx.beginPath(); ctx.ellipse(px + 0.27 * S, py + 0.66 * S, 0.09 * S, 0.04 * S, 0, 0, Math.PI * 2); ctx.fill();
        [0.62, 0.72, 0.80].forEach(function (fx, i) {
          var rx = px + fx * S, ry = py + 0.72 * S;
          seg(ctx, rx, ry, rx + (i - 1) * 1.6 * u, ry - 12 * u, 'rgba(74,104,44,.95)', 1.5 * u);
          dot(ctx, rx + (i - 1) * 2.2 * u, ry - 12.5 * u, 1.6 * u, '#a8894a');
        });
        break;
      case 'lake':
        /* 沙岸 → 径向渐变湖体 → 波光弧 */
        ctx.fillStyle = '#cdbb7c';
        ctx.beginPath(); ctx.ellipse(cx, py + 0.60 * S, 0.40 * S, 0.30 * S, 0, 0, Math.PI * 2); ctx.fill();
        var wg = ctx.createRadialGradient(cx - 0.08 * S, py + 0.52 * S, 0.02 * S, cx, py + 0.60 * S, 0.42 * S);
        wg.addColorStop(0, '#82c4e6'); wg.addColorStop(0.55, '#4a90be'); wg.addColorStop(1, '#2f6b9a');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.ellipse(cx, py + 0.60 * S, 0.345 * S, 0.25 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.62)';
        ctx.lineWidth = Math.max(1, 1.3 * u); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx - 0.05 * S, py + 0.58 * S, 0.13 * S, Math.PI * 1.12, Math.PI * 1.72); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + 0.07 * S, py + 0.66 * S, 0.10 * S, Math.PI * 1.1, Math.PI * 1.78); ctx.stroke();
        break;
      case 'forest':
        /* 密林：一大两小 + 灌木点缀 */
        drawTree(ctx, px + 0.28 * S, by, 0.95 * u);
        drawTree(ctx, px + 0.72 * S, by + 1.4 * u, 0.78 * u);
        drawTree(ctx, cx + 0.02 * S, by - 2.4 * u, 1.08 * u);
        dot(ctx, px + 0.14 * S, by - 0.6 * u, 2.6 * u, '#2f5c26');
        dot(ctx, px + 0.88 * S, by - 1.2 * u, 2.2 * u, '#356428');
        break;
      case 'desert':
        /* 两道沙丘（亮顶暗腹）+ 沙纹 + 石粒 */
        ctx.fillStyle = '#e6cc8e';
        ctx.beginPath();
        ctx.moveTo(px + 0.04 * S, py + 0.92 * S);
        ctx.quadraticCurveTo(px + 0.30 * S, py + 0.44 * S, px + 0.58 * S, py + 0.92 * S);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(150,116,54,.42)';
        ctx.beginPath();
        ctx.moveTo(px + 0.30 * S, py + 0.665 * S);
        ctx.quadraticCurveTo(px + 0.46 * S, py + 0.76 * S, px + 0.58 * S, py + 0.92 * S);
        ctx.lineTo(px + 0.30 * S, py + 0.92 * S);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8ba76';
        ctx.beginPath();
        ctx.moveTo(px + 0.42 * S, py + 0.94 * S);
        ctx.quadraticCurveTo(px + 0.68 * S, py + 0.56 * S, px + 0.96 * S, py + 0.94 * S);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,124,56,.6)';
        ctx.lineWidth = Math.max(1, 1.2 * u);
        ctx.beginPath(); ctx.moveTo(px + 0.08 * S, py + 0.80 * S); ctx.quadraticCurveTo(px + 0.16 * S, py + 0.77 * S, px + 0.24 * S, py + 0.80 * S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 0.66 * S, py + 0.84 * S); ctx.quadraticCurveTo(px + 0.74 * S, py + 0.81 * S, px + 0.82 * S, py + 0.84 * S); ctx.stroke();
        dot(ctx, px + 0.88 * S, py + 0.72 * S, 1.8 * u, '#a8874c');
        break;
      case 'hill':
        /* 层叠双山 + 岩石纹 + 草坡脚 */
        ctx.fillStyle = 'rgba(96,120,58,.5)';
        ctx.beginPath(); ctx.ellipse(cx, by + 1.6 * u, 0.42 * S, 0.07 * S, 0, 0, Math.PI * 2); ctx.fill();
        mountain(ctx, px + 0.30 * S, by + 1.2 * u, 0.30 * S, 0.44 * S, '#c3b696', '#8f8266');
        mountain(ctx, px + 0.68 * S, by + 1.6 * u, 0.36 * S, 0.62 * S, '#d2c6a4', '#9c8f6e');
        seg(ctx, px + 0.58 * S, py + 0.62 * S, px + 0.66 * S, py + 0.66 * S, 'rgba(88,76,52,.4)', 1 * u);
        seg(ctx, px + 0.64 * S, py + 0.50 * S, px + 0.72 * S, py + 0.55 * S, 'rgba(88,76,52,.32)', 1 * u);
        break;
    }
  }

  /* ============================================================
   * v50-c：**等距立体城池**（老板："通过绘图呈现立体感"）
   * ------------------------------------------------------------
   * 层次（由下往上）：台基（都/州）→ 城墙 → 角楼 + 门楼 → 中央主楼 → 四坡屋顶
   *   → 都/州再叠一层小阁楼；玩家城插一面绿旗。
   * 四档规模：都（大 + 金瓦）> 州 > 郡 > 县（夯土 + 茅顶）。
   * 参数口径：cx,cy = **底面中心**；baseW = 地块顶面宽（菱形宽）。
   * ============================================================ */
  function drawCityArt(ctx, cx, cy, baseW, opts) {
    opts = opts || {};
    var cap = !!opts.cap, zhou = !!opts.zhou, jun = !!opts.jun, own = !!opts.player;
    var big = cap || zhou || jun;
    var WALL = cap ? ['#e3d2a8', '#c6ae80', '#8d7852']
      : zhou ? ['#d8c8a0', '#baa87c', '#837252']
        : ['#cdbb92', '#ad9a70', '#78694c'];
    var ROOF = cap ? ['#f2d182', '#d1b060', '#9e813e']
      : zhou ? ['#bb7259', '#99563f', '#6d3c2c']
        : ['#a96c54', '#88523d', '#60382b'];
    var STONE = ['#a89c86', '#8d8371', '#6a6255'];

    var y = cy;                                    /* 当前层的底面中心 y */
    /* ① 台基：把城抬一级，与地块拉开层次 */
    if (big) {
      var hb = baseW * 0.05;
      isoBox(ctx, cx, y, baseW * 0.88, hb, STONE, 'rgba(255,255,255,.16)');
      y -= hb;
    }
    /* ② 城墙：实心盒 + 顶面内院地坪（读起来才像"一圈墙"而不是一块台） */
    var ww = baseW * (cap ? 0.78 : zhou ? 0.74 : 0.68);
    var hw2 = baseW * (cap ? 0.17 : zhou ? 0.155 : 0.14);
    var fw = isoBox(ctx, cx, y, ww, hw2, WALL, 'rgba(255,255,255,.22)');
    y = fw.ty;
    polyFill(ctx, isoBoxFaces(cx, y + hw2 * 0.07, ww * 0.74, 0).top, 'rgba(40,34,24,.30)');

    /* ③ 角楼 ×2（左 / 右）+ 门楼 ×1（下，即朝南那一角） */
    var tw = ww * (cap ? 0.20 : zhou ? 0.19 : 0.17);
    var th = baseW * (cap ? 0.11 : zhou ? 0.10 : 0.085);
    [[cx - fw.hw * 0.80, y, false], [cx + fw.hw * 0.80, y, false],
      [cx, y + fw.hh * 0.80, true]].forEach(function (p) {
      var isGate = p[2];
      var bw2 = isGate ? tw * 1.25 : tw;
      var bh2 = isGate ? th * 1.25 : th;
      var by = p[1] + fw.hh * 0.10;
      var f2 = isoBox(ctx, p[0], by, bw2, bh2, WALL, 'rgba(255,255,255,.22)');
      isoRoof(ctx, p[0], f2.ty, bw2 * 1.15, bh2 * 0.75, ROOF);
      if (isGate) {
        /* 门洞：在门楼朝南的立面上开一个暗口 */
        polyFill(ctx, [[p[0] - bw2 * 0.16, by - bh2 * 0.18], [p[0] + bw2 * 0.16, by - bh2 * 0.18],
          [p[0] + bw2 * 0.16, by], [p[0] - bw2 * 0.16, by]], 'rgba(28,20,12,.82)');
      }
    });

    /* ④ 中央主楼 + 四坡顶 */
    var mw = ww * (cap ? 0.40 : zhou ? 0.37 : 0.34);
    var mh = baseW * (cap ? 0.20 : zhou ? 0.18 : 0.15);
    var fm = isoBox(ctx, cx, y + fw.hh * 0.07, mw, mh, WALL, 'rgba(255,255,255,.22)');
    isoRoof(ctx, cx, fm.ty, mw * 1.24, mh * 0.62, ROOF);
    var topY = fm.ty - mh * 0.62;
    if (big) {
      /* 都 / 州：主楼之上再叠一座小阁楼（两级屋顶 = 更高的等级感） */
      var f2b = isoBox(ctx, cx, topY, mw * 0.52, mh * 0.40, WALL, 'rgba(255,255,255,.20)');
      isoRoof(ctx, cx, f2b.ty, mw * 0.52 * 1.26, mh * 0.38, ROOF);
      topY = f2b.ty - mh * 0.38;
    }
    /* ⑤ 玩家城：插绿旗（"这是你的城"从格框延伸到建筑本身） */
    if (own) {
      ctx.strokeStyle = '#f0f4e8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, topY - baseW * 0.20);
      ctx.stroke();
      polyFill(ctx, [[cx, topY - baseW * 0.20], [cx + baseW * 0.085, topY - baseW * 0.163],
        [cx, topY - baseW * 0.126]], '#7bc96f');
    } else {
      /* ⑥ 名城旗：城楼顶立一面小旗，强化"城"的识别度（按档位配色） */
      var bcol = cap ? '#e0503e' : zhou ? '#e8b13a' : '#5a8fd0';
      ctx.strokeStyle = 'rgba(40,30,20,.92)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, topY - baseW * 0.14);
      ctx.stroke();
      polyFill(ctx, [[cx, topY - baseW * 0.14], [cx + baseW * 0.11, topY - baseW * 0.105],
        [cx, topY - baseW * 0.07]], bcol);
    }
  }

  /* 每种地形一组[亮,暗]双色（v30 提亮为鲜草绿系） */
  var TERRAIN_TINT = {
    /* v41（需求 5）：平地**不放任何图形**，靠底色表达 —— 老板指定"浅青绿色"。
       平地在观察框里动辄十几格，每格都摆一件小东西等于满屏噪声；
       留白反而让有图形的野地（湖/林/山）跳出来。 */
    /* v45（需求 1）：老板说「野地现在区分度不好」。查旧值后问题很清楚 ——
       七种地形**塌成了两个色族**，族内几乎分不开：
         绿族：草原 #aec66e / 沼泽 #8aab5c / 森林 #6ba14e（色相 90~100°、亮度 48~60）
         土族：荒漠 #e2c684 / 山地 #b3a17c / 城池 #c09a5c（色相 35~45°、亮度 55~70）
       重排原则：**色相拉开 + 明度分档 + 同名色相时用饱和度兜底**。
         平原 150°/L86/S35 浅青绿最亮 ｜ 草原  72°/L60/S58 亮黄绿
         森林 106°/L42/S45 深饱和绿     ｜ 沼泽 137°/L42/S14 暗青灰绿（低饱和）
         荒漠  43°/L78/S74 浅沙黄（高明度高饱和）｜ 山地 43°/L56/S10 冷灰岩（同色相、几乎无饱和）
         湖泊 205°/L61/S65 蓝          ｜ 城池  36°/L56/S44 暖金（画的是城，底色只作衬）
       任意两族至少在「色相 / 明度 / 饱和度」三维里有一维明显拉开。 */
    plain: ['#cfe8d8', '#b3d8c2'],
    caoyuan: ['#bcd45f', '#9cb63f'],
    zhaoze: ['#5c7a63', '#3d5546'],
    lake: ['#5aa8dd', '#2f6fa6'],
    forest: ['#4f9a3a', '#2f6b25'],
    desert: ['#f0daa0', '#d6b96e'],
    hill: ['#9a9484', '#6f6a5c'],
    city: ['#c09a5c', '#a07c44'],
  };

  /* v41（需求 5）：野地名称 —— 老板要求"在图标中显示名称（如湖泊）"。
     唯一取值口：地图绘制与浮层都从这里取，别再各写一份。 */
  /* v41（需求 1）：地块四边内缩的像素数 —— 只改这一个数就能调缝隙宽窄 */
  /* v45（需求 0）：地块之间的缝由 1px 加到 4px —— 老板要求"地块之间间隔合理距离"。
     缝里露的是**地形底色**（顶面被贴图铺满后，颜色只剩缝与侧壁看得见），
     所以加宽缝 = 让"地形色"这层信息重新可见，同时把相邻地块分开。 */
  var TILE_GAP = 2;
  var TERRAIN_NAME = { plain: '平地', caoyuan: '草原', zhaoze: '沼泽', lake: '湖泊',
    forest: '森林', desert: '荒漠', hill: '山地', city: '城' };
  GAME.map.terrainName = function (t) { return TERRAIN_NAME[t] || ''; };
  /* v41（需求 1）：可显示名称与等级的地形 —— 平地没有图标，不挂标签 */
  var WILD_TERRAINS = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };

  /* ---- 草地纹理（v30）已在 v42 撤除 ----
     v30 用 64px 离屏草皮 pattern 垫在整张画布下，靠它区分相邻格；
     v42 改 2.5D「方块 + 土色缝」后，缝隙本身就是分界，
     再铺草皮会把方块边界染回一片绿 —— 于是整段（含 LCG 与 pattern 缓存）删除。 */

  /* v89.5（老板：样式仍丑 → 重做）：野外据点 = 木质营寨
     （矮墙 + 院内泥地 + 四角角楼 + 中央望楼 + 红旗）。
     比旧版"木栅+尖桩"更像一座可守的据点，且比名城小一圈、配色更朴，
     等级感 据点 < 县城 < 郡城 < 州城 < 都城 一眼可分。 */
  function drawFortArt(ctx, cx, cy, baseW) {
    var WOOD = ['#c8a978', '#a9855a', '#7a6141'];
    var COURT = '#8a6f4a';                       /* 院内泥地（覆盖墙顶亮色，显"中空"） */
    var ROOF = ['#b97a5c', '#95583f', '#6b3d2c'];
    var BANNER = '#d85a4a';
    var ww = baseW * 0.80, hw2 = baseW * 0.14;
    var f = isoBox(ctx, cx, cy, ww, hw2, WOOD, 'rgba(255,255,255,.18)');
    polyFill(ctx, f.top, COURT);                  /* 院落地面 */
    /* 四角角楼（矮塔 + 小坡顶） */
    [f.top[0], f.top[1], f.top[2], f.top[3]].forEach(function (p) {
      var tw2 = baseW * 0.10, th2 = baseW * 0.072;
      var tf = isoBox(ctx, p[0], p[1] + hw2 * 0.08, tw2, th2, WOOD, 'rgba(255,255,255,.20)');
      isoRoof(ctx, p[0], tf.ty, tw2 * 1.22, th2 * 0.72, ROOF);
    });
    /* 中央望楼（更高的塔 + 坡顶 + 旗） */
    var mw = baseW * 0.30, mh = baseW * 0.20;
    var fm = isoBox(ctx, cx, cy + hw2 * 0.08, mw, mh, WOOD, 'rgba(255,255,255,.20)');
    isoRoof(ctx, cx, fm.ty, mw * 1.22, mh * 0.60, ROOF);
    var topY = fm.ty - mh * 0.60;
    ctx.strokeStyle = 'rgba(40,30,20,.92)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx, topY - baseW * 0.16);
    ctx.stroke();
    polyFill(ctx, [[cx, topY - baseW * 0.16], [cx + baseW * 0.12, topY - baseW * 0.125],
      [cx, topY - baseW * 0.09]], BANNER);
  }

  /* ============================================================
   * v89.5（老板：「按建议进行」）：灵机之地 · 灵机旗
   * ------------------------------------------------------------
   * 野地之事已逐地概率化（v89.4），需要"一眼看到哪有江湖事"的地标。
   * 判定「灵机」= 事数 × 等级（GAME.jianghuSpotInfo，唯一出口）——
   * 达阈者在**等级角标右侧**悬一面青旗：
   *   · 只借角标右侧那一小片空当 —— 菱形格内其余空间已被 名带 / 角标 占满
   *     （上顶点被角标顶到、下半部是名带），这是格内唯一不撞已有元素的落点；
   *   · 青碧色在现有调色盘（土黄 / 绿族 / 水蓝 / 金）中没有同族 —— 一眼可辨；
   *   · ⛔ 零三角函数、零仿射变换（v50 全文件守卫：只用直线原语）。
   * ============================================================ */
  function drawJhPennant(ctx, bx, by) {
    var poleX = bx + 13.5, top = by - 8;         /* by = 角标中心行 */
    ctx.strokeStyle = 'rgba(24,58,50,.92)';      /* 旗杆：深青（衬任何地形） */
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleX, top);
    ctx.lineTo(poleX, by + 7);
    ctx.stroke();
    ctx.beginPath();                             /* 旗面：青碧三角，朝右迎风 */
    ctx.moveTo(poleX, top + 0.4);
    ctx.lineTo(poleX + 7.6, by - 3.6);
    ctx.lineTo(poleX, by + 0.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(126,226,198,.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,46,40,.85)';      /* 描边：暗青，压住地形杂色 */
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：奇缘星
   * ------------------------------------------------------------
   * 已现形、未探的奇遇点位，在角标**左侧**缀一颗四芒星（青莲紫）。
   * 与青旗（右侧 · 青碧 · 质量标记）左右分居、互不打架：
   *   ✦ 是"未知的邀约"，旗是"已知的价值"。
   * ⛔ 零三角函数：八角顶点全部写死；零仿射（v50 全文件守卫）。
   * ============================================================ */
  function drawWonderStar(ctx, bx, by) {
    var sx = bx - 16.5, sy = by - 3.5;           /* 星心：角标左外一小步 */
    /* 双多边形（深底星做大一号当描边 + 宽体主星）——
       v1 用 1px stroke 描边：细星轮廓的描边几乎把实心吃光，真机实测纯色只剩 2px；
       宽体主星（尖宽 4.8px）才是"一眼可见"的关键。零三角函数：顶点全部写死。 */
    polyFill(ctx, [[sx, sy - 7.0], [sx + 2.2, sy - 2.2], [sx + 7.0, sy], [sx + 2.2, sy + 2.2],
      [sx, sy + 7.0], [sx - 2.2, sy + 2.2], [sx - 7.0, sy], [sx - 2.2, sy - 2.2]], 'rgba(44,28,66,.85)');
    polyFill(ctx, [[sx, sy - 5.6], [sx + 2.4, sy - 2.4], [sx + 5.6, sy], [sx + 2.4, sy + 2.4],
      [sx, sy + 5.6], [sx - 2.4, sy + 2.4], [sx - 5.6, sy], [sx - 2.4, sy - 2.4]], 'rgba(206,166,255,.96)');
  }

  /* ============================================================
   * 正方形俯视网格渲染（v20）
   *   每格画成正方形地块，地形装饰与城池/据点居中绘制
   * ============================================================ */
  /* ============================================================
   * 正方形俯视网格渲染（v20）
   *   · 画布 = span×cell 正方形，格子密铺、四角无留白
   *   · 格心 = (tx*cell + cell/2, ty*cell + cell/2)，拾取即 floor 换算
   *   · 暗色界面按规范用「亮度分层 + 发丝描边」表达层级，不用侧壁/投影
   * ============================================================ */
  /* ============================================================
   * 地图位图层（v40 · 需求 0-a）
   * ------------------------------------------------------------
   * 地图此前是 canvas **纯矢量**绘制（v30 的手绘地形/城池/据点），
   * 与城内建筑的 AI 位图风格不在一条线上。这里补一层位图：
   *   · 位图优先、矢量兜底（未就绪 / 素材缺失时自动回落，永不开天窗）
   *   · 只在地图渲染路径里惰性加载一次；**jsdom 等无 Image 环境直接跳过**
   *     （否则 `new Image()` 会让 smoke 整片崩掉）
   *   · 预缩放到 2× 最大格边长的离屏 canvas —— 地图每帧重绘，
   *     拿 512px 源图 drawImage 缩放几十次会明显掉帧
   *   · 素材已标准化为「内容占方画布 92%、居中」，所以绘制尺寸统一按格边长算
   * ============================================================ */
  var ART = {};
  var ART_KEYS = ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake',
    'terrain_forest', 'terrain_desert', 'terrain_hill',
    'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital'];
  /* v89.42：192 → 256 —— v85 自适应格距后 cell 最大 128（旧的"96 的 2 倍"口径过期）。
     地形贴图本身 256px：预缩放不再缩小它，采样窗（中心 45%）≈ 显示尺寸（104×52），
     整条链路只经一次 drawImage 重采样，像素风细节不再被二次缩放磨掉。 */
  var ART_MAX = 256;
  var _artTried = false;
  function loadArt() {
    if (_artTried) return;
    _artTried = true;
    if (typeof Image === 'undefined' || typeof document === 'undefined') return;
    ART_KEYS.forEach(function (k) {
      var im = new Image();
      /* 用 addEventListener 而不是 `im.onload = fn` —— 后者会被 audit 的
         "函数定义"识别规则当成一个从没被引用的函数（误报）。 */
      im.addEventListener('load', function () {
        try {
          var c = document.createElement('canvas');
          c.width = ART_MAX; c.height = ART_MAX;
          c.getContext('2d').drawImage(im, 0, 0, ART_MAX, ART_MAX);
          ART[k] = c;
          GAME.map._artVer = (GAME.map._artVer || 0) + 1;
          /* 位图是异步到的 —— 主动重绘一次，否则要切走再切回才看得见 */
          if (GAME.ui && GAME.ui.view === 'map' && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        } catch (e) { /* 无 canvas 环境（测试桩）时忽略 */ }
      });
      im.addEventListener('error', function () { /* 缺素材 → 保持矢量兜底 */ });
      im.src = 'assets/icons/ui/ai_' + k + '.png';
    });
  }
  GAME.map.loadArt = loadArt;
  /* 已就绪的位图张数（e2e 用它验"素材真的加载上了"，而不是只看代码写了） */
  GAME.map.artCount = function () { return Object.keys(ART).length; };

  /* v89.42：逐格贴图镜像变体（0 原样 / 1 横镜像 / 2 竖镜像 / 3 双镜像）。
     确定性 hash —— 同一格每次渲染的变体固定（截图与回归可复现）；
     目的只是打破"同地形相邻格贴图一模一样"的墙纸感。
     ⚠️ 只用**轴对齐线性变换**（translate + scale(±1)），不引入旋转/仿射 ——
     理由同 blitArtRect 的注释：真仿射会把沙纹 / 水波这类方向性纹理拧歪。 */
  function texVariant(gx, gy) {
    /* 32 位混合哈希（Math.imul = 精确 32 位乘法，无浮点精度损耗）：
       乘-异或-右移两轮 —— 伪随机、确定性、跨引擎一致。
       （首版 (gx*A)^(gy*B) 实测呈 4 周期对角规律，等于把"墙纸感"换成了"条纹感"。） */
    var h = Math.imul(gx, 0x27d4eb2d) ^ Math.imul(gy, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x2545f491);
    return ((h ^ (h >>> 13)) >>> 4) & 3;
  }

  /* 按**任意矩形**铺图（cover：只裁不缩，保持素材长宽比）。
     v50 菱形化后用法不变 —— 目标矩形改成"菱形的外接矩形"，外面再套一层
     菱形路径 clip（见渲染段的 ② 地形贴图）。
     ⚠️ **不要在这里加 rotate**：地形贴图是俯视素材，斜切会把沙纹、水波这类
        方向性纹理拧歪。（城池/据点已改为**绘图**呈现立体感，见 isoBox 一节。） */
  function blitArtRect(ctx, key, x, y, w, h) {
    var c = ART[key];
    if (!c) return false;
    /* v47：**cover（裁而不缩）**，不再直接拉伸。
       原来顶面高度 = cell − el，山地的顶面只有 66% 高 → 岩石纹理被纵向压扁 34%，
       看着就是"贴图没铺正"。cover 保持素材长宽比，只把多出来的部分裁掉；
       顶面越矮纵向裁得越多，顺带把 AI 生成图最外圈（最容易畸形的一圈）也裁了。 */
    var k = Math.max(w / c.width, h / c.height);
    var cw = w / k, ch = h / k;
    /* v49：源取用范围收到 45%（只取素材中心那一块）。
       实测新写实素材在 0.45 档细节最好：铺到格子后 caoyuan 16.5（全用素材只有 11.0）、
       hill 13.6（全用 11.6）、lake 5.4（全用 1.7）；再往小则森林（树冠）会变成大色块。
       副作用是放大 4.4 倍 —— 但素材 902×0.45=406px 铺 77px 仍是 5.3 倍下采样，不会糊。 */
    var USE = 0.45;
    var maxSide = Math.min(c.width, c.height) * USE;
    if (cw > maxSide || ch > maxSide) {
      var k2 = Math.max(w / maxSide, h / maxSide);
      cw = w / k2; ch = h / k2;
    }
    ctx.drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, x, y, w, h);
    return true;
  }

  GAME.map.render = function (canvas, opts) {
    opts = opts || {};
    var s = GAME.state;
    if (!s.map.grid) GAME.map.generate();
    /* v26（需求 4）：观察框由 12×12 改为 **12×8**（宽 12 格、高 8 格）——
       平板 1024×768 是可横可纵的屏，正方观察框上下留白太多、横向又不够看。
       spanX / spanY 分开后：画布不再是正方形，拾取、平移、边缘提示都要各用各的。
       opts.span 仍作为 spanX 的别名保留（旧调用与测试不必改）。 */
    var spanX = opts.spanX || opts.span || 12;
    var spanY = opts.spanY || 6;
    var cell = opts.cell || 44;
    /* v50：画布尺寸仍 = spanX×spanY 个"格距"（旧调用与测试不必改），
       但格子在屏幕上不再是 cell×cell 的方块，而是宽 cell、高 cell/2 的**菱形**。
       于是同一块画布能看到 spanX 个菱形宽、2×spanY 个菱形高 —— 密度感与
       正方形时代接近，但排布变成侧向菱形。 */
    var cvW = Math.round(spanX * cell);
    var cvH = Math.round(spanY * cell);
    if (canvas.width !== cvW) canvas.width = cvW;
    if (canvas.height !== cvH) canvas.height = cvH;
    var ctx = canvas.getContext('2d');
    loadArt();                      /* v40：位图惰性加载（幂等，测试环境自动跳过） */
    /* v50：vx / vy 的语义由"视口左上角格"改为**视野中心格** ——
       菱形网格在屏幕上是斜的，"左上角"不再是一个有意义的格。 */
    var vx = U.clamp(Math.round(opts.vx == null ? Math.floor(DATA.MAP_W / 2) : opts.vx),
      0, Math.max(0, DATA.MAP_W - 1));
    var vy = U.clamp(Math.round(opts.vy == null ? Math.floor(DATA.MAP_H / 2) : opts.vy),
      0, Math.max(0, DATA.MAP_H - 1));
    var ox = 0, oy = 0;
    /* ============================================================
     * v42（需求 2）：地块的「抬起高度」—— 每格拆成「顶面 + 侧壁(土色剖面)」两片。
     *   侧壁完全落在自己那一格的纵向范围内，逐行绘制不会互相遮挡，
     *   所以 pick / span / 画布比例一行都不用改。
     * ------------------------------------------------------------
     * v45（需求 1）：「野地稍微搞点 2.5D」→ 抬升改为**按地形分档**。
     *   原先七种地形一个厚度（cell×0.15），等于没有高低差，只像一层厚边框。
     *   现在：山最厚、林次之、泽/草居中、沙/丘薄、平地最薄
     *   （与"平地不放图形"一脉相承 —— 它就是整片的地基）。
     *   关键约束仍然成立：**侧壁只在格内**，所以 pick 的整除取格一字不改，
     *   也不会出现前后排互相遮挡。
     * ============================================================ */
    /* ⚠️ v50-a：抬升改**绝对像素**（不再按 cell 比例）。
       菱形密铺里本格的下尖角与南邻的上尖角**共点** —— 屏幕垂直方向本来就没有空隙，
       所以"地块厚度"能吃掉的只有**缝**。首版按 cell 比例给到 35px（山），
       侧壁直接盖住了北邻格的顶面（老板："地块都叠在一起了"）。
       现在分档压进缝里（1.2 ~ 5px），保留"山最厚、平地最薄"的语义。 */
    var ELEV_PX = {
      plain: 1.2, caoyuan: 3.2, zhaoze: 3.8, lake: 2.2,
      desert: 2.6, forest: 4.4, hill: 5.0, city: 1.6,
    };
    /* 硬上限 = 缝宽（IN）；IN 在下面定义，这里先记个常量，函数里再取 min */
    var ELEV_PX_MAX = 5;
    function elevFor(terrain) {
      var v = ELEV_PX[terrain];
      if (v == null) v = 3.2;
      return Math.min(ELEV_PX_MAX, v);
    }
    /* 最厚的那一档 —— `_view.elev` 需要一个确定的数（调试/测试用）。
       实际绘制一律按格取 elevFor()，不要再引用这个常量。 */
    var ELEV = ELEV_PX_MAX;
    /* ============================================================
     * v50：地块改为**菱形侧向分布**（等距投影）—— 老板点名的方向。
     * ------------------------------------------------------------
     * 屏幕坐标：格 (gx,gy) 的格心在
     *     x = ox + (gx − gy) · HW
     *     y = oy + (gx + gy) · HH
     * 每块地是宽 cell、高 cell/2 的**菱形**（2:1 等距 = 经典 30° 视角）；
     * 向下挤出 el 之后能看到**两个侧面**（左下 / 右下）—— 立体感天然就有，
     * 这正是"正方形 + 单片侧壁"时代最缺的那一项。
     *
     * ⛔ v16/v18 两次在斜投影上翻车，根因不是"斜"本身，而是**同一份几何被抄到多处**：
     *    "图标要立正"就得反向补偿偏移量，补偿量散落在六七处，改一处漏一处。
     * ✅ 本次硬约束：菱形几何**只由本节四个函数给出**，别处不许再出现裸算式：
     *      gxy()       格心 —— 唯一的坐标出口
     *      diaPath()   顶面菱形 —— 唯一的形状出口
     *      sideSides() 侧壁两面 —— 唯一的厚度出口
     *      diaBox()    菱形外接矩形 —— 贴图 / 名带 / 角标的定位框
     *    贴图、图标、名带、等级角标、金框、顶棱全部由这四个派生。
     * ============================================================ */
    var HW = cell / 2;              /* 菱形半宽 */
    var HH = cell / 4;              /* 菱形半高（2:1 等距） */
    /* 视野中心格 (vx,vy) 落在画布正中 —— ox/oy 即"格 (0,0) 的格心"在屏幕上的位置 */
    ox = cvW / 2 - (vx - vy) * HW;
    oy = cvH / 2 - (vx + vy) * HH;
    GAME.map._view = { vx: vx, vy: vy, spanX: spanX, spanY: spanY, elev: ELEV,
      span: spanX, cell: cell, ox: ox, oy: oy, cvW: cvW, cvH: cvH,
      HW: HW, HH: HH, iso: true };

    ctx.clearRect(0, 0, cvW, cvH);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    /* 格心 —— **唯一的坐标出口**。gx/gy 是地图绝对格号，可以越界（调用方负责裁剪）。 */
    function gxy(gx, gy) {
      return { x: ox + (gx - gy) * HW, y: oy + (gx + gy) * HH };
    }
    /* 屏幕 → 格坐标（浮点）。inverse 与 gxy 是一对，pick 与绘制范围共用。 */
    function invScreen(sx, sy) {
      var a = (sx - ox) / HW, b = (sy - oy) / HH;   /* a = gx−gy, b = gx+gy */
      return { i: (a + b) / 2, j: (b - a) / 2 };
    }
    /* 顶面菱形路径。k 为向外(+) / 向内(−) 的偏移量；纵向按 1:2 跟着缩，保持形状相似。 */
    function diaPath(gx, gy, el, k) {
      var c = gxy(gx, gy);
      k = k || 0;
      /* v50-a：顶面固定在格心（不再减 el）——减 el 会压到北邻格 */
      var hw = HW + k, hh = HH + k * 0.5, cy = c.y;
      ctx.beginPath();
      ctx.moveTo(c.x, cy - hh);
      ctx.lineTo(c.x + hw, cy);
      ctx.lineTo(c.x, cy + hh);
      ctx.lineTo(c.x - hw, cy);
      ctx.closePath();
    }
    /* 顶面菱形的外接矩形 —— 贴图铺贴 / 名带 / 角标的定位框（k = 内缩量） */
    function diaBox(gx, gy, el, k) {
      var c = gxy(gx, gy);
      k = k || 0;
      return { x: c.x - HW + k, y: c.y - HH + k * 0.5, w: cell - k * 2, h: cell / 2 - k,
        cx: c.x, cy: c.y };
    }
    /* 侧壁：**顶面下方那两条边（左下 / 右下）向下平移 el** 得到的两个平行四边形。
       光源取左上方 → 左面受光稍亮、右面背光稍暗。
       ⚠️ 最低点 y = cy + HH − IN/2 + el，只要 el ≤ IN 就仍在"缝"以内，
       不会碰到南邻格的顶面（其上尖角在 cy + HH + IN/2）。 */
    function sideSides(gx, gy, el) {
      var c = gxy(gx, gy);
      var hw = HW - IN, hh = HH - IN * 0.5;
      var bot = c.y + hh;
      return {
        left: [[c.x - hw, c.y], [c.x, bot], [c.x, bot + el], [c.x - hw, c.y + el]],
        right: [[c.x + hw, c.y], [c.x, bot], [c.x, bot + el], [c.x + hw, c.y + el]],
      };
    }
    function polyPath(pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1]);
      ctx.closePath();
    }
    /* ============================================================
     * v50：每格的立体构造（菱形版）
     * ------------------------------------------------------------
     *   基底 = 菱形整块铺该地形的土色（缝里露的是**邻格的土色**，不是深色空洞）
     *   侧壁 = 菱形向下挤出 el 后的两个面（左下 / 右下），左面受光稍亮、右面背光稍暗
     *   顶面 = 菱形顶面，铺地形贴图
     *   顶棱 = 顶面上方那两条棱（左上 / 右上）加受光高光，抬得越高越亮
     * 全部几何由 gxy / diaPath / diaBox / sideSides 派生 —— 别处不许再写裸算式。
     * ============================================================ */
    var TG = TILE_GAP;
    /* ============================================================
     * v50-a 修正（老板：「地块都叠在一起了」）
     * ------------------------------------------------------------
     * 几何事实：菱形密铺里，格 A 的下尖角 (cx, cy+HH) 与南邻格的上尖角**是同一个点**，
     * 而 A 的侧壁顶点 (cx−HW, cy−el) 所在的那条竖线 x = cx−HW，正好是北邻格
     * B(gx−1,gy) 的中心 x —— B 在该处的 y 范围是 [cy−2·HH, cy]。
     * 所以只要 el < 2·HH，A 的侧壁就**必然落在 B 的菱形内部**：这不是参数没调好，
     * 而是"给菱形地块加厚度"这件事本身就会侵入邻居。
     * ✅ 结论：顶面**固定在格心**（不上浮），侧壁厚度必须 ≤ 缝宽。
     * ============================================================ */
    var IN = 5;      /* 顶面菱形内缩量 → 垂直缝 ≈ IN、水平缝 ≈ 2·IN；也是侧壁厚度的上限 */
    /* 顶面中心 y / 顶面下顶点 y —— 图标与文字的定位口，同样由菱形几何派生 */
    /* 顶面中心 y / 顶面下尖角 y。
       ⚠️ 两者都**不再随 el 变化** —— 顶面固定在格心（见上面 IN 的几何说明：
       菱形密铺里本格下尖角与南邻上尖角共点，垂直方向没有空间可让）。
       el 参数保留是为了不动调用点，它只影响侧壁厚度。 */
    function topCY(gx, gy, el) { return gxy(gx, gy).y; }
    function topBottom(gx, gy, el) { return gxy(gx, gy).y + HH - IN * 0.5; }
    /* 顶棱：菱形顶面**上方那两条棱**（左上 → 上 → 右上）加一道受光高光。
       抬得越高越亮 —— 高低差靠这一道就能读出来。必须画在贴图之后。 */
    function edgeOf(gx, gy, el) {
      var c = gxy(gx, gy), hw = HW - IN, hh = HH - IN * 0.5;
      /* 透明度按"抬升量 / 最大抬升"给 —— el 现在是 1.2~5px，不能再拿 cell 当分母 */
      ctx.strokeStyle = 'rgba(255,255,255,' +
        (0.14 + Math.min(0.24, el / ELEV_PX_MAX * 0.24)).toFixed(2) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(c.x - hw, c.y + 0.5);
      ctx.lineTo(c.x, c.y - hh + 0.5);
      ctx.lineTo(c.x + hw, c.y + 0.5);
      ctx.stroke();
      /* 顶面外描边：极淡，帮助分层 */
      ctx.strokeStyle = 'rgba(30,36,18,.28)';
      ctx.lineWidth = 1;
      diaPath(gx, gy, el, 0);
      ctx.stroke();
      /* v50-a：顶面**下缘的 AO 内阴影**。
         菱形密铺里"地块厚度"被北邻格挡住（真的加厚就会重叠 —— 见 IN 的几何说明），
         所以在顶面**内部**沿下方两条边压一道渐变：不占任何额外空间，
         却能把"这是一块有厚度的地"读出来（这是唯一不越界还能加厚度的办法）。 */
      var sh = ctx.createLinearGradient(0, c.y + hh * 0.2, 0, c.y + hh);
      sh.addColorStop(0, 'rgba(12,14,8,0)');
      sh.addColorStop(1, 'rgba(12,14,8,.30)');
      ctx.save();
      diaPath(gx, gy, el, -IN);
      ctx.clip();
      ctx.fillStyle = sh;
      ctx.fillRect(c.x - hw, c.y + hh * 0.2 - 1, hw * 2, hh * 0.8 + 2);
      ctx.restore();
    }
    /* 暗土色：把地形色压暗，当「泥土剖面」用 */
    /* 土色：把地形色压暗当「土层」用。k 分三档（v49 减少格子感引入）：
       基底 0.62（铺满整格，缝里露的就是它）> 侧壁上端 0.62 → 下端 0.34（厚度阴影）。 */
    function soilOf(tint, k) {
      k = k == null ? 0.44 : k;
      function mul(hex, kk) {
        return 'rgb(' + Math.round(parseInt(hex.substr(1, 2), 16) * kk) + ','
          + Math.round(parseInt(hex.substr(3, 2), 16) * kk) + ','
          + Math.round(parseInt(hex.substr(5, 2), 16) * kk) + ')';
      }
      return mul(tint[1], k);
    }

    /* ---- ① 地块层（v50：菱形等距） ----
       v30 的草皮纹理垫底在 2.5D 下要撤：那时靠纹理区分相邻格，
       现在靠"菱形之间的土色缝 + 侧壁厚度"区分；再铺草皮会把边界染回一片绿。 */
    ctx.fillStyle = '#57503e';
    ctx.fillRect(0, 0, cvW, cvH);

    /* 可视格范围：把画布四角反投影回格坐标。菱形网格在屏幕上是斜的，
       所以可见范围不是矩形 —— 取四角包络再向外放 2 格余量，最后裁到地图内。 */
    var CORN = [invScreen(0, 0), invScreen(cvW, 0), invScreen(0, cvH), invScreen(cvW, cvH)];
    var gx0 = Math.max(0, Math.floor(Math.min(CORN[0].i, CORN[1].i, CORN[2].i, CORN[3].i)) - 2);
    var gx1 = Math.min(DATA.MAP_W - 1, Math.ceil(Math.max(CORN[0].i, CORN[1].i, CORN[2].i, CORN[3].i)) + 2);
    var gy0 = Math.max(0, Math.floor(Math.min(CORN[0].j, CORN[1].j, CORN[2].j, CORN[3].j)) - 2);
    var gy1 = Math.min(DATA.MAP_H - 1, Math.ceil(Math.max(CORN[0].j, CORN[1].j, CORN[2].j, CORN[3].j)) + 2);

    /* 先收集本次要画的格，按 (gx+gy) 升序 —— 等距投影里"屏幕纵深"就是 gx+gy，
       必须按它排序绘制：这样后面的格才会正确盖住前面格的侧壁。
       （正方形时代只是按行扫，不需要排序；这是菱形带来的第一个结构性变化。） */
    var drawList = [];
    for (var gy2 = gy0; gy2 <= gy1; gy2++) {
      var row2 = s.map.grid[gy2];
      for (var gx2 = gx0; gx2 <= gx1; gx2++) {
        var c0 = gxy(gx2, gy2);
        /* 屏幕包围盒外再放一格余量（菱形的四个尖角会伸出格心 ±HW/±HH） */
        if (c0.x < -cell || c0.x > cvW + cell || c0.y < -cell || c0.y > cvH + cell) continue;
        var t2 = row2 ? row2[gx2] : null;
        drawList.push({ gx: gx2, gy: gy2, terrain: t2 ? t2.terrain : 'plain', t: t2 });
      }
    }
    drawList.sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });

    drawList.forEach(function (d) {
      var tint = TERRAIN_TINT[d.terrain] || TERRAIN_TINT.plain;
      var el = elevFor(d.terrain);
      var c = gxy(d.gx, d.gy);
      d.el = el; d.c = c; d.tint = tint;
      /* ① 基底：整块菱形铺该地形的土色（v49 减少格子感）—— 缝里露的是**邻格土色**，
         而不是画布底那个深色空洞，地形读起来才连续。 */
      ctx.fillStyle = soilOf(tint, 0.70);
      diaPath(d.gx, d.gy, 0, 0);
      ctx.fill();
      /* ② 侧壁：菱形向下挤出 el 后可见的两个面。
         光源取左上方 → 左面受光（偏亮）、右面背光（偏暗），中缝自然形成一条竖脊。
         两个面都沿屏幕竖直做渐变：上端接顶面色、下端接地更暗。 */
      if (el > 0.4) {
        var ss = sideSides(d.gx, d.gy, el);
        ['left', 'right'].forEach(function (which) {
          var kTop = which === 'left' ? 0.62 : 0.46;
          var kBot = which === 'left' ? 0.40 : 0.22;
          var g3 = ctx.createLinearGradient(0, c.y, 0, c.y + HH + el);
          g3.addColorStop(0, soilOf(tint, kTop));
          g3.addColorStop(1, soilOf(tint, kBot));
          polyPath(ss[which]);
          ctx.fillStyle = g3;
          ctx.fill();
        });
      }
      /* ③ 顶面：菱形，竖向渐变（不透明）。贴图会盖在上面，这层是贴图缺席时的兜底。
         v50-a：渐变范围也跟着"顶面固定在格心"走（原来按 c.y−el 定位，会整体上移）。 */
      var g2 = ctx.createLinearGradient(0, c.y - HH, 0, c.y + HH);
      g2.addColorStop(0, tint[0]);
      g2.addColorStop(1, tint[1]);
      ctx.fillStyle = g2;
      diaPath(d.gx, d.gy, el, -IN);
      ctx.fill();
    });

    /* ---- ② 地形/城池贴图（铺满菱形顶面） ----
       v89.43：城池纳入同一管线 —— tier 由城对象决定（cityArtKeyAt），
       素材缺席时退回矢量立体城（marks 段画），永不开天窗。
       城池**不参与**逐格镜像：建筑有朝向，镜像会左右反。 */
    drawList.forEach(function (d) {
      var isCity = d.terrain === 'city';
      var aKey = isCity ? GAME.map.cityArtKeyAt(d.gx, d.gy) : 'terrain_' + d.terrain;
      if (!aKey) return;                       /* 城但取不到 tier → 底色 + marks 段矢量城 */
      var ab = diaBox(d.gx, d.gy, d.el, IN);
      if (ART[aKey]) {
        ctx.save();
        diaPath(d.gx, d.gy, d.el, -IN);        /* 按菱形路径裁切 */
        ctx.clip();
        /* v50：贴图**正交铺贴**到菱形的外接矩形上，不做斜切变形 ——
           地表材质本来就是俯视素材，铺到菱形上"纵向压扁 2:1"正是等距视角应有的观感；
           若改成旋转 45° 的真仿射映射，沙纹 / 水波这类**方向性纹理会被拧歪**，
           静态材质（草地/石砾）看不出差别，方向性材质一眼就假。 */
        /* v89.42：逐格镜像变体 —— 在 clip 之内做轴对齐镜像（clip 区域在 clip() 时刻
           已定格于设备空间，之后的 transform 不影响裁剪形状）。 */
        var tv = isCity ? 0 : texVariant(d.gx, d.gy);
        if (tv & 1) { ctx.translate(2 * ab.x + ab.w, 0); ctx.scale(-1, 1); }
        if (tv & 2) { ctx.translate(0, 2 * ab.y + ab.h); ctx.scale(1, -1); }
        blitArtRect(ctx, aKey, ab.x, ab.y, ab.w, ab.h);
        ctx.restore();
        return;
      }
      if (isCity || d.terrain === 'plain') return;
      /* 位图缺席时才走矢量兜底（立着的小树/山，尺寸按菱形外接框收） */
      var S = Math.min(cell * 0.72, ab.h * 1.7);
      ctx.save();
      drawTerrainArt(ctx, d.terrain, d.c.x - S / 2, topCY(d.gx, d.gy, d.el) - S * 0.58, S);
      ctx.restore();
    });

    /* ---- ②b 顶棱高光 + 顶面描边（必须在贴图之后 —— 贴图会盖掉它们） ---- */
    drawList.forEach(function (d) { edgeOf(d.gx, d.gy, d.el); });

    /* ============================================================
     * v41（需求 5）：野地信息层
     * ------------------------------------------------------------
     * 老板要求：
     *   ① 不要显示"粮 / 石"这类**资源归属**标识（那是换算结果，不是地方名）
     *   ② 在图标中显示**名称**（如"湖泊"）
     *   ③ 图标右上显示**等级**
     * 所以：撤掉左上角的资源小方块，改中部名称 + 右上等级角标。
     * 名称压在图标上，所以加一层底部渐隐底衬，保证在任何地形上都读得清。
     * ============================================================ */
    /* v89.52：建筑（城池）名称 + 等级标注。
       v89.67（老板：「名城的名称永不消失（左下角名称菜单不影响名城的显示，不然地图上看不见了）」）
       —— 于是判定顺序**倒过来**：城池先画、且**不看开关**；开关只留给野地与据点。
       理由：城池名是地图的骨架（哪座是哪座全靠它），关掉=地图失去可读性；
       而野地/据点是密集的"背景信息"，才是真正需要一键收起来的东西。 */
    function drawCityLabel(d) {
      var city = GAME.map.ownCityAt(d.gx, d.gy) || GAME.map.npcAt(d.gx, d.gy);
      if (!city) return;
      var nm = city.name || '城';
      /* v89.70：**自带对齐设置**，不依赖环境遗留状态 ——
         城池名现在画在整张图的最后一趟（见下方 ⑨b），中途任何一趟改了
         textAlign/textBaseline，名字就会偏到格子外（看着像"没画"）。 */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var ly = topBottom(d.gx, d.gy, d.el) - 10;
      var w = nm.length * 12 + 16, h = 15;
      var lg = ctx.createLinearGradient(d.c.x - w / 2, 0, d.c.x + w / 2, 0);
      lg.addColorStop(0, 'rgba(40,28,8,.10)');
      lg.addColorStop(.22, 'rgba(40,28,8,.66)');
      lg.addColorStop(.78, 'rgba(40,28,8,.66)');
      lg.addColorStop(1, 'rgba(40,28,8,.10)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(d.c.x - w / 2, ly - h / 2, w, h, 7);
      else ctx.rect(d.c.x - w / 2, ly - h / 2, w, h);
      ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(nm, d.c.x, ly + 0.5);
      /* 等级角标：菱形上半部居中（建筑=金底，野地=暗绿底，一眼区分）
         v89.79（老板「城等级不是跟随官府等级吗」）：改读**唯一出口** `GAME.cityLvOf` ——
         城等级 = 官府等级 = 建筑等级（县城 12 / 郡城 16 / 州城 20 / 都城 24）。
         历史：v89.70 读档位满配、v89.74 改回 `city.level`（当时它是 1~10 的分布），
         两轮反复都因为"同一个数字被当成两件事"。现在只有**一个**城等级口径。 */
      var lv = GAME.cityLvOf(city);
      var bx = d.c.x, by = d.c.y - HH * 0.36;
      ctx.fillStyle = 'rgba(120,90,24,.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - 10, by - 7, 21, 15, 4);
      else ctx.rect(bx - 10, by - 7, 21, 15);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,206,136,.7)';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(String(lv), bx, by + 0.5);
    }
    /* v89.52：整层受 showLabels 开关控制（底部「🏷 名称」按钮一键切换）
       v89.67：**城池例外** —— 城池标注不受开关控制（老板：名城的名称永不消失）。
       顺序很关键：先判城池并 return，之后才轮到 `if (!SHOW_LB) return;`。
       反过来写（先判开关）就会把城池一起收掉 —— 那正是这次要修的病。 */
    var SHOW_LB = opts.showLabels !== false;
    drawList.forEach(function (d) {
      /* ① 城池：**不在这一趟画** —— 它走最后的专属一趟（见下方 ⑨b），
         这样它在结构上不可能被任何图层盖住 */
      if (d.terrain === 'city') return;
      /* ② 野地：受「🏷 名称」开关控制 */
      if (!SHOW_LB) return;
      if (!WILD_TERRAINS[d.terrain]) return;
      /* 走唯一取值口（terrainName）—— 别在绘制里再读一遍表，
         否则换名规则时地图与别处会不一致 */
      var nm = GAME.map.terrainName(d.terrain);
      if (!nm) return;
      /* 名称：菱形顶面的**下半部**（下顶点上方）底衬条 + 居中文字。
         菱形没有"格内下方"这种矩形概念，所以位置一律从 topBottom（下顶点）往回退。 */
      var ly = topBottom(d.gx, d.gy, d.el) - 10;
      var w = nm.length * 11 + 14, h = 14;
      var lg = ctx.createLinearGradient(d.c.x - w / 2, 0, d.c.x + w / 2, 0);
      lg.addColorStop(0, 'rgba(18,24,14,.10)');
      lg.addColorStop(.22, 'rgba(18,24,14,.62)');
      lg.addColorStop(.78, 'rgba(18,24,14,.62)');
      lg.addColorStop(1, 'rgba(18,24,14,.10)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(d.c.x - w / 2, ly - h / 2, w, h, 7);
      else ctx.rect(d.c.x - w / 2, ly - h / 2, w, h);
      ctx.fill();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#f3f6ea';
      ctx.fillText(nm, d.c.x, ly + 0.5);
      /* 等级角标：菱形**上半部居中**。
         ⚠️ 不能沿用"格内右上角"—— 菱形没有那个角。而且菱形很扁（高只有宽的一半），
         21×15 的角标贴着斜边放必然出界（实测贴右顶点时四角有 1.13 倍越界），
         所以取上半部中轴：上边余量由 `|-HH·0.36 − 7.5| / HH` 约束，44px 半宽下舒适。 */
      var lv = GAME.map.wildLevelNow(d.gx, d.gy);
      if (lv >= 0) {
        var bx = d.c.x, by = d.c.y - HH * 0.36;
        ctx.fillStyle = lv >= 9 ? 'rgba(150,40,28,.92)' : 'rgba(28,36,20,.84)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx - 10, by - 7, 21, 15, 4);
        else ctx.rect(bx - 10, by - 7, 21, 15);
        ctx.fill();
        ctx.strokeStyle = lv >= 9 ? 'rgba(255,214,160,.9)' : 'rgba(232,220,170,.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = lv >= 9 ? '#ffd9c8' : '#f0e6bf';
        ctx.fillText(String(lv), bx, by + 0.5);
        /* v89.5：灵机之地 —— 事数 × 等级 达阈者，角标侧悬青旗（江湖事地标）。
           v89.45：受 GAME.jianghuWildMounted 控制（false=剥离野地江湖游历呈现层）。 */
        if (GAME.jianghuWildMounted) {
          var jhM5 = GAME.jianghuSpotInfo(d.gx, d.gy);
          if (jhM5 && jhM5.mark) drawJhPennant(ctx, bx, by);
        }
        /* v89.6：奇遇点位（已现形未探）—— 角标左侧缀一颗「奇缘星」 */
        var wd6 = GAME.wonderSiteOf ? GAME.wonderSiteOf(d.gx, d.gy) : null;
        if (wd6 && wd6.revealed && !wd6.done) drawWonderStar(ctx, bx, by);
      }
    });

    /* 取某格地形（供 at() 换算抬升量） */
    function terrainAt(gx, gy) {
      var row = s.map.grid[gy];
      var t = row ? row[gx] : null;
      return t ? t.terrain : 'plain';
    }
    /* 依次把「格号 / 格心 / 本格抬升量」交给回调。
       菱形版比正方形版**多给一个格号** —— 因为菱形路径由 (gx,gy) 决定，
       只给格心是画不出形状的（这也是斜投影最容易出错的地方：格心对了、形状还错着）。
       视口裁剪改成"格心是否落在画布内"（菱形视野不是矩形，旧的矩形判断会漏掉边角）。 */
    function at(gx, gy, fn) {
      if (gx < 0 || gy < 0 || gx >= DATA.MAP_W || gy >= DATA.MAP_H) return false;
      var c = gxy(gx, gy);
      if (c.x < -cell || c.x > cvW + cell || c.y < -cell || c.y > cvH + cell) return false;
      fn(gx, gy, c, elevFor(terrainAt(gx, gy)));
      return true;
    }

    /* ---- ④a 己方前哨：辐射范围（v89.194 圆 → v89.196 地块边界折线 · 静态） ----
       老板原话（v89.196 6）：「不要（旋转扫描线），有点晃眼，静态圈就行，已涉及到
       最远的地块格子边界为边界（因此外周不是圆弧，而是地块的边界折线）」。
       几何：覆盖格集合（欧氏判定，与 GAME.fortAuraAt 同源）的**外轮廓** ——
       GAME.map.fortRingOf(R) 唯一出口（段按 R 缓存）；等距投影下每条格边都是
       菱形斜线 → 外周为锯齿折线。静态：无相位/无动画；填充极淡（不遮地块）。 */
    (function () {
      if (!ctx) return;                              /* 能力判据（桩环境无 canvas 2d） */
      var fs196 = (GAME.fortsOf ? GAME.fortsOf() : null) || {};
      for (var k196 in fs196) {
        var f196 = fs196[k196];
        if (!f196 || !f196.cityId) continue;         /* 只画**己方前哨**（老板口径） */
        if (f196.x < gx0 - 16 || f196.x > gx1 + 16 || f196.y < gy0 - 16 || f196.y > gy1 + 16) continue;
        var R196 = GAME.fortRadiusOf(f196) || 0;
        if (!(R196 > 0)) continue;
        var ring196 = GAME.map.fortRingOf(R196);
        ctx.save();
        /* ① 填充：轮廓环（极淡，地块纹理透得出来） */
        if (ring196.ring && ring196.ring.length >= 3) {
          ctx.beginPath();
          ring196.ring.forEach(function (pt, i2) {
            var sc = gxy(f196.x + pt[0], f196.y + pt[1]);
            if (i2) ctx.lineTo(sc.x, sc.y); else ctx.moveTo(sc.x, sc.y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(140,220,170,.055)';
          ctx.fill();
        }
        /* ② 描边：全部边界段（静态 · 边缘相对清晰） */
        ctx.beginPath();
        ring196.segs.forEach(function (sg) {
          var a2 = gxy(f196.x + sg[0], f196.y + sg[1]);
          var b2 = gxy(f196.x + sg[2], f196.y + sg[3]);
          ctx.moveTo(a2.x, a2.y);
          ctx.lineTo(b2.x, b2.y);
        });
        ctx.strokeStyle = 'rgba(168,235,188,.55)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    })();

    /* ---- ④ 已占野地：金色菱形框（描在**顶面**上，不框到侧壁） ---- */
    (s.wilds || []).forEach(function (w) {
      at(w.x, w.y, function (gx, gy, c, el) {
        ctx.strokeStyle = '#ffe9b0';
        ctx.lineWidth = 2.5;
        diaPath(gx, gy, el, 0);
        ctx.stroke();
        /* v41（需求 5）：等级已统一到格内角标，这里不再重复一份 "Lv n" */
        /* ============================================================
         * v89.137（老板 1①）：**采集"在采"状态在大地图可见** ——
         * 有采集队的地块在菱形顶面北缘画一枚**绿色圆点**（白描边，外圈微光），
         * 不点进野地就能一眼看出哪几块在开采。
         * 画在框之后 = 永远压在最上层（同名教训：§46.1 图层序）。
         * ============================================================ */
        if (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) {
          var _bx = diaBox(gx, gy, el, 0);
          var _px = c.x, _py = c.y - _bx.h * 0.46;
          dot(ctx, _px, _py, 5.2, 'rgba(58,208,122,.30)');
          dot(ctx, _px, _py, 3.4, '#3ad07a');
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(_px, _py, 3.4, 0, Math.PI * 2); ctx.stroke();
        }
      });
    });

    /* ---- ⑤⑥⑦ 据点 / NPC 城 / 玩家城 ----
       菱形版必须先把三者**合并、按纵深 (x+y) 排序**再画：
       斜投影里北边的物件要能被南边的物件盖住，而三种物件原本各走各的循环、
       顺序由数据决定 —— 南北相邻时会出现"南边的城被北边的城穿透"。
       分两遍：先画图标（受纵深遮挡），再画名带与角标（永远在最上层，保证可读）。 */
    var marks = [];
    GAME.map.fortsInView(gx0, gy0, gx1 - gx0 + 1, gy1 - gy0 + 1).forEach(function (f) {
      marks.push({ gx: f.x, gy: f.y, kind: 'fort', o: f });
    });
    (s.map.cities || []).forEach(function (cy2) {
      marks.push({ gx: cy2.x, gy: cy2.y, kind: 'npc', o: cy2 });
    });
    (s.cities || []).forEach(function (cy3) {
      marks.push({ gx: cy3.x, gy: cy3.y, kind: 'own', o: cy3 });
    });
    marks.sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });

    /* 图标：以**菱形中心**为基准。图标本身不旋转（等距游戏里建筑都是正交绘制的），
       高度按菱形外接框的 1.7 倍 —— 高于地块是正常的，那正是"立体"的来源。 */
    marks.forEach(function (m) {
      at(m.gx, m.gy, function (gx, gy, c, el) {
        var tcy = topCY(gx, gy, el);
        var ah = diaBox(gx, gy, el, 0).h;
        var isoSpan = (cell - IN * 2) * 0.97;   /* 菱形顶面宽（等距变换后的外接宽） */
        if (m.kind === 'fort') {
          /* v89.5：野外据点 = 木质营寨（矮墙 + 院内泥地 + 四角角楼 + 中央望楼 + 红旗）。
             底面中心放在地块中心稍下（菱形下尖方向），读起来才"站"在地上。 */
          drawFortArt(ctx, c.x, tcy + HH * 0.16, isoSpan * 0.74);
          return;
        }
        var o = m.o;
        var own = m.kind === 'own';
        var isCap = !own && o.type === 'capital', isZhou = !own && o.type === 'zhou';
        var isJun = !own && o.type === 'jun';
        /* v89.43+：城池位图已在 ② 段铺满菱形（作"围墙院落"地面），
           这里再叠一座**矢量立体城**（墙 + 角楼 + 主楼 + 四坡顶），
           缩到留出一圈贴图院落 → 读起来是"有城池的城"，不是一块平铺色块。
           ART 素材缺席时同样走这里（地面退回纯色，语义不变）。 */
        var bw = isoSpan * (isCap ? 0.72 : isZhou ? 0.68 : isJun ? 0.62 : 0.56);
        ctx.save();
        drawCityArt(ctx, c.x, tcy + HH * 0.18, bw,
          own ? { player: true } : { cap: isCap, zhou: isZhou, jun: isJun });
        ctx.restore();
        if (own) {
          /* 玩家城绿旗（"这是你的城"识别记号，立在城楼顶上） */
          var fy = tcy - HH * 0.60;
          ctx.strokeStyle = '#f0f4e8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(c.x, fy);
          ctx.lineTo(c.x, fy - isoSpan * 0.24);
          ctx.stroke();
          polyFill(ctx, [[c.x, fy - isoSpan * 0.24], [c.x + isoSpan * 0.095, fy - isoSpan * 0.195],
            [c.x, fy - isoSpan * 0.15]], '#7bc96f');
        }
      });
    });

    /* 名带 + 玩家城绿框 + 据点等级：统一放最上层（不随纵深被邻格盖住） */
    marks.forEach(function (m) {
      at(m.gx, m.gy, function (gx, gy, c, el) {
        var tcy = topCY(gx, gy, el), tb = topBottom(gx, gy, el);
        if (m.kind === 'fort') {
          if (!SHOW_LB) return;            /* v89.53：城外据点（建筑）标注随「🏷 名称」按钮同步显示/消失 */
          /* 名称底带（菱形下顶点下方，与城池/野地同款铭牌） */
          var fnm = m.o.name || '据点';
          ctx.font = 'bold 10px sans-serif';
          var fnw = fnm.length * 11 + 12;
          ctx.fillStyle = 'rgba(0,0,0,.72)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(c.x - fnw / 2, tb - 1, fnw, 14, 4);
          else ctx.rect(c.x - fnw / 2, tb - 1, fnw, 14);
          ctx.fill();
          ctx.fillStyle = '#e9c89a';       /* 木寨暖色，区别于城池金/野地绿 */
          ctx.fillText(fnm, c.x, tb + 6);
          /* 等级角标（菱形上半部居中，配色走木质营寨） */
          var flv = m.o.level || 1;
          var fbx = c.x, fby = c.y - HH * 0.36;
          ctx.fillStyle = 'rgba(96,66,28,.94)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(fbx - 10, fby - 7, 21, 15, 4);
          else ctx.rect(fbx - 10, fby - 7, 21, 15);
          ctx.fill();
          ctx.strokeStyle = 'rgba(233,200,154,.75)';
          ctx.lineWidth = 1; ctx.stroke();
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#e9c89a';
          ctx.fillText(String(flv), fbx, fby + 0.5);
          return;
        }
        var o = m.o, own = m.kind === 'own';
        var isCap = !own && o.type === 'capital', isZhou = !own && o.type === 'zhou';
        var isCty = !own && o.type === 'county';
        if (own) {
          ctx.strokeStyle = 'rgba(123,201,111,.92)';
          ctx.lineWidth = 2.5;
          diaPath(gx, gy, el, 0);
          ctx.stroke();
        } else {
          /* v50-a：城池也是**菱形地块** —— 加一圈描边把轮廓显出来。
             之前城池格不铺贴图、只有一个大方块图标，读起来"这块地还是正方形"。 */
          ctx.strokeStyle = (isCap || isZhou) ? 'rgba(255,236,180,.75)' : 'rgba(214,204,168,.5)';
          ctx.lineWidth = (isCap || isZhou) ? 1.8 : 1.2;
          diaPath(gx, gy, el, -IN * 0.5);
          ctx.stroke();
          if (isCap || isZhou) {   /* v89.67：档位药丸与城池名同命 —— **不再随开关消失**
                                      （老板：名城的显示不受「🏷 名称」影响；只关药丸会与
                                       "名字还在、档位没了"打架，读起来像坏了） */
            /* 档位标签：菱形**上半部居中** —— 菱形没有"格内上方"这种矩形区域。
               v89.5：黑底→彩色圆角药丸（都城朱红 / 州城鎏金），白字更清晰。 */
            var lvLabel = isCap ? '都城' : '州城';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = isCap ? 'rgba(176,46,46,.94)' : 'rgba(176,128,32,.94)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(c.x - 14, tcy - HH * 0.82, 28, 14, 4);
            else ctx.rect(c.x - 14, tcy - HH * 0.82, 28, 14);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(lvLabel, c.x, tcy - HH * 0.82 + 7);
          }
        }
        /* v89.56：城池名称不再在此处无条件绘制（曾导致「🏷 名称」按钮关不掉城池名）。
           城池名 + 等级统一由 drawCityLabel 绘制（单一出口，避免双写）。
           v89.67：drawCityLabel 现在**不受 SHOW_LB 控制** —— 老板要求名城名称永不消失，
           所以它成了城池标注的唯一出口，且常显（档位药丸同理，见上面 isCap/isZhou 分支）。 */
      });
    });

    /* ⛔ v89.139（老板 1）：「目前地图中有几个上下左右的箭头，去掉」——
       原「⑧ 视野外的州城/都城：边缘方向提示」（把视野外的名城投影到画布边缘、画 ◀▶▲▼）
       **整段退役**。它的信息（城在哪个方向）由缩略图/小地图承载，主图不再挂箭头。
       如需恢复：见 backup/v89139/map.js。 */

    /* ---- ⑨b 城池（名城 / 己方城）名称与等级：**整张图的最后一趟** ----
       v89.70（老板：「名城的名称永不消失（左下角名称菜单不影响名城的显示，不然地图上看不见了）」）
       原来城池名画在**标注趟**里，而那一趟之后还有 ⑦ 城池描边与档位药丸、
       ⑧ 野外据点的名称+等级、⑨ 视野外方向箭头 —— 任何一样都可能**压在城池名上**。
       真正的解法不是"再补一次判断"，而是**改绘制次序**：把它挪到最后，
       于是它在结构上**不可能**被任何图层盖住（"把约束力放在环境上"）。
       仍然**不看 SHOW_LB**：开关只收野地与据点（见上面标注趟）。 */
    drawList.forEach(function (d) {
      if (d.terrain === 'city') drawCityLabel(d);
    });

    /* ---- ⑨ 视口坐标标注（v44 移除） ----
       这里原来在画布左下角又画一块「(x,y) — (x,y)」，与浮动条上的"视野区间"重复。
       老板要求"坐标整到一行"—— 那一行在浮动条上，画布里不再重复画。
       textAlign 复位保留，供后续帧使用。 */
    ctx.textAlign = 'center';
  };
  /* 点击地图：视口坐标换算 + 命中城或野地 */
  /* v50：菱形网格的拾取 —— 反投影 + 取最近格心。
     屏幕 (mx,my) → 令 a = (mx−ox)/HW, b = (my−oy)/HH，则 (gx,gy) = ((a+b)/2, (b−a)/2)。
     菱形密铺时"格心最近"等价于"点在该菱形内"（菱形正是格心的 Voronoi 元）。
     全程只有乘除与 Math.round —— 无三角函数、无累积误差，同一像素必得同一格，
     所以 v16/v18 那种"某处对不齐"在这里结构上不可能发生。 */
  GAME.map.pick = function (canvas, clientX, clientY) {
    var v = GAME.map._view;
    if (!v || !v.cell || !v.HW) return null;
    var rect = canvas.getBoundingClientRect();
    /* ⚠️ 不能用 rect.width 直接缩放：canvas 带 3px 边框时 rect 含边框
       （实测 rect 1254 / 属性 1248），只差 0.5% —— 但菱形半宽只有 52px，
       在**靠近边界**的点上足以选到邻格，而且这种错"看起来像是手抖"，最难查。
       改用 clientWidth（布局宽，不含边框）并显式扣掉边框厚度。
       jsdom 无布局 → clientWidth 为 0，回落到 rect（旧行为，测试不受影响）。
       v89.150（老板 2）再加一层：整幅画面被 `transform: scale(k)` 缩放后，
       rect 给的是**视觉尺寸**（已乘过 k）。三处都要换口径：
         · 缩放比 k = GAME.appKOf()（实测「视觉宽 ÷ 布局宽」）；
         · 边框厚度 = offsetWidth − clientWidth（**布局值**，与缩放无关）；
         · 相对偏移 = (clientX − rect.left) ÷ k（把视觉偏移还原成布局偏移）。
       k=1 时与旧式逐像素一致 —— 不引入新口径。 */
    var _k150 = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var cw = canvas.clientWidth || rect.width / _k150, ch = canvas.clientHeight || rect.height / _k150;
    var bl = Math.max(0, ((canvas.offsetWidth || cw) - cw) / 2);
    var bt = Math.max(0, ((canvas.offsetHeight || ch) - ch) / 2);
    var mx = ((clientX - rect.left) / _k150 - bl) / cw * canvas.width;
    var my = ((clientY - rect.top) / _k150 - bt) / ch * canvas.height;
    var a = (mx - v.ox) / v.HW, b = (my - v.oy) / v.HH;
    var gx = Math.round((a + b) / 2), gy = Math.round((b - a) / 2);
    if (gx < 0 || gy < 0 || gx >= DATA.MAP_W || gy >= DATA.MAP_H) return null;
    /* 自己的城（含第二座起）优先于 NPC 判定 */
    var own = GAME.map.ownCityAt(gx, gy);
    if (own) return { kind: 'player', city: own, x: gx, y: gy };
    var npc = GAME.map.npcAt(gx, gy);
    if (npc) return { kind: 'npc', city: npc, x: gx, y: gy };
    var w2 = GAME.map.wildAt(gx, gy);
    if (w2) return { kind: 'wild', wild: w2, x: gx, y: gy };
    var f = GAME.map.fortAt(gx, gy);
    if (f) return { kind: 'fort', fort: f, x: gx, y: gy };
    return { kind: 'land', x: gx, y: gy };
  };

  /* ============================================================
   * v85（老板）：「底部导航栏增加一个缩略地图（覆盖 500×500），在缩略地图标注
   * 州城，郡城位置。对州郡的边界以不同样式的线条区分」
   * ------------------------------------------------------------
   * 全图 500×500 的州/郡归属一次性派生（按 map.seed 缓存；占领不影响 ——
   * 边界是**地理**划分，读 DATA.NPC_CITIES 的固有 state）：
   *   · 州域 = **多源「最近城」距离场**（每座非县城城市一个源，两遍 chamfer
   *     扫描近似欧氏传播）—— 城自身格必归自己，城点与色块严格一致。
   *   · 郡界 = 同州内相邻城的 jun id 变化处（标签自带 state，天然不跨州）。
   *   · v85.1（全面复核修复）：旧版按「最近州心 Voronoi」划分，实测 174 城中
   *     24 城（13.8%）色块与自身归属不符（如宛县属荆州却落在司隶色块内）——
   *     已换用下述距离场方案，复核探针验证零错位。
   * 输出：ownerState / ownerJun（Uint8Array × 25 万格）+ 中心坐标表。
   * 渲染（州染 / 界线 / 城点）在 ui 层，这里只管数据。
   * ============================================================ */
  GAME.map.miniBuild = function () {
    var s = GAME.state, seed = s.map.seed;
    if (GAME.map._mini && GAME.map._mini.seed === seed) return GAME.map._mini;
    var W = DATA.MAP_W, H = DATA.MAP_H;
    var stName = [], stX = [], stY = [];   /* 州心（出现顺序 = 色板下标；stX/stY 保留为输出扩展位） */
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;                      /* 县城不参与中心 */
      var si = stName.indexOf(c.state);
      if (si < 0) { si = stName.length; stName.push(c.state); }
      if (c.type === 'capital' || c.type === 'zhou') {
        if (stX[si] == null) { stX[si] = c.x; stY[si] = c.y; }
      }
    });
    /* v85.1（全面复核修复）：多源「最近城」距离场 —— 替换旧版「13 州心 Voronoi」。
       旧版实测 174 城中 24 城（13.8%）色块与自身州归属不符（如宛县属荆州却落在
       司隶色块内）。新法**以每座非县城城市为源**（带自身 state + jun id），
       两遍 chamfer 扫描（正交 5 / 对角 7，近似欧氏）传播「最近城」标签：
       城自身格距离 0 必归自己 → 城点与色块 100% 一致；界线沿相邻城平分线，
       且天然不跨州（标签自带 state）。 */
    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    var dist = new Int32Array(W * H), INF = 0x3fffffff;
    for (var q0 = 0; q0 < dist.length; q0++) dist[q0] = INF;
    /* jun id 分配：非县城按出现序 0..108；县城复用「同州最近郡心」的 id。
       （v85.1 复核补充：县城也是城、也作源 —— 首轮只修到 173/174，
       东平（兖州县城）仍被青州城抢走色块；县城入源后错位归零。） */
    var allC = DATA.NPC_CITIES || [];
    var junIds = [];
    var ng = 0;
    allC.forEach(function (c, cix) { junIds[cix] = c.type === 'county' ? -1 : ng++; });
    allC.forEach(function (c, cix) {
      var p = c.y * W + c.x;
      var j = junIds[cix];
      if (j < 0) {
        var bd = 1e18, bj = 0;
        allC.forEach(function (o, oix) {
          if (junIds[oix] < 0 || o.state !== c.state) return;
          var dx = c.x - o.x, dy = c.y - o.y, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; bj = junIds[oix]; }
        });
        j = bj;
      }
      dist[p] = 0;
      ownerState[p] = stName.indexOf(c.state);
      ownerJun[p] = j;
    });
    /* 正扫：左 / 上 / 左上 / 右上 四个已处理邻居 */
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var a = y * W + x, d = dist[a], s = ownerState[a], j = ownerJun[a], n, nd;
        if (x > 0) { n = a - 1; nd = dist[n] + 5; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (y > 0) { n = a - W; nd = dist[n] + 5; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (x > 0 && y > 0) { n = a - W - 1; nd = dist[n] + 7; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (x < W - 1 && y > 0) { n = a - W + 1; nd = dist[n] + 7; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        dist[a] = d; ownerState[a] = s; ownerJun[a] = j;
      }
    }
    /* 反扫：右 / 下 / 右下 / 左下 四个已处理邻居 */
    for (var y2 = H - 1; y2 >= 0; y2--) {
      for (var x2 = W - 1; x2 >= 0; x2--) {
        var a2 = y2 * W + x2, d2 = dist[a2], s2 = ownerState[a2], j2 = ownerJun[a2], n2, nd2;
        if (x2 < W - 1) { n2 = a2 + 1; nd2 = dist[n2] + 5; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (y2 < H - 1) { n2 = a2 + W; nd2 = dist[n2] + 5; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (x2 < W - 1 && y2 < H - 1) { n2 = a2 + W + 1; nd2 = dist[n2] + 7; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (x2 > 0 && y2 < H - 1) { n2 = a2 + W - 1; nd2 = dist[n2] + 7; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        dist[a2] = d2; ownerState[a2] = s2; ownerJun[a2] = j2;
      }
    }
    GAME.map._mini = { seed: seed, state: ownerState, jun: ownerJun,
      stName: stName, stX: stX, stY: stY };
    return GAME.map._mini;
  };

  /* ============================================================
   * v89.2：**场景插画**（老板「我想看见个湖，而不是一行字」）
   * ------------------------------------------------------------
   * 每个活动一幅程序化风景（12 种），画在 860×260 逻辑画布上，
   * 由 ui.js 的 <canvas class="sxf-canvas"> 承载（DPR 2 倍绘制）。
   * 全部复用本模块的画师原语（drawTree / mountain / grassTuft /
   * flower / dot / seg），与地图是同一套笔法 —— 风格天然一致。
   * 种子传格子坐标 → 同一地点每次打开画得一样（确定性）。
   * ============================================================ */
  var SCENE_W = 860, SCENE_H = 260;

  function sSky(ctx, c0, c1) {
    var g = ctx.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }
  function sSun(ctx, x, y, r, col, halo) {
    if (halo) {
      var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3);
      g.addColorStop(0, halo); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    dot(ctx, x, y, r, col);
  }
  function sCloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    var p = [[0, 0, 1.0], [0.72, 0.16, 0.74], [-0.7, 0.18, 0.7], [0.34, -0.28, 0.58], [-0.3, -0.22, 0.52]];
    for (var i = 0; i < p.length; i++) {
      ctx.beginPath();
      ctx.ellipse(x + p[i][0] * 30 * s, y + p[i][1] * 30 * s, 22 * s * p[i][2], 13 * s * p[i][2], 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  /* 远山折线（baseY 处起峰，amp 高度；种子化） */
  function sRidge(ctx, baseY, amp, col, seed) {
    var r = U.rng((seed | 0) * 7 + 13);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-12, SCENE_H);
    var x = -12;
    while (x < SCENE_W + 12) {
      var w = 96 + r() * 140, hh = amp * (0.5 + r() * 0.8);
      ctx.lineTo(x + w * 0.5, baseY - hh);
      ctx.lineTo(x + w, baseY - amp * 0.10 * (0.4 + r()));
      x += w;
    }
    ctx.lineTo(SCENE_W + 12, SCENE_H);
    ctx.closePath(); ctx.fill();
  }
  function sGround(ctx, y, c0, c1) {
    var g = ctx.createLinearGradient(0, y, 0, SCENE_H);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, y, SCENE_W, SCENE_H - y);
  }
  /* 竖立的鹘形旗（杆 + 三角旗） */
  function sFlag(ctx, x, yBase, h, col, poleCol) {
    seg(ctx, x, yBase, x, yBase - h, poleCol || '#5c4a30', 3);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, yBase - h);
    ctx.lineTo(x + 34, yBase - h + 9);
    ctx.lineTo(x, yBase - h + 19);
    ctx.closePath(); ctx.fill();
  }

  var SCENE_PAINT = {
    /* 湖 · 垂钓（老板点名的那个湖：芦苇 / 湖心石 / 柳荫 三处钓位） */
    lake: function (ctx, sd) {
      sSky(ctx, '#cfe7f4', '#f6fbfd');
      sSun(ctx, 694, 50, 19, '#fdf3cf', 'rgba(255,246,214,.5)');
      sCloud(ctx, 186, 50, 1.1, 'rgba(255,255,255,.85)');
      sCloud(ctx, 508, 32, 0.78, 'rgba(255,255,255,.7)');
      sCloud(ctx, 782, 68, 0.6, 'rgba(255,255,255,.6)');
      sRidge(ctx, 126, 44, '#b3cbd8', sd);
      sRidge(ctx, 136, 24, '#98b7c9', sd + 5);
      var wg = ctx.createLinearGradient(0, 124, 0, SCENE_H);
      wg.addColorStop(0, '#8ec6e3'); wg.addColorStop(0.55, '#5d9ec6'); wg.addColorStop(1, '#2e6b95');
      ctx.fillStyle = wg; ctx.fillRect(0, 124, SCENE_W, SCENE_H - 124);
      ctx.strokeStyle = 'rgba(255,255,255,.48)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var i = 0; i < 8; i++) {
        var rx = 60 + i * 106, ry = 146 + (i % 3) * 32;
        ctx.beginPath(); ctx.arc(rx, ry, 24 + (i % 2) * 9, Math.PI * 1.14, Math.PI * 1.86); ctx.stroke();
      }
      /* 左：沙岸 + 芦苇荡 */
      ctx.fillStyle = '#d9c78e';
      ctx.beginPath(); ctx.ellipse(0, 236, 190, 62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9b478';
      ctx.beginPath(); ctx.ellipse(150, 246, 130, 30, 0, 0, Math.PI * 2); ctx.fill();
      var reeds = [[64, 210], [88, 202], [112, 214], [76, 224], [140, 218]];
      for (var r2 = 0; r2 < reeds.length; r2++) {
        var rx2 = reeds[r2][0], ry2 = reeds[r2][1];
        seg(ctx, rx2, ry2, rx2 - 5, ry2 - 40, 'rgba(84,112,48,.95)', 2.4);
        seg(ctx, rx2 + 6, ry2, rx2 + 12, ry2 - 34, 'rgba(96,124,54,.9)', 2);
        dot(ctx, rx2 - 6, ry2 - 42, 3.4, '#a8894a');
        dot(ctx, rx2 + 13, ry2 - 36, 3, '#b3945a');
      }
      /* 中：湖心石 */
      ctx.fillStyle = '#8d949c';
      ctx.beginPath(); ctx.ellipse(452, 190, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a6adb4';
      ctx.beginPath(); ctx.ellipse(448, 184, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(452, 196, 36, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      /* 中：浮漂（钓鱼的那一点红） */
      dot(ctx, 560, 176, 4.2, '#d8493a');
      dot(ctx, 560, 181, 3, '#f2f2ee');
      /* 右：栈桥 + 柳树 */
      ctx.fillStyle = '#8a6236';
      ctx.fillRect(660, 168, 200, 9);
      for (var p2 = 0; p2 < 5; p2++) ctx.fillRect(672 + p2 * 36, 177, 8, 34);
      ctx.fillStyle = '#6f4d28';
      ctx.fillRect(660, 208, 200, 6);
      seg(ctx, 792, 172, 792, 96, '#6a4a28', 7);
      ctx.strokeStyle = 'rgba(74,124,52,.9)'; ctx.lineWidth = 2.2;
      for (var w2 = 0; w2 < 7; w2++) {
        var wx = 792 + (w2 - 3) * 16;
        ctx.beginPath();
        ctx.moveTo(792, 108);
        ctx.quadraticCurveTo(wx + 6, 128, wx + (w2 - 3) * 5, 150);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(74,124,52,.85)';
      ctx.beginPath(); ctx.ellipse(792, 96, 52, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(96,150,64,.8)';
      ctx.beginPath(); ctx.ellipse(770, 88, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
      /* 天空飞鸟 */
      seg(ctx, 300, 62, 312, 56, 'rgba(70,90,110,.6)', 2);
      seg(ctx, 312, 56, 324, 62, 'rgba(70,90,110,.6)', 2);
      seg(ctx, 356, 78, 365, 73, 'rgba(70,90,110,.5)', 1.7);
      seg(ctx, 365, 73, 374, 78, 'rgba(70,90,110,.5)', 1.7);
    },

    /* 山寨 · 讨伐（栅栏寨门 + 望楼 + 火把） */
    fort: function (ctx, sd) {
      sSky(ctx, '#e6d2a8', '#f7ecd2');
      sSun(ctx, 168, 60, 22, '#ffdda2', 'rgba(255,214,150,.45)');
      sCloud(ctx, 560, 46, 0.9, 'rgba(255,252,240,.6)');
      sRidge(ctx, 120, 52, '#8d7d5e', sd);
      sRidge(ctx, 134, 30, '#796a4e', sd + 3);
      sGround(ctx, 138, '#77854f', '#5d6b3c');
      /* 栅栏墙：尖头木桩 */
      for (var i = 0; i < 22; i++) {
        var x = 120 + i * 28, h = 46 + (i % 3) * 5;
        ctx.fillStyle = i % 2 ? '#8a6236' : '#7d5730';
        ctx.fillRect(x, 186 - h, 10, h);
        ctx.beginPath();
        ctx.moveTo(x, 186 - h); ctx.lineTo(x + 5, 186 - h - 9); ctx.lineTo(x + 10, 186 - h);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#6f4d28';
      ctx.fillRect(112, 186, 640, 7);
      /* 寨门（左 0.30 附近加高 + 望楼） */
      ctx.fillStyle = '#7a5430';
      ctx.fillRect(246, 100, 86, 86);
      ctx.fillStyle = '#8a6236';
      ctx.fillRect(238, 92, 102, 12);
      ctx.fillStyle = '#3c2a16';
      ctx.fillRect(272, 130, 34, 56);
      sFlag(ctx, 258, 92, 42, '#b5453a');
      sFlag(ctx, 690, 186, 58, '#b5453a');
      /* 火把两处 */
      dot(ctx, 216, 152, 5, '#f2a03c');
      dot(ctx, 216, 152, 10, 'rgba(242,160,60,.25)');
      dot(ctx, 392, 150, 5, '#f2a03c');
      dot(ctx, 392, 150, 10, 'rgba(242,160,60,.25)');
      /* 右侧侧坡小路（迂回） */
      ctx.strokeStyle = 'rgba(198,168,112,.75)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(640, 214); ctx.quadraticCurveTo(700, 178, 762, 196); ctx.stroke();
      mountain(ctx, 786, 168, 66, 74, '#b3a37f', '#8b7b5b');
    },

    /* 古阵 · 试炼（石柱 + 阵纹光圈） */
    array: function (ctx, sd) {
      sSky(ctx, '#5d6b7e', '#a6b4c0');
      sSun(ctx, 700, 52, 16, 'rgba(226,236,244,.85)', 'rgba(214,228,240,.3)');
      sCloud(ctx, 240, 44, 0.8, 'rgba(222,230,238,.35)');
      sRidge(ctx, 122, 40, '#6d7686', sd);
      sGround(ctx, 132, '#565b4c', '#42463a');
      /* 阵纹光圈（两环 + 刻度） */
      ctx.strokeStyle = 'rgba(111,208,232,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(430, 208, 210, 44, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(111,208,232,.4)';
      ctx.beginPath(); ctx.ellipse(430, 208, 150, 31, 0, 0, Math.PI * 2); ctx.stroke();
      /* 刻度 12 枚：用**预置单位圆表**而不是 Math.sin/cos ——
         v50 守卫规定 map.js 全文件纯线性变换（等距绘制的误差不许靠三角函数累积） */
      var RUNE_U = [[1, 0], [0.866, 0.5], [0.5, 0.866], [0, 1], [-0.5, 0.866], [-0.866, 0.5],
        [-1, 0], [-0.866, -0.5], [-0.5, -0.866], [0, -1], [0.5, -0.866], [0.866, -0.5]];
      for (var i = 0; i < 12; i++) {
        var ux = RUNE_U[i][0], uy = RUNE_U[i][1];
        seg(ctx, 430 + ux * 204, 208 + uy * 42,
          430 + ux * 214, 208 + uy * 46, 'rgba(111,208,232,.5)', 2);
      }
      /* 石柱（四根，高低错落） */
      var pil = [[112, 92], [306, 74], [560, 80], [742, 96]];
      for (var p = 0; p < pil.length; p++) {
        var px = pil[p][0], ph = pil[p][1];
        ctx.fillStyle = p % 2 ? '#8d9199' : '#7d8189';
        ctx.fillRect(px, 206 - ph, 26, ph);
        ctx.fillStyle = '#a2a6ae';
        ctx.fillRect(px, 206 - ph, 26, 8);
        seg(ctx, px + 9, 206 - ph + 18, px + 18, 206 - ph + 30, 'rgba(50,54,60,.45)', 2);
        seg(ctx, px + 16, 206 - ph + 40, px + 8, 206 - ph + 54, 'rgba(50,54,60,.4)', 2);
      }
      /* 雾气 */
      ctx.fillStyle = 'rgba(214,222,226,.16)';
      ctx.fillRect(0, 150, SCENE_W, 26);
      ctx.fillStyle = 'rgba(214,222,226,.12)';
      ctx.fillRect(0, 186, SCENE_W, 18);
      dot(ctx, 430, 208, 6, 'rgba(111,208,232,.5)');
    },

    /* 山野 · 采集（草坡 + 溪 + 崖边 + 林缘） */
    meadow: function (ctx, sd) {
      sSky(ctx, '#cfe3ea', '#f8f5e2');
      sSun(ctx, 640, 48, 18, '#fdf0c0', 'rgba(255,244,200,.45)');
      sCloud(ctx, 220, 40, 0.9, 'rgba(255,255,255,.8)');
      sRidge(ctx, 116, 38, '#b0bd92', sd);
      sGround(ctx, 126, '#9cb163', '#7a9448');
      /* 左：崖壁 */
      ctx.fillStyle = '#9d9078';
      ctx.beginPath();
      ctx.moveTo(0, 126); ctx.lineTo(120, 126); ctx.lineTo(96, 210); ctx.lineTo(0, 226);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b0a289';
      ctx.beginPath();
      ctx.moveTo(0, 126); ctx.lineTo(64, 126); ctx.lineTo(50, 186); ctx.lineTo(0, 198);
      ctx.closePath(); ctx.fill();
      seg(ctx, 22, 150, 58, 142, 'rgba(84,76,58,.35)', 2);
      seg(ctx, 30, 172, 72, 164, 'rgba(84,76,58,.3)', 2);
      /* 中：溪流 */
      ctx.fillStyle = '#8fc2dd';
      ctx.beginPath();
      ctx.moveTo(330, 260); ctx.quadraticCurveTo(392, 208, 430, 168);
      ctx.quadraticCurveTo(448, 148, 470, 132);
      ctx.lineTo(500, 132); ctx.quadraticCurveTo(478, 152, 462, 172);
      ctx.quadraticCurveTo(430, 212, 396, 260);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(378, 232); ctx.quadraticCurveTo(408, 202, 442, 168); ctx.stroke();
      /* 右：林缘两三棵树 */
      drawTree(ctx, 742, 196, 1.05);
      drawTree(ctx, 802, 202, 0.86);
      drawTree(ctx, 676, 200, 0.72);
      /* 草簇与花 */
      var tufts = [[150, 238, 1.1], [214, 226, 0.95], [280, 244, 1.05], [352, 200, 0.8],
        [560, 238, 1.1], [620, 224, 0.9], [700, 246, 1.0], [840, 232, 0.9], [480, 252, 1.05]];
      for (var t = 0; t < tufts.length; t++) grassTuft(ctx, tufts[t][0], tufts[t][1], tufts[t][2]);
      var fls = [[186, 232], [246, 214], [316, 238], [586, 226], [648, 240], [764, 236], [516, 244]];
      for (var f = 0; f < fls.length; f++) flower(ctx, fls[f][0], fls[f][1], 1);
      /* 蝴蝶 */
      dot(ctx, 400, 180, 2.4, '#e8e2f0'); dot(ctx, 406, 176, 2.2, '#e8e2f0');
      dot(ctx, 620, 166, 2.2, '#f0e2d0'); dot(ctx, 626, 162, 2, '#f0e2d0');
    },

    /* 林间 · 修炼（层林 + 光柱 + 石台） */
    grove: function (ctx, sd) {
      sSky(ctx, '#c9dcc9', '#eff4dd');
      sSun(ctx, 700, 44, 16, '#fff6d2', 'rgba(255,248,214,.5)');
      /* 光柱 */
      ctx.fillStyle = 'rgba(255,250,220,.18)';
      ctx.beginPath(); ctx.moveTo(650, 0); ctx.lineTo(760, 0); ctx.lineTo(600, SCENE_H); ctx.lineTo(470, SCENE_H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,220,.12)';
      ctx.beginPath(); ctx.moveTo(420, 0); ctx.lineTo(478, 0); ctx.lineTo(360, SCENE_H); ctx.lineTo(300, SCENE_H); ctx.closePath(); ctx.fill();
      sRidge(ctx, 120, 34, '#a9bb96', sd);
      sGround(ctx, 132, '#6d884a', '#55703a');
      drawTree(ctx, 96, 196, 1.25);
      drawTree(ctx, 240, 186, 1.0);
      drawTree(ctx, 396, 200, 1.15);
      drawTree(ctx, 560, 190, 1.3);
      drawTree(ctx, 700, 200, 0.95);
      drawTree(ctx, 812, 192, 1.1);
      /* 中央石台（打坐处） */
      ctx.fillStyle = '#9aa08a';
      ctx.beginPath(); ctx.ellipse(470, 224, 62, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#adb3a0';
      ctx.beginPath(); ctx.ellipse(470, 216, 54, 15, 0, 0, Math.PI * 2); ctx.fill();
      /* 苔点与蕨叶 */
      var moss = [[150, 240], [300, 232], [640, 244], [770, 236], [560, 240]];
      for (var m = 0; m < moss.length; m++) dot(ctx, moss[m][0], moss[m][1], 4, 'rgba(58,96,44,.55)');
      for (var q = 0; q < 3; q++) {
        var qx = 560 + q * 60;
        seg(ctx, qx, 250, qx - 10, 236, 'rgba(74,110,50,.8)', 2);
        seg(ctx, qx, 250, qx + 8, 234, 'rgba(74,110,50,.7)', 2);
      }
    },

    /* 柴扉 · 拜访（茅屋 + 竹篱 + 炊烟） */
    cottage: function (ctx, sd) {
      sSky(ctx, '#d6dfe6', '#f6f0e2');
      sSun(ctx, 210, 54, 17, '#fdf0c8', 'rgba(255,242,204,.4)');
      sCloud(ctx, 620, 44, 0.85, 'rgba(255,255,255,.75)');
      sRidge(ctx, 122, 36, '#a8b0a2', sd);
      sGround(ctx, 132, '#8fa05e', '#748a48');
      /* 茅屋 */
      ctx.fillStyle = '#cbb98f';
      ctx.beginPath();
      ctx.moveTo(300, 208); ctx.lineTo(300, 150); ctx.lineTo(470, 150); ctx.lineTo(470, 208);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b99a5c';
      ctx.beginPath();
      ctx.moveTo(282, 152); ctx.lineTo(385, 96); ctx.lineTo(488, 152);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,94,52,.55)';
      ctx.beginPath();
      ctx.moveTo(282, 152); ctx.lineTo(385, 96); ctx.lineTo(385, 152);
      ctx.closePath(); ctx.fill();
      seg(ctx, 300, 138, 470, 138, 'rgba(110,86,48,.5)', 3);
      ctx.fillStyle = '#5f452a';
      ctx.fillRect(360, 168, 40, 40);
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(322, 164, 24, 22);
      seg(ctx, 334, 164, 334, 186, 'rgba(80,60,32,.7)', 2);
      seg(ctx, 322, 175, 346, 175, 'rgba(80,60,32,.7)', 2);
      /* 炊烟 */
      dot(ctx, 424, 92, 7, 'rgba(240,240,235,.5)');
      dot(ctx, 436, 78, 9, 'rgba(240,240,235,.36)');
      dot(ctx, 452, 62, 11, 'rgba(240,240,235,.24)');
      /* 竹篱（前景） */
      for (var i = 0; i < 18; i++) {
        var x = 60 + i * 44;
        ctx.fillStyle = i % 2 ? '#9a7a48' : '#8d6e40';
        ctx.fillRect(x, 210, 7, 44);
        ctx.beginPath();
        ctx.moveTo(x, 210); ctx.lineTo(x + 3.5, 203); ctx.lineTo(x + 7, 210);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#8d6e40';
      ctx.fillRect(60, 222, 780, 5);
      ctx.fillRect(60, 236, 780, 4);
      /* 右侧树与石径 */
      drawTree(ctx, 760, 196, 1.0);
      ctx.strokeStyle = 'rgba(194,173,128,.8)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(560, 258); ctx.quadraticCurveTo(600, 234, 640, 216); ctx.stroke();
    },

    /* 山道 · 绿林（两壁夹道 + 远处寨门） */
    road: function (ctx, sd) {
      sSky(ctx, '#c9d4dc', '#f0ead8');
      sSun(ctx, 700, 50, 16, '#fdf0c8', 'rgba(255,242,204,.35)');
      sCloud(ctx, 240, 42, 0.8, 'rgba(255,255,255,.7)');
      sRidge(ctx, 116, 42, '#98a08e', sd);
      sGround(ctx, 128, '#7f8b56', '#66743f');
      /* 左崖 */
      ctx.fillStyle = '#8d8168';
      ctx.beginPath();
      ctx.moveTo(0, 128); ctx.lineTo(230, 128); ctx.lineTo(180, 206); ctx.lineTo(96, 236); ctx.lineTo(0, 240);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a3967c';
      ctx.beginPath();
      ctx.moveTo(0, 128); ctx.lineTo(150, 128); ctx.lineTo(120, 190); ctx.lineTo(60, 214); ctx.lineTo(0, 218);
      ctx.closePath(); ctx.fill();
      /* 右崖 */
      ctx.fillStyle = '#847860';
      ctx.beginPath();
      ctx.moveTo(860, 128); ctx.lineTo(640, 128); ctx.lineTo(700, 210); ctx.lineTo(790, 236); ctx.lineTo(860, 240);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a8e74';
      ctx.beginPath();
      ctx.moveTo(860, 128); ctx.lineTo(716, 128); ctx.lineTo(756, 196); ctx.lineTo(820, 216); ctx.lineTo(860, 218);
      ctx.closePath(); ctx.fill();
      /* 山道（两段折线带） */
      ctx.strokeStyle = '#c2ad80'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(400, 258); ctx.quadraticCurveTo(430, 208, 428, 176); ctx.stroke();
      ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(428, 180); ctx.quadraticCurveTo(426, 152, 400, 132); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,98,60,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(392, 246); ctx.quadraticCurveTo(416, 210, 414, 178); ctx.stroke();
      /* 松树点缀 */
      drawTree(ctx, 250, 156, 0.7);
      drawTree(ctx, 620, 158, 0.72);
      drawTree(ctx, 96, 148, 0.6);
      /* 远处寨门（细看才见） */
      ctx.fillStyle = 'rgba(90,66,38,.85)';
      ctx.fillRect(392, 118, 26, 18);
      ctx.fillStyle = 'rgba(120,92,52,.85)';
      ctx.fillRect(388, 114, 34, 6);
      dot(ctx, 405, 108, 3, '#b5453a');
    },

    /* 沼泽 · 寻宝（水洼 + 枯木 + 雾带） */
    marsh: function (ctx, sd) {
      sSky(ctx, '#9fae9a', '#dadec6');
      sSun(ctx, 660, 52, 15, 'rgba(240,238,214,.8)', 'rgba(235,235,214,.3)');
      sRidge(ctx, 118, 30, '#7f8f76', sd);
      sGround(ctx, 128, '#5e6b47', '#48543a');
      var pools = [[130, 200, 96, 26], [400, 226, 120, 30], [660, 204, 104, 27], [780, 244, 90, 22]];
      for (var p = 0; p < pools.length; p++) {
        var po = pools[p];
        ctx.fillStyle = '#557064';
        ctx.beginPath(); ctx.ellipse(po[0], po[1], po[2], po[3], 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a6357';
        ctx.beginPath(); ctx.ellipse(po[0], po[1] + 3, po[2] * 0.72, po[3] * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(po[0] - po[2] * 0.2, po[1], po[2] * 0.4, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      }
      /* 芦苇丛（三处） */
      var cl = [[70, 224], [310, 196], [730, 214]];
      for (var c = 0; c < cl.length; c++) {
        for (var i = 0; i < 4; i++) {
          var rx = cl[c][0] + i * 13, ry = cl[c][1] + (i % 2) * 6;
          seg(ctx, rx, ry, rx - 4, ry - 40 - (i % 3) * 8, 'rgba(88,116,52,.9)', 2.2);
          dot(ctx, rx - 5, ry - 42 - (i % 3) * 8, 3, '#a8894a');
        }
      }
      /* 枯木 */
      seg(ctx, 560, 216, 566, 128, '#6a5a42', 7);
      seg(ctx, 564, 176, 528, 150, '#6a5a42', 4);
      seg(ctx, 565, 156, 604, 136, '#6a5a42', 4);
      seg(ctx, 530, 150, 512, 138, '#6a5a42', 2.5);
      seg(ctx, 604, 136, 622, 122, '#6a5a42', 2.5);
      /* 雾带 */
      ctx.fillStyle = 'rgba(226,232,222,.22)';
      ctx.fillRect(0, 148, SCENE_W, 22);
      ctx.fillStyle = 'rgba(226,232,222,.14)';
      ctx.fillRect(0, 184, SCENE_W, 16);
      /* 锈戟（插在泥里的旧兵器） */
      seg(ctx, 226, 224, 238, 168, 'rgba(90,84,74,.9)', 3);
      ctx.fillStyle = 'rgba(120,110,96,.9)';
      ctx.beginPath(); ctx.moveTo(238, 168); ctx.lineTo(250, 174); ctx.lineTo(236, 182); ctx.closePath(); ctx.fill();
    },

    /* 地宫 · 探险（沙丘 + 石门 + 断柱） */
    ruin: function (ctx, sd) {
      sSky(ctx, '#e8d9a8', '#f9efd8');
      sSun(ctx, 690, 46, 20, '#fff2cc', 'rgba(255,242,204,.5)');
      sCloud(ctx, 200, 38, 0.7, 'rgba(255,255,255,.5)');
      /* 沙丘两层 */
      ctx.fillStyle = '#e2c98c';
      ctx.beginPath(); ctx.moveTo(-10, 200);
      ctx.quadraticCurveTo(180, 116, 420, 196);
      ctx.quadraticCurveTo(650, 250, 870, 186);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9bd7d';
      ctx.beginPath(); ctx.moveTo(-10, 232);
      ctx.quadraticCurveTo(240, 178, 520, 236);
      ctx.quadraticCurveTo(700, 268, 870, 228);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      /* 沙纹 */
      ctx.strokeStyle = 'rgba(160,124,56,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(70, 224); ctx.quadraticCurveTo(110, 218, 150, 224); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(600, 214); ctx.quadraticCurveTo(640, 208, 680, 214); ctx.stroke();
      /* 石门（半埋） */
      ctx.fillStyle = '#b7a37e';
      ctx.fillRect(316, 118, 128, 96);
      ctx.fillStyle = '#3f3a33';
      ctx.beginPath();
      ctx.moveTo(344, 214); ctx.lineTo(344, 152);
      ctx.quadraticCurveTo(380, 122, 416, 152);
      ctx.lineTo(416, 214); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8d7c5c';
      ctx.fillRect(308, 108, 144, 14);
      /* 门前石阶 */
      ctx.fillStyle = '#c8b48c';
      ctx.fillRect(330, 214, 100, 9);
      ctx.fillStyle = '#b7a37e';
      ctx.fillRect(322, 223, 116, 9);
      /* 断柱两根 */
      ctx.fillStyle = '#a89676';
      ctx.fillRect(560, 158, 22, 60);
      ctx.fillStyle = '#bda98a';
      ctx.fillRect(560, 150, 22, 10);
      seg(ctx, 564, 182, 578, 194, 'rgba(70,60,44,.4)', 2);
      ctx.fillStyle = '#a89676';
      ctx.fillRect(672, 186, 20, 42);
      ctx.fillStyle = '#bda98a';
      ctx.fillRect(672, 180, 20, 8);
      /* 散落石块 */
      dot(ctx, 250, 236, 7, '#c0aa80'); dot(ctx, 470, 244, 9, '#c0aa80');
      dot(ctx, 740, 238, 6, '#c0aa80'); dot(ctx, 120, 244, 8, '#c0aa80');
    },

    /* 行猎 · 森林（密林 + 兽迹 + 光斑） */
    hunt: function (ctx, sd) {
      sSky(ctx, '#bcd0b0', '#eaf2dc');
      sSun(ctx, 180, 42, 15, '#fff6d2', 'rgba(255,248,214,.45)');
      sRidge(ctx, 118, 30, '#8ea585', sd);
      sGround(ctx, 128, '#5f7a3c', '#4b6430');
      drawTree(ctx, 70, 150, 0.85);
      drawTree(ctx, 190, 142, 0.95);
      drawTree(ctx, 320, 148, 0.8);
      drawTree(ctx, 470, 140, 1.0);
      drawTree(ctx, 620, 148, 0.88);
      drawTree(ctx, 760, 142, 0.98);
      drawTree(ctx, 130, 210, 1.2);
      drawTree(ctx, 400, 216, 1.3);
      drawTree(ctx, 700, 212, 1.15);
      /* 光斑 */
      ctx.fillStyle = 'rgba(255,250,214,.16)';
      ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(380, 0); ctx.lineTo(260, SCENE_H); ctx.lineTo(196, SCENE_H); ctx.closePath(); ctx.fill();
      /* 鹿（中景剪影） */
      ctx.fillStyle = '#6b4f2f';
      ctx.beginPath(); ctx.ellipse(604, 196, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(622, 190); ctx.lineTo(636, 172); ctx.lineTo(644, 174);
      ctx.lineTo(632, 194); ctx.closePath(); ctx.fill();
      ctx.fillRect(586, 204, 4, 18); ctx.fillRect(600, 204, 4, 18);
      ctx.fillRect(616, 204, 4, 18); ctx.fillRect(626, 204, 4, 16);
      seg(ctx, 638, 172, 646, 162, '#6b4f2f', 2);
      seg(ctx, 644, 172, 652, 164, '#6b4f2f', 2);
      /* 兽迹 */
      dot(ctx, 262, 240, 3, 'rgba(70,54,30,.55)');
      dot(ctx, 278, 232, 2.6, 'rgba(70,54,30,.5)');
      dot(ctx, 296, 228, 2.6, 'rgba(70,54,30,.45)');
      dot(ctx, 316, 224, 2.2, 'rgba(70,54,30,.4)');
    },

    /* 草原 · 牧马（大天 + 草浪 + 马群剪影） */
    steppe: function (ctx, sd) {
      sSky(ctx, '#a8cbe4', '#ecf6fa');
      sSun(ctx, 700, 46, 17, '#fffbe0', 'rgba(255,251,224,.4)');
      sCloud(ctx, 180, 44, 1.25, 'rgba(255,255,255,.9)');
      sCloud(ctx, 470, 30, 0.95, 'rgba(255,255,255,.8)');
      sCloud(ctx, 740, 58, 0.7, 'rgba(255,255,255,.7)');
      /* 两道草浪 */
      ctx.fillStyle = '#b6c88e';
      ctx.beginPath(); ctx.moveTo(-10, 170);
      ctx.quadraticCurveTo(220, 132, 470, 168);
      ctx.quadraticCurveTo(690, 198, 870, 160);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a2b871';
      ctx.beginPath(); ctx.moveTo(-10, 208);
      ctx.quadraticCurveTo(260, 178, 520, 210);
      ctx.quadraticCurveTo(720, 234, 870, 204);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8ea757';
      ctx.beginPath(); ctx.moveTo(-10, 244);
      ctx.quadraticCurveTo(300, 224, 560, 248);
      ctx.quadraticCurveTo(760, 264, 870, 246);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      /* 马群剪影（三匹，远小近大） */
      function horse(x, y, s, col) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 16 * s, y - 5 * s); ctx.lineTo(x + 30 * s, y - 19 * s);
        ctx.lineTo(x + 36 * s, y - 15 * s); ctx.lineTo(x + 24 * s, y + 1 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 16 * s, y + 6 * s, 3.4 * s, 15 * s);
        ctx.fillRect(x - 6 * s, y + 7 * s, 3.4 * s, 14 * s);
        ctx.fillRect(x + 6 * s, y + 6 * s, 3.4 * s, 15 * s);
        ctx.fillRect(x + 15 * s, y + 6 * s, 3.2 * s, 14 * s);
        seg(ctx, x + 34 * s, y - 17 * s, x + 40 * s, y - 27 * s, col, 2 * s);
      }
      horse(150, 214, 0.7, 'rgba(74,84,104,.72)');
      horse(216, 222, 0.9, 'rgba(66,76,96,.85)');
      horse(700, 218, 0.8, 'rgba(74,84,104,.8)');
      horse(626, 232, 1.05, 'rgba(58,68,88,.92)');
      /* 草簇 */
      var t2 = [[70, 256, 1.1], [320, 250, 1.0], [470, 244, 0.9], [560, 254, 1.05], [800, 248, 1.0], [360, 258, 1.1]];
      for (var i = 0; i < t2.length; i++) grassTuft(ctx, t2[i][0], t2[i][1], t2[i][2]);
      /* 飞鸟 */
      seg(ctx, 260, 70, 272, 64, 'rgba(70,90,110,.55)', 2);
      seg(ctx, 272, 64, 284, 70, 'rgba(70,90,110,.55)', 2);
      seg(ctx, 316, 84, 326, 79, 'rgba(70,90,110,.45)', 1.7);
      seg(ctx, 326, 79, 336, 84, 'rgba(70,90,110,.45)', 1.7);
    },

    /* 演武场 · 切磋（夯土场 + 兵器架 + 木桩 + 旗） */
    yard: function (ctx, sd) {
      sSky(ctx, '#d8d2c0', '#f4efe2');
      sSun(ctx, 660, 48, 17, '#fdf0c8', 'rgba(255,242,204,.4)');
      sCloud(ctx, 230, 40, 0.8, 'rgba(255,255,255,.7)');
      sRidge(ctx, 120, 30, '#a8a08c', sd);
      sGround(ctx, 130, '#b6a67c', '#9c8c64');
      /* 场边矮墙 */
      ctx.fillStyle = '#a2946c';
      ctx.fillRect(0, 168, SCENE_W, 26);
      ctx.fillStyle = '#8f8159';
      ctx.fillRect(0, 190, SCENE_W, 6);
      /* 兵器架 ×2 */
      function rack(x, y) {
        seg(ctx, x, y, x, y - 54, '#6b4f2c', 5);
        seg(ctx, x + 46, y, x + 46, y - 54, '#6b4f2c', 5);
        seg(ctx, x - 6, y - 40, x + 52, y - 40, '#7a5a33', 5);
        for (var i = 0; i < 3; i++) {
          var sx = x + 6 + i * 16;
          seg(ctx, sx, y - 38, sx - 5, y - 74, 'rgba(96,88,76,.95)', 3);
          dot(ctx, sx - 5, y - 76, 3, '#9aa0a8');
        }
      }
      rack(218, 226); rack(636, 226);
      /* 木桩（人形靶） */
      ctx.fillStyle = '#7a5a33';
      ctx.fillRect(392, 176, 14, 66);
      ctx.fillRect(360, 192, 78, 10);
      dot(ctx, 399, 168, 15, '#c9b06a');
      seg(ctx, 380, 200, 372, 190, 'rgba(90,66,36,.8)', 3);
      /* 旗杆 */
      sFlag(ctx, 762, 226, 96, '#b5453a', '#5c4a30');
      /* 地面磨痕 */
      ctx.strokeStyle = 'rgba(120,100,64,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(420, 236, 66, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(430, 246, 90, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    },
  };

  /* 对外出口：把 12 种场景画到任意 2D 上下文上。
     seed 传格子坐标（确定性）；ctx 缺失（测试桩）时静默跳过。 */
  GAME.map.SCENE_KEYS = ['lake', 'fort', 'array', 'meadow', 'grove', 'cottage',
    'road', 'marsh', 'ruin', 'hunt', 'steppe', 'yard'];
  GAME.map.paintScene = function (ctx, scene, seed) {
    if (!ctx) return false;
    var fn = SCENE_PAINT[scene] || SCENE_PAINT.meadow;
    if (!fn) return false;
    /* DPR 2 倍绘制：save + scale + restore（不用仿射矩阵与旋转变换 ——
       v50 守卫规定等距绘制必须正交铺贴 + 菱形裁切，误差不许靠变换累积） */
    if (ctx.save) ctx.save();
    if (ctx.scale) ctx.scale(2, 2);
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    fn(ctx, (seed | 0) || 7);
    if (ctx.restore) ctx.restore();
    return true;
  };
  GAME.map.SCENE_W = SCENE_W;
  GAME.map.SCENE_H = SCENE_H;

  /* 距离（曼哈顿） */
})();
