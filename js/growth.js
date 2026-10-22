/* ============================================================
 * growth.js — 城会自己长，也会自己朽
 * ------------------------------------------------------------
 * 老板 2026-10-22：「你做的是一整个废土……从大处着眼」。
 *
 * 这个项目里所有的城都是**死的容器**：
 *   · 48 个格子等你规划，你不建就永远空着；
 *   · 人口只会在上限前停住，不会自己找地方住；
 *   · 建筑造好就永远在那，不会塌。
 * 于是"建城"这件事只有"我摆什么"，没有"它自己变成什么样"。
 * 但真实的废土不是这样 —— **人会在你没想到的地方住下来，
 * 没人管的房子会塌。**
 *
 * 这个模块只做两件事，一长一朽：
 *   A. **棚户**：人口顶到居所上限，多出来的人不会凭空消失 ——
 *      他们在城墙外自己搭棚子住。产出不多，但会带来拥挤、火、疫。
 *   B. **荒废**：人口长期远低于居所容量的城，建筑会一级一级掉回去。
 *
 * ⚠️ 刻意不做的事：
 *   · **不占那 48 格**。玩家的规划区是玩家的地方，居民不能偷偷占掉一格 ——
 *     那是"抢你的操作"，不是"世界在长"。
 *   · 不给棚户正收益。它是**症状**，不是新资源池；想解决就去建居所。
 *   · 荒废只掉建筑等级，**不毁城、不删建筑**。下限 1 级，永远能修回来。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var GR = GAME.growth = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.GROWTH) || {}; }

  /* 月份（与 village / faction 同一把尺） */
  GR.monthNow = function () {
    var C = (GAME.DATA && GAME.DATA.CALENDAR) || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  };

  /* 棚户人口（只读出口，界面与产出都走它） */
  GR.shantyOf = function (city) {
    return (city && (city.shanty | 0)) || 0;
  };

  /* 棚户上限：居所容量的三成 —— 再多就不是"棚户"，是无政府 */
  GR.shantyCapOf = function (city) {
    var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
    return Math.max(0, Math.round(cap * (D().shantyCap == null ? 0.3 : D().shantyCap)));
  };

  /* ============================================================
   * tick —— 每月一次
   * ------------------------------------------------------------
   * 为什么按月而不是按秒：棚户是一代人的事，不是一次点击的事。
   * 按秒结算会让它变成"数值在跳"，按月才会让玩家某天抬头发现
   * "城墙外怎么多了一片棚子"。
   * ============================================================ */
  GR.tick = function (force) {
    var st = GAME.state;
    if (!st) return { spawned: 0, decayed: 0, moved: 0 };
    var m = GR.monthNow();
    var has = (st.growthMonth != null);
    if (!force && has && st.growthMonth === m) return { spawned: 0, decayed: 0, moved: 0 };
    if (!has) { st.growthMonth = m; return { spawned: 0, decayed: 0, first: true }; }
    st.growthMonth = m;

    var d = D();
    var spawned = 0, decayed = 0, burned = 0, moved = 0;

    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      var cap = GAME.effPopCapOf ? GAME.effPopCapOf(c) : 0;
      if (cap <= 0) return;
      /* ⚠️ 人口在 `GAME.res(c).pop`，**不在 c.pop**。
         state.js 的注释专门警告过这件事（"直接读 s.res.pop 只代表当前城"），
         但 camp / ruin / convoy / 本模块第一版全都写了 `city.pop` ——
         那个字段根本不存在，于是"加人口"全加到了空气里，而断言也跟着
         用同一个错字段，所以一路全绿。e2e 用 `c211.res.pop` 才把它照出来。 */
      var pop = GAME.res(c).pop || 0;
      var ratio = cap > 0 ? pop / cap : 0;

      /* ---------- A. 溢出成棚户 ---------- */
      var at = d.overflowAt == null ? 0.92 : d.overflowAt;
      if (ratio >= at) {
        var capSh = GR.shantyCapOf(c);
        var cur = GR.shantyOf(c);
        if (cur < capSh) {
          /* 每月溢出：超出的那部分人的一小截。不把人从城里搬走 ——
             棚户是"城里住不下的人"，城里的人口仍然算他们的家底。 */
          var over = Math.max(1, Math.round((pop - cap * at) * (d.overflowRate == null ? 0.25 : d.overflowRate)));
          c.shanty = Math.min(capSh, cur + over);
          if (c.shanty > cur) { spawned++; c.shantyAt = m; }
        }
      } else if (ratio < (d.absorbAt == null ? 0.75 : d.absorbAt)) {
        /* 城里住得下了，棚户会慢慢搬回去（一成一成地走，不是一夜消失） */
        var n0 = GR.shantyOf(c);
        if (n0 > 0) {
          c.shanty = Math.max(0, Math.round(n0 * 0.8));
          if (c.shanty === 0) c.shantyAt = 0;
        }
      }

      /* ---------- B. 棚户的代价 ---------- */
      var sh = GR.shantyOf(c);
      if (sh > 0) {
        /* ① 寒潮与疫病：棚户先死
           ⚠️ **刻意不碰民心**（原设计是"拥挤扣全局民心"，已撤）。
           原因不是太狠，是**污染**：民心是全局量（`heartsOf` 读 `s.heartsComfort`，
           唯一写入口 `heartsComfortAdd`），棚户一扣 −2，会把和它毫无关系的
           器械制造、征兵的民心门槛一起挤灰。e2e 就是这么抓到的
           （§229c-e② 器械卡变灰）。
           一个系统不该靠改全局状态去提示自己的存在。
           所以代价改成具体的、只落在棚户自己身上的：**寒潮与疫病时，棚户死得比城里多**。 */
        if (GAME.coldActiveOf && GAME.coldActiveOf()) {
          var coldLoss = Math.max(1, Math.round(sh * (d.coldLoss == null ? 0.12 : d.coldLoss)));
          c.shanty = Math.max(0, sh - coldLoss);
          if (GAME.log && GAME.log.war) {
            GAME.log.war('❄ ' + c.name + ' 城外棚户熬不过这场寒潮，' + U.numText(coldLoss, 0) + ' 个人没撑过来。');
          }
        }
        /* ② 火：棚户区是连片的木板和油布，一点就一片。
             按人数比例削减，**不烧到城里的人**（棚户是"外面的"）。 */
        var fc = (d.firePerMonth == null ? 0.04 : d.firePerMonth) * Math.min(1, sh / Math.max(1, cap) * 2);
        if (GAME.invasionRoll ? GAME.invasionRoll('shantyfire|' + c.id + '|' + m) < fc : false) {
          var lost = Math.max(1, Math.round(sh * (d.fireLoss == null ? 0.3 : d.fireLoss)));
          c.shanty = Math.max(0, sh - lost);
          burned++;
          if (GAME.log && GAME.log.war) {
            GAME.log.war('🔥 ' + c.name + ' 城外的棚户区起火，烧掉了 ' + U.numText(lost, 0) + ' 间棚子。');
          }
        }
      }

      /* ---------- B2. 有人不愿意再挤 → 走远一点，自己搭个新村 ----------
         v93.5：这是"世界自己开垦"的**唯一来源**（village.spawnNear 的另一头）。
         为什么接在棚户上而不是凭空刷新：凭空长出来的村子没有原因；
         从这里走的人有原因 —— 城里挤不下，他们不想再挤。
         人数不够（<60）就走不了：走不了多远的人只会死在路上。 */
      if (sh > 0 && sh >= capSh * 0.75 && GAME.village && GAME.village.spawnNear) {
        var leaveP = d.leaveChance == null ? 0.35 : d.leaveChance;
        var roll2 = GAME.invasionRoll ? GAME.invasionRoll('leave|' + c.id + '|' + m) : 1;
        if (roll2 < leaveP) {
          var movers = Math.max(20, Math.round(sh * (d.leavePct == null ? 0.35 : d.leavePct)));
          var nv = GAME.village.spawnNear(c.ci, { pop: movers, salt: m });
          if (nv) {
            c.shanty = Math.max(0, sh - movers);
            c.shantyAt = 0;
            moved++;
            if (GAME.log && GAME.log.war) {
              GAME.log.war('🏘 ' + U.numText(movers, 0) + ' 人离开' + c.name
                + '城外的棚户区，在 ' + nv.dist + ' 格外的' + nv.name + '自己安了家。');
            }
          }
        }
      }

      /* ---------- C. 荒废：没人住的房子会塌 ---------- */
      /* ⚠️ **连续三个月**才塌，不是一低就塌。
         起因：第一版当月就掉级，e2e 里一个刚造好的作坊因为人口还没涨上来
         直接掉了一级，器械面板随之打不开（§229c-e② 器械卡消失）。
         空城要空一段时间才叫"没人住" —— 一个月人口没跟上只是还在长。 */
      var deadAt = d.abandonAt == null ? 0.2 : d.abandonAt;
      if (ratio < deadAt) {
        c.abandonMonths = (c.abandonMonths | 0) + 1;
      } else {
        c.abandonMonths = 0;
      }
      if (ratio < deadAt && (c.abandonMonths | 0) >= (d.abandonNeedMonths == null ? 3 : d.abandonNeedMonths)) {
        /* 连 20% 都住不满 —— 这座城已经名存实亡。
           每月掉一座建筑的 1 级（只掉 1 座，给玩家足够时间回来管）。 */
        var cand = (c.cells || []).filter(function (cc) {
          return cc && cc.build && cc.build.id && cc.build.lvl > 1;
        });
        if (c.wall && c.wall.build && c.wall.build.lvl > 1) cand.push(c.wall);
        if (cand.length) {
          /* 确定性挑一座（同月同城永远同一座，便于复盘），不从最低的开始掉 */
          var idx = Math.floor((GAME.invasionRoll ? GAME.invasionRoll('decay|' + c.id + '|' + m) : 0.5) * cand.length) % cand.length;
          var victim = cand[idx];
          victim.build.lvl -= 1;
          decayed++;
          if (GAME.log && GAME.log.war) {
            GAME.log.war('🏚 ' + c.name + ' 没人住：' + ((GAME.DATA.BUILDINGS[victim.build.id] || {}).name || victim.build.id)
              + ' 塌了一部分（Lv' + (victim.build.lvl + 1) + ' → Lv' + victim.build.lvl + '）。');
          }
        }
      }
    });

    return { spawned: spawned, decayed: decayed, burned: burned, moved: moved, month: m };
  };

  /* ============================================================
   * 棚户产出 —— 贫民自己种的一点粮
   * ------------------------------------------------------------
   * 不走 `prodFactors`：那不是"这座城的产量"，是"住在城外的人
   * 自己活下来的一点东西"。混进产量表会让玩家以为棚户是收益。
   * ============================================================ */
  GR.shantyYieldOf = function (city) {
    var sh = GR.shantyOf(city);
    if (sh <= 0) return 0;
    return sh * (D().yieldPerPop == null ? 0.02 : D().yieldPerPop);
  };

  /* 结算（与产出同一个 tick 节奏；直接进城的资源，不额外记账） */
  GR.settleYield = function (secGame) {
    var st = GAME.state;
    if (!st) return 0;
    var got = 0;
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      var sh = GR.shantyOf(c);
      if (sh <= 0) return;
      var add = GR.shantyYieldOf(c) * Math.max(0, secGame || 0) / 3600;   /* 每游戏小时 */
      if (add <= 0) return;
      /* ⚠️ **资源写入必须走 GAME.city.add**（cities.js 的唯一加减入口）——
         直接 `c.res.grain += x` 会绕过仓容，让存量冲过上限
         （e2e §v89.158① 抓到：got 10856797 > cap 10733333）。
         和"人口必须走 res.pop"是同一类事：这个项目把每样东西都收口成了一个出口，
         绕过去不会立刻报错，只会在很久以后以别的样子炸出来。
         ⚠️ add() 内部 floor 成整数，而棚户每小时每人才 0.02 粮 ——
         直接调会被抹成 0，所以先在自己这里攒零头，够一整再入账。 */
      c._shAcc = (c._shAcc || 0) + add;
      var whole = Math.floor(c._shAcc);
      if (whole > 0) {
        c._shAcc -= whole;
        if (GAME.city && GAME.city.add) GAME.city.add(c, 'grain', whole, true);
        else { c.res = c.res || {}; c.res.grain = (c.res.grain || 0) + whole; }
        got += whole;
      }
    });
    return got;
  };

  /* ============================================================
   * clear —— 清理棚户（玩家的选择）
   * ------------------------------------------------------------
   * 「把城墙外那些棚子推平」。这是这个模块里唯一的一个**抉择**：
   *   · 民心立刻回来一点（城里的人觉得清爽了）；
   *   · 但那些人是被赶走的 —— 名声记一笔（cruelty）。
   *   · 棚户人数清零，下一轮人口满上来还会长出来（问题没解决）。
   * 正解永远是建居所；清理只是把症状按住一会儿。
   * ============================================================ */
  GR.clear = function (city) {
    var st = GAME.state;
    if (!st || !city) return { ok: false, msg: '没有这座城' };
    var sh = GR.shantyOf(city);
    if (sh <= 0) return { ok: false, msg: '城外没有棚户' };
    city.shanty = 0;
    city.shantyAt = 0;
    /* 城里的人觉得清爽了 —— 一点民心（正向偏移，走既有出口）。
       **不还账**：已经没有"欠账"这回事了（见上面不碰民心的说明）。 */
    if (GAME.heartsComfortAdd) GAME.heartsComfortAdd(D().clearHearts == null ? 2 : D().clearHearts);
    if (GAME.renown) GAME.renown.add('cruelty', (GAME.renown.W && GAME.renown.W.clearShanty) || 5);
    return { ok: true, n: sh,
      msg: '推平了城外的棚户，' + U.numText(sh, 0) + ' 个人被赶走。城里的民心回来了点 —— 他们会记得这事。' };
  };

  /* 一行摘要（城面板用） */
  GR.lineOf = function (city) {
    var sh = GR.shantyOf(city);
    if (sh <= 0) return '';
    var cap = GR.shantyCapOf(city);
    return '🏚 城外棚户 ' + U.numText(sh, 0) + ' 人（上限 ' + U.numText(cap, 0) + '）· 拥挤让民心往下掉';
  };
})();
