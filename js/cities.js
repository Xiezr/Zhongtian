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
   * 资源写（v91.67 · 第六刀第一小刀）：**城市资源的唯一加减入口**
   * ------------------------------------------------------------
   * 背景：`GAME.res(city)` 只解决了"取哪个对象"，加减仍是 29 处裸写
   *   （`R[k] = (R[k]||0) - cost[k]` / `+ amt` / `Math.max(0,...)`），
   *   没有统一的下界与上限口径 → 资源可能为负、也可能超出仓容。
   *
   * · `add(city, k, n)`    加的**唯一入口**：下界 0；`cap=true` 时按仓容封顶。
   * · `sub(city, k, n)`    扣的**唯一入口**：下界恒 0（不足只扣到 0，返回实扣量）。
   * · `take(city, cost)`   **原子扣费**：任一资源不足 → 整单拒绝、不动账。
   * 数据仍在 `city.res`（存档零迁移）。
   * ============================================================ */
  function resOf(city) { return GAME.res ? GAME.res(city) : ((city && city.res) || {}); }
  function num(n) { n = Math.floor(Number(n) || 0); return n > 0 ? n : 0; }

  C.add = function (city, k, n, cap) {
    /* 快速路径（无封顶）—— 逐城 tick 的产量入账走这里，必须够轻。 */
    var add = n >= 0 ? Math.floor(n) || 0 : 0;
    if (!k || add <= 0) return resOf(city)[k] || 0;
    if (!cap) {
      var R = resOf(city);
      var v = (R[k] || 0) + add;
      R[k] = v;
      return v;
    }
    /* 封顶口径**复用既有唯一出口** `addResCapped`（只封增长、不削存量 ·
       存量已超上限时一点不加），避免在这里另造第二套"封顶"语义。 */
    if (GAME.addResCapped) return GAME.addResCapped(k, add, city).cur;
    var R2 = resOf(city);
    R2[k] = (R2[k] || 0) + add;
    return R2[k];
  };

  C.sub = function (city, k, n) {
    var R = resOf(city), want = num(n), cur = num(R[k]);
    var cut = Math.min(cur, want);
    if (cut <= 0) return 0;
    R[k] = cur - cut;
    return cut;
  };

  /* 原子扣费：`cost` = {grain,wood,stone,iron,...}（time/jewel/gold 由各自出口处理） */
  C.take = function (city, cost) {
    var lack = [];
    for (var k in (cost || {})) {
      if (k === 'time' || k === 'jewel' || k === 'gold') continue;
      var need = num(cost[k]);
      if (need <= 0) continue;
      var have = num(resOf(city)[k]);
      if (have < need) lack.push({ k: k, need: need, have: have });
    }
    if (lack.length) {
      return { ok: false, msg: '资源不足：' + lack.map(function (x) {
        return (GAME.resName ? GAME.resName(x.k) : x.k);
      }).join('、'), lack: lack };
    }
    for (var k2 in cost) {
      if (k2 === 'time' || k2 === 'jewel' || k2 === 'gold') continue;
      C.sub(city, k2, cost[k2]);
    }
    return { ok: true, msg: '' };
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
