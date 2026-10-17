/* ============================================================
 * js/ship.js — **星际战舰 / 空间站** 引擎（v91.71 · 第 A 期）
 * ------------------------------------------------------------
 * 三层结构：
 *   空间站 s.station = { lv, ships:[ ship ] }        ← 全局一座（母港）
 *   战舰 ship = { id, classId, tier, role, enh:{部件:等级}, hp, builtAt }
 *   属性 statsOf(ship) —— **唯一出口**（基础值 × 档位倍率 + 部件加成）
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
  /* 该档需要的蓝图 id（B 期启用）。A 期返回 null = 不设门槛。 */
  SH.bpOf = function (cls) { return (cls && cls.bp) || null; };

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
    if (bp && !(GAME.items && GAME.items.has(bp, 1))) {
      return { ok: false, msg: '缺少蓝图：需先在奇观获得「' + cls.name + '」蓝图' };
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

  /* ---------- 属性（**唯一出口**） ---------- */
  /* 基础值 = SHIP_BASE[role] × 档位倍率；再逐部件累加 per × 等级。 */
  SH.statsOf = function (ship) {
    var out = {}, i;
    var stats = DATA.SHIP_STATS || [];
    var cls = SH.classOf(ship && ship.classId);
    var base = (DATA.SHIP_BASE || {})[(cls && cls.role) || 'assault'] || {};
    var tmul = (SH.tierOf((cls && cls.tier) || 1).mul) || 1;
    stats.forEach(function (st) { out[st.k] = (base[st.k] || 0) * tmul; });
    /* 部件加成（船体无加成；其余按等级累加） */
    (DATA.SHIP_PARTS || []).forEach(function (p) {
      if (p.id === 'hull') return;
      var lv = SH.partLvOf(ship, p.id);
      if (lv <= 0) return;
      for (var k in (p.per || {})) out[k] = (out[k] || 0) + p.per[k] * lv;
    });
    /* 取整：百分比类保留 2 位，其余整数 */
    stats.forEach(function (st) {
      var v = out[st.k] || 0;
      out[st.k] = st.pct ? Math.round(v * 100) / 100 : Math.round(v);
    });
    return out;
  };
  /* 某舰的战力粗值（排序/概览用；不是战斗公式） */
  SH.powerOf = function (ship) {
    var s = SH.statsOf(ship);
    return Math.round((s.atk || 0) * 2 + (s.hp || 0) * 0.5 + (s.shield || 0) * 0.4
      + (s.armor || 0) * 10 + (s.cap || 0) * 5);
  };
})();
