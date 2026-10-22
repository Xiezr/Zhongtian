/* ============================================================
 * unrest.js — 民怨攒到头，城会自己反（v95 · B3 内政）
 * ------------------------------------------------------------
 * 提案原话：「内政治理：占城后要管民忠、税收、驻军；民忠低会叛乱」。
 *
 * 现状：民心/民怨只是一条影响产量的系数（`heartsOf`），低就低，没有后果。
 *   于是"税率"这个选项其实没有风险 —— 高税只影响产出，不影响稳定。
 *
 * 这个模块给低民心一个**会自己发生的事**：
 *   · 民心低于 55 开始攒"民怨值"，越低攒得越快；
 *   · 攒满 → 叛乱：库存被抢走两成半、守军跑掉一成二、城防受损；
 *   · 两种解法：降税（慢，但治本）或安抚（花粮，立刻压下去但会再攒）。
 *
 * ⚠️ 不做"城市易主"：那要动占领体系。这一版只让城"伤一次"。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var UN = GAME.unrest = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.UNREST) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  UN.of = function (city) { return (city && (city.unrest | 0)) || 0; };

  UN.levelOf = function (city) {
    var v = UN.of(city), top = D().rebelAt == null ? 100 : D().rebelAt;
    var r = top > 0 ? v / top : 0;
    if (r >= 1) return { id: 'rebel', name: '已反', color: 'var(--red-light)' };
    if (r >= 0.7) return { id: 'hot', name: '将反', color: 'var(--red-light)' };
    if (r >= 0.4) return { id: 'warm', name: '不满', color: 'var(--gold-light)' };
    return { id: 'calm', name: '安稳', color: 'var(--green-ok)' };
  };

  /* ============================================================
   * tick —— 每月
   * ============================================================ */
  UN.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.unrestMonth === m) return null;
    if (s.unrestMonth == null) { s.unrestMonth = m; return { first: true }; }
    s.unrestMonth = m;

    var d = D(), out = { rebels: 0, cooled: 0, month: m };
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      var h = GAME.heartsOf ? GAME.heartsOf(c) : 60;
      var v = UN.of(c);
      var at = d.perMonthAt == null ? 40 : d.perMonthAt;
      /* ⚠️ 冷却：叛乱刚发生过就暂停累积。
         起因是"挂机补算 90 个月"的实测（smoke §193② 抓到）：
         没有冷却时，一座城会在补算里连反三四次，把守军扣掉一半 ——
         那不是"压力"，那是"离线一晚回来城空了"。 */
      var cd = d.rebelCd == null ? 12 : d.rebelCd;
      if (c.rebelAt && (m - c.rebelAt) < cd) {
        c.unrest = Math.max(0, v - 4);
        return;
      }

      /* ⚠️ 顺序很重要：**先判"是否已经攒满"**，再决定这个月是涨还是消。
         反过来写的话，"民心刚好回升"的月份会让满值掉回 90，永远不炸 ——
         民怨是累积量，攒够了就该炸，跟这个月心情好不好无关。 */
      if (v >= (d.rebelAt == null ? 100 : d.rebelAt)) {
        UN._rebel(c, d);
        out.rebels++;
        return;
      }
      if (h < at) {
        /* 缺口越大攒得越快：民心 20 时每月 +更多 */
        var k = (at - h) / at;
        v += Math.max(1, Math.round((d.gainPerMonth == null ? 5 : d.gainPerMonth) * (0.5 + k)));
      } else {
        v = Math.max(0, v - (d.coolPerMonth == null ? 10 : d.coolPerMonth));
        out.cooled++;
      }
      c.unrest = v;
    });
    return out;
  };

  /* 叛乱结算 —— 只伤一次，不夺城 */
  UN._rebel = function (city, d) {
    var R = GAME.res(city);
    var lostG = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
      var n = Math.round((R[k] || 0) * (d.rebelLoss == null ? 0.25 : d.rebelLoss));
      if (n > 0) {
        if (GAME.city.sub) GAME.city.sub(city, k, n);
        else R[k] = Math.max(0, (R[k] || 0) - n);
        lostG += n;
      }
    });
    /* 守军跑掉一部分 */
    var total = GAME.city.armyTotal(city), run = Math.round(total * (d.rebelArmy == null ? 0.12 : d.rebelArmy));
    if (run > 0) {
      var a = city.army || {};
      for (var k2 in a) {
        var v = Math.floor(a[k2] || 0);
        if (v <= 0) continue;
        var part = Math.floor(run * v / Math.max(1, total));
        if (part > 0) { var o = {}; o[k2] = part; if (GAME.city.armySub) GAME.city.armySub(city, o); }
      }
    }
    city.unrest = 20;
    city.rebelAt = monthNow();
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🔥 ' + city.name + '民怨炸了：库房被抢（' + U.numText(lostG, 0) + ' 物资），'
        + U.numText(run, 0) + ' 个守军跑了。安抚一次能压下去 —— 但降税才是治本。');
    }
    return { lost: lostG, run: run };
  };

  /* 安抚（花粮，立刻压下去） */
  UN.calm = function (city) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var cost = D().calmCost || { grain: 800 };
    var R = GAME.res(city);
    for (var k in cost) {
      if ((R[k] || 0) < cost[k]) {
        return { ok: false, msg: '安抚要 ' + U.numText(cost[k], 0) + ' ' + (GAME.resName ? GAME.resName(k) : k) + ' —— 现在不够' };
      }
    }
    for (var k2 in cost) if (GAME.city.sub) GAME.city.sub(city, k2, cost[k2]);
    city.unrest = Math.max(0, UN.of(city) - (D().calmDrop == null ? 45 : D().calmDrop));
    return { ok: true, msg: '发了一次粮，民怨压下去了（现 ' + city.unrest + '）。不降税的话还会攒。' };
  };

  UN.lineOf = function () {
    var n = 0, worst = null;
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      var v = UN.of(c);
      if (v >= 40) n++;
      if (!worst || v > UN.of(worst)) worst = c;
    });
    if (!n) return '';
    return '🔥 民怨：' + n + ' 城不满（最重的 ' + worst.name + ' ' + UN.of(worst) + '/100）';
  };

  UN.cityLine = function (city) {
    if (!city) return '';
    var lv = UN.levelOf(city);
    return UN.of(city) + '/100（' + lv.name + '）';
  };
})();
