/* ============================================================
 * wonderwar.js — 奇观：全图唯一的争夺点（v95 · D 组件复用）
 * ------------------------------------------------------------
 * 提案原话：「奇观：建了拿加成 → **全图唯一的世界争夺点**」。
 *
 * 现状：奇观是"探索 + 采集"的地方，谁都可以去采，采完就走。
 *   它不是"点"，只是一个比较肥的矿。
 *
 * 这个模块给奇观一个**归属**：
 *   · 打到第 N 层（现成的 wonderFight 层级）→ 这个奇观归你；
 *   · 归你的时候，全境每月多一笔粮与铁（不多，但白拿）；
 *   · 六个游戏月内别人夺不走（保护期），之后**可以被夺** —— 谁来夺你不用管，
 *     会有势力来抢（按月掷骰，概率随你的声望升高）。
 *
 * ⚠️ 这一版不做"多势力抢奇观"的混战：先把"归属 / 被夺"这条链跑通。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var WW = GAME.wonderwar = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.WONDERWAR) || {}; }

  function st0() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.wonderOwn || typeof s.wonderOwn !== 'object') s.wonderOwn = {};
    return s.wonderOwn;
  }


  /* ============================================================
   * claim —— 打穿奇观之后归我
   * ------------------------------------------------------------
   * 由 battle 的奇观战斗路径调用（见 battle.js 的 wonderFight 分支）。
   * 为了"框架先跑起来"，这里也允许手动调用（面板按钮）。
   * ============================================================ */
  WW.claim = function (pid, lv) {
    var o = st0();
    if (!o) return { ok: false, msg: '无存档' };
    var cur = o[pid];
    if (cur && cur.owner === 'me') return { ok: false, msg: '已经是你的了' };
    var m = (GAME.growth && GAME.growth.monthNow) ? GAME.growth.monthNow() : 0;
    o[pid] = { owner: 'me', at: m, guardUntil: m + (D().holdMonths || 6), lv: lv || 1 };
    if (GAME.renown) GAME.renown.add('honor', 8);
    if (GAME.log && GAME.log.war) {
      GAME.log.war('☄ 奇观归你了（守住 ' + (D().holdMonths || 6) + ' 个月，之后会被别人惦记）—— 全境每月有一笔粮与铁。');
    }
    return { ok: true, msg: '奇观归你了。' };
  };

  /* 被夺走（势力/竞争者） */
  WW.lose = function (pid, by) {
    var o = st0();
    if (!o || !o[pid]) return null;
    o[pid] = { owner: by || 'faction', at: (GAME.growth ? GAME.growth.monthNow() : 0), guardUntil: 0 };
    if (GAME.log && GAME.log.war) {
      GAME.log.war('☄ 你占的奇观被夺走了（' + (by === 'faction' ? '军阀' : '别人') + '）。抢回来得再打一次。');
    }
    return true;
  };

  /* 这一处奇观每月给你什么（v110：九种各不一样）*/
  WW.gainOf = function (pid) {
    var t = (D().gains || {})[pid];
    if (!t) return null;
    return t;
  };
  WW.gainTextOf = function (pid) {
    var t = WW.gainOf(pid);
    if (!t) return '';
    if (t.res) return t.name + ' +' + U.numText(t.n, 0) + '/月';
    if (t.item) return t.name + ' +' + U.numText(t.n, 0) + '/月';
    if (t.fame) return '名声 +' + t.fame + '/月';
    return '';
  };

  /* ============================================================
   * tick —— 每月：归属产出 + 被夺判定
   * ============================================================ */
  WW.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = (GAME.growth && GAME.growth.monthNow) ? GAME.growth.monthNow() : 0;
    if (!force && s.wwMonth === m) return null;
    if (s.wwMonth == null) { s.wwMonth = m; return { first: true }; }
    s.wwMonth = m;

    var o = st0();
    var out = { income: 0, lost: 0 };
    var keys = Object.keys(o);
    if (!keys.length) return out;

    keys.forEach(function (pid) {
      var rec = o[pid];
      if (!rec || rec.owner !== 'me') return;

      /* ① 产出：**每处奇观给的东西不一样**（v110）——直接进主城，不经过产量表 */
      /* v110：`mainCityOf()` 在没有"主城"标记时返回 null ——
         原来这里没有兜底，奇观收益会在那种局里**静默不发**（§330③ 照出来的）。 */
      var city = (GAME.mainCityOf && GAME.mainCityOf())
        || (GAME.currentCity && GAME.currentCity())
        || (GAME.city && GAME.city.all ? GAME.city.all()[0] : null);
      var gn = WW.gainOf(pid);
      if (gn) {
        if (city && gn.res && GAME.city.add) GAME.city.add(city, gn.res, gn.n);
        if (gn.item && GAME.items && GAME.items.add) GAME.items.add(gn.item, gn.n);
        if (gn.fame && GAME.renown && GAME.renown.add) GAME.renown.add('honor', gn.fame);
        out.income++;
        out.detail = out.detail || [];
        out.detail.push({ pid: pid, text: WW.gainTextOf(pid) });
      }
      /* ② 保护期过后，声望越高越招人惦记 —— 但**驻守的兵会让你更难被抢** */
      if (m >= (rec.guardUntil || 0)) {
        var p = 0.04 + (GAME.renown ? Math.min(0.12, (GAME.renown.scoreOf ? GAME.renown.scoreOf() : 0) / 2000) : 0);
        p = p / WW.guardFactorOf(pid);
        var roll = GAME.invasionRoll ? GAME.invasionRoll('ww|' + pid + '|' + m) : Math.random();
        if (roll < p) {
          /* 被夺时驻守的兵不会凭空消失：折损三成，剩下的还能撤回来（见 pull） */
          if (rec.guard > 0) {
            rec.guard = Math.max(0, Math.round(rec.guard * 0.7));
            out.guardLost = (out.guardLost || 0) + Math.round((rec.guard || 0) / 0.7 * 0.3);
          }
          WW.lose(pid, 'faction');
          out.lost++;
        }
      }
    });
    return out;
  };

  /* ============================================================
   * v98.4 驻守 —— 占下来的东西得有人看着
   * ------------------------------------------------------------
   * 之前奇观一旦过了保护期，就只能听天由命（按月掷骰被夺）。
   * 现在你可以**派兵守着**：每 1000 兵，被夺概率 ÷ 1.6（可叠加）。
   * 代价是真的：这些兵不在城里，主城空虚的时候你得自己权衡。
   * ============================================================ */
  WW.guardFactorOf = function (pid) {
    var o = st0();
    var rec = o && o[pid];
    if (!rec || rec.owner !== 'me') return 1;
    var step = D().guardStep || 1000;
    var mul = D().guardMul || 1.6;
    var n = Math.max(0, (rec.guard | 0) / step);
    return Math.pow(mul, n);
  };

  /* 派兵驻守（从城扣，记下是哪座城出的，撤回时还它） */
  WW.keep = function (pid, n, cityId) {
    var o = st0();
    if (!o) return { ok: false, msg: '无存档' };
    var rec = o[pid];
    if (!rec || rec.owner !== 'me') return { ok: false, msg: '这处奇观不是你的' };
    var city = cityId ? (GAME.city && GAME.city.byId ? GAME.city.byId(cityId) : null)
      : (GAME.currentCity ? GAME.currentCity() : null);
    if (!city) return { ok: false, msg: '没有这座城' };
    var want = Math.max(100, Math.round(n || 500));
    var have = GAME.city.armyTotal ? GAME.city.armyTotal(city) : 0;
    if (have < want) return { ok: false, msg: '城里的兵不够（要 ' + want + '，现有 ' + have + '）' };
    /* 按比例从各兵种扣（走既有出口） */
    var a = city.army || {}, take = {};
    for (var k in a) {
      var v = Math.floor(a[k] || 0);
      if (v <= 0) continue;
      var part = Math.floor(want * v / have);
      if (part > 0) take[k] = part;
    }
    var got = 0;
    for (var k2 in take) got += take[k2];
    if (got <= 0) return { ok: false, msg: '凑不出可派的兵' };
    if (GAME.city.armySub) GAME.city.armySub(city, take);
    rec.guard = (rec.guard | 0) + got;
    rec.guardCity = city.id;
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🛡 往奇观派了 ' + U.numText(got, 0) + ' 人驻守（被夺概率 ÷'
        + (Math.round(WW.guardFactorOf(pid) * 100) / 100) + '）');
    }
    return { ok: true, msg: '派驻 ' + U.numText(got, 0) + ' 人守奇观（现在 ÷'
      + (Math.round(WW.guardFactorOf(pid) * 100) / 100) + '）' };
  };

  /* 撤回驻军（还给出兵的那座城） */
  WW.pull = function (pid) {
    var o = st0();
    if (!o) return { ok: false, msg: '无存档' };
    var rec = o[pid];
    if (!rec) return { ok: false, msg: '没有这处奇观' };
    var n = rec.guard | 0;
    if (!n) return { ok: false, msg: '这里没有驻军' };
    var city = (rec.guardCity && GAME.city && GAME.city.byId) ? GAME.city.byId(rec.guardCity)
      : (GAME.currentCity ? GAME.currentCity() : null);
    if (!city) return { ok: false, msg: '城不见了，人散了' };
    if (GAME.city.armyAdd) GAME.city.armyAdd(city, { buxingji: n });
    rec.guard = 0;
    return { ok: true, msg: U.numText(n, 0) + ' 人从奇观撤回' + city.name };
  };

  /* 我占着的奇观列表（UI 渲染驻守按钮用） */
  WW.mineOf = function () {
    var o = st0() || {}, out = [];
    Object.keys(o).forEach(function (pid) {
      var r = o[pid];
      if (r && r.owner === 'me') {
        out.push({ pid: +pid, guard: r.guard | 0, factor: WW.guardFactorOf(pid) });
      }
    });
    return out;
  };

  WW.lineOf = function () {
    var o = st0();
    var mine = 0, total = 0;
    Object.keys(o || {}).forEach(function (k) { total++; if (o[k] && o[k].owner === 'me') mine++; });
    if (!total) return '';
    var g = 0;
    Object.keys(o || {}).forEach(function (k) {
      if (o[k] && o[k].owner === 'me') g += (o[k].guard | 0);
    });
    var bits = [];
    Object.keys(o || {}).forEach(function (k) {
      if (o[k] && o[k].owner === 'me') {
        var tx = WW.gainTextOf(k);
        if (tx) bits.push(k + '：' + tx);
      }
    });
    return '☄ 奇观：占着 ' + mine + ' 处' + (g > 0 ? ('（驻守 ' + U.numText(g, 0) + ' 人）') : '')
      + (bits.length ? '　' + bits.join(' · ') : '')
      + '　保护期过后会被惦记';
  };
})();
