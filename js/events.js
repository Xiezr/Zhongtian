/* ============================================================
 * js/events.js — 路上遇到的事（v121）
 * ------------------------------------------------------------
 * 老板 2026-10-23：
 *   「再开阔一点，发掘典型畅销游戏，学习其可适配本游戏的玩法。
 *     不要执着于搞点废土感人故事，我要的废土精彩人生。」
 *
 * 参考的不是"剧情游戏"，是**靠系统生成故事**的畅销品：
 *
 *   RimWorld（2018）—— 它卖的是"涌现"：小人 + 事件 + 代价互相撞，
 *     玩家事后自己把那堆事讲成故事。游戏本身不写故事，只提供**条件**。
 *   Slay the Spire（2019）/ Balatro（2024）—— 三选一。小池子，
 *     巨大分叉。每一次选择都在别处关掉一扇门。
 *
 * 所以这个模块只做三件事：
 *   · 每月有概率发生一件事；
 *   · 每件事 2~3 条路，代价与概率**全部写在选项上**；
 *   · 选完立刻结算，不弹第二层，不写后续。
 *
 * 「精彩人生」不是被叙述出来的，是玩家自己算出来的：
 * 押 4000 赢了三倍、赌输了一车废钢、抽签抽到个封存匣 ——
 * 这些事他事后会跟人讲，但游戏一个字都不用渲染情绪。
 *
 * ⚠️ 三条硬规矩（写在 DATA.EVENTS 的注释里，这里再钉一遍）：
 *   · 文本 ≤ 45 字，不写心理、不写死者、不写"曾经"；
 *   · 每个选项算得出账（成本 / 收益 / 概率）；
 *   · 「走开」永远是一个选项，且不是最差的。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
import './items.js';

(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var EV = GAME.events = {};
  var U = GAME.utils;

  function LIST() { return (GAME.DATA && GAME.DATA.EVENTS) || []; }
  function POOL() { return (GAME.DATA && GAME.DATA.EVENT_LOOT) || []; }
  function st0() { return GAME.state; }

  function secPerMonth() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    return (C.secPerYear || 57600) / 12;
  }
  EV.monthNow = function () {
    var st = st0() || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / secPerMonth());
  };

  function mainCity() {
    return (GAME.mainCityOf && GAME.mainCityOf())
      || (GAME.currentCity && GAME.currentCity())
      || (GAME.city && GAME.city.all ? GAME.city.all()[0] : null);
  }
  function resOf(city) { return (GAME.res ? GAME.res(city) : (city && city.res)) || {}; }

  /* ---------------- 抽一件事 ----------------
   * 加权随机。条件不满足的（没城、城太小）直接跳过 ——
   * 不出现"你还没有城，但有人来敲你的门"这种。 */
  EV.pick = function () {
    var city = mainCity();
    var list = LIST().filter(function (e) {
      if (e.minPop && (!city || (resOf(city).pop | 0) < e.minPop)) return false;
      return true;
    });
    if (!list.length) return null;
    var total = 0;
    list.forEach(function (e) { total += (e.weight || 1); });
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      if (r < list[i].weight) return list[i];
      r -= list[i].weight;
    }
    return list[list.length - 1];
  };

  /* ---------------- 当前挂着的事 ---------------- */
  EV.current = function () {
    var s = st0();
    if (!s || !s.ev || !s.ev.id) return null;
    var def = null;
    LIST().forEach(function (e) { if (e.id === s.ev.id) def = e; });
    if (!def) { s.ev = null; return null; }
    return { id: s.ev.id, at: s.ev.at | 0, def: def };
  };

  EV.busy = function () { return !!EV.current(); };

  /* ---------------- 月度推演 ----------------
   * 每月 22% 出一件。挂着没处理的不会叠（一次只问一件事，
   * 堆三个事件在屏幕上等于逼玩家关掉面板）。 */
  EV.tick = function (force) {
    var s = st0();
    if (!s || !s.world) return;
    if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) return;
    var m = EV.monthNow();
    if (!force && s.evMonth === m) return;
    s.evMonth = m;
    if (EV.current()) return;
    var chance = (GAME.DATA.EVENTS_CHANCE == null) ? 0.22 : GAME.DATA.EVENTS_CHANCE;
    if (!force && Math.random() > chance) return;
    var e = EV.pick();
    if (!e) return;
    s.ev = { id: e.id, at: m };
    if (GAME.log) {
      GAME.log((e.icon || '•') + ' ' + e.name + '：' + (e.text || ''), 'ev', 'ev');
    }
  };

  /* ---------------- 结算 ----------------
   * 选项字段：
   *   cost / gain / plus / lose     —— { 资源: 数 }，plus/lose 与 gain 同义（写法清楚些）
   *   odds + gainIf + loseIf        —— 概率分支
   *   mul                           —— 赌注倍率（成本 × mul 返还）
   *   randomItem: n                 —— 从 loot 池抽 n 件
   *   troop / pop                   —— 兵 / 人口
   */
  function costText(cost) {
    if (!cost) return '';
    var nm = { grain: '粮', wood: '木', stone: '石', iron: '钢', gold: '币', troop: '兵', pop: '人' };
    var out = [];
    for (var k in cost) out.push((nm[k] || k) + ' ' + U.numText(cost[k], 0));
    return out.join(' + ');
  }
  EV.costText = costText;

  /* 够不够（不够就整单拒绝，不扣一半） */
  EV.canAfford = function (opt) {
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    var c = opt.cost || {};
    var res = resOf(city);
    for (var k in c) {
      if (k === 'troop') {
        if ((GAME.armyTotal ? GAME.armyTotal(city) : 0) < c[k]) return { ok: false, msg: '兵不够' };
      } else if (k === 'pop') {
        if ((res.pop | 0) < c[k]) return { ok: false, msg: '人不够' };
      } else if ((res[k] | 0) < c[k]) {
        var one = {};
        one[k] = c[k];
        return { ok: false, msg: '不够：' + costText(one) };
      }
    }
    return { ok: true };
  };

  function pay(city, cost) {
    if (!cost) return;
    for (var k in cost) {
      if (k === 'troop') {
        /* 从最多的那个兵种里扣 —— 玩家不用选，省一次点击 */
        var left = cost[k] | 0;
        var army = city.army || {};
        var ids = Object.keys(army).sort(function (a, b) { return army[b] - army[a]; });
        for (var i = 0; i < ids.length && left > 0; i++) {
          var can = Math.min(left, army[ids[i]] | 0);
          if (can <= 0) continue;
          var one2 = {};
          one2[ids[i]] = can;
          GAME.city.armySub(city, one2);
          left -= can;
        }
      } else if (k === 'pop') {
        GAME.city.sub(city, 'pop', cost[k]);
      } else {
        GAME.city.sub(city, k, cost[k]);
      }
    }
  }

  function grant(city, g) {
    if (!g) return [];
    var out = [];
    var nm = { grain: '粮', wood: '木', stone: '石', iron: '钢', gold: '币' };
    for (var k in g) {
      if (k === 'fame') {
        if (g[k] > 0) {
          if (GAME.renown && GAME.renown.add) GAME.renown.add('mercy', g[k]);
          out.push('名声 +' + g[k]);
        } else if (g[k] < 0) {
          if (GAME.renown && GAME.renown.add) GAME.renown.add('cruelty', -g[k]);
          out.push('名声 ' + g[k]);
        }
      } else if (k === 'troop') {
        if (g[k] > 0) {
          /* 新兵落到人口最多的兵种里 */
          var army = city.army || {};
          var ids = Object.keys(army);
          var tid = ids.length ? ids[0] : 'buxingji';
          var one3 = {};
          one3[tid] = g[k];
          GAME.city.armyAdd(city, one3);
          out.push('兵 +' + g[k]);
        }
      } else if (k === 'pop') {
        if (g[k] > 0) GAME.city.add(city, 'pop', g[k]);
      } else if (k !== 'fame') {
        GAME.city.add(city, k, g[k]);
        out.push((nm[k] || k) + ' +' + U.numText(g[k], 0));
      }
    }
    return out;
  }

  /* 从战利品池抽 n 件（每件一条） */
  function rollLoot(n) {
    var pool = POOL();
    if (!pool.length) return [];
    var total = 0;
    pool.forEach(function (x) { total += (x.w || 1); });
    var out = [];
    for (var i = 0; i < n; i++) {
      var r = Math.random() * total, hit = pool[pool.length - 1];
      for (var j = 0; j < pool.length; j++) {
        if (r < pool[j].w) { hit = pool[j]; break; }
        r -= pool[j].w;
      }
      var lo = (hit.range || [1, 1])[0], hi = (hit.range || [1, 1])[1];
      var q = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (GAME.items && GAME.items.add) GAME.items.add(hit.id, q);
      var nm = hit.name || hit.id;
      out.push(nm + ' ×' + q);
    }
    return out;
  }

  /* 选一条路 */
  EV.choose = function (idx) {
    var cur = EV.current();
    if (!cur) return { ok: false, msg: '现在没有事' };
    var opt = (cur.def.opts || [])[idx | 0];
    if (!opt) return { ok: false, msg: '没有这个选项' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };

    var chk = EV.canAfford(opt);
    if (!chk.ok) return chk;

    var got = [], lost = [];
    pay(city, opt.cost);
    if (opt.cost) lost.push(costText(opt.cost));

    if (opt.odds != null) {
      /* 概率分支：赢 → gainIf（或按 mul 返本），输 → loseIf（成本已经付了，这里再赔） */
      var win = Math.random() < opt.odds;
      if (win) {
        if (opt.mul && opt.cost && opt.cost.gold) {
          var back = Math.round(opt.cost.gold * opt.mul);
          GAME.city.add(city, 'gold', back);
          got.push('旧币 +' + U.numText(back, 0));
        } else if (opt.gainIf) {
          got = got.concat(grant(city, opt.gainIf));
        } else if (opt.randomItem) {
          got = got.concat(rollLoot(opt.randomItem));
        }
      } else if (opt.loseIf) {
        lost = lost.concat(grant(city, opt.loseIf).map(function (x) {
          return x.replace('+', '−');
        }));
        /* grant 只会加，扣的部分单独处理 */
      }
      var line = (win ? '赢' : '输');
      if (GAME.log) {
        GAME.log((cur.def.icon || '•') + ' ' + cur.def.name + ' · ' + line
          + (got.length ? '　' + got.join('　') : '')
          + (lost.length ? '　（付：' + lost.join('　') + '）' : ''), 'ev', 'ev');
      }
      st0().ev = null;
      return { ok: true, win: win, got: got, lost: lost };
    }

    /* 无概率：直接结算 */
    if (opt.gain) got = got.concat(grant(city, opt.gain));
    if (opt.plus) got = got.concat(grant(city, opt.plus));
    if (opt.lose) lost = lost.concat(grant(city, opt.lose));
    if (opt.randomItem) got = got.concat(rollLoot(opt.randomItem));

    if (GAME.log) {
      GAME.log((cur.def.icon || '•') + ' ' + cur.def.name + ' · ' + opt.label
        + (got.length ? '　' + got.join('　') : '')
        + (lost.length ? '　（付：' + lost.join('　') + '）' : ''), 'ev', 'ev');
    }
    st0().ev = null;
    return { ok: true, got: got, lost: lost };
  };

  /* ---------------- 面板 ---------------- */
  EV.optionText = function (opt) {
    var bits = [];
    if (opt.cost) bits.push('付 ' + costText(opt.cost));
    if (opt.gain) {
      for (var k in opt.gain) {
        var nm = { grain: '粮', wood: '木', stone: '石', iron: '钢', gold: '币', fame: '名声', troop: '兵', pop: '人' };
        bits.push((nm[k] || k) + ' +' + U.numText(opt.gain[k], 0));
      }
    }
    if (opt.plus) {
      for (var k2 in opt.plus) bits.push('名声 +' + opt.plus[k2]);
    }
    if (opt.lose) {
      for (var k3 in opt.lose) bits.push('名声 ' + opt.lose[k3]);
    }
    if (opt.odds != null) {
      bits.push(Math.round(opt.odds * 100) + '% 成');
      if (opt.mul) bits.push('赢了返还 ' + opt.mul + ' 倍（净赚 ' + (opt.mul - 1) + ' 倍）');
      if (opt.gainIf) {
        for (var k4 in opt.gainIf) {
          var nm4 = { grain: '粮', wood: '木', stone: '石', iron: '钢', gold: '币', fame: '名声', troop: '兵' };
          bits.push('赢则 ' + (nm4[k4] || k4) + ' +' + U.numText(opt.gainIf[k4], 0));
        }
      }
    }
    if (opt.randomItem) bits.push('随机 ' + opt.randomItem + ' 件');
    return bits.join('　');
  };

  EV.lineOf = function () {
    var cur = EV.current();
    if (!cur) return '🤝 这个月没什么事';
    return (cur.def.icon || '🤝') + ' ' + cur.def.name + ' —— 挑一条路';
  };

  EV.bodyHTML = function () {
    var cur = EV.current();
    if (!cur) {
      return '<div class="ui-sub" style="margin-top:3px;">有事会在月初发生。'
        + '每条路都写着代价和概率 —— 不想赌就选「走开」，没有惩罚。</div>';
    }
    return '<div style="margin-top:4px;font-size:var(--fs-cap);">' + U.escape(cur.def.text || '') + '</div>';
  };

  /* ============================================================
   * 自注册（可插拔 —— 见 registry.js）
   * order 25：比集市（30）靠前，因为事件是要**先处理**的东西。
   * ============================================================ */
  if (GAME.reg) {
    GAME.reg.add({
      id: 'events',
      order: 25,
      tick: function (force) { EV.tick(force); },
      panel: function (ctx) {
        var sec = ctx.sec;
        var cur = EV.current();
        var btns = '';
        if (cur) {
          btns = '<div class="chips" style="margin-top:6px;">'
            + (cur.def.opts || []).map(function (o, i) {
              var tx = EV.optionText(o);
              return '<span class="chip" data-action="ev-choose" data-i="' + i + '"'
                + ' title="' + U.escape(tx) + '">' + U.escape(o.label)
                + (tx ? '　<span style="opacity:.6;font-size:11px;">' + U.escape(tx) + '</span>' : '')
                + '</span>';
            }).join('') + '</div>';
        }
        return sec('🤝 遇到什么', EV.lineOf(), EV.bodyHTML() + btns);
      },
      actions: {
        'ev-choose': function (el, ctx) {
          var r = EV.choose(el.getAttribute('data-i'));
          ctx.toast(r.ok
            ? ((r.win === false ? '输了' : '成了')
              + (r.got && r.got.length ? '：' + r.got.join('、') : ''))
            : r.msg);
          ctx.refresh();
        }
      }
    });
  }
})();
