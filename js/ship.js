/* ============================================================
 * js/ship.js — **星际战舰 / 空间站** 引擎（v91.71 · 第 A 期 · v142.4 C 期 modifier 管道试点）
 * ------------------------------------------------------------
 * 三层结构：
 *   空间站 s.station = { lv, ships:[ ship ] }        ← 全局一座（母港）
 *   战舰 ship = { id, classId, tier, role, enh:{部件:等级}, hp, builtAt }
 *   属性 statsOf(ship) —— **唯一出口**（v142.4 起走 modifier 管道：
 *      基础值 × 档位倍率 + 部件加成 = 两个内置来源，C 期新系统只注册来源）
 *
 * 老板（v91.71）：「先建造空间站，再建造战舰；战舰奇观出蓝图，12 种 3*4 白蓝金红；
 *   建造/管理采用**卡牌式**；**先构造船体，再升级其他部件**。」
 *
 * 本文件只做引擎与出口；数据全在 DATA.STATION / SHIP_*。
 * ⚠️ 蓝图门槛（B 期）已留接口 `bpOf`：返回 null = 该档不需要蓝图（A 期）。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;

  var SH = GAME.ship = {};

  /* ---------- 状态（惰性建 · 老档零迁移） ---------- */
  SH.state = function () {
    var s = GAME.state;
    if (!s) return { lv: 1, ships: [], _seq: 0 };
    s.station = s.station || { lv: 1, ships: [], _seq: 0 };
    if (!s.station.ships) s.station.ships = [];
    if (!s.station.lv) s.station.lv = 1;
    if (s.station._seq == null) s.station._seq = 0;
    return s.station;
  };
  SH.lv = function () { return SH.state().lv; };
  SH.ships = function () { return SH.state().ships.slice(); };

  /* ---------- 查询 ---------- */
  SH.classOf = function (classId) {
    var out = null;
    (DATA.SHIP_CLASSES || []).forEach(function (c) { if (c.id === classId) out = c; });
    return out;
  };
  SH.tierOf = function (tier) { return (DATA.SHIP_TIERS || [])[tier] || DATA.SHIP_TIERS[1]; };
  SH.roleOf = function (role) { return (DATA.SHIP_ROLES || {})[role] || null; };
  SH.partOf = function (pid) {
    var out = null;
    (DATA.SHIP_PARTS || []).forEach(function (p) { if (p.id === pid) out = p; });
    return out;
  };
  /* 该舰种需要的蓝图 id（B 期已启用；数据缺失时返回 null = 不设门槛）。 */
  SH.bpOf = function (cls) { return (cls && cls.bp) || null; };
  SH.bpOfClass = function (classId) { return SH.bpOf(SH.classOf(classId)); };
  /* 某舰种蓝图是否已持有（唯一出口；canBuild / 卡牌 / 守卫同读）。 */
  SH.hasBpOf = function (classId) {
    var bp = SH.bpOfClass(classId);
    return !bp || !!(GAME.items && GAME.items.has(bp, 1));
  };
  /* 12 舰种蓝图汇总（空间站一览与门禁断言用）。 */
  SH.bpStatus = function () {
    return (DATA.SHIP_CLASSES || []).map(function (cls) {
      var bp = SH.bpOf(cls);
      return { classId: cls.id, name: cls.name, bp: bp,
        bpName: bp ? (((DATA.ITEM_BY_ID || {})[bp] || {}).name || bp) : null,
        has: SH.hasBpOf(cls.id), tier: cls.tier };
    });
  };

  /* 空间站等级 → 允许建造的最高舰档 */
  SH.tierCapNow = function () {
    var T = (DATA.STATION && DATA.STATION.tierCap) || {}, lv = SH.lv(), cap = 1;
    Object.keys(T).forEach(function (k) { if (lv >= Number(k)) cap = Math.max(cap, T[k]); });
    return cap;
  };
  SH.dockSlots = function () {
    var F = DATA.STATION && DATA.STATION.dockSlots;
    return F ? F(SH.lv()) : 2;
  };

  /* ---------- 造舰（**先构造船体** · 一次性） ---------- */
  SH.hullCost = function (cls) {
    var C = DATA.SHIP_COST || {}, t = SH.tierOf(cls.tier);
    return Math.max(1, Math.round((C.hullBase || 8) * (t.matMul || 1)));
  };
  SH.canBuild = function (classId) {
    var s = GAME.state, cls = SH.classOf(classId);
    if (!s) return { ok: false, msg: '尚未开局' };
    if (!cls) return { ok: false, msg: '未知舰种' };
    if (cls.tier > SH.tierCapNow()) {
      return { ok: false, msg: '空间站等级不足：' + SH.tierOf(cls.tier).name + '档需空间站 Lv'
        + _needLv(cls.tier) };
    }
    if (SH.ships().length >= SH.dockSlots()) {
      return { ok: false, msg: '船坞已满（' + SH.dockSlots() + ' 艘）—— 升级空间站扩容' };
    }
    var bp = SH.bpOf(cls);
    if (bp && !SH.hasBpOf(cls.id)) {
      var bpName = ((DATA.ITEM_BY_ID || {})[bp] || {}).name || (cls.name + '蓝图');
      return { ok: false, msg: '缺少蓝图「' + bpName + '」：需先奇观探索获得（白常见、红稀有）' };
    }
    var C = DATA.SHIP_COST || {}, mat = C.hullMat || 'w_stariron', need = SH.hullCost(cls);
    var own = GAME.items ? GAME.items.count(mat) : 0;
    if (own < need) {
      var nm = (DATA.ITEM_BY_ID || {})[mat] ? DATA.ITEM_BY_ID[mat].name : mat;
      return { ok: false, msg: '材料不足：需 ' + nm + ' ×' + need + '（现有 ' + own + '）' };
    }
    return { ok: true, cls: cls, cost: need, mat: mat };
  };
  function _needLv(tier) {
    var T = (DATA.STATION && DATA.STATION.tierCap) || {};
    var need = null;
    Object.keys(T).forEach(function (k) {
      if (T[k] >= tier) { var v = Number(k); if (need === null || v < need) need = v; }
    });
    return need === null ? 99 : need;
  }

  /* 造舰：扣船体材料 → 入船坞。返回新舰。 */
  SH.build = function (classId) {
    var chk = SH.canBuild(classId);
    if (!chk.ok) return chk;
    var st = SH.state(), cls = chk.cls;
    GAME.items.sub(chk.mat, chk.cost);
    st._seq += 1;
    var ship = {
      id: 'sp' + st._seq,
      classId: cls.id, tier: cls.tier, role: cls.role,
      enh: {},                 /* 部件等级 { partId: lv } */
      builtAt: (GAME.utils && GAME.utils.now) ? GAME.utils.now() : 0,
    };
    st.ships.push(ship);
    GAME.log('🛸 空间站建成「' + cls.name + '」（' + SH.tierOf(cls.tier).name + '档 · '
      + SH.roleOf(cls.role).name + '）', 'sys', 'admin');
    return { ok: true, msg: '已建成「' + cls.name + '」', ship: ship };
  };

  /* ---------- 拆舰（返还部分船体材料） ---------- */
  SH.scrap = function (shipId) {
    var st = SH.state(), i, idx = -1;
    for (i = 0; i < st.ships.length; i++) if (st.ships[i].id === shipId) { idx = i; break; }
    if (idx < 0) return { ok: false, msg: '没有这艘战舰' };
    var ship = st.ships[idx], cls = SH.classOf(ship.classId), C = DATA.SHIP_COST || {};
    var back = Math.floor(SH.hullCost(cls) * (C.scrapPct == null ? 0.5 : C.scrapPct));
    st.ships.splice(idx, 1);
    if (back > 0) GAME.items.add(C.hullMat || 'w_stariron', back);
    GAME.log('♻️ 拆解「' + (cls ? cls.name : ship.classId) + '」，返还船体材料 ×' + back, 'sys', 'admin');
    return { ok: true, msg: '已拆解，返还材料 ×' + back };
  };

  /* ---------- 部件升级（**先船体 → 再升级部件**） ---------- */
  SH.partCost = function (part, lvNext) {
    var C = DATA.SHIP_COST || {};
    return Math.max(1, Math.round((C.partBase || 4) + (C.partStep || 2) * (lvNext - 1)));
  };
  SH.partLvOf = function (ship, pid) { return (ship && ship.enh && ship.enh[pid]) || 0; };
  SH.canUpgrade = function (shipId, pid) {
    var st = SH.state(), ship = null;
    st.ships.forEach(function (x) { if (x.id === shipId) ship = x; });
    if (!ship) return { ok: false, msg: '没有这艘战舰' };
    var part = SH.partOf(pid);
    if (!part) return { ok: false, msg: '未知部件' };
    if (part.id === 'hull') return { ok: false, msg: '船体在造舰时一次性建成，不可升级' };
    var cur = SH.partLvOf(ship, pid);
    if (cur >= (part.max || 10)) return { ok: false, msg: '「' + part.name + '」已满级' };
    var lvNext = cur + 1, cost = SH.partCost(part, lvNext), mat = part.mat;
    var own = GAME.items ? GAME.items.count(mat) : 0;
    if (own < cost) {
      var nm = (DATA.ITEM_BY_ID || {})[mat] ? DATA.ITEM_BY_ID[mat].name : mat;
      return { ok: false, msg: '材料不足：需 ' + nm + ' ×' + cost + '（现有 ' + own + '）' };
    }
    return { ok: true, ship: ship, part: part, lvNext: lvNext, cost: cost, mat: mat };
  };
  SH.upgradePart = function (shipId, pid) {
    var chk = SH.canUpgrade(shipId, pid);
    if (!chk.ok) return chk;
    GAME.items.sub(chk.mat, chk.cost);
    chk.ship.enh = chk.ship.enh || {};
    chk.ship.enh[pid] = chk.lvNext;
    GAME.log('🔧 「' + chk.part.name + '」→ Lv' + chk.lvNext + '（耗 '
      + (((DATA.ITEM_BY_ID || {})[chk.mat] || {}).name || chk.mat) + ' ×' + chk.cost + '）', 'sys', 'admin');
    return { ok: true, msg: '「' + chk.part.name + '」已升至 Lv' + chk.lvNext, lv: chk.lvNext };
  };

  /* ---------- 属性（**唯一出口**） ----------
   * v142.4（C 期试点）：改走 **modifier 管道**（借鉴 Unciv —— 规则数据化，
   * 消灭"每加一个系统就打一段补偿表"）。
   *   旧公式 = 基础值 × 档位倍率 + Σ(部件 per × 等级)（纯加法，两来源写死）；
   *   管道   = flat 相加 → pct 相乘 → 取整收口（与旧取整口径逐位一致）。
   * 零 pct 修饰时两者**逐位相等**（invariants §4.4 有性质钉着，防迁移漂移）。
   * C 期起新系统（科技/英雄/奇观/空间站共鸣…）只许往 `SH.mod.add(id, fn)`
   * 注册一个来源，**不许再改 statsOf** —— 公式冻结，数据生长。 */
  SH.mod = {
    _src: [],
    _bad: [],
    /* 注册/摘除一个修饰来源。fn(ship) → [{ k, op:'flat'|'pct', v, src }]；
       fn 传 null = 摘除（测试摘挂用；生产来源常驻）。同 id 重复注册=替换。 */
    add: function (id, fn) {
      var i = this._src.length;
      while (i--) if (this._src[i].id === id) this._src.splice(i, 1);
      if (typeof fn === 'function') this._src.push({ id: id, fn: fn });
    },
    /* 收集全部修饰：内置 ① 基础值（角色 × 档位）② 部件 per × 等级，再加注册来源。
       注册来源异常**静默跳过**（观测层故障不许拖垮属性口径）。 */
    collect: function (ship) {
      var mods = [];
      var cls = SH.classOf(ship && ship.classId);
      var base = (DATA.SHIP_BASE || {})[(cls && cls.role) || 'assault'] || {};
      var tmul = (SH.tierOf((cls && cls.tier) || 1).mul) || 1;
      for (var k in base) mods.push({ k: k, op: 'flat', v: (base[k] || 0) * tmul, src: 'base' });
      (DATA.SHIP_PARTS || []).forEach(function (p) {
        var lv = SH.partLvOf(ship, p.id);
        if (lv <= 0) return;
        for (var k2 in (p.per || {})) mods.push({ k: k2, op: 'flat', v: p.per[k2] * lv, src: 'part:' + p.id });
      });
      this._src.forEach(function (s) {
        var r = null;
        try { r = s.fn(ship); } catch (e) { r = null; }
        if (r && r.length) mods = mods.concat(r);
      });
      return mods;
    },
    /* 应用：flat 先相加、pct 后相乘（顺序确定，与来源注册顺序无关）；
       未知属性键 / 非有限数值 → **拒绝并记录**（数据防错，不静默吞、不污染 out）。 */
    apply: function (base, mods) {
      var out = {}, flat = {}, pct = {}, bad = [], keys = {};
      (DATA.SHIP_STATS || []).forEach(function (st) { keys[st.k] = true; });
      for (var k in (base || {})) out[k] = base[k] || 0;
      (mods || []).forEach(function (m) {
        if (!m || !keys[m.k] || typeof m.v !== 'number' || !isFinite(m.v)) { bad.push(m || null); return; }
        if (m.op === 'pct') pct[m.k] = (pct[m.k] || 0) + m.v;
        else flat[m.k] = (flat[m.k] || 0) + m.v;
      });
      for (var kf in flat) out[kf] = (out[kf] || 0) + flat[kf];
      for (var kp in pct) out[kp] = (out[kp] || 0) * (1 + pct[kp]);
      /* 取整收口（与旧口径一致：pct 类 2 位，其余整数） */
      (DATA.SHIP_STATS || []).forEach(function (st) {
        var v = out[st.k] || 0;
        out[st.k] = st.pct ? Math.round(v * 100) / 100 : Math.round(v);
      });
      return { out: out, bad: bad };
    },
    /* 完整管线（statsOf 的唯一实现路径） */
    of: function (ship) {
      var r = this.apply({}, this.collect(ship));
      if (r.bad.length) {
        this._bad = this._bad.concat(r.bad);
        if (this._bad.length > 50) this._bad.splice(0, this._bad.length - 50);
      }
      return r;
    },
    /* 被拒绝的修饰（数据写错时的证据；有界 50 条） */
    bad: function () { return this._bad.slice(); },
    /* v144.2：来源清单（测试要"摘掉生产来源、只比内置两来源" ——
       迁移保真那条性质靠它回到零修饰态，见 invariants §4.4） */
    ids: function () { return this._src.map(function (s) { return s.id; }); },
    snapshot: function () { return this._src.map(function (s) { return { id: s.id, fn: s.fn }; }); },
    restore: function (snap) {
      var self = this;
      (snap || []).forEach(function (s) { self.add(s.id, s.fn); });
    }
  };
  /* ============================================================
   * v144.2（C 期数值 · 老板「战舰继续」）：**三个修饰来源**
   * ------------------------------------------------------------
   * v142.4 只是把公式搬进管道（零行为变化）。这一期往管道里**长数据** ——
   *   · `station`  **母港共振**：空间站每级 → 全舰属性 +perLv（封顶 cap）
   *   · `synergy`  **部件协同**：一组部件**双双**达标 → 该组属性加成
   *                 （只看最短板那件 —— 偏科不奖励，逼玩家配平）
   *   · `fleet`    **编队共鸣**：同 role 的舰 ≥ minShips 艘 → 该 role 主力属性加成
   * 三条都**只注册来源、不改公式**（C 期试点定的规矩：公式冻结、数据生长）。
   * 数值全在 DATA.SHIP_SYNERGY —— 调平衡只动那张表，本文件不动。
   * ⚠️ 出厂态（站 Lv1 · 部件 0 级 · 单舰）三条都是**零修饰** ——
   *    所以"管道 = 旧公式逐位相等"这条性质在零修饰态下依然成立（invariants §4.4）。
   * ============================================================ */
  SH.mod.add('station', function () {
    var S = DATA.SHIP_SYNERGY || {}, cfg = S.station || {};
    var per = cfg.perLv == null ? 0.02 : cfg.perLv;
    var cap = cfg.cap == null ? 0.30 : cfg.cap;
    var pct = Math.min(cap, Math.max(0, (SH.lv() - 1) * per));
    if (!(pct > 0)) return [];
    return (DATA.SHIP_STATS || []).map(function (st) {
      return { k: st.k, op: 'pct', v: pct, src: 'station' };
    });
  });
  SH.mod.add('synergy', function (ship) {
    var S = DATA.SHIP_SYNERGY || {}, sets = S.sets || [], out = [];
    sets.forEach(function (g) {
      var min = Infinity;
      (g.parts || []).forEach(function (pid) { min = Math.min(min, SH.partLvOf(ship, pid)); });
      if (!isFinite(min)) return;
      /* 达标的每一档都生效（可以叠加），所以 tiers 按 min 升序写 */
      (g.tiers || []).forEach(function (t) {
        if (min < (t.min || 0)) return;
        for (var k in (t.v || {})) out.push({ k: k, op: 'pct', v: t.v[k], src: 'synergy:' + g.id });
      });
    });
    return out;
  });
  SH.mod.add('fleet', function (ship) {
    var S = DATA.SHIP_SYNERGY || {}, cfg = S.fleet || {}, per = cfg.per || {};
    var cls = SH.classOf(ship && ship.classId), role = cls && cls.role;
    if (!role || !per[role]) return [];
    var n = 0;
    SH.ships().forEach(function (x) {
      var c = SH.classOf(x.classId);
      if (c && c.role === role) n++;
    });
    if (n < (cfg.minShips || 2)) return [];
    var out = [];
    for (var k in per[role]) out.push({ k: k, op: 'pct', v: per[role][k], src: 'fleet:' + role });
    return out;
  });
  /* 加成来源 → 显示名（界面与断言共读 —— 不许各处自己拼字符串） */
  SH.bonusLabel = function (src) {
    var S = DATA.SHIP_SYNERGY || {}, s = String(src || '');
    if (s === 'station') return '母港共振';
    if (s.indexOf('synergy:') === 0) {
      var g = null;
      (S.sets || []).forEach(function (x) { if (x.id === s.slice(8)) g = x; });
      return '协同·' + ((g && g.name) || s.slice(8));
    }
    if (s.indexOf('fleet:') === 0) {
      var r = SH.roleOf(s.slice(6));
      return '编队·' + ((r && r.name) || s.slice(6));
    }
    return s;
  };
  /* 当前生效的加成清单（界面与断言共读 —— 不许各自再算一遍） */
  SH.bonusListOf = function (ship) {
    var r = SH.mod.of(ship);
    var by = {};
    (SH.mod.collect(ship) || []).forEach(function (m) {
      if (m.src === 'base' || (m.src || '').indexOf('part:') === 0) return;
      var k = m.src || '?';
      by[k] = (by[k] || 0) + (m.op === 'pct' ? m.v : 0);
    });
    return Object.keys(by).map(function (k) {
      return { src: k, pct: Math.round(by[k] * 10000) / 10000 };
    });
  };

  /* 基础值 = SHIP_BASE[role] × 档位倍率；再逐部件累加 per × 等级（经管道）。 */
  SH.statsOf = function (ship) { return SH.mod.of(ship).out; };
  /* 某舰的战力粗值（排序/概览用；不是战斗公式） */
  SH.powerOf = function (ship) {
    var s = SH.statsOf(ship);
    return Math.round((s.atk || 0) * 2 + (s.hp || 0) * 0.5 + (s.shield || 0) * 0.4
      + (s.armor || 0) * 10 + (s.cap || 0) * 5);
  };
})();
