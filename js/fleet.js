/* ============================================================
 * js/fleet.js — **舰队战 / 深空远征**（v146 · 星际战舰 F 期）
 * ------------------------------------------------------------
 * 设计提案 5-C：「派舰队去深空目标 → 遭遇战 → 带回蓝图/资源 · 3 个深空点 + 1 个 Boss」。
 *
 * 三段循环：
 *   ① 编成 —— 从船坞里挑 1~5 艘组一支舰队（旗舰 = 第一艘；坏旗舰会掉士气）
 *   ② 远征 —— 舰队离港（舰船锁住：不能拆、不能升部件、不能投送），按**现实时间**飞
 *   ③ 交战 —— 抵达即打一场**确定性回合战**（同 seed 同结果：可以复算、可以测试）
 *             赢 → 战利品入账 + 舰队返航；输 → 折掉一部分舰（真损失），余舰返航
 *
 * 口径（与全仓一致）：
 *   · 舰队属性全部由 `SH.statsOf` **逐舰汇总**得来 —— 不另造第二套舰船数值
 *   · 伤害走与斗将同一把尺 `clash = K·A/(A+D)`（`DATA.CLASH.K`），护甲按 `armorScale` 折算
 *   · 抖动走 `GAME.invasionRoll(键)`（确定性哈希），不读 Math.random —— 战报可复算
 *   · 数值全在 `DATA.DS`（可玩初值 · 待老板复核）
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

  var FL = GAME.fleet = {};

  function D() { return (DATA && DATA.DS) || {}; }
  function cfg(k, dflt) { var v = D()[k]; return v == null ? dflt : v; }

  /* ---------- 状态（顶层 · 惰性建 · 老档零迁移） ---------- */
  FL.state = function () {
    var s = GAME.state;
    if (!s) return { fleets: [], cleared: {}, _seq: 0 };
    s.ds = s.ds || { fleets: [], cleared: {}, _seq: 0 };
    if (!Array.isArray(s.ds.fleets)) s.ds.fleets = [];
    if (!s.ds.cleared || typeof s.ds.cleared !== 'object') s.ds.cleared = {};
    if (s.ds._seq == null) s.ds._seq = 0;
    return s.ds;
  };
  FL.fleets = function () { return FL.state().fleets.slice(); };
  FL.history = function () { return (FL.state().history || []).slice(); };
  FL.fleetOf = function (id) {
    var out = null;
    FL.state().fleets.forEach(function (f) { if (f.id === id) out = f; });
    return out;
  };
  /* 这艘船现在在哪支舰队里（含已返航的编成态） */
  FL.fleetOfShip = function (shipId) {
    var out = null;
    FL.state().fleets.forEach(function (f) {
      if (!out && f.ships.indexOf(shipId) >= 0) out = f;
    });
    return out;
  };
  FL.busyOf = function (shipId) {
    var f = FL.fleetOfShip(shipId);
    return f || null;
  };

  /* ---------- 深空目标（唯一清单） ---------- */
  FL.targets = function () { return (D().targets || []).slice(); };
  FL.targetOf = function (id) {
    var out = null;
    FL.targets().forEach(function (t) { if (t.id === id) out = t; });
    return out;
  };

  /* ---------- 舰队属性（逐舰汇总 · 唯一出口） ---------- */
  FL.statsOf = function (fleet) {
    var out = { atk: 0, hp: 0, shield: 0, armor: 0, eva: 0, n: 0, ships: [] };
    (fleet && fleet.ships || []).forEach(function (id) {
      var sh = null;
      SH.ships().forEach(function (x) { if (x.id === id) sh = x; });
      if (!sh) return;
      var st = SH.statsOf(sh);
      out.atk += st.atk || 0;
      out.hp += st.hp || 0;
      out.shield += st.shield || 0;
      out.armor += st.armor || 0;
      out.eva += st.eva || 0;
      out.n++;
      out.ships.push({ id: id, classId: sh.classId, atk: st.atk || 0, hp: st.hp || 0 });
    });
    out.eva = out.n ? out.eva / out.n : 0;      /* 全队平均闪避（逐舰相加会失真） */
    /* 旗舰受损/阵亡 → 士气掉（−20% 攻 —— 可预期、可规避：把厚船放第一位） */
    if (fleet && fleet.flagshipLost) out.atk = Math.round(out.atk * 0.8);
    return out;
  };
  FL.powerOf = function (fleet) {
    var s = FL.statsOf(fleet);
    return Math.round(s.atk * 2 + s.hp * 0.5 + s.shield * 0.4 + s.armor * 10);
  };
  FL.flightMsOf = function (target) {
    var t = (target && target.flightSec) || cfg('flightSec', 1800);
    return Math.max(1, Math.round(t * 1000));
  };

  /* ============================================================
   * v148 · **阵位**（设计提案 5-B「角色互补」的最小可玩版）
   * ------------------------------------------------------------
   * 三个位子各一艘；**只有对口舰种才吃到加成**（不对口 = 空占位、零加成）。
   *   slotOf(fleet)      → { van, mid, rear } 舰 id（缺省按舰种自动落位）
   *   formationOf(fleet) → { atkAdd, dmgCut, lootAdd, used[] }
   * 界面与战斗都只读这两个出口 —— 不会"面板上一个数、打的时候另一个数"。
   * ============================================================ */
  var SLOT_ORDER = ['van', 'mid', 'rear'];
  function roleOfShip(id) {
    var cls = null;
    SH.ships().forEach(function (x) { if (x.id === id) cls = SH.classOf(x.classId); });
    return cls ? cls.role : null;
  }
  function shipNameOf(id) {
    var cls = null;
    SH.ships().forEach(function (x) { if (x.id === id) cls = SH.classOf(x.classId); });
    return cls ? cls.name : id;
  }
  /* 自动落位：把**第一艘**对口舰放进对应位子（其余同系舰是候补） */
  FL.autoSlots = function (fleet) {
    var out = { van: null, mid: null, rear: null };
    var P = cfg('positions', {}) || {};
    (fleet && fleet.ships || []).forEach(function (id) {
      var role = roleOfShip(id);
      SLOT_ORDER.forEach(function (k) {
        if (out[k]) return;
        if (P[k] && P[k].role === role) out[k] = id;
      });
    });
    return out;
  };
  FL.slotOf = function (fleet) {
    var auto = FL.autoSlots(fleet);
    var cur = (fleet && fleet.slots) || {};
    var out = {};
    SLOT_ORDER.forEach(function (k) {
      var v = cur[k];
      out[k] = (v && (fleet.ships || []).indexOf(v) >= 0) ? v : auto[k];
    });
    return out;
  };
  FL.formationOf = function (fleet) {
    var P = cfg('positions', {}) || {}, slot = FL.slotOf(fleet);
    var out = { atkAdd: 0, dmgCut: 0, lootAdd: 0, used: [] };
    SLOT_ORDER.forEach(function (k) {
      var def = P[k] || {};
      var sid = slot[k], ok = false;
      if (sid && roleOfShip(sid) === def.role) {
        ok = true;
        out.atkAdd += (def.atkAdd || 0);
        out.dmgCut += (def.dmgCut || 0);
        out.lootAdd += (def.lootAdd || 0);
      }
      out.used.push({ slot: k, name: def.name || k, role: def.role || '',
        shipId: sid, shipName: sid ? shipNameOf(sid) : null, ok: ok, desc: def.desc || '' });
    });
    return out;
  };
  /* 在位子上轮换候选舰（点一下换下一艘） */
  FL.cycleSlot = function (fleetId, slotKey) {
    var f = FL.fleetOf(fleetId);
    if (!f) return { ok: false, msg: '没有这支舰队' };
    if (f.phase !== 'ready') return { ok: false, msg: '舰队已出发 —— 返航后再调整阵位' };
    var P = cfg('positions', {}) || {}, def = P[slotKey];
    if (!def) return { ok: false, msg: '没有这个阵位' };
    var cands = (f.ships || []).filter(function (id) { return roleOfShip(id) === def.role; });
    if (!cands.length) return { ok: false, msg: '队里没有' + ((SH.roleOf(def.role) || {}).name || '') + '系舰 —— 这个位子空着' };
    var slot = FL.slotOf(f);
    var next = cands[(cands.indexOf(slot[slotKey]) + 1) % cands.length];
    f.slots = f.slots || {};
    f.slots[slotKey] = next;
    return { ok: true, msg: def.name + ' → ' + shipNameOf(next), shipId: next };
  };

  /* ---------- 编成 ---------- */
  FL.canForm = function (opts) {
    opts = opts || {};
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var ids = (opts.shipIds || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (!ids.length) return { ok: false, msg: '至少选 1 艘舰' };
    var maxN = cfg('maxShips', 5);
    if (ids.length > maxN) return { ok: false, msg: '一支舰队最多 ' + maxN + ' 艘' };
    var tgt = FL.targetOf(opts.targetId);
    if (!tgt) return { ok: false, msg: '请选深空目标' };
    var dock = {};
    SH.ships().forEach(function (x) { dock[x.id] = x; });
    for (var i = 0; i < ids.length; i++) {
      var sh = dock[ids[i]];
      if (!sh) return { ok: false, msg: '船坞里没有这艘舰（' + ids[i] + '）' };
      if (FL.fleetOfShip(ids[i])) return { ok: false, msg: '该舰已在舰队中' };
      if (GAME.colony && GAME.colony.busyOf && GAME.colony.busyOf(ids[i])) {
        return { ok: false, msg: '该舰正在星际投送' };
      }
    }
    return { ok: true, ships: ids, target: tgt };
  };
  FL.form = function (opts) {
    var chk = FL.canForm(opts);
    if (!chk.ok) return chk;
    var st = FL.state();
    st._seq += 1;
    var fleet = {
      id: 'fl' + st._seq,
      name: String(opts.name || '').trim().slice(0, 10) || ('远征队 ' + st._seq),
      ships: chk.ships.slice(),
      slots: FL.autoSlots({ ships: chk.ships }),      /* v148：按舰种自动落位 */
      fromCityId: (GAME.currentCity() || {}).id || null,
      targetId: chk.target.id,
      flagshipLost: false,
      phase: 'ready',              /* ready → out → back */
      departAt: 0, arriveAt: 0, returnAt: 0,
      log: [], result: null,
    };
    st.fleets.push(fleet);
    return { ok: true, msg: '已编成「' + fleet.name + '」（' + fleet.ships.length + ' 艘）', fleet: fleet };
  };
  FL.disband = function (id) {
    var f = FL.fleetOf(id);
    if (!f) return { ok: false, msg: '没有这支舰队' };
    if (f.phase !== 'ready') return { ok: false, msg: '舰队已出发 —— 等它返航后再解散' };
    FL.state().fleets = FL.state().fleets.filter(function (x) { return x !== f; });
    return { ok: true, msg: '已解散「' + f.name + '」' };
  };

  /* ---------- 交战（纯函数 · 确定性） ----------
     同 (fleet 属性, 目标, seed) → 逐位同结果（测试与战报复算共用）。
     返回 { win, rounds, rows, loot, lostShips, hpLeft, damage } */
  FL.battle = function (mine, target, seed) {
    var T = target || {};
    var K = ((DATA.CLASH || {}).K == null ? 2 : DATA.CLASH.K);
    var armorScale = cfg('armorScale', 20);
    var atkMul = cfg('atkMul', 1.7);
    var eAtkMul = cfg('eAtkMul', 1.2);
    var maxR = cfg('maxRounds', 10);
    var jitterAmt = cfg('jitter', 0.12);
    function clash(A, Dv) {
      A = Math.max(0, A || 0); Dv = Math.max(0, Dv || 0);
      if (A + Dv <= 0) return 1;
      return K * A / (A + Dv);
    }
    function roll(key) {
      return GAME.invasionRoll ? GAME.invasionRoll(key) : 0.5;
    }
    var hp0 = Math.max(1, mine.hp || 1), hp = hp0, shield = Math.max(0, mine.shield || 0);
    var eHp = Math.max(1, T.hp || 1), eShield = Math.max(0, T.shield || 0);
    var rows = [], round = 0, win = false;
    for (var i = 0; i < maxR; i++) {
      round = i + 1;
      var jO = 1 + (roll('dsj|' + seed + '|o|' + round) * 2 - 1) * jitterAmt;
      var jE = 1 + (roll('dsj|' + seed + '|e|' + round) * 2 - 1) * jitterAmt;
      /* 我方输出：舰队掉血 → 火力衰减（最低留 35%，避免"越打越没输出"的死循环） */
      var effAtk = Math.max(1, Math.round((mine.atk || 1) * (0.35 + 0.65 * hp / hp0)));
      var dmgE = Math.max(1, Math.round(
        effAtk * atkMul * clash(effAtk, (T.def || 0) * armorScale) * jO));
      /* 敌方输出：护甲按 armorScale 折算；全队平均闪避减伤（最多一半） */
      var evaCut = Math.min(0.5, Math.max(0, mine.eva || 0));
      var dmgM = Math.max(1, Math.round(
        (T.atk || 1) * eAtkMul * clash(T.atk || 1, (mine.armor || 0) * armorScale) * jE
        * (1 - evaCut) * (1 - Math.min(0.5, Math.max(0, mine.dmgCut || 0)))));   /* v148 前卫挡伤 */
      /* 护盾先吃伤害 */
      var toShield = Math.min(eShield, dmgE); eShield -= toShield; eHp = Math.max(0, eHp - (dmgE - toShield));
      var toShield2 = Math.min(shield, dmgM); shield -= toShield2; hp = Math.max(0, hp - (dmgM - toShield2));
      rows.push({ r: round, dmgToEnemy: dmgE, dmgToFleet: dmgM, enemyHp: eHp, fleetHp: hp,
        enemyShield: eShield, fleetShield: shield });
      if (eHp <= 0) { win = true; break; }
      if (hp <= 0) { win = false; break; }
    }
    var loot = {};
    if (win) {
      /* v148 后卫（母舰压后阵）：战利品 +X% —— 逐项向下取整（不凭空多出零头） */
      var lm = 1 + Math.max(0, mine.lootAdd || 0);
      var gm = function (m) {
        var o = {};
        for (var k in (m || {})) {
          var n = Math.floor((m[k] || 0) * lm + 1e-9);
          if (n > 0) o[k] = n;
        }
        return o;
      };
      loot.items = gm((T.loot && T.loot.items) || {});
      loot.res = gm((T.loot && T.loot.res) || {});
    }
    var lost = [];
    /* v146：选了「深空无响应」→ 沉船也不折舰（代价已用全境产出付过 —— 唯一出口读 ending） */
    if (!win && hp <= 0 && !(GAME.ending && GAME.ending.fleetNoLoss && GAME.ending.fleetNoLoss())) {
      /* 输了才真掉舰：最多一半（向上取整），旗舰最后掉 —— 先掉僚舰，可预期的编成代价 */
      var n = Math.max(1, Math.ceil((mine.n || 1) * (cfg('lossPct', 0.5))));
      lost = (mine.ships || []).slice().reverse().slice(0, n).map(function (s) { return s.id; });
    }
    return { win: win, rounds: round, rows: rows, loot: loot, lostShips: lost,
      hpLeft: hp, shieldLeft: shield, enemyHpLeft: eHp, timeout: !win && hp > 0 };
  };

  /* 我方舰队 → 一场战斗的输入（纯数据，测试可自造）。
     v148：**阵位加成在这里折算** —— 同一条数据既给界面预览、也给战斗结算。 */
  FL.mineOf = function (fleet) {
    var st = FL.statsOf(fleet);
    var fm = FL.formationOf(fleet);
    return { atk: Math.round(st.atk * (1 + (fm.atkAdd || 0))), hp: st.hp, shield: st.shield,
      armor: st.armor, eva: st.eva, n: st.n, ships: st.ships,
      dmgCut: fm.dmgCut || 0, lootAdd: fm.lootAdd || 0,
      formation: fm.used };
  };

  /* ---------- 出征 / 返航 ---------- */
  FL.canLaunch = function (id) {
    var f = FL.fleetOf(id);
    if (!f) return { ok: false, msg: '没有这支舰队' };
    if (f.phase !== 'ready') return { ok: false, msg: '舰队已出发' };
    if (!f.ships.length) return { ok: false, msg: '舰队里没有舰' };
    return { ok: true, fleet: f, target: FL.targetOf(f.targetId) };
  };
  FL.launch = function (id) {
    var chk = FL.canLaunch(id);
    if (!chk.ok) return chk;
    var f = chk.fleet, now = U.now();
    f.phase = 'out';
    f.departAt = now;
    f.arriveAt = now + FL.flightMsOf(chk.target);
    f.returnAt = 0;
    GAME.log('🌌 舰队「' + f.name + '」出港 → ' + chk.target.name + '（' + f.ships.length
      + ' 艘 · 战力 ' + U.fmt(FL.powerOf(f)) + '）', 'sys', 'admin');
    return { ok: true, msg: '已出港（单程 ' + U.dur(FL.flightMsOf(chk.target) / 1000) + '）', fleet: f };
  };
  /* 中止：出发后、交战前可召回（不损舰、无战利品） */
  FL.cancel = function (id) {
    var f = FL.fleetOf(id);
    if (!f) return { ok: false, msg: '没有这支舰队' };
    if (f.phase !== 'out') return { ok: false, msg: '只有"已在路上、还没打"的舰队能召回' };
    FL.state().fleets = FL.state().fleets.filter(function (x) { return x !== f; });
    GAME.log('↩️ 舰队「' + f.name + '」途中召回，舰船归港', 'sys', 'admin');
    return { ok: true, msg: '已召回（舰船归港 · 无战利品）' };
  };

  /* 抵达 → 打一场 → 记结果 → 进入返航段（现实时间锚点） */
  FL._resolve = function (f) {
    var tgt = FL.targetOf(f.targetId) || { name: '深空' };
    var seed = f.id + '|' + f.targetId + '|' + f.ships.join(',');
    var mine = FL.mineOf(f);
    var r = FL.battle(mine, tgt, seed);
    f.result = { win: r.win, rounds: r.rounds, timeout: r.timeout,
      hpLeft: r.hpLeft, enemyHpLeft: r.enemyHpLeft, loot: r.loot, lost: r.lostShips,
      target: f.targetId, targetName: tgt.name, rows: r.rows };
    f.log.push('⚔ 与「' + tgt.name + '」交战 ' + r.rounds + ' 回合：'
      + (r.win ? '全胜' : (r.timeout ? '未破（舰队撤回）' : '败退')));
    /* 损舰：从船坞永久移除 */
    var lostRows = [];
    r.lostShips.forEach(function (sid) {
      var ship = null;
      SH.ships().forEach(function (x) { if (x.id === sid) ship = x; });
      if (!ship) return;
      var cls = SH.classOf(ship.classId) || {};
      f.flagshipLost = f.flagshipLost || (f.ships[0] === sid);
      SH.state().ships = SH.state().ships.filter(function (x) { return x.id !== sid; });
      f.ships = f.ships.filter(function (x) { return x !== sid; });
      lostRows.push(cls.name || sid);
    });
    if (lostRows.length) f.log.push('💥 阵亡：' + lostRows.join('、'));
    /* 战利品：物品进背包，资源先记账（返航时并入出发城） */
    var loot = r.loot || {}, banked = { items: {}, res: {} };
    if (r.win) {
      for (var k in (loot.items || {})) {
        var q = Math.floor(loot.items[k] || 0);
        if (q > 0) { GAME.items.add(k, q); banked.items[k] = q; }
      }
      for (var rk in (loot.res || {})) {
        var rq = Math.floor(loot.res[rk] || 0);
        if (rq > 0) { f.carry = f.carry || {}; f.carry[rk] = (f.carry[rk] || 0) + rq; banked.res[rk] = rq; }
      }
      /* 首次清层：给一次性奖励（Boss 蓝图 —— 远征才有意义） */
      var first = (tgt.first || null);
      if (first && !FL.state().cleared[f.targetId]) {
        FL.state().cleared[f.targetId] = 1;
        for (var fk in (first.items || {})) {
          var fq = Math.floor(first.items[fk] || 0);
          if (fq > 0) { GAME.items.add(fk, fq); banked.items[fk] = (banked.items[fk] || 0) + fq; }
        }
        for (var frk in (first.res || {})) {
          var frq = Math.floor(first.res[frk] || 0);
          if (frq > 0) { f.carry = f.carry || {}; f.carry[frk] = (f.carry[frk] || 0) + frq; banked.res[frk] = (banked.res[frk] || 0) + frq; }
        }
        f.log.push('🏆 首次攻克「' + tgt.name + '」—— 额外战利品已入库');
      }
    }
    f.result.banked = banked;
    var itemsTxt = Object.keys(banked.items).map(function (k) {
      return ((DATA.ITEM_BY_ID || {})[k] || {}).name || k;
    }).join('、');
    var resTxt = Object.keys(banked.res).map(function (k) {
      return (GAME.resName ? GAME.resName(k) : k) + '×' + U.fmt(banked.res[k]);
    }).join('、');
    f.log.push((r.win ? '🌌 深空告捷' : '🌌 深空失利') + '：「' + f.name + '」对 ' + tgt.name
      + ' · ' + r.rounds + ' 回合'
      + (r.win ? ('　战利品 ' + ([itemsTxt, resTxt].filter(Boolean).join('、') || '无')) : '')
      + (r.lostShips.length ? ('　折舰 ' + lostRows.length + ' 艘') : ''), 'war');
    /* 战报留档（舰队归港后就删了，但"打过什么"要能回看 —— 最近 10 场） */
    FL.state().history = FL.state().history || [];
    FL.state().history.unshift({
      at: U.now(), fleet: f.name, target: f.targetId, targetName: tgt.name,
      win: !!r.win, timeout: !!r.timeout, rounds: r.rounds,
      lost: lostRows, loot: banked, rows: r.rows, hpLeft: r.hpLeft,
    });
    if (FL.state().history.length > 10) FL.state().history.length = 10;
    f.phase = 'back';
    var backMs = Math.max(1000, Math.round((f.arriveAt - f.departAt) * (cfg('returnPct', 0.4) || 0.4)));
    f.returnAt = U.now() + backMs;
    return f.result;
  };

  /* ---------- 主循环 tick（现实时间锚点 · 与 colony 同规） ---------- */
  FL.tick = function (now) {
    var s = GAME.state;
    if (!s || !s.ds || !s.ds.fleets || !s.ds.fleets.length) return 0;
    var t = (now == null ? U.now() : now);
    var st = FL.state(), keep = [], fought = 0;
    st.fleets.forEach(function (f) {
      if (f.phase === 'out' && t >= f.arriveAt) { FL._resolve(f); fought++; }
      if (f.phase === 'back' && t >= f.returnAt) {
        /* 归港：舰船解锁（从舰队移除）+ 资源并入出发城 */
        var city = GAME.cityById(f.fromCityId) || GAME.currentCity();
        if (city && f.carry) {
          var got = [];
          for (var k in f.carry) {
            var q = Math.floor(f.carry[k] || 0);
            if (q > 0) { GAME.city.add(city, k, q, true); got.push((GAME.resName ? GAME.resName(k) : k) + '×' + U.fmt(q)); }
          }
          if (got.length) GAME.log('🏠 「' + f.name + '」带回 ' + got.join('、') + ' → ' + city.name, 'sys', 'admin');
        }
        GAME.log('🏠 舰队「' + f.name + '」归港', 'sys', 'admin');
        return;
      }
      keep.push(f);
    });
    st.fleets = keep;
    return fought;
  };

  /* ---------- 队形预览（界面用：哪些舰在队里 / 谁旗舰） ---------- */
  FL.previewText = function (fleet) {
    var st = FL.mineOf(fleet);        /* v148：走同一份（含阵位）—— 预览与实战同数 */
    var used = (st.formation || []).filter(function (x) { return x.ok; });
    return st.n + ' 艘 · 攻 ' + U.fmt(st.atk) + ' · 血 ' + U.fmt(st.hp)
      + ' · 盾 ' + U.fmt(st.shield) + ' · 甲 ' + U.fmt(st.armor)
      + ' · 闪 ' + Math.round(st.eva * 100) + '%'
      + (used.length ? ' · 阵位 ' + used.map(function (x) { return x.name; }).join('/') : '');
  };

  /* ============================================================
   * 自注册（registry.js）
   * 与 colony 同规：只登记不推进（tickOnce 里直接调 FL.tick，按现实钟）。
   * ============================================================ */
  if (GAME.reg) {
    GAME.reg.add({ id: 'fleet', order: 67, tick: function () {} });
  }
})();
