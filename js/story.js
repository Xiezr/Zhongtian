/* ============================================================
 * story.js  世界与数值层（v6；v89.218 起叙事内容整条退役）
 *
 * ⛔ v89.218（老板）：「故事全部去除，不再保留史册，故事集」——
 *   本文件中的**史书纪事**（chronicle 记账 / 里程碑 / 逐年快照 / 离线归来记账）
 *   与**称号评定**（evaluateTitle + DATA.TITLES）、**战力折算展示**
 *   （powerIndex / reservePower / currentPower / powerBreakdown）整条退役；
 *   故事库引擎（GAME.SG）与阅读器（#story-fx）已从 state.js / ui.js 移除，
 *   内容层 `story/` 目录（84 卷）与「史册 / 故事集」两个视图一并删除。
 *
 *   保留的是**玩法数值层**（四件事，全部后台运行）：
 *     1) 历法天时 —— 年 / 季 / 天气推进，产出与战斗受其影响
 *     2) 年号纪元 —— 赛季制，每个年号立「时代之志」，达成给赏
 *        （进度页随史册退役；改元 / 达成仍写入公文播报）
 *     3) 名将羁绊 —— 组合判定后静默并入各项加成，界面不作提示
 *     4) 奇遇遗迹（巡野拾获）· 奖励结算 · 战力尺（troopPower）
 *
 * 文件名沿用 story.js：加载链（index.html / smoke / e2e / 全仓 200+ 工具探针）
 * 的引用面过大，重命名零功能收益 —— 迁移说明记于此，勿再按名索骥。
 * 挂到 window.GAME.story
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  var STORY = GAME.story = {};

  /* ============================================================
   * 一、历法天时
   * ============================================================ */

  STORY.init = function () {
    var s = GAME.state;
    if (!s) return;
    if (!s.world) {
      s.world = {
        elapsed: 0,          // 累计游戏秒
        year: 1,
        season: 0,
        weather: 'clear',
        weatherLeft: DATA.CALENDAR.secPerYear / 4,
        eraIndex: 0,
        eraStartYear: 1,
        eraGoalDone: false,
        eraGoalClaimed: false,
      };
    }
    STORY.rollWeather(true);
  };

  STORY.seasonName = function (i) {
    return ['春', '夏', '秋', '冬'][i % 4] || '春';
  };

  STORY.currentEra = function () {
    var s = GAME.state;
    if (!s || !s.world) return DATA.ERAS[0];
    return DATA.ERAS[Math.min(s.world.eraIndex, DATA.ERAS.length - 1)];
  };

  STORY.currentSeason = function () {
    var s = GAME.state;
    if (!s || !s.world) return DATA.SEASONS[0];
    return DATA.SEASONS[s.world.season % 4];
  };

  STORY.currentWeather = function () {
    var s = GAME.state;
    if (!s || !s.world) return DATA.WEATHERS.clear;
    return DATA.WEATHERS[s.world.weather] || DATA.WEATHERS.clear;
  };

  /* 按权重随机一种天气 */
  STORY.rollWeather = function (silent) {
    var s = GAME.state;
    if (!s || !s.world) return null;
    var total = 0, list = [];
    for (var k in DATA.WEATHERS) { list.push(DATA.WEATHERS[k]); total += DATA.WEATHERS[k].weight; }
    var r = Math.random() * total, pick = list[0];
    for (var i = 0; i < list.length; i++) {
      if (r < list[i].weight) { pick = list[i]; break; }
      r -= list[i].weight;
    }
    var changed = s.world.weather !== pick.id;
    s.world.weather = pick.id;
    s.world.weatherLeft = DATA.CALENDAR.secPerYear / 4;
    /* v89.153（老板 2）：主题 = 天时（系统页小标签） */
    if (changed && !silent && GAME.log) GAME.log('天时：' + pick.name + '（' + pick.desc + '）', 'sys', 'weather');
    return pick;
  };

  /* 天时对资源的乘数 */
  STORY.prodMult = function (res) {
    var se = STORY.currentSeason(), we = STORY.currentWeather(), era = STORY.currentEra();
    var m = 1;
    if (res === 'grain') {
      m *= (1 + (se.grain || 0));
      m *= (1 + (we.grain || 0));
    }
    if (era && era.boon && era.boon.prod) m *= (1 + era.boon.prod);
    if (res === 'gold' && era && era.boon && era.boon.gold) m *= (1 + era.boon.gold);
    return m;
  };

  /* v89.36（老板「维持军队无需耗净水」）：军粮维持耗粮退役 ——
     `STORY.feedMult`（天时对军粮的乘数）随之一并移除；四季/天气的 feed 字段同时下线。 */

  /* 天时对战斗的修正（供 battle.js 调用） */
  STORY.combatMod = function () {
    var we = STORY.currentWeather(), era = STORY.currentEra();
    return {
      weather: we,
      archerRange: 1 + (we.archerRange || 0),
      fire: we.fire == null ? 1 : we.fire,
      ambush: we.ambush || 1,
      scout: we.scout !== false,
      move: we.move || 1,
      atkEra: (era && era.boon && era.boon.atk) ? 1 + era.boon.atk : 1,
      siegeEra: (era && era.boon && era.boon.siege) ? 1 + era.boon.siege : 1,
      researchEra: (era && era.boon && era.boon.research) ? 1 + era.boon.research : 1,
    };
  };

  /* 天时描述行（用于界面显示） */
  STORY.skyLine = function () {
    var s = GAME.state;
    if (!s || !s.world) return '';
    var era = STORY.currentEra(), se = STORY.currentSeason(), we = STORY.currentWeather();
    return era.name + '·' + STORY.yearName() + '年 ' + se.name + ' ' + we.icon + we.name;
  };

  /* 年序名（元年/二年/三年…，仿古文） */
  STORY.yearName = function () {
    var s = GAME.state;
    if (!s || !s.world) return '元';
    var yy = s.world.year - s.world.eraStartYear + 1;
    if (yy <= 1) return '元';
    var cn = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (yy <= 10) return cn[yy];
    if (yy < 20) return '十' + cn[yy - 10];
    return String(yy);
  };

  /* 每秒推进 */
  STORY.tick = function (ts) {
    var s = GAME.state;
    if (!s || !s.world) return;
    var w = s.world;
    var prevYear = w.year, prevSeason = w.season, prevEra = w.eraIndex;

    w.elapsed += ts;

    var Y = DATA.CALENDAR.secPerYear;
    w.year = Math.floor(w.elapsed / Y) + 1;
    w.season = Math.floor((w.elapsed % Y) / (Y / 4)) % 4;

    /* 天气轮换 */
    w.weatherLeft -= ts;
    if (w.weatherLeft <= 0) STORY.rollWeather();

    /* 年号推进 */
    STORY.checkEra();

    /* 换年：结算时代之志（⛔ v89.218：里程碑 / 逐年快照随史册退役，不再记账） */
    if (w.year !== prevYear) {
      STORY.settleEraGoal();
    }
  };

  /* ============================================================
   * 二、年号纪元（赛季制）
   * ============================================================ */

  STORY.checkEra = function () {
    var s = GAME.state, w = s.world;
    var yearsInEra = w.year - w.eraStartYear;
    var era = DATA.ERAS[w.eraIndex];
    if (!era) return;
    if (yearsInEra >= era.years) {
      STORY.eraAdvance();
    }
  };

  STORY.eraAdvance = function () {
    var s = GAME.state, w = s.world;
    if (w.eraIndex >= DATA.ERAS.length - 1) {
      /* 年号用尽：循环并加速，作为长线延续 */
      w.eraIndex = 0;
      w.eraStartYear = w.year;
      w.eraGoalDone = false;
      return;
    }
    w.eraIndex += 1;
    w.eraStartYear = w.year;
    w.eraGoalDone = false;
    var era = DATA.ERAS[w.eraIndex];
    /* v89.153（老板 2）：主题 = 改元（系统页小标签；大类仍是 task——任务并入系统页） */
    if (GAME.log) GAME.log('🎏 改元 ' + era.name + '：' + era.boon.text, 'task', 'era');
  };

  /* 时代目标当前进度（返回 {cur,target,text,ratio,ok}） */
  STORY.eraGoalProgress = function () {
    var s = GAME.state, era = STORY.currentEra();
    if (!s || !era) return null;
    var g = era.goal, cur = 0;
    if (g.type === 'buildings') {
      s.cities.forEach(function (c) { c.cells.forEach(function (cell) { if (cell.build) cur++; }); });
    } else if (g.type === 'heroes') {
      cur = s.generals.length;
    } else if (g.type === 'army') {
      cur = 0;
      s.cities.forEach(function (c) { for (var id in (c.army || {})) cur += c.army[id]; });
    } else if (g.type === 'cities') {
      cur = s.cities.length;
    } else if (g.type === 'pop') {
      /* v60（需求 4）：时代之志是**全境**目标，人口要走 GAME.totalPop
         （s.res.pop 现在只代表当前城） */
      cur = Math.floor(GAME.totalPop());
    } else if (g.type === 'techTotal') {
      /* v89.191（老板 3-④）：科技按城 —— 总值走唯一出口 statOf('techTotal')（各城之和）。 */
      cur = GAME.questMetric ? GAME.questMetric('techTotal') : 0;
    } else if (g.type === 'rep') {
      cur = Math.floor(s.rep || 0);
    } else if (g.type === 'govLevel') {
      cur = GAME.buildingLevel(GAME.currentCity(), 'guanfu') || 1;
    } else if (g.type === 'hearts') {
      cur = Math.floor(s.hearts || 0);
    }
    return { cur: cur, target: g.n, text: g.text, ratio: g.n ? Math.min(1, cur / g.n) : 0, ok: cur >= g.n };
  };

  /* 达成即给赏（每时代一次） */
  STORY.settleEraGoal = function () {
    var s = GAME.state, w = s.world, era = STORY.currentEra();
    if (!era || w.eraGoalDone) return;
    var p = STORY.eraGoalProgress();
    if (!p || !p.ok) return;
    w.eraGoalDone = true;
    var bonus = { gold: 20000 * (w.eraIndex + 1), rep: 500 * (w.eraIndex + 1) };
    s.res.gold = (s.res.gold || 0) + bonus.gold;
    s.rep = (s.rep || 0) + bonus.rep;
    if (GAME.log) GAME.log.task('🏆 时代之志达成：' + era.goal.text + '（+' + bonus.gold + '金 / +' + bonus.rep + '声望）');
  };

  /* ============================================================
   * 三、名将羁绊（后台静默生效，不提示）
   * ============================================================ */

  /* 玩家拥有的将领名集合 */
  STORY._ownedNames = function () {
    var s = GAME.state, m = {};
    (s.generals || []).forEach(function (g) { m[g.name] = true; });
    return m;
  };

  /* 当前已激活的羁绊列表（仅内部使用，界面不展示） */
  STORY.activeBonds = function () {
    var names = STORY._ownedNames();
    return (DATA.BONDS || []).filter(function (b) {
      return b.members.every(function (n) { return names[n]; });
    });
  };

  /* 羁绊加成汇总。key 同 bonus 定义 */
  STORY.bondBonus = function (key) {
    var m = 0;
    STORY.activeBonds().forEach(function (b) {
      if (b.bonus[key] != null) m += b.bonus[key];
    });
    return m;
  };

  /* ---- 供其他模块调用的聚合接口（羁绊 + 年号，均后台静默生效） ---- */

  STORY.heartsPerHour = function () {
    var era = STORY.currentEra();
    var m = STORY.bondBonus('hearts');
    if (era && era.boon && era.boon.hearts) m += era.boon.hearts;
    return m;
  };

  STORY.researchMult = function () {
    var era = STORY.currentEra();
    var m = 1 + STORY.bondBonus('research');
    if (era && era.boon && era.boon.research) m *= (1 + era.boon.research);
    return m;
  };

  /* 声望获取倍率（赛季国策「人心思附：声望获取 +20%」）
     —— 此前该 boon 定义了却无任何读取点，等于奖项为空 */
  STORY.repMult = function () {
    var era = STORY.currentEra();
    var m = 1;
    if (era && era.boon && era.boon.rep_gain) m *= (1 + era.boon.rep_gain);
    return m;
  };

  STORY.leadMult = function () {
    return 1 + STORY.bondBonus('lead');
  };

  STORY.trainMult = function () {
    var era = STORY.currentEra();
    return (era && era.boon && era.boon.train) ? 1 + era.boon.train : 1;
  };

  STORY.cityDefMult = function () {
    return 1 + STORY.bondBonus('cityDef');
  };

  /* 全军攻击 / 防御 / 攻城乘数（羁绊 + 年号 + 天时） */
  STORY.atkMult = function () {
    var cm = STORY.combatMod();
    return (1 + STORY.bondBonus('atk')) * cm.atkEra;
  };
  /* 羁绊「守御」的加算值（由调用方负责封顶）。
     原先返回 1+该值，与战斗里内联的封顶版本形成两份实现 → 统一为单一来源。 */
  STORY.defMult = function () {
    return STORY.bondBonus('def');
  };
  /* 攻城伤害倍率 = 羁绊「白衣渡江」× 赛季国策（青龙·大兴土木 / 景元·大将西征） */
  STORY.siegeMult = function () {
    var cm = STORY.combatMod();
    return (1 + STORY.bondBonus('siege')) * cm.siegeEra;
  };

  /* ============================================================
   * 四、奇遇遗迹（探索触发 · 带隐性幸运保底）
   * v89.218：原「写入史册」改为**写入公文**（史册退役后保持可见性——
   *   奖励是实时落账的，玩家必须能看到它从哪来）。
   * ============================================================ */

  STORY.encounterChance = function () {
    var s = GAME.state;
    var luck = (s.world && s.world.luck) || 0;
    return 0.12 + Math.min(0.30, luck * 0.01); // 基础 12%，每次扑空累积，最多 +30%
  };

  STORY.encounterRoll = function () {
    var s = GAME.state;
    if (!s.world) return null;
    if (Math.random() > STORY.encounterChance()) {
      s.world.luck = ((s.world.luck || 0) + 1);
      return null;
    }
    s.world.luck = 0;
    var list = DATA.ENCOUNTERS || [];
    var total = 0;
    list.forEach(function (e) { total += e.weight; });
    var r = Math.random() * total, pick = list[0];
    for (var i = 0; i < list.length; i++) {
      if (r < list[i].weight) { pick = list[i]; break; }
      r -= list[i].weight;
    }
    s.world.encounters = (s.world.encounters || 0) + 1;
    s.world.lastEncounter = pick.id;
    STORY.applyReward(pick.reward);
    if (GAME.log) GAME.log('🔍 巡野所得：' + pick.name + '。' + pick.text, 'sys', 'gather');
    return pick;
  };

  /* ============================================================
   * 五、奖励结算（奇遇共用）
   * ============================================================ */

  STORY.applyReward = function (rw) {
    if (!rw) return;
    var s = GAME.state;
    if (rw.res) for (var k in rw.res) s.res[k] = (s.res[k] || 0) + rw.res[k];
    if (rw.hearts) s.hearts = U.clamp((s.hearts || 100) + rw.hearts, 0, 100);
    if (rw.rep) s.rep = (s.rep || 0) + rw.rep;
    if (rw.pop) s.res.pop = Math.max(0, (s.res.pop || 0) + rw.pop);
    if (rw.tech) GAME.state.res.techPoint = (GAME.state.res.techPoint || 0) + rw.tech;
    if (rw.item) {
      var n = rw.count || 1;
      s.items[rw.item] = (s.items[rw.item] || 0) + n;
    }
    if (rw.hero) {
      for (var i = 0; i < rw.hero; i++) {
        if (GAME.recruitRandomGeneral) GAME.recruitRandomGeneral();
      }
    }
    if (rw.gold) s.res.gold = (s.res.gold || 0) + rw.gold;
  };

  /* ============================================================
   * 六、战力尺（单兵折算 —— 供 battle / state 复用，全仓唯一出口）
   * ============================================================ */

  /* 单兵战力：按兵种属性加权 */
  STORY.troopPower = function (troopId) {
    var t = DATA.TROOPS[troopId];
    if (!t) return 0;
    var W = DATA.POWER.troopWeight;
    return (t.hp * W.hp + t.atk * W.atk + t.def * W.def + t.spd * W.spd) || 1;
  };

  /* ---- 招募一名尚未拥有的名将（奇遇奖励用） ---- */
  GAME.recruitRandomGeneral = function () {
    var s = GAME.state;
    if (!s) return null;
    var owned = {};
    (s.generals || []).forEach(function (g) { owned[g.name] = true; });
    var cands = (DATA.HEROES || []).filter(function (h) { return !owned[h.name]; });
    if (!cands.length) return null;
    var h = cands[Math.floor(Math.random() * cands.length)];
    var g = GAME.makeHero ? GAME.makeHero(h)
      : GAME.makeGeneral(h.name, 1, 'idle', GAME.currentCity().id, false);
    g.loyalty = 70;
    s.generals.push(g);
    if (GAME.log) GAME.log('贤才来归：' + h.name + ' 入我帐下。', 'sys', 'staff');
    return g;
  };

})();
