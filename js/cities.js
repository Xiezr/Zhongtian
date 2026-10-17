/* ============================================================
 * js/cities.js — **城市（s.cities）只读归属出口**（v91.66 · 地基第 2 期第五刀）
 * ------------------------------------------------------------
 * 背景：`s.cities` 是耦合最深的切片 —— **132 个读点**散在全仓，
 *   且存在两个易混口径：
 *     · `s.cities` = **当前星球分片**的城（切星球会换一份）；
 *     · `s.mapSlices[pid].cities` = 各星球分片的城（背景片是 U.deep 副本）。
 *   查找、取资源、取兵力、算帝国总数 各写各的，极易"只数当前星球"（v90.xx 踩过）。
 *
 * 本刀**只做只读出口**（不改任何写点、不动存档结构）：
 *   · `GAME.city.byId(id)`        —— 当前星球找城（= cityById）
 *   · `GAME.city.anywhere(id)`    —— 跨星球找城（= cityByIdAnywhere）
 *   · `GAME.city.all()`           —— 当前星球全部城（s.cities 的安全副本引用）
 *   · `GAME.city.armyTotal(city)` —— 城内兵力总数（逐兵种求和）
 *   · `GAME.city.level(city,bid)` —— 建筑等级（= buildingLevel）
 *   · `GAME.city.isMain(city)`    —— 是否主城
 *   · `GAME.city.popOf(city)`     —— 幸存者（res.pop）
 *
 * 后续刀再把**写点**（建造/募兵/驻军/资源扣减）逐簇收进来；
 * 本刀先给"读"一个统一坐标，并为不变量守卫提供判据。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};

  var C = GAME.city = {};

  /* ---- 查找（唯一出口的别名层：底层仍是既有的两个实现，避免造第二套） ---- */
  C.byId = function (id) { return GAME.cityById ? GAME.cityById(id) : null; };
  C.anywhere = function (id) { return GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(id) : C.byId(id); };

  /* 当前星球的全部城（空安全） */
  C.all = function () {
    var s = GAME.state;
    if (!s) return [];
    if (!s.cities) s.cities = [];
    return s.cities;
  };

  /* 城内兵力总数：逐兵种求和（**唯一出口** · 与 wildGarrisonTotal 同口径） */
  C.armyTotal = function (city) {
    var n = 0, t = (city && city.army) || {};
    for (var k in t) {
      var v = Math.floor(Number(t[k]) || 0);
      if (v > 0) n += v;
    }
    return n;
  };

  /* 建筑等级（唯一出口 = buildingLevel；无该建筑 → 0） */
  C.level = function (city, bid) {
    return (GAME.buildingLevel ? GAME.buildingLevel(city, bid) : 0) || 0;
  };

  /* 是否主城 */
  C.isMain = function (city) {
    return !!(GAME.isMainCity && GAME.isMainCity(city));
  };

  /* 幸存者（资源口径里叫 pop） */
  C.popOf = function (city) {
    return Math.max(0, Math.floor(((city && city.res && city.res.pop) || 0)));
  };

  /* ============================================================
   * 不变量（供 smoke 守卫调用；返回 [{city, msg}]，空数组 = 全部通过）
   * 这些是"城市一旦写坏就会静默扩散"的量，界面上未必立刻可见。
   * ============================================================ */
  C.checkInvariants = function () {
    var bad = [];
    var list = C.all();
    var seen = {};
    (list || []).forEach(function (c) {
      if (!c) { bad.push({ city: null, msg: '空城对象' }); return; }
      if (!c.id) { bad.push({ city: c, msg: '城缺 id' }); return; }
      if (seen[c.id]) bad.push({ city: c, msg: '城 id 重复：' + c.id });
      seen[c.id] = 1;

      /* ① 兵力非负整数 */
      var t = c.army || {};
      for (var k in t) {
        var v = t[k];
        if (typeof v !== 'number' || !isFinite(v) || v < 0 || Math.floor(v) !== v) {
          bad.push({ city: c, msg: '兵力异常 ' + k + '=' + v });
        }
      }
      /* ② 资源非负 */
      var r = c.res || {};
      ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'].forEach(function (rk) {
        var rv = r[rk];
        if (rv != null && (typeof rv !== 'number' || !isFinite(rv) || rv < 0)) {
          bad.push({ city: c, msg: '资源为负/非法 ' + rk + '=' + rv });
        }
      });
      /* ③ 城内格数合法（48 格，或城墙不占格的变体） */
      if (c.cells && c.cells.length !== 48) {
        bad.push({ city: c, msg: '城内格数异常：' + c.cells.length });
      }
      /* ④ 坐标在界内 */
      if (typeof c.x === 'number' && typeof c.y === 'number') {
        if (c.x < 0 || c.y < 0 || c.x >= (GAME.DATA.MAP_W || 500) || c.y >= (GAME.DATA.MAP_H || 500)) {
          bad.push({ city: c, msg: '坐标越界 (' + c.x + ',' + c.y + ')' });
        }
      }
    });
    /* ⑤ 当前城必须属于当前星球分片 */
    var cur = GAME.currentCity && GAME.currentCity();
    if (cur && cur.id && !seen[cur.id]) {
      bad.push({ city: cur, msg: '当前城不在 s.cities 分片内' });
    }
    return bad;
  };
})();
