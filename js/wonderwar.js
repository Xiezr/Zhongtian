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

      /* ① 产出：直接进主城（不经过产量表，避免污染既有口径） */
      var city = GAME.mainCityOf ? GAME.mainCityOf() : (GAME.city && GAME.city.all ? GAME.city.all()[0] : null);
      if (city && GAME.city.add) {
        var base = Math.round(((GAME.res(city).pop || 1000) * 0.02) + 50);
        GAME.city.add(city, 'grain', Math.round(base * (D().bonusGrain || 0.06) * 10));
        GAME.city.add(city, 'iron', Math.round(base * (D().bonusIron || 0.06) * 6));
        out.income++;
      }
      /* ② 保护期过后，声望越高越招人惦记 */
      if (m >= (rec.guardUntil || 0)) {
        var p = 0.04 + (GAME.renown ? Math.min(0.12, (GAME.renown.scoreOf ? GAME.renown.scoreOf() : 0) / 2000) : 0);
        var roll = GAME.invasionRoll ? GAME.invasionRoll('ww|' + pid + '|' + m) : Math.random();
        if (roll < p) { WW.lose(pid, 'faction'); out.lost++; }
      }
    });
    return out;
  };

  WW.lineOf = function () {
    var o = st0();
    var mine = 0, total = 0;
    Object.keys(o || {}).forEach(function (k) { total++; if (o[k] && o[k].owner === 'me') mine++; });
    if (!total) return '';
    return '☄ 奇观：占着 ' + mine + ' 处（全境每月有粮铁入账，保护期过后会被惦记）';
  };
})();
