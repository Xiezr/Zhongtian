/* ============================================================
 * story.js  世界与叙事层（v6）
 *
 * 四件事，全部后台运行：
 *   1) 历法天时 —— 年 / 季 / 天气推进，产出与战斗受其影响
 *   2) 年号纪元 —— 赛季制，每个年号立「时代之志」，达成给赏
 *   3) 史书纪事 —— 按里程碑与逐年快照自动记账，仿《三国志》纪传体
 *   4) 名将羁绊 —— 组合判定后静默并入各项加成，界面不作任何提示
 *
 * 另含：奇遇秘境（探索触发）与资源↔战力折算。
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
    if (!s.chronicle) s.chronicle = [];
    if (!s.eraHistory) s.eraHistory = [];
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
    if (changed && !silent && GAME.log) GAME.log('天时：' + pick.name + '（' + pick.desc + '）');
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

  /* v89.36（老板「维持军队无需耗粮食」）：军粮维持耗粮退役 ——
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

    /* 换季：检查里程碑；换年：写逐年快照 */
    if (w.season !== prevSeason || w.year !== prevYear) {
      if (w.year !== prevYear) {
        STORY.settleEraGoal();
        STORY.chronicleYearSnapshot();
      } else {
        STORY.checkMilestones();
      }
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
      /* 未达成的时代之志，留一笔史书 */
      if (!w.eraGoalDone) {
        STORY.chronicleAdd('是岁改元。' + era.name + '之世，' + era.goal.text + '，未能有成。', 'era');
      }
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
      STORY.chronicleAdd('天下大势，合久必分，分久必合。纪元复始，' + DATA.ERAS[0].name + '之世再临。', 'era');
      return;
    }
    w.eraIndex += 1;
    w.eraStartYear = w.year;
    w.eraGoalDone = false;
    var era = DATA.ERAS[w.eraIndex];
    STORY.chronicleAdd('改元' + era.name + '。' + era.desc + ' 时代之志：' + era.goal.text + '。', 'era');
    if (GAME.log) GAME.log('🎏 改元 ' + era.name + '：' + era.boon.text);
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
      for (var k in (s.techs || {})) cur += s.techs[k];
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
    s.eraHistory.push({ era: era.name, year: w.year, goal: era.goal.text, done: true });
    STORY.chronicleAdd('是岁，' + era.goal.text + '既成，' + era.name + '之志遂矣。赏赐有差，众心大悦。', 'era');
    if (GAME.log) GAME.log('🏆 时代之志达成：' + era.goal.text + '（+' + bonus.gold + '金 / +' + bonus.rep + '声望）');
  };

  /* ============================================================
   * 三、史书纪事（记账式）
   * ============================================================ */

  STORY.chronicleAdd = function (text, tag) {
    var s = GAME.state;
    if (!s) return;
    /* 离线补算期间抑制逐年/逐季记账，避免一次性涌出大量条目；
       补算结束后由 recordOffline 统一记一条。关键事件（改元/里程碑）仍保留。 */
    if (GAME._offline && tag !== 'era' && tag !== 'milestone') return;
    if (!s.chronicle) s.chronicle = [];
    var w = s.world || { year: 1, season: 0, eraIndex: 0, eraStartYear: 1 };
    s.chronicle.push({
      y: w.year, era: STORY.currentEra().name, eraYear: w.year - w.eraStartYear + 1,
      season: w.season, seasonName: STORY.seasonName(w.season),
      text: text, tag: tag || 'note', at: U.now(),
    });
    /* 史册过长时保留最近 300 条，避免存档膨胀 */
    if (s.chronicle.length > 300) s.chronicle = s.chronicle.slice(-300);
  };

  /* 变量替换 */
  STORY.fill = function (tpl) {
    var s = GAME.state, w = s.world;
    var army = 0;
    s.cities.forEach(function (c) { for (var id in (c.army || {})) army += c.army[id]; });
    var buildings = 0;
    s.cities.forEach(function (c) { c.cells.forEach(function (cell) { if (cell.build) buildings++; }); });
    var heroNames = s.generals.slice(0, 3).map(function (g) { return g.name; }).join('、');
    var vars = {
      '{era}': STORY.currentEra().name,
      '{yy}': STORY.yearName(),
      '{season}': STORY.seasonName(w.season),
      '{lord}': (s.ruler && s.ruler.name) || '君主',
      '{city}': (s.cities[0] && s.cities[0].name) || '新城',
      '{cities}': s.cities.length,
      '{army}': U.fmt(army),
      '{heroes}': s.generals.length,
      '{heroList}': heroNames || '无',
      '{pop}': U.fmt(s.res.pop || 0),
      '{buildings}': buildings,
      '{grain}': U.fmt(s.res.grain || 0),
      '{gold}': U.fmt(s.res.gold || 0),
    };
    var out = tpl;
    for (var k in vars) out = out.split(k).join(vars[k]);
    return out;
  };

  STORY._condOk = function (rule) {
    var s = GAME.state, c = rule.cond || {};
    var buildings = 0;
    s.cities.forEach(function (cc) { cc.cells.forEach(function (cell) { if (cell.build) buildings++; }); });
    var army = 0;
    s.cities.forEach(function (cc) { for (var id in (cc.army || {})) army += cc.army[id]; });
    if (c.always) return true;
    if (c.govLevel != null && (GAME.buildingLevel(GAME.currentCity(), 'guanfu') || 1) < c.govLevel) return false;
    if (c.army != null && army < c.army) return false;
    if (c.heroes != null && s.generals.length < c.heroes) return false;
    if (c.cities != null && s.cities.length < c.cities) return false;
    if (c.buildings != null && buildings < c.buildings) return false;
    if (c.pop != null && GAME.totalPop() < c.pop) return false;   /* v60：全境人口 */
    if (c.rep != null && (s.rep || 0) < c.rep) return false;
    return true;
  };

  /* 里程碑检查：每次换季调用，挑一条尚未记过、优先级最高的写入 */
  STORY.checkMilestones = function () {
    var s = GAME.state;
    if (!s.chronicleDone) s.chronicleDone = {};
    var rules = (DATA.CHRONICLE_RULES || []).filter(function (r) { return !r.repeat; });
    rules.sort(function (a, b) { return (b.prio || 0) - (a.prio || 0); });
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (s.chronicleDone[r.id]) continue;
      if (!STORY._condOk(r)) continue;
      s.chronicleDone[r.id] = true;
      STORY.chronicleAdd(STORY.fill(r.t), 'milestone');
      return r.id;
    }
    return null;
  };

  /* 逐年快照（无论是否达成里程碑，都留一笔，使史册连贯） */
  STORY.chronicleYearSnapshot = function () {
    var s = GAME.state;
    var rules = (DATA.CHRONICLE_RULES || []).filter(function (r) { return r.repeat; });
    if (!rules.length) return;
    STORY.chronicleAdd(STORY.fill(rules[0].t), 'annual');
  };

  /* 重大外部事件记账（供战斗/占领等调用） */

  /* 离线归来记账：把整段离线合并为一条，与存档的 world.elapsed 事实源对齐 */
  STORY.recordOffline = function (secReal) {
    var s = GAME.state;
    if (!s || !s.world) return;
    var hours = secReal / 3600;
    var dur = hours >= 1 ? (hours.toFixed(1) + '时') : (Math.round(secReal / 60) + '分');
    var army = 0;
    s.cities.forEach(function (c) { for (var id in (c.army || {})) army += c.army[id]; });
    STORY.chronicleAdd('离城' + dur + '乃归。' + STORY.currentEra().name + STORY.yearName() + '年' +
      STORY.seasonName(s.world.season) + '，城' + s.cities.length + '座，甲兵' + U.fmt(army) + '，粟' +
      U.fmt(s.res.grain) + '石。', 'offline');
  };

  /* 生成史册文本（导出/展示用） */
  STORY.chronicleText = function (limit) {
    var s = GAME.state;
    var list = (s.chronicle || []);
    if (limit) list = list.slice(-limit);
    return list.map(function (e) {
      return '【' + e.era + '·' + e.seasonName + '】' + e.text;
    }).join('\n');
  };

  /* ============================================================
   * 四、名将羁绊（后台静默生效，不提示）
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
   * 五、奇遇秘境（探索触发 · 带隐性幸运保底）
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
    STORY.chronicleAdd('遣斥候巡于野，得' + pick.name + '。' + pick.text, 'encounter');
    return pick;
  };

  /* ============================================================
   * 六、奖励结算（纪事/奇遇共用）
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
   * 七、资源 ↔ 战力折算
   * ============================================================ */

  /* 单兵战力：按兵种属性加权 */
  STORY.troopPower = function (troopId) {
    var t = DATA.TROOPS[troopId];
    if (!t) return 0;
    var W = DATA.POWER.troopWeight;
    return (t.hp * W.hp + t.atk * W.atk + t.def * W.def + t.spd * W.spd) || 1;
  };

  /* 当前战力（现有军队折算） */
  STORY.currentPower = function () {
    var s = GAME.state, total = 0;
    s.cities.forEach(function (c) {
      for (var id in (c.army || {})) {
        total += STORY.troopPower(id) * c.army[id];
      }
    });
    return Math.round(total * STORY.atkMult());
  };

  /* 资源可动员战力（把库存折算成"还能养多少兵"） */
  STORY.reservePower = function () {
    var s = GAME.state, troops = 0;
    for (var r in DATA.POWER.resToTroop) {
      troops += (s.res[r] || 0) * DATA.POWER.resToTroop[r];
    }
    var avg = STORY.troopPower('yibing'); // 以义兵为基准单位
    return Math.round(troops * avg);
  };

  /* 综合国力指数：战力 ×（1 + 建筑系数 + 科技系数） */
  STORY.powerIndex = function () {
    var s = GAME.state;
    var buildings = 0;
    s.cities.forEach(function (c) { c.cells.forEach(function (cell) { if (cell.build) buildings += cell.build.lvl; }); });
    var tech = 0;
    for (var k in (s.techs || {})) tech += s.techs[k];
    var base = STORY.currentPower() + STORY.reservePower() * 0.35;
    var mult = 1 + buildings * DATA.POWER.buildingBonus + tech * DATA.POWER.techBonus;
    return Math.round(base * mult);
  };

  /* 战力构成明细（面板展示用） */
  STORY.powerBreakdown = function () {
    var s = GAME.state;
    var buildings = 0;
    s.cities.forEach(function (c) { c.cells.forEach(function (cell) { if (cell.build) buildings += cell.build.lvl; }); });
    var tech = 0;
    for (var k in (s.techs || {})) tech += s.techs[k];
    return {
      army: STORY.currentPower(),
      reserve: STORY.reservePower(),
      buildings: buildings,
      tech: tech,
      index: STORY.powerIndex(),
      bondCount: STORY.activeBonds().length,
    };
  };

  /* ---- 招募一名尚未拥有的名将（纪事/奇遇奖励用） ---- */
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
    if (GAME.log) GAME.log('贤才来归：' + h.name + ' 入我帐下。');
    return g;
  };

  /* ============================================================
   * 八、称号判定（结局 / 史册展示）
   * ============================================================ */

  STORY.evaluateTitle = function () {
    var s = GAME.state;
    var cities = s.cities.length, hearts = s.hearts || 0;
    var list = DATA.TITLES || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i].cond || {};
      if (c.minCities != null && cities < c.minCities) continue;
      if (c.minHearts != null && hearts < c.minHearts) continue;
      if (c.maxHearts != null && hearts > c.maxHearts) continue;
      return list[i];
    }
    return list[list.length - 1];
  };

})();
