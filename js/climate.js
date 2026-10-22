/* ============================================================
 * climate.js — 生存三命的第三条：温度（v94.1 · 构想 B4）
 * ------------------------------------------------------------
 * 提案原文：「城市有粮食/温度/民心三条线，冬天或辐射季来临时做抉择」。
 * 现状：粮有、民心有，**温度这条线不存在** ——
 *   寒潮（v92.18）是一个"每 24 个月扣粮产"的开关，不是一条能被经营的线：
 *   玩家不能为它做任何事，只能等它过去。
 *
 * 这个模块把温度变成一条线：
 *   · 一年一个正弦周期（年中最暖，年初最冷），最冷时低于 coldAt 算严寒；
 *   · 严寒的代价落在**人**身上：城外棚户冻死、附近村社往南走；
 *   · 玩家能做的事只有一件 —— **烧柴**：每城花一笔木，换这个月不受冻。
 *     木不是白来的（伐木占建造/锻造的同一份木），所以这是一笔真交易：
 *     你要么烧城里的木头，要么冻死城外的人。
 *
 * ⚠️ 不动全局粮产（`cityProdPerSec`）。寒潮模块已经在扣粮产了，
 *   这里再叠一层会让"冬天到底扣多少"变成两处口子相乘，谁也说不清。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var CL = GAME.climate = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.CLIMATE) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  }

  /* ============================================================
   * tempOf —— 现在多少度
   * ------------------------------------------------------------
   * 用月份的正弦，不用随机：玩家应该能**预见**冬天（这是"可预判"那一半）。
   * 年初最冷（-18℃ 左右），年中（30℃）最热。
   * ============================================================ */
  CL.tempOf = function (month) {
    var m = (month == null) ? monthNow() : month;
    var d = D();
    var mo = ((m % 12) + 12) % 12;
    var s = Math.sin(Math.PI * 2 * mo / 12 - Math.PI / 2);   /* mo=0 → -1（最冷） */
    var t = (d.base == null ? 6 : d.base) + (d.swing == null ? 24 : d.swing) * s;
    return Math.round(t * 10) / 10;
  };

  CL.coldAt = function () { return D().coldAt == null ? -10 : D().coldAt; };
  CL.isCold = function (month) { return CL.tempOf(month) < CL.coldAt(); };

  /* 距离下一个严寒月还有几个月（0 = 现在就是）—— 界面用它给玩家预警 */
  CL.coldIn = function () {
    var m = monthNow();
    for (var i = 0; i < 12; i++) if (CL.isCold(m + i)) return i;
    return -1;
  };

  /* 这个月这座城烧了柴没有 */
  CL.isWarm = function (city) {
    return !!(city && city.warmMonth != null && city.warmMonth === monthNow());
  };

  /* 供暖要多少木（一个月） */
  CL.fuelCostOf = function (city) {
    if (!city) return 0;
    var pop = (GAME.res(city).pop || 0);
    return Math.max(20, Math.round(pop * (D().fuelPerPop == null ? 0.4 : D().fuelPerPop)));
  };

  /* ============================================================
   * warm —— 烧柴（这个月这批人不冻着）
   * ------------------------------------------------------------
   * 一次只买一个月：不是修好一个建筑就永久解决。
   * 这是故意的 —— "冬天"应该每年都回来找你一次。
   * ============================================================ */
  CL.warm = function (city) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var m = monthNow();
    if (CL.isWarm(city)) return { ok: false, msg: '这个月的柴已经烧上了' };
    var need = CL.fuelCostOf(city);
    var R = GAME.res(city);
    if ((R.wood || 0) < need) {
      return { ok: false, msg: '烧一个月的柴要 ' + U.numText(need, 0) + ' 木 —— 现在不够' };
    }
    if (GAME.city && GAME.city.add) GAME.city.add(city, 'wood', -need);
    else city.res.wood -= need;
    city.warmMonth = m;
    if (GAME.heartsComfortAdd) GAME.heartsComfortAdd(D().warmHearts == null ? 1.5 : D().warmHearts);
    return { ok: true, msg: '烧上了：这一个月 ' + U.numText(GAME.res(city).pop || 0, 0) + ' 个人不会再冻着（耗柴 '
      + U.numText(need, 0) + '）。' };
  };

  /* ============================================================
   * tick —— 每月结算严寒
   * ============================================================ */
  CL.tick = function (force) {
    var st = GAME.state;
    if (!st) return null;
    var m = monthNow();
    if (!force && st.climateMonth === m) return null;
    if (st.climateMonth == null) { st.climateMonth = m; return { first: true, month: m }; }
    st.climateMonth = m;

    var cold = CL.isCold(m);
    var out = { month: m, temp: CL.tempOf(m), cold: cold, died: 0, moved: 0, warm: 0 };
    if (!cold) return out;

    var d = D();
    var resist = (GAME.relic && GAME.relic.mulOf) ? GAME.relic.mulOf('resist') : 1;
    resist = Math.max(0.2, resist);

    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      if (CL.isWarm(c)) { out.warm++; return; }

      /* ① 棚户冻死（城里的人有房子，城外只有油布） */
      var sh = (GAME.growth && GAME.growth.shantyOf) ? GAME.growth.shantyOf(c) : 0;
      if (sh > 0) {
        var die = Math.round(sh * (d.coldShantyLoss == null ? 0.06 : d.coldShantyLoss) * resist);
        if (die > 0) {
          c.shanty = Math.max(0, sh - die);
          out.died += die;
          if (GAME.log && GAME.log.war) {
            GAME.log.war('❄ ' + c.name + '零下 ' + Math.abs(CL.tempOf(m)) + ' 度，城外棚户 ' + U.numText(die, 0) + ' 个人冻死了。');
          }
        }
      }
      /* ② 附近的村社往暖处走 */
      if (GAME.village && GAME.village.listAll && GAME.sphere && GAME.sphere.distOf) {
        var list = GAME.village.listAll();
        for (var i = 0; i < list.length; i++) {
          var vci = list[i];
          if (c.ci == null) continue;
          var dd = GAME.sphere.roughDistOf ? GAME.sphere.roughDistOf({ ci: c.ci }, { ci: vci })
            : GAME.sphere.distOf({ ci: c.ci }, { ci: vci });
          if (dd > 6) continue;
          var rec = GAME.village.peek ? GAME.village.peek(vci) : null;
          if (!rec || rec.dead || rec.heldBy) continue;
          var n = Math.max(1, Math.round((rec.pop || 0) * (d.coldVillageLoss == null ? 0.02 : d.coldVillageLoss) * resist));
          rec.pop = Math.max(0, (rec.pop || 0) - n);
          if (rec.pop <= 0) rec.dead = 'cold';
          out.moved += n;
        }
      }
    });
    return out;
  };

  /* ---------- 只读出口 ---------- */
  CL.lineOf = function () {
    var m = monthNow();          /* ⚠️ 不能省：tempOf/isCold 接受"月份"参数，不传就是 undefined */
    var t = CL.tempOf(m);
    var inN = CL.coldIn();
    var cold = CL.isCold(m);
    return '🌡 气温 ' + (t > 0 ? '+' : '') + t + '℃'
      + (cold ? '　<span style="color:var(--red-light);">❄ 严寒：城外的人正在冻死（可以烧柴）</span>'
        : (inN > 0 ? '　<span style="color:var(--text-dim);">距严寒 ' + inN + ' 个月</span>' : ''));
  };

  CL.cityLine = function (city) {
    if (!city) return '';
    return '🌡 供暖：' + (CL.isWarm(city) ? '这个月烧上了' : '没烧')
      + '　需要 ' + U.numText(CL.fuelCostOf(city), 0) + ' 木/月'
      + (CL.isCold() && !CL.isWarm(city) ? '　<span style="color:var(--red-light);">严寒中</span>' : '');
  };
})();
