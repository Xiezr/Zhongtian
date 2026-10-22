/* ============================================================
 * prologue.js — 前传：先没有城（v105 · 老板 2026-10-23）
 * ------------------------------------------------------------
 * 老板原话：
 *   「可以做一个前传，就是一开始将领是没有城的，君主是没有城的，
 *     然后呢，可以通过这个在地图上去进行一个探索，到处去打这个废土的
 *     专有的这种，包括科技造物也好啊，这种野兽啊，这个变异生化兽啊什么的，
 *     升到了 20 级或者 40 级，我觉得 20 级可能合适，
 *     然后再给予一个建城的一个机会。」
 *
 * 为什么不真的删城：55 个模块都假设 `state.cities[0]` 存在
 * （`currentCity()` 虽然对空数组返回 null，但下游几十处直接取字段）。
 * 所以用一个**阶段标记**代替"没有城"：
 *
 *   state.prologue.on === true  →  城不产东西、不能建、不能招兵；
 *                                  唯一的玩法是荒野行动（打变异兽/掠夺者）。
 *
 * 「城不产东西」只有一处闸门（`GAME.cityProdPerSec`），
 * 「不能建」一处（`GAME.buildAt`），「不能招」一处（`GAME.train`）——
 * 三个统一出口，不散落到各面板。
 *
 * 荒野行动的内核是 **v89.4 就有的**（DATA.LING_ACT · jianghuCheck / Spend / Roll），
 * 当年 v89.45 老板让"从呈现层剥离、资产保留"。前传正是它该回来的时候：
 * 只是不再挂在地图青旗上，而是做成前传面板里的一列按钮。
 *
 * ⚠️ 刻意不做的：
 *   · 不写"你要重建文明"之类的话 —— 面板只说等级、精力、去哪儿、打什么。
 *   · 不改开局资源（那会推翻几十条断言）。前传期资源在，但产不出新的 ——
 *     那是"辎重"，不是"城产"。
 *   · 默认不开（`newGame` 必须显式传 prologue:true）：324 处测试直接调 newGame，
 *     默认开会让它们全落进前传、产出为 0。玩家走 UI 创建角色时传 true。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var P = GAME.prologue = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.PROLOGUE) || {}; }
  function st0() { return GAME.state || null; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = st0();
    return Math.floor(((s && s.world && s.world.elapsed) || 0) / spm);
  }
  function dayNow() {
    var s = st0();
    return Math.floor(((s && s.world && s.world.elapsed) || 0) / 86400);
  }
  function SP() { return (GAME.sphereOf ? GAME.sphereOf() : GAME.sphere); }

  /* ============================================================
   * 一、阶段开关
   * ============================================================ */
  P.on = function () {
    var s = st0();
    return !!(s && s.prologue && s.prologue.on === true);
  };

  /* newGame 里调（只有显式 prologue:true 才进来）*/
  P.begin = function (st) {
    var s = st || st0();
    if (!s) return;
    s.prologue = { on: true, at: 0, day: -1, acts: 0, builtAt: null };
  };

  P.end = function (why) {
    var s = st0();
    if (!s || !s.prologue) return { ok: false, msg: '没有前传状态' };
    s.prologue.on = false;
    s.prologue.builtAt = monthNow();
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🏯 立城了' + (why ? '：' + why : '') + ' —— 从今天起，这些人有地方过冬了。');
    }
    return { ok: true };
  };

  /* ============================================================
   * 二、君主（前传里唯一能出门的人）
   * ============================================================ */
  P.lord = function () {
    var s = st0();
    if (!s) return null;
    var gs = s.generals || [];
    for (var i = 0; i < gs.length; i++) {
      if (gs[i] && GAME.isLordGeneral && GAME.isLordGeneral(gs[i])) return gs[i];
    }
    return gs.length ? gs[gs.length - 1] : null;   /* 兜底：newGame 把君主排在末尾 */
  };

  P.lv = function () {
    var g = P.lord();
    return (g && g.level) || 1;
  };
  P.needLv = function () { return D().lv || 20; };
  P.ready = function () { return P.on() && P.lv() >= P.needLv(); };

  /* ============================================================
   * 三、附近能做的事
   * ------------------------------------------------------------
   * 球面没有"半径内枚举"的出口，所以抽样 + 按距离筛。
   * 只取**有荒野事**的格子（jianghuActsAt 唯一出口，与内核同一份判据）。
   * ============================================================ */
  P.spots = function () {
    var s = st0(), sp = SP();
    if (!s || !sp || !sp.cells) return [];
    if (!GAME.jianghuActsAt) return [];
    var c = GAME.currentCity ? GAME.currentCity() : null;
    var fromCi = (c && c.ci != null) ? c.ci : 0;
    var d = D(), rad = d.reach || 6, n = sp.cells.length;
    var lim = d.listMax || 5, tries = d.samples || 4000;
    var seen = {}, out = [];
    for (var i = 0; i < tries && out.length < lim * 4; i++) {
      var ci = Math.floor((GAME.invasionRoll ? GAME.invasionRoll('pg|s|' + i) : 0.5) * n) % n;
      if (seen[ci]) continue;
      seen[ci] = 1;
      if (!sp.cells[ci]) continue;
      if (GAME.map && GAME.map.ownCityAt && GAME.map.ownCityAt(ci)) continue;
      var dist = sp.distOf ? sp.distOf({ ci: fromCi }, { ci: ci }) : 99;
      if (dist < 1 || dist > rad) continue;
      var acts = GAME.jianghuActsAt(ci);
      if (!acts.length) continue;
      out.push({ ci: ci, dist: dist, type: sp.cells[ci].type, acts: acts });
    }
    /* 能打的排前面 —— 前传要的是"打野兽"，采集/静修只是顺带。
       同类里再按距离（越近越省事）。 */
    var fightRank = { fight: 0, trial: 0, scene: 1, gather: 2, cultivate: 2, visit: 3 };
    var rankOf = function (o) {
      var best = 9;
      o.acts.forEach(function (a) {
        var k = (a.def && a.def.kind) || '';
        if (fightRank[k] != null && fightRank[k] < best) best = fightRank[k];
      });
      return best;
    };
    out.forEach(function (o) { o.rank = rankOf(o); });
    out.sort(function (a, b) { return (a.rank - b.rank) || (a.dist - b.dist); });
    return out.slice(0, lim);
  };

  /* 这次行动给多少经验：先按 id 查，再按 kind 查。
     荒野行动共 12 种（含六个地形场景），只给四种配表会让玩家撞上"零经验"。 */
  P.expOf = function (actId) {
    var d = D();
    var t = (d.exp || {})[actId];
    if (t != null) return t;
    var a = (GAME.DATA && GAME.DATA.LING_ACT && GAME.DATA.LING_ACT[actId]) || {};
    return (d.expByKind || {})[a.kind] || 0;
  };

  /* ============================================================
   * 四、出去一趟
   * ------------------------------------------------------------
   * 判定/扣费/结算全走既有内核（`GAME.jianghuDo`），这里只补一件事：
   * **给经验**。内核给的是辐能核心与装备，不给经验 —— 前传要的正是经验。
   * 经验走既有 `GAME.battle.gainExp`（含升级、音效、日志）。
   * ============================================================ */
  P.act = function (ci, actId) {
    if (!P.on()) return { ok: false, msg: '已经立城了，这活儿得派队伍出去' };
    var lord = P.lord();
    if (!lord) return { ok: false, msg: '没有君主' };
    if (!GAME.jianghuDo || !GAME.jianghuCheck || !GAME.jianghuRoll) {
      return { ok: false, msg: '荒野行动内核缺失' };
    }
    /* 前传期**不锁日**：野外就在脚下，翻过一遍还能再翻。
       正式阶段的"此地今日已做过"是防止在城里刷行动，前传没有这个场景；
       真正的限制是精力与体力（有限资源才有取舍）。 */
    var s0 = st0();
    if (s0 && s0.jianghu) delete s0.jianghu['c' + ci + '|' + actId];
    /* 走的是**同一套内核**（check → spend → roll），只是把 `jianghuDo` 的三合一
       拆开，好把前传的两把倍率传进去。不另写判定 —— 那是第二个引擎。 */
    var chk = GAME.jianghuCheck(ci, lord.id, actId);
    if (!chk.ok) return chk;
    GAME.jianghuSpend(chk);
    var d = D();
    var def = (GAME.DATA.LING_ACT || {})[actId];
    var bakPow = def ? def.power : null;
    if (def && bakPow) def.power = Math.max(1, bakPow * (d.powerMul || 1));
    var r;
    try {
      r = GAME.jianghuRoll(chk, { pow: d.powMul || 1 });
    } finally {
      if (def && bakPow) def.power = bakPow;   /* 一定要恢复：这张表是正式阶段的 */
    }
    if (!r || !r.ok) return r || { ok: false, msg: '这一趟没去成' };
    var gain = P.expOf(actId);
    if (gain > 0 && GAME.battle && GAME.battle.gainExp) {
      GAME.battle.gainExp(lord, gain, '荒野 · ' + (r.name || actId));
    }
    var s = st0();
    if (s && s.prologue) s.prologue.acts = (s.prologue.acts | 0) + 1;
    return {
      ok: true, gain: gain, bad: !!r.bad,
      msg: (r.name || '') + '　' + (r.text || '') + (gain ? '　经验 +' + gain : '')
    };
  };

  /* ============================================================
   * 五、立城
   * ------------------------------------------------------------
   * 不另起一座：把脚下这座"窝棚"扶正 —— 前传期它是落脚点，不是城。
   * 立城之后三个闸门同时松开（`P.on()` 变 false，闸门自带）。
   * ============================================================ */
  P.build = function () {
    if (!P.on()) return { ok: false, msg: '已经立过城了' };
    if (!P.ready()) {
      return { ok: false, msg: '君主还没到 Lv' + P.needLv() + '（现在 Lv' + P.lv() + '）' };
    }
    var c = GAME.currentCity ? GAME.currentCity() : null;
    P.end(c ? c.name : '');
    return { ok: true, msg: '立城了 —— 城里的东西从今天起才真的算你的' };
  };

  /* ============================================================
   * 六、每天回一点精力（不然打两下就动不了）
   * ============================================================ */
  P.tick = function () {
    var s = st0();
    if (!s || !P.on()) return;
    var pg = s.prologue;
    var day = dayNow();
    if (pg.day === day) return;
    pg.day = day;
    var lord = P.lord();
    if (!lord) return;
    var add = D().restPerDay || 30;
    if (GAME.energyMaxOf && GAME.setEnergyNow) {
      var cap = GAME.energyMaxOf(lord);
      GAME.setEnergyNow(lord, Math.min(cap, (lord.energy || 0) + add));
    }
    if (GAME.staMaxOf && GAME.setStaNow) {
      var scap = GAME.staMaxOf(lord);
      GAME.setStaNow(lord, Math.min(scap, GAME.staNow(lord) + add));
    }
  };

/* ============================================================
 * v100 注册表（可插拔）：界面块 + 动作都从模块自己声明
 * ctx = { sec, U, cities, c0, toast, refresh }
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'prologue',
    order: 5,
    tick: function () { P.tick(); },
    panel: function (ctx) {
      /* ⚠️ sec 是 ui.js 的局部函数 —— 模块里必须从 ctx 取 */
      var sec = ctx.sec;
      if (!P.on()) return '';
      var lord = P.lord();
      var lv = P.lv(), need = P.needLv();
      var en = Math.round((lord && lord.energy) || 0);
      var enMax = (lord && GAME.energyMaxOf) ? Math.round(GAME.energyMaxOf(lord)) : 100;
      var spots = P.spots();

      var head = '<div style="margin-top:2px;">你们还没有城 —— 君主 <b>Lv' + lv + '</b> / '
        + need + '　精力 ' + en + ' / ' + enMax + '</div>';

      var listH = '';
      if (!spots.length) {
        listH = '<div class="ui-sub" style="margin-top:4px;">附近没找到能下手的地方 —— 换个位置，或者等明天。</div>';
      } else {
        listH = '<div class="ui-sub" style="margin-top:5px;">附近可去：</div>'
          + spots.map(function (sp) {
            var tn = (GAME.DATA.TERRAIN[sp.type] || {}).name || sp.type;
            var chips = sp.acts.map(function (a) {
              return '<span class="chip" data-action="prologue-act" data-ci="' + sp.ci
                + '" data-act="' + U.escape(a.id) + '">' + U.escape(a.def.name)
                + '（精' + a.def.energy + ' 体' + a.def.stam + '）</span>';
            }).join('');
            return '<div style="margin-top:3px;">' + sp.dist + ' 格 · ' + U.escape(tn) + '　' + chips + '</div>';
          }).join('');
      }

      var buildH = '';
      if (P.ready()) {
        buildH = '<div class="chips" style="margin-top:6px;">'
          + '<span class="chip" data-action="prologue-build">立城（Lv' + need + ' 已满）</span></div>';
      }

      return sec('🕯 还没有城', '第 ' + dayNow() + ' 天 · 走到哪儿算哪儿',
        head + listH + buildH
        + '<div class="ui-sub" style="margin-top:5px;">'
        + '前传期间城不产东西、不能建、不能招兵 —— 你带的是一队人，不是一座城。'
        + '君主升到 Lv' + need + ' 才能立城。</div>');
    },
    actions: {
      'prologue-act': function (el, ctx) {
        var ci = Number(el.getAttribute('data-ci'));
        var act = el.getAttribute('data-act');
        var r = P.act(ci, act);
        ctx.toast(r.msg); ctx.refresh();
      },
      'prologue-build': function (el, ctx) {
        var r = P.build();
        ctx.toast(r.msg); ctx.refresh();
      }
    }
  });
}

})();
