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
   * v123：**四档** —— 按等级换地方，不是同一个按钮按 15 次
   * ============================================================ */
  P.tiers = function () { return D().tiers || []; };

  /* 当前该去哪一档（取等级够得着的最高一档） */
  P.tier = function (lv) {
    var L = P.tiers();
    if (!L.length) return null;
    var n = (lv == null) ? P.lv() : lv;
    var cur = L[0];
    for (var i = 0; i < L.length; i++) if (n >= L[i].lv) cur = L[i];
    return cur;
  };
  /* 下一档（够不着就是 null，面板用它显示"再升 N 级能去"） */
  P.nextTier = function (lv) {
    var L = P.tiers();
    var n = (lv == null) ? P.lv() : lv;
    for (var i = 0; i < L.length; i++) if (n < L[i].lv) return L[i];
    return null;
  };

  /* ============================================================
   * 三、附近能做的事
   * ------------------------------------------------------------
   * ⚠️ v125b（审核 P0-1）：**不许再按抽样逐格算距离**。
   *   原实现是「随机抽 samples(4000) 个格 → 每格 sp.distOf()（一次全图 BFS）」，
   *   在 40,962 格的球面上就是 **3712 次 BFS / 2.4 秒**，而前传是新玩家的第一屏——
   *   实测一次「清剿」点击同步阻塞 7.2 秒。
   *
   *   现在：`SP.hopsWithin(fromCi, rad)`（sphere.js:477）**一次 BFS** 拿到半径内全部格，
   *   再逐格问"这里有没有荒野事"，只有命中的格才去算精确距离（≤ lim×4 次）。
   *   输出集与排序规则不变（候选顺序变了，但排序只看 rank/dist）。
   *
   *   保留 `hopsWithin` 缺失时的抽样兜底：球面桩 / 老存档 / 探针里可能没有该出口。
   * ============================================================ */
  P.spots = function (radius) {
    var s = st0(), sp = SP();
    if (!s || !sp || !sp.cells) return [];
    if (!GAME.jianghuActsAt) return [];
    var c = GAME.currentCity ? GAME.currentCity() : null;
    var fromCi = (c && c.ci != null) ? c.ci : 0;
    var d = D(), rad = radius || d.reach || 6, n = sp.cells.length;
    var lim = d.listMax || 5;
    var seen = {}, out = [];
    var cap = lim * 4;
    var consider = function (ci) {
      if (out.length >= cap) return;
      if (ci == null || ci < 0 || ci >= n) return;
      if (seen[ci]) return;
      seen[ci] = 1;
      if (!sp.cells[ci]) return;
      if (GAME.map && GAME.map.ownCityAt && GAME.map.ownCityAt(ci)) return;
      /* 先问"有没有事"，再算距离 —— 距离是 BFS，不能对没东西的格白跑 */
      var acts = GAME.jianghuActsAt(ci);
      if (!acts.length) return;
      var dist = sp.distOf ? sp.distOf({ ci: fromCi }, { ci: ci }) : 99;
      if (dist < 1 || dist > rad) return;
      out.push({ ci: ci, dist: dist, type: sp.cells[ci].type, acts: acts });
    };

    var ring = (sp.hopsWithin && fromCi >= 0) ? sp.hopsWithin(fromCi, rad) : null;
    if (ring && ring.length) {
      for (var i = 0; i < ring.length && out.length < cap; i++) consider(ring[i]);
    } else {
      /* 兜底：没有半径枚举出口时的老抽样路径（保留确定性 roll，行为可复现） */
      var tries = d.samples || 4000;
      for (var k = 0; k < tries && out.length < cap; k++) {
        consider(Math.floor((GAME.invasionRoll ? GAME.invasionRoll('pg|s|' + k) : 0.5) * n) % n);
      }
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
  P.expOf = function (actId, lv) {
    var d = D();
    var t = (d.exp || {})[actId];
    if (t == null) {
      var a = (GAME.DATA && GAME.DATA.LING_ACT && GAME.DATA.LING_ACT[actId]) || {};
      t = (d.expByKind || {})[a.kind] || 0;
    }
    var tier = P.tier(lv);
    return Math.round(t * ((tier && tier.expMul) || 1));
  };

  /* 现在的连战机会（没有就是 null） */
  P.comboOf = function () {
    var s = st0();
    return (s && s.prologue && s.prologue.combo) || null;
  };
  P.comboClear = function () {
    var s = st0();
    if (s && s.prologue) s.prologue.combo = null;
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
    /* 连战不耗精力（它是上一场"顺下来"的），普通行动才走 check/spend */
    var combo = P.comboOf();
    var isCombo = !!(combo && combo.ci === ci && combo.act === actId);
    if (!isCombo) {
      var chk = GAME.jianghuCheck(ci, lord.id, actId);
      if (!chk.ok) return chk;
      GAME.jianghuSpend(chk);
    } else {
      var chk2 = GAME.jianghuCheck(ci, lord.id, actId);
      /* check 只是为了拿到 roll 需要的结构；连战不扣费，所以失败也能继续打 */
      if (!chk2.ok) return chk2;
      var chk = chk2;
    }
    var d = D();
    var tier = P.tier();
    var def = (GAME.DATA.LING_ACT || {})[actId];
    var bakPow = def ? def.power : null;
    if (def && bakPow) {
      def.power = Math.max(1, bakPow * (d.powerMul || 1) * ((tier && tier.powerMul) || 1));
    }
    var r;
    try {
      r = GAME.jianghuRoll(chk, { pow: d.powMul || 1 });
    } finally {
      if (def && bakPow) def.power = bakPow;   /* 一定要恢复：这张表是正式阶段的 */
    }
    if (!r || !r.ok) return r || { ok: false, msg: '这一趟没去成' };
    var gain = P.expOf(actId);
    /* v123：打输了也给一半（"打不过不等于白跑"），连战打折（防刷） */
    if (r.bad) gain = Math.round(gain * (D().loseExpMul == null ? 0.5 : D().loseExpMul));
    if (isCombo) gain = Math.round(gain * (D().comboExpMul == null ? 0.7 : D().comboExpMul));
    if (gain > 0 && GAME.battle && GAME.battle.gainExp) {
      GAME.battle.gainExp(lord, gain, '荒野 · ' + (r.name || actId));
    }
    var s = st0();
    if (s && s.prologue) {
      s.prologue.acts = (s.prologue.acts | 0) + 1;
      s.prologue.last = (r.name || '出去了一趟') + (r.text ? ' · ' + r.text : '')
        + (gain ? ' · 经验 +' + gain : '');
      /* 连战机会：打完之后掷一次，赢了就摆出"再来一场" */
      s.prologue.combo = (GAME.invasionRoll
        ? GAME.invasionRoll('combo|' + (s.prologue.acts | 0) + '|' + ci)
        : 0.5) < (D().comboChance == null ? 0.35 : D().comboChance)
        ? { ci: ci, act: actId } : null;
    }
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
    /* ============================================================
     * v123：**立城后的第一句话**
     * ------------------------------------------------------------
     * 立城那一刻玩家看到的是 20 格空地 + 一串「＋」。
     * 之前没有任何东西告诉他"先建什么"—— 空地看着像"还有好多要填"，
     * 而不是"从哪一块开始"。
     *
     * 只给一句、只给一次、不占版面（走既有 toast）。
     * 不说"你要守护这里"，只说下一步点哪。
     * ============================================================ */
    /* ⚠️ 不能直接调界面层（core 包引用 ui 会被架构棘轮拦，而且 node 探针里没有 ui）。
       改成留一条"下次渲染时弹一次"的提示，由 ui.renderView 消费。 */
    if (GAME.state) GAME.state._tip = '城立起来了。先点两格空地建农田 —— 粮不够，什么也盖不了。';
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
    /* 正确出口是 GAME.staMax（domain.js:8206）——
       我第一版写成 staMaxOf，判空写法让它**不报错**，
       体力一直不恢复。可空判断不代表没问题。 */
    if (GAME.staMax && GAME.setStaNow) {
      var scap = GAME.staMax(lord);
      GAME.setStaNow(lord, Math.min(scap, GAME.staNow(lord) + add));
    }
  };

  /* ============================================================
   * v114：**前传第一屏** —— 只有荒野，没有仪表盘
   * ------------------------------------------------------------
   * 老板 2026-10-23 的评估结论：前传第一屏有 50 个可点元素
   * （12 个 tab、行省/市/区三级下拉、7 种地形筛选、坐标输入、9 个地图按钮），
   * 而玩家此刻唯一该做的事（去荒野打怪）**一次都没出现**。
   * 人类读到的是"打开了一个没填完的 Excel"，不是"我在废土上活下来了"。
   *
   * 所以前传期盖一层全屏：只留天数、一句人话、一条等级进度、三个动作按钮、
   * 一行"最近发生了什么"。导航与仪表盘全部藏到立城之后。
   *
   * ⚠️ 用 fixed 覆盖层 + 隐藏 #topnav / #view-container，不改 renderView 的分支 ——
   *    立城后 `P.on()` 变 false，下一次刷新自动撤掉，玩家回到完整界面。
   * ============================================================ */
  P.screenHTML = function () {
    var lord = P.lord();
    var lv = P.lv(), need = P.needLv();
    var day = dayNow();
    var spots = P.spots();
    var city = GAME.currentCity ? GAME.currentCity() : null;
    var pop = city ? Math.round((GAME.res(city) || {}).pop || 0) : 0;
    var pct = Math.max(0, Math.min(100, Math.round(lv / need * 100)));
    /* v114：进度条用真 div（字符条 ░ 在深底上像噪点，而且各字体宽度不一致）*/
    var bar = '<div style="margin-top:7px;width:260px;height:6px;background:#23262b;border-radius:3px;">'
      + '<div style="height:6px;width:' + pct + '%;background:#c9b06a;border-radius:3px;"></div></div>';

    /* 三个动作：先找指定活动，找不到再找同类（近战/试炼/采集） */
    /* 主按钮不许"附近没有" —— 荒野上到处是变异兽，第一次进来就打不了，
       第一印象会变成"没得玩"。先在小范围找，找不到把范围翻倍再找一次。 */
    var wide = null;
    var wideSpots = function () {
      if (!wide) wide = P.spots((D().reach || 6) * 3);
      return wide;
    };
    var findAct = function (wanted, kinds) {
      return findIn(spots, wanted, kinds) || findIn(wideSpots(), wanted, kinds);
    };
    var findIn = function (pool, wanted, kinds) {
      var i, j;
      for (i = 0; i < pool.length; i++) {
        for (j = 0; j < pool[i].acts.length; j++) {
          if (pool[i].acts[j].id === wanted) {
            return { ci: pool[i].ci, id: pool[i].acts[j].id,
              name: pool[i].acts[j].def.name, dist: pool[i].dist,
              energy: pool[i].acts[j].def.energy };
          }
        }
      }
      for (i = 0; i < pool.length; i++) {
        for (j = 0; j < pool[i].acts.length; j++) {
          var k = (pool[i].acts[j].def || {}).kind;
          if (kinds && kinds.indexOf(k) >= 0) {
            return { ci: pool[i].ci, id: pool[i].acts[j].id,
              name: pool[i].acts[j].def.name, dist: pool[i].dist,
              energy: pool[i].acts[j].def.energy };
          }
        }
      }
      return null;
    };
    var b1 = findAct('tao', ['fight']);
    var b2 = findAct('shi', ['trial']);
    var b3 = findAct('cai', ['gather']);

    /* 按钮要像按钮：有边框、有内边距、有 hover。纯文字排一行读起来像一句话，
       玩家不会意识到那是三个能按的东西（改前截图就是这样）。 */
    var btn = function (it, label, hint) {
      var base = 'display:inline-block;padding:7px 14px;border-radius:4px;'
        + 'font-size:14px;border:1px solid ';
      if (!it) {
        return '<span style="' + base + '#22252a;color:#5a5449;" title="附近这一档暂时没有">'
          + label + '<span style="opacity:.7;"> · 附近没有</span></span>';
      }
      return '<span data-action="prologue-act" data-ci="' + it.ci
        + '" data-act="' + U.escape(it.id) + '" title="' + U.escape(hint || '') + '"'
        + ' style="' + base + '#4a4436;background:#171a1f;color:#e0d8c6;cursor:pointer;">'
        /* ⚠️ 原来写「5 格外」—— 那是"5 格之外"的缩写，读起来像"格外(特别)"。
           三个按钮上并排三个"格外"，第一眼是病句。改成「距 5 格」。 */
        + label + '<span style="opacity:.55;font-size:12px;">　距 ' + it.dist + ' 格</span></span>';
    };

    var last = (st0() && st0().prologue && st0().prologue.last) || '';

    /* v123：档位（按等级换地方）+ 连战 */
    var tier = P.tier(lv), nt = P.nextTier(lv);
    var combo = P.comboOf();
    var tierLine = tier
      ? '<div style="margin-top:14px;font-size:13px;color:#c9b06a;">📍 现在能去：<b>' + tier.name
        + '</b>　<span style="color:#8a7a5c;">' + U.escape(tier.line || '') + '</span></div>'
      : '';
    var nextLine = nt
      ? '<div style="font-size:12px;color:#6f6a60;margin-top:1px;">升到 Lv' + nt.lv
        + ' 能去「' + nt.name + '」（经验 ×' + nt.expMul + '，但那边更凶）</div>'
      : '';
    /* 连战：上一场打得顺，可以立刻再打一次（不耗精力，经验打折） */
    var comboLine = combo
      ? '<div style="margin-top:16px;"><span data-action="prologue-act" data-ci="' + combo.ci
        + '" data-act="' + U.escape(combo.act) + '"'
        + ' style="display:inline-block;padding:8px 16px;border-radius:4px;font-size:14px;'
        + 'border:1px solid #c9b06a;background:#2a2418;color:#ffd9a0;cursor:pointer;">'
        + '⚡ 趁势再来一场<span style="opacity:.55;font-size:12px;">　不耗精力 · 经验七折</span></span>'
        + '<span class="ui-sub" style="margin-left:8px;font-size:12px;">或先歇着（它在下一场之后失效）</span>'
        + '</div>'
      : '';
    /* 进度：几场了 + 还差几次的感觉（不写"还差 N 次"，那是数学题，不是游戏） */
    var acts = (st0() && st0().prologue && (st0().prologue.acts | 0)) || 0;

    return '<div style="max-width:520px;padding:28px 26px;line-height:1.9;">'
      + '<div style="font-size:13px;letter-spacing:.32em;color:#8a7a5c;">第 ' + (day + 1) + ' 天'
      + (acts ? '　已经出去 ' + acts + ' 趟' : '') + '</div>'
      + '<div style="font-size:19px;margin-top:10px;color:#e8e2d4;">你们 ' + U.numText(pop, 0)
      + ' 个人，还没有城。</div>'
      + '<div style="font-size:13px;color:#9a9284;margin-top:2px;">'
      + (day < 10 ? '天还没冷。得找点能打的，先把人练出来。'
        : '天在变冷。撑到能立城那天。')
      + '</div>'
      + tierLine + nextLine
      + '<div style="margin-top:20px;font-size:13px;color:#b9b0a0;">君主 <b style="color:#e8e2d4;">Lv'
      + lv + '</b> / ' + need + '</div>' + bar
      + comboLine
      + '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">'
      + btn(b1, '清剿', '打变异兽与掠夺者')
      + btn(b2, '试炼', '旧世试炼场，逐层加码')
      + btn(b3, '采集', '采药拾矿，安稳')
      + '</div>'
      + (spots.length ? '' : '<div style="margin-top:12px;font-size:12px;color:#8a7a5c;">附近今天没什么可做的 —— 明天再看。</div>')
      + (last ? '<div style="margin-top:20px;font-size:12px;color:#7d766a;border-top:1px solid #23262b;padding-top:10px;">最近：'
        + U.escape(last) + '</div>' : '')
      + (P.ready() ? '<div style="margin-top:18px;"><span class="chip" data-action="prologue-build">'
        + '立城（Lv' + need + ' 已满）</span></div>' : '')
      + '</div>';
  };

  /* 前传层与游戏界面的显隐（幂等：renderView 每次都调） */
  P.syncScreen = function () {
    /* ⚠️ smoke（node）里没有 document —— 不判这一下，renderView 每次都会抛
       ReferenceError，被上层 try/catch 吞掉后**悄悄改变后续用例的状态**
       （实测：改完之后 §98「清掉快照后应 verify=false」就红了）。 */
    if (typeof document === 'undefined' || !document.getElementById) return;
    var el = document.getElementById('prologue-screen');
    /* 前传期要藏起来的四块：顶部 12 个 tab、中央视图、**底部那排地图控件**、
       以及左侧资源栏。第一版漏了 #bottom-bar —— 截图里底下还露着
       「隐藏名称 / 指挥战斗 / 前往 / 回主城…」一整排，白藏了上面两块。 */
    var hide = ['topnav', 'view-container', 'bottom-bar'];
    var i;
    if (!P.on()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      for (i = 0; i < hide.length; i++) {
        var x = document.getElementById(hide[i]);
        if (x) x.style.display = '';
      }
      return;
    }
    for (i = 0; i < hide.length; i++) {
      var y = document.getElementById(hide[i]);
      if (y) y.style.display = 'none';
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'prologue-screen';
      el.style.cssText = 'position:fixed;inset:0;z-index:70;background:#0b0d10;'
        + 'display:flex;align-items:center;justify-content:center;overflow:auto;';
      document.body.appendChild(el);
    }
    el.innerHTML = P.screenHTML();
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
