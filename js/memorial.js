/* ============================================================
 * memorial.js — 阵亡名录
 * ------------------------------------------------------------
 * 老板：「兵源无限 —— 2h 补满、兵种廉价 … 我们怎么确认之前认为
 * 万无一失的设定，实际上在摧毁游戏？」
 * 老板：「死多少不是问题，问题是死亡换来什么。」
 *
 * 这个模块做的只有一件事：**让死掉的人留下名字。**
 *
 * ⚠️ 刻意不做的事：
 *   · 不给死亡加成（"每死 100 人全军 +1% 攻击"这类）——
 *     那会把阵亡标上汇率，玩家开始算"送多少人头最划算"，
 *     道德感就变了。老板明确说过不要。
 *   · 不惩罚、不弹窗、不拦出征 —— 它只是一面墙，不是一道闸。
 *
 * 记录的粒度：**一次战斗一条**（地点 / 年月 / 兵种构成 / 人数 / 胜负）。
 * 不做逐人流水账：一场大仗死几千人，逐条记会把存档撑爆，
 * 而且没人会去读第 8142 条。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var M = GAME.memorial = {};

  var MAX = 240;          /* 名录上限（滚动，丢最旧） */

  function seasonName(i) {
    return ['春', '夏', '秋', '冬'][((i | 0) % 4 + 4) % 4];
  }

  /* 兵种名（DATA.TROOPS 缺项时退回 id，不让 UI 出现 undefined） */
  function troopName(id) {
    var T = (GAME.DATA && GAME.DATA.TROOPS) || {};
    return (T[id] && T[id].name) || id;
  }

  /* ============================================================
   * record —— 一次战斗落账
   * ------------------------------------------------------------
   * o = { sent, back, wounded, place, ci, win, mode, gen }
   *   sent    出征时的编制 { troopId: n }
   *   back    归队（returnArmy 返回的 back）
   *   wounded 抬回来的伤兵（能治活，**不算未归**）
   *
   * 未归 = 派出去 − 回来 − 抬回来。
   * 只有这个数 > 0 才写一条 —— 全须全尾回来的仗不值得刻。
   * ============================================================ */
  M.record = function (o) {
    o = o || {};
    var st = GAME.state;
    if (!st) return null;
    var sent = o.sent || {}, back = o.back || {}, wounded = o.wounded || {};
    var lost = {}, total = 0, id, gone;
    for (id in sent) {
      gone = Math.max(0, Math.floor(sent[id] || 0)) - Math.floor(back[id] || 0) - Math.floor(wounded[id] || 0);
      if (gone > 0) { lost[id] = gone; total += gone; }
    }
    if (total <= 0) return null;

    var w = st.world || {};
    var rec = {
      y: w.year || 1,
      s: w.season || 0,
      place: o.place || '无名之地',
      ci: (o.ci != null && o.ci >= 0) ? o.ci : null,
      n: total,
      by: lost,
      win: !!o.win,
      mode: o.mode || '',
    };
    st.memorial = st.memorial || [];
    st.memorial.push(rec);
    /* 滚动上限：超了就丢最旧的。丢掉的是"记账"，不是"发生过" ——
       累计总数另存在 stats 里，永远不会因为淘汰而减少。 */
    while (st.memorial.length > MAX) st.memorial.shift();
    st.stats = st.stats || {};
    st.stats.deadTotal = (st.stats.deadTotal || 0) + total;
    st.stats.deadBattles = (st.stats.deadBattles || 0) + 1;
    return rec;
  };

  /* 名录（最新在前）。UI 直接用。 */
  M.list = function (limit) {
    var arr = ((GAME.state || {}).memorial || []).slice().reverse();
    return limit ? arr.slice(0, limit) : arr;
  };

  /* 累计未归人数（含已被滚动淘汰的 —— 与 stats 同源，不因 UI 上限缩水） */
  M.total = function () {
    var s = (GAME.state && GAME.state.stats) || {};
    if (s.deadTotal != null) return s.deadTotal | 0;
    /* 老档没有 stats.deadTotal → 现算名录（会偏小，但不会显示 0）*/
    var n = 0;
    ((GAME.state || {}).memorial || []).forEach(function (r) { n += (r.n || 0); });
    return n;
  };

  /* 一地累计（地图上留 † 用） */
  M.byPlace = function () {
    var map = {};
    ((GAME.state || {}).memorial || []).forEach(function (r) {
      if (r.ci == null) return;
      var k = r.ci;
      map[k] = (map[k] || 0) + (r.n || 0);
    });
    return map;
  };

  /* 一条记录的一行文字（UI / 战报共用，避免两处措辞不一致） */
  M.lineOf = function (r) {
    if (!r) return '';
    var parts = [];
    Object.keys(r.by || {}).forEach(function (id) {
      parts.push(troopName(id) + ' ' + r.by[id]);
    });
    parts.sort();
    return '第 ' + r.y + ' 年' + seasonName(r.s) + '　' + r.place + '　'
      + r.n + ' 人未归' + (parts.length ? '（' + parts.join(' · ') + '）' : '')
      + (r.win ? '' : '　· 此战失利');
  };

  /* 空名录时给一句话（不要空白页） */
  M.emptyText = function () {
    return '这面墙上还没有名字。';
  };
})();
