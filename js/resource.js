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
  /* extGrid 清零迁移开关：S4（产量链改造）落地时才开 true。
     S1 只做数据层，不动 extGrid（否则中间态产量归零，现有产量测试翻红）。 */
  RS.MIGRATE_EXT = false;

  /* 储量基础值（约 6 个满产日：单厂满产 7800/h × 24h × 6） */
  RS.RICH_BASE = 1120000;
  /* 软枯竭折减：储量归零后产量保留的比例 */
  RS.DEPLETE_MULT = 0.25;

  /* 地形 → 资源键（与 DATA.TERRAIN[].add 的键同源） */
  RS.RES_OF_TYPE = { forest: 'wood', desert: 'stone', hill: 'iron', lake: 'grain', plain: 'grain', caoyuan: 'grain' };

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

  /* 写出口：patch 只允许改入档字段（reserve/scanned/plant/plantLv），返回新记录 */
  RS.set = function (ci, patch, pid) {
    var b = bucket(pid);
    if (!b || !(ci >= 0)) return null;
    var rec = b[ci] || (b[ci] = {});
    if (patch) {
      if (patch.reserve != null) rec.reserve = patch.reserve;
      if (patch.scanned != null) rec.scanned = patch.scanned;
      if (patch.plant != null) rec.plant = patch.plant;
      if (patch.plantLv != null) rec.plantLv = patch.plantLv;
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

  /* 建厂：写 plant=1 级（由 domain.buildPlant 在扣费/排队后调用） */
  RS.placePlant = function (ci, eid, pid) {
    var chk = RS.canBuildPlant(ci, eid, pid);
    if (!chk.ok) return chk;
    RS.set(ci, { plant: eid, plantLv: 1 }, pid);
    return { ok: true, res: chk.res, plant: eid };
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

  /* 统计某星球上各资源地块数量与平均丰度（供地形占比验证） */
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
      var rec = RS.ensure(ci, pid);
      out.richSum += rec.richness;
    }
    out.avgRich = out.total ? out.richSum / out.total : 0;
    return out;
  };
})();
