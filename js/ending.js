/* ============================================================
 * ending.js — 终局：接进去，还是关灯（v98）
 * ------------------------------------------------------------
 * 设定里那套调度系统还活着，而且一直开着门。
 * 它当年救过七成人，之后没人敢关 —— 这就是旧世界真正死掉的方式。
 * 这一版把它变成一个**一次性的全局选择** —— 不是结局文本，是两种活法：
 *
 *   ① 接进去（plug）
 *      你的人回到旧都的配给表上：全境产出 +35%。
 *      代价是惰性**锁成单向** —— 每月自己往上爬，打仗也压不下去。
 *      会过得很舒服，然后这座废土上再也不会有五级兵。
 *
 *   ② 关灯（dark）
 *      走一趟城北变电所，把总闸推下来：产出 −10%（水泵停了，得自己挑水）。
 *      这是陈小满试过三次没走完的三公里。惰性每月自己往下掉，
 *      兵员能练满；灰烬教团因此认你。
 *
 * 为什么这两个选项必须都"肉疼"：
 *   如果「接进去」只有好处，那就没有选择；如果只有坏处，那就没人按。
 *   一头是效率，一头是能力 —— 这是这个废土唯一值得选的东西。
 *
 * ⚠️ 三个刻意的边界：
 *   · **不结束游戏**。选了继续玩，只是世界形态变了（不然叫结局，不叫玩法）。
 *   · **不可撤销**（`state.ending.choice` 一旦落库就不再接受第二次）。
 *   · 不进 `tactic.simulate`：产出走 `prodFactors`（拆账同口径），
 *     惰性走 `idle.tick`，外交走既有 `faction.remember`。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var EN = GAME.ending = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.ENDING) || {}; }
  function S() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.ending || typeof s.ending !== 'object') s.ending = { choice: null, at: null };
    return s.ending;
  }
  function optOf(id) {
    var list = D().options || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var s = GAME.state || {};
    return Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  }

  /* ============================================================
   * 开关：什么时候"旧世界的门"才出现
   * ------------------------------------------------------------
   * 开局就给选择没有意义（玩家还不知道自己在守什么）。
   * 三条任一条满足即可 —— 不逼玩家去凑某一条路：
   *   · 手里有 5 座城（已是个小势力）
   *   · 撑过 5 年（60 个游戏月）
   *   · 打掉过一家势力核心（`state.ending.won`，由战果层写）
   * ============================================================ */
  EN.opened = function () {
    var d = D();
    var cities = (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : [];
    var mx = 0;
    cities.forEach(function (c) { if (c && ((c.ci | 0) >= 0)) mx++; });
    if (mx >= (d.openAtCities == null ? 5 : d.openAtCities)) return true;
    if (monthNow() >= (d.openAtMonth == null ? 60 : d.openAtMonth)) return true;
    var st = S();
    if (st && st.won) return true;
    return false;
  };

  EN.choiceOf = function () {
    var st = S();
    return (st && st.choice) || null;
  };

  EN.optionOf = function () { return optOf(EN.choiceOf()); };

  /* ============================================================
   * choose —— 一次性落定
   * ============================================================ */
  EN.choose = function (id) {
    if (!S()) return { ok: false, msg: '还没有开始游戏' };
    if (EN.choiceOf()) {
      return { ok: false, msg: '已经选过了：' + (EN.optionOf() || {}).name + '（这一版不给改）' };
    }
    if (!EN.opened()) {
      return { ok: false, msg: '旧世界的门还没开（要 5 座城、或撑过 5 年、或打掉一家势力核心）' };
    }
    var o = optOf(id);
    if (!o) return { ok: false, msg: '没有这个选项' };

    var st = S();
    st.choice = o.id;
    st.at = monthNow();

    /* 势力态度：这是设定里三种态度的**总账** */
    /* 三家态度的总账。`stand` 是**逐项增量** `{势力: {g,t,f}}`：
       一次选择可以同时"信涨 + 怨降"（关灯 → 灰烬教团既高兴又不再恨你）。
       ⚠️ 第一版写成"正数只加信任、负数只加怨恨"，一次只能动一条 ——
          想表达"怨降信涨"就表达不出来（断言直接照出：怨纹丝不动）。 */
    if (GAME.faction && GAME.faction.standingOf && o.stand) {
      for (var f in o.stand) {
        var inc = o.stand[f] || {};
        var rec = GAME.faction.standingOf(f);
        if (!rec) continue;
        ['g', 'f', 't'].forEach(function (k) {
          if (!inc[k]) return;
          rec[k] = Math.max(0, Math.min(100, ((rec[k] | 0) + inc[k])));
        });
      }
    }

    if (GAME.log && GAME.log.war) {
      GAME.log.war((o.id === 'plug' ? '🔌 ' : '🌑 ') + o.name + '：' + o.desc);
    }
    return { ok: true, msg: o.name + '。' + o.desc, opt: o };
  };

  /* ============================================================
   * 效果出口
   * ------------------------------------------------------------
   * 全部走**加数**（`prodFactors` 的 d 是加数），因为既有口径就是
   * 「总倍率 = 1 + Σ各加成」；这里返回乘数差（0.35 = +35%）。
   * ============================================================ */
  EN.prodAdd = function (res) {
    var o = EN.optionOf();
    if (!o || !o.prodAdd) return 0;
    if (res === 'gold' && o.taxAdd) return (o.taxAdd || 0);
    return o.prodAdd;
  };

  /* 惰性每月修正（正=往上爬，负=往回掉） */
  EN.idlePerMonth = function () {
    var o = EN.optionOf();
    return o && o.idlePerMonth != null ? o.idlePerMonth : 0;
  };

  /* 打仗还能不能让人勤快（接进去之后：不能了，门外什么都没发生） */
  EN.battleBlocked = function () {
    var o = EN.optionOf();
    return !!(o && o.battleBlock);
  };

  /* ============================================================
   * tick —— 每月一条"世界形态"的账
   * ------------------------------------------------------------
   * 只做两件事：把惰性的按月修正落下去（idle.tick 也可以做，
   * 但放这里更清楚是"终局"在推），以及偶尔提醒一次后果。
   * ============================================================ */
  EN.tick = function (force) {
    var s = GAME.state;
    if (!s) return null;
    var m = monthNow();
    if (!force && s.endMonth === m) return null;
    if (s.endMonth == null) { s.endMonth = m; return { first: true }; }
    s.endMonth = m;

    var o = EN.optionOf();
    if (!o) return { noChoice: true };

    var d = D();
    var per = EN.idlePerMonth();
    var out = { month: m, choice: o.id, idleAdj: per };
    if (!per) return out;

    (GAME.city && GAME.city.all ? GAME.city.all() : []).forEach(function (c) {
      if (!c) return;
      var v = ((c.idle | 0) || 0) + per;
      c.idle = Math.max(0, Math.min(d.max == null ? 100 : d.max, Math.round(v * 10) / 10));
    });
    return out;
  };

  /* 战果层调用：打掉一家势力核心 → 终局条件之一 */
  EN.onFactionDown = function () {
    var st = S();
    if (!st) return;
    st.won = (st.won | 0) + 1;
  };

  /* ============================================================
   * 只读出口（界面）
   * ============================================================ */
  EN.ready = function () { return EN.opened() && !EN.choiceOf(); };

  EN.lineOf = function () {
    var o = EN.optionOf();
    if (o) {
      return '世界形态：<b>' + o.name + '</b>　' + o.short
        + '（选了就不能改）';
    }
    if (!EN.opened()) {
      var d = D();
      var cities = (GAME.city && GAME.city.all) ? (GAME.city.all() || []).length : 0;
      return '旧世界的门还关着（' + cities + '/' + (d.openAtCities == null ? 5 : d.openAtCities)
        + ' 座城 · 或撑到第 ' + (d.openAtMonth == null ? 60 : d.openAtMonth) + ' 个月 · 或打掉一家势力核心）';
    }
    return '旧世界的门开着 —— 接进去，还是关灯？';
  };

  /* 面板用：两个选项的实时代价（把数字直接摆出来，不让玩家猜） */
  EN.optionsView = function () {
    var list = D().options || [];
    return list.map(function (o) {
      return {
        id: o.id, name: o.name, short: o.short, desc: o.desc,
        cost: o.costText || '',
        taken: EN.choiceOf() === o.id,
        ok: !EN.choiceOf() && EN.opened()
      };
    });
  };

  void U;

/* ============================================================
 * v100：自注册（可插拔 —— 见 registry.js）
 * ------------------------------------------------------------
 * 这一段原来写在 ui.js 的玩法台里、动作写在 main.js 的 switch 里。
 * 现在"界面块 + 动作"都从模块自己声明：加模块不用再改 ui/main/state 三处。
 * `ctx` 由 ui.js 给：{ sec, U, cities, c0, toast, refresh }
 * ============================================================ */
if (GAME.reg) {
  GAME.reg.add({
    id: 'ending',
    /* 月度结算也走注册表：state.js 只调 GAME.reg.tickAll()，不再逐个点名 */
    tick: function (force) { EN.tick(force); },
    order: 90,
    panel: function (ctx) {
      /* ⚠️ `sec` 是 ui.js 的局部函数，模块里没有 —— 必须从 ctx 取。
         漏了这句就是 ReferenceError，被 RG.panels 的 try/catch 吞成"这块没加载"。 */
      var sec = ctx.sec;
          /* ⑩ 世界形态（v98 终局）：接进去，还是关灯
             —— 这是全局唯一一次"不可撤销"，所以把代价直接摊在按钮上，
                不让玩家去猜一个 ×1.35 背后换掉了什么。 */
          if (GAME.ending) {
            var eo = GAME.ending.optionOf();
            var eH;
            if (eo) {
              eH = '<div>已经定了：<b>' + U.escape(eo.name) + '</b>　' + U.escape(eo.short) + '</div>'
                + '<div class="ui-sub" style="margin-top:4px;">' + U.escape(eo.costText || '') + '</div>';
            } else if (GAME.ending.opened()) {
              eH = '<div class="chips" style="margin-top:2px;">' + GAME.ending.optionsView().map(function (o) {
                return '<span class="chip" data-action="ending-choose" data-eid="' + o.id + '"'
                  + ' title="' + U.escape(o.desc) + '">' + U.escape(o.name) + '　' + U.escape(o.short) + '</span>';
              }).join('') + '</div>'
                + '<div class="ui-sub" style="margin-top:4px;">'
                + '选一次，改不了。接进去是效率，关灯是能力 —— 这个废土上只能挑一头。</div>';
            } else {
              eH = '<div class="ui-sub">' + GAME.ending.lineOf() + '</div>';
            }
            return sec('🌗 世界形态', GAME.ending.lineOf(), eH);
          }
    },
    actions: {
        'ending-choose': function (el, ctx) {
          var r = GAME.ending.choose(el.getAttribute('data-eid'));
          ctx.toast(r.msg); ctx.refresh();
        }
    }
  });
}

})();
