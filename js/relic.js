/* ============================================================
 * tech.js — 科技不是点出来的，是挖出来的（v94.1 · 提案 G）
 * ------------------------------------------------------------
 * 提案原文（G「一个颠覆性建议」）：
 *   「把科技树换成废墟挖掘：科技不是点出来的，是挖出来的。
 *     探索 = 成长（迷雾与科技树合并成一个系统），
 *     每座废墟是一个选择，废土感自动成立。」
 *
 * 现状：遗迹只给材料与资源（ruin.js 顶部还特意写了"不给图纸/科技"）。
 *   于是"翻遗迹"只是拿资源，翻完就忘。而探索本该是**成长**。
 *
 * 这个模块补上后半段，做法刻意很小：
 *   · **残页**：每翻一处遗迹（你亲手翻的，被竞争者抢走的不算）得残页；
 *   · **只有 3 个位置**：一共 6 条科技，残页会够，位置永远不够 ——
 *     于是"选哪三条"是这个模块唯一、也是全部的玩法；
 *   · 每条都**只作用在新系统上**（棚户 / 新垦 / 严寒致死 / 自净 / 视野），
 *     不动粮产总表与城防 —— 最小可运行版不掀既有平衡。
 *
 * ⚠️ 为什么不做"科技树"：树意味着终局是**点满**，那就没有选择。
 *   这里的位置是 3，且不可退（`GAME.relic.reset` 只在调试里用）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var TE = GAME.relic = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.RELIC) || {}; }
  function list() { return D().list || []; }

  function st0() {
    var st = GAME.state;
    if (!st) return null;
    if (!st.relic || typeof st.relic !== 'object') st.relic = { picked: [] };
    if (!Array.isArray(st.relic.picked)) st.relic.picked = [];
    return st.relic;
  }

  /* ============================================================
   * pagesOf —— 手上有多少残页
   * ------------------------------------------------------------
   * 只数**你亲手翻的**（side 为 'a'/'b'）。被竞争者抢翻的记成 'rival'，
   * 一处都不算 —— 这就是"你慢一步，东西就没了"的具体形态。
   * ============================================================ */
  TE.pagesOf = function () {
    var st = GAME.state;
    if (!st) return 0;
    var ru = st.ruins || {};
    var n = 0;
    for (var k in ru) {
      var r = ru[k];
      if (!r) continue;
      if (r.side === 'a' || r.side === 'b') n += (D().pagesPerRuin == null ? 1 : D().pagesPerRuin);
    }
    return n;
  };

  TE.spentOf = function () {
    var s = st0();
    if (!s) return 0;
    var n = 0;
    s.picked.forEach(function (id) {
      list().forEach(function (x) { if (x.id === id) n += (x.cost || 0); });
    });
    return n;
  };

  TE.leftOf = function () { return Math.max(0, TE.pagesOf() - TE.spentOf()); };

  TE.pickedOf = function () { var s = st0(); return s ? s.picked.slice() : []; };
  TE.has = function (id) { return TE.pickedOf().indexOf(id) >= 0; };
  TE.slotsLeft = function () { return Math.max(0, (D().picks || 3) - TE.pickedOf().length); };

  /* 列表（带状态：已落 / 可落 / 残页不够 / 位置不够） */
  TE.options = function () {
    var left = TE.leftOf(), slots = TE.slotsLeft();
    return list().map(function (x) {
      var taken = TE.has(x.id);
      var ok = !taken && slots > 0 && left >= (x.cost || 0);
      var why = taken ? '已落' : (slots <= 0 ? '位置已满' : (left < (x.cost || 0) ? ('残页不够（要 ' + x.cost + '）') : ''));
      return { id: x.id, name: x.name, cost: x.cost, desc: x.desc, taken: taken, ok: ok, why: why };
    });
  };

  /* ============================================================
   * pick —— 落一条（不可退）
   * ============================================================ */
  TE.pick = function (id) {
    var s = st0();
    if (!s) return { ok: false, msg: '无存档' };
    var def = null;
    list().forEach(function (x) { if (x.id === id) def = x; });
    if (!def) return { ok: false, msg: '没有这条' };
    if (TE.has(id)) return { ok: false, msg: '已经落过了' };
    if (TE.slotsLeft() <= 0) {
      return { ok: false, msg: '位置满了 —— 只能落 ' + (D().picks || 3) + ' 条，这就是"选择"的意思' };
    }
    if (TE.leftOf() < (def.cost || 0)) {
      return { ok: false, msg: '残页不够：要 ' + def.cost + '，手上 ' + TE.leftOf() };
    }
    s.picked.push(id);
    if (GAME.log && GAME.log.war) {
      GAME.log.war('📜 从旧世界残页里拼出了「' + def.name + '」—— ' + def.desc
        + '（还能再落 ' + TE.slotsLeft() + ' 条）');
    }
    return { ok: true, msg: '落定「' + def.name + '」。剩下 ' + TE.slotsLeft() + ' 个位置，残页 ' + TE.leftOf() + ' 张。' };
  };

  /* 调试用（界面不暴露）：清空重选 */
  TE.reset = function () { var s = st0(); if (s) s.picked = []; };

  /* ============================================================
   * 加成出口 —— 新系统统一从这里取
   * ------------------------------------------------------------
   * mulOf(key)：乘子（1 + 累加 mul；resist 是**减免**，返回 1 - 累加）
   * addOf(key)：加数（pollution 自净、视野 +1）
   *
   * ⚠️ 必须带缓存：`growth.settleYield` 是**逐城每游戏秒**调一次 mulOf，
   *    100 城压测下每次都重建一遍数组会直接顶到 tickOnce 的性能线
   *    （smoke §v89.107：100 城 < 6ms）。选择变了才重算，O(1) 取值。
   * ============================================================ */
  var _cache = null, _cacheKey = '';
  /* 两类 key：加数型（自净 +2 / 视野 +1）与乘子型（其余都是"按比例"）。
     resist 是乘子里的**减免**，取值时用 1 − sum。 */
  function isAdd(key) { return key === 'purge' || key === 'scout'; }

  function effOf() {
    var s = st0();
    var picked = s ? s.picked : [];      /* 不 slice：每秒每城都会调过来一次 */
    var k = picked.join(',');
    if (_cache && _cacheKey === k) return _cache;
    var mul = {}, add = {};
    picked.forEach(function (id) {
      list().forEach(function (x) {
        if (x.id !== id) return;
        if (isAdd(x.key)) add[x.key] = (add[x.key] || 0) + (x.mul || 0);
        else mul[x.key] = (mul[x.key] || 0) + (x.mul || 0);
      });
    });
    _cache = { mul: mul, add: add };
    _cacheKey = k;
    return _cache;
  }

  TE.mulOf = function (key) {
    var v = effOf().mul[key] || 0;
    if (key === 'resist') return Math.max(0.2, 1 - v);   /* 减免：1 → 0.65 */
    return 1 + v;
  };

  TE.addOf = function (key) { return effOf().add[key] || 0; };

  /* 一行摘要 */
  TE.lineOf = function () {
    var n = TE.pickedOf().length;
    if (!n && !TE.pagesOf()) return '';
    return '📜 废墟残页 ' + TE.pagesOf() + ' 张 · 已落 ' + n + '/' + (D().picks || 3)
      + '（剩 ' + TE.leftOf() + ' 张可用）';
  };
})();
