/* ============================================================
 * taint.js — 强是要付账的（v94.1 · 废土内核 F「代价」）
 * ------------------------------------------------------------
 * 提案原文：
 *   「旧世界技术强，但积累污染，污染高会变异/民心崩」
 *   「强是要付账的」
 *
 * 现状：这个游戏里"变强"没有账单 ——
 *   造得越多、级越高，只有正收益；没有任何一条线会因为"太多"而反过来咬人。
 *   于是玩家永远不会面对"要不要停下来"。
 *
 * 这个模块做的只有一件：**给每座城记一笔污染账**。
 *   · 来源：建筑总等级（越多越高的城，污染越重）—— 用"工业密度"近似，
 *     不新增建筑，也不改任何既有产出口；
 *   · 自净：每月一个常数 + 科技（净水厂）；
 *   · 越过警戒线：界面转黄；越过变质线：**人开始走**。
 *
 * ⚠️ 刻意不扣"民心"（`heartsComfort` 是全局量，一扣会污染器械/征兵等
 *   与污染毫无关系的系统 —— v93.5 用棚户试过，e2e 立刻抓到）。
 *   代价落在**人**身上：棚户先死，村社往外搬。这也更像废土。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var TN = GAME.taint = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.TAINT) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  }

  /* 建筑总等级（含围墙）—— 污染的唯一来源，读的都是既有出口 */
  function lvlSumOf(city) {
    var n = 0;
    (city.cells || []).forEach(function (cc) {
      if (cc && cc.build && cc.build.id) n += (cc.build.lvl | 0);
    });
    if (city.wall && city.wall.build && city.wall.build.id) n += (city.wall.build.lvl | 0);
    return n;
  }

  TN.of = function (city) { return (city && (city.taint | 0)) || 0; };

  /* 等级：干净 / 警戒 / 变质（界面与伤害都读它） */
  TN.levelOf = function (city) {
    var t = TN.of(city), d = D();
    if (t >= (d.bad == null ? 120 : d.bad)) return { id: 'bad', name: '变质', color: 'var(--red-light)' };
    if (t >= (d.warn == null ? 60 : d.warn)) return { id: 'warn', name: '警戒', color: 'var(--gold-light)' };
    return { id: 'clean', name: '干净', color: 'var(--green-ok)' };
  };

  /* 每月增量（界面显示"这个月会涨多少"用的就是它） */
  TN.deltaOf = function (city) {
    var d = D();
    var purge = (GAME.relic && GAME.relic.addOf) ? GAME.relic.addOf('purge') : 0;
    return lvlSumOf(city) * (d.perLvl == null ? 0.15 : d.perLvl)
      - (d.decay == null ? 2 : d.decay) - purge;
  };

  /* ============================================================
   * tick —— 每月结一次账（按秒会让它变成"数字在跳"）
   * ============================================================ */
  TN.tick = function (force) {
    var st = GAME.state;
    if (!st) return null;
    var m = monthNow();
    if (!force && st.taintMonth === m) return null;
    if (st.taintMonth == null) { st.taintMonth = m; return { first: true, month: m }; }
    st.taintMonth = m;

    var d = D();
    var out = { month: m, bad: 0, lost: 0 };
    var resist = (GAME.relic && GAME.relic.mulOf) ? GAME.relic.mulOf('resist') : 1;   /* 旧诊所：1 → 0.65 */
    resist = Math.max(0.2, resist);

    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      var t = Math.max(0, TN.of(c) + TN.deltaOf(c));
      c.taint = Math.round(t * 10) / 10;
      var lv = TN.levelOf(c);
      if (lv.id !== 'bad') return;
      out.bad++;
      /* 一次只处理最脏的 8 座城：这是"压力"，不是全境同时崩 */
      if (out.bad > 8) return;

      /* ① 棚户先死（城外，最脏的地方） */
      var sh = (GAME.growth && GAME.growth.shantyOf) ? GAME.growth.shantyOf(c) : 0;
      if (sh > 0) {
        var over = Math.max(0, t - (d.bad == null ? 120 : d.bad)) / 100;
        var die = Math.round(sh * Math.min(0.5, (d.shantyLossAt == null ? 0.02 : d.shantyLossAt) * over) * resist);
        if (die > 0) {
          c.shanty = Math.max(0, sh - die);
          out.lost += die;
          if (GAME.log && GAME.log.war) {
            GAME.log.war('☢ ' + c.name + '城外的污染到了变质线，棚户里 ' + U.numText(die, 0) + ' 个人没能撑过这个月。');
          }
        }
      }
      /* ② 附近的村社也在往外搬（只影响**新系统**，不动老产量） */
      if (GAME.village && GAME.village.listAll) {
        var list = GAME.village.listAll();
        var moved = 0;
        for (var i = 0; i < list.length; i++) {
          var vci = list[i];
          if (c.ci == null || !GAME.sphere || !GAME.sphere.distOf) continue;
          var dd = GAME.sphere.roughDistOf ? GAME.sphere.roughDistOf({ ci: c.ci }, { ci: vci })
            : GAME.sphere.distOf({ ci: c.ci }, { ci: vci });
          if (dd > 4) continue;
          var rec = GAME.village.peek ? GAME.village.peek(vci) : null;
          if (!rec || rec.dead || rec.heldBy) continue;
          var n = Math.max(1, Math.round((rec.pop || 0) * (d.villageLoss == null ? 0.004 : d.villageLoss) * resist));
          rec.pop = Math.max(0, (rec.pop || 0) - n);
          if (rec.pop <= 0) rec.dead = 'taint';
          moved += n;
        }
        out.lost += moved;
      }
    });
    return out;
  };

  /* ============================================================
   * clean —— 净化（花铁与石，把账按下来一截）
   * ------------------------------------------------------------
   * 这是"代价"系统能成立的关键：**必须有一个花钱的出口**。
   * 否则污染只是永久的数值下滑，玩家只能看着，不构成选择。
   * 但它不能免费：一次净化 = 一笔真资源，而且治不完（下个月还在涨）。
   * ============================================================ */
  TN.clean = function (city) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var d = D(), cost = d.cleanCost || { iron: 400, stone: 600 };
    var R = GAME.res(city);
    var lack = [];
    for (var k in cost) if ((R[k] || 0) < cost[k]) lack.push(GAME.resName ? GAME.resName(k) : k);
    if (lack.length) return { ok: false, msg: '净化要 ' + lack.join('、') + ' —— 现在不够' };
    for (var k2 in cost) if (GAME.city && GAME.city.add) GAME.city.add(city, k2, -cost[k2]);

    var before = TN.of(city);
    city.taint = Math.max(0, Math.round((before - (d.cleanAt == null ? 25 : d.cleanAt)) * 10) / 10);
    return { ok: true, msg: '净化了一轮：污染 ' + Math.round(before) + ' → ' + Math.round(TN.of(city))
      + '。下个月它还会涨 —— 这是治不完的。' };
  };

  /* ---------- 只读出口 ---------- */
  TN.stats = function () {
    var out = { n: 0, warn: 0, bad: 0, worst: null };
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      out.n++;
      var t = TN.of(c);
      if (t >= (D().bad == null ? 120 : D().bad)) out.bad++;
      else if (t >= (D().warn == null ? 60 : D().warn)) out.warn++;
      if (!out.worst || out.worst.t < t) out.worst = { name: c.name, t: t };
    });
    return out;
  };

  TN.lineOf = function () {
    var a = TN.stats();
    if (!a.n) return '';
    var w = a.worst || { name: '—', t: 0 };
    return '☢ 污染：' + a.bad + ' 城变质 · ' + a.warn + ' 城警戒（最重的 ' + w.name + ' ' + Math.round(w.t) + '）';
  };

  TN.cityLine = function (city) {
    if (!city) return '';
    var t = TN.of(city), lv = TN.levelOf(city), dl = TN.deltaOf(city);
    return '☢ 污染 ' + Math.round(t) + '（' + lv.name + '）'
      + '　每月 ' + (dl >= 0 ? '+' : '') + Math.round(dl * 10) / 10;
  };
})();
