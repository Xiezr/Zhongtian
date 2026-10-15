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
 *   保留的是**玩法数值层**（三件事，全部后台运行）：
 *     1) 历法天时 —— 年 / 季 / 天气推进，产出与战斗受其影响
 *     2) 英雄羁绊 —— 组合判定后静默并入各项加成，界面不作提示
 *     3) 奇遇遗迹（巡野拾获）· 奖励结算 · 战力尺（troopPower）
 *
 * ⛔ v90.93（老板「去掉纪事剧本」中的「年号纪元」）：
 *   `DATA.ERAS`（11 个年号）与 `STORY.currentEra / checkEra / eraAdvance /
 *   eraGoalProgress / settleEraGoal / yearName` 整条移除；world 里的
 *   `eraIndex / eraStartYear / eraGoalDone / eraGoalClaimed` 四字段随之作废。
 *   受连带的乘数：`prodMult / combatMod` 去掉年号项；`heartsPerHour /
 *   researchMult / atkMult / siegeMult` 只余羁绊；`repMult`（声望获取倍率）
 *   与 `trainMult`（训练加速）**整函数删除**（年号是二者唯一的加成来源）。
 *   天时（年/季/天气）**保留**；skyLine 改为「第 N 年 季 天候」。
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
        /* v90.93：eraIndex / eraStartYear / eraGoalDone / eraGoalClaimed 随年号纪元退役 */
      };
    }
    STORY.rollWeather(true);
  };

  STORY.seasonName = function (i) {
    return ['春', '夏', '秋', '冬'][i % 4] || '春';
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
    /* v90.93：年号纪元退役 —— 只剩季节与天气两项（原「年号增益」的全资源产量 / 旧币收入两项已移除）。 */
    var se = STORY.currentSeason(), we = STORY.currentWeather();
    var m = 1;
    if (res === 'grain') {
      m *= (1 + (se.grain || 0));
      m *= (1 + (we.grain || 0));
    }
    return m;
  };

  /* v89.36（老板「维持军队无需耗净水」）：军粮维持耗粮退役 ——
     `STORY.feedMult`（天时对军粮的乘数）随之一并移除；四季/天气的 feed 字段同时下线。 */

  /* 天时对战斗的修正（供 battle.js 调用） */
  STORY.combatMod = function () {
    /* v90.93：年号纪元退役 —— 当初再拼入的三个“年号倍率键”（全军攻击 / 攻城 / 研究）
       一并移除 —— 它们原先只在 atkMult / siegeMult 内被读过。 */
    var we = STORY.currentWeather();
    return {
      weather: we,
      archerRange: 1 + (we.archerRange || 0),
      fire: we.fire == null ? 1 : we.fire,
      ambush: we.ambush || 1,
      scout: we.scout !== false,
      move: we.move || 1,
    };
  };

  /* 天时描述行（用于界面显示） */
  STORY.skyLine = function () {
    /* v90.93：年号纪元退役 —— 天时行改为「第 N 年 季 天候」（年号与年序名一并去掉）。 */
    var s = GAME.state;
    if (!s || !s.world) return '';
    var se = STORY.currentSeason(), we = STORY.currentWeather();
    return '第 ' + (s.world.year || 1) + ' 年 ' + se.name + ' ' + we.icon + we.name;
  };

  /* 每秒推进 */
  STORY.tick = function (ts) {
    var s = GAME.state;
    if (!s || !s.world) return;
    var w = s.world;
    w.elapsed += ts;

    var Y = DATA.CALENDAR.secPerYear;
    w.year = Math.floor(w.elapsed / Y) + 1;
    w.season = Math.floor((w.elapsed % Y) / (Y / 4)) % 4;

    /* 天气轮换 */
    w.weatherLeft -= ts;
    if (w.weatherLeft <= 0) STORY.rollWeather();

    /* ⛔ v90.93：年号推进（STORY.checkEra）与换年结算（STORY.settleEraGoal）
       随年号纪元整条退役 —— 这里只剩历法天时（年 / 季 / 天气）推进。 */
  };

  /* ============================================================
   * 二、年号纪元（赛季制）—— ⛔ v90.93 整段退役
   * ------------------------------------------------------------
   * `STORY.checkEra`（到期改元）/ `STORY.eraAdvance`（换年号 + 公文播报）/
   * `STORY.eraGoalProgress`（各年号的“时代之志”进度）/ `STORY.settleEraGoal`（达成给赏）
   * 四个出口与 `DATA.ERAS` 表一并删除。
   * 沿革：牌面修正系数原走 era.boon（prod / gold / atk / siege /
   * 研究 / 民心 / 声望获取 / 训练速度 八项）—— 现已逐项从各乘数里取消；
   * 年号进度页已在 v89.218 随史册退役，改元/达成的公文播报随本次一并消失。
   * ============================================================ */

  /* ============================================================
   * 三、英雄羁绊（后台静默生效，不提示）
   * ============================================================ */

  /* 玩家拥有的英雄名集合 */
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

  /* ---- 供其他模块调用的聚合接口（v90.93 起只余羁绊，后台静默生效） ---- */

  STORY.heartsPerHour = function () {
    /* v90.93：年号纪元退役 —— 只余羁绊（原「年号增益」的民心每小时项已移除）。 */
    return STORY.bondBonus('hearts');
  };

  STORY.researchMult = function () {
    /* v90.93：年号纪元退役 —— 只余羁绊（原「年号增益」的研究加速项已移除）。 */
    return 1 + STORY.bondBonus('research');
  };

  STORY.leadMult = function () {
    return 1 + STORY.bondBonus('lead');
  };

  /* ⛔ v90.93 退役：`STORY.repMult`（声望获取倍率）与 `STORY.trainMult`（训练加速）——
     二者的**唯一**加成来源都是年号国策（「人心思附：声望获取 +20%」与
     「制度维新：训练速度 +15%」），
     年号纪元移除后恒为 1（空转）→ 整函数删除；消费点已同步去掉该乘数
     （battle.js 攻城/野地声望、domain.js 训练耗时、domain.js 岁贡声望）。 */

  STORY.cityDefMult = function () {
    return 1 + STORY.bondBonus('cityDef');
  };

  /* 全军攻击 / 防御 / 攻城乘数（v90.93 起：羁绊；天时另由 combatMod 单列读取） */
  STORY.atkMult = function () {
    return 1 + STORY.bondBonus('atk');
  };
  /* 羁绊「守御」的加算值（由调用方负责封顶）。
     原先返回 1+该值，与战斗里内联的封顶版本形成两份实现 → 统一为单一来源。 */
  STORY.defMult = function () {
    return STORY.bondBonus('def');
  };
  /* 攻城伤害倍率 = 羁绊「白衣渡江」（v90.93：赛季国策项随年号纪元退役） */
  STORY.siegeMult = function () {
    return 1 + STORY.bondBonus('siege');
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

  /* ---- 招募一名尚未拥有的英雄（奇遇奖励用） ---- */
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
    /* v91.02：**贤才也要有归属城** —— makeHero 的 cityId 默认 null → genCityOf 回退"当前城"
       → 这位英雄**在每个城里都出现**（老板报的"英雄界面显示全部英雄"）。归当前城。 */
    var home91 = GAME.currentCity() || (s.cities && s.cities[0]) || null;
    if (home91 && !g.cityId) g.cityId = home91.id;
    s.generals.push(g);
    if (GAME.log) GAME.log('贤才来归：' + h.name + ' 入我帐下。', 'sys', 'staff');
    return g;
  };

})();
