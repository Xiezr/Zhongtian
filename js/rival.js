/* ============================================================
 * rival.js — 你不是唯一在重建的人（v94.1 · 世界层最小可运行）
 * ------------------------------------------------------------
 * 缺口：整个废土上，**只有玩家会做"重建"这件事**。
 *   · 四个军阀占地盘（faction.js），但他们不建、不垦、不翻遗迹；
 *   · 村社只会自己流失（village.js），没人抢；
 *   · 遗迹只会等玩家来翻（ruin.js）。
 * 于是一个空洞的世界：所有好东西都摆在那儿，等着玩家慢慢拿。
 *
 * 这个模块放进去 2 支"也在重建"的人：
 *   · 他们**占地不占城** —— 抢村社的人、抢遗迹的东西；
 *   · 他们**会自己长大** —— 队伍人口过线就分家，最多 5 支；
 *   · 他们对玩家的唯一意义是：**你慢一步，东西就没了**。
 *
 * 与军阀的分工（必须写清楚，否则两套东西会打架）：
 *   军阀 = 领地与兵，按月推进半径，是"压力"。
 *   竞争者 = 人与物，在地图上逐格走，是"抢跑"。
 *
 * ⚠️ 刻意不做：
 *   · 不新建聚落（那是世界自己会做的事，见 growth/village），
 *     他们只**接管**已有的人与物 —— 与玩家完全对称的规则。
 *   · 不碰兵力/城市产出。他们赢了，损失落在"村社/遗迹"上；
 *     不至于因为一个最小模块就把既有平衡掀了。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var RV = GAME.rival = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.RIVAL) || {}; }
  function SP() { return (GAME.sphereOf ? GAME.sphereOf()
    : (GAME.mapSphere || GAME.sphere))   /* v98.6：`GAME.sphereOf()` 是**既有**出口（state.js：按 pid 取那颗星球的球面，
      默认当前星球 → 返回有 cells 的 GAME.sphere）。
      原来的 `GAME.mapSphere || GAME.sphere` 在玩家**还没打开地图**时是致命的：
      mapSphere 对象存在但没 build，`||` 不生效 → 拿到空球 → 村社/遗迹/势力/竞争者全空。 */; }
  function VD() { return GAME.village; }

  function monthNow() {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  }

  /* 纯哈希（吃 ci + salt）：同一颗球，起点永远一样 */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* ============================================================
   * ensure —— 开局把两支队伍放进世界
   * ------------------------------------------------------------
   * 起点必须在**主城 12 格外**：不能一开局就贴在门口，
   * 那样玩家第一眼看到的是"家门口有人抢东西"，而不是"远方有人在活"。
   * ============================================================ */
  RV.ensure = function () {
    var st = GAME.state;
    if (!st) return null;
    if (!st.rival || typeof st.rival !== 'object') st.rival = { month: -1, teams: [] };
    if (!Array.isArray(st.rival.teams)) st.rival.teams = [];
    if (!st.rival.seeded) {
      /* ⚠️ 只有**真的放到人**才算 seeded。第一版无论结果都置 true，
         于是"第一次 ensure 时星球还没建好"会把竞争者永久清零 ——
         而且因为状态被写进存档，之后每局都没有他们。 */
      var seed = seedTeams();
      if (seed.length) { st.rival.seeded = true; st.rival.teams = seed; }
    }
    return st.rival;
  };

  function seedTeams() {
    var s = SP(), out = [];
    if (!s || !s.cells) return out;
    var n = s.cells.length;
    /* ⚠️ 起点必须在**真实的主城**旁边：ensure() 可能在 currentCity 还没设好时被调用
       （tickOnce 第一帧），那样 pci 会退成 0 —— 而 0 号格不一定是你的城。 */
    var pc = null, _all = (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : [];
    for (var q0 = 0; q0 < _all.length; q0++) {
      if (GAME.isMainCity && GAME.isMainCity(_all[q0])) { pc = _all[q0]; break; }
    }
    if (!pc) pc = _all[0] || (GAME.currentCity ? GAME.currentCity() : null);
    var pci = (pc && pc.ci != null && pc.ci >= 0) ? pc.ci : -1;
    var names = D().names || ['流浪者'];
    var want = D().count || 2;
    var tries = 0;
    while (out.length < want && tries < 6000) {
      var ci = Math.floor(h(tries++, 77001) * n) % n;
      var cell = s.cells[ci];
      if (!cell || cell.type === 'lake') continue;
      if (pci >= 0) {
        var d = (s.roughDistOf ? s.roughDistOf({ ci: pci }, { ci: ci }) : 20);
        if (d < 12) continue;
      }
      var dup = false;
      for (var i = 0; i < out.length; i++) if (out[i].ci === ci) dup = true;
      if (dup) continue;
      out.push({
        id: 'r' + out.length, name: names[out.length % names.length],
        ci: ci, pop: 240, claims: 0, dest: null, moved: 0, at: monthNow()
      });
    }
    return out;
  }

  RV.arr = function () {
    var st = GAME.state;
    return (st && st.rival && st.rival.teams) || [];
  };

  RV.teamOf = function (id) {
    var a = RV.arr();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  };

  /* ============================================================
   * 目标：最近的、还有东西可拿的一格
   * ------------------------------------------------------------
   * 两类：还没被人拿走的村社（人）· 已发现但没翻的遗迹（物）。
   * **不按玩家的探明度过滤**（理由见函数内注释）。
   * ============================================================ */
  function pickTarget(t, mm) {
    var s = SP();
    if (!s || !s.cells) return null;
    var best = null, bestD = 1e9, bestKind = null;
    var d0 = D();
    var list = (VD() && VD().listAll) ? VD().listAll() : [];
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      /* ⚠️ **不要求已探明**：竞争者不是你的侦察兵，他们是本地人 ——
         "玩家还没点亮的地方他们也知道"，正是"你慢一步东西就没了"的前提。
         （第一版要求 isKnown，结果新开局他们一个目标都挑不到，六个月一步没走。） */
      var rec = (VD().peek ? VD().peek(ci) : null);
      if (rec && (rec.dead || rec.heldBy)) continue;
      var d = (s.roughDistOf ? s.roughDistOf({ ci: t.ci }, { ci: ci }) : s.distOf({ ci: t.ci }, { ci: ci }));
      if (d < bestD) { bestD = d; best = ci; bestKind = 'village'; }
    }
    var ru = ((GAME.state || {}).ruins) || {};
    for (var k in ru) {
      var rci = +k, rr = ru[k];
      if (!rr || rr.side) continue;
      var rd = (s.roughDistOf ? s.roughDistOf({ ci: t.ci }, { ci: rci }) : s.distOf({ ci: t.ci }, { ci: rci }));
      /* 遗迹给的是"东西"，优先级略低于"人" —— 同距时取村社 */
      if (rd < bestD - 0.001) { bestD = rd; best = rci; bestKind = 'ruin'; }
    }
    /* ③ v98.1：**你的城**。条件故意苛刻 —— 他们得先吃成势：
          · 人口 ≥ cityAtPop（开局那两支只会抢村子）
          · 你的城在 cityRange 格内
          · 刚被抢过的城 8 个月免疫（同一条街不会被抢两次）
       城比村社"肥"，所以同距时**优先城**（`bestD - 0.001` 的反向判断）。 */
    var pop0 = (t.pop | 0);
    if (pop0 >= (d0.cityAtPop == null ? 1200 : d0.cityAtPop)) {
      var cd8 = d0.cityCd == null ? 8 : d0.cityCd;
      (GAME.city && GAME.city.all ? (GAME.city.all() || []) : []).forEach(function (c) {
        if (!c || c.ci == null || c.ci < 0) return;
        if (c.raidCd != null && (mm - c.raidCd) < cd8) return;
        var dd = (s.roughDistOf ? s.roughDistOf({ ci: t.ci }, { ci: c.ci })
          : s.distOf({ ci: t.ci }, { ci: c.ci }));
        if (dd > (d0.cityRange == null ? 14 : d0.cityRange)) return;
        if (dd <= bestD + 0.001) { bestD = dd; best = c.ci; bestKind = 'city'; }
      });
    }
    if (best == null) return null;
    return { ci: best, kind: bestKind, dist: bestD };
  }

  /* 朝目标走一格（走不了就停：山/水不改道，最小版不做寻路） */
  function stepToward(from, to) {
    var s = SP();
    if (!s || !s.adj || from === to) return from;
    var nb = s.adj[from] || [];
    var best = from, bestD = s.distOf({ ci: from }, { ci: to });
    for (var i = 0; i < nb.length; i++) {
      var x = nb[i];
      var cell = s.cells[x];
      if (!cell || cell.type === 'lake') continue;
      var d = s.distOf({ ci: x }, { ci: to });
      if (d < bestD) { bestD = d; best = x; }
    }
    return best;
  }

  /* ============================================================
   * tick —— 每月：找目标 → 走 → 到了就占
   * ============================================================ */
  RV.tick = function (force) {
    var st = GAME.state;
    if (!st) return null;
    RV.ensure();
    var m = monthNow();
    if (!force && st.rival.month === m) return null;
    var first = (st.rival.month < 0);
    st.rival.month = m;
    if (first) return { month: m, first: true };

    var d = D();
    var out = { month: m, claimed: [], split: 0 };
    var s = SP();
    if (!s || !s.cells) return out;

    RV.arr().forEach(function (t) {
      if (!t || t.dead) return;
      /* ① 半年一次重新挑目标（不必每月算，省一次 250 格遍历） */
      if (!t.dest || !t.dest.ci || m % 2 === 0) {
        var prevKind = t.dest && t.dest.kind;
        var tg = pickTarget(t, m);
        t.dest = tg ? { ci: tg.ci, kind: tg.kind } : null;
        /* 第一次把目标定成"某座城"时，给一条能看清的预警 ——
           玩家必须在他们走到之前有机会派兵/驱赶，否则就是偷袭。 */
        if (tg && tg.kind === 'city' && prevKind !== 'city') {
          var tc = (GAME.city && GAME.city.byId) ? GAME.city.byId(tg.ci) : null;
          if (tc && GAME.log && GAME.log.war) {
            GAME.log.war('⚠ ' + t.name + '（' + U.numText(t.pop | 0, 0) + ' 人）正朝'
              + tc.name + '来 —— 大约 ' + Math.max(0, Math.round(tg.dist))
              + ' 个月后到城下。可以派兵驱赶，或者把守军补上。');
          }
        }
      }
      if (!t.dest) return;

      /* ② 走 */
      var step = 0;
      while (step < (d.movePerMonth || 1) && t.ci !== t.dest.ci) {
        var nx = stepToward(t.ci, t.dest.ci);
        if (nx === t.ci) break;                 /* 走不动 */
        t.ci = nx; t.moved = (t.moved | 0) + 1; step++;
      }

      /* ③ 到了：占 */
      var dist = s.distOf ? s.distOf({ ci: t.ci }, { ci: t.dest.ci }) : 99;   /* 到点判定用精确距离 */
      if (dist <= (d.reach == null ? 1 : d.reach)) {
        var got = claim(t, t.dest.ci, t.dest.kind, m);
        if (got) {
          out.claimed.push(got);
          t.dest = null;
        }
      }
    });

    /* ④ 分家：人多了会有人离开，自己再拉一支 */
    var teams = RV.arr();
    var cap = d.maxTeams || 5;
    for (var i = 0; i < teams.length; i++) {
      var t2 = teams[i];
      if (!t2 || t2.dead) continue;
      if ((t2.pop | 0) < (d.splitAt || 900)) continue;
      if (teams.length >= cap) break;
      var take = Math.round(t2.pop * (d.splitPct || 0.45));
      t2.pop -= take;
      teams.push({
        id: 'r' + (teams.length) + '-' + m, name: (d.names || ['流浪者'])[(teams.length) % (d.names || ['x']).length],
        ci: t2.ci, pop: take, claims: 0, dest: null, moved: 0, at: m, from: t2.id
      });
      out.split++;
      if (GAME.log && GAME.log.war) {
        GAME.log.war('👥 ' + take + ' 人离开' + t2.name + '，自己拉了一支队伍（' + teams.length + ' 支在废土上走）。');
      }
    }

    if (out.claimed.length && GAME.log && GAME.log.war) {
      out.claimed.forEach(function (x) { GAME.log.war(x.msg); });
    }
    return out;
  };

  /* ============================================================
   * v98.1 raidCity —— 他们来打你的城（世界第一次真的反击）
   * ------------------------------------------------------------
   * 不是掷骰子：**把双方摆出来比**
   *   他们：pop × cityPowerPerPop
   *   你  ：守军 + 城防（含工事、减掉墙裂）
   * 不足守备 1.15 倍 → 被挡回去，他们折人；够了 → 破城，抢库存、砍守军。
   *
   * 两条刻意的边界：
   *   · **不占城、不灭家**。抢完就走（`cityCd` 8 个月免疫）。
   *     一座城被"抢空"和"被夺走"是两种体验，后者会让玩家直接删档。
   *   · 预警在 `tick` 里给（他们刚把目标定成城的那一月），
   *     玩家有时间补守军、建工事、或者花 300 兵去驱赶 —— 不是偷袭。
   * ============================================================ */
  function raidCity(t, city, m) {
    var d = D();
    var cd8 = d.cityCd == null ? 8 : d.cityCd;
    if (city.raidCd != null && (m - city.raidCd) < cd8) return null;

    var guard = (GAME.armyTotal ? GAME.armyTotal(city) : 0);
    var def = (GAME.cityDefense ? GAME.cityDefense(city) : 0);
    var wall = guard + def;
    var mine = (t.pop | 0) * (d.cityPowerPerPop == null ? 0.55 : d.cityPowerPerPop);
    var need = wall * (d.cityNeedMul == null ? 1.15 : d.cityNeedMul);

    /* ① 打不进去：他们折人，城只掉一点守军（城防是有用的） */
    if (mine < need) {
      var died = Math.max(30, Math.round((t.pop | 0) * 0.15));
      t.pop = Math.max(0, (t.pop | 0) - died);
      if ((t.pop | 0) <= 0) t.dead = 'wall';
      city.raidCd = m;
      var lostG = Math.max(0, Math.round(guard * 0.02));
      if (lostG > 0 && city.army) {
        for (var k0 in city.army) {
          city.army[k0] = Math.max(0, (city.army[k0] | 0) - Math.round(lostG / 3));
        }
      }
      t.claims = (t.claims | 0) + 1;
      return {
        kind: 'city', ci: city.ci, repelled: true, n: died,
        msg: '🛡 ' + t.name + '来打' + city.name + '，被城防挡回去了（他们折了 '
          + U.numText(died, 0) + ' 人）。'
      };
    }

    /* ② 破城：抢库存、砍守军。抢完就走。 */
    var share = d.cityShare == null ? 0.25 : d.cityShare;
    var lossP = d.cityLoss == null ? 0.12 : d.cityLoss;
    var R = GAME.res(city), grabbed = {};
    var total = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
      var n = Math.round((R[k] || 0) * share);
      if (n <= 0) return;
      if (GAME.city && GAME.city.sub) GAME.city.sub(city, k, n);
      grabbed[k] = n; total += n;
    });
    if (city.army) {
      for (var k2 in city.army) {
        city.army[k2] = Math.max(0, Math.round((city.army[k2] | 0) * (1 - lossP)));
      }
    }
    city.raidCd = m;
    t.pop = (t.pop | 0) + Math.round((t.pop | 0) * (d.cityRaidPop == null ? 0.30 : d.cityRaidPop));
    t.claims = (t.claims | 0) + 1;
    return {
      kind: 'city', ci: city.ci, broke: true, n: total, got: grabbed,
      msg: '💥 ' + t.name + '破了' + city.name + '的墙：抢走 '
        + U.numText(total, 0) + ' 资源、打掉 ' + Math.round(lossP * 100)
        + '% 守军。他们扬长而去（这 8 个月不会再来）。'
    };
  }

  /* 占下一格：村社拿走人，遗迹拿走东西 */
  /* ⚠️ 按**格号**找城：`GAME.city.byId` 收的是城 id（'c1' 这种），
     而 `pickTarget` 存进 `dest.ci` 的是 ci —— 用 byId 查 ci 永远查不到，
     攻城分支就永远不会执行（第一版就这么写的：断言里"守军一个没掉"照出来）。 */
  function cityAtCi(ci) {
    var all = (GAME.city && GAME.city.all) ? (GAME.city.all() || []) : [];
    for (var i = 0; i < all.length; i++) if (all[i] && all[i].ci === ci) return all[i];
    return null;
  }

  function claim(t, ci, kind, m) {
    if (kind === 'city') {
      var tc = cityAtCi(ci);
      if (!tc) return null;
      return raidCity(t, tc, m);
    }
    var st = GAME.state;
    if (!st) return null;
    if (kind === 'village') {
      var rec = (VD() && VD().get) ? VD().get(ci) : null;
      if (!rec || rec.dead || rec.heldBy) return null;
      var take = Math.max(20, Math.round((rec.pop || 0) * (D().villageGain || 0.55)));
      rec.pop = Math.max(0, (rec.pop || 0) - take);
      rec.heldBy = t.id;
      if (rec.pop <= 0) rec.dead = 'rival';
      t.pop = (t.pop | 0) + take;
      t.claims = (t.claims | 0) + 1;
      var nm = (VD().at ? (VD().at(ci) || {}).name : null) || '一处村社';
      return { kind: kind, ci: ci, n: take,
        msg: '🏴 ' + t.name + '进了' + nm + '，带走了 ' + U.numText(take, 0) + ' 个人 —— 这座村子从此不听你的了。' };
    }
    if (kind === 'ruin') {
      st.ruins = st.ruins || {};
      var rr = st.ruins[ci];
      if (!rr || rr.side) return null;
      rr.side = 'rival';
      rr.at = Date.now();
      rr.got = '被' + t.name + '抢先翻走';
      t.claims = (t.claims | 0) + 1;
      var rw = (GAME.ruin && GAME.ruin.at) ? GAME.ruin.at(ci) : null;
      return { kind: kind, ci: ci,
        msg: '🏴 ' + t.name + '抢先翻了' + ((rw && rw.name) || '一处遗迹') + '，你去晚了。' };
    }
    return null;
  }

  /* ============================================================
   * drive —— 赶走一支队伍
   * ------------------------------------------------------------
   * 这是玩家唯一能对他们做的事（最小版）：
   *   · 得带够兵（driveCost），得在城市 8 格内；
   *   · 赢了：他们散了，人回流到附近村社（世界没变好，只是不在你门口）；
   *   · 输了：折兵，他们继续走。
   * ⚠️ 不走 battle 引擎：他们的"战力"是人口，不是城池。
   *    真接战斗引擎要改 simulate 的入口，那是下一版的事。
   * ============================================================ */
  RV.drive = function (tid, cityId) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    RV.ensure();
    var t = RV.teamOf(tid);
    if (!t) return { ok: false, msg: '没有这支队伍' };
    var city = cityId ? (GAME.city && GAME.city.byId ? GAME.city.byId(cityId) : null)
      : (GAME.currentCity ? GAME.currentCity() : null);
    if (!city) return { ok: false, msg: '没有选城' };
    var s = SP();
    if (s && city.ci != null && t.ci != null) {
      var d0 = s.distOf({ ci: city.ci }, { ci: t.ci });
      if (d0 > 8) return { ok: false, msg: '他们离得太远（' + Math.round(d0) + ' 格，要 8 格内才好动手）' };
    }
    var need = D().driveCost || 300;
    var have = GAME.city.armyTotal(city);
    if (have < need) return { ok: false, msg: '至少带 ' + need + ' 兵出去（城里只有 ' + have + '）' };

    var theirPow = Math.max(1, (t.pop | 0) * 0.8);
    var p = (D().driveWinAt || 0.55) * Math.min(2, have / theirPow);
    p = Math.max(0.08, Math.min(0.92, p));
    var roll = GAME.invasionRoll ? GAME.invasionRoll('drive|' + t.id + '|' + monthNow()) : Math.random();

    if (roll < p) {
      /* 赢了：队伍散掉，人回到附近的村社（不是消失，是"不跟你走了"） */
      var back = Math.round((t.pop | 0) * 0.6);
      var list = (VD() && VD().listAll) ? VD().listAll() : [];
      var bestCi = null, bestD = 1e9;
      for (var i = 0; i < list.length; i++) {
        var rec = VD().peek ? VD().peek(list[i]) : null;
        if (rec && rec.dead) continue;
        var dd = s ? s.distOf({ ci: t.ci }, { ci: list[i] }) : 99;
        if (dd < bestD) { bestD = dd; bestCi = list[i]; }
      }
      if (bestCi != null && VD().get) {
        var r2 = VD().get(bestCi);
        if (r2 && !r2.dead) { r2.pop = (r2.pop | 0) + back; if (r2.heldBy === t.id) delete r2.heldBy; }
      }
      t.pop = Math.max(0, (t.pop | 0) - back);
      t.dead = true; t.deadAt = monthNow();
      armySub(city, Math.round(need * 0.06));      /* 打散他们也会伤几个人 */
      if (GAME.log && GAME.log.war) {
        GAME.log.war('🛡 ' + city.name + '的兵赶散了' + t.name + '，' + U.numText(back, 0) + ' 个人回头去了附近的村子。');
      }
      return { ok: true, win: true, msg: '赶散了' + t.name + '。他们不是被消灭，只是不再往前走了。' };
    }

    var lose = Math.max(1, Math.round(have * (D().driveLoseTroop || 0.18)));
    armySub(city, lose);
    t.pop = (t.pop | 0) + Math.round(lose * 0.15);   /* 他们也会收人 */
    if (GAME.log && GAME.log.war) {
      GAME.log.war('💀 ' + city.name + '的兵没拦住' + t.name + '，折了 ' + U.numText(lose, 0) + ' 人。');
    }
    return { ok: true, win: false, msg: '打输了，折了 ' + U.numText(lose, 0) + ' 兵。他们还在往前走。' };
  };

  /* 按比例从城里扣总兵（逐兵种分摊；走 armySub 的唯一出口） */
  function armySub(city, n) {
    if (!city || n <= 0) return 0;
    var total = GAME.city.armyTotal(city);
    if (total <= 0) return 0;
    var cut = Math.min(n, total), done = 0;
    var a = city.army || {};
    for (var k in a) {
      var v = Math.floor(a[k] || 0);
      if (v <= 0) continue;
      var part = Math.floor(cut * v / total);
      if (part <= 0) continue;
      var o = {}; o[k] = part;
      if (GAME.city.armySub) GAME.city.armySub(city, o);
      done += part;
    }
    return done;
  }

  /* ---------- 只读出口（界面用） ---------- */
  RV.alive = function () {
    return RV.arr().filter(function (t) { return t && !t.dead; });
  };

  RV.summaryOf = function () {
    var live = RV.alive();
    var pop = 0, claims = 0;
    live.forEach(function (t) { pop += (t.pop | 0); claims += (t.claims | 0); });
    return { n: live.length, pop: pop, claims: claims };
  };

  RV.lineOf = function () {
    var a = RV.summaryOf();
    if (!a.n) return '';
    return '🏴 废土上还有 ' + a.n + ' 支人在重建（约 ' + U.numText(a.pop, 0) + ' 人），已抢走 ' + a.claims + ' 处';
  };
})();
