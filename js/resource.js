/* ============================================================
 * resource.js — 星球大地图资源地块引擎（核心玩法：资源多层级）
 * ------------------------------------------------------------
 * 老板 2026-11-25：「利用现有框架，增大平地地形占比，战略模式的资源地块
 * 与近地面模式匹配，资源地块只有近地面勘探后才能建厂生产」+
 * 「根据资源类型和相连地块数量、资源丰度（随机）等，设置可采集的资源上限」。
 *
 * 这个模块只管**数据**：哪一格是什么资源、丰度多少、剩多少储量、
 * 勘探没勘探、建没建采集场。渲染（map3d.js）、交互（main.js/ui）、
 * 产量（domain.js）都只认 `GAME.resource` 这套 API，不直接摸 state.resources。
 *
 * ── 定下的口径（老板拍板）──────────────────────────────
 *   1. **资源地块 = 地形 × 丰度 × 储量**：
 *        · 类型由 `DATA.TERRAIN[type].add` 的键定（forest→生物质 / desert→电能 /
 *          hill→废钢 / lake·plain·caoyuan→净水）；
 *        · 丰度 richness 由格号确定性 seed 派生（0.5~2.0），同格永远一致；
 *        · 储量上限 reserveMax = RICH_BASE × richness × (1 + 相连同类型数×0.5)。
 *   2. **勘探解锁**：scanned=false 的地块不可建厂；走近探测后才登记（进度入档）。
 *   3. **采集场挂地块**：复用 EXT_BUILDINGS 四建筑（farm/forest/quarry/mine），
 *      但载体从 city.extGrid 迁到 state.resources[pid][ci].plant。
 *   4. **软枯竭**：reserve≤0 后产量折减 DEPLETE_MULT（0.25），不停产（成熟设计）。
 *   5. **老档迁移**：extGrid 清零 + 返还已投入资源（幂等，resMigrated 标记）。
 *
 * ── 存档 ──────────────────────────────────────────────────
 * state.resources = { <pid>: { <ci>: { res, richness, reserve, scanned, plant, plantLv } } }
 *   入档字段（玩家进度）：reserve / scanned / plant / plantLv
 *   派生字段（确定性重建，不入档亦无损）：richness / reserveMax
 *   ⚠️ 为读档稳定，richness/reserveMax 读时若缺则按 seed 补算（幂等）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;
  var RS = GAME.resource = {};

  /* 资源地块总开关：false 时回到「城内 extGrid 旧模式」，大地图资源层不生效 */
  RS.ON_MAP = true;
  /* extGrid 清零迁移开关（S4 产量链改造落地 → 打开）。
     S1/S2/S3 关着是因为产量链还没接大地图，一清零产量就归零（中间态是坏的）。
     S4 起：extGrid 清零 + 采集场产量接大地图 + 返还已投入资源，同片落地。 */
  RS.MIGRATE_EXT = true;

  /* 储量基础值 —— 推导（120× 时间倍率下）：单厂满产 7800/游戏时 → 260/现实秒；
     希望一格「普通丰度（×1.0）、无连片加成」的矿能挖 ≈4 现实小时：
       260 × 4×3600 ≈ 374 万 → 取整 400 万（连片加成会再放大，见 reserveMaxOf）。
     老板「数值可以后期调」—— 只改这一个数即可全局生效。 */
  RS.RICH_BASE = 4000000;
  /* 软枯竭折减：储量归零后产量保留的比例 */
  RS.DEPLETE_MULT = 0.25;

  /* 地形 → 资源键（与 DATA.TERRAIN[].add 的键同源）
     ⚠️ **湖泊不给资源地块**（v158.13 修正）：湖是海平面以下的水面，玩家走不到、
        也就没法"近地面勘探 → 建厂"。老板的净水厂语义由平地/草原承担（冲积平原取水）。 */
  RS.RES_OF_TYPE = { forest: 'wood', desert: 'stone', hill: 'iron', plain: 'grain', caoyuan: 'grain' };

  /* 采集场建筑 id → 资源键（与 DATA.EXT_BUILDINGS[].res 一致） */
  RS.RES_OF_PLANT = { farm: 'grain', forest: 'wood', quarry: 'stone', mine: 'iron' };
  /* 资源键 → 匹配采集场建筑 id（反向，用于「这块地该建什么」） */
  RS.PLANT_OF_RES = { grain: 'farm', wood: 'forest', stone: 'quarry', iron: 'mine' };

  /* ============================================================
   * 1. 确定性随机（按格号播种，同格永远一致 —— 与 map3d._surfScatter 同范式）
   * ============================================================ */
  function seedOf(ci) {
    var s = (Math.imul(ci | 0, 2654435761) + 12345) >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ============================================================
   * 2. 读/写出口（唯一出口纪律）
   * ============================================================ */
  function bucket(pid) {
    var s = GAME.state; if (!s) return null;
    if (!s.resources) s.resources = {};
    var p = pid == null ? GAME.curPid() : pid;
    if (!s.resources[p]) s.resources[p] = {};
    return s.resources[p];
  }

  /* 读出口：返回资源地块的完整视图（含派生字段补算），无则 null */
  RS.at = function (ci, pid) {
    var b = bucket(pid);
    if (!b || !(ci >= 0) || !b[ci]) return null;
    var rec = b[ci];
    if (!rec._derived) derive(rec, ci, pid);
    return rec;
  };

  /* 写出口：patch 只允许改入档字段（reserve/scanned/plant/plantLv/city），返回新记录 */
  RS.set = function (ci, patch, pid) {
    var b = bucket(pid);
    if (!b || !(ci >= 0)) return null;
    var rec = b[ci] || (b[ci] = {});
    if (patch) {
      if (patch.reserve != null) rec.reserve = patch.reserve;
      if (patch.scanned != null) rec.scanned = patch.scanned;
      /* ⚠️ plant 用 `!== undefined` 而不是 `!= null`：拆除要写**显式 null**
         （`patch.plant = null` 会被 `!= null` 判成"没传"，导致厂拆不掉 —— v158.13 实测踩到） */
      if (patch.plant !== undefined) rec.plant = patch.plant;
      if (patch.plantLv != null) rec.plantLv = patch.plantLv;
      if (patch.city !== undefined) rec.city = patch.city;
      /* res 一旦确定不随 patch 改（类型由地形定） */
    }
    delete rec._derived;
    return rec;
  };

  /* 确保某格有资源记录（首次勘探/建厂前调用，触发派生），幂等 */
  RS.ensure = function (ci, pid) {
    var b = bucket(pid);
    if (!b || !(ci >= 0)) return null;
    if (!b[ci]) b[ci] = {};
    if (!b[ci]._derived) derive(b[ci], ci, pid);
    return b[ci];
  };

  /* 派生 richness / reserveMax / res（不入档，确定性，缺则补算） */
  function derive(rec, ci, pid) {
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    var cell = sp && sp.cells ? sp.cells[ci] : null;
    var type = cell ? cell.type : null;
    rec.res = RS.RES_OF_TYPE[type] || null;
    var rng = seedOf(ci);
    rec.richness = 0.5 + rng() * 1.5;   // 0.5 ~ 2.0
    rec.reserveMax = reserveMaxOf(ci, pid, rec.richness);
    if (rec.reserve == null) rec.reserve = rec.reserveMax;   // 首次派生：满储量
    if (rec.scanned == null) rec.scanned = false;
    if (rec.plant == null) rec.plant = null;
    if (rec.plantLv == null) rec.plantLv = 0;
    rec._derived = true;
    return rec;
  }

  /* 储量上限 = RICH_BASE × 丰度 × (1 + 相连同类型地块数 × 0.5) */
  function reserveMaxOf(ci, pid, richness) {
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    var cells = sp && sp.cells ? sp.cells : null;
    var adj = sp && sp.adj ? sp.adj : null;
    var same = 0;
    if (cells && adj && cells[ci] && adj[ci]) {
      var t = cells[ci].type;
      for (var i = 0; i < adj[ci].length; i++) {
        var n = adj[ci][i];
        if (cells[n] && cells[n].type === t) same++;
      }
    }
    return Math.round(RS.RICH_BASE * (richness || 1) * (1 + same * 0.5));
  }

  /* ============================================================
   * 3. 查询辅助
   * ============================================================ */

  /* 该格是否有可采集资源（有对应地形即可） */
  RS.resOfCi = function (ci, pid) {
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    var cell = sp && sp.cells ? sp.cells[ci] : null;
    if (!cell) return null;
    return RS.RES_OF_TYPE[cell.type] || null;
  };

  /* 该格已建采集场（返回 {plant, plantLv} 或 null） */
  RS.plantAt = function (ci, pid) {
    var rec = RS.at(ci, pid);
    if (rec && rec.plant) return { plant: rec.plant, plantLv: rec.plantLv || 1 };
    return null;
  };

  /* 软枯竭判定：reserve<=0 */
  RS.depleted = function (ci, pid) {
    var rec = RS.at(ci, pid);
    return !!(rec && rec.reserve != null && rec.reserve <= 0);
  };

  /* ============================================================
   * 3.5 只读视图（面板/渲染用）—— **不写档**
   * ------------------------------------------------------------
   * ⚠️ 与 `RS.at` 的区别（这条是踩过的坑）：
   *   `at()` 对**已存在**的记录会顺手 derive 补字段；若面板为了显示而对
   *   全星每一格都调 `ensure()`，就会在 state.resources 里给 40962 格各写
   *   一条（reserve/scanned/plant）—— 存档直接爆成几十 MB。
   *   `view()` 对没有记录的地块走**纯计算**：只读地形 + 按 seed 现算丰度/储量，
   *   一个字节都不落档。玩家真正勘探（`scan`）时才会为那一格建档。
   * ============================================================ */
  RS.view = function (ci, pid) {
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    var cells = sp && sp.cells ? sp.cells : null;
    var cell = cells ? cells[ci] : null;
    if (!cell) return null;
    var res = RS.RES_OF_TYPE[cell.type] || null;
    if (!res) return null;
    var rec = RS.at(ci, pid);                       /* 有进度才返回，无记录 = null（不创建） */
    var richness = rec ? rec.richness : (0.5 + seedOf(ci)() * 1.5);
    var reserveMax = rec ? rec.reserveMax : reserveMaxOf(ci, pid, richness);
    return {
      ci: ci, res: res, type: cell.type,
      richness: richness, reserveMax: reserveMax,
      reserve: (rec && rec.reserve != null) ? rec.reserve : reserveMax,
      scanned: !!(rec && rec.scanned),
      plant: (rec && rec.plant) || null,
      plantLv: (rec && rec.plantLv) || 0
    };
  };

  /* 丰度档位（UI 用；阈值随时可调，只影响显示文案不影响数值） */
  RS.RICH_TIERS = [
    { min: 1.60, name: '极富', tone: 'legend' },
    { min: 1.20, name: '富集', tone: 'good' },
    { min: 0.80, name: '普通', tone: 'normal' },
    { min: -1, name: '贫瘠', tone: 'poor' }
  ];
  RS.richTier = function (richness) {
    var r = richness == null ? 1 : richness;
    for (var i = 0; i < RS.RICH_TIERS.length; i++) {
      if (r >= RS.RICH_TIERS[i].min) return RS.RICH_TIERS[i];
    }
    return RS.RICH_TIERS[RS.RICH_TIERS.length - 1];
  };

  /* 储量扣减唯一出口：amount>0 才扣，扣到 0 为止 */
  RS.consumeReserve = function (ci, amount, pid) {
    var rec = RS.at(ci, pid);
    if (!rec || rec.reserve == null) return 0;
    var take = Math.min(rec.reserve, Math.max(0, amount || 0));
    rec.reserve = rec.reserve - take;
    return take;
  };

  /* ============================================================
   * 4. 勘探 / 建厂 / 拆除（业务动作，走唯一写出口）
   * ============================================================ */

  /* 勘探：登记 scanned=true，返回地块视图（不可重复勘探也无害，幂等） */
  RS.scan = function (ci, pid) {
    var rec = RS.ensure(ci, pid);
    if (!rec) return null;
    if (!rec.scanned) RS.set(ci, { scanned: true }, pid);
    return RS.at(ci, pid);
  };

  /* 可建厂判定（返回 {ok, msg, res, plant}） */
  RS.canBuildPlant = function (ci, eid, pid) {
    var rec = RS.ensure(ci, pid);
    if (!rec) return { ok: false, msg: '此地无资源' };
    if (!rec.res) return { ok: false, msg: '此地不是资源地块（无法建采集场）' };
    var want = (DATA.EXT_BUILDINGS[eid] || {}).res;
    if (!want) return { ok: false, msg: '未知采集场' };
    if (want !== rec.res) return { ok: false, msg: '采集场与资源不匹配（需' + (DATA.EXT_BUILDINGS[eid].name) + '→' + resName(rec.res) + '）' };
    if (!rec.scanned) return { ok: false, msg: '尚未勘探（走近勘探后才能建厂）' };
    if (rec.plant) return { ok: false, msg: '此地已建采集场' };
    return { ok: true, res: rec.res, plant: eid };
  };

  /* 建厂：写 plant=1 级（由 domain.buildPlant 在扣费/排队后调用）
     cityId = 这座厂归哪座城（产量与堆场容量按城归属结算） */
  RS.placePlant = function (ci, eid, pid, cityId) {
    var chk = RS.canBuildPlant(ci, eid, pid);
    if (!chk.ok) return chk;
    RS.set(ci, { plant: eid, plantLv: 1, city: cityId == null ? null : cityId }, pid);
    return { ok: true, res: chk.res, plant: eid };
  };

  /* ============================================================
   * 3.6 采集场聚合（产量链 / 堆场容量链共用）
   * ------------------------------------------------------------
   * 返回该城的**全部采集场**，形状刻意对齐 extGrid 的地块
   * `{type, lv}`，并补上产量链需要的两个字段：
   *   · richness —— 丰度乘数（0.5~2.0）
   *   · deplete  —— 已枯竭（产量按 RS.DEPLETE_MULT 折减，不停产）
   * 这样 domain.js 的 extGridOf() 在迁移模式下直接返回它，
   * 产量链 / 堆场容量链 / UI 面板三处**一处都不用重写**。
   * ============================================================ */
  RS.plantsOf = function (cityId, pid) {
    var b = bucket(pid);
    if (!b) return [];
    var out = [];
    for (var k in b) {
      var rec = b[k];
      if (!rec || !rec.plant) continue;
      if (cityId != null && rec.city !== cityId) continue;
      if (!rec._derived) derive(rec, +k, pid);
      if (!rec.res) continue;                       /* 地形改过（老档）→ 不参与结算 */
      out.push({
        type: rec.plant, lv: rec.plantLv || 1, ci: +k,
        res: rec.res, richness: rec.richness,
        reserve: rec.reserve, reserveMax: rec.reserveMax,
        deplete: !(rec.reserve > 0)
      });
    }
    return out;
  };

  /* ============================================================
   * 3.7 储量消耗（唯一出口，按游戏秒批量扣）
   * ------------------------------------------------------------
   * 由 tickOnce（在线，每现实秒）与 simulateBulk（离线批量）调用。
   * 只扣「有厂且还有储量」的地块 —— 枯竭后不再扣（产量已折减，见 plantYieldOf）。
   *
   * 口径（刻意如此，不是漏乘）：扣减按**理论产出** `基础 × 丰度` 计，
   *   不乘 prodBasePerHourOf 末尾的环境折扣（补给断绝 / 严寒 / 污染）。
   *   设定上自洽：矿藏是**物理存量**，挖走多少由设备决定；环境折扣影响的是
   *   "运回城里的有效产出"（路上损耗），不该反过来让矿少挖。
   *   ⚠️ 所以「储量下降量」与「入账产量」可以有 ≤10% 的差 —— 断言要按这两把尺分别验，
   *      别拿一个去比另一个（v158.13 探针就在这里错过一次）。
   * ⚠️ 这里是**结算**，不是查询：绝不要塞进 prodBasePerHourOf 之类的纯查询函数，
   *    否则界面每刷新一次都在挖矿。
   * ============================================================ */
  RS.tickMine = function (gameSec) {
    if (!RS.ON_MAP || !RS.MIGRATE_EXT) return 0;
    var b = bucket();
    if (!b || !(gameSec > 0)) return 0;
    var total = 0;
    for (var k in b) {
      var rec = b[k];
      if (!rec || !rec.plant) continue;
      if (!rec._derived) derive(rec, +k, null);
      if (!(rec.reserve > 0)) continue;
      var eb = DATA.EXT_BUILDINGS[rec.plant];
      if (!eb) continue;
      var per = eb.prod[(rec.plantLv || 1) - 1] || 0;
      var take = per * (rec.richness || 1) * (gameSec / 3600);
      if (take <= 0) continue;
      var real = Math.min(rec.reserve, take);
      rec.reserve -= real;
      total += real;
    }
    return total;
  };

  /* 升级：plantLv+1（由 domain.upgradePlant 调用） */
  RS.upgradePlant = function (ci, pid) {
    var rec = RS.at(ci, pid);
    if (!rec || !rec.plant) return { ok: false, msg: '此地无采集场' };
    RS.set(ci, { plantLv: (rec.plantLv || 1) + 1 }, pid);
    return { ok: true, plantLv: (rec.plantLv || 1) + 1 };
  };

  /* 拆除：清 plant/plantLv（由 domain.dismantlePlant 调用） */
  RS.dismantlePlant = function (ci, pid) {
    var rec = RS.at(ci, pid);
    if (!rec || !rec.plant) return { ok: false, msg: '此地无采集场' };
    RS.set(ci, { plant: null, plantLv: 0 }, pid);
    return { ok: true };
  };

  /* ============================================================
   * 5. 老档迁移（extGrid 清零 + 返还资源，幂等）
   * ============================================================ */

  /* 由 state.loadGame 的迁移链调用。返回 {refunded: 资源返还对象} 或 null（未开/已迁过） */
  RS.migrateExt = function (st) {
    if (!st) return null;
    if (!RS.MIGRATE_EXT) return null;   // S4 才开，S1 不触发（避免中间态产量归零）
    if (st.resMigrated) return null;   // 幂等
    var refund = { grain: 0, wood: 0, stone: 0, iron: 0 };
    (st.cities || []).forEach(function (c) {
      if (!c || !c.extGrid) return;
      c.extGrid.forEach(function (e) {
        if (!e || !e.type || !e.lv) return;
        var eb = DATA.EXT_BUILDINGS[e.type];
        if (!eb) return;
        /* 返还该地块累计已投入资源（逐级造价累加） */
        var acc = { grain: 0, wood: 0, stone: 0, iron: 0 };
        for (var lv = 0; lv < (e.lv || 1); lv++) {
          var cost = eb.cost[lv];
          if (!cost) break;
          acc.grain += cost[0] || 0; acc.wood += cost[1] || 0;
          acc.stone += cost[2] || 0; acc.iron += cost[3] || 0;
        }
        refund.grain += acc.grain; refund.wood += acc.wood;
        refund.stone += acc.stone; refund.iron += acc.iron;
        /* 返还入该城账本（走唯一收支出口，正数入账） */
        if (acc.grain) GAME.city.add(c, 'grain', acc.grain);
        if (acc.wood) GAME.city.add(c, 'wood', acc.wood);
        if (acc.stone) GAME.city.add(c, 'stone', acc.stone);
        if (acc.iron) GAME.city.add(c, 'iron', acc.iron);
      });
      /* 清空 extGrid（清零，不保留任何地块） */
      c.extGrid = GAME.makeExtGrid ? GAME.makeExtGrid(null) : [];
      /* 确保 extGrid 长度满足 cap，但全为 null type（空地块） */
      var eCap = GAME.extCap ? GAME.extCap(c) : 12;
      while (c.extGrid.length < eCap) c.extGrid.push({ id: 'e' + (c.extGrid.length + 1), type: null, lv: 0 });
    });
    st.resMigrated = true;
    if (!st.resources) st.resources = {};
    return { ok: true, refund: refund };
  };

  /* ============================================================
   * 5.5 开局预置厂落地块（newGame 调用）
   * ------------------------------------------------------------
   * 老板：「现有城外资源建筑清零，返还资源」——那说的是**老档迁移**。
   * 新档不能也清零：`DATA.INITIAL_EXT`（2 田 1 木 1 石 1 铁）是开局唯一产出，
   * 一清零玩家落地就是"什么都产不出来"。
   *
   * 所以新档走"平移"：把这 5 座预置厂**搬到城附近的对应地形上**——
   *   · 不扣费、不排队（它们本来就是"既有的"）；
   *   · 顺手标记已勘探（玩家开局就该看得见自家那几座厂）；
   *   · 从城格开始 BFS 由近及远找匹配地形，找不到就少一座（不报错）。
   * 于是"开局产量"与旧口径连续，只是载体从城内堆场变成了星球上的地块。
   * ============================================================ */
  RS.seedInitialPlants = function (city) {
    if (!RS.ON_MAP || !RS.MIGRATE_EXT) return 0;
    if (!city) return 0;
    var pid = (GAME.pidOf ? GAME.pidOf(city) : null);
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    if (!sp || !sp.cells || !sp.adj) return 0;
    var start = (city.ci != null && city.ci >= 0) ? city.ci : -1;
    if (start < 0) return 0;

    /* 需求表：资源键 → 还差几座（比按 eid 逐条找更适合"同一种要 2 座"） */
    var need = {};
    (DATA.INITIAL_EXT || []).forEach(function (eid) {
      var r = RS.RES_OF_PLANT[eid];
      if (r) need[r] = (need[r] || 0) + 1;
    });
    var left = 0; for (var rk in need) left += need[rk];
    if (!left) return 0;

    var found = 0;
    /* 只在"地形正好是还缺的那种资源"时才建档 ——
       ⚠️ 这条很关键：早先对 BFS 扫到的每一格都 ensure()，2500 格水/沼泽就会在
          存档里建 2500 条空记录。现在不匹配的格只读 cell.type，一个字节不写。 */
    function tryTake(ci) {
      var cell = sp.cells[ci];
      if (!cell || !cell.type) return false;
      var res = RS.RES_OF_TYPE[cell.type];
      if (!res || !(need[res] > 0)) return false;
      var eid = RS.PLANT_OF_RES[res];
      if (!eid) return false;
      var rec = RS.ensure(ci, pid);
      if (!rec || rec.plant) return false;
      RS.set(ci, { scanned: true }, pid);
      if (!RS.placePlant(ci, eid, pid, city.id).ok) return false;
      need[res]--; left--; found++;
      return true;
    }

    /* ① 从城格向外 BFS（由近及远）——上限 20000 格 ≈ 全星一半，
          因为出生城**可能落在水格上**（seed 20260921 实测城格是 lake，
          周围 2500 格里 90% 是水 —— 这是既有的出生点地形漂移现象，不是本函数的事）。
          BFS 不建档，所以放大上限没有存档代价。 */
    var seen = {}, queue = [start];
    seen[start] = 1;
    for (var qi = 0; qi < queue.length && left > 0; qi++) {
      var ci = queue[qi];
      if (ci !== start) tryTake(ci);          /* 城格本身不占（城也是 plain，会被判成净水地块） */
      var an = sp.adj[ci] || [];
      for (var k = 0; k < an.length; k++) {
        if (!seen[an[k]]) { seen[an[k]] = 1; queue.push(an[k]); }
      }
      if (queue.length > 20000) break;
    }
    /* ② 兜底：BFS 没凑齐（城在水中央 / 极端地形）→ 全星顺序补足，保证开局产出不残 */
    for (var ci2 = 0; ci2 < sp.cells.length && left > 0; ci2++) {
      if (seen[ci2] || ci2 === start) continue;
      tryTake(ci2);
    }
    return found;
  };

  /* 资源显示名（复用全局出口，兜底） */
  function resName(k) {
    if (GAME.resName) return GAME.resName(k);
    var map = { grain: '净水', wood: '生物质', stone: '电能', iron: '废钢', gold: '旧币' };
    return map[k] || k;
  }
  RS.resName = resName;

  /* ============================================================
   * 6. 探测/审计辅助（供探针与门禁）
   * ============================================================ */

  /* 统计某星球上各资源地块数量与平均丰度（供地形占比验证）
     ⚠️ **纯计算**：绝不调 ensure()（那会给全星 4 万格建档，存档爆炸） */
  RS.census = function (pid) {
    var sp = GAME.sphereOf ? GAME.sphereOf(pid) : null;
    var cells = sp && sp.cells ? sp.cells : null;
    if (!cells) return null;
    var out = { total: 0, byRes: { grain: 0, wood: 0, stone: 0, iron: 0 }, byType: {}, avgRich: 0, richSum: 0 };
    for (var ci = 0; ci < cells.length; ci++) {
      var c = cells[ci]; if (!c || !c.type) continue;
      var r = RS.RES_OF_TYPE[c.type];
      out.byType[c.type] = (out.byType[c.type] || 0) + 1;
      if (!r) continue;
      out.total++;
      out.byRes[r] = (out.byRes[r] || 0) + 1;
      out.richSum += 0.5 + seedOf(ci)() * 1.5;      /* 与 derive 同式（确定性），不建档 */
    }
    out.avgRich = out.total ? out.richSum / out.total : 0;
    return out;
  };
})();
