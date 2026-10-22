/* ============================================================
 * muster.js — 兵源：人从哪来（v99）
 * ------------------------------------------------------------
 * 老板原话：「**兵种代价应当从控制来源，强化出路考虑。自然增长率降低，
 *   增加偶然得到的来源比如探索，战后，任务，天灾流民等，细化设定。
 *   的确是要让发展有代价，但是不用搞太多意义，意义过于沉重了**」
 *
 * 之前的问题不在"造兵太便宜"，而在 **"人"根本不是稀缺品**：
 *   `popGrowthOf = 上限 ÷ fillHours`，而 fillHours = 2 现实小时 ——
 *   人口两小时自动补满。于是：
 *     · 探索救回来的 600 个幸存者 → 两小时后你自己也长出来了，毫无意义
 *     · 战后收编的俘虏 → 一样
 *     · 「打完仗缺人」这件事，在日历上只是"等两小时"
 *
 * 这一版做了两件事：
 *   ① `POP_CFG.fillHours` 2 → 14（自然增长慢 7 倍，不能再靠"等"）
 *   ② 补上真正"从外面拿人"的几条路（本模块）：
 *        · 天灾流民 —— 寒潮 / 污染 / 民怨 / 战乱会把人赶出来，你得决定收不收
 *        · 战后逃生者 —— 敌军溃散时有人来投（不用付钱，量小）
 *        · 远征救出 —— 地下到底时救出来的人
 *      （"探索救幸存者"在遗迹翻找里早就有，这里不重复造）
 *
 * ⚠️ 刻意不做的：
 *   · 不写任何"废土的孤独/生存的意义"之类的话 —— 老板明确说意义太重了。
 *     每条来源只给一行日志：多少人、从哪来、花了什么。
 *   · 不做"必须接纳否则道德谴责"的设计：驱散是完全正当的省钱选择，
 *     代价只是名声（它会真的影响营地招募、纳贡价、村社意愿）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var MU = GAME.muster = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.MUSTER) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.muster || typeof s.muster !== 'object') s.muster = { pending: null, log: [] };
    if (!Array.isArray(s.muster.log)) s.muster.log = [];
    return s.muster;
  }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  function cities() { return (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : []; }
  function pickCity() {
    var a = cities();
    return a.length ? a[0] : null;
  }

  /* 记一笔账（面板显示"这个月人从哪来"） */
  function note(src, n, extra) {
    var m = st0();
    if (!m || !(n > 0)) return;
    m.log.push({ at: monthNow(), src: src, n: Math.round(n), x: extra || '' });
    if (m.log.length > 20) m.log = m.log.slice(-20);
  }

  /* 加人（受有效上限约束；返回实际加了几个） */
  function addPop(city, n) {
    if (!city || !(n > 0)) return 0;
    var R = GAME.res(city);
    var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
    var before = R.pop || 0;
    var after = cap > 0 ? Math.min(cap, before + n) : (before + n);
    R.pop = after;
    return Math.round(after - before);
  }

  /* 加兵：按"能拿枪的那部分"落地。没有兵种偏好时给最基础的步行机
     （它没有解锁门槛：`unlock.junying = 1`）。 */
  function addTroops(city, n) {
    if (!city || !(n > 0)) return {};
    var out = { buxingji: Math.round(n) };
    if (GAME.city && GAME.city.armyAdd) GAME.city.armyAdd(city, out);
    return out;
  }

  /* ============================================================
   * 流民：出现概率吃四个"天灾人祸"
   * ------------------------------------------------------------
   * 不是纯随机 —— 你烧荒、污染、民心崩、周围在打仗，人就会往你这跑。
   * 这也让"治理得好"有一个正面回报：安居的城不太会被流民砸门。
   * ============================================================ */
  MU.chanceOf = function (city) {
    var d = D();
    var p = d.base == null ? 0.06 : d.base;
    var why = [];
    if (GAME.climate && GAME.climate.isCold && GAME.climate.isCold()) {
      p *= (d.coldMul == null ? 2.6 : d.coldMul); why.push('寒潮');
    }
    if (city && GAME.taint && GAME.taint.of) {
      var t = GAME.taint.of(city);
      var warn = ((GAME.DATA.TAINT || {}).warn == null ? 60 : GAME.DATA.TAINT.warn);
      if (t >= warn) { p *= (d.taintMul == null ? 1.7 : d.taintMul); why.push('污染'); }
    }
    if (city && GAME.unrest && GAME.unrest.of) {
      if (GAME.unrest.of(city) >= 50) { p *= (d.unrestMul == null ? 2.0 : d.unrestMul); why.push('民怨'); }
    }
    var s = GAME.state || {};
    var lastWar = s.lastWarMonth;
    if (lastWar != null && (monthNow() - lastWar) <= 1) {
      p *= (d.warMul == null ? 1.7 : d.warMul); why.push('战乱');
    }
    return { p: Math.min(0.6, p), why: why };
  };

  /* ============================================================
   * tick —— 每月：出流民 / 过期的流民散掉
   * ============================================================ */
  MU.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.musterMonth === m) return null;
    if (s.musterMonth == null) { s.musterMonth = m; return { first: true }; }
    s.musterMonth = m;

    var d = D();
    var bag = st0();
    var out = { month: m, arrived: 0, expired: 0 };

    /* ① 已有流民到期：自己散了（名声小扣，不惩罚性） */
    if (bag.pending) {
      var age = m - (bag.pending.at | 0);
      if (age >= (d.expireMonths == null ? 3 : d.expireMonths)) {
        var n = bag.pending.pop | 0;
        bag.pending = null;
        out.expired = n;
        /* 过期不扣名声（`expireFame` 默认 0）：人自己走的，不算你作恶。
           只有**主动赶走**才记一笔 —— 那是真的做了个决定。 */
        if (GAME.renown && GAME.renown.add && (d.expireFame | 0) > 0) {
          GAME.renown.add('cruelty', d.expireFame);
        }
        if (GAME.log && GAME.log.war) {
          GAME.log.war('🚶 门外那批流民等不到答复，走了（' + U.numText(n, 0) + ' 人）。');
        }
      }
    }

    /* ② 新的流民：一次只挂一批，别堆成任务列表 */
    if (!bag.pending) {
      var c = pickCity();
      if (c) {
        var ch = MU.chanceOf(c);
        var roll = GAME.invasionRoll ? GAME.invasionRoll('muster|' + m) : Math.random();
        if (roll < ch.p) {
          var lo = d.sizeMin == null ? 160 : d.sizeMin;
          var hi = d.sizeMax == null ? 640 : d.sizeMax;
          var size = Math.round(lo + (hi - lo) * ((roll * 37) % 1));
          bag.pending = {
            at: m, pop: size, cityId: c.id,
            cause: ch.why.length ? ch.why.join('·') : '逃荒'
          };
          out.arrived = size;
          if (GAME.log && GAME.log.war) {
            GAME.log.war('🚶 ' + c.name + '门外来了一批流民：' + U.numText(size, 0)
              + ' 人（' + bag.pending.cause + '）。接不接，你定。');
          }
        }
      }
    }
    return out;
  };

  MU.pending = function () {
    var bag = st0();
    return (bag && bag.pending) || null;
  };

  /* 这批人要多少粮才养得起 */
  MU.grainNeedOf = function (p) {
    var d = D();
    var n = (p && p.pop) || 0;
    return Math.max(0, Math.round(n * (d.grainPer == null ? 3 : d.grainPer)));
  };

  /* ============================================================
   * accept —— 接纳（花粮换人，一部分直接能拿枪）
   * ============================================================ */
  MU.accept = function () {
    var bag = st0();
    if (!bag || !bag.pending) return { ok: false, msg: '门外没有流民' };
    var p = bag.pending;
    var city = GAME.city && GAME.city.byId ? GAME.city.byId(p.cityId) : null;
    if (!city) city = pickCity();
    if (!city) return { ok: false, msg: '没有可以安置他们的城' };

    var need = MU.grainNeedOf(p);
    var R = GAME.res(city);
    if ((R.grain || 0) < need) {
      return { ok: false, msg: '养不起：要 ' + U.numText(need, 0) + ' 粮（现有 '
        + U.numText(R.grain || 0, 0) + '）' };
    }
    if (GAME.city && GAME.city.sub) GAME.city.sub(city, 'grain', need);

    var d = D();
    var share = d.armyShare == null ? 0.18 : d.armyShare;
    var asTroop = Math.round(p.pop * share);
    var asPop = p.pop - asTroop;
    var gotPop = addPop(city, asPop);
    var gotArmy = addTroops(city, asTroop);
    bag.pending = null;
    if (GAME.renown && GAME.renown.add) GAME.renown.add('mercy', d.fameUp == null ? 4 : d.fameUp);
    note('流民（接纳）', p.pop, '耗粮 ' + need);

    var msg = '收下 ' + U.numText(p.pop, 0) + ' 人（耗粮 ' + U.numText(need, 0)
      + '）：幸存者 +' + U.numText(gotPop, 0) + '、能拿枪的 ' + U.numText(asTroop, 0) + ' 人入营';
    if (GAME.log && GAME.log.war) GAME.log.war('🚶 ' + city.name + '：' + msg);
    return { ok: true, msg: msg, pop: gotPop, army: gotArmy, grain: need };
  };

  /* 驱散：省钱，但名声记一笔（不是道德审判：它会影响营地招募/纳贡价/村社意愿） */
  MU.turnAway = function () {
    var bag = st0();
    if (!bag || !bag.pending) return { ok: false, msg: '门外没有流民' };
    var p = bag.pending;
    var d = D();
    bag.pending = null;
    if (GAME.renown && GAME.renown.add) GAME.renown.add('cruelty', d.fameDown == null ? 7 : d.fameDown);
    note('流民（驱散）', p.pop, '名声 −' + (d.fameDown == null ? 7 : d.fameDown));
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🚶 把 ' + U.numText(p.pop, 0) + ' 人赶走了（粮省下了，名声记了一笔）。');
    }
    return { ok: true, msg: '赶走了 ' + U.numText(p.pop, 0) + ' 人（名声 −' + (d.fameDown == null ? 7 : d.fameDown) + '）' };
  };

  /* ============================================================
   * 战后逃生者 —— 敌军溃散时有人来投（不用付钱，量小）
   * ------------------------------------------------------------
   * 由 goals.afterBattle 调用。只在**打赢**时发生：
   * 输了没人愿意跟你。
   * ============================================================ */
  MU.onBattleWin = function (city, result) {
    if (!city || !result) return 0;
    var d = D();
    var loss = result.defLoss || 0;
    if (!(loss > 0)) return 0;
    var n = Math.round(loss * (d.escapeShare == null ? 0.03 : d.escapeShare));
    if (n <= 0) return 0;
    n = Math.min(d.escapeCap == null ? 400 : d.escapeCap, n);
    var got = addPop(city, n);
    if (got > 0) {
      note('战后逃生者', got);
      if (GAME.log && GAME.log.war) {
        GAME.log.war('🚶 溃散的敌兵里有 ' + U.numText(got, 0) + ' 人没处去，跟着你回城了。');
      }
    }
    return got;
  };

  /* 远征到底：救出来的人（由 delve 调用） */
  MU.onDelveReturn = function (city, n) {
    if (!city || !(n > 0)) return 0;
    var got = addPop(city, n);
    if (got > 0) {
      note('地下救出', got);
      if (GAME.log && GAME.log.war) {
        GAME.log.war('🚶 从地下带回来 ' + U.numText(got, 0) + ' 个活人。');
      }
    }
    return got;
  };

  /* ============================================================
   * 只读出口
   * ============================================================ */
  MU.lineOf = function () {
    var p = MU.pending();
    var bag = st0();
    var s = GAME.state || {};
    var parts = [];
    if (p) {
      parts.push('门外有 ' + U.numText(p.pop, 0) + ' 个流民（' + p.cause + '）等答复');
    }
    /* 人口增速的一句话：让"等"这件事有数字 */
    var c = (GAME.currentCity && GAME.currentCity()) || pickCity();
    if (c && GAME.popGrowthOf) {
      var g = GAME.popGrowthOf(c);
      var cap = GAME.effPopCapOf ? GAME.effPopCapOf(c) : 0;
      var pop = GAME.res(c).pop || 0;
      if (cap > 0) {
        var hrs = g > 0 ? Math.round((cap - pop) / g) : 0;
        parts.push('自然补员 ' + U.numText(Math.round(g * 10) / 10, 1) + ' 人/时'
          + (hrs > 0 && hrs < 999 ? ('（缺口 ' + U.numText(Math.max(0, cap - pop), 0) + '，要 '
            + hrs + ' 小时才长满）') : ''));
      }
    }
    void bag; void s;
    return parts.join('　');
  };

  /* 台账（面板用）：最近 6 条来源 */
  MU.recent = function () {
    var bag = st0();
    return (bag && bag.log ? bag.log.slice(-6) : []);
  };
})();
