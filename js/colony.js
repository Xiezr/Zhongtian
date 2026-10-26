/* ============================================================
 * js/colony.js — **星际投送 / 殖民**（v145 · 星际战舰 E 期）
 * ------------------------------------------------------------
 * 老板（v91.71）：「战舰……主题 = 军事投送」；接力卡 E 期：
 *   「投送（`s.interstellar` 顶层通道，参考 `wonderExp` 的"独立计时器"先例）+ 殖民」。
 * 设计提案 5-A：「1 艘船 = 移动兵营，跨星行军时间 −50%」。
 *
 * 一句话规则：
 *   新星球落地**不再白送前哨城**；要有人、有地，只能靠空间站把人和兵**投送**过去。
 *
 * 三层：
 *   ① 载量（唯一出口）—— 母舰运力 = 基础 × 档位 + 容量属性；兵/人同占一个池
 *   ② 在途（`s.interstellar` · 现实时间锚点）—— 前段飞行 + 落点勘测 + 后段返航；
 *      航程取「跨星球距离」与「本星最远两端」的**较大值**（同一个球上不会更快）
 *   ③ 落地 —— 没有城时：就地圈一块落脚野地（星际锚地，带首批开拓物资）；
 *      有城时：人入新城、兵并入城防，返程把该星物资带回出发城
 *
 * 纪律（与全仓一致）：
 *   · 兵不丢：校验失败不动账；航程中止原路退兵、退人；燃料不退（已经烧掉了）
 *   · 现实时间锚点（U.now）：后台推进、离线补算；与 wonderExp 同一套先例
 *   · 跨星球不能走陆路：陆上调运「本境」拦截（domain.doTransferCargo）
 *   · 新星球立城必须有补给线（锚地或已有城），否则拒绝（domain.canBuildCityAt）
 *   · 数值全在 `DATA.COLONY` —— 调平衡只动那张表
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
import './items.js';
import './ship.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;
  var SH = GAME.ship;

  var CO = GAME.colony = {};

  function D() { return (DATA && DATA.COLONY) || {}; }
  function cfg(k, dflt) { var v = D()[k]; return v == null ? dflt : v; }

  /* ---------- 状态（顶层 · 惰性建 · 老档零迁移） ---------- */
  CO.state = function () {
    var s = GAME.state;
    if (!s) return { missions: [], _seq: 0 };
    s.interstellar = s.interstellar || { missions: [], _seq: 0 };
    if (!Array.isArray(s.interstellar.missions)) s.interstellar.missions = [];
    if (s.interstellar._seq == null) s.interstellar._seq = 0;
    return s.interstellar;
  };
  CO.missions = function () { return CO.state().missions.slice(); };
  CO.byId = function (id) {
    var out = null;
    CO.state().missions.forEach(function (m) { if (m.id === id) out = m; });
    return out;
  };

  /* ---------- 行星 / 城 / 锚地 ---------- */
  CO.planetOf = function (pid) {
    var out = null;
    (GAME.planetsOf ? GAME.planetsOf() : []).forEach(function (p) { if (p && p.id === pid) out = p; });
    return out;
  };
  CO.cityAt = function (pid) {
    var out = null;
    ((GAME.state && GAME.state.cities) || []).forEach(function (c) {
      if (!out && GAME.pidOf(c) === pid) out = c;
    });
    return out;
  };
  CO.mooringOf = function (pid) {
    var out = null;
    ((GAME.state && GAME.state.wilds) || []).forEach(function (w) {
      if (!out && GAME.pidOf(w) === pid && w.colony) out = w;
    });
    return out;
  };
  /* 目标星球能不能接船 */
  CO.anchorOf = function (pid) {
    var c = CO.cityAt(pid);
    if (c) return { ok: true, kind: 'city', city: c, name: c.name };
    var w = CO.mooringOf(pid);
    if (w) return { ok: true, kind: 'mooring', ci: w.ci, wild: w, name: (w.colony && w.colony.name) || '星际锚地' };
    return { ok: false, msg: '该星球没有落脚点（无城、无锚地）—— 首次投送会自动圈一处锚地' };
  };

  /* ---------- 航程 / 载量 / 燃料 ---------- */
  /* 跨星球航程（游戏秒 · 唯一出口）。max(星球间距, 本星最远两端)。 */
  CO.flightSecOf = function (pid) {
    if (pid == null) return 0;
    var dist = cfg('starDist', GAME.STAR_DIST || 10000);
    var sp = (GAME.sphereOf ? GAME.sphereOf(pid) : GAME.sphere);
    if (sp && sp.nv) dist = Math.max(dist, sp.nv - 1);
    return Math.max(1, Math.round(dist * (cfg('secPerDist', 60) || 60)));
  };
  /* 运力（人/兵同池）：基础 × 档位 + 容量属性 × 每点折算 */
  CO.capacityOf = function (ship) {
    var tier = SH.tierOf((ship && ship.tier) || 1);
    var st = SH.statsOf(ship || {});
    var base = cfg('capBase', 300) * (tier.matMul || 1);
    var perCap = cfg('capPerStat', 10);
    return Math.max(0, Math.round(base + (st.cap || 0) * perCap));
  };
  CO.fuelCostOf = function (ship, pid) {
    /* v146：选了「深空无响应」→ 母舰从深空取燃料，投送不烧燃料 */
    if (GAME.ending && GAME.ending.noFuel && GAME.ending.noFuel()) return 0;
    var per = cfg('fuelPerCap', 0.05);
    var km = 1 + (Math.max(1, pid | 0) - 1) * (cfg('fuelPerStar', 0.25));
    return Math.max(1, Math.ceil(CO.capacityOf(ship) * per * km));
  };
  CO.fuelItem = function () { return cfg('fuelItem', 'w_he3'); };
  CO.cargoOf = function (army, colonists) {
    var n = Math.max(0, Math.floor(colonists || 0));
    for (var k in (army || {})) n += Math.max(0, Math.floor(army[k] || 0));
    return n;
  };
  CO.armyN = function (army) {
    var n = 0;
    for (var k in (army || {})) n += Math.max(0, Math.floor(army[k] || 0));
    return n;
  };
  /* 这艘船是不是正在执行投送（界面置灰 / canSend 拒绝 / SH 拆解闸共用） */
  CO.busyOf = function (shipId) {
    var out = null;
    CO.state().missions.forEach(function (m) { if (m.shipId === shipId) out = m; });
    return out;
  };
  /* 可投送的船（运输系母舰）—— 面板的"选母舰"列表读它（唯一出口） */
  CO.carrierShips = function () {
    var out = [];
    SH.ships().forEach(function (sh) {
      var cls = SH.classOf(sh.classId);
      if (cls && cls.role === 'carrier') out.push(sh);
    });
    return out;
  };

  /* ---------- 校验（界面置灰与真执行同读这一份） ---------- */
  CO.canSend = function (opts) {
    opts = opts || {};
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var from = (opts.fromCityId && GAME.cityById(opts.fromCityId)) || (GAME.currentCity ? GAME.currentCity() : null);
    if (!from) return { ok: false, msg: '没有出发城' };
    /* 不要求"出发城在当前星球"：空间站是全局的，投送本来就是跨星动作 */
    var ship = null;
    SH.ships().forEach(function (x) { if (x.id === opts.shipId) ship = x; });
    if (!ship) return { ok: false, msg: '没有这艘战舰' };
    var cls = SH.classOf(ship.classId);
    if (!cls) return { ok: false, msg: '未知舰种' };
    if (cls.role !== 'carrier') {
      return { ok: false, msg: '「' + cls.name + '」不是运输系 —— 投送要用母舰（运输梭 / 远洋运输舰 / 方舟运载舰 / 星际母舰）' };
    }
    var busy = CO.busyOf(ship.id);
    if (busy) return { ok: false, msg: '「' + cls.name + '」正在执行投送（' + Math.round(CO.progressOf(busy) * 100) + '%），须先返航' };
    if (GAME.fleet && GAME.fleet.busyOf && GAME.fleet.busyOf(ship.id)) {
      return { ok: false, msg: '「' + cls.name + '」已在舰队编成中 —— 先解散舰队再投送' };
    }
    var pid = Number(opts.pid);
    var pl = CO.planetOf(pid);
    if (!pl) return { ok: false, msg: '目标星球不存在' };
    if (pid === GAME.curPid()) return { ok: false, msg: '目标就是当前所在星球 —— 同球转运请用「本境调运」' };
    var anc = CO.anchorOf(pid);
    /* 首次投送（无城无锚地）允许：抵达时自动圈锚地 —— 这是唯一的开荒入口 */
    if (!anc.ok && CO.cityAt(pid)) return { ok: false, msg: anc.msg };
    var army = {}, moved = 0;
    for (var k in (opts.army || {})) {
      var n = Math.floor(opts.army[k] || 0);
      if (n <= 0) continue;
      if ((from.army[k] || 0) < n) {
        return { ok: false, msg: '兵力不足（' + ((DATA.TROOPS[k] || {}).name || k) + '）' };
      }
      army[k] = n; moved += n;
    }
    var pop = Math.floor(GAME.res(from).pop || 0);
    var cols = Math.max(0, Math.floor(opts.colonists || 0));
    if (cols > pop) return { ok: false, msg: '幸存者不足（' + from.name + ' 现有 ' + U.fmt(pop) + ' 人）' };
    if (!moved && cols <= 0) return { ok: false, msg: '船上什么都没有 —— 至少带人（殖民）或带兵（驻防）' };
    var cap = CO.capacityOf(ship), load = CO.cargoOf(army, cols);
    if (load > cap) {
      return { ok: false, msg: '超载：' + U.fmt(load) + ' ＞ 运力 ' + U.fmt(cap) + '（升「仓储」部件 / 换更大的船）' };
    }
    var fuelItem = CO.fuelItem(), fuel = CO.fuelCostOf(ship, pid);
    var own = GAME.items ? GAME.items.count(fuelItem) : 0;
    if (own < fuel) {
      var fn = ((DATA.ITEM_BY_ID || {})[fuelItem] || {}).name || fuelItem;
      return { ok: false, msg: '燃料不足：需 ' + fn + ' ×' + fuel + '（现有 ' + own + ' · 奇观探索产出）' };
    }
    return { ok: true, ship: ship, cls: cls, pid: pid, planet: pl, anchor: anc,
      army: army, colonists: cols, load: load, cap: cap, fuel: fuel, fuelItem: fuelItem,
      flightSec: CO.flightSecOf(pid), city: from };
  };

  /* ---------- 派出（扣兵/人/燃料 → 入在途） ---------- */
  CO.send = function (opts) {
    var chk = CO.canSend(opts);
    if (!chk.ok) return chk;
    var st = CO.state();
    var city = chk.city, now = U.now();
    if (chk.colonists > 0) GAME.city.sub(city, 'pop', chk.colonists);
    GAME.city.armySub(city, chk.army);
    GAME.items.sub(chk.fuelItem, chk.fuel);
    st._seq += 1;
    /* ⚠️ flightSecOf 是**游戏秒**（与行军同尺），现实时间锚点要 ÷ 时间倍率 ——
       第一版直接 ×1000 当成毫秒，一趟跨星变成 28 天（实机截图当场抓到）。 */
    var flightMs = Math.round(chk.flightSec / Math.max(1, GAME.timeScale()) * 1000);
    var m = {
      id: 'ix' + st._seq,
      shipId: chk.ship.id, classId: chk.ship.classId,
      fromPid: GAME.curPid(), pid: chk.pid,
      fromCityId: city ? city.id : null,
      army: U.deep(chk.army), colonists: chk.colonists,
      fuel: chk.fuel, fuelItem: chk.fuelItem,
      cap: chk.cap, load: chk.load,
      departAt: now, arriveAt: now + flightMs,
      phase: 'out',
    };
    st.missions.push(m);
    var shipName = chk.cls.name || m.classId;
    var realSec = Math.round(flightMs / 1000);
    GAME.log('🚀 「' + shipName + '」启航 → ' + chk.planet.name + '：' + U.fmt(chk.colonists) + ' 人 · '
      + U.fmt(CO.armyN(chk.army)) + ' 兵（单程约 ' + U.dur(realSec) + ' 现实时间）', 'sys', 'admin');
    return { ok: true, msg: '已启航 → ' + chk.planet.name + '（单程约 ' + U.dur(realSec) + '，抵达后勘测 '
      + U.dur((cfg('surveyMs', 1800000) || 0) / 1000) + '）', mission: m };
  };

  /* ---------- 进度（0~1 · 界面与断言同读） ----------
     0~0.8 飞行 · 0.8~0.9 勘测 · 0.9~1 返航（船靠港） */
  CO.progressOf = function (m, now) {
    if (!m) return 0;
    var t = (now == null ? U.now() : now);
    if (t < m.arriveAt) {
      var span = Math.max(1, m.arriveAt - m.departAt);
      return Math.max(0, Math.min(0.8, (t - m.departAt) / span * 0.8));
    }
    var mid = cfg('surveyMs', 1800000) || 0;
    if (t < m.arriveAt + mid) return 0.8 + 0.1 * ((t - m.arriveAt) / Math.max(1, mid));
    var back = CO.returnAtOf(m);
    if (t >= back) return 1;
    return 0.9 + 0.1 * ((t - m.arriveAt - mid) / Math.max(1, back - m.arriveAt - mid));
  };
  CO.returnAtOf = function (m) {
    if (!m) return Infinity;
    if (m.returnAt != null) return m.returnAt;
    var mid = cfg('surveyMs', 1800000) || 0;
    return m.arriveAt + mid + Math.round((m.arriveAt - m.departAt) * (cfg('returnPct', 0.25) || 0));
  };
  CO.phaseOf = function (m, now) {
    var p = CO.progressOf(m, now);
    if (p < 0.8) return 'out';
    if (p < 0.9) return 'survey';
    return 'back';
  };

  /* ---------- 落点：没有城时圈一块锚地（与地图"登陆点"共用一处） ----------
     锚地优先落**平原**（将来能在锚地直接立城）；
     登陆点周围没平原就逐圈外扩，最后兜底全星第一块平原 —— 投送必须有个落脚处。 */
  CO._moorAt = function (pid) {
    var s = GAME.state, sp = (GAME.sphereOf ? GAME.sphereOf(pid) : GAME.sphere);
    if (!s || !sp || !sp.cells) return null;
    var startCi = GAME._landingCiOf ? GAME._landingCiOf(pid) : -1;
    var forts = GAME.fortsOf ? GAME.fortsOf() : (s.forts || {});
    var isCur = (pid === GAME.curPid());
    function freeAt(ci) {
      var cell = sp.cells[ci];
      if (!cell) return false;
      if (GAME.map.wildAt(ci, pid)) return false;
      /* ⚠️ `_cityCiSet` / `npcAt` 里的 NPC 城是**当前地图星球**的 —— 只在 pid = 当前星时才可用，
         否则 ci 会跨星错位（把别星的城格当成这里的城格）。 */
      if (isCur) {
        if (GAME.map._cityCiSet && GAME.map._cityCiSet()[ci]) return false;
        if (GAME.map.npcAt && GAME.map.npcAt(ci)) return false;
      }
      if (GAME._fkGet(forts, ci, pid)) return false;
      return true;
    }
    var pick = -1;
    var rings = (cfg('moorRings', [2, 4, 8, 16, 32]) || [2, 4, 8, 16, 32]);
    for (var ri = 0; ri < rings.length && pick < 0; ri++) {
      var hops = [];
      if (startCi >= 0 && sp.hopsWithin) hops = sp.hopsWithin(startCi, rings[ri]);
      for (var i = 0; i < hops.length; i++) {
        var ci = hops[i];
        if (!freeAt(ci)) continue;
        if (sp.cells[ci].type === 'plain') { pick = ci; break; }
      }
    }
    if (pick < 0) {
      /* 兜底：全星第一块空着的平原 */
      for (var j = 0; j < (sp.cells || []).length; j++) {
        if (sp.cells[j] && sp.cells[j].type === 'plain' && freeAt(j)) { pick = j; break; }
      }
    }
    if (pick < 0) return null;
    var wc = sp.cells[pick];
    var w = {
      pid: pid, ci: pick, type: wc.type, level: 1,
      lon: wc.lon, lat: wc.lat,
      levelDay: GAME.questDayIndex ? GAME.questDayIndex() : 0,
      garrison: { troops: {} },
      colony: { at: U.now(), mooring: true, name: '星际锚地' },
      seedRes: U.deep(cfg('seedGoods', {}) || {}),
    };
    s.wilds = s.wilds || [];
    s.wilds.push(w);
    return w;
  };

  /* 锚地：没有就圈一块（幂等 · 唯一出口）。
     enterPlanet（落脚点）与 _arrive（首次投送）都走这里 —— 同一颗球不会圈出第二块。 */
  CO.ensureMooring = function (pid) {
    var w = CO.mooringOf(pid);
    if (w) return w;
    var c = CO.cityAt(pid);
    if (c) return null;                    /* 已经有城 → 不需要锚地 */
    return CO._moorAt(pid);
  };

  /* ---------- 入城人口（**封顶**） ----------
     复核抓到：投送到"已有城"的星球时直接 `city.add('pop', n)` —— 不走任何上限，
     而全仓其它加人路径（muster.addPop / 人口自发增长）都按 `effPopCapOf` 封顶。
     这里补齐同一口径：装不下的**留在船上**（记进 carryPop，返航时分回出发城，不蒸发）。 */
  function addPopCapped(city, n) {
    var R = GAME.res(city);
    var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
    var before = R.pop || 0;
    var room = cap > 0 ? Math.max(0, cap - before) : n;
    var put = Math.min(room, n);
    if (put > 0) GAME.city.add(city, 'pop', put);
    return { put: put, left: n - put };
  }

  /* ---------- 抵达结算 ---------- */
  CO._arrive = function (m) {
    var s = GAME.state, pl = CO.planetOf(m.pid);
    var res = { ok: true, pid: m.pid, colonists: m.colonists, troops: CO.armyN(m.army), goods: {}, found: null };
    var city = CO.cityAt(m.pid);
    if (city) {
      var _pv = { put: 0, left: 0 };
      if (m.colonists > 0) _pv = addPopCapped(city, m.colonists);
      m._popLeft = _pv.left;                  /* 装不下的随船回去，返航时送回出发城 */
      if (_pv.left > 0) {
        GAME.log('⚠ 投送：「' + city.name + '」居所已满 —— ' + U.fmt(_pv.left) + ' 人留在船上，随船返航',
          'sys', 'admin');
      }
      for (var k in (m.army || {})) {
        var n = Math.floor(m.army[k] || 0);
        if (n > 0) GAME.city.armyAdd(city, { [k]: n });
      }
      res.city = city.id;
      /* 回程装货：只用返程运力的一半，且必须该城真有货 */
      var backCap = Math.floor((m.cap || 0) * (cfg('returnShare', 0.5)));
      var mats = cfg('returnMats', []);
      var R = GAME.res(city);
      mats.forEach(function (id) {
        if (backCap <= 0 || !mats.length) return;
        var have = Math.floor(R[id] || 0);
        var take = Math.min(have, Math.floor(backCap / mats.length));
        if (take <= 0) return;
        GAME.city.sub(city, id, take);
        res.goods[id] = (res.goods[id] || 0) + take;
      });
      GAME.log('🛬 投送抵达「' + (pl ? pl.name : ('星球 ' + m.pid)) + '」：' + (city.name || '新城')
        + ' 人口 +' + U.fmt(m.colonists) + ' · 驻军 +' + U.fmt(res.troops)
        + (Object.keys(res.goods).length ? (' · 装船回运 ' + Object.keys(res.goods).join('/')) : ''), 'sys', 'admin');
    } else {
      var had = !!CO.mooringOf(m.pid);
      var w = CO.ensureMooring(m.pid);      /* 幂等：没有才圈（唯一出口） */
      if (w && m.colonists > 0) w.colonists = (w.colonists || 0) + m.colonists;
      if (w && res.troops > 0) {
        w.garrison = w.garrison || { troops: {} };
        for (var a in (m.army || {})) {
          var c0 = Math.floor(m.army[a] || 0);
          if (c0 > 0) w.garrison.troops[a] = (w.garrison.troops[a] || 0) + c0;
        }
      }
      res.mooring = w ? w.ci : null;
      /* 首批开拓物资只在**第一次**圈锚地时给（重复投送不会凭空长资源） */
      res.goods = (w && !had) ? U.deep(w.seedRes || {}) : {};
      GAME.log('🛬 投送抵达「' + (pl ? pl.name : ('星球 ' + m.pid)) + '」：'
        + (w ? ('圈下锚地（' + GAME.map.coordTextCi(w.ci) + '）—— ' + U.fmt(m.colonists) + ' 人 · '
          + U.fmt(res.troops) + ' 兵' + (had ? '' : ' + 首批开拓物资')) : '没有落脚点，人和兵随船返航'), 'sys', 'admin');
    }
    return res;
  };

  /* ---------- 返航 ---------- */
  CO._returnHome = function (m) {
    var s = GAME.state;
    var city = GAME.cityById(m.fromCityId) || CO.cityAt(m.fromPid) || (s.cities || [])[0] || null;
    var back = { army: 0, goods: 0, pop: 0 };
    /* 兵：没在目标星球留下（无城无锚地）的随船回来；有落脚点时已入驻/驻防，不回 */
    if (!m._landedTroops && city) {
      for (var k in (m.army || {})) {
        var n = Math.floor(m.army[k] || 0);
        if (n > 0) { GAME.city.armyAdd(city, { [k]: n }); back.army += n; }
      }
    }
    /* 人：目标城住不下的那部分，随船回到出发城（同样封顶 —— 装不下就真的没地方去） */
    if (m._popLeft > 0 && city) {
      var _pp = addPopCapped(city, m._popLeft);
      back.pop = _pp.put;
      if (_pp.left > 0) {
        GAME.log('⚠ 投送返航：' + city.name + ' 也住不下，' + U.fmt(_pp.left) + ' 人自行散入荒野',
          'sys', 'admin');
      }
    }
    if (m.returnGoods && city) {
      for (var g in m.returnGoods) {
        var q = Math.floor(m.returnGoods[g] || 0);
        if (q > 0) { GAME.city.add(city, g, q, true); back.goods += q; }
      }
    }
    GAME.log('🏠 「' + ((SH.classOf(m.classId) || {}).name || m.classId) + '」投送归来'
      + (city ? ('：' + city.name) : '')
      + (back.army ? (' · 兵归 ' + U.fmt(back.army)) : '')
      + (back.pop ? (' · 人归 ' + U.fmt(back.pop)) : '')
      + (back.goods ? (' · 物资 ' + U.fmt(back.goods)) : ''), 'sys', 'admin');
    return back;
  };

  /* ---------- 主循环 tick（现实时间锚点 · 与 wonderTick 同规） ----------
     飞到点 → 结算（人/兵/锚地/回程货）；勘测后进返航段；返航到点 → 船靠港。 */
  CO.tick = function (now) {
    var s = GAME.state;
    if (!s || !s.interstellar || !s.interstellar.missions || !s.interstellar.missions.length) return 0;
    var t = (now == null ? U.now() : now);
    var st = CO.state(), keep = [], landed = 0;
    st.missions.forEach(function (m) {
      if (!m._arrived && t >= m.arriveAt) {
        var r = CO._arrive(m);
        m._arrived = true;
        m._landedTroops = !!(r.city || r.mooring);
        m.returnGoods = r.goods || {};
        landed++;
      }
      if (m.phase === 'out' && t >= m.arriveAt) m.phase = 'survey';
      if (m.phase === 'survey' && t >= CO.returnAtOf(m)) m.phase = 'back';
      if (t >= CO.returnAtOf(m)) { CO._returnHome(m); return; }
      keep.push(m);
    });
    st.missions = keep;
    return landed;
  };

  /* ---------- 降落前后：全船的兵在哪 ----------
     飞行中在船上；抵达后——有城入城防、有锚地进锚地、都没有随船返航；
     返航段已经在目的地落下的不算「船上」（避免"来回都算一遍"的重复入账）。 */
  CO.troopsAboard = function (m, now) {
    if (!m) return 0;
    var t = (now == null ? U.now() : now);
    if (t < m.arriveAt) return CO.armyN(m.army);
    if (m._landedTroops) return 0;
    return CO.armyN(m.army);
  };

  /* 撤销：前段飞行期内原路退人退兵（燃料不退） */
  CO.cancel = function (id) {
    var m = CO.byId(id);
    if (!m) return { ok: false, msg: '没有这次投送' };
    if (m._arrived || m.phase !== 'out') return { ok: false, msg: '已经抵达目标星球，不能中止（等它返航）' };
    var city = GAME.cityById(m.fromCityId) || CO.cityAt(m.fromPid);
    if (!city) return { ok: false, msg: '出发城已不在 —— 无法返航' };
    for (var k in (m.army || {})) {
      var n = Math.floor(m.army[k] || 0);
      if (n > 0) GAME.city.armyAdd(city, { [k]: n });
    }
    if (m.colonists > 0) GAME.city.add(city, 'pop', m.colonists);
    CO.state().missions = CO.state().missions.filter(function (x) { return x !== m; });
    GAME.log('↩️ 投送中止：「' + ((SH.classOf(m.classId) || {}).name || m.classId)
      + '」折返 ' + city.name + '（人/兵已归，燃料不退）', 'sys', 'admin');
    return { ok: true, msg: '已中止并折返（人/兵归城，燃料不退）' };
  };

  /* 船是否在外（界面与 SH.canUpgrade/scrap 共读） */
  CO.shipBusy = function (shipId) { return !!CO.busyOf(shipId); };

  /* ---------- 跨星调运拦截（陆路到不了另一颗球） ---------- */
  CO.blockTransfer = function (fromId, toId) {
    var a = GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(fromId) : GAME.cityById(fromId);
    var b = GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(toId) : GAME.cityById(toId);
    if (a && b && GAME.pidOf(a) !== GAME.pidOf(b)) {
      return { ok: false, msg: '两座城不在同一颗星球 —— 跨星补给请走空间站「星际投送」' };
    }
    return null;
  };

  /* 补给线 / 立城资金（新星球不能白手起家）——
     定义在 domain.js（GAME.colonyFundOf / colonySupplyChk / colonyMooringAfford / colonyMooringPay），
     因为 `canBuildCityAt` 也在那里；本文件只管投送本身。 */

  /* ============================================================
   * 自注册（registry.js · v100 可插拔）
   * ⚠️ 只登记、不推进：投送按**现实钟**走（state.tickOnce 里直接调 CO.tick），
   *    不能等换月；tick 留空 = 让 registry.stats 能看见本模块。
   * ============================================================ */
  if (GAME.reg) {
    GAME.reg.add({ id: 'colony', order: 66, tick: function () {} });
  }
})();
