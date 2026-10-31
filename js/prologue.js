/* ============================================================
 * prologue.js — 前传：先没有城（v105 · 老板 2026-10-23）
 * ------------------------------------------------------------
 * 老板原话：
 *   「可以做一个前传，就是一开始将领是没有城的，君主是没有城的，
 *     然后呢，可以通过这个在地图上去进行一个探索，到处去打这个废土的
 *     专有的这种，包括科技造物也好啊，这种野兽啊，这个变异生化兽啊什么的，
 *     升到了 20 级或者 40 级，我觉得 20 级可能合适，
 *     然后再给予一个建城的一个机会。」
 *
 * 为什么不真的删城：55 个模块都假设 `state.cities[0]` 存在
 * （`currentCity()` 虽然对空数组返回 null，但下游几十处直接取字段）。
 * 所以用一个**阶段标记**代替"没有城"：
 *
 *   state.prologue.on === true  →  城不产东西、不能建、不能招兵；
 *                                  唯一的玩法是荒野行动（打变异兽/掠夺者）。
 *
 * 「城不产东西」只有一处闸门（`GAME.cityProdPerSec`），
 * 「不能建」一处（`GAME.buildAt`），「不能招」一处（`GAME.train`）——
 * 三个统一出口，不散落到各面板。
 *
 * 荒野行动的内核是 **v89.4 就有的**（DATA.LING_ACT · jianghuCheck / Spend / Roll），
 * 当年 v89.45 老板让"从呈现层剥离、资产保留"。前传正是它该回来的时候：
 * 只是不再挂在地图青旗上，而是做成前传面板里的一列按钮。
 *
 * ⚠️ 刻意不做的：
 *   · 不写"你要重建文明"之类的话 —— 面板只说等级、精力、去哪儿、打什么。
 *   · 不改开局资源（那会推翻几十条断言）。前传期资源在，但产不出新的 ——
 *     那是"辎重"，不是"城产"。
 *   · 默认不开（`newGame` 必须显式传 prologue:true）：324 处测试直接调 newGame，
 *     默认开会让它们全落进前传、产出为 0。玩家走 UI 创建角色时传 true。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var P = GAME.prologue = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.PROLOGUE) || {}; }
  function st0() { return GAME.state || null; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = st0();
    return Math.floor(((s && s.world && s.world.elapsed) || 0) / spm);
  }
  function dayNow() {
    var s = st0();
    return Math.floor(((s && s.world && s.world.elapsed) || 0) / 86400);
  }
  function SP() { return (GAME.sphereOf ? GAME.sphereOf() : GAME.sphere); }
  /* ============================================================
   * v139：**取"已经有 cells 的"那颗球**。
   * ------------------------------------------------------------
   * `SP()` 走 `GAME.sphereOf()`（地图球面），而 `newGame → P.begin` 这个时点
   * 地图球面可能还没建 → `ciOfXY` 返回 -1、`hopsWithin` 返回空数组。
   * 于是"就近挪到有事的格 / 找最近的平地"整段静默失效（外面还有 try/catch 吞异常），
   * 出生点留在 0 号格（实测 seed 61024 下是**湖**）：
   *   开局第一屏「可走 6 格 · 可做 0 件」，pos 在 lake 上。
   * 凡是**需要读地形**的地方一律走这个 helper，不直接用 SP()。 */
  function SPc() {
    if (GAME.sphere && GAME.sphere.cells) return GAME.sphere;
    if (GAME.mapSphere && GAME.mapSphere.cells) return GAME.mapSphere;
    return SP();
  }

  /* ============================================================
   * 一、阶段开关
   * ============================================================ */
  P.on = function () {
    var s = st0();
    return !!(s && s.prologue && s.prologue.on === true);
  };

  /* newGame 里调（只有显式 prologue:true 才进来）*/
  P.begin = function (st) {
    var s = st || st0();
    if (!s) return;
    /* ============================================================
     * v131（老板：「应当根治」）：前传 = **君主作为个人冒险者在大地图上游玩**。
     * ------------------------------------------------------------
     * 从这里开始，前传局**真的没有城**（newGame 按 prologueMode 跳过建城）。
     * 所以前传要自己记住两件事：
     *   · pos  —— 君主现在站在哪个格（立城时就在这一格落下第一座城）
     *   · res  —— 随身物资（无城时 `GAME.res()` 落到这一份，见 state.js:183）
     * 立城时这两样一起交给新城，玩家不会"凭空丢东西"。
     * ============================================================ */
    /* ⚠️ v139：**优先用"已经建好 cells"的那颗球**。
       `SP()` 走的是 `GAME.sphereOf()`（地图球面），而 newGame 走到这里时
       地图球面可能还没建（cells 为空）→ `ciOfXY` 返回 -1、`hopsWithin` 返回空数组
       → 下面那串"就近挪到有事的格 / 找平地"全部失效，出生点落回 0 号格（多半是湖）。
       实测表现为开局第一屏「可走 6 格 · 可做 0 件」（§333③ 红）。 */
    var sp = SPc();
    var p0 = (s.map && s.map.startPos) || (GAME.DATA && GAME.DATA.START_POS) || {};
    var pos = (sp && sp.ciOfXY) ? sp.ciOfXY(p0.x, p0.y) : 0;
    if (!(pos >= 0)) pos = 0;
    /* ============================================================
     * v155b（顺次划定）：前传**不再自己另选一个"最佳落脚点"**。
     * 改前它会按"有事的格子 / 附近平地"另挑一个 —— 于是 `s.map.startPos`
     * （城、2D 地图、行政区都在用的那个坐标）与君主实际站的位置**不一致**，
     * 立城又落在脚下 → "城坐标对不上"。
     * 现在：出生点 = `pickStartPos`（已在平原上），前传**原样站那儿**；
     * 周围有没有事由"最近动静"提示与地图发光来引导。
     * ============================================================ */
    /* ============================================================
     * v131：出生格若荒僻，就近挪一格**有事的**。
     * ------------------------------------------------------------
     * `jianghuActsAt` 对每格有 30% 概率返回空（`DATA.JH_SPREAD.noneP`）——
     * 那是"地块探索"该有的不确定性，但**第一格**不能是空的：
     * 玩家一睁眼看到"脚下没事、四周没动静"，只会以为自己玩不了。
     * 只挪出生点、不改判据：荒僻格仍然是荒僻格，走两步就能遇到。
     * ============================================================ */
    /* （v155b：v135/v139 的"另选落脚点"整段已停用 —— 出生点由 pickStartPos 唯一定义） */

    s.prologue = {
      on: true, at: 0, day: -1, acts: 0, builtAt: null,
      pos: pos,
      res: U.deep((GAME.DATA && GAME.DATA.INITIAL_RES) || {}),
      steps: 0,
    };
  };

  /* ============================================================
   * v134：**前传档跨版本补字段**（读档路径，幂等）
   * ------------------------------------------------------------
   * 实测出来的缺口：前传在 v131~v133 之间加过 `res / steps / dueled / subdued`，
   * 而读档只跑 `saveShapeChk` + 各 v6x/v8x 迁移，**没有一处补 prologue 的字段**。
   * 后果（真跑过一遍）：
   *   把存档削成 v131 首版的形状（只有 on/at/day/acts/builtAt/pos）→ 读档不报错，
   *   但 `GAME.res()` 落到空背包 → **HUD 显示"你们 0 个人"，玩家的 200 人凭空消失**。
   * 这是"不崩、不报错、就是不说话地少了东西"，比崩溃难发现得多。
   *
   * 口径（三条都不能放宽）：
   *   · 只在 `prologue.on === true` 且**没有城**时补 `res`
   *     —— `P.end()` 立城后会主动把 res 置 null（资源已搬进城），那是合法状态；
   *   · 补的是 `INITIAL_RES`（**开局量，不是满额**）：这是止损，不是回补。
   *     已经花掉的资源不会凭空长回来，但也不会因为读档变成 0 人；
   *   · 已有 `res` 只补缺失的 key（旧版 INITIAL_RES 可能少字段），不覆盖玩家现有数量。
   * ============================================================ */
  GAME.migratePrologue = function (st) {
    var pg = st && st.prologue;
    if (!pg || typeof pg !== 'object') return 0;
    var fixed = 0;
    var hasCity = !!(st.cities && st.cities.length);

    /* ① pos：缺失或越界 → 按开局坐标重算（否则 HUD 会拿 undefined 去查地形） */
    var sp = SP();
    var okPos = (pg.pos >= 0) && sp && sp.cellOf && sp.cellOf(pg.pos);
    if (!okPos) {
      var p0 = (st.map && st.map.startPos) || (GAME.DATA && GAME.DATA.START_POS) || {};
      var np = (sp && sp.ciOfXY) ? sp.ciOfXY(p0.x, p0.y) : 0;
      pg.pos = (np >= 0) ? np : 0;
      fixed++;
    }

    /* ② res：前传进行中且无城 → 缺就补开局量（见函数头注释的口径） */
    if (pg.on === true && !hasCity) {
      var IR = (GAME.DATA && GAME.DATA.INITIAL_RES) || {};
      if (!pg.res || typeof pg.res !== 'object') {
        pg.res = U.deep(IR);
        fixed++;
      } else if (GAME.RES_KEYS) {
        GAME.RES_KEYS.forEach(function (k) {
          if (pg.res[k] == null) { pg.res[k] = (IR[k] || 0); fixed++; }
        });
      }
    }

    /* ③ 计数与进度字段：缺就是 0（不补的话 HUD 会印 "走了 undefined 步"） */
    if (pg.steps == null || isNaN(pg.steps)) { pg.steps = 0; fixed++; }
    if (pg.acts == null || isNaN(pg.acts)) { pg.acts = 0; fixed++; }
    if (pg.dueled == null || typeof pg.dueled !== 'object') { pg.dueled = {}; fixed++; }
    if (pg.subdued == null || typeof pg.subdued !== 'object') { pg.subdued = {}; fixed++; }
    if (pg.duel === undefined) { pg.duel = null; fixed++; }
    if (pg.last === undefined) { pg.last = ''; fixed++; }
    return fixed;
  };

  P.end = function (why) {
    var s = st0();
    if (!s || !s.prologue) return { ok: false, msg: '没有前传状态' };
    s.prologue.on = false;
    s.prologue.builtAt = monthNow();
    /* v131：随身物资已经搬进城里（见 P.build），这里把背包清空 ——
       不清的话 `GAME.res()` 在有城时会读 city.res（无城分支才读背包），
       存档里会留着两份同源数据，读档后容易对不上。 */
    s.prologue.res = null;
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🏯 立城了' + (why ? '：' + why : '') + ' —— 从今天起，这些人有地方过冬了。');
    }
    return { ok: true };
  };

  /* ============================================================
   * 二、君主（前传里唯一能出门的人）
   * ============================================================ */
  P.lord = function () {
    var s = st0();
    if (!s) return null;
    var gs = s.generals || [];
    for (var i = 0; i < gs.length; i++) {
      if (gs[i] && GAME.isLordGeneral && GAME.isLordGeneral(gs[i])) return gs[i];
    }
    return gs.length ? gs[gs.length - 1] : null;   /* 兜底：newGame 把君主排在末尾 */
  };

  P.lv = function () {
    var g = P.lord();
    return (g && g.level) || 1;
  };
  P.needLv = function () { return D().lv || 20; };
  P.ready = function () { return P.on() && P.lv() >= P.needLv(); };

  /* ============================================================
   * v135（老板：「立城为什么在水里，玩家自建城市应当只在平地」）
   * ------------------------------------------------------------
   * 实测根因：`P.build` 从来**没检查过脚下地形** —— 算完坐标就 makeCity。
   * 而这张星球的湖泊占 49%（20122/40962），所以"城立在水里"不是偶发，是常态。
   *
   * 判据直接接项目既有口径 `DATA.TERRAIN[t].buildable`
   * （全表只有 `plain` 是真），**不自造第二套判定**。
   *
   * ⚠️ 但只有判据会把人卡死：平原只占 **3.7%**，实测开局出生点是荒漠、
   *    2 环 0 块平地、4 环也 0 块。所以配套两件事：
   *      · `P.nearestBuildable()` —— 告诉玩家最近平地在哪个方向、几格
   *      · HUD 在脚下不能建时，把这句话印出来（而不是让按钮消失）
   * ============================================================ */
  P.cellTypeOf = function (ci) {
    var sp = SPc();
    var c = (sp && sp.cellOf) ? sp.cellOf(ci == null ? P.pos() : ci) : null;
    return (c && c.type) || null;
  };
  /* 这块地能不能立城（只有 buildable 的地算） */
  P.buildableAt = function (ci) {
    var t = P.cellTypeOf(ci);
    var def = (GAME.DATA.TERRAIN || {})[t] || {};
    return !!def.buildable;
  };
  P.terrainLabel = function (ci) {
    var t = P.cellTypeOf(ci);
    var def = (GAME.DATA.TERRAIN || {})[t] || {};
    return def.name || (t === 'city' ? '城' : '荒地');
  };
  /* 从当前站位看过去的方向名（与 P.neighbors 里那套一致，抽出来共用） */
  P.dirNameOf = function (ci) {
    var sp = SPc();
    if (!sp || !sp.cellOf) return '';
    var pc = sp.cellOf(P.pos()) || {}, nc = sp.cellOf(ci) || {};
    if (pc.lon == null || nc.lon == null) return '';
    var dLon = ((nc.lon - pc.lon + 540) % 360) - 180;
    var dLat = nc.lat - pc.lat;
    var ew = dLon > 0 ? '东' : (dLon < 0 ? '西' : '');
    var ns = dLat > 0 ? '北' : (dLat < 0 ? '南' : '');
    if (!ns) return ew || '东';
    if (!ew) return ns;
    return (Math.abs(dLat) < Math.abs(dLon) * 0.45) ? ew : (ns + ew);
  };
  /* 最近的能立城的格子（逐环外扩，第一次碰到就是最近） */
  var _nbCache = { key: '', val: null };
  P.nearestBuildable = function (maxR) {
    var sp = SPc();
    if (!sp || !sp.hopsWithin) return null;
    var pos = P.pos(), R = maxR || 12;
    /* 缓存：HUD 每次重建都会问一遍，而这里要扫整圈（R=40 约 5000 格）。
       ⚠️ v139 实测踩到的坑：缓存键**只放了 pos 和 R**，没放"这是哪颗球"——
         前传开局时球面还没建好，算出的结果是 `null` 并缓存下来；
         之后球面建好了、pos 也没变 → 一直命中那个 null，
         玩家被告知"这一带走很远都没有平地"，而立城永久失败（e2e 当场崩在 cities[0]）。
       键里补上球面种子与格数：换球/重建球面后自动失效。 */
    var _sd = (sp.seed3 ? sp.seed3() : 0) + '|' + ((sp.cells && sp.cells.length) || 0);
    var key = pos + '|' + R + '|' + _sd;
    if (_nbCache.key === key) return _nbCache.val;
    var _miss = function (v) { _nbCache = { key: key, val: v }; return v; };
    /* ⚠️ v135 第一版写错：用 `sp.distOf(pos, ci)` 判环数 —— 但 `distOf(e1, e2)`
       收的是**实体对象**（读 `.ci`），传两个数字会走 `hexDistAt(undefined,undefined)`，
       于是"第 r 环"永远判不中 → 5 个 seed 全部误报"30 环内无平地"。
       改用**环差集**：hopsWithin(p, r) 是 r 内全部，减去 r-1 内全部 = 第 r 环。
       不依赖任何距离函数，也不怕它以后改语义。 */
    var inner = { '0': 1 };   /* 0 环 = 自己 */
    (sp.hopsWithin(pos, 0) || []).forEach(function (c) { inner['' + c] = 1; });
    for (var r = 1; r <= R; r++) {
      var all = sp.hopsWithin(pos, r) || [];
      var ring = [];
      for (var i = 0; i < all.length; i++) if (!inner['' + all[i]]) ring.push(all[i]);
      all.forEach(function (c) { inner['' + c] = 1; });
      for (var j = 0; j < ring.length; j++) {
        var ci = ring[j];
        if (ci === pos || !P.buildableAt(ci)) continue;
        return _miss({ ci: ci, dist: r, dir: P.dirNameOf(ci), type: P.cellTypeOf(ci) });
      }
    }
    return _miss(null);
  };
  /* 从**指定起点**找最近的能立城的格子（出生点选址要用，不能借用"当前站位"）。
     实现与 P.nearestBuildable 同一套环差集，只是起点可传。 */
  P.nearestBuildableN = function (fromCi, maxR) {
    var sp = SPc();
    if (!sp || !sp.hopsWithin || fromCi == null) return null;
    var R = maxR || 2;
    var inner = {};
    (sp.hopsWithin(fromCi, 0) || []).forEach(function (c) { inner['' + c] = 1; });
    for (var r = 1; r <= R; r++) {
      var all = sp.hopsWithin(fromCi, r) || [];
      var ring = [];
      for (var i = 0; i < all.length; i++) if (!inner['' + all[i]]) ring.push(all[i]);
      all.forEach(function (c) { inner['' + c] = 1; });
      for (var j = 0; j < ring.length; j++) {
        var ci = ring[j];
        if (ci !== fromCi && P.buildableAt(ci)) {
          return { ci: ci, dist: r, type: P.cellTypeOf(ci) };
        }
      }
    }
    return null;
  };
  /* 能不能立城 = 等级够 **且** 脚下是平地 */
  P.canFound = function () { return P.ready() && P.buildableAt(P.pos()); };

  /* ============================================================
   * v123：**四档** —— 按等级换地方，不是同一个按钮按 15 次
   * ============================================================ */
  P.tiers = function () { return D().tiers || []; };

  /* 当前该去哪一档（取等级够得着的最高一档） */
  P.tier = function (lv) {
    var L = P.tiers();
    if (!L.length) return null;
    var n = (lv == null) ? P.lv() : lv;
    var cur = L[0];
    for (var i = 0; i < L.length; i++) if (n >= L[i].lv) cur = L[i];
    return cur;
  };
  /* 下一档（够不着就是 null，面板用它显示"再升 N 级能去"） */
  P.nextTier = function (lv) {
    var L = P.tiers();
    var n = (lv == null) ? P.lv() : lv;
    for (var i = 0; i < L.length; i++) if (n < L[i].lv) return L[i];
    return null;
  };

  /* ============================================================
   * 三、附近能做的事
   * ------------------------------------------------------------
   * ⚠️ v125b（审核 P0-1）：**不许再按抽样逐格算距离**。
   *   原实现是「随机抽 samples(4000) 个格 → 每格 sp.distOf()（一次全图 BFS）」，
   *   在 40,962 格的球面上就是 **3712 次 BFS / 2.4 秒**，而前传是新玩家的第一屏——
   *   实测一次「清剿」点击同步阻塞 7.2 秒。
   *
   *   现在：`SP.hopsWithin(fromCi, rad)`（sphere.js:477）**一次 BFS** 拿到半径内全部格，
   *   再逐格问"这里有没有荒野事"，只有命中的格才去算精确距离（≤ lim×4 次）。
   *   输出集与排序规则不变（候选顺序变了，但排序只看 rank/dist）。
   *
   *   保留 `hopsWithin` 缺失时的抽样兜底：球面桩 / 老存档 / 探针里可能没有该出口。
   * ============================================================ */
  /* ============================================================
   * v131（老板：「直接做一个独立板块，君主作为个人冒险者在大地图进行游玩」）
   * ------------------------------------------------------------
   * 前传从"面板上三个按钮"改成"**人在地图上，一格一格走**"。
   * 复用的是现场资产：
   *   · 大地图  —— `sphere.adj` 邻接表（已有）+ `hopsWithin(ci,1)` 取六邻
   *   · 地块探索 —— `jianghuActsAt(ci)`（荒野行动的唯一判据口）
   *   · 斗将    —— 走 `P.act → jianghuCheck/Spend/Roll`（与正式阶段同一个内核）
   * 这里只加"移动"这一件事，**不新开一套判定**。
   * ============================================================ */

  /* 君主现在站在哪一格（老档没有 pos → 落到出生点，不至于走丢） */
  P.pos = function () {
    var s = st0(), sp = SP();
    if (!s) return 0;
    var pg = s.prologue || {};
    if (pg.pos != null && pg.pos >= 0) return pg.pos | 0;
    var p0 = (s.map && s.map.startPos) || (GAME.DATA && GAME.DATA.START_POS) || {};
    var ci = (sp && sp.ciOfXY) ? sp.ciOfXY(p0.x, p0.y) : 0;
    return ci >= 0 ? ci : 0;
  };

  /* 周围六格（含"那格有什么"）—— 面板与营地视图共用这一份 */
  P.neighbors = function () {
    var s = st0(), sp = SP();
    if (!s || !sp || !sp.adj) return [];
    var pos = P.pos();
    var list = sp.hopsWithin(pos, 1);
    var pc = sp.cellOf(pos) || {};
    /* 方位：玩家得知道"往哪走"，光给六个地名分不清方向（v131）。
       按球面经纬差算八向 —— 六边形只有六邻，实际会出现东/西/东北/… */
    /* v92.247（老板）：「给星球定一个南北极，适配上下左右按键。现在是乱走的」
       —— 方位改成**切平面里的真实方位角**（0=北 90=东），不再拿经纬差拼字。
       旧写法在两极附近必然串（经线收拢 → 正北的邻格算出 dLon=180 → 叫成"东"），
       而"东北"这种复合名又会同时命中上/右两个键。 */
    var dirName = function (ci, nc) {
      if (!nc) return '';
      if (sp && sp.bearingOf) {
        var deg = sp.bearingOf(pos, ci);
        if (deg != null && sp.dirNameOfBearing) return sp.dirNameOfBearing(deg);
      }
      /* 兜底：旧口径（无 bearingOf 的极端情况）*/
      if (pc.lon == null || nc.lon == null) return '';
      var dLon = ((nc.lon - pc.lon + 540) % 360) - 180;
      var dLat = nc.lat - pc.lat;
      var ew = dLon > 0 ? '东' : (dLon < 0 ? '西' : '');
      var ns = dLat > 0 ? '北' : (dLat < 0 ? '南' : '');
      if (!ns) return ew || '东';
      if (!ew) return ns;
      return (Math.abs(dLat) < Math.abs(dLon) * 0.45) ? ew : (ns + ew);
    };
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (ci === pos) continue;
      var cell = sp.cellOf(ci) || {};
      var acts = (GAME.jianghuActsAt ? GAME.jianghuActsAt(ci) : []) || [];
      out.push({ ci: ci, type: cell.type, acts: acts, dir: dirName(ci, cell), here: false });
    }
    /* 按方位排一下（东→东北→北→西北→西→西南→南→东南），读起来有顺序 */
    var ORDER = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    out.sort(function (a, b) { return ORDER.indexOf(a.dir) - ORDER.indexOf(b.dir); });
    return out;
  };

  /* ============================================================
   * v151（老板：「地图就是游戏本体」）—— **手势就是点地图**
   * ------------------------------------------------------------
   * 改前：走路是 HUD 上六个 `<span>`、一次一步，点地图只会弹"未占领野地"面板。
   * 改后：玩家点地图上任意一格 → 沿最短路径走过去（精力够到哪走到哪），
   *       HUD 不再给任何走路按钮。
   *
   * 三条判据（老板的验收标准）：
   *   · 手势：想走路 → 手指去点地图那一格（成立）；
   *   · 闭环：走完立刻看见人在新格子上、精力少了 N、迷雾退开（成立）；
   *   · 代价可见：动手前 HUD 给出"约走 N 步 / 耗 N 精力"，点远处时照此截断。
   * 不掷骰、不判定 —— 走到哪儿是玩家的选择，能做什么由那格自己决定。
   * ============================================================ */
  /* 最短路径：当前位置 → 目标格（只走已探明的格子 —— 不能借迷雾抄近路）。
     返回 { ci: [...不含起点], complete, why } —— 走不到就是 complete:false。 */
  P.pathTo = function (target) {
    var s = st0(), sp = SPc();
    if (!s || !sp || !sp.adj || target == null) return { ci: [], complete: false, why: 'nosp' };
    var nv = sp.nv || (sp.cells && sp.cells.length) || 0;
    if (target < 0 || target >= nv) return { ci: [], complete: false, why: 'out' };
    var start = P.pos();
    if (target === start) return { ci: [], complete: true };
    /* ============================================================
     * v152（老板：「球面是可活动区域，玩家在上边直接走动」「说好未探索区域
     * 只要云雾缭绕微暗就行」）
     * ------------------------------------------------------------
     * 改前：雾里的格子**不许踩**，点远处会被"自动瞄到已探明边缘"截断 ——
     * 于是玩家被一圈看不见的墙围住，点哪都说"没探明"。
     * 改后：**雾不是墙，是看不清**。点哪走哪（全图可走），雾照常遮信息；
     * 走到哪儿，哪儿就亮起来。「看不见」不再是「去不了」。
     * ============================================================ */
    var seen = function (ci) {
      try { return !(GAME.fog && GAME.fog.get && GAME.fog.get(ci) === 0); } catch (e) { return true; }
    };
    var prev = new Int32Array(nv).fill(-1);
    var q = [start], head = 0, found = false;
    prev[start] = start;
    while (head < q.length) {
      var cur = q[head++];
      if (cur === target) { found = true; break; }
      var an = sp.adj[cur] || [];
      for (var i = 0; i < an.length; i++) {
        var nb2 = an[i];
        if (prev[nb2] !== -1) continue;
        prev[nb2] = cur;
        q.push(nb2);
      }
    }
    if (!found) return { ci: [], complete: false, why: 'unreach' };
    var out = [];
    for (var c2 = target; c2 !== start; c2 = prev[c2]) {
      out.push(c2);
      if (prev[c2] === c2 || out.length > nv) break;
    }
    out.reverse();
    return { ci: out, complete: true };
  };

  /* 这一步要花多少精力（唯一口径，HUD 的"约耗 N"与真正走路同源） */
  P.stepCost = function () { return D().stepEnergy || 1; };
  /* 以当前精力还能走几步 */
  P.moveBudget = function () {
    var lord = P.lord();
    if (!lord) return 0;
    var en = GAME.energyNowOf ? GAME.energyNowOf(lord) : ((lord && lord.energy) || 0);
    return Math.max(0, Math.floor(en / P.stepCost()));
  };

  /* 走一步。只有一件事需要判断：是不是相邻、精力够不够。 */
  P.moveTo = function (ci) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var s = st0(), sp = SPc();
    if (!s) return { ok: false, msg: '没有对局' };
    var pos = P.pos(), adj = sp && sp.hopsWithin ? sp.hopsWithin(pos, 1) : [], ok = false;
    for (var i = 0; i < adj.length; i++) if (adj[i] === ci) ok = true;
    if (!ok) return { ok: false, msg: '只能走到相邻的格子' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    var cost = P.stepCost();
    var en = (GAME.energyNowOf ? GAME.energyNowOf(lord) : 100);
    if (en < cost) return { ok: false, msg: '精力见底了 —— 明天再走' };
    if (GAME.setEnergyNow) GAME.setEnergyNow(lord, en - cost);
    /* v153：记下上一格 —— map3d 的小人据此做"沿地表走过来"的插值（不瞬移） */
    s.prologue._fromCi = pos;
    s.prologue.pos = ci;
    s.prologue.steps = (s.prologue.steps | 0) + 1;
    /* 站到哪儿就看到哪儿周围一圈（比"探索"窄 —— 走一趟不等于勘察）。
       v152：脚下这一格**必须**全明（人站在那儿，不可能"看不见自己脚下"）。 */
    try {
      if (GAME.fog && GAME.fog.revealAround) GAME.fog.revealAround(ci, 3, GAME.fog.ALL);
      if (GAME.fog && GAME.fog.bump) GAME.fog.bump(ci, GAME.fog.ALL);
    } catch (e) { /* 迷雾失败不该挡住移动 */ }
    var cell = sp.cellOf(ci) || {};
    var tn = ((GAME.DATA || {}).TERRAIN || {})[cell.type] || {};
    return { ok: true, msg: '走到' + (tn.name || '荒野') + '了 —— 看看这地方能做什么', ci: ci };
  };

  /* 沿最短路径走到底（精力不足就停在中途）。
     返回 { ok, ci, steps, spent, complete, why, arrived } ——
     `arrived` = 最终是不是就站在目标格（决定地图点击后要不要就地弹动手面板）。 */
  P.walkTo = function (target) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var s = st0();
    if (!s) return { ok: false, msg: '没有对局' };
    var pth = P.pathTo(target);
    if (!pth.ci.length && !pth.complete) {
      return { ok: false, why: pth.why || 'no', msg: '走不过去' };
    }
    var budget = P.moveBudget();
    var path = pth.ci;
    if (!path.length) {
      return { ok: true, ci: P.pos(), steps: 0, spent: 0, complete: pth.complete, arrived: true };
    }
    var n = Math.min(budget, path.length);
    var last = null;
    for (var i = 0; i < n; i++) {
      var r = P.moveTo(path[i]);
      if (!r.ok) break;
      last = r;
    }
    var spent = n * P.stepCost();
    var arrived = n > 0 && path[n - 1] === target;
    var cur = P.pos();
    var cell = (SPc() && SPc().cellOf) ? SPc().cellOf(cur) : null;
    var tn = ((GAME.DATA || {}).TERRAIN || {})[(cell || {}).type] || {};
    var msg;
    if (!n) msg = '精力见底了 —— 明天再走';
    else if (arrived) msg = '走到' + (tn.name || '荒野') + '了（' + n + ' 步 · 精力 −' + spent + '）';
    else msg = '走了 ' + n + ' 步，精力不够了 —— 停在' + (tn.name || '荒野') + '（还差 '
      + (path.length - n) + ' 步）';
    return { ok: n > 0, ci: cur, steps: n, spent: spent, complete: pth.complete,
      arrived: arrived, msg: msg };
  };

  /* ============================================================
   * v132：**点名斗将**（老板「就是大地图加地块探索加斗将等」）
   * ------------------------------------------------------------
   * 内核早就有（`battle.duelPlay`：4 招相克 · 5 合先到 3 分 · 对手倾向由属性推），
   * 缺的只是"前传里怎么发起、怎么逐合出招、输了怎样"。
   * 复用的东西：
   *   · 对手 —— `GAME.wildDefenseAt(ci)` 的守将（没有守将就按野地等级造"游荡者"）
   *   · 判定 —— `duelPlay(我, 对手, 累积出招, 固定 seed)`；每合重算前 N 合取最后一行，
   *             seed 固定所以**同样的出招必然得到同样的结果**（不引入随机漂移）
   *   · 经验 —— `battle.gainExp`（与荒野行动同一出口）
   *   · 体力/精力 —— `setStaNow` / `setEnergyNow`（唯一写入口）
   * 谁能斗：**只有"这格有仗可打"**（有 fight / trial 类动作）时才给入口，
   *        否则斗将会变成满地图刷经验的捷径。
   * ============================================================ */

  /* 当前斗将状态（没有就是 null） */
  P.duelOf = function () {
    var s = st0();
    return (s && s.prologue && s.prologue.duel) || null;
  };

  /* 这一格能不能发起斗将 */
  P.duelReady = function (ci) {
    if (!P.on()) return false;
    if (ci == null) ci = P.pos();
    var s = st0();
    var acts = (GAME.jianghuActsAt ? GAME.jianghuActsAt(ci) : []) || [];
    if (!acts.length) return false;                       /* 纯荒地：没人应战 */
    /* 每格只叫一次阵（`s.prologue.dueled`）——
       不设这一条，斗将会变成"在同一格反复刷经验"的捷径。 */
    var _d = (s && s.prologue && s.prologue.dueled) || {};
    if (_d['c' + ci]) return false;
    return true;
  };

  /* 对手：这一带的头目 —— 但**等级要跟着君主走**。
     ------------------------------------------------------------
     第一版直接搬 `wildDefenseAt(ci).gen`（野地守将），实测 Lv1 君主在野地 Lv8 上
     撞到 Lv100 / 四维 310 的对手，连打两局都是 0:3 —— 斗将等于没有。
     野地守将的等级是给"带兵打仗"标定的（DATA.WILD_GUARD_LV：30~120），
     不是给"一个人挑一个人"用的。
     口径：对手等级上限 = 君主等级 × 1.5 + 10（保住挑战、但不碾压）。
        · 守将没超上限 → 就用他（有名字有头衔，真实感）
        · 超了 → 按上限造一个"游荡者"顶上
     必须用**确定性 rand**（U.rng(ci)）—— 否则每合重算时对手四维会漂，
     同样的出招会得到不同结果，斗将就不成立了。

     ⚠️ v144.1（斗将正式化）改了这条：**上限从 myLv×1.5+10 改成 = 君主等级**。
     原口径在"血 = 体力"之后不再成立 —— 等级直接买体力上限，
     于是对手常年比君主高 1.5~2.5 倍血（实测 Lv1 君主 vs Lv12 对手：
     124 血对 100 血，读招到位也只有 **40%** 胜率；Lv10 时差距更大）。
     单挑要的是"**读招定胜负**"，不是"血条定胜负" —— 挑战性交给
     物种偏科（四维重分配 → 招式倾向）与资质差异，不交给等级。 */
  /* v141：`speciesId` 可选 —— 场景遭遇时由场景指定"撞见的是哪一头"，
     不指定就按 ci 确定性抽（原来的行为）。 */
  P.duelFoe = function (ci, speciesId) {
    var myLv = P.lv();
    /* v144.1：单挑对挑 —— 对手等级 = 君主等级（见函数头注释；旧 cap = myLv×1.5+10） */
    var cap = Math.max(1, myLv | 0);
    var d = GAME.wildDefenseAt ? GAME.wildDefenseAt(ci) : null;
    /* ⛔ v141 实测踩到：这一行原来**优先返回野地守将**，于是"场景里撞见一头辐光孢子母体"
       实际打的是该格的守将（掠夺者头目）—— 指定物种被静默吞掉。
       指定了物种就跳过守将分支，按物种造。 */
    if (!speciesId && d && d.gen && (d.gen.level | 0) <= cap) return d.gen;
    var glv = Math.max(1, Math.min(cap, (d && d.gen && (d.gen.level | 0)) || cap));
    var rnd = GAME.utils.rng(((ci | 0) * 2654435761) >>> 0);
    /* v136（老板：「名为斗将，实际上对面可以为生化兽等各种废土物种」）：
       从 `DATA.DUEL_FOES` 抽一个物种 —— 按 ci 确定性抽，同一格永远同一个对手。 */
    var LIST = (GAME.DATA && GAME.DATA.DUEL_FOES) || [];
    var sp0 = null;
    if (speciesId) {
      for (var _fi = 0; _fi < LIST.length; _fi++) if (LIST[_fi].id === speciesId) sp0 = LIST[_fi];
    }
    if (!sp0 && LIST.length) sp0 = LIST[Math.floor(rnd() * LIST.length) % LIST.length];
    var foeName = sp0 ? sp0.name : '游荡者';
    var g = GAME.makeGeneral(foeName, glv, 'guard', null, false, null, 'balance', rnd);
    /* ⛔ **对手的 id 必须确定**（v132 实测踩到的坑）：
       `duelEnemyMove` 的出招种子是 `'duelm|' + defGen.id + '|' + round + '|' + seed`。
       而 `makeGeneral` 每调一次就自增一个新 id —— 于是每合重算前 N 合时，
       "对手"其实换了一个人，招式序列全变，**比分当场倒退**
       （实测：第 2 合 2:0 → 第 3 合 0:1）。
       固定成 `duelfoe_<ci>` 之后，同一格同一 seed 的对手永远同一个人。 */
    g.id = 'duelfoe_' + (ci | 0) + (speciesId ? '_' + speciesId : '');
    if (GAME.guardFillOf) GAME.guardFillOf(g, 1);
    /* ⚠️ v136 实测踩到的顺序 bug：`guardFillOf` 内部**会重设四维**
       （它按等级把属性填成一组均衡值），所以"按物种倾向重分配"必须放在它**之后**。
       第一版放在前面 → 实测三个属性都是 130/130/130，
       面板显示"四平八稳、读不出偏哪一手"，所有物种打起来一模一样。
       重分配只改**比例**、不改总量 —— `duelTendency` 读的是相对权重。 */
    if (sp0) {
      var sum = (g.yw | 0) + (g.tong | 0) + (g.zm | 0);
      var W = (sp0.w + sp0.t + sp0.m) || 1;
      g.yw = Math.max(1, Math.round(sum * sp0.w / W));
      g.tong = Math.max(1, Math.round(sum * sp0.t / W));
      g.zm = Math.max(1, Math.round(sum * sp0.m / W));
      g.species = { id: sp0.id, icon: sp0.icon, name: sp0.name, tag: sp0.tag, desc: sp0.desc };
    }
    g.wild = true;
    return g;
  };

  /* 发起斗将：只扣一点精力（"站出来叫阵"的成本），不出兵、不耗体力 */
  /* ============================================================
   * v141：**把"开一场斗将"从"只能打脚下这一格"里解耦**
   * ------------------------------------------------------------
   * 场景里撞见一头生化兽时，它跟"这一格今天有没有清剿动作"没关系 ——
   * 撞见就是撞见。所以把开局那段抽成 `P.duelBegin(ci, foe)`：
   *   · `duelStart()`    = duelBegin(P.pos(), duelFoe(P.pos()))   ← 原来的行为，一字不变
   *   · 场景遭遇          = duelBegin(ci, 该物种按 ci 派生的对手)
   * 同时把对手**快照**存进 duel 状态（`foeFull`）：`duelStep` 每合要用它复算，
   * 而遭遇的对手未必等于 `duelFoe(ci)`（那是"这一格的头目"）。不存快照的话，
   * 第一合和第三合会是两个人 —— v136 踩过的"每合换人、比分倒退"就是这一类。
   * ============================================================ */
  P.duelBegin = function (ci, foe) {
    if (!P.on()) return { ok: false, msg: '已经立城了' };
    var s = st0(), lord = P.lord();
    if (!s || !lord) return { ok: false, msg: '没有君主' };
    if (!GAME.battle || !GAME.battle.duelPlay) return { ok: false, msg: '斗将内核缺失' };
    if (!GAME.duel || !GAME.duel.play) return { ok: false, msg: '斗将竞技场缺失' };
    if (ci == null) ci = P.pos();
    var n = P.duelOf();
    if (n && !n.done) return { ok: false, msg: '正打着呢' };
    foe = foe || P.duelFoe(ci);
    /* v144.1（老板「血量由体力决定」）：**体力就是这一仗的血** ——
       气力不足不许叫阵（否则开打即残血，白送一场）。判据走 `GAME.duel.gate`
       （唯一出口），不在这里另写一条。 */
    var gt = GAME.duel.gate(lord);
    if (!gt.ok) return { ok: false, msg: gt.msg };
    var cost = (D().duelEnergy == null ? 2 : D().duelEnergy);
    var en = GAME.energyNowOf ? GAME.energyNowOf(lord) : 100;
    if (en < cost) return { ok: false, msg: '精力不够，叫不动阵' };
    if (GAME.setEnergyNow) GAME.setEnergyNow(lord, en - cost);
    s.prologue.duel = {
      ci: ci, seed: 20261024 + (s.prologue.acts | 0),   /* 固定 seed：同出招同结果 */
      moves: [], rows: [], wa: 0, wb: 0, done: false, winner: null,
      /* v144.1：**血量与伤害不再自己算** —— 交给 `GAME.duel.play` 从头复算
         （同 seed 同招序列必得同一结果，见 duelStep 注释）。
         v136 的 hpA/hpB/atkPerTurn 三字段退役：那时的血是"比分派生"的（
         100×(3−对方得分)/3），与老板要的"血=体力"是两本账。
         老存档带这几个字段也无害 —— 走新口径后它们根本不被读。 */
      mode: 'arena',
      res: null,
      foe: { name: foe.name, level: foe.level | 0,
        tong: foe.tong | 0, yw: foe.yw | 0, zm: foe.zm | 0, nz: foe.nz | 0,
        icon: (foe.species && foe.species.icon) || '👤',
        tag: (foe.species && foe.species.tag) || '',
        desc: (foe.species && foe.species.desc) || '',
        speciesId: (foe.species && foe.species.id) || '' },
      /* 对手快照：duelStep 每合复算要用它（见函数头注释） */
      foeFull: { id: foe.id, name: foe.name, level: foe.level | 0,
        yw: foe.yw | 0, tong: foe.tong | 0, zm: foe.zm | 0, nz: foe.nz | 0,
        species: (foe.species || null) },
    };
    return { ok: true, msg: foe.name + '（Lv' + (foe.level | 0) + '）应战 —— 出招吧' };
  };

  /* 原来的"点名斗将"：只能打脚下这一格，且这格得有人应战 */
  P.duelStart = function () {
    var ci = P.pos();
    if (!P.on()) return { ok: false, msg: '已经立城了' };
    if (!P.duelReady(ci)) return { ok: false, msg: '这地方没人应战 —— 先找有仗可打的格子' };
    return P.duelBegin(ci, P.duelFoe(ci));
  };

  /* 斗将对手（**从开局快照还原**）—— 单一出口。
     ------------------------------------------------------------
     `duelStep` 每合复算与 `ui.openDuelPanel` 呈现必须用**同一份对手**：
     v136 踩过"每合换人 → 比分倒退"，v141 又踩过"遭遇指定的物种被静默换成守将"。
     老存档没有 foeFull → 退回 duelFoe(ci)（行为与以前一致）。 */
  P.duelFoeFull = function (d) {
    if (!d) return null;
    if (d.foeFull) {
      return { id: d.foeFull.id, name: d.foeFull.name, level: d.foeFull.level,
        yw: d.foeFull.yw, tong: d.foeFull.tong, zm: d.foeFull.zm, nz: d.foeFull.nz,
        species: d.foeFull.species };
    }
    return P.duelFoe(d.ci);
  };

  /* 出一招。返回这一合的结果；打完就结算。 */
  P.duelStep = function (moveId) {
    var s = st0(), lord = P.lord(), d = P.duelOf();
    if (!s || !lord || !d || d.done) return { ok: false, msg: '现在没有在打的斗将' };
    var MV = (GAME.DATA && GAME.DATA.DUEL && GAME.DATA.DUEL.moves) || {};
    if (!MV[moveId]) return { ok: false, msg: '没有这一招' };
    var DU = (GAME.DATA && GAME.DATA.DUEL) || {};
    if (!GAME.duel || !GAME.duel.play) return { ok: false, msg: '斗将竞技场缺失' };
    d.moves.push(moveId);
    /* 对手取**开局时的快照**（遭遇的对手不一定等于 duelFoe(ci)）——
       与面板同一出口 `P.duelFoeFull`，杜绝"判定一个对手、画面另一个"。 */
    var foe = P.duelFoeFull(d);
    /* ============================================================
     * v144.1（老板「斗将正式化」）：判定改走 **竞技场内核** `GAME.duel.play`
     * ------------------------------------------------------------
     * 改前（v136）：判定 = 5 合比分制（先到 3 分胜），血条是**比分派生**的
     *   （hp = 100×(3−对方得分)/3）—— 于是"掉血"只是比分的另一种画法，
     *   攻防（atk/def）在这场里**完全不参与**，体力也不参与。
     * 改后：血 = 体力，伤害 = 攻防对冲 × 招式倍率（见 js/duel.js 的三条口径）。
     * ⚠️ 仍是**累积出招从头复算**（与旧内核同构）：不存中间血量，
     *   所以挂起/重开/回档都不会漂 —— 血条永远是"这一串招式"的确定结果。
     * ============================================================ */
    var r = GAME.duel.play(lord, foe, d.moves, d.seed);
    if (!r) return { ok: false, msg: '这一合没判出来' };
    var row = r.rounds[r.rounds.length - 1] || null;
    d.res = r;
    d.rows = r.rounds;                 /* 面板与旧读点同源（不再另存一份血量） */
    d.wa = r.wa; d.wb = r.wb;
    d.hpA = r.hpA; d.hpB = r.hpB;      /* 兼容旧读点：读的是**复算出来的**真血 */
    var over = !!r.over;
    var out = { ok: true, row: row, res: r, wa: d.wa, wb: d.wb, done: false, msg: '' };
    if (over) {
      d.done = true;
      d.winner = r.winner;
      var foeLv = foe.level | 0;
      var gain = 0, txt = '';
      /* 叫过阵的格子记下来（每格一次） */
      s.prologue.dueled = s.prologue.dueled || {};
      s.prologue.dueled['c' + d.ci] = 1;
      if (r.winner === 'atk') {
        gain = Math.round(foeLv * 25);
        txt = '斗将胜 —— ' + ((d.foe && d.foe.name) || '对手') + ' 先倒下了（我 '
          + r.hpA + '/' + r.maxA + ' · 他 ' + r.hpB + '/' + r.maxB + '）';
        /* **这一战的价值不在经验**：赢了之后这格的战斗难度下降 40%（3 次）。
           对比：清剿一次 4,000 经验、斗将只有几百 —— 单看经验没人会斗将。
           它的意义是"打不过的时候，先把头目挑下来"。 */
        s.prologue.subdued = s.prologue.subdued || {};
        s.prologue.subdued['c' + d.ci] = 3;
        /* 战利品：一件辐能核心（前传唯一的硬通货），走既有物品出口 */
        try {
          if (GAME.state && GAME.state.items) {
            GAME.state.items['fucore'] = (GAME.state.items['fucore'] | 0) + 1;
            /* v136：结算面板要"提示物资收获" —— 记下来，别让玩家去背包里猜 */
            d.loot = [{ id: 'fucore', name: '辐能核心', n: 1 }];
          }
        } catch (e) {}
      } else if (r.winner === 'def') {
        gain = Math.round(foeLv * 8);
        txt = '斗将负 —— 血先见底（我 ' + r.hpA + '/' + r.maxA + ' · 他 '
          + r.hpB + '/' + r.maxB + '）';
        /* 输的代价：体力与精力（比全军覆没轻得多，但真的疼） */
        try {
          if (GAME.setStaNow) GAME.setStaNow(lord, Math.max(0, GAME.staNow(lord) - 25));
          if (GAME.setEnergyNow) GAME.setEnergyNow(lord, Math.max(0, GAME.energyNowOf(lord) - 15));
        } catch (e) {}
      } else {
        gain = Math.round(foeLv * 15);
        txt = '斗将平 —— 打满 ' + (r.maxRounds || 12) + ' 合谁也没倒（我 '
          + r.hpA + '/' + r.maxA + ' · 他 ' + r.hpB + '/' + r.maxB + '）';
      }
      if (gain > 0 && GAME.battle && GAME.battle.gainExp) {
        GAME.battle.gainExp(lord, gain, '斗将 · ' + (d.foe ? d.foe.name : '对手'));
      }
      d.gain = gain;
      d.txt = txt;
      s.prologue.last = txt + ' · 经验 +' + gain;
      s.prologue.acts = (s.prologue.acts | 0) + 1;
      out.done = true; out.winner = r.winner; out.gain = gain;
      out.msg = txt + '　经验 +' + gain;
    } else {
      out.msg = '第 ' + d.moves.length + ' 合：' + row.aName + ' 对 ' + row.bName
        + '　我掉 ' + row.dmgToA + ' · 他掉 ' + row.dmgToB
        + (row.res === 'a' ? '（我占先）' : row.res === 'b' ? '（我吃亏）' : '（相持）');
    }
    return out;
  };

  /* 收掉斗将状态（面板关闭时） */
  P.duelClear = function () {
    var s = st0();
    if (s && s.prologue) s.prologue.duel = null;
  };

  P.spots = function (radius) {
    var s = st0(), sp = SP();
    if (!s || !sp || !sp.cells) return [];
    if (!GAME.jianghuActsAt) return [];
    var c = GAME.currentCity ? GAME.currentCity() : null;
    var fromCi = (c && c.ci != null) ? c.ci : 0;
    var d = D(), rad = radius || d.reach || 6, n = sp.cells.length;
    var lim = d.listMax || 5;
    var seen = {}, out = [];
    var cap = lim * 4;
    var consider = function (ci) {
      if (out.length >= cap) return;
      if (ci == null || ci < 0 || ci >= n) return;
      if (seen[ci]) return;
      seen[ci] = 1;
      if (!sp.cells[ci]) return;
      if (GAME.map && GAME.map.ownCityAt && GAME.map.ownCityAt(ci)) return;
      /* 先问"有没有事"，再算距离 —— 距离是 BFS，不能对没东西的格白跑 */
      var acts = GAME.jianghuActsAt(ci);
      if (!acts.length) return;
      var dist = sp.distOf ? sp.distOf({ ci: fromCi }, { ci: ci }) : 99;
      if (dist < 1 || dist > rad) return;
      out.push({ ci: ci, dist: dist, type: sp.cells[ci].type, acts: acts });
    };

    var ring = (sp.hopsWithin && fromCi >= 0) ? sp.hopsWithin(fromCi, rad) : null;
    if (ring && ring.length) {
      for (var i = 0; i < ring.length && out.length < cap; i++) consider(ring[i]);
    } else {
      /* 兜底：没有半径枚举出口时的老抽样路径（保留确定性 roll，行为可复现） */
      var tries = d.samples || 4000;
      for (var k = 0; k < tries && out.length < cap; k++) {
        consider(Math.floor((GAME.invasionRoll ? GAME.invasionRoll('pg|s|' + k) : 0.5) * n) % n);
      }
    }
    /* 能打的排前面 —— 前传要的是"打野兽"，采集/静修只是顺带。
       同类里再按距离（越近越省事）。 */
    var fightRank = { fight: 0, trial: 0, scene: 1, gather: 2, cultivate: 2, visit: 3 };
    var rankOf = function (o) {
      var best = 9;
      o.acts.forEach(function (a) {
        var k = (a.def && a.def.kind) || '';
        if (fightRank[k] != null && fightRank[k] < best) best = fightRank[k];
      });
      return best;
    };
    out.forEach(function (o) { o.rank = rankOf(o); });
    out.sort(function (a, b) { return (a.rank - b.rank) || (a.dist - b.dist); });
    return out.slice(0, lim);
  };

  /* 这次行动给多少经验：先按 id 查，再按 kind 查。
     荒野行动共 12 种（含六个地形场景），只给四种配表会让玩家撞上"零经验"。 */
  P.expOf = function (actId, lv) {
    var d = D();
    var t = (d.exp || {})[actId];
    if (t == null) {
      var a = (GAME.DATA && GAME.DATA.LING_ACT && GAME.DATA.LING_ACT[actId]) || {};
      t = (d.expByKind || {})[a.kind] || 0;
    }
    var tier = P.tier(lv);
    return Math.round(t * ((tier && tier.expMul) || 1));
  };

  /* 现在的连战机会（没有就是 null） */
  P.comboOf = function () {
    var s = st0();
    return (s && s.prologue && s.prologue.combo) || null;
  };
  P.comboClear = function () {
    var s = st0();
    if (s && s.prologue) s.prologue.combo = null;
  };

  /* ============================================================
   * 四、出去一趟
   * ------------------------------------------------------------
   * 判定/扣费/结算全走既有内核（`GAME.jianghuDo`），这里只补一件事：
   * **给经验**。内核给的是辐能核心与装备，不给经验 —— 前传要的正是经验。
   * 经验走既有 `GAME.battle.gainExp`（含升级、音效、日志）。
   * ============================================================ */
  /* 能不能在这一格做这件事（**不扣费、不落锁** —— 给"先问再走"的前置检查用） */
  P.actCheck = function (ci, actId) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    if (!GAME.jianghuCheck) return { ok: false, msg: '荒野行动内核缺失' };
    /* 前传期**不锁日**：野外就在脚下，翻过一遍还能再翻。
       正式阶段的"此地今日已做过"是防止在城里刷行动，前传没有这个场景；
       真正的限制是精力与体力（有限资源才有取舍）。 */
    var s0 = st0();
    if (s0 && s0.jianghu) delete s0.jianghu['c' + ci + '|' + actId];
    return GAME.jianghuCheck(ci, lord.id, actId);
  };

  /* 结算一次行动（扣费 + 掷结果 + 给经验）；`force` 由回合制打斗传进来，
     直接改写 `jianghuRoll` 的胜负 —— 不另写第二套账（见 jianghuRoll 的 force 注释）。
     `preChk` = 这笔费用**已经付过**（回合打斗在开打时扣），此时不再重复校验与扣费。 */
  P.resolve = function (ci, actId, force, preChk) {
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    if (!GAME.jianghuCheck || !GAME.jianghuRoll) return { ok: false, msg: '荒野行动内核缺失' };
    var s0 = st0();
    if (s0 && s0.jianghu) delete s0.jianghu['c' + ci + '|' + actId];
    /* 走的是**同一套内核**（check → spend → roll），只是把 `jianghuDo` 的三合一
       拆开，好把前传的两把倍率传进去。不另写判定 —— 那是第二个引擎。 */
    /* 连战不耗精力（它是上一场"顺下来"的），普通行动才走 check/spend */
    var combo = P.comboOf();
    var isCombo = !!(combo && combo.ci === ci && combo.act === actId);
    var chk = preChk || GAME.jianghuCheck(ci, lord.id, actId);
    if (!chk.ok) return chk;
    if (!isCombo && !preChk && GAME.jianghuSpend) GAME.jianghuSpend(chk);
    var d = D();
    var tier = P.tier();
    var def = (GAME.DATA.LING_ACT || {})[actId];
    var bakPow = def ? def.power : null;
    /* v132：**斗将赢了，这一格的头目服了** —— 之后 3 次战斗类动作难度 −40%。
       这是斗将真正的存在理由：经验远不如清剿（几百 vs 四千），
       但"打不过的时候先把头目挑下来"是一条真的出路。
       用现成的 `def.power` 临时缩放（同一套倍率机制，P.resolve 本来就在用它）。
       只对 fight / trial / scene 生效 —— 采集/静修没有对手，不该跟着变便宜。 */
    var _subdued = 0;
    try {
      var _sp = st0() && st0().prologue;
      var _sub = (_sp && _sp.subdued) || {};
      var _kind2 = (def && def.kind) || '';
      if (_sub['c' + ci] > 0 && (_kind2 === 'fight' || _kind2 === 'trial' || _kind2 === 'scene')) {
        _subdued = _sub['c' + ci];
      }
    } catch (e) {}
    if (def && bakPow) {
      def.power = Math.max(1, bakPow * (d.powerMul || 1) * ((tier && tier.powerMul) || 1)
        * (_subdued ? 0.6 : 1));
    }
    var r;
    try {
      var mods = { pow: d.powMul || 1 };
      if (force) mods.force = force;
      r = GAME.jianghuRoll(chk, mods);
    } finally {
      if (def && bakPow) def.power = bakPow;   /* 一定要恢复：这张表是正式阶段的 */
      /* v132：吃掉了这次"头目服了"的优惠（3 次用完就没了） */
      if (_subdued) {
        try {
          var _sp2 = st0() && st0().prologue;
          if (_sp2 && _sp2.subdued) {
            _sp2.subdued['c' + ci] = Math.max(0, _subdued - 1);
            if (!_sp2.subdued['c' + ci]) delete _sp2.subdued['c' + ci];
          }
        } catch (e) {}
      }
    }
    if (!r || !r.ok) return r || { ok: false, msg: '这一趟没去成' };
    var gain = P.expOf(actId);
    /* v123：打输了也给一半（"打不过不等于白跑"），连战打折（防刷） */
    if (r.bad) gain = Math.round(gain * (D().loseExpMul == null ? 0.5 : D().loseExpMul));
    if (isCombo) gain = Math.round(gain * (D().comboExpMul == null ? 0.7 : D().comboExpMul));
    if (gain > 0 && GAME.battle && GAME.battle.gainExp) {
      GAME.battle.gainExp(lord, gain, '荒野 · ' + (r.name || actId));
    }
    var s = st0();
    if (s && s.prologue) {
      s.prologue.acts = (s.prologue.acts | 0) + 1;
      s.prologue.last = (r.name || '出去了一趟') + (r.text ? ' · ' + r.text : '')
        + (gain ? ' · 经验 +' + gain : '');
      /* 连战机会：打完之后掷一次，赢了就摆出"再来一场" */
      s.prologue.combo = (GAME.invasionRoll
        ? GAME.invasionRoll('combo|' + (s.prologue.acts | 0) + '|' + ci)
        : 0.5) < (D().comboChance == null ? 0.35 : D().comboChance)
        ? { ci: ci, act: actId } : null;
    }
    return {
      ok: true, gain: gain, bad: !!r.bad,
      msg: (r.name || '') + '　' + (r.text || '') + (gain ? '　经验 +' + gain : '')
    };
  };

  /* 就地解决（一次性结算）。回合制打斗走 P.duelAct（见 §v151）。 */
  P.act = function (ci, actId) { return P.resolve(ci, actId, null); };

  /* ============================================================
   * v151-b：**打斗给回合**（老板：「点那个敌人 → 打几个回合」）
   * ------------------------------------------------------------
   * 改前：点一下 = 掷一次骰 = 一行字。没有出手，没有读招。
   * 改后：先扣费（jianghuSpend 与一次性结算同一本账），再开一场**斗将竞技场**：
   *   复用 `GAME.duel.play`（血 = 体力上限、每合双方各出手一次、招式相克），
   *   每合玩家选一招 → 打完把胜负**回灌** `jianghuRoll({force})` 落账。
   * 于是"回合"长在前端，"账"仍在唯一出口 —— 不新写第二套判定。
   * 谁会开回合：fight / trial / scene（有对手）；采集/静修/拜访仍是一次性。
   * ============================================================ */
  P.combatKind = function (actId) {
    var def = (GAME.DATA.LING_ACT || {})[actId];
    return !!(def && (def.kind === 'fight' || def.kind === 'trial'));
  };

  /* 开一场"做事"的回合：先付费 → 建 foe 快照 → 存 prologue.duel(mode:'act') */
  P.duelAct = function (ci, actId) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    if (!GAME.duel || !GAME.duel.play) return { ok: false, msg: '斗将竞技场缺失' };
    var n = P.duelOf();
    if (n && !n.done) return { ok: false, msg: '正打着呢' };
    var chk = P.actCheck(ci, actId);
    if (!chk.ok) return chk;
    /* 血就是体力：气力不足不许动手（与叫阵同一条门槛） */
    var gt = GAME.duel.gate(lord);
    if (!gt.ok) return { ok: false, msg: gt.msg };
    GAME.jianghuSpend(chk);                       /* 扣费与一次性结算同一本账 */
    var foe = P.duelFoe(ci);
    var s = st0();
    s.prologue.duel = {
      mode: 'act', ci: ci, act: actId,
      seed: 20261024 + (s.prologue.acts | 0),
      moves: [], rows: [], wa: 0, wb: 0, done: false, winner: null, res: null,
      foe: { name: foe.name, level: foe.level | 0,
        tong: foe.tong | 0, yw: foe.yw | 0, zm: foe.zm | 0, nz: foe.nz | 0,
        icon: (foe.species && foe.species.icon) || '👤',
        tag: (foe.species && foe.species.tag) || '',
        desc: (foe.species && foe.species.desc) || '',
        speciesId: (foe.species && foe.species.id) || '' },
      foeFull: { id: foe.id, name: foe.name, level: foe.level | 0,
        yw: foe.yw | 0, tong: foe.tong | 0, zm: foe.zm | 0, nz: foe.nz | 0,
        species: (foe.species || null) },
    };
    return { ok: true, msg: foe.name + '（Lv' + (foe.level | 0) + '）挡住了去路 —— 出招吧' };
  };

  /* 出一招（mode:'act'）。打满不判负死的，按 duel 内核的"剩血比例"分胜负。 */
  P.duelActStep = function (moveId) {
    var s = st0(), lord = P.lord(), d = P.duelOf();
    if (!s || !lord || !d || d.done || d.mode !== 'act') return { ok: false, msg: '现在没有在打的斗将' };
    var MV = (GAME.DATA && GAME.DATA.DUEL && GAME.DATA.DUEL.moves) || {};
    if (!MV[moveId]) return { ok: false, msg: '没有这一招' };
    if (!GAME.duel || !GAME.duel.play) return { ok: false, msg: '斗将竞技场缺失' };
    d.moves.push(moveId);
    var foe = P.duelFoeFull(d);
    var r = GAME.duel.play(lord, foe, d.moves, d.seed);
    if (!r) return { ok: false, msg: '这一合没判出来' };
    var row = r.rounds[r.rounds.length - 1] || null;
    d.res = r; d.rows = r.rounds; d.wa = r.wa; d.wb = r.wb;
    d.hpA = r.hpA; d.hpB = r.hpB;
    var out = { ok: true, row: row, res: r, done: false, msg: '' };
    if (!r.over) {
      out.msg = '第 ' + d.moves.length + ' 合：' + row.aName + ' 对 ' + row.bName
        + '　我掉 ' + row.dmgToA + ' · 他掉 ' + row.dmgToB;
      return out;
    }
    /* 打完：把胜负回灌唯一账本（force）—— 经验/物资/负伤全在那一本账上。
       `已付费`（preChk）：开打时扣过，这里只结算，不再校验体力/精力。 */
    d.done = true;
    d.winner = r.winner;
    var force = (r.winner === 'atk') ? 'win' : (r.winner === 'def' ? 'lose'
      : (r.winner === 'draw' ? 'draw' : 'win'));
    var act = P.resolve(d.ci, d.act, force, {
      ok: true, act: (GAME.DATA.LING_ACT || {})[d.act], gen: lord, ci: d.ci, actId: d.act,
      day: Math.floor(((s.world && s.world.elapsed) || 0) / 86400),
      lv: (GAME.map && GAME.map.wildLevelNow) ? GAME.map.wildLevelNow(d.ci) : 0
    });
    d.actRes = act || null;
    d.txt = (act && act.msg) || '';
    d.gain = (act && act.gain) | 0;
    out.done = true; out.winner = r.winner; out.act = act;
    out.msg = (r.winner === 'atk' ? '拿下' : r.winner === 'def' ? '不敌' : '相持')
      + (d.txt ? ' —— ' + d.txt : '');
    return out;
  };

  /* 打斗里"先撤"：账不结（已扣的费用不退，回合作废）——
     退的是命，不是白打；给玩家一条"打不动就走"的路。 */
  P.duelActFlee = function () {
    var d = P.duelOf();
    if (!d || d.mode !== 'act' || d.done) return { ok: false, msg: '现在没有在打的斗将' };
    d.done = true; d.winner = 'flee';
    d.txt = '你退开了 —— 这一趟白跑，精力和体力照扣';
    d.gain = 0;
    return { ok: true, msg: d.txt };
  };

  /* ============================================================
   * 五、立城
   * ------------------------------------------------------------
   * v131（老板「应当根治」）：改前这里是**假动作** —— 城在 newGame 就已建好，
   * 「立城」只是把前传标记关掉（cities 1 → 1）。玩家在前传里说的"还没有城"
   * 和 state 里的 20 栋建筑、驻军、能出兵完全对不上。
   * 现在反过来：前传局真的没有城，**立城这一刻才落下第一座城**，
   * 落点就是君主脚下这一格（`prologue.pos`），随身物资一起搬进城。
   * ============================================================ */
  P.build = function () {
    if (!P.on()) return { ok: false, msg: '已经立过城了' };
    if (!P.ready()) {
      return { ok: false, msg: '君主还没到 Lv' + P.needLv() + '（现在 Lv' + P.lv() + '）' };
    }
    var s = st0(), sp = SP();
    if (!s) return { ok: false, msg: '没有对局' };
    if (!GAME.makeCity) return { ok: false, msg: '建城内核缺失' };

    var pos = P.pos();
    var cell = (sp && sp.cellOf) ? sp.cellOf(pos) : null;
    if (!cell) return { ok: false, msg: '脚下这块地不对劲，走一步再试' };
    var xy = (sp && sp.xyOfLonLat && cell.lon != null)
      ? sp.xyOfLonLat(cell.lon, cell.lat) : null;
    if (!xy) return { ok: false, msg: '算不出这里的坐标，走一步再试' };

    /* ⛔ v135（老板：「立城为什么在水里，玩家自建城市应当只在平地」）：
       这里原来**什么都不判**——算完坐标直接 makeCity，所以湖泊上也能起城。
       判据走 DATA.TERRAIN.buildable（全表只有 plain 为真），不自造第二套。
       拒绝时要说清楚"这是什么地"和"最近的平地在哪"，否则玩家只会反复点。 */
    if (!P.buildableAt(pos)) {
      var near = P.nearestBuildable(40);
      var hint = near
        ? ('往' + near.dir + '走 ' + near.dist + ' 格就是平地')
        : '这一带走很远都没有平地 —— 换个方向'
      return { ok: false, msg: '脚下是' + P.terrainLabel(pos) + '，立不了城 —— ' + hint + '。' };
    }

    /* 区归属：沿用出生区（玩家在前传里走不出多远；城要挂岁贡/辖区特产） */
    var region = (s.map && s.map.startPos && s.map.startPos.state)
      || (s.ruler && s.ruler.region) || '烬环';

    /* 随身物资搬进城：前传期间采到的东西不能凭空消失 */
    var carry = (s.prologue && s.prologue.res) ? s.prologue.res : null;
    var res0 = carry ? GAME.utils.deep(carry) : null;

    var city = GAME.makeCity({
      id: 'p1',
      name: (s.ruler && s.ruler.cityName) || '新城市',
      x: xy.x, y: xy.y,
      state: region,
      initialExt: true,
      res: res0 || undefined,
      /* v138（老板「立城前可以先小村庄……建筑更低级」）：立城只给 4 座居所，
         其余居所槽留空 —— 从"一落地 26 户"改成"几间窝棚"。
         格子数（8×6 → 4×4）要动 city.col/row 这个结构常量，留独立一轮。 */
      village: true,
    });
    if (!city) return { ok: false, msg: '建城失败 —— 这块地立不起来' };
    s.cities = s.cities || [];
    s.cities.push(city);
    /* 将领归属回填：前传里两位（开局英雄 + 君主）都还没有城 */
    (s.generals || []).forEach(function (g) { if (g && !g.cityId) g.cityId = city.id; });
    if (GAME.ui) GAME.ui._cityId = city.id;
    /* 城周围点亮（城自带视野半径；走 fog 的唯一出口） */
    try {
      if (GAME.fog && GAME.fog.revealOwned) GAME.fog.revealOwned();
      if (GAME.fog && GAME.fog.revealCity) GAME.fog.revealCity(city);
    } catch (e) { /* 迷雾失败不该挡住立城 */ }
    try { if (GAME.attachRes) GAME.attachRes(s); } catch (e) {}
    /* ⛔ v131（e2e 当场照出）：旧币是**玩家层级唯一池**（`s.gold`），
       各城的 `res.gold` 只是绑到池子的访问器。`newGame` 里有一句
       `attachGold(state, {keepCityGold:true})` 负责"把开局旧币上收进池"——
       前传局没有城，那一步收到的是 0；立城时我把随身物资（含 87 万旧币）
       搬进了 `city.res.gold`，却没重新上收 → `goldOf()` 恒为 0
       → 研究科技/升建筑全部报「资源不足」。
       这一步就是把 newGame 的收尾补齐：立城 = 一次"新局初始化"。 */
    try { if (GAME.attachGold) GAME.attachGold(s, { keepCityGold: true }); } catch (e) {}

    P.end(city.name);
    /* ============================================================
     * v123：**立城后的第一句话**
     * ------------------------------------------------------------
     * 立城那一刻玩家看到的是 20 格空地 + 一串「＋」。
     * 之前没有任何东西告诉他"先建什么"—— 空地看着像"还有好多要填"，
     * 而不是"从哪一块开始"。
     *
     * 只给一句、只给一次、不占版面（走既有 toast）。
     * 不说"你要守护这里"，只说下一步点哪。
     * ============================================================ */
    /* ⚠️ 不能直接调界面层（core 包引用 ui 会被架构棘轮拦，而且 node 探针里没有 ui）。
       改成留一条"下次渲染时弹一次"的提示，由 ui.renderView 消费。 */
    if (GAME.state) GAME.state._tip = '城立起来了。先点两格空地建农田 —— 粮不够，什么也盖不了。';
    return { ok: true, msg: '立城了 —— 城里的东西从今天起才真的算你的' };
  };

  /* ============================================================
   * 六、每天回一点精力（不然打两下就动不了）
   * ============================================================ */
  P.tick = function () {
    var s = st0();
    if (!s || !P.on()) return;
    var pg = s.prologue;
    var day = dayNow();
    if (pg.day === day) return;
    pg.day = day;
    var lord = P.lord();
    if (!lord) return;
    var add = D().restPerDay || 30;
    if (GAME.energyMaxOf && GAME.setEnergyNow) {
      var cap = GAME.energyMaxOf(lord);
      GAME.setEnergyNow(lord, Math.min(cap, (lord.energy || 0) + add));
    }
    /* 正确出口是 GAME.staMax（domain.js:8206）——
       我第一版写成 staMaxOf，判空写法让它**不报错**，
       体力一直不恢复。可空判断不代表没问题。 */
    if (GAME.staMax && GAME.setStaNow) {
      var scap = GAME.staMax(lord);
      GAME.setStaNow(lord, Math.min(scap, GAME.staNow(lord) + add));
    }
  };

  /* ============================================================
   * v114：**前传第一屏** —— 只有荒野，没有仪表盘
   * ------------------------------------------------------------
   * 老板 2026-10-23 的评估结论：前传第一屏有 50 个可点元素
   * （12 个 tab、行省/市/区三级下拉、7 种地形筛选、坐标输入、9 个地图按钮），
   * 而玩家此刻唯一该做的事（去荒野打怪）**一次都没出现**。
   * 人类读到的是"打开了一个没填完的 Excel"，不是"我在废土上活下来了"。
   *
   * 所以前传期盖一层全屏：只留天数、一句人话、一条等级进度、三个动作按钮、
   * 一行"最近发生了什么"。导航与仪表盘全部藏到立城之后。
   *
   * ⚠️ 用 fixed 覆盖层 + 隐藏 #topnav / #view-container，不改 renderView 的分支 ——
   *    立城后 `P.on()` 变 false，下一次刷新自动撤掉，玩家回到完整界面。
   * ============================================================ */
  P.screenHTML = function () {
    var lord = P.lord();
    var lv = P.lv(), need = P.needLv();
    var day = dayNow();
    var spots = P.spots();
    var city = GAME.currentCity ? GAME.currentCity() : null;
    /* v131：无城时人口在**随身物资**里（`GAME.res()` 已兜住这条分支）。
       旧写法 `city ? ... : 0` 会把它算成 0 —— 面板上"你们 0 个人"，
       而背包里明明有 200 人，这是最刺眼的一种"数字与事实不符"。 */
    var pop = Math.round(((GAME.res(city) || {}).pop) || 0);
    var pct = Math.max(0, Math.min(100, Math.round(lv / need * 100)));
    /* v114：进度条用真 div（字符条 ░ 在深底上像噪点，而且各字体宽度不一致）
       v128：条宽改为跟随 HUD 宽度（原来写死 260px，贴在底部条里显得断掉） */

    /* v131：`wide/wideSpots/findAct/findIn` 随「就近三按钮」一并退役 ——
       找目标这件工作已经由 `P.neighbors()` + `jianghuActsAt(脚下)` 承担。 */

    var last = (st0() && st0().prologue && st0().prologue.last) || '';

    /* v123：档位（按等级换地方）+ 连战 */
    var tier = P.tier(lv), nt = P.nextTier(lv);
    var combo = P.comboOf();
    var tierLine = tier
      ? '<div style="margin-top:14px;font-size:13px;color:#c9b06a;">📍 现在能去：<b>' + tier.name
        + '</b>　<span style="color:#8a7a5c;">' + U.escape(tier.line || '') + '</span></div>'
      : '';
    var nextLine = nt
      ? '<div style="font-size:12px;color:#6f6a60;margin-top:1px;">升到 Lv' + nt.lv
        + ' 能去「' + nt.name + '」（经验 ×' + nt.expMul + '，但那边更凶）</div>'
      : '';
    /* 连战：上一场打得顺，可以立刻再打一次（不耗精力，经验打折） */
    var comboLine = combo
      ? '<div style="margin-top:16px;"><span data-action="prologue-act" data-ci="' + combo.ci
        + '" data-act="' + U.escape(combo.act) + '"'
        + ' style="display:inline-block;padding:8px 16px;border-radius:4px;font-size:14px;'
        + 'border:1px solid #c9b06a;background:#2a2418;color:#ffd9a0;cursor:pointer;">'
        + '⚡ 趁势再来一场<span style="opacity:.55;font-size:12px;">　不耗精力 · 经验七折</span></span>'
        + '<span class="ui-sub" style="margin-left:8px;font-size:12px;">或先歇着（它在下一场之后失效）</span>'
        + '</div>'
      : '';
    /* 进度：几场了 + 还差几次的感觉（不写"还差 N 次"，那是数学题，不是游戏） */
    var acts = (st0() && st0().prologue && (st0().prologue.acts | 0)) || 0;
    var steps = (st0() && st0().prologue && (st0().prologue.steps | 0)) || 0;

    /* v131：`spotRows`（v128 的"附近可去"列表）退役 —— 现在走「脚下 + 四周」。 */
    /* 地形名：面板与营地视图都要用（删 spotRows 时被一起带走，这里补回）。 */
    var terrainName = function (t) {
      return ((GAME.DATA.TERRAIN || {})[t] || {}).name || t || '荒野';
    };

    /* ============================================================
     * v151（老板：「地图就是游戏本体」）
     * ------------------------------------------------------------
     * 走路、动手、叫阵**全部在地图上用手势完成** —— HUD 不给任何操作按钮：
     *   · 点地图上的格 → `P.walkTo` 沿最短路径走过去（精力够到哪走到哪）
     *   · 点脚下有事的格 → 地图上就地弹出动手面板（`ui.openLandModalCi`）
     *   · 破雾 → 雾里有动静的格子在地图上自己闪光
     * HUD 只留：读数（天数/等级/精力）、脚下是什么（一行字，**不是按钮**）、
     * 去哪儿（指路文案）、立城。
     * ============================================================ */
    var hereActs = (GAME.jianghuActsAt ? GAME.jianghuActsAt(P.pos()) : []) || [];
    var hereCell = (SPc() && SPc().cellOf) ? SPc().cellOf(P.pos()) : {};
    var hereName = terrainName((hereCell || {}).type);
    var budget = P.moveBudget();
    var hereLine = '<div style="margin-top:8px;font-size:15px;color:#8a7a5c;">📍 你现在站在「<b style="color:#c9b06a;">'
      + U.escape(hereName) + '</b>」　·　点地图上的格子就走过去（每步 ' + P.stepCost() + ' 精力，还能走 '
      + budget + ' 步）</div>'
      + (hereActs.length
        ? '<div style="margin-top:3px;font-size:15px;color:#c9b06a;">这一格有动静 —— '
          + hereActs.slice(0, 3).map(function (a) {
              var nm = (a.def && a.def.name) || a.name || a.id;
              var k = (a.def && a.def.kind) === 'fight' ? '⚔' : (a.def && a.def.kind) === 'visit' ? '🏡' : '⛏';
              return k + ' ' + U.escape(nm);
            }).join('　')
          + '　·　<b style="color:#ffd9a0;">再点脚下这一格动手</b></div>'
        : '<div style="margin-top:3px;font-size:15px;color:#6f6a60;">脚下是空地（能立城）—— '
          + (function () {
              /* v152c: if a neighbor has something to do, say so (the boss hated "nothing here"). */
              var nb5 = P.neighbors(), best5 = null;
              for (var i5 = 0; i5 < nb5.length && !best5; i5++) if ((nb5[i5].acts || []).length) best5 = nb5[i5];
              return best5
                ? ('<b style="color:#e0c98a;">' + U.escape(best5.dir) + '边上有动静</b> —— 点那一格走过去')
                : '这一带很静 —— 点地图往远处走走';
            })() + '</div>');
    /* 指路：最近的平地（立城）+ 最近的"有动静"格子（破雾之后地图上也会闪光） */
    var nearFlat = P.ready() ? P.nearestBuildable(40) : null;
    var nearAct = null;
    try {
      var ring2 = (SPc() && SPc().hopsWithin) ? SPc().hopsWithin(P.pos(), D().reach || 6) : [];
      for (var ri = 1; ri < ring2.length && !nearAct; ri++) {
        var c3 = ring2[ri];
        if (c3 === P.pos()) continue;
        if ((GAME.jianghuActsAt(c3) || []).length) nearAct = c3;
      }
    } catch (e) { nearAct = null; }
    /* ============================================================
     * v152（实测「精力见底 → 点地图只弹一句'明天再走'，人就卡死了」）
     * 精力耗尽必须给出**下一步**：歇到天亮（快进一游戏日）/ 用一个辐能核心提神。
     * 两条都是"玩家做一次选择"，不是自动帮玩家跳过时间。
     * ============================================================ */
    var lowBlock = '';
    if (budget <= 0) {
      var cores = (GAME.items && GAME.items.count) ? GAME.items.count('lingsui') : 0;
      lowBlock = '<div style="margin-top:7px;padding:7px 9px;border:1px solid #6a4b22;border-radius:5px;'
        + 'background:#221a10;font-size:15px;color:#e8c88a;">精力见底 —— 走不动了。</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;">'
        + '<span class="chip" data-action="prologue-rest" style="cursor:pointer;">🌙 歇到天亮（明天再走）</span>'
        + '<span class="chip' + (cores > 0 ? '' : ' dim') + '" data-action="prologue-tonic"'
        + (cores > 0 ? ' style="cursor:pointer;"' : ' data-why="背包里没有辐能核心（荒野行动 / 斗将会掉）"')
        + '>💊 吃个辐能核心提神（+30 精力 · 现有 ' + cores + '）</span></div>';
    }
    /* v153: legend for the 3D figure */
    var figLine = (GAME.map3d && GAME.map3d.enabled)
      ? '<div style="margin-top:3px;font-size:13px;color:#6f6a60;">🟡 地图上那个小黄人就是你 —— 点旁边的格子，他会走过去</div>'
      : '';
    var hintBlock = '';
    if (P.ready()) {
      var nsTag = nearFlat ? 'now' : 'far';
      hintBlock = (nearFlat
        ? '<div style="margin-top:5px;font-size:15px;color:#c9a86a;">最近的平地（能立城）：<b>'
          + U.escape(nearFlat.dir) + ' ' + nearFlat.dist + ' 格</b> —— 点地图走过去</div>'
        : '<div style="margin-top:5px;font-size:15px;color:#c9a86a;">这一带走很远都没有平地 —— 换个方向</div>');
      /* +B（立城导航）：点地图上的框 = 直接走到那块平地；到了就地立城。
         ⚠️ 这是 HUD 里唯一的"动作"，而且它也是地图坐标 —— 不是换一套操作，
         只是把"哪块能立城"这件事从文字变成可以点的东西。 */
      hintBlock += '<div style="margin-top:6px;display:flex;gap:8px;align-items:center;">'
        + '<span class="chip" data-action="prologue-build-nav" data-ci="' + (nearFlat ? nearFlat.ci : '') + '" data-tag="' + nsTag + '"'
        + ' style="cursor:pointer;">'
        + (nearFlat ? ('🏯 走到平地立城（' + U.escape(nearFlat.dir) + ' ' + nearFlat.dist + ' 步）') : '🌀 换一块地方找平地')
        + '</span>'
        + '<span class="ui-sub" style="font-size:13px;">到了平地，这一格会亮起「立城」</span></div>';
    } else if (nearAct != null) {
      hintBlock = '<div style="margin-top:5px;font-size:15px;color:#8a7a5c;">最近的动静：<b>'
        + U.escape(P.dirNameOf(nearAct)) + '</b>（雾里有东西在动，地图上会亮）</div>';
    }

    return '<div style="pointer-events:auto;background:rgba(13,15,19,.93);border:1px solid #2c3037;'
      + 'border-radius:8px;padding:12px 16px;backdrop-filter:blur(3px);line-height:1.65;'
      + 'box-shadow:0 10px 30px rgba(0,0,0,.55);">'
      /* 一行头：天 / 等级 / 精力 / 已出去几趟 */
      + '<div style="display:flex;align-items:center;gap:12px;font-size:16px;color:#8a7a5c;">'
      + '<span style="letter-spacing:.22em;">第 ' + (day + 1) + ' 天</span>'
      + '<span style="color:#b9b0a0;">君主 <b style="color:#e8e2d4;font-size:16px;">Lv' + lv + '</b> / ' + need + '</span>'
      /* v131：精力必须走 energyNowOf（唯一读出口）——
         直读 `lord.energy` 会把 231 这种超上限的原始值直接印在面板上。 */
      + '<span>精力 <b style="color:#e8e2d4;">' + Math.round(GAME.energyNowOf ? GAME.energyNowOf(lord) : ((lord && lord.energy) || 0))
      + '</b> / ' + Math.round(GAME.energyMaxOf ? GAME.energyMaxOf(lord) : 100) + '</span>'
      + (acts ? '<span>出去 ' + acts + ' 趟</span>' : '')
      + (steps ? '<span>走了 ' + steps + ' 步</span>' : '')
      + '<span style="flex:1;"></span>'
      + '<span style="color:#6f6a60;">' + (day < 10 ? '天还没冷' : '天在变冷') + '</span>'
      + '</div>'
      + '<div style="margin-top:2px;font-size:15px;color:#a89c86;">你们 ' + U.numText(pop, 0)
      + ' 个人，还没有城 —— ' + (day < 10 ? '得找点能打的，先把人练出来。' : '撑到能立城那天。') + '</div>'
      + '<div style="margin-top:6px;height:5px;background:#23262b;border-radius:3px;">'
      + '<div style="height:5px;width:' + pct + '%;background:#c9b06a;border-radius:3px;"></div></div>'
      + tierLine + nextLine
      + hereLine + hintBlock + lowBlock + figLine
      /* v131：原来的「就近清剿 / 就近试炼 / 就近采集」三个按钮撤掉 ——
         它们和「脚下 + 四周」是同一件事的两种说法，而且找不到目标时会印
         「附近没有」，读起来像功能坏了。现在"能做什么"由**站的位置**决定。
         v151：v131 补上的「脚下 + 四周」按钮也撤掉 —— 走路与动手都已回到地图手势上。 */
      + comboLine
      + (last ? '<div style="margin-top:9px;font-size:16px;color:#7d766a;border-top:1px solid #23262b;padding-top:7px;">最近：'
        + U.escape(last) + '</div>' : '')
      + (P.canFound()
        ? '<div style="margin-top:10px;"><span class="chip" data-action="prologue-build">'
          + '立城（Lv' + need + ' 已满 · 脚下是' + U.escape(P.terrainLabel()) + '）</span></div>'
        /* v135：等级够了但脚下不是平地 —— **必须说出来**。
           原来这里直接不渲染按钮，玩家只会觉得"等级够了怎么还是没按钮"。
           实测平原只占 3.7%、开局 4 环内 0 块，所以这句话经常要用到。 */
        : (P.ready()
          ? (function () {
              var near = P.nearestBuildable(40);
              return '<div style="margin-top:10px;font-size:16px;color:#c9a86a;line-height:1.7;">'
                + '脚下是<b>' + U.escape(P.terrainLabel()) + '</b>，立不了城'
                + (near ? '　·　最近的平地：<b>' + U.escape(near.dir) + ' ' + near.dist + ' 格</b>' : '　·　这一带没有平地')
                + '</div>';
            })()
          : ''))
      + '</div>';
  };

  /* 前传层与游戏界面的显隐（幂等：renderView 每次都调） */
  P.syncScreen = function () {
    /* ⚠️ smoke（node）里没有 document —— 不判这一下，renderView 每次都会抛
       ReferenceError，被上层 try/catch 吞掉后**悄悄改变后续用例的状态**
       （实测：改完之后 §98「清掉快照后应 verify=false」就红了）。 */
    if (typeof document === 'undefined' || !document.getElementById) return;
    var el = document.getElementById('prologue-screen');
    /* 前传期要藏起来的四块：顶部 12 个 tab、中央视图、**底部那排地图控件**、
       以及左侧资源栏。第一版漏了 #bottom-bar —— 截图里底下还露着
       「隐藏名称 / 指挥战斗 / 前往 / 回主城…」一整排，白藏了上面两块。 */
    /* v128：还要藏**地图搜索条**（#adm-search：老家 / 选择行省 / 地标高亮 / 定位己方城市…）——
       前传没有城、没有行省可筛，那一排只会让人以为"要先选什么"。
       同时**不再藏 #view-container**：地图要露出来，玩家才知道自己在一片废土上。 */
    var hide = ['topnav', 'bottom-bar', 'adm-search'];
    var i;
    if (!P.on()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      for (i = 0; i < hide.length; i++) {
        var x = document.getElementById(hide[i]);
        if (x) x.style.display = '';
      }
      return;
    }
    for (i = 0; i < hide.length; i++) {
      var y = document.getElementById(hide[i]);
      if (y) y.style.display = 'none';
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'prologue-screen';
      /* ⚠️ v128（审核：老板「前20级竟然只是一个弹窗，你在偷什么懒」）——
         原来是**全屏黑底**（inset:0 + #0b0d10），把地图整块盖住了：
         1440×900 的屏幕中间就一小段文字 + 三个按钮，玩家根本不知道自己在一片废土上。
         现在改成**底部 HUD**：地图全程可见，HUD 只占下方一条，
         且 wrapper 设 pointer-events:none、卡片单独 auto —— 地图仍然可以点。
         藏起来的只剩「顶栏」和「底部那排地图控件」（它们在没城时确实没意义）。 */
      /* ⛔ v130（逐链路核查抓到，v128 引入的回归）：
         v128 把它做成底部 HUD 后仍然 `position:fixed + z-index:70` 且挂在 **body** 上，
         而全站弹窗活在 `#app-scale` 里 —— 那个节点带 `transform:scale()`，是个**独立的层叠上下文**，
         内部 `.modal-mask` 的 `z-index:1000` 只在它自己那一层里有效，对外等于 z=auto。
         结果：前传 HUD（z=70，根栈）**压住整幅画面和所有弹窗**。
         实测：出征面板「🚩 占领」按钮在 (644,747)，被前传卡片盖住，
         `elementFromPoint` 命中的是前传层 → 按钮点不动，出征链**走不到终点**。
         新玩家前 20 级期间会一直碰到（那时前传常驻）。
         修法：挂进 `#app-scale`（与弹窗同一栈），定位改 absolute —— 与 `.modal-mask`
         当年 fixed→absolute 是同一个理由（整幅画面统一缩放，画布是唯一坐标系）。 */
      el.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:14px;'
        + 'z-index:70;width:min(880px,94vw);max-height:50vh;overflow:auto;'
        + 'pointer-events:none;';
      var host = document.getElementById('app-scale') || document.body;
      host.appendChild(el);
    }
    /* v128：起始位置点亮一圈（否则球面全黑 —— 换了皮的黑屏，等于没改）。
       只在**第一次**做：之后玩家自己走出去看到的就是探索成果，不该反复送视野。 */
    try {
      var st = st0();
      if (st && st.prologue && !st.prologue._lit) {
        st.prologue._lit = 1;
        /* v152（老板：「说好未探索区域只要云雾缭绕微暗就行」）——
           开局把脚下这一带**整片点亮**（半径 8 全明）。原来是半径 4 的"半明"
           （只看见地形、不知道上面有什么）→ 周围六格全在雾里，点哪都是
           "没探明"，人一睁眼就寸步难行。现在：脚下亮，远处才是雾。 */
        var fromCi = P.pos();
        if (GAME.fog && GAME.fog.revealAround) {
          GAME.fog.revealAround(fromCi, 3, GAME.fog.ALL);
        }
      }
    } catch (e) { /* 迷雾失败不该挡住界面 */ }
    /* ============================================================
     * v131：**镜头跟着人**。
     * ------------------------------------------------------------
     * 前传是"君主作为个人冒险者在大地图上游玩"，可相机默认在整星总览
     * （`camO.dist = R*8`）—— 玩家点亮的那 radius 4 在整颗球上就是一个小点，
     * 截图里看着就是"全黑"。个人冒险必须**贴脸看脚下**：
     * 位置一变就把镜头对准并拉到最近（`ZOOM_MIN = R*1.2`）。
     * 只在"位置真的变了"时做（`_camCi` 比对），否则每帧重置会抢玩家的拖动。
     * ============================================================ */
    try {
      var st2 = st0(), M3 = GAME.map3d;
      /* v152c：**首帧之前**就把相机压到近地 —— 否则第一帧按默认 camO（总览）画出去，
         之后再 focusOnCell 也只是重绘，玩家看到的还是"远处一颗球"。
         放在"是否换格"的判断**外面**：每次进前传都确保贴着地。 */
      if (st2 && st2.prologue && M3 && M3.focusOnCell && st2.prologue._camCi == null) {
        st2.prologue._camCi = -1;   /* 强制下一段走一次 focus */
      }
      if (st2 && st2.prologue && M3 && M3.centerOn) {
        var pos2 = P.pos();
        if (st2.prologue._camCi !== pos2) {
          st2.prologue._camCi = pos2;
          /* v152：贴地跟随 —— 相机对准**脚下这一格**并压到近地（focusOnCell）。
             不再走 centerOn（那会把距离设成 R*1.9 的中景，一格只有几个像素）。 */
          if (M3.focusOnCell) M3.focusOnCell(pos2);
          else {
            var cell2 = (SP() && SP().cellOf) ? SP().cellOf(pos2) : null;
            if (cell2 && cell2.lon != null) {
              var xy2 = SP().xyOfLonLat(cell2.lon, cell2.lat);
              M3.centerOn(xy2.x, xy2.y);
              if (M3.setZoom) M3.setZoom(0);
            }
          }
        }
      }
    } catch (e) { /* 相机失败不该挡住界面 */ }
    /* v151：地图就是本体 —— 视图切换由进游戏那条路（ui.js 开局 setView）负责，
       这里**不再每次刷新都强制 setView**（那会让 smoke §340② 的 refreshAll 变慢一倍）。 */
    el.innerHTML = P.screenHTML();

    /* ============================================================
     * v151-a（老板：「点地图 = 走路」，靠键盘也能闭环）
     * ------------------------------------------------------------
     * 世界坐标里的"点哪走哪"要求玩家看得懂 3D/2D 投影 —— 屏读器、无鼠标、
     * 以及 e2e（jsdom 没有 WebGL / 布局）拿不到这层手势。这里补一条**同构入口**：
     *   方向键 / WASD → 走一格；E → 对脚下这一格动手；B → 立城。
     * 它走的是**同一套** P.moveTo / ui.openPrologueLand / P.build ——
     * 不是第二个玩法，只是同一手势的另一种输入。⚠️ 只在 document 上挂一次。
     * ============================================================ */
    if (!P._keyBound && document.addEventListener) {
      P._keyBound = 1;
      document.addEventListener('keydown', function (ev) {
        try {
          if (!P.on()) return;
          var tag = (ev.target && ev.target.tagName) || '';
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
          var k = String(ev.key || '').toLowerCase();
          /* v92.247：方向键 = **绕星球南北极的方位**（上=北 下=南 左=西 右=东）。
             旧写法按方位**名**匹配（"东北"同时含北与东 → 上/右抢同一格），
             匹配不到还会回落 `nbs[0]`（排序后的第一个）—— 按左键却往北走，就是"乱走"。
             现在按切平面方位角取最小夹角，极区也成立；真的没有邻格就不动。 */
          var spK = SP();
          var wantB = (spK && spK.KEY_BEARING) ? spK.KEY_BEARING[k] : undefined;
          if (wantB != null) {
            var nbs = P.neighbors();
            var from = P.pos();
            var best = null, bestDiff = 1e9;
            nbs.forEach(function (n) {
              var deg = (spK && spK.bearingOf) ? spK.bearingOf(from, n.ci) : null;
              if (deg == null) return;
              var diff = Math.abs(((deg - wantB + 540) % 360) - 180);
              if (diff < bestDiff) { bestDiff = diff; best = n; }
            });
            if (best) {
              var mr = P.moveTo(best.ci);
              if (mr.msg && GAME.ui && GAME.ui.toast) GAME.ui.toast(mr.msg);
              if (GAME.refreshAll) GAME.refreshAll();
            } else if (GAME.ui && GAME.ui.toast) {
              GAME.ui.toast('这边没有能落脚的地方');
            }
            ev.preventDefault();
            return;
          }
          if (k === 'e' || k === 'enter') {
            if (GAME.ui && GAME.ui.openPrologueLand) GAME.ui.openPrologueLand(P.pos());
            ev.preventDefault();
          } else if (k === 'b') {
            if (P.canFound && P.canFound()) {
              var rb = P.build();
              if (rb && rb.msg && GAME.ui && GAME.ui.toast) GAME.ui.toast(rb.msg);
              if (GAME.refreshAll) GAME.refreshAll();
              ev.preventDefault();
            }
          }
        } catch (e) { /* 键盘失败不该挡住界面 */ }
      });
    }
  };

  /* ============================================================
   * v151：**地图上就地动手**（老板：「点那个敌人 → 打几个回合」）
   * ------------------------------------------------------------
   * 入口只有两个，都在地图手势上：
   *   · 点**脚下**这一格（有动静）→ 就地弹动手面板（`ui.openLandModalCi`）
   *   · 手动点「⚔ 斗将」/ 有回合的打斗走 `P.duelAct`（回合制）
   * 一次性结算（采集/静修/拜访）仍走 `P.act` —— 与以前同一出口，只是入口换到地图。
   * ============================================================ */
  P.mapClick = function (ci) {
    if (!P.on()) return { ok: false, msg: '' };
    if (ci == null || ci < 0) return { ok: false, msg: '' };
    var pos = P.pos();
    /* 脚下这一格：直接开"动手"面板（面板里的按钮说的就是这一格能做什么） */
    if (ci === pos) {
      if (!(GAME.jianghuActsAt ? GAME.jianghuActsAt(ci) : []).length) return { ok: false, msg: '这儿没什么可做的 —— 往别处走走' };
      if (GAME.ui && GAME.ui.openLandModalCi) { GAME.ui.openLandModalCi(ci); return { ok: true, here: true }; }
      return { ok: false, msg: '动手面板没加载' };
    }
    var r = P.walkTo(ci);
    if (!r.ok) return r;
    if (GAME.refreshAll) GAME.refreshAll();
    /* 走到了一个"有动静"的新格子：立刻把动手面板摆出来（少一次点击就是一次闭环） */
    if (r.arrived && (GAME.jianghuActsAt ? GAME.jianghuActsAt(ci) : []).length && GAME.ui && GAME.ui.openLandModalCi) {
      GAME.ui.openLandModalCi(ci);
    }
    return r;
  };

/* ============================================================
 * v100 注册表（可插拔）：界面块 + 动作都从模块自己声明
 * ctx = { sec, U, cities, c0, toast, refresh }
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'prologue',
    order: 5,
    tick: function () { P.tick(); },
    panel: function (ctx) {
      /* ⚠️ sec 是 ui.js 的局部函数 —— 模块里必须从 ctx 取 */
      var sec = ctx.sec;
      if (!P.on()) return '';
      var lord = P.lord();
      var lv = P.lv(), need = P.needLv();
      /* v131：精力走唯一读出口（直读 lord.energy 会把超上限的原始值印出来） */
      var en = Math.round(GAME.energyNowOf ? GAME.energyNowOf(lord) : ((lord && lord.energy) || 0));
      var enMax = (lord && GAME.energyMaxOf) ? Math.round(GAME.energyMaxOf(lord)) : 100;
      var spots = P.spots();

      var head = '<div style="margin-top:2px;">你们还没有城 —— 君主 <b>Lv' + lv + '</b> / '
        + need + '　精力 ' + en + ' / ' + enMax + '</div>';

      var listH = '';
      if (!spots.length) {
        listH = '<div class="ui-sub" style="margin-top:4px;">附近没找到能下手的地方 —— 换个位置，或者等明天。</div>';
      } else {
        listH = '<div class="ui-sub" style="margin-top:5px;">附近可去：</div>'
          + spots.map(function (sp) {
            var tn = (GAME.DATA.TERRAIN[sp.type] || {}).name || sp.type;
            var chips = sp.acts.map(function (a) {
              return '<span class="chip" data-action="prologue-act" data-ci="' + sp.ci
                + '" data-act="' + U.escape(a.id) + '">' + U.escape(a.def.name)
                + '（精' + a.def.energy + ' 体' + a.def.stam + '）</span>';
            }).join('');
            return '<div style="margin-top:3px;">' + sp.dist + ' 格 · ' + U.escape(tn) + '　' + chips + '</div>';
          }).join('');
      }

      var buildH = '';
      if (P.canFound()) {
        buildH = '<div class="chips" style="margin-top:6px;">'
          + '<span class="chip" data-action="prologue-build">立城（Lv' + need + ' 已满 · 脚下是'
          + U.escape(P.terrainLabel()) + '）</span></div>';
      } else if (P.ready()) {
        var _near = P.nearestBuildable(40);
        buildH = '<div style="margin-top:6px;font-size:12px;color:#c9a86a;line-height:1.7;">'
          + '脚下是<b>' + U.escape(P.terrainLabel()) + '</b>，立不了城'
          + (_near ? '　·　最近的平地：<b>' + U.escape(_near.dir) + ' ' + _near.dist + ' 格</b>'
            : '　·　这一带没有平地') + '</div>';
      }

      return sec('🕯 还没有城', '第 ' + dayNow() + ' 天 · 走到哪儿算哪儿',
        head + listH + buildH
        + '<div class="ui-sub" style="margin-top:5px;">'
        + '前传期间城不产东西、不能建、不能招兵 —— 你带的是一队人，不是一座城。'
        + '君主升到 Lv' + need + ' 才能立城。</div>');
    },
    actions: {
      /* v151：走到有动静的格子 → 直接开这一格的动手面板。
         入口在地图手势上（点地图），面板只是"这一格能做什么"的唯一呈现。 */
      'prologue-spot': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        if (GAME.ui && GAME.ui.openLandModalCi && ci >= 0) GAME.ui.openLandModalCi(ci);
      },
      /* ⛔ v131（真点抓到，极隐蔽）：这里的 `ctx.refresh` **不能信**。
         `ctx` 是派发方临时拼的对象，而"世界的账本"面板把自己的
         `refresh: function () { ui.openWorldPanel(); ... }` 也塞进了同一个名字。
         结果：前传里每走一步，`ctx.refresh()` 就把世界账本弹出来盖住 HUD
         （实测调用链：openWorldPanel ← Object.refresh ← prologue-move）。
         这里统一改成**直接调刷新出口**，不依赖 ctx 的来源。 */
      /* v140：走进场景（2.5D）。真正的结算仍在场景里调 P.act，不另开一套。 */
      'prologue-scene': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var act = el.getAttribute('data-act');
        if (!GAME.scene3d || !GAME.scene3d.play) { ctx.toast('场景系统没加载'); return; }
        var rr = GAME.scene3d.play(act, ci);
        if (!rr || !rr.ok) ctx.toast((rr && rr.msg) || '场景没打开');
      },
      'prologue-act': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var act = el.getAttribute('data-act');
        var r = P.act(ci, act);
        ctx.toast(r.msg);
        if (GAME.refreshAll) GAME.refreshAll();
      },
      /* v151：打斗给回合 —— 先扣费、开竞技场，再由面板逐合出招（mode:'act'） */
      'prologue-fight': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var act = el.getAttribute('data-act');
        var r = P.duelAct(ci, act);
        ctx.toast(r.msg);
        if (r.ok && GAME.ui && GAME.ui.openDuelPanel) GAME.ui.openDuelPanel();
        else if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-fight-hit': function (el, ctx) {
        var mv = el.getAttribute('data-mv');
        var r = P.duelActStep(mv);
        if (r.msg) ctx.toast(r.msg);
        if (GAME.ui && GAME.ui.openDuelPanel) GAME.ui.openDuelPanel();
        else if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-fight-flee': function (el, ctx) {
        var r = P.duelActFlee();
        if (r.msg) ctx.toast(r.msg);
        if (GAME.ui && GAME.ui.closeModal) GAME.ui.closeModal();
        if (GAME.ui && GAME.ui.openLandModalCi) GAME.ui.openLandModalCi(Number(el.getAttribute('data-ci')));
        if (GAME.refreshAll) GAME.refreshAll();
      },
      /* v132：点名斗将 */
      'prologue-duel': function (el, ctx) {
        var r = P.duelStart();
        ctx.toast(r.msg);
        if (r.ok && GAME.ui && GAME.ui.openDuelPanel) GAME.ui.openDuelPanel();
        else if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-duel-hit': function (el, ctx) {
        var mv = el.getAttribute('data-mv');
        var r = P.duelStep(mv);
        if (r.msg) ctx.toast(r.msg);
        if (GAME.ui && GAME.ui.openDuelPanel) GAME.ui.openDuelPanel();
        else if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-duel-close': function (el, ctx) {
        P.duelClear();
        if (GAME.ui && GAME.ui.closeModal) GAME.ui.closeModal();
        if (GAME.refreshAll) GAME.refreshAll();
      },
      /* v131：走一格（营地视图 / 前传面板共用同一动作） */
      'prologue-move': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var r = P.moveTo(ci);
        ctx.toast(r.msg);
        if (GAME.refreshAll) GAME.refreshAll();
      },
      /* v151：立城导航 —— 点 HUD 的"走到平地立城"= 走到那块平地；到了再点一次就立城。
         `data-tag='far'` 表示这一带找不到平地 → 换个方向走两步再找。 */
      'prologue-build-nav': function (el, ctx) {
        var tag = el.getAttribute('data-tag');
        var ci = Number(el.getAttribute('data-ci'));
        if (tag === 'now' && ci >= 0) {
          var r = P.mapClick(ci);
          if (r && r.msg) ctx.toast(r.msg);
          /* 到了平地且等级够 → 直接把"立城"摆到眼前（不多走一次菜单） */
          if (P.canFound()) {
            var rb = P.build();
            ctx.toast(rb.msg || '立城了');
          }
        } else {
          var nb = P.nearestBuildable ? P.nearestBuildable(60) : null;
          if (nb) {
            var rr = P.walkTo(nb.ci);
            if (rr && rr.msg) ctx.toast(rr.msg);
          } else {
            var ring3 = (SPc() && SPc().hopsWithin) ? SPc().hopsWithin(P.pos(), 4) : [];
            if (ring3.length > 1) P.moveTo(ring3[ring3.length - 1]);
            ctx.toast('这一带没有平地 —— 往别处走几步再找');
          }
        }
        if (GAME.refreshAll) GAME.refreshAll();
      },
      /* v152：精力见底的两个出口（HUD 上真正点得到的下一步） */
      'prologue-rest': function (el, ctx) {
        var s2 = st0();
        if (!s2) return;
        /* v152c: dayNow = elapsed / 86400 -> must advance by 86400 (not secPerYear/360). */
        var perDay = 86400;
        var day = dayNow();
        s2.world = s2.world || {};
        s2.world.elapsed = (day + 1) * perDay + 1;
        if (P.tick) P.tick();
        ctx.toast('睡了一夜 —— 精力与体力都回了一些');
        if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-tonic': function (el, ctx) {
        var lord2 = P.lord();
        if (!lord2 || !GAME.items) return;
        if ((GAME.items.count('lingsui') | 0) <= 0) { ctx.toast('背包里没有辐能核心'); return; }
        GAME.items.sub('lingsui', 1);
        if (GAME.setEnergyNow) GAME.setEnergyNow(lord2, Math.min(GAME.energyMaxOf(lord2), GAME.energyNowOf(lord2) + 30));
        ctx.toast('嚼碎一枚辐能核心 —— 精力 +30');
        if (GAME.refreshAll) GAME.refreshAll();
      },
      'prologue-build': function (el, ctx) {
        var r = P.build();
        ctx.toast(r.msg);
        if (GAME.refreshAll) GAME.refreshAll();
      }
    }
  });
}

})();
