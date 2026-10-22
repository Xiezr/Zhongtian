/* ============================================================
 * tower.js — 城防工事与破墙（v95 · E 塔防 + C3 两阶段攻城）
 * ------------------------------------------------------------
 * 提案两句话：
 *   「塔防守城：守城时布置炮塔、障碍 —— 让建筑在战斗中有用」
 *   「两阶段攻城（先破墙再打守军）仍未做」
 *
 * 这个模块一次解决两件，因为它们其实是同一件事：**墙是有状态的**。
 *   · 守方：每城 3 个工事槽，战前摆炮塔 / 拒马 / 雷区（花铁石木），
 *     算进城防（`GAME.cityDefense` 与拆账 `defensePartsOf` 两处同口径）。
 *   · 攻方：**打不下来，墙也会裂** —— 每次攻城未破，墙防 −22%，
 *     下个月再来就更好打。这就是"两阶段"的实质，而不需要改战斗回合。
 *
 * 为什么不做"战场上摆塔"：这游戏的战斗是自动结算的，
 *   在战场上实时放塔等于另做一个玩法。先让"战前布置"成立。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var TW = GAME.tower = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.TOWER) || {}; }
  function kinds() { return D().kinds || []; }

  function slotsOf(city) {
    if (!city) return [];
    if (!Array.isArray(city.works)) city.works = [];
    return city.works;
  }

  TW.kinds = kinds;
  TW.slotsOf = slotsOf;
  TW.maxSlots = function () { return D().slots || 3; };

  /* 加成：工事给城防若干点 */
  TW.defBonusOf = function (city) {
    if (!city) return 0;
    var n = 0;
    slotsOf(city).forEach(function (id) {
      kinds().forEach(function (k) { if (k.id === id) n += (k.def || 0); });
    });
    return n;
  };

  /* 破墙：墙防损失多少点（与 cityDefenseBase 里的 wallLv×20 同尺） */
  TW.wallLossOf = function (city) {
    if (!city) return 0;
    var broken = Math.max(0, Math.min(0.8, city.wallBroken || 0));
    if (broken <= 0) return 0;
    var wallLv = GAME.buildingLevel ? (GAME.buildingLevel(city, 'chengqiang') || 0) : 0;
    return Math.round(wallLv * 20 * broken);
  };

  /* 布置 / 拆除 */
  TW.build = function (city, kindId) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var arr = slotsOf(city);
    if (arr.length >= TW.maxSlots()) return { ok: false, msg: '工事槽满了（拆除一处再建）' };
    var k = null;
    kinds().forEach(function (x) { if (x.id === kindId) k = x; });
    if (!k) return { ok: false, msg: '没有这种工事' };
    var R = GAME.res(city), lack = [];
    for (var key in (k.cost || {})) if ((R[key] || 0) < k.cost[key]) lack.push(GAME.resName ? GAME.resName(key) : key);
    if (lack.length) return { ok: false, msg: '缺 ' + lack.join('、') };
    /* 扣资源走 sub（add 不吃负数） */
    for (var key2 in (k.cost || {})) if (GAME.city.sub) GAME.city.sub(city, key2, k.cost[key2]);
    arr.push(k.id);
    if (GAME.defenseLineOf) { /* 拆账缓存不存在，无需失效 */ }
    return { ok: true, msg: '建好一处' + k.name + '（城防 +' + k.def + '）' };
  };

  TW.remove = function (city, idx) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var arr = slotsOf(city);
    if (idx < 0 || idx >= arr.length) return { ok: false, msg: '没有这处工事' };
    var id = arr.splice(idx, 1)[0];
    var nm = id;
    kinds().forEach(function (k) { if (k.id === id) nm = k.name; });
    return { ok: true, msg: '拆了' + nm + '（材料不退）' };
  };

  /* 修墙（花石） */
  TW.repair = function (city) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var b = city.wallBroken || 0;
    if (b <= 0) return { ok: false, msg: '墙是完好的' };
    var cost = D().wallRepairCost || { stone: 300 };
    var R = GAME.res(city), lack = [];
    for (var k in cost) if ((R[k] || 0) < cost[k]) lack.push(GAME.resName ? GAME.resName(k) : k);
    if (lack.length) return { ok: false, msg: '缺 ' + lack.join('、') };
    for (var k2 in cost) if (GAME.city.sub) GAME.city.sub(city, k2, cost[k2]);
    city.wallBroken = 0;
    return { ok: true, msg: '墙补好了。' };
  };

  /* ============================================================
   * afterSiege —— 攻城之后：没打下来，墙也会裂
   * ------------------------------------------------------------
   * 只有"真打了一仗"才算（撤退也算：你确实撞了一次墙）。
   * ============================================================ */
  TW.afterSiege = function (rec, result, ctx) {
    if (!rec || !result) return null;
    var t = rec.target;
    if (!t) return null;
    /* 只有攻城（占城）才破墙；打野地没有墙 */
    var isCity = (t.kind === 'city' || t.kind === 'fort');
    if (!isCity) return null;
    if (ctx && ctx.win) return { note: '城墙已破（换主人了）' };
    var city = GAME.city && GAME.city.byId ? GAME.city.byId(t.id) : null;
    if (!city) return null;
    var per = D().wallBreakPerAttack == null ? 0.22 : D().wallBreakPerAttack;
    city.wallBroken = Math.max(0, Math.min(0.8, (city.wallBroken || 0) + per));
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🧱 ' + city.name + '的城墙被打裂了（守备 −' + Math.round(city.wallBroken * 100)
        + '%），下个月再来会好打得多。');
    }
    return { note: '破墙 ' + Math.round(city.wallBroken * 100) + '%' };
  };

  TW.cityLine = function (city) {
    if (!city) return '';
    var arr = slotsOf(city);
    var b = Math.round((city.wallBroken || 0) * 100);
    var parts = [];
    if (arr.length) {
      parts.push(arr.map(function (id) {
        var nm = id;
        kinds().forEach(function (k) { if (k.id === id) nm = k.name; });
        return nm;
      }).join('·'));
    } else parts.push('无工事');
    if (b > 0) parts.push('墙裂 ' + b + '%');
    return parts.join('　');
  };
})();
