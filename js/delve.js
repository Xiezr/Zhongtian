/* ============================================================
 * delve.js — 地下远征：逐层，死了就没了（v95 · E roguelike）
 * ------------------------------------------------------------
 * 提案原话：「派 3 将进地下遗迹，每层随机事件，**死了永久损失**
 *   —— 现在没有任何永久损失，所以没有紧张感」。
 *
 * 做法（最小可玩版）：
 *   · 选 1–3 名将领带一批兵下去，一层一层推进（每推一层算一次账）；
 *   · 每层四类事件：遭遇（掉兵/伤将）、遗物（材料）、空房（无事）、塌方（丢东西）；
 *   · **随时可以撤**，撤回带走七成；继续往下，收益翻倍、风险也翻倍；
 *   · 打到第 5 层，深处的东西一次全拿。
 *
 * 为什么这是"唯一能装永久损失的容器"：
 *   将领在这游戏里不会死，所以损失只能落在**兵**与**装备/材料**上。
 *   掉兵是永久的（伤兵要养），丢材料是永久的（背包里没了）。
 *   而"再下一层还是收手"每层都要重新决定 —— 这是最纯粹的取舍。
 *
 * ⚠️ 不做"将领永久死亡"：整个游戏的将领体系（培养/羁绊/装备）都建立在
 *    "将不会死"上，动它会连锁崩掉忠诚、名册、战报。留作单独一版讨论。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var DV = GAME.delve = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.DELVE) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.delve || typeof s.delve !== 'object') s.delve = { run: null, done: 0 };
    return s.delve;
  }

  DV.runOf = function () { var d = st0(); return d ? d.run : null; };
  /* ============================================================
   * start —— 带人下去
   * ============================================================ */
  DV.start = function (genIds, cityId, troopN) {
    var d = st0();
    if (!d) return { ok: false, msg: '无存档' };
    if (d.run) return { ok: false, msg: '已经有一支队伍在下面' };
    var ids = (genIds || []).filter(function (x) { return !!x; }).slice(0, D().maxCrew || 3);
    if (!ids.length) return { ok: false, msg: '至少要带一名将领' };
    var city = GAME.city && GAME.city.byId ? GAME.city.byId(cityId) : null;
    if (!city) return { ok: false, msg: '没有这座城' };
    var n = Math.max(50, Math.round(troopN || 300));
    if ((GAME.city.armyTotal(city) || 0) < n) return { ok: false, msg: '城里兵不够（要 ' + n + '）' };
    /* 扣兵（走唯一出口） */
    var total = GAME.city.armyTotal(city), cut = Math.min(n, total);
    var a = city.army || {};
    for (var k in a) {
      var v = Math.floor(a[k] || 0);
      if (v <= 0) continue;
      var part = Math.floor(cut * v / total);
      if (part > 0) { var o = {}; o[k] = part; if (GAME.city.armySub) GAME.city.armySub(city, o); }
    }
    d.run = {
      cityId: city.id, crew: ids, troops: n, layer: 0,
      loot: { grain: 0, iron: 0, wood: 0 }, mats: {}, log: [], at: Date.now()
    };
    return { ok: true, msg: n + ' 人下到第一层。' };
  };

  /* ============================================================
   * push —— 下一层
   * ------------------------------------------------------------
   * 事件用固定种子（ci + 层数），同一局重开不会变 —— 便于复盘。
   * ============================================================ */
  DV.push = function () {
    var d = st0();
    if (!d || !d.run) return { ok: false, msg: '没有在进行的远征' };
    var r = d.run, cfg = D();
    if (r.layer >= (cfg.layers || 5)) return { ok: false, msg: '已经到底了，只能撤' };
    r.layer++;

    var seed = 'delve|' + r.cityId + '|' + r.layer + '|' + r.at;
    var roll = GAME.invasionRoll ? GAME.invasionRoll(seed) : Math.random();
    var roll2 = GAME.invasionRoll ? GAME.invasionRoll(seed + 'b') : Math.random();

    var risk = (cfg.riskPerLayer || 0.16) * r.layer;
    var gainMul = 1 + (cfg.lootPerLayer || 1.6) * (r.layer - 1) * 0.35;
    var ev = null;

    if (roll < 0.34) {
      /* 遭遇：掉兵 */
      var dead = Math.round(r.troops * risk * (0.5 + roll2));
      dead = Math.min(r.troops - 1, Math.max(1, dead));
      r.troops -= dead;
      ev = { t: 'fight', msg: '第 ' + r.layer + ' 层遭遇：折了 ' + U.numText(dead, 0) + ' 人' };
    } else if (roll < 0.72) {
      /* 遗物：拿材料与资源 */
      var g = Math.round(80 * gainMul * (0.7 + roll2 * 0.6));
      r.loot.grain += g;
      r.loot.iron += Math.round(g * 0.6);
      r.loot.wood += Math.round(g * 0.5);
      ev = { t: 'loot', msg: '第 ' + r.layer + ' 层翻到库房：粮 ' + U.numText(g, 0) + '，铁木各一份' };
    } else if (roll < 0.86) {
      /* 塌方：丢东西（已有的战利品） */
      var lost = Math.round(r.loot.grain * 0.3);
      r.loot.grain = Math.max(0, r.loot.grain - lost);
      r.loot.iron = Math.round(r.loot.iron * 0.7);
      r.loot.wood = Math.round(r.loot.wood * 0.7);
      ev = { t: 'cave', msg: '第 ' + r.layer + ' 层塌方：丢了 ' + U.numText(lost, 0) + ' 粮和一部分铁木' };
    } else {
      ev = { t: 'empty', msg: '第 ' + r.layer + ' 层是空的（有人先来过）' };
    }
    r.log.push(ev);

    /* 到底：一次性大丰收 */
    if (r.layer >= (cfg.layers || 5)) {
      var bonus = Math.round(200 * gainMul);
      r.loot.grain += bonus; r.loot.iron += Math.round(bonus * 0.8);
      r.loot.wood += Math.round(bonus * 0.6);
      r.log.push({ t: 'deep', msg: '走到底了：核心库房打开，粮 ' + U.numText(bonus, 0) + ' 与一批铁木' });
    }
    return { ok: true, ev: ev, run: r };
  };

  /* ============================================================
   * retreat —— 收手（带走七成）
   * ============================================================ */
  DV.retreat = function () {
    var d = st0();
    if (!d || !d.run) return { ok: false, msg: '没有在进行的远征' };
    var r = d.run, cfg = D();
    var keep = cfg.retreatLoot == null ? 0.7 : cfg.retreatLoot;
    var city = GAME.city && GAME.city.byId ? GAME.city.byId(r.cityId) : null;

    var got = { grain: Math.round(r.loot.grain * keep), iron: Math.round(r.loot.iron * keep), wood: Math.round(r.loot.wood * keep) };
    if (city && GAME.city.add) {
      for (var k in got) if (got[k] > 0) GAME.city.add(city, k, got[k]);
      if (r.troops > 0) {
        /* 人回来（剩余的都算，伤兵由 veteran 另算 —— 这里只回城） */
        var a = city.army || {}, keys = Object.keys(a);
        var tk = keys.length ? keys[0] : 'inf';
        var o = {}; o[tk] = r.troops;
        if (GAME.city.armyAdd) GAME.city.armyAdd(city, o);
      }
    }
    d.done = (d.done | 0) + 1;
    d.run = null;
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🚪 远征队上来了：带回粮 ' + U.numText(got.grain, 0) + ' · 铁 ' + U.numText(got.iron, 0)
        + ' · 木 ' + U.numText(got.wood, 0) + '（' + r.troops + ' 人回来）');
    }
    return { ok: true, msg: '撤回来了，带回七成。', got: got };
  };

  /* 一行摘要 */
  DV.lineOf = function () {
    var r = DV.runOf();
    if (!r) return '';
    return '🕳 远征队在第 ' + r.layer + ' 层（' + r.troops + ' 人 · 已带回粮 ' + U.numText(r.loot.grain, 0) + '）';
  };
})();
