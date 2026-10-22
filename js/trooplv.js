/* ============================================================
 * trooplv.js — 兵员等级：一级斥候、二级斥候（v96）
 * ------------------------------------------------------------
 * 老板 2026-10-22：「老兵新兵是不是以用兵员等级表示，一级斥候，二级斥候，
 *   分三到五级……不同任务对级别有要求，或者不同等级有属性加成」。
 *
 * 上一版（veteran.js）记的是"这支队伍打了多少仗"（经验值），
 * 那是**一支部队的历史**；老板要的是**兵员本身的档位**。
 * 两者不冲突：经验决定"打过多硬"，等级决定"训到什么程度"。
 * 这一版把等级做出来，经验保留（老兵加成还在）。
 *
 * 关键设计（为什么这么定）：
 *   · 等级挂在 **城 × 兵种** 上（`city.troopLv[troopId] = 1..5`），
 *     **不改 `city.army` 的结构** —— 那是 `{兵种: 数量}`，全仓 100+ 个读点，
 *     改成 `{兵种: {等级: 数量}}` 一定会炸在某个没人看的分支里。
 *   · 一座城把一个兵种训到 Lv3，这座城**所有**该兵种都是 Lv3（含新补的兵）。
 *     语义清楚："你这座城的步行机是三级的"，而不是"这一坨兵里有几个三级"。
 *   · 等级**真的进战斗**：`tactic.unitsOf` 按 `lvMap` 给生命/攻/防加成，
 *     不是只战力面板上好看（显示与实战分离是本项目明令禁止的）。
 *   · 等级同时是**任务门槛**：奇袭要 Lv3、地下远征要 Lv2、奇观深层要 Lv4。
 *     于是"整训"不是可选项 —— 想打某种仗，得先把兵练上去。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var LV = GAME.trooplv = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.TROOPLV) || {}; }
  function maxLv() { return D().maxLv || 5; }

  /* v97：**这座城**的上限会被"惰性"压住（`idle.js`）。
     "照顾得太好"的城练不出精锐 —— 这是设定灵魂那一条的落点。 */
  function capOf(city) {
    var top = maxLv();
    if (GAME.idle && GAME.idle.maxLvOf) top = Math.min(top, GAME.idle.maxLvOf(city));
    return Math.max(1, top);
  }
  LV.capOf = capOf;

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.troopLv || typeof s.troopLv !== 'object') s.troopLv = {};
    return s;
  }

  /* 某城某兵种的等级（默认 1） */
  LV.of = function (city, troopId) {
    var s = st0();
    if (!s || !city) return 1;
    var m = s.troopLv[city.id];
    if (!m || !troopId) return 1;
    return Math.max(1, Math.min(capOf(city), m[troopId] | 0 || 1));
  };

  /* 某城所有兵种的等级表 —— 直接喂给 `tactic.unitsOf` 的 lvMap */
  LV.mapOf = function (city) {
    var s = st0();
    if (!s || !city) return null;
    var m = s.troopLv[city.id];
    return m ? m : null;
  };

  /* 属性乘子：每级 +7%（生命/攻/防同一把尺） */
  LV.mulOf = function (lv) {
    var per = D().gainPerLv == null ? 0.07 : D().gainPerLv;
    return 1 + per * (Math.max(1, lv || 1) - 1);
  };

  /* ============================================================
   * 整训成本 —— 按"这一级要训多少人"算
   * ------------------------------------------------------------
   * 用城里该兵种的**实际数量**作基数：兵越多越贵。
   * 于是"先练一个精锐兵种"和"练一个大兵种"是两笔不同量级的账。
   * ============================================================ */
  LV.costOf = function (city, troopId) {
    if (!city) return null;
    var lv = LV.of(city, troopId);
    if (lv >= capOf(city)) return null;
    var n = Math.max(1, Math.floor((city.army || {})[troopId] || 0));
    var per = D().baseCostPerLv == null ? 40 : D().baseCostPerLv;
    var ladder = D().costLadder || [0, 1, 2.2, 4.2, 7.5, 12];
    var k = ladder[lv] || (lv * 2);
    var total = Math.round(n * per * k);
    /* 四类资源均摊（兵是"铁+粮+木+石"养出来的） */
    return {
      grain: Math.round(total * 0.25), wood: Math.round(total * 0.2),
      stone: Math.round(total * 0.25), iron: Math.round(total * 0.3),
      total: total, to: lv + 1
    };
  };

  /* ============================================================
   * up —— 整训一级
   * ------------------------------------------------------------
   * 前置：军营等级（`needBarrack`）+ 资源。
   * 不做"训练时间"：等级是城的长期属性，加个 3 天倒计时只会让玩家等，
   * 而这次升级的"代价"已经由**资源量级**表达了。
   * ============================================================ */
  LV.up = function (city, troopId) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var t = (GAME.DATA.TROOPS || {})[troopId];
    if (!t) return { ok: false, msg: '没有这个兵种' };
    var lv = LV.of(city, troopId);
    var cap = capOf(city);
    if (lv >= cap) {
      var why = (cap < maxLv()) ? ('（这座城的人被照顾惯了，上限被惰性压到 Lv' + cap + '）') : '（上限）';
      return { ok: false, msg: t.name + '已经训到 Lv' + cap + why };
    }
    if (Math.floor((city.army || {})[troopId] || 0) <= 0) {
      return { ok: false, msg: '城里没有' + t.name + ' —— 先造一批再整训' };
    }
    var need = (D().needBarrack || [0, 1, 3, 5, 7])[lv] || 1;
    var bar = GAME.buildingLevel ? (GAME.buildingLevel(city, 'junying') || 0) : 0;
    if (bar < need) {
      return { ok: false, msg: '军营要到 Lv' + need + ' 才能整训到 ' + (lv + 1) + ' 级（现在 Lv' + bar + '）' };
    }
    var cost = LV.costOf(city, troopId);
    if (!cost) return { ok: false, msg: '已经满级' };
    var R = GAME.res(city), lack = [];
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
      if ((R[k] || 0) < cost[k]) lack.push((GAME.resName ? GAME.resName(k) : k) + ' ' + U.numText(cost[k], 0));
    });
    if (lack.length) return { ok: false, msg: '缺 ' + lack.join('、') };

    /* ⚠️ 扣资源一律 `city.sub`（`add` 对负数直接返回 0） */
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
      if (GAME.city.sub) GAME.city.sub(city, k, cost[k]);
    });
    var s = st0();
    s.troopLv[city.id] = s.troopLv[city.id] || {};
    s.troopLv[city.id][troopId] = lv + 1;
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🪖 ' + city.name + '的' + t.name + '整训完成：Lv' + lv + ' → Lv' + (lv + 1)
        + '（生/攻/防 +' + Math.round((D().gainPerLv || 0.07) * 100 * (lv + 1 - 1)) + '%）');
    }
    return { ok: true, msg: t.name + ' 升到 Lv' + (lv + 1) + '（全军该兵种生效）。' };
  };

  /* ============================================================
   * 任务门槛 —— "想打这种仗，先把兵练上去"
   * ------------------------------------------------------------
   * 只对**已经存在的任务**加门槛，不新造任务：
   *   scout（侦察）     Lv1（不设门槛，保持开局可侦察）
   *   behead（斩首目标）Lv2
   *   delve（地下远征） Lv2
   *   raiddeep（奇袭）  Lv3
   *   wonderDeep（奇观深层）Lv4
   * ============================================================ */
  LV.needOf = function (taskId) {
    return ((D().tasks || {})[taskId]) || 0;
  };

  /* 这座城打这个任务够不够级 —— 返回 { ok, need, have, worst } */
  LV.checkCity = function (city, taskId, troopIds) {
    var need = LV.needOf(taskId);
    if (!need) return { ok: true, need: 0, have: 99 };
    var ids = troopIds || Object.keys((city && city.army) || {});
    var worst = null;
    for (var i = 0; i < ids.length; i++) {
      var lv = LV.of(city, ids[i]);
      if (!worst || lv < worst.lv) worst = { id: ids[i], lv: lv };
    }
    if (!ids.length) return { ok: false, need: need, have: 0, worst: null, msg: '没有兵' };
    var have = worst ? worst.lv : 1;
    return {
      ok: have >= need, need: need, have: have, worst: worst,
      msg: have >= need ? '' : ('「' + (TASK_NAME[taskId] || taskId) + '」要求兵员 Lv' + need
        + '，' + city.name + '最低的是 ' + (worst ? (((GAME.DATA.TROOPS || {})[worst.id] || {}).name || worst.id) : '—')
        + ' Lv' + have)
    };
  };

  var TASK_NAME = {
    scout: '侦察', behead: '斩首', raiddeep: '奇袭', delve: '地下远征', wonderDeep: '奇观深层'
  };

  /* ============================================================
   * 一行摘要（城面板 / 玩法台）
   * ============================================================ */
  LV.lineOf = function (city) {
    if (!city) return '';
    var a = city.army || {}, keys = Object.keys(a).filter(function (k) { return (a[k] | 0) > 0; });
    if (!keys.length) return '兵员：无兵';
    var seg = keys.map(function (k) {
      var t = (GAME.DATA.TROOPS || {})[k] || {};
      return (t.name || k) + ' Lv' + LV.of(city, k);
    });
    return '🪖 ' + seg.join(' · ');
  };
})();
