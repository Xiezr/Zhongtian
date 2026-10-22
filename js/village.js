/* ============================================================
 * village.js — 村社：**废土上还有别人在活**
 * ------------------------------------------------------------
 * 老板 2026-10-22：「你做的是一整个废土，而不是这种小小的这个什么随机啊……
 *   从大处着眼。」
 *
 * 翻了一遍地图上的东西：
 *   我的城 · NPC 城（敌人）· 野地（怪）· 幸存者营地（一次性资源点）
 *   · 旧世界遗迹（可翻的箱子）· 四方势力（军阀）
 * **没有一个"不打算杀你的人"。**
 *
 * 整个废土里"还有谁活着"这件事，居然一个字都没写。而这恰恰是废土题材的
 * 全部重量所在 —— 不是怪物多凶，是**文明还剩多少**。
 *
 * ⚠️ 与「营地」的区别（不能做成第二个营地）：
 *   · 营地是一次性抉择（招人 or 抢物资），处理完就没了；
 *   · 村社是**长期关系**：它会因为你给粮而记住你，会因为你抢它而恨你，
 *     会因战乱/寒潮/军阀推进而**人口流失，最后荒废**。
 *   营地问"这一次你要什么"，村社问"你打算当什么人"。
 *
 * ⚠️ 不做的事：
 *   · 不让村社产兵/产资源税 —— 它不是你的人口池，是**别人的家**。
 *     能从它身上拿的只有"人"（征召）和"关系"（保护→情报/物资回礼）。
 *   · 不做"必救"道德绑架 —— 你可以一路抢过去，代价是名声（见 renown.js）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var V = GAME.village = {};
  var U = GAME.utils;

  var _list = null;
  var _listSeed = -1;

  function SP() { return GAME.mapSphere || GAME.sphere; }
  function D() { return (GAME.DATA && GAME.DATA.VILLAGE) || {}; }
  function R() { return GAME.renown; }

  /* 确定性哈希（与 camp 同一套整数混洗；**不带日盐** —— 村社是固定地标，
     带盐会让"列表里有、点开说没有"） */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* 村子名：前缀 + 后缀。哈希取，同格永远同名。 */
  function nameOf(ci, sd) {
    var d = D();
    var P = d.pre || ['白榆'], S = d.suf || ['村'];
    var i = Math.floor(h(ci, sd + 9101) * P.length) % P.length;
    var j = Math.floor(h(ci, sd + 9102) * S.length) % S.length;
    return P[i] + S[j];
  }

  /* 该格是不是村社 / 是哪一档 */
  V.at = function (ci) {
    var s = SP();
    if (!s || !s.cells) return null;
    var cell = s.cells[ci];
    if (!cell) return null;
    /* ⚠️ v93.4 修正：**海洋的 type 是 'lake'**（sphere.js cellType：
       原文 `if (e < 0) return 'lake';` 后面跟着的注释写的是「海 → 湖泊」）。
       这里原来写的是 'sea' / 'ocean' —— 那两个值**整个项目都不存在**，
       于是"海里不生成"从来没有生效过（营地 v92.4 起就错了，村社照抄）。
       表现为水面上有村子/营地/遗迹。 */
    if (cell.type === 'lake') return null;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (h(ci, sd + 9100) >= (D().chance || 0.006)) return null;
    var tiers = D().tiers || [];
    if (!tiers.length) return null;
    var t = tiers[Math.min(tiers.length - 1, Math.floor(h(ci, sd + 9103) * tiers.length))];
    return { ci: ci, tier: t.id, tierName: t.name, name: nameOf(ci, sd), pop0: t.pop };
  };

  V.list = function () {
    var s = SP();
    if (!s || !s.cells) return [];
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (_list && _listSeed === sd) return _list;
    var out = [], n = s.cells.length;
    for (var ci = 0; ci < n; ci++) {
      var cell = s.cells[ci];
      if (!cell) continue;
      if (cell.type === 'lake') continue;
      if (h(ci, sd + 9100) < (D().chance || 0.006)) out.push(ci);
    }
    _list = out; _listSeed = sd;
    return out;
  };

  /* ---------- 运行时状态 ---------- */
  V.all = function () {
    var s = GAME.state;
    if (!s) return {};
    if (!s.villages) s.villages = {};
    return s.villages;
  };

  /* 取（没有就按哈希建）—— 这是唯一出口，渲染与结算都走它 */
  V.get = function (ci) {
    var w = V.at(ci);
    if (!w) return null;
    var a = V.all();
    var rec = a[ci];
    if (!rec) {
      rec = a[ci] = { pop: w.pop0, mood: 50, guardAt: 0, dead: null, at: 0 };
    }
    return rec;
  };

  /* 只读：有记录就返回，没有就 null（**不建档**）。
     渲染每帧都会问一次，用 V.get 会在玩家还没到过那里时就写进存档。 */
  V.peek = function (ci) {
    var a = (GAME.state && GAME.state.villages) || {};
    return a[ci] || null;
  };

  /* 已探明的村社才算"知道"（与营地同一口径：没探明不画不显示） */
  V.isKnown = function (ci) {
    if (!GAME.fog) return true;
    return GAME.fog.get(ci) > 0;
  };

  /* ============================================================
   * 汇总：这个世界还剩多少文明
   * ------------------------------------------------------------
   * 这是本模块存在的**唯一理由**。别的都是过程，
   * 这个数是玩家该看见的答案：还有几处人家、多少人。
   * ============================================================ */
  V.statsOf = function () {
    var list = V.list();
    var known = 0, alive = 0, dead = 0, pop = 0;
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (!V.isKnown(ci)) continue;
      known++;
      var rec = V.get(ci);
      if (!rec) continue;
      if (rec.dead) dead++;
      else { alive++; pop += Math.max(0, Math.round(rec.pop)); }
    }
    return { known: known, alive: alive, dead: dead, pop: pop };
  };

  /* 最近的我方城（征召的人往哪送） */
  V.cityNearOf = function (ci) {
    var st = GAME.state;
    if (!st) return null;
    var s = SP();
    if (!s || !s.distOf) return GAME.currentCity ? GAME.currentCity() : null;
    var best = null, bd = 1e9;
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      var d = s.distOf({ ci: c.ci }, { ci: ci });
      if (d < bd) { bd = d; best = c; }
    });
    return best || (GAME.currentCity ? GAME.currentCity() : null);
  };

  /* ============================================================
   * act —— 三种对待别人的方式
   * ------------------------------------------------------------
   *   call  征召：拿走三成人，名声不算恶但也不算善
   *   guard 保护：给它粮，它记住你（长期）；名声涨
   *   raid  抢：一次性拿物资，名声大跌，村社可能整村迁走
   *
   * ⚠️ 三者**都不可撤销**（这是这个模块唯一的硬规则）：
   *    征过的人回不来，抢过的信任回不来，给出去的粮要不回。
   * ============================================================ */
  V.act = function (ci, mode) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    var w = V.at(ci);
    if (!w) return { ok: false, msg: '这里没有村社' };
    if (!V.isKnown(ci)) return { ok: false, msg: '你还不知道这里有人住' };
    var rec = V.get(ci);
    if (!rec) return { ok: false, msg: '这里没有村社' };
    if (rec.dead) {
      return { ok: false, msg: rec.dead === 'fled' ? (w.name + '已经没人了 —— 他们走了') : (w.name + '已经空了') };
    }
    var d = D();
    var city = V.cityNearOf(ci);

    /* ---------- 征召 ---------- */
    if (mode === 'call') {
      if (!city) return { ok: false, msg: '附近没有己方城市' };
      if (rec.mood <= 20) return { ok: false, msg: w.name + '的人不信你 —— 他们关上了门' };
      var rate = d.callRate == null ? 0.3 : d.callRate;
      var mul = (R() ? R().willFollow() : 1)
        * ((GAME.convoy && GAME.convoy.toolMul) ? GAME.convoy.toolMul() : 1);
      var want = Math.max(1, Math.round(rec.pop * rate * mul));
      var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
      var before = city.pop || 0;
      city.pop = Math.min(cap || (before + want), before + want);
      var got = Math.round(city.pop - before);
      rec.pop = Math.max(0, rec.pop - want);
      rec.mood = Math.max(0, rec.mood - 12);
      rec.at = Date.now();
      if (R()) R().add('cruelty', R().W.callVillage);
      if (rec.pop < 1) rec.dead = 'fled';
      return { ok: true, n: got, cityId: city.id,
        msg: '从' + w.name + '带走 ' + got + ' 人（' + city.name + '）'
          + '　· 他们没拦，但也没送' };
    }

    /* ---------- 保护 ---------- */
    if (mode === 'guard') {
      if (rec.guardAt > 0) return { ok: false, msg: '你已经在护着' + w.name + '了' };
      var months = d.guardMonths == null ? 3 : d.guardMonths;
      var per = Math.max(1, Math.round(rec.pop * (d.guardGrainPerPop == null ? 2 : d.guardGrainPerPop)));
      var cost = per * months;
      var co = GAME.currentCity ? GAME.currentCity() : city;
      if (!co) return { ok: false, msg: '没有可支付的城市' };
      co.res = co.res || {};
      if ((co.res.grain || 0) < cost) {
        return { ok: false, msg: '粮不够：护' + w.name + ' ' + months + ' 个月要 '
          + U.numText(cost, 0) + ' 粮（现有 ' + U.numText(co.res.grain || 0, 0) + '）' };
      }
      co.res.grain -= cost;
      rec.guardAt = V.monthNow() + months;
      rec.mood = Math.min(100, rec.mood + 25);
      rec.at = Date.now();
      if (R()) R().add('mercy', R().W.guardVillage);
      return { ok: true, cost: cost, months: months,
        msg: '给' + w.name + '送去 ' + U.numText(cost, 0) + ' 粮，护它 ' + months + ' 个月'
          + '　· 他们会记住这件事' };
    }

    /* ---------- 抢 ---------- */
    if (mode === 'raid') {
      var co2 = GAME.currentCity ? GAME.currentCity() : city;
      if (!co2) return { ok: false, msg: '没有可存放物资的城市' };
      var loot = Math.max(10, Math.round(rec.pop * (d.raidLootPerPop == null ? 3 : d.raidLootPerPop)));
      var keys = ['grain', 'wood', 'stone', 'iron'];
      var each = Math.max(1, Math.round(loot / keys.length));
      co2.res = co2.res || {};
      keys.forEach(function (k) { co2.res[k] = (co2.res[k] || 0) + each; });
      var loss = Math.max(1, Math.round(rec.pop * 0.2));
      rec.pop = Math.max(0, rec.pop - loss);
      rec.mood = 0;
      rec.guardAt = 0;
      rec.at = Date.now();
      if (R()) R().add('cruelty', R().W.raidVillage);
      var fled = false;
      if (rec.pop < 1 || (d.fleeOnRaid && rec.mood <= 0)) {
        /* 被抢过的村子待不住 —— 整个迁走，地图上留下一座空村 */
        rec.dead = 'fled';
        fled = true;
      }
      return { ok: true, loot: each, fled: fled,
        msg: '抢了' + w.name + '：粮木石铁各 +' + U.numText(each, 0)
          + (fled ? '　· 第二天，村子空了。他们连夜走了。' : '　· 他们记住了你的旗子') };
    }

    return { ok: false, msg: '未知的方式' };
  };

  /* ---------- 月推进 ---------- */
  V.monthNow = function () {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  };

  /* ============================================================
   * tick —— 每月一次：**世界自己在流失**
   * ------------------------------------------------------------
   * 这是村社与营地最本质的差别：营地是静止的地标，村社**会死**。
   *   · 寒潮      −1.5%/月（粮不够，人走）
   *   · 势力压境  −2.0%/月（军阀抢粮抓人）
   *   · 你在保护  +0.5%/月（你给的粮）
   *   · 名声      ±（屠夫治下的人跑，仁名之下有人来投）
   *   · 自然繁衍  +0.2%/月
   * 玩家什么都不做，这个世界会**越来越少人**。
   * 这不是惩罚，是"重建"这件事之所以有意义的原因。
   * ============================================================ */
  V.tick = function (force) {
    var st = GAME.state;
    if (!st) return { changed: 0 };
    var m = V.monthNow();
    /* 判"有没有初始化过"必须用 == null 比较：月份 0 本身是合法值（开局就是第 0 个月），
       把它当成"没开始"会让整个第一个月永不推演（§306⑧ 抓到的就是这个）。 */
    var has = (st.villageMonth != null);
    if (!force && has && st.villageMonth === m) return { changed: 0, month: m };
    if (!has) { st.villageMonth = m; return { changed: 0, month: m, first: true }; }
    st.villageMonth = m;

    var d = D();
    var cold = !!(GAME.coldActiveOf && GAME.coldActiveOf());
    var list = V.list();
    var changed = 0, died = 0;

    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (!V.isKnown(ci)) continue;             /* 不知道的地方不推演（也不该显示变化） */
      var rec = V.get(ci);
      if (!rec || rec.dead) continue;

      /* ⚠️ 全部用 `+=`：DATA.VILLAGE 里的 coldPerMonth / factionPerMonth
         **本身就是负数**（语义是"每月 −1.5%"，写表的人一眼看得出是减）。
         这里若再写 `-=`，两个负号会抵成一个正数 —— 寒潮里人口反而涨
         （§306⑧ 抓到的就是这个：200 人寒潮一个月变成 203）。 */
      var rate = (d.growPerMonth == null ? 0.002 : d.growPerMonth);
      /* v93.3：医疗档案 → 寒潮里死的人少一半（"下次瘟疫不死那么多人"）。
         这是那趟拓荒唯一的意义，所以必须真的落到 tick 上。 */
      if (cold) rate += (d.coldPerMonth == null ? -0.015 : d.coldPerMonth)
        * ((GAME.convoy && GAME.convoy.medMul) ? GAME.convoy.medMul() : 1);
      if (GAME.faction && GAME.faction.controlOf && GAME.faction.controlOf(ci)) {
        rate += (d.factionPerMonth == null ? -0.02 : d.factionPerMonth);
      }
      if (rec.guardAt > 0) {
        if (rec.guardAt > m) rate += (d.guardPerMonth == null ? 0.005 : d.guardPerMonth);
        else rec.guardAt = 0;                   /* 护期结束，无声地结束（不弹窗） */
      }
      if (R()) rate += R().driftPerMonth();

      var before = rec.pop;
      rec.pop = rec.pop * (1 + rate);
      if (rec.pop < 1) {
        rec.pop = 0;
        rec.dead = 'died';
        died++;
      } else if (Math.abs(rec.pop - before) >= 0.5) {
        changed++;
      }
    }
    return { changed: changed, died: died, month: m, cold: cold };
  };

  /* 一行摘要（面板/地块信息条用） */
  V.lineOf = function (ci) {
    var w = V.at(ci);
    if (!w) return '';
    if (!V.isKnown(ci)) return '（未探明）';
    var rec = V.get(ci);
    if (!rec) return w.name;
    if (rec.dead === 'fled') return w.name + ' · 空村（他们走了）';
    if (rec.dead) return w.name + ' · 荒废（没人了）';
    var mood = rec.mood >= 60 ? '亲你' : rec.mood >= 30 ? '中立' : '戒备';
    return w.name + ' · ' + U.numText(Math.round(rec.pop), 0) + ' 人 · ' + mood
      + (rec.guardAt > 0 ? ' · 🛡 你护着' : '');
  };

  /* 存档：state.villages 跟着 state 走 */
})();
