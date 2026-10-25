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
     * v131：出生格若荒僻，就近挪一格**有事的**。
     * ------------------------------------------------------------
     * `jianghuActsAt` 对每格有 30% 概率返回空（`DATA.JH_SPREAD.noneP`）——
     * 那是"地块探索"该有的不确定性，但**第一格**不能是空的：
     * 玩家一睁眼看到"脚下没事、四周没动静"，只会以为自己玩不了。
     * 只挪出生点、不改判据：荒僻格仍然是荒僻格，走两步就能遇到。
     * ============================================================ */
    try {
      /* ------------------------------------------------------------
       * v135（老板：「立城为什么在水里」）——出生点必须**靠得近平地**。
       * 实测：`DATA.TERRAIN` 里只有 `plain` 是可建地形，而它只占 3.7~8.2%；
       * 5 个 seed 的出生点到最近平地分别是 **23 / 32 / 36 / 28 / 36 格**。
       * 也就是说：按"只能在平地立城"这条规则，玩家开局要先蒙头走三十步
       * 才可能见到第一块能立城的地 —— 这比"城立在水里"更难接受。
       * 所以出生点改口径：**先保证 2 环内有平地**，再在其中挑"有事的格子"。
       * 找不到就把出生点直接放到最近的平地上（前传本来就是"流浪到这里"）。
       * ------------------------------------------------------------ */
      /* ⚠️ 两个目标会打架，优先级必须是**先脚下有事**：
           ① 站平地 → 能立城，但实测"可做 0 件"（平原本来就不能采集，
              §333③ 当场照出"可走 6 格 · 可做 0 件"）→ 玩家一睁眼无事可做；
           ② 站有事的地 → 能玩，但要走三十步才见到平地。
         所以口径定为：**脚下必须有事，平地放在 4 环内**（走四步就能立城）。
         先在有事的格里挑，挑不到才退回平地（那种情况下玩家至少能立刻立城）。 */
      /* ⚠️ 顺序必须是"**先找平地、再在它周围挑有事的格**"。
         反过来（先在本地点附近找"旁边有平地"的格）测过：平原稀疏、常在 20 格外，
         5 环内一个候选都没有 → 又退回平地 → 平原不能采集 → "可做 0 件"。
         现在：取最近的平地 → 在它 4 环内挑脚下有事的格 → 站那儿。
         这样"脚下有事"和"四步内能立城"同时成立。 */
      var RING_PLAIN = 4;
      var actsHere = (GAME.jianghuActsAt ? GAME.jianghuActsAt(pos) : []) || [];
      var nearPlain = P.nearestBuildableN ? P.nearestBuildableN(pos, RING_PLAIN) : null;
      /* ⛔ v139（实战暴露的判据错误）：进入搬迁的条件**只能是"脚下没事"**。
         原来写的是 `(!nearPlain || !actsHere.length)` —— 于是"脚下明明有采集/清剿、
         只是 4 环内没有平地"也会触发搬迁，最后还可能被挪到一块**没动作的平地**上
         （`cand` 为空时的退路），开局第一屏就成了「可做 0 件」（§333③ 红）。
         "4 环内有平地"是**选址偏好**，不是搬迁理由 —— 玩家可以先在原地做事，
         立城时 HUD 会告诉他最近平地在哪个方向。 */
      if (sp && sp.hopsWithin && GAME.jianghuActsAt && !actsHere.length) {
        /* ① 先定位最近的平地（用当前 pos 作起点，半径给足） */
        var far = P.nearestBuildable ? P.nearestBuildable(40) : null;
        var base = far ? far.ci : pos;
        /* ② 在平地 4 环内挑"脚下有事"的格（含平地自己：它虽然不能采集，
              但可能出"静修/斗将"这类动作） */
        var cand = [], ring = sp.hopsWithin(base, RING_PLAIN), i;
        for (i = 0; i < ring.length; i++) {
          var c2 = ring[i];
          if (!GAME.jianghuActsAt(c2).length) continue;
          cand.push(c2);
        }
        if (cand.length) {
          pos = cand[0];
        } else if (far) {
          pos = far.ci;                                        /* 退路：站到平地上 */
        }
      }
      /* ⛔ v139：**最后一道兜底 —— 脚下必须有可做的事**。
         `jianghuActsAt` 对每格有 30% 概率返回空；上面那条"退路：站到平地上"
         可能正好落进一个荒僻的平原（平原本来还不能采集）——
         实测开局第一屏"可走 6 格 · 可做 0 件"，玩家一睁眼无事可做（§333③ 当场红）。
         这里在 4 环内再找一次"有事的格"，只改起点、不动任何判据。 */

    } catch (e) { /* 找落脚点失败就用原位 */ }
    /* ============================================================
     * v139：**最后一道兜底（无条件）** —— 出生点不许在水里，也不许脚下没事。
     * ------------------------------------------------------------
     * 上面的选址逻辑有多个分支，实测仍有漏网（SEED 61024：pos 落在 lake 上、
     * `jianghuActsAt` 返回 0 → 开局第一屏「可做 0 件」）。
     * 这里不再依赖那些分支：只看**最终结果的成色**，不合格就重新挑一次。
     * 顺序：最近的平地 → 平地 4 环内"动作最多"的格（那是玩家真正能开工的地方）。
     * ============================================================ */
    try {
      var _t1 = P.cellTypeOf(pos);
      var _a1 = (GAME.jianghuActsAt ? GAME.jianghuActsAt(pos) : []) || [];
      var _isWater = (_t1 === 'lake' || _t1 === 'zhaoze');
      if ((_isWater || !_a1.length) && sp && sp.hopsWithin && GAME.jianghuActsAt) {
        var _f1 = P.nearestBuildable ? P.nearestBuildable(60) : null;
        /* 找不到"平地"时至少找一块**陆地**（大洋中央也要能上岸）——
           实测随机 seed 下会出现"60 环内没有平原"的极端情况，
           而玩家掉在水里比"离平地远一点"糟得多。 */
        if (!_f1) {
          var _land = -1;
          var _rl = sp.hopsWithin(pos, 30) || [];
          for (var _li = 0; _li < _rl.length && _land < 0; _li++) {
            var _lt = P.cellTypeOf(_rl[_li]);
            if (_lt && _lt !== 'lake' && _lt !== 'zhaoze') _land = _rl[_li];
          }
          if (_land >= 0) _f1 = { ci: _land };
        }
        if (_f1) {
          /* 在平地 4 环内挑动作最多的格；一个都没有就站平地本身 */
          var _best = -1, _bestN = 0;
          var _r1 = sp.hopsWithin(_f1.ci, 4) || [];
          for (var _i1 = 0; _i1 < _r1.length; _i1++) {
            var _n1 = (GAME.jianghuActsAt(_r1[_i1]) || []).length;
            if (_n1 > _bestN) { _bestN = _n1; _best = _r1[_i1]; }
          }
          pos = (_best >= 0) ? _best : _f1.ci;
        }
      }
    } catch (e) { /* 兜底失败就让 pos 保持原样，不挡住开局 */ }
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
    var dirName = function (nc) {
      if (!nc || pc.lon == null || nc.lon == null) return '';
      var dLon = ((nc.lon - pc.lon + 540) % 360) - 180;
      var dLat = nc.lat - pc.lat;
      var ew = dLon > 0 ? '东' : (dLon < 0 ? '西' : '');
      var ns = dLat > 0 ? '北' : (dLat < 0 ? '南' : '');
      if (!ns) return ew || '东';
      if (!ew) return ns;
      /* 纬度差小、经度差大 → 偏东西；反之偏南北 */
      return (Math.abs(dLat) < Math.abs(dLon) * 0.45) ? ew : (ns + ew);
    };
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (ci === pos) continue;
      var cell = sp.cellOf(ci) || {};
      var acts = (GAME.jianghuActsAt ? GAME.jianghuActsAt(ci) : []) || [];
      out.push({ ci: ci, type: cell.type, acts: acts, dir: dirName(cell), here: false });
    }
    /* 按方位排一下（东→东北→北→西北→西→西南→南→东南），读起来有顺序 */
    var ORDER = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    out.sort(function (a, b) { return ORDER.indexOf(a.dir) - ORDER.indexOf(b.dir); });
    return out;
  };

  /* 走一步。只有一件事需要判断：是不是相邻、精力够不够。
     **不掷骰、不判定** —— 走到哪儿是玩家的选择，能做什么由那格自己决定。 */
  P.moveTo = function (ci) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var s = st0(), sp = SP();
    if (!s) return { ok: false, msg: '没有对局' };
    var pos = P.pos(), adj = sp.hopsWithin(pos, 1), ok = false;
    for (var i = 0; i < adj.length; i++) if (adj[i] === ci) ok = true;
    if (!ok) return { ok: false, msg: '只能走到相邻的格子' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    var cost = D().stepEnergy || 1;
    var en = (GAME.energyNowOf ? GAME.energyNowOf(lord) : 100);
    if (en < cost) return { ok: false, msg: '精力见底了 —— 明天再走' };
    if (GAME.setEnergyNow) GAME.setEnergyNow(lord, en - cost);
    s.prologue.pos = ci;
    s.prologue.steps = (s.prologue.steps | 0) + 1;
    /* 站到哪儿就看到哪儿周围一圈（比"探索"窄 —— 走一趟不等于勘察） */
    try {
      if (GAME.fog && GAME.fog.revealAround) GAME.fog.revealAround(ci, 2, GAME.fog.ALL);
    } catch (e) { /* 迷雾失败不该挡住移动 */ }
    var cell = sp.cellOf(ci) || {};
    var tn = ((GAME.DATA || {}).TERRAIN || {})[cell.type] || {};
    return { ok: true, msg: '走到' + (tn.name || '荒野') + '了 —— 看看这地方能做什么', ci: ci };
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
     同样的出招会得到不同结果，斗将就不成立了。 */
  P.duelFoe = function (ci) {
    var myLv = P.lv();
    var cap = Math.max(10, Math.round(myLv * 1.5 + 10));
    var d = GAME.wildDefenseAt ? GAME.wildDefenseAt(ci) : null;
    if (d && d.gen && (d.gen.level | 0) <= cap) return d.gen;
    var glv = Math.max(5, Math.min(cap, (d && d.gen && (d.gen.level | 0)) || cap));
    var rnd = GAME.utils.rng(((ci | 0) * 2654435761) >>> 0);
    /* v136（老板：「名为斗将，实际上对面可以为生化兽等各种废土物种」）：
       从 `DATA.DUEL_FOES` 抽一个物种 —— 按 ci 确定性抽，同一格永远同一个对手。 */
    var LIST = (GAME.DATA && GAME.DATA.DUEL_FOES) || [];
    var sp0 = LIST.length ? LIST[Math.floor(rnd() * LIST.length) % LIST.length] : null;
    var foeName = sp0 ? sp0.name : '游荡者';
    var g = GAME.makeGeneral(foeName, glv, 'guard', null, false, null, 'balance', rnd);
    /* ⛔ **对手的 id 必须确定**（v132 实测踩到的坑）：
       `duelEnemyMove` 的出招种子是 `'duelm|' + defGen.id + '|' + round + '|' + seed`。
       而 `makeGeneral` 每调一次就自增一个新 id —— 于是每合重算前 N 合时，
       "对手"其实换了一个人，招式序列全变，**比分当场倒退**
       （实测：第 2 合 2:0 → 第 3 合 0:1）。
       固定成 `duelfoe_<ci>` 之后，同一格同一 seed 的对手永远同一个人。 */
    g.id = 'duelfoe_' + (ci | 0);
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
  P.duelStart = function () {
    if (!P.on()) return { ok: false, msg: '已经立城了' };
    var s = st0(), lord = P.lord();
    if (!s || !lord) return { ok: false, msg: '没有君主' };
    if (!GAME.battle || !GAME.battle.duelPlay) return { ok: false, msg: '斗将内核缺失' };
    var ci = P.pos();
    if (!P.duelReady(ci)) return { ok: false, msg: '这地方没人应战 —— 先找有仗可打的格子' };
    var n = P.duelOf();
    if (n && !n.done) return { ok: false, msg: '正打着呢' };
    var cost = (D().duelEnergy == null ? 2 : D().duelEnergy);
    var en = GAME.energyNowOf ? GAME.energyNowOf(lord) : 100;
    if (en < cost) return { ok: false, msg: '精力不够，叫不动阵' };
    if (GAME.setEnergyNow) GAME.setEnergyNow(lord, en - cost);
    var foe = P.duelFoe(ci);
    s.prologue.duel = {
      ci: ci, seed: 20261024 + (s.prologue.acts | 0),   /* 固定 seed：同出招同结果 */
      moves: [], rows: [], wa: 0, wb: 0, done: false, winner: null,
      /* v136：**血量与出手次数**（老板：「每回合出手初始为各 1 次，
         后续开发武技可能有不同的出手特征」）—— 出手次数做成数据，
         将来武技改这里就行，不用动判定。 */
      hpA: 100, hpB: 100,
      atkPerTurn: { a: 1, b: 1 },
      foe: { name: foe.name, level: foe.level | 0,
        tong: foe.tong | 0, yw: foe.yw | 0, zm: foe.zm | 0, nz: foe.nz | 0,
        icon: (foe.species && foe.species.icon) || '👤',
        tag: (foe.species && foe.species.tag) || '',
        desc: (foe.species && foe.species.desc) || '',
        speciesId: (foe.species && foe.species.id) || '' },
    };
    return { ok: true, msg: foe.name + '（Lv' + (foe.level | 0) + '）应战 —— 出招吧' };
  };

  /* 出一招。返回这一合的结果；打完就结算。 */
  P.duelStep = function (moveId) {
    var s = st0(), lord = P.lord(), d = P.duelOf();
    if (!s || !lord || !d || d.done) return { ok: false, msg: '现在没有在打的斗将' };
    var MV = (GAME.DATA && GAME.DATA.DUEL && GAME.DATA.DUEL.moves) || {};
    if (!MV[moveId]) return { ok: false, msg: '没有这一招' };
    var DU = (GAME.DATA && GAME.DATA.DUEL) || {};
    var maxR = DU.playRounds || 5, need = DU.winScore || 3;
    d.moves.push(moveId);
    var foe = P.duelFoe(d.ci);
    var r = GAME.battle.duelPlay(lord, foe, d.moves, d.seed);
    if (!r) return { ok: false, msg: '这一合没判出来' };
    var row = r.rows[r.rows.length - 1];
    /* v136：血量与伤害。
       ⚠️ **HP 必须由比分派生**，不能自己独立扣 ——
       第一版按"每得一分扣 33 血、暴击 ×1.5 扣 50"独立算，
       实测出现「我 0 血了但比分才 0:2，还能继续打第 3、4 合」：
       因为胜负看的是 `duelPlay` 的 3 分制，HP 却是另一本账。
       现在 hp = 100 × (need − 对方得分) / need，永远和比分同步；
       伤害 = 这一合 HP 的**真实差值**（暴击只标"克招"，不再偷偷加数值）。 */
    var _MV2 = (GAME.DATA && GAME.DATA.DUEL && GAME.DATA.DUEL.moves) || {};
    var _need2 = DU.winScore || 3;
    var _prevA = 100 - Math.round(100 * (d.wb | 0) / _need2);
    var _prevB = 100 - Math.round(100 * (d.wa | 0) / _need2);
    var critA = !!(_MV2[row.a] && _MV2[row.a].beats === row.b);
    var critB = !!(_MV2[row.b] && _MV2[row.b].beats === row.a);
    d.wa = r.wa; d.wb = r.wb;
    d.hpA = 100 - Math.round(100 * (d.wb | 0) / _need2);
    d.hpB = 100 - Math.round(100 * (d.wa | 0) / _need2);
    var dmg = 0, dmgTo = '';
    if (row.res === 'a') { dmg = Math.max(0, _prevB - d.hpB); dmgTo = 'B'; }
    else if (row.res === 'b') { dmg = Math.max(0, _prevA - d.hpA); dmgTo = 'A'; }
    d.rows.push({ a: row.a, b: row.b, res: row.res, aName: row.aName, bName: row.bName,
      dmg: dmg, to: dmgTo, crit: (row.res === 'a' ? critA : (row.res === 'b' ? critB : false)) });
    var over = (d.moves.length >= maxR) || r.wa >= need || r.wb >= need;
    var out = { ok: true, row: row, wa: d.wa, wb: d.wb, done: false, msg: '' };
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
        txt = '斗将胜 ' + d.wa + ':' + d.wb + ' —— 这片的头目服了';
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
        txt = '斗将负 ' + d.wa + ':' + d.wb + ' —— 被打退了';
        /* 输的代价：体力与精力（比全军覆没轻得多，但真的疼） */
        try {
          if (GAME.setStaNow) GAME.setStaNow(lord, Math.max(0, GAME.staNow(lord) - 25));
          if (GAME.setEnergyNow) GAME.setEnergyNow(lord, Math.max(0, GAME.energyNowOf(lord) - 15));
        } catch (e) {}
      } else {
        gain = Math.round(foeLv * 15);
        txt = '斗将平 ' + d.wa + ':' + d.wb + ' —— 谁也没服谁';
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
      out.msg = '第 ' + d.moves.length + ' 合：' + row.aName + ' 对 ' + row.bName + '　'
        + (row.res === 'a' ? '占先' : row.res === 'b' ? '吃亏' : '相持');
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
  P.act = function (ci, actId) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    if (!GAME.jianghuDo || !GAME.jianghuCheck || !GAME.jianghuRoll) {
      return { ok: false, msg: '荒野行动内核缺失' };
    }
    /* 前传期**不锁日**：野外就在脚下，翻过一遍还能再翻。
       正式阶段的"此地今日已做过"是防止在城里刷行动，前传没有这个场景；
       真正的限制是精力与体力（有限资源才有取舍）。 */
    var s0 = st0();
    if (s0 && s0.jianghu) delete s0.jianghu['c' + ci + '|' + actId];
    /* 走的是**同一套内核**（check → spend → roll），只是把 `jianghuDo` 的三合一
       拆开，好把前传的两把倍率传进去。不另写判定 —— 那是第二个引擎。 */
    /* 连战不耗精力（它是上一场"顺下来"的），普通行动才走 check/spend */
    var combo = P.comboOf();
    var isCombo = !!(combo && combo.ci === ci && combo.act === actId);
    if (!isCombo) {
      var chk = GAME.jianghuCheck(ci, lord.id, actId);
      if (!chk.ok) return chk;
      GAME.jianghuSpend(chk);
    } else {
      var chk2 = GAME.jianghuCheck(ci, lord.id, actId);
      /* check 只是为了拿到 roll 需要的结构；连战不扣费，所以失败也能继续打 */
      if (!chk2.ok) return chk2;
      var chk = chk2;
    }
    var d = D();
    var tier = P.tier();
    var def = (GAME.DATA.LING_ACT || {})[actId];
    var bakPow = def ? def.power : null;
    /* v132：**斗将赢了，这一格的头目服了** —— 之后 3 次战斗类动作难度 −40%。
       这是斗将真正的存在理由：经验远不如清剿（几百 vs 四千），
       但"打不过的时候先把头目挑下来"是一条真的出路。
       用现成的 `def.power` 临时缩放（同一套倍率机制，P.act 本来就在用它）。
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
      r = GAME.jianghuRoll(chk, { pow: d.powMul || 1 });
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

    /* v131：`spotRows`（v128 的"附近可去"列表）退役 —— 现在走「脚下 + 四周」。 */
    /* 地形名：面板与营地视图都要用（删 spotRows 时被一起带走，这里补回）。 */
    var terrainName = function (t) {
      return ((GAME.DATA.TERRAIN || {})[t] || {}).name || t || '荒野';
    };

    /* ============================================================
     * v131（老板：「君主作为个人冒险者在大地图进行游玩」）
     * ------------------------------------------------------------
     * 从"面板上挑一个地方跳过去"改成**人在地图上走**：
     *   · 脚下 —— 我站的这一格能做什么（探索/采集/斗将，走同一个 jianghuActsAt）
     *   · 四周 —— 六个邻格，点一下就走过去（`P.moveTo`，耗 1 精力）
     * 这才有"地块探索"：走到哪、看到哪、能做什么，都由**站的位置**决定。
     * ============================================================ */
    var hereActs = (GAME.jianghuActsAt ? GAME.jianghuActsAt(P.pos()) : []) || [];
    var hereBlock = '<div style="margin-top:8px;font-size:12px;color:#8a7a5c;">📍 你站在这里 · ' +
      U.escape(terrainName((SP() && SP().cellOf && SP().cellOf(P.pos()) || {}).type)) + '）</div>'
      + (hereActs.length
        /* v140（老板：「目前前20级还是 PPT，这不是个正经游戏」）：
           主按钮**走进场景**（`prologue-scene`）—— 进到那片废墟/林地/湖边，
           自己走、走到东西旁边动手。真正的结算仍走 `P.act`（唯一出口）。
           另留一个「就地解决」（`prologue-act`）给不想走的人：
           不是所有人都想每次都进去走一趟，但默认是走进去。 */
        ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' + hereActs.map(function (a, ai) {
            var nm = (a.def && a.def.name) || a.name || a.id;
            var kindTxt = (a.def && a.def.kind) === 'fight' ? '⚔' : (a.def && a.def.kind) === 'visit' ? '🏡' : '⛏';
            return '<span data-action="prologue-scene" data-ci="' + P.pos() + '" data-act="' + U.escape(a.id) + '"'
              + ' style="padding:5px 12px;border:1px solid #4a4436;border-radius:4px;background:#1c2027;'
              + 'color:#e0d8c6;font-size:13px;cursor:pointer;" title="走进这个场景，自己过去动手">'
              + kindTxt + ' ' + U.escape(nm) + '</span>';
          }).join('') + '</div>'
          + '<div style="margin-top:5px;font-size:11px;color:#6f6a60;">走进去，自己找地方动手　·　'
          + '<span data-action="prologue-act" data-ci="' + P.pos() + '" data-act="' + U.escape(hereActs[0].id) + '"'
          + ' style="text-decoration:underline;cursor:pointer;color:#8a7a5c;">就地解决</span></div>'
        : '<div style="margin-top:3px;font-size:12px;color:#6f6a60;">这块地方没什么可做的 —— 往别处走走。</div>');
    /* v132：这格有仗可打 → 给"点名斗将"的入口（否则斗将变成满地图刷经验的捷径） */
    var duelBtn = (P.duelReady && P.duelReady())
      ? '<div style="margin-top:7px;"><span data-action="prologue-duel"'
        + ' style="display:inline-block;padding:5px 13px;border:1px solid #7a5a2a;border-radius:4px;'
        + 'background:#241c10;color:#ffd9a0;font-size:12px;cursor:pointer;">⚔ 点名斗将</span>'
        + '<span class="ui-sub" style="margin-left:7px;font-size:11px;">不耗兵，赢了他就服</span></div>'
      : '';
    var nbs = P.neighbors();
    var walkBlock = '<div style="margin-top:9px;font-size:12px;color:#8a7a5c;">四周（点一格走过去 · 每步耗 1 精力）</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' + (nbs.length ? nbs.map(function (n) {
          var nm = terrainName(n.type);
          var has = (n.acts || []).length;
          return '<span data-action="prologue-move" data-ci="' + n.ci + '"'
            + ' style="padding:5px 11px;border:1px solid ' + (has ? '#5a4a26' : '#2a2e35') + ';border-radius:4px;'
            + 'background:' + (has ? '#1e1a12' : '#12151a') + ';color:' + (has ? '#e0c98a' : '#9a9284') + ';'
            + 'font-size:12px;cursor:pointer;" title="' + (has ? '那边有动静' : '看不出什么') + '">'
            /* v131：方位在前、地形在后 —— 光给六个"湖泊"，玩家分不清往哪走 */
            + (n.dir ? '<b style="opacity:.75;">' + U.escape(n.dir) + '</b> ' : '')
            + U.escape(nm) + (has ? ' ·' : '') + '</span>';
        }).join('') : '<span class="ui-sub">走不动了</span>') + '</div>';

    return '<div style="pointer-events:auto;background:rgba(13,15,19,.93);border:1px solid #2c3037;'
      + 'border-radius:8px;padding:12px 16px;backdrop-filter:blur(3px);line-height:1.65;'
      + 'box-shadow:0 10px 30px rgba(0,0,0,.55);">'
      /* 一行头：天 / 等级 / 精力 / 已出去几趟 */
      + '<div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#8a7a5c;">'
      + '<span style="letter-spacing:.22em;">第 ' + (day + 1) + ' 天</span>'
      + '<span style="color:#b9b0a0;">君主 <b style="color:#e8e2d4;font-size:14px;">Lv' + lv + '</b> / ' + need + '</span>'
      /* v131：精力必须走 energyNowOf（唯一读出口）——
         直读 `lord.energy` 会把 231 这种超上限的原始值直接印在面板上。 */
      + '<span>精力 <b style="color:#e8e2d4;">' + Math.round(GAME.energyNowOf ? GAME.energyNowOf(lord) : ((lord && lord.energy) || 0))
      + '</b> / ' + Math.round(GAME.energyMaxOf ? GAME.energyMaxOf(lord) : 100) + '</span>'
      + (acts ? '<span>已出去 ' + acts + ' 趟</span>' : '')
      + '<span style="flex:1;"></span>'
      + '<span style="color:#6f6a60;">' + (day < 10 ? '天还没冷' : '天在变冷') + '</span>'
      + '</div>'
      + '<div style="margin-top:2px;font-size:13px;color:#a89c86;">你们 ' + U.numText(pop, 0)
      + ' 个人，还没有城 —— ' + (day < 10 ? '得找点能打的，先把人练出来。' : '撑到能立城那天。') + '</div>'
      + '<div style="margin-top:6px;height:5px;background:#23262b;border-radius:3px;">'
      + '<div style="height:5px;width:' + pct + '%;background:#c9b06a;border-radius:3px;"></div></div>'
      + tierLine + nextLine
      + hereBlock + duelBtn + walkBlock
      /* v131：原来的「就近清剿 / 就近试炼 / 就近采集」三个按钮撤掉 ——
         它们和「脚下 + 四周」是同一件事的两种说法，而且找不到目标时会印
         「附近没有」，读起来像功能坏了。现在"能做什么"由**站的位置**决定。 */
      + comboLine
      + (last ? '<div style="margin-top:9px;font-size:12px;color:#7d766a;border-top:1px solid #23262b;padding-top:7px;">最近：'
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
              return '<div style="margin-top:10px;font-size:12px;color:#c9a86a;line-height:1.7;">'
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
        + 'z-index:70;width:min(780px,94vw);max-height:46vh;overflow:auto;'
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
        /* ⛔ v131：改前这里用 `currentCity().ci`，而前传现在**没有城** →
           取到 null → `fromCi = 0` → 点亮的是球面另一头的第 0 格。
           实测截图：整颗球几乎全黑，玩家根本看不见自己站在哪。
           视野要围着**君主所在格**开，不是围着城。 */
        var fromCi = P.pos();
        if (GAME.fog && GAME.fog.revealAround) {
          GAME.fog.revealAround(fromCi, 4, (GAME.fog.TERRAIN || 1));
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
      if (st2 && st2.prologue && M3 && M3.centerOn) {
        var pos2 = P.pos();
        if (st2.prologue._camCi !== pos2) {
          var cell2 = (SP() && SP().cellOf) ? SP().cellOf(pos2) : null;
          if (cell2 && cell2.lon != null) {
            var xy2 = SP().xyOfLonLat(cell2.lon, cell2.lat);
            st2.prologue._camCi = pos2;
            if (M3.setZoom) M3.setZoom(0.02);      /* 0 = 最近；留一点余量，别贴到穿模 */
            M3.centerOn(xy2.x, xy2.y);
          }
        }
      }
    } catch (e) { /* 相机失败不该挡住界面 */ }
    el.innerHTML = P.screenHTML();
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
      /* v128：点"附近可去"的一行 → 打开那片野地（与地图点格同一条路），
         玩家看到的是**世界**，不是三个写死的按钮。 */
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
        var r = GAME.scene3d.play(act, ci);
        if (!r || !r.ok) ctx.toast((r && r.msg) || '场景没打开');
      },
      'prologue-act': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var act = el.getAttribute('data-act');
        var r = P.act(ci, act);
        ctx.toast(r.msg);
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
      'prologue-build': function (el, ctx) {
        var r = P.build();
        ctx.toast(r.msg);
        if (GAME.refreshAll) GAME.refreshAll();
      }
    }
  });
}

})();
