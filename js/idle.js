/* ============================================================
 * idle.js — 在配给表上活了三代（v97 · 设定灵魂的游戏化）
 * ------------------------------------------------------------
 * 世界设定（`docs/世界设定-灰岗纪事.md`）里的真相：
 *
 *   「旧世界不是毁于战争，也不是毁于顺利。它毁于一次没人敢收尾的抢救。
 *     灾难来时，人把水、电、饭、药全交给了一套调度系统 —— 它真的救了
 *     多数人。危机过去了，却没人敢把它关掉：关掉就意味着重新有人饿死。
 *     一代两代三代，会修它的人死了，会自己活的人也死了。」
 *
 * 所以惰性的来源不是"系统太好心"，是 **应急状态被永久化了**：
 * 城里的口粮一直在配给表上，从出生到死，没人有过自己动手的必要。
 * 这不是懒，是**没学过**。
 *
 * 之前这个设定只存在于文档里 —— 游戏里没有任何东西能让人"退功"。
 * 玩家甚至反过来奖励自动化：自动治疗、自动招募、自动采集，越开越省事。
 *
 * 这个模块把那句话变成**一条会咬人的账**：
 *   · 每座城有一个「惰性」（0-100）；
 *   · 自动化开得越多、越久没打仗，惰性涨得越快；
 *   · 惰性直接压**兵员等级上限** ——
 *     每 25 点惰性，这座城的兵最高只能训到低一级（100 惰性 = 只能练一级兵）。
 *
 * 于是"被照顾着"第一次有了价格：你想要五级精锐，就得让城里人真动一次手
 * （关掉几个自动化、或者去打一仗）。这不是惩罚玩家挂机，
 * 是让"省事"和"能打"变回一笔真的交换 —— 正是设定里那件事。
 *
 * ⚠️ 刻意不做的事：
 *   · 不动粮产总表（惰性只压兵员等级上限，不压产出）。
 *   · 不自动惩罚，全部可见：城面板与玩法台都写着"惰性多少、卡住了几级"。
 *   · 给一个**手动出口**：组织一次劳动（花粮）能压 18 点 —— 玩家永远有得选。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var ID = GAME.idle = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.IDLE) || {}; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  ID.of = function (city) { return (city && (city.idle | 0)) || 0; };

  /* 惰性压掉几级兵员上限（每 25 点一级） */
  ID.penaltyOf = function (city) {
    var per = D().lvPenaltyAt == null ? 25 : D().lvPenaltyAt;
    return Math.floor(ID.of(city) / Math.max(1, per));
  };

  /* 这座城兵员等级的真实上限（trooplv 读它） */
  ID.maxLvOf = function (city) {
    var top = D().topLv == null ? 5 : D().topLv;
    return Math.max(1, top - ID.penaltyOf(city));
  };

  /* 现在开了几个自动化 */
  ID.autosOf = function () {
    var s = GAME.state;
    var t = (s && s.settings) || {};
    var n = 0;
    if (t.autoHeal) n++;
    if (t.autoTrain) n++;
    if (t.autoGather) n++;
    if (t.autoBuy) n++;
    if (t.autoBuild) n++;
    return n;
  };

  /* ============================================================
   * tick —— 每月结一次
   * ============================================================ */
  ID.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.idleMonth === m) return null;
    if (s.idleMonth == null) { s.idleMonth = m; return { first: true }; }
    s.idleMonth = m;

    var d = D();
    var autos = ID.autosOf();
    var out = { month: m, rose: 0, fell: 0, autos: autos };

    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      var v = ID.of(c), before = v;

      /* ① 自动化：每开一个每月 +（"省事"是有代价的） */
      if (autos > 0) v += autos * (d.perMonthAuto == null ? 1.6 : d.perMonthAuto);

      /* ② 太久没打仗：危机感没了（6 个月以上） */
      var lastB = c.lastBattleMonth;
      if (lastB == null || (m - lastB) > (d.peaceAfter == null ? 6 : d.peaceAfter)) {
        v += (d.perMonthPeace == null ? 1.2 : d.perMonthPeace);
      }

      /* ③ 有进修/建造在跑：人还在干活，往回压一点 */
      var busy = 0;
      ((s.queues && s.queues.build) || []).forEach(function (q) { if (q.cityId === c.id) busy++; });
      ((s.queues && s.queues.train) || []).forEach(function (q) { if (q.cityId === c.id) busy++; });
      if (busy > 0) v -= Math.min(3, busy) * (d.perMonthBusy == null ? 0.8 : d.perMonthBusy);

      v = Math.max(0, Math.min(d.max == null ? 100 : d.max, v));
      c.idle = Math.round(v * 10) / 10;
      if (c.idle > before) out.rose++;
      else if (c.idle < before) out.fell++;

      /* ④ 惰性第一次压到兵员上限时提醒一次（玩家必须知道为什么升不了级） */
      var pen = ID.penaltyOf(c);
      if (pen > 0 && c.idleWarned !== pen) {
        c.idleWarned = pen;
        if (GAME.log && GAME.log.war) {
          GAME.log.war('🧠 ' + c.name + '的人开始"被照顾惯了"：兵员等级上限降到 Lv'
            + ID.maxLvOf(c) + '（关掉几个自动化，或组织一次劳动能压回去）');
        }
      }
    });
    return out;
  };

  /* ============================================================
   * onBattle —— 打一仗，人立刻勤快起来
   * ------------------------------------------------------------
   * 这是惰性的**主要出口**。为什么用"打仗"而不是"劳动按钮"：
   *   设定里让人变废的是"不需要做事"，而战事是最强的"必须做事"。
   *   所以最省力的解法不是点按钮，是出去打一仗。
   * ============================================================ */
  ID.onBattle = function (city, scale) {
    if (!city) return null;
    var d = D();
    var drop = (d.battleDrop == null ? 12 : d.battleDrop) * Math.max(0.5, Math.min(2, scale || 1));
    /* v98：**接进去了就别指望打仗能让人勤快** ——
       门外什么都没发生，水照供、饭照送，人不会因为"别人家在打仗"就学会种地。
       保留 10% 的残余（城里总有几个闲不住的人），但压不回上限。 */
    if (GAME.ending && GAME.ending.battleBlocked && GAME.ending.battleBlocked()) drop *= 0.1;
    var before = ID.of(city);
    city.idle = Math.max(0, Math.round((before - drop) * 10) / 10);
    city.lastBattleMonth = monthNow();
    city.idleWarned = 0;
    return { drop: Math.round((before - city.idle) * 10) / 10 };
  };

  /* ============================================================
   * work —— 组织一次劳动（花粮，压惰性）
   * ------------------------------------------------------------
   * 给"我就是不想打仗"的玩家留一条路。代价是粮：让闲着的人干活，
   * 得管饭。一杯粮换一点勤快，不算便宜。
   * ============================================================ */
  ID.work = function (city) {
    if (!city) return { ok: false, msg: '没有这座城' };
    var d = D();
    var m = monthNow();
    if (city.idleWorkMonth === m) return { ok: false, msg: '这个月已经组织过了（一个月一次）' };
    var pop = (GAME.res(city).pop || 0);
    var cost = Math.max(200, Math.round(pop * (d.workCostPerPop == null ? 0.6 : d.workCostPerPop)));
    var R = GAME.res(city);
    if ((R.grain || 0) < cost) {
      return { ok: false, msg: '组织劳动要 ' + U.numText(cost, 0) + ' 粮（现有 ' + U.numText(R.grain || 0, 0) + '）' };
    }
    /* ⚠️ 扣资源走 sub（add 不吃负数） */
    if (GAME.city && GAME.city.sub) GAME.city.sub(city, 'grain', cost);
    var before = ID.of(city);
    city.idle = Math.max(0, Math.round((before - (d.workDrop == null ? 18 : d.workDrop)) * 10) / 10);
    city.idleWorkMonth = m;
    city.idleWarned = 0;
    return {
      ok: true,
      msg: '组织了一场劳动（耗粮 ' + U.numText(cost, 0) + '）：惰性 ' + Math.round(before)
        + ' → ' + Math.round(city.idle) + '，兵员上限回到 Lv' + ID.maxLvOf(city)
    };
  };

  /* ---------- 只读出口 ---------- */
  ID.lineOf = function () {
    var worst = null;
    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!worst || ID.of(c) > ID.of(worst)) worst = c;
    });
    if (!worst || ID.of(worst) < 10) return '';
    return '🧠 惰性最重的是' + worst.name + '：' + Math.round(ID.of(worst)) + '/100'
      + '（兵员上限 Lv' + ID.maxLvOf(worst) + '；自动化 ' + ID.autosOf() + ' 个开着）';
  };

  ID.cityLine = function (city) {
    if (!city) return '';
    var v = Math.round(ID.of(city)), cap = ID.maxLvOf(city);
    return v + '/100（兵员上限 Lv' + cap + '）';
  };

/* ============================================================
 * v100：自注册（可插拔 —— 见 registry.js）
 * ------------------------------------------------------------
 * 这一段原来写在 ui.js 的玩法台里、动作写在 main.js 的 switch 里。
 * 现在"界面块 + 动作"都从模块自己声明：加模块不用再改 ui/main/state 三处。
 * `ctx` 由 ui.js 给：{ sec, U, cities, c0, toast, refresh }
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'idle',
    /* 月度结算也走注册表：state.js 只调 GAME.reg.tickAll()，不再逐个点名 */
    tick: function (force) { ID.tick(force); },
    order: 70,
    panel: function (ctx) {
      /* ⚠️ `sec` 是 ui.js 的局部函数，模块里没有 —— 必须从 ctx 取。
         漏了这句就是 ReferenceError，被 RG.panels 的 try/catch 吞成"这块没加载"。 */
      var sec = ctx.sec;
          /* ①.c 惰性（v97）：在配给表上活了三代 */
          if (GAME.idle) {
            var idH = ctx.cities.map(function (c) {
              var v = Math.round(GAME.idle.of(c));
              if (v < 8) return '';
              return '<span class="chip" data-action="idle-work" data-cid="' + U.escape(c.id) + '"'
                + ' title="' + U.escape('组织一次劳动（一个月一次）：降 18 点惰性，耗粮按人口算') + '">'
                + U.escape(c.name) + ' · ' + v + '/100 · 兵员上限 Lv' + GAME.idle.maxLvOf(c) + ' · 组织劳动</span>';
            }).join('');
            return sec('🧠 惰性', GAME.idle.lineOf() || '城里的人还勤快',
              '<div class="chips" style="margin-top:5px;">' + idH + '</div>'
              + '<div class="ui-sub" style="margin-top:4px;">'
              + '「它救过我们。这就是我们不能关掉它的原因。」—— '
              + '口粮一直在配给表上，也就一直没人学过别的。自动化开得越多、越久没打仗，人越退功；'
              + '每 25 点惰性压掉一级兵员上限（最高 5 级）。'
              + '打仗是最快的解法（一仗降 12 点），其次才是组织劳动。</div>');
          }

    },
    actions: {
        'idle-work': function (el, ctx) {
          var r = GAME.idle.work(GAME.city.byId(el.getAttribute('data-cid')));
          ctx.toast(r.msg); ctx.refresh();
        }
    }
  });
}

})();
