/* ============================================================
 * battle.js  回合制战斗（真实数值版）
 * 速度先手、远程射程优势、将领四维加成、科技/宝物加成、伤兵营
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  GAME.battle = {};

  /* 科技加成取值（统一入口，避免各处写 GAME.systems.techBonus 冗长判空）
     判据：只要 techBonus 存在就取，缺失时返回 0（保证测试环境可跑） */
  function TB(type) {
    return (GAME.systems && GAME.systems.techBonus) ? GAME.systems.techBonus(type) : 0;
  }

  function totalCount(army) {
    var n = 0;
    for (var id in army) n += army[id];
    return n;
  }
  function totalHp(army, gen) {
    var hp = 0;
    for (var id in army) if (DATA.TROOPS[id]) hp += army[id] * DATA.TROOPS[id].hp;
    /* 补给技巧：士兵生命 +3%/级 —— 同等伤害下战损更少 */
    return hp * (1 + TB('hp')) * hpMultOf(gen);
  }
  /* 将领加成 → 全军生命（v29 · 需求 11 重写；v66 收成一条链）
     * ------------------------------------------------------------
     * ② **只看体力这一条链**：体力满则全军生命厚，刚打完仗体力见底就明显变脆
     *     —— 于是"休整/服止血散"第一次有了战斗意义。
     *    取值走 GAME.staHpBonus()（界面与战斗同源，不写第二份公式）。
     * v66（老板）：「部分将领的体力没有加上装备的数值」。根因就是这里：
     *   装备那一列（源数据表的「体力」）原先**在体力之外**又开了一条
     *   `eqHp = min(0.25, 装备体力/10000)` 的路，与"体力→全军生命"并行。
     *   同一个数两个出口 → 界面上的"体力"当然对不上装备栏。
     *   现在装备体力并进体力上限（GAME.staMax），这里那条并行路径**删掉**。
     */
  function hpMultOf(gen) {
    if (!gen) return 1;
    return 1 + (GAME.staHpBonus ? GAME.staHpBonus(gen) : 0);
  }
  /* 兵种速度（影响先手判定）
   * 科技加成各管一类：行军技巧→全军、驾驭技巧→骑兵、车轮技术→器械 */
  function spdMultOf(t) {
    var m = 1 + TB('march');
    if (!t) return m;
    if (t.craft) return m * (1 + TB('wheel'));                    // 器械（床弩/冲车/投石车）
    if (/qi$|tieqi|qingji/.test(t.id) || t.name.indexOf('骑') >= 0) {
      return m * (1 + TB('ride'));                                // 骑兵
    }
    return m;
  }
  function armySpeed(army) {
    /* 天气：行军速度（雨天 −20% / 雪 −50% / 雾 −30% / 大风 +10%） */
    var wMove = 1;
    if (GAME.story && GAME.story.combatMod) wMove = GAME.story.combatMod().move || 1;
    var spd = 0, n = 0;
    for (var id in army) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) { spd += t.spd * spdMultOf(t) * army[id]; n += army[id]; }
    }
    return (n ? spd / n : 100) * wMove;
  }
  /* 远程占比（射程≥800） */
  function rangeRatio(army) {
    var r = 0, n = 0;
    for (var id in army) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) { if (t.range >= 800) r += army[id]; n += army[id]; }
    }
    return n ? r / n : 0;
  }

  /* 攻方对守方伤害（将领/科技/宝物加成 + 统率覆盖限制） */
  function damageOf(attackerArmy, defenderArmy, general, defenderDefBonus, isFirst) {
    var s = GAME.state;
    var sum = 0;
    for (var id in attackerArmy) {
      var t = DATA.TROOPS[id];
      if (!t) continue;
      var cnt = attackerArmy[id];
      if (cnt <= 0) continue;
      /* v57：相克改成 B 套（见 data.js 的 COUNTER_ATK / COUNTER_DEF）。
         这里是**攻击向**：与 tactic 引擎读同一张表，不另写一套。 */
      var mult = GAME.tactic ? GAME.tactic.counterAtkOf(id, defenderArmy) : 1;
      /* **防御向**：dice 引擎没有 A/D 对冲，用"守方对这支攻方兵种的最高防御因子"
         折算成除法（×N 防御 ≈ 伤害 ÷N）。方向与量级与 tactic 的 2A/(A+D) 一致，
         但不完全等价 —— dice 本就是简化回退引擎，切引擎时相克强度会有差异。 */
      var defMul = 1;
      for (var did in defenderArmy) {
        if ((defenderArmy[did] || 0) <= 0) continue;
        var dm = GAME.tactic ? GAME.tactic.counterDefOf(did, id) : 1;
        if (dm > defMul) defMul = dm;
      }
      /* 将领加成 —— v52 走「属性 → 攻防值 → 百分比」这条链（老板给定）：
           1 勇武 = 10 攻击值、每 10 攻击值 = 全军攻击 +1%
           1 智谋 = 10 防御值、每 10 防御值 = 全军防御 +1%
         攻防值里**已经含**装备/套装的 atk/def（genAttrs 统一算），
         所以原来那条 `× (1 + a.atk/10000)` 的旁路必须删掉 —— 留着就是双计。 */
      var atkMult = 1, defMult = 1, cover = 1;
      if (general) {
        var a = GAME.genAttrs(general);
        /* 统率覆盖：统率×100 内士兵吃满加成；统帅能力科技再放宽覆盖范围 */
        var covered = Math.min(cnt, a.tong * 100 * (1 + TB('command')));
        cover = covered / cnt;
        atkMult = 1 + a.atkPct * cover;        // 全军攻击（含装备，见 genAttrs.atkVal）
        defMult = 1 + a.defPct * cover;        // 全军防御（对防守方由调用方传）
      }
      /* 科技 */
      atkMult *= (1 + GAME.systems.techBonus('atk'));
      /* 宝物：陷阵战鼓 */
      if (GAME.systems.buffActive('military') && s.buffs.military.atk) atkMult *= (1 + s.buffs.military.atk);
      /* 名将羁绊 + 当世年号（后台静默加成，界面不提示） */
      if (GAME.story) atkMult *= GAME.story.atkMult();
      /* 远程白嫖：射程远超时首轮伤害加成（模拟"后退射杀"） */
      var dmg = cnt * t.atk * mult * atkMult / defMul;
      /* 抛射技巧：远程射程 +4%/级 */
      var effRange = t.range * (1 + TB('range'));
      if (GAME.story) effRange *= GAME.story.combatMod().archerRange; // 雨天弓兵射程 −20%
      if (isFirst && effRange >= 1200 && rangeRatio(defenderArmy) < 0.3) dmg *= 1.3; // 远程先手优势
      sum += dmg;
    }
    var defRed = defenderDefBonus || 0;
    return sum * Math.max(0.05, 1 - defRed);
  }

  function applyDamage(army, damage, gen) {
    var hp = totalHp(army, gen);
    if (hp <= 0) { clearArmy(army); return army; }
    var lossFraction = Math.min(1, damage / hp);
    for (var id in army) {
      var per = DATA.TROOPS[id];
      if (!per) continue;
      var loss = Math.floor(army[id] * lossFraction);
      army[id] -= loss;
      if (army[id] <= 0) delete army[id];
    }
    return army;
  }
  function clearArmy(army) { for (var id in army) delete army[id]; }

  function logRound(round, aDmg, dDmg, aRemain, dRemain) {
    return '第' + round + '回合：我军造成 ' + Math.floor(aDmg) + ' 伤害，敌军造成 ' + Math.floor(dDmg) + ' 伤害。我军余 ' + aRemain + '，敌军余 ' + dRemain;
  }

  /* 对外只读：行军速度与先手判定（UI 展示与测试断言共用，
     避免测试只能靠「战斗轮数」间接推测，那种测法极易被伤害饱和掩盖） */
  GAME.battle.armySpeedOf = function (army) { return armySpeed(army); };
  GAME.battle.firstStrike = function (atkArmy, defArmy, atkGen, defGen) {
    var a = armySpeed(atkArmy), d = armySpeed(defArmy);
    /* v26（需求 2）：速度是**五维之一**，口径为「求和计算」——
       将领速度有多少点，就直接给全军战斗速度加多少点（线性相加）。
       旧写法是 ×(1 + spd/200) 的乘算，高速度将领被指数放大；
       改成加算后，"每点速度 = 全军速度 +1 点" 这句话才真的成立。 */
    if (atkGen) a += (GAME.genAttrs(atkGen).spd || 0);
    if (defGen) d += (GAME.genAttrs(defGen).spd || 0);
    return a >= d || rangeRatio(atkArmy) > rangeRatio(defArmy) + 0.2;
  };

  /* 下面三个工具原本是本文件私有，v27 起导出给 tactic.js 复用 ——
     避免"两份科技/速度/生命加成公式"各自漂移。 */
  GAME.battle.techOf = TB;
  GAME.battle.spdMult = spdMultOf;
  GAME.battle.hpMult = hpMultOf;

  /* ------------------------------------------------------------
   * 战斗结算入口（v27 · 需求 5）
   * ------------------------------------------------------------
   * 默认走**回合制文字战场**（js/tactic.js）：有战场纵深、有推进、
   * 有逐回合战况，战报里能画出战斗场景。
   * 旧的「整军对拼掷骰」保留为 simulateDice —— 两者签名与返回字段完全一致，
   * 于是出征/行军/伤兵/战报等上层代码一行都不用改。
   * 想回退：state.settings.battleEngine = 'dice'。
   * ------------------------------------------------------------ */
  GAME.battle.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    var s = GAME.state;
    var engine = (s && s.settings && s.settings.battleEngine) || 'tactic';
    if (engine !== 'dice' && GAME.tactic && GAME.tactic.simulate) {
      return GAME.tactic.simulate(atkArmy, atkGen, defArmy, defVal, defGen, opts);
    }
    return GAME.battle.simulateDice(atkArmy, atkGen, defArmy, defVal, defGen, opts);
  };

  /* 模拟战斗（旧引擎：速度先手 + 整军对拼）
   * defVal : 目标「城防值」（县城 40 / 郡 60 / 州 90 / 都 110；野地 0；据点 10+等级×4）
   * defGen : 守将（可空）
   * opts   : { sieging: true } 表示攻城 —— 只有攻城才吃「攻城伤害」加成
   */
  GAME.battle.simulateDice = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    atkArmy = U.deep(atkArmy); defArmy = U.deep(defArmy);
    opts = opts || {};
    /* v28（需求 0）：斥候（nocombat）是侦察兵，两个引擎口径一致 ——
       从战场剔除，因此既不输出也不阵亡。 */
    function stripScouts(a) {
      var o = {};
      for (var k in (a || {})) {
        var t0 = DATA.TROOPS[k];
        if (t0 && t0.nocombat) continue;
        o[k] = a[k];
      }
      return o;
    }
    atkArmy = stripScouts(atkArmy);
    defArmy = stripScouts(defArmy);

    /* 守方防御加成。
       旧写法 min(0.6, defVal × 0.10) 有单位错位：城防值动辄 40~110，
       一乘 0.1 就远超 0.6 上限，导致**县城与都城的城防效果完全相同**，
       城防梯度被彻底抹平。改为 /200 线性：县 0.20 / 郡 0.30 / 州 0.45 / 都 0.55。 */
    var defBonus = Math.min(0.85, (defVal || 0) / 200);
    /* 名将羁绊：守御之力（后台静默）—— 唯一来源 STORY.defMult() */
    if (GAME.story && GAME.story.defMult) defBonus = Math.min(0.9, defBonus + GAME.story.defMult());
    if (defGen) {
      /* v52：守将的防御加成同样走「智谋→防御值→百分比」这条链（含装备/套装防御），
         原来分成 `zm/100` 与 `def/10000` 两笔的地方合成一笔。 */
      var ga = GAME.genAttrs(defGen);
      defBonus = Math.min(0.9, defBonus + ga.defPct);
    }

    /* 攻方自身减伤：防护技巧（科技）+ 装备护甲 —— 在守方反击时生效。
       此前「防护技巧」与装备 def 只在扮演守方时才算，而玩家**只当攻方**，
       等于这两项完全废弃。v52：攻方的防御也走同一条链（含智谋与装备）。 */
    var atkDefBonus = Math.min(0.85, TB('def') + (atkGen ? GAME.genAttrs(atkGen).defPct : 0));

    /* 攻城伤害：羁绊「白衣渡江」+ 赛季国策（青龙·大兴土木 / 景元·大将西征）
       v28（需求 0）：再乘**攻城器械的内建倍率**，并让器械拆城。
       旧引擎保留作回退，但数值口径不能与主引擎（tactic.js）漂移 ——
       否则"切换引擎"等于换了一套规则。 */
    var siegeMult = 1;
    if (opts.sieging && GAME.story && GAME.story.siegeMult) siegeMult = GAME.story.siegeMult();
    var craftN = 0;
    if (opts.sieging) {
      for (var ck in atkArmy) {
        var ct = DATA.TROOPS[ck];
        if (ct && ct.craft && atkArmy[ck] > 0) craftN++;
      }
      craftN = Math.min(3, craftN);
    }
    if (craftN > 0) {
      siegeMult *= (GAME.tactic ? GAME.tactic.CRAFT_SIEGE_MULT : 2.2);
      defBonus *= Math.pow(GAME.tactic ? GAME.tactic.CRAFT_DEF_CUT : 0.8, craftN);
    }

    var aStart = totalCount(atkArmy), dStart = totalCount(defArmy);
    /* v57（老板拍板）：回合上限收到 **30**，与 tactic 引擎的 T.MAX_ROUNDS 取同一口径。
       原版：野战 30 回合，超时双方仍有兵 = 平局。 */
    var log = [], round = 0, maxRounds = 30;
    /* 坐骑速度参与先手判定（报告：赤兔 100 / 绝影 120 / 乌云踏雪 145） */
    var aFirst = GAME.battle.firstStrike(atkArmy, defArmy, atkGen, defGen);

    /* 天时：奇袭窗口 —— 只有**抢到先手**才吃这两个加成
     *   · 大雾 ambush ×2（「斥候难察敌情，然偷袭伤害 ×2」）
     *   · 大风 fire ×3（「风急天高：火攻威力 ×3」），需带火器（器械/远程）
     *   · 雨雪 fire = 0（「火攻失效」）
     * 此前这两项在 WEATHERS 里声明，却没有任何战斗读取点。 */
    var firstMul = 1;
    var hasFireUnit = false;
    for (var fu in atkArmy) {
      var ft = DATA.TROOPS[fu];
      if (ft && atkArmy[fu] > 0 && (ft.craft || ft.range >= 1000)) { hasFireUnit = true; break; }
    }
    if (aFirst && GAME.story && GAME.story.combatMod) {
      var cmW = GAME.story.combatMod();
      if (cmW.ambush > 1) firstMul *= cmW.ambush;
      if (cmW.fire > 1 && hasFireUnit) firstMul *= cmW.fire;
    }

    if (aFirst) {
      /* 攻方先手一轮 */
      var pre = damageOf(atkArmy, defArmy, atkGen, defBonus, true) * siegeMult * firstMul;
      applyDamage(defArmy, pre, defGen);
      if (totalCount(defArmy) <= 0) log.push('先手远程打击：敌军全灭！');
    }

    while (totalCount(atkArmy) > 0 && totalCount(defArmy) > 0 && round < maxRounds) {
      round++;
      var aDmg = damageOf(atkArmy, defArmy, atkGen, defBonus, round === 1) * siegeMult
        * ((round === 1 && aFirst) ? firstMul : 1);
      applyDamage(defArmy, aDmg, defGen);
      if (totalCount(defArmy) <= 0) break;
      var dDmg = damageOf(defArmy, atkArmy, null, atkDefBonus, false);
      applyDamage(atkArmy, dDmg, atkGen);
      log.push(logRound(round, aDmg, dDmg, totalCount(atkArmy), totalCount(defArmy)));
    }

    var aRemain = totalCount(atkArmy), dRemain = totalCount(defArmy);
    var winner;
    if (dRemain <= 0 && aRemain > 0) winner = 'atk';
    else if (aRemain <= 0 && dRemain > 0) winner = 'def';
    else if (aRemain > 0 && dRemain > 0) {
      winner = (aRemain / aStart) > (dRemain / dStart) ? 'atk' : 'def';
    } else winner = 'def';

    return {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,
      atkRemain: aRemain, defRemain: dRemain,
      rounds: round, log: log,
    };
  };

  /* --------- 玩家攻击 NPC 城 --------- */
  GAME.battle.attackCity = function (npcCity, atkArmy, genId, modeId) {
    return GAME.battle.expedition({ kind: 'city', id: npcCity.id, npc: npcCity }, modeId || 'occupy', atkArmy, genId);
  };

  /* 伤兵营：青囊书30%转伤兵（存伤兵营，花金治疗） */
  GAME.battle.applyWounded = function (lossCount) {
    var s = GAME.state;
    if (!lossCount || lossCount <= 0) return;
    var rate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    if (GAME.systems.buffActive('military') && s.buffs.military.wound) rate = s.buffs.military.wound;
    /* 维修技术：伤兵回收率 +3%/级 */
    rate = Math.min(0.9, rate * (1 + TB('repair')));
    s.wounded = (s.wounded || 0) + Math.floor(lossCount * rate);
  };

  /* 治疗伤兵 */
  GAME.battle.heal = function (cityId) {
    var s = GAME.state;
    var n = s.wounded || 0;
    if (!n) return { ok: false, msg: '伤兵营为空' };
    var gold = n * 10;
    if ((s.res.gold || 0) < gold) return { ok: false, msg: '黄金不足（需 ' + U.fmt(gold) + '）' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    s.res.gold -= gold;
    /* 真正归队：按兵种把伤兵加回城池。
       此前只是 `s.wounded = 0` 然后把「归队」写进日志 —— 兵没有回来，
       治疗纯粹是一笔没有回报的金币消耗。 */
    var comp = s.woundedArmy || {}, back = 0;
    for (var id in comp) {
      var c = comp[id] || 0;
      if (c <= 0 || !city) continue;
      city.army[id] = (city.army[id] || 0) + c;
      back += c;
    }
    s.wounded = 0;
    s.woundedArmy = {};
    if (back > 0) {
      GAME.log('治疗伤兵 ' + U.fmt(back) + ' 名，已归入 ' + city.name);
      return { ok: true, msg: '治疗伤兵 ' + U.fmt(back) + ' 名归队' };
    }
    /* 无兵种构成记录（历史存档）：无法还原，只能遣散 */
    GAME.log('治疗伤兵 ' + U.fmt(n) + ' 名（无兵种记录，已就地遣散）');
    return { ok: true, msg: '治疗完毕（' + U.fmt(n) + ' 名无兵种记录，已遣散）' };
  };

  /* --------- 攻占处理 ---------
     v60（需求 4/6）：新城**继承该城剩余的库藏** —— 未占据时那份库存是派生的，
     占领就地转正（× cityInherit）。不继承的话，打下一座 9 级州城只能得到一座
     "0 粮 0 金"的空城，与"这城本该有多少"完全脱节。
     fromCity 是**出征的出发城**（战利品记在它头上，资源归属城池）。 */
  GAME.onConquer = function (npcCity, result, gen, fromCity) {
    var s = GAME.state;
    var inherit = GAME.npcCityRes(npcCity);
    var keep = (DATA.EXPEDITION.cityInherit != null) ? DATA.EXPEDITION.cityInherit : 0.8;
    var startRes = {};
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      startRes[k] = Math.round((inherit[k] || 0) * keep);
    });
    startRes.pop = inherit.pop || 0;
    var newCity = GAME.makeCity({
      id: 'conq_' + npcCity.id,
      name: npcCity.name,
      x: npcCity.x, y: npcCity.y,
      type: npcCity.type,                 // v14：保留城档位 → 决定岁贡（都督/州/郡/县）
      state: npcCity.state,               // v14：保留州属 → 决定州特产材料
      res: startRes,                      // v60：继承库藏
    });
    newCity.level = npcCity.level;
    newCity.state = npcCity.state;      // 所属州
    newCity.origId = npcCity.id;        // 原 NPC id
    /* ============================================================
     * v60（需求 6）：**建筑就地转正** —— 未占据城池的设定是"建筑默认全满、
     * 均 N 级"（见 GAME.npcCityShadow），所以攻占一座 9 级城，拿到的就是
     * 一座 9 级满配城 + 城墙 + 满额外城地块。
     * 改前这里把非官府格**全部清空**、只补 2 座 1 级民房 ——
     * 那等于"打下一座名城却得到一片空地"，与"这城本该有什么"完全脱节，
     * 也让刚刚继承来的库藏与人口失去意义（满配建筑才是它们的存在基础）。
     * ============================================================ */
    var sh = GAME.npcCityShadow(npcCity);
    newCity.col = sh.col;                 // ⚠️ col/row 必须跟着 cells 一起换！
    newCity.row = sh.row;                 // 漏了就是"40 格却按 8×6 渲染" → 行列错乱
    newCity.cells = sh.cells.map(function (c) {
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });
    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
    newCity.wallLv = sh.wallLv;
    newCity.def = npcCity.def || 0;
    /* v60（需求 4）：**占领不再另发一次性战利品** ——
       与「占领野地不取财货」同一铁律：城池连同剩余库藏（上面的 startRes）一起归你。
       原先这里还发一份 genLoot，与出征结算里的 cityResMul 是两个出口。
       材料与军械缴获不受影响（那是"城里存着的东西"，与财货不同）。 */
    /* 打造材料：按城池等级掉落 */
    GAME.battle.grantMaterials(DATA.CITY_MATERIAL[npcCity.type] || DATA.CITY_MATERIAL.jun, 1, '缴获物资');
    /* 军械战利品：图纸与成品装备（装备获取途径之一） */
    var eq = GAME.battle.rollEquipLoot(npcCity);
    if (eq.length) GAME.log('缴获军械：' + eq.join('、'));
    s.cities.push(newCity);
    /* 声望（受赛季国策「人心思附」加成） */
    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));
    s.rep += repGain;
    /* 从 NPC 列表移除 */
    var idx = -1;
    for (var i = 0; i < s.map.cities.length; i++) if (s.map.cities[i].id === npcCity.id) { idx = i; break; }
    if (idx >= 0) s.map.cities.splice(idx, 1);
    var tile = GAME.map.tile(newCity.x, newCity.y);
    if (tile) tile.terrain = 'city';
    /* 将领经验（v55 · 与野地战同一个出口）：
       原来写 `rep × 5`（县城 300、洛阳 2000）—— 与野地那套口径互不相干，
       而且比"打一块 10 级野地"还少，攻下名城的战功反而最不值钱。
       现在统一按**实际歼灭的守军资源量**折算，攻名城自然给得比野地多。 */
    if (gen && result && result.defLossBy) {
      var expC = GAME.battle.battleExp(result.defLossBy, gen);
      result.expInfo = GAME.battle.gainExp(gen, expC.gain, '攻占 ' + npcCity.name);
      result.expGain = expC.gain;
      result.expRaw = expC.raw;
      result.expCapped = expC.capped;
    }
    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);
    /* 美人 50% 几率（攻占郡城/州城） */
    if (npcCity.type !== 'capital' && Math.random() < 0.5) GAME.battle.grantBeauty(npcCity);
    GAME.advanceConquer();
    GAME.log('占领新城池：' + npcCity.name + '！（威望 +' + repGain + '）');
    /* 胜利判定：攻占帝都洛阳 → 天下一统（此前该函数定义了却从未被调用） */
    if (GAME.checkVictory) GAME.checkVictory();
  };

  /* 战利品按城类型 */
  GAME.battle.genLoot = function (c, extMul) {
    var tier = (c && c.type) ? c.type : (c && c.dropType) || 'county';
    var mult = { fort: 0.5, county: 0.9, jun: 1, zhou: 3, capital: 8 }[tier] || 1;
    mult *= (extMul == null ? 1 : extMul);
    /* 野外城池按等级浮动 */
    if (tier === 'fort') mult *= (1 + (c.lv || c.level || 1) * 0.12);
    /* 负重技巧：掠夺与采集收获 +5%/级（负重 = 能搬回来多少） */
    mult *= (1 + TB('load'));
    var out = {
      grain: Math.round((20000 + Math.random() * 30000) * mult),
      wood: Math.round((15000 + Math.random() * 25000) * mult),
      stone: Math.round((10000 + Math.random() * 20000) * mult),
      iron: Math.round((8000 + Math.random() * 15000) * mult),
      gold: Math.round((10000 + Math.random() * 20000) * mult),
    };
    /* 珠宝：忠诚管理的补给来源（越高等级城池越多） */
    if (Math.random() < 0.55) {
      var jewels = DATA.ITEMS.filter(function (it) { return it.type === 'jewel'; });
      var jTop = Math.min(jewels.length, mult + 3);
      var j = jewels[Math.floor(Math.random() * jTop)];
      var cnt = 1 + Math.floor(Math.random() * (mult > 2 ? 3 : 1));
      GAME.state.items[j.id] = (GAME.state.items[j.id] || 0) + cnt;
      GAME.log('缴获珠宝：' + j.name + ' ×' + cnt);
    }
    return out;
  };

  /* 打造材料掉落：表 = { matId: [min, max] }，mult 为数量倍率 */
  GAME.battle.grantMaterials = function (table, mult, label) {
    var s = GAME.state;
    if (!table) return [];
    s.items = s.items || {};
    var got = [];
    for (var mid in table) {
      var rng = table[mid], lo = rng[0], hi = rng[1];
      var cnt = Math.round((lo + Math.random() * (hi - lo + 1)) * (mult || 1));
      if (cnt <= 0) continue;
      s.items[mid] = (s.items[mid] || 0) + cnt;
      var m = DATA.MATERIAL_BY_ID[mid];
      got.push((m ? m.name : mid) + '×' + cnt);
    }
    if (got.length && label) GAME.log(label + '：' + got.join('、'));
    return got;
  };

  /* 军械战利品：按城类型掉落「图纸」或「成品装备」 */
  GAME.battle.rollEquipLoot = function (npcCity) {
    if (!npcCity) return [];
    /* 野地：无军械 */
    if (npcCity.kind === 'wild') return [];
    if (npcCity.kind === 'fort') npcCity = { type: 'fort', level: npcCity.lv, name: npcCity.name, x: npcCity.x, y: npcCity.y };
    else if (npcCity.kind === 'city') npcCity = npcCity.npc || npcCity;
    var s = GAME.state;
    var rule = DATA.LOOT_EQUIP[npcCity.type] || DATA.LOOT_EQUIP.jun;
    var got = [];
    /* ① 图纸 */
    if (Math.random() < rule.blueprint) {
      var owned = s.items || {};
      var bps = DATA.BLUEPRINTS.filter(function (b) { return !owned[b.id]; });
      var bp = bps.length ? bps[Math.floor(Math.random() * bps.length)] : DATA.BLUEPRINTS[Math.floor(Math.random() * DATA.BLUEPRINTS.length)];
      s.items[bp.id] = (s.items[bp.id] || 0) + 1;
      got.push(bp.name + '（图纸）');
    }
    /* ② 成品装备（品质随城等级） */
    if (Math.random() < rule.piece) {
      var lo = rule.q[0], hi = rule.q[1];
      var q = lo + Math.floor(Math.random() * (hi - lo + 1));
      var pool = [];
      DATA.CRAFT_SLOTS.forEach(function (sl) { pool.push('cr_' + sl.id + '_' + q); });
      DATA.HEROES.forEach(function (h) { if (h.city === npcCity.name) pool.push('jueying'); });
      var id = pool[Math.floor(Math.random() * pool.length)];
      if (DATA.EQUIP[id]) {
        if (!s.inventory) s.inventory = [];
        s.inventory.push(id);
        got.push(DATA.EQUIP[id].name);
      }
    }
    return got;
  };

  /* 攻占名城 → 镇守名将必定投降 */
  GAME.battle.grantHero = function (npcCity, fromCity) {
    var s = GAME.state;
    /* v64：降将也要有归属城（席位按城算，无主之将会随"当前在看哪座城"飘）。
       取**出征的出发城** —— 谁打下来的就归谁。 */
    var home = fromCity || GAME.currentCity() || (s.cities && s.cities[0]) || null;
    var candidates = DATA.HEROES.filter(function (h) {
      return h.city === npcCity.name || (h.city && (h.x === npcCity.x || Math.abs(h.x - npcCity.x) < 3) && (h.y === npcCity.y || Math.abs(h.y - npcCity.y) < 3));
    });
    if (!candidates.length) return null;
    var h = candidates[Math.floor(Math.random() * candidates.length)];
    /* 已拥有则跳过 */
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].name === h.name) return null;
    var g = GAME.makeHero(h);
    g.loyalty = 60;
    if (home) g.cityId = home.id;
    s.generals.push(g);
    GAME.log('镇守名将 ' + h.name + ' 归降！（攻打城池必降）');
    return g;
  };

  /* 美人 50% */
  GAME.battle.grantBeauty = function (npcCity) {
    var s = GAME.state;
    var owned = {};
    s.generals.forEach(function (g) { owned[g.name] = true; });
    var cands = DATA.BEAUTIES.filter(function (b) { return !owned[b.name]; });
    if (!cands.length) return null;
    var b = cands[Math.floor(Math.random() * cands.length)];
    var g = GAME.makeHero(b);
    g.loyalty = 60;
    s.generals.push(g);
    GAME.log('获得美人 ' + b.name + '！（掠夺/占领野外城池50%几率）');
    return g;
  };

  /* --------- 野地战斗 --------- */
  /* ============================================================
   * 出征三方式（v13）
   *   侦查：不接战，探明虚实 + 顺手物资 + 宝物线索
   *   掠夺：接战但不占，资源/材料/珠宝最丰
   *   占领：接战并据有，得地得城
   * ============================================================ */
  GAME.battle.modeOf = function (id) {
    var arr = (DATA.EXPEDITION && DATA.EXPEDITION.modes) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return arr[arr.length - 1] || { id: 'occupy', name: '占领', stamina: 22, energy: 9, battle: true, occupy: true };
  };

  /* 野地守军 —— v55：**这里的旧实现已删**。
     它按 `20 × 2.4^lv × garrisonMul(0.55)` 公式生成，与真正在用的
     `GAME.wildDefenseAt`（读 `DATA.WILD_DEFENSE` 逐级表）是**同一件事的第二份实现**，
     而且系数还不一样（0.55 下调）。audit 没报出来是因为它只扫 `GAME.x =` 形态、
     不扫 `GAME.battle.x =`。留着就是"改一处忘一处"的种子，删掉。 */

  /* ============================================================
   * 军队资源价值（v55）：把一支部队折算成"资源量"——原版经验规则的计价口径。
   * 原版：**每消灭对方 1000 资源的军队得 1 经验**。
   * 口径 = 兵种建造价（粮+木+石+铁）之和 × 数量。**唯一出口**，
   * 经验换算、战报显示、以后可能的"战功"都读它，不各算一遍。
   * ============================================================ */
  GAME.battle.armyResourceValue = function (army) {
    var total = 0;
    for (var id in (army || {})) {
      var n = army[id];
      if (!n || n <= 0) continue;
      var t = DATA.TROOPS[id];
      if (!t || !t.cost) continue;
      var one = (t.cost.grain || 0) + (t.cost.wood || 0) + (t.cost.stone || 0) + (t.cost.iron || 0);
      total += one * n;
    }
    return Math.round(total);
  };

  /* 战斗经验（v55 · 原版规则；v56 老板拍板收口）——**唯一出口**，野地/攻城/守城都走这里。
     经验 = round(歼灭敌军的资源量 / perResource) × winMul(2)，再封顶到
     「当前升级所需经验 × capPct（80%）」。
     返回 { gain, raw, cap, capped }，capped=true 时战报要说明"已达单场上限"，
     否则玩家会以为哪里算错了。

     ⚠️ v56：**这里只算胜方经验**（原版有 `loseMul` 让败方拿一半）。
     老板拍板「胜方才有经验」，所以我把败方系数与 `won` 参数**一起删了** ——
     留一个恒为 0 的系数就是"假旋钮"（看着可调、实际乘 0），
     比没有更坏；调用方（败方分支）也一并不再调用本函数。 */
  GAME.battle.battleExp = function (defLossBy, gen) {
    var R = DATA.EXP_RULE || { perResource: 1000, winMul: 2, capPct: 0.8 };
    if (!gen) return { gain: 0, raw: 0, cap: 0, capped: false };
    var val = GAME.battle.armyResourceValue(defLossBy);
    var raw = Math.round(val / R.perResource) * R.winMul;
    var cap = Math.round(GAME.expNeedOf(gen) * R.capPct);
    var gain = Math.max(0, Math.min(raw, cap));
    return { gain: gain, raw: raw, cap: cap, capped: raw > cap, value: val };
  };

  /* 目标解析：野地 / 城池 / 野外城池 */
  GAME.battle.resolveTarget = function (target) {
    var s = GAME.state;
    if (!target) return { ok: false, msg: '未指定目标' };
    if (target.kind === 'wild') {
      var tile = GAME.map.tile(target.x, target.y);
      if (!tile) return { ok: false, msg: '坐标越界' };
      if (tile.terrain === 'city') return { ok: false, msg: '该处为城池，请点击城池出征' };
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(target.x, target.y) : GAME.map.wildLevel(target.x, target.y);
      /* v27（需求 3）：守军改由 wildDefenseAt 按 (坐标, 现实日) 确定性生成 ——
         同一天内"侦查看到的"与"打起来遇到的"必然是同一支军队。
         守将一并带出：野地也可能有将，有将就真的吃将领加成。 */
      var wd = GAME.wildDefenseAt(target.x, target.y, lv);
      return { ok: true, kind: 'wild', x: target.x, y: target.y, lv: lv,
        name: (DATA.TERRAIN[tile.terrain] ? DATA.TERRAIN[tile.terrain].name : '野地') + ' Lv' + lv,
        terrain: tile.terrain, garrison: wd.army, guard: wd.gen, def: 0, defDay: wd.day };
    }
    if (target.kind === 'fort' && GAME.map.fortAt) {
      var f = GAME.map.fortAt(target.x, target.y);
      if (!f) return { ok: false, msg: '此处并无野外城池' };
      var fg = GAME.map.fortGarrison(f.level);
      /* v61（老板）：「野地里的城池，应默认其建筑全都建满了」——
         布局由 GAME.fortPlanOf 派生（所有建筑各 1 座 · 军营 2 座 · 余为民房 · 位置固定），
         城防走唯一出口 GAME.fortDefOf（原来写死在这行里）。 */
      return { ok: true, kind: 'fort', x: f.x, y: f.y, lv: f.level, name: f.name + '（野外城池 Lv' + f.level + '）',
        fort: f, garrison: fg, def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),
        cityType: 'fort', dropType: 'fort' };
    }
    if (target.kind === 'city') {
      var npc = target.npc || null;   // 允许直接传入城池对象（测试/临时目标）
      if (!npc) (s.map.cities || []).forEach(function (c) { if (c.id === target.id) npc = c; });
      if (!npc) return { ok: false, msg: '目标城池不存在（可能已被攻占）' };
      /* v60（需求 6）：未占据城池**有守将** —— 由 GAME.npcCityGuard 按城 id 确定性
         派生（老板：「均有守将，为守将六维进行随机设定（避免存储，在接触时生成即可）」）。
         同一座城每次读到的是同一个人，且它的六维会真的参与战斗（守方将领加成）。 */
      var ng = GAME.npcCityGuard(npc);
      return { ok: true, kind: 'city', id: npc.id, lv: npc.level, name: npc.name,
        npc: npc, garrison: npc.garrison, def: npc.def, guard: ng,
        cityType: npc.type, dropType: GAME.battle.dropTierOf(npc) };
    }
    return { ok: false, msg: '未知目标类型' };
  };

  /* 掉落档位：野外城池 / 系统城池（县城、郡城）/ 名城（州城、都城） */
  GAME.battle.dropTierOf = function (npc) {
    if (!npc) return 'county';
    if (npc.type === 'capital' || npc.type === 'zhou') return npc.type;
    if (npc.type === 'fort') return 'fort';
    return npc.type;
  };

  /* ------------------------------------------------------------
   * 侦查情报分层（v65 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「不同侦察技巧等级应该可以侦察出**不同类型**的信息，比如，
   *   资源数量，兵种数量，将领名称属性，建筑等级和数量，可获得的宝物/特产等」
   *
   * 分层表在 `DATA.SCOUT_INTEL`（数据驱动，改表就是改分层，不碰这里）。
   * 唯一出口 `intelTiersOf()`：战斗侧与界面都读它 ——
   *   「哪几层已解锁 / 下一层还差几级」只在一个地方算，别处不要再各判一遍。
   * 大雾天：情报**整体降级**（既有设定保留），已解锁的也看不准。
   * ⚠️ 顺手拾获（材料/宝物）**不受分层影响** —— 那是"顺手拿到的"，不是"看出来的"。
   * ------------------------------------------------------------ */
  GAME.battle.intelTiersOf = function () {
    var lv = (GAME.systems && GAME.systems.techLevel) ? GAME.systems.techLevel('zhencha') : 0;
    var list = (DATA.SCOUT_INTEL || []).map(function (t) {
      return { id: t.id, name: t.name, unlock: t.unlock, hint: t.hint, unlocked: lv >= t.unlock };
    });
    var got = {}, next = null;
    list.forEach(function (t) {
      got[t.id] = t.unlocked;
      if (!next && !t.unlocked) next = t;
    });
    return { lv: lv, list: list, got: got, next: next };
  };

  /* 目标城的**资源数量**情报（层 ②）。
     城池（未占据名城）报它的库藏；据点没有库藏（掠夺所得是"打下来才有"的），
     所以报**掠夺可得**的量 —— 两者都回答"这里有多少东西"。 */
  GAME.battle.resReportOf = function (t) {
    if (!t) return null;
    if (t.kind === 'city' && t.npc && GAME.npcCityRes) {
      var R = GAME.npcCityRes(t.npc), rows = [];
      (DATA.RESOURCES || []).forEach(function (m) {
        if (R[m.key] == null) return;
        rows.push({ name: m.name, v: Math.round(R[m.key]) });
      });
      rows.push({ name: '人口', v: Math.round(R.pop || 0) });
      return { kind: 'store', title: '城内库藏（占领后尽归我有）', rows: rows };
    }
    if (t.kind === 'fort' && GAME.battle.genLoot) {
      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.wildResMul && DATA.EXPEDITION.wildResMul.raid) || 1.2;
      var loot = GAME.battle.genLoot(t, mul), rows2 = [];
      (DATA.RESOURCES || []).forEach(function (m) {
        if (loot[m.key] == null) return;
        rows2.push({ name: m.name, v: Math.round(loot[m.key]) });
      });
      return { kind: 'loot', title: '掠夺可得（一支部队一次的量）', rows: rows2 };
    }
    return null;
  };

  /* 目标城的**建筑与工事**情报（层 ⑤）。
     数据源与"满配布局"同一套（`GAME.planSummaryOf` / `GAME.fortPlanOf`），
     所以面板里报的建筑清单 = 打下来真正拿到的那一套 —— 不会两处对不上。 */
  GAME.battle.buildReportOf = function (t) {
    if (!t) return null;
    var summary = null, buildLv = 1, wallLv = 0, def = t.def || 0, towers = 0;
    if (t.kind === 'city' && t.npc) {
      buildLv = GAME.npcBuildLvOf(t.npc);
      summary = GAME.planSummaryOf(t.npc.level, buildLv);
      var sh = GAME.npcCityShadow(t.npc);
      wallLv = GAME.buildingLevel(sh, 'chengqiang') || buildLv;
      def = GAME.cityDefense(sh);
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
    } else if (t.kind === 'fort' && t.fort && GAME.fortPlanOf) {
      var fp = GAME.fortPlanOf(t.fort);
      summary = { plan: fp, items: fp.items, total: fp.total, minfang: fp.minfang };
      buildLv = fp.buildLv; wallLv = fp.wallLv; def = fp.def;
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
    } else {
      return null;         // 野地没有建筑
    }
    return {
      col: summary.plan.col, row: summary.plan.row, total: summary.total,
      buildLv: buildLv, wallLv: wallLv, def: def, towers: towers,
      items: summary.items || [], minfang: summary.minfang || 0,
    };
  };

  /* ------------------------------------------------------------
   * 侦查（v27 · 需求 3 → v65 分层）
   * ------------------------------------------------------------
   * v27 改前：守军数字只能"约 N 名"，兵种要侦察技巧 ≥3 才看得见，
   *   宝物与产地完全看不到 —— 玩家只能靠试。
   * v27 改后：一次侦查给全六项（总数/兵种/守将/宝物/可采/类型）。
   * v65（老板）：**改回按等级分层解锁** —— 全给等于这条科技没有成长感。
   *   已解锁的层给**准确值**（同日同地多次侦查结果一致）；
   *   未解锁的层给 `null`，界面显示"侦察技巧 Lv N 可查"。
   * 侦察技巧的另一半作用（顺手所得的数量与品质）始终生效，不受分层影响。
   * ------------------------------------------------------------ */
  GAME.battle.scoutTarget = function (t, gen) {
    var s = GAME.state, out = { gNum: 0, kinds: [], loot: [], detail: {} };
    var tiers = GAME.battle.intelTiersOf();
    var got = tiers.got;
    out.intel = tiers;
    /* 天气：大雾斥候难察 —— 情报整体降级（已解锁的也看不准），且不拾获 */
    var cmW = null;
    if (GAME.story && GAME.story.combatMod) cmW = GAME.story.combatMod();
    var blinded = !!(cmW && cmW.scout === false);
    out.detail.blinded = blinded;
    var g = t.garrison || {};
    var gAll = 0;
    for (var k in g) gAll += g[k] || 0;
    var techLv = tiers.lv;
    out.detail.techLv = techLv;
    /* 层 ① 守军总数：解锁后是准确数；未解锁只报"约"（仍给个数，不至于两眼一抹黑） */
    var exactTotal = !!got.total && !blinded;
    out.totalExact = exactTotal;
    out.gNum = exactTotal ? gAll : Math.round(gAll * 0.8);
    /* 层 ③ 兵种编制 */
    var roster = [];
    Object.keys(g).forEach(function (id) {
      if ((g[id] || 0) <= 0) return;
      var tt = DATA.TROOPS[id];
      roster.push({ id: id, name: tt ? tt.name : id, n: g[id] });
    });
    roster.sort(function (a2, b2) { return b2.n - a2.n; });
    var showRoster = !!got.troops && !blinded;
    out.roster = showRoster ? roster : [];
    /* 层 ④ 守将名册 */
    out.guard = (got.guard && !blinded) ? (t.guard || null) : null;
    /* 层 ② 资源数量 / 层 ⑤ 建筑工事 */
    out.res = (got.res && !blinded) ? GAME.battle.resReportOf(t) : null;
    out.build = (got.build && !blinded) ? GAME.battle.buildReportOf(t) : null;
    out.detail.kinds = !!got.troops && !blinded;
    out.detail.wall = (t.kind === 'city' || t.kind === 'fort');
    out.detail.gen = !!got.guard && !blinded;
    out.detail.roster = showRoster;
    out.detail.lv = techLv;
    /* 顺手采集：按目标类型给少量材料（侦察技巧提升拾获率与数量；大雾则一无所获）
       ⚠️ 这一段**不看分层** —— 拾获是"顺手拿到的"，谁都能顺手，只是看得多的人才看得细。 */
    var tbl = blinded ? null : (t.kind === 'wild' ? DATA.WILD_MATERIAL[t.terrain] : DATA.CITY_MATERIAL[t.dropType || 'county']);
    if (tbl) {
      var ids = Object.keys(tbl);
      var scBonus = 1 + TB('scout');
      var take = 1 + Math.floor(Math.random() * 2 * scBonus);
      for (var i = 0; i < Math.min(take, ids.length); i++) {
        var mid = ids[Math.floor(Math.random() * ids.length)];
        var cnt = Math.max(1, Math.round((tbl[mid][0] + Math.random() * 2) * (DATA.EXPEDITION.wildMatMul.scout || 0.35) * scBonus));
        s.items = s.items || {};
        s.items[mid] = (s.items[mid] || 0) + cnt;
        out.loot.push((DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid) + '×' + cnt);
      }
    }
    /* 宝物线索：低概率直接获得一件小宝物（侦察技巧提升概率） */
    if (Math.random() < 0.18 * (1 + TB('scout'))) {
      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint' && it.price <= 40;
      });
      if (pool.length) {
        var got2 = pool[Math.floor(Math.random() * pool.length)];
        s.items[got2.id] = (s.items[got2.id] || 0) + 1;
        out.treasure = got2.name;
      }
    }
    /* 层 ⑥ 可图之利（珠宝/材料/军械/可采资源/产量加成） */
    var ter = t.terrain || null;
    var matTbl = (t.kind === 'wild')
      ? (DATA.WILD_MATERIAL[ter] || {})
      : (DATA.CITY_MATERIAL[t.dropType || 'county'] || {});
    var matNames = Object.keys(matTbl).map(function (mid) {
      return DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid;
    });
    var jewels = (DATA.ITEMS || []).filter(function (it) { return it.type === 'jewel'; });
    var jewTop = Math.min(jewels.length, t.kind === 'wild' ? 4 : Math.max(1, t.lv || 1));
    var showSpoils = !!got.spoils && !blinded;
    out.spoils = showSpoils ? {
      /* ④ 掠夺可得宝物 */
      jewels: jewels.slice(0, jewTop).map(function (j) { return j.name; }),
      /* ⑤ 占领后可采资源（地形决定；平地无可采之物） */
      gather: t.kind === 'wild' ? (GAME.gatherResOf(ter) || null) : null,
      gatherName: (t.kind === 'wild' && GAME.gatherResOf(ter))
        ? ((function () {
            var k = GAME.gatherResOf(ter), nm = k;
            DATA.RESOURCES.forEach(function (r) { if (r.key === k) nm = r.name; });
            return nm;
          })()) : null,
      /* 可采资源之外的持续收益：占地的产量加成 */
      terrainBonus: t.kind === 'wild' ? (GAME.wildAddOf(ter, t.lv || 0) || {}) : null,
      /* ⑥ 可获宝物的类型 */
      types: ['珠宝（赏赐将领、提升忠诚）', '材料（打造高阶装备的主料）',
        '军械图纸（打造套装件的必需物）', '成品装备（直接佩戴）'],
      materials: matNames,
      equip: (t.kind === 'fort' || t.kind === 'city') ? '按城池档次掉落图纸与成品装备' : '野地不掉军械',
    } : null;
    return out;
  };

  GAME.battle.prepare = function (target, modeId, atkArmy, genId, opts) {
    opts = opts || {};
    var s = GAME.state;
    var mode = GAME.battle.modeOf(modeId);
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可出兵' };
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    if (!gen) return { ok: false, msg: '请选择出征将领' };

    /* 断粮门槛：军无粮草不出兵（粮草系统此前只有「扣」没有「拦」）。
       仅在「存粮为 0 且消耗大于产出」时拦截，避免临时缺粮就完全动不了。
       放在目标解析**之前** —— 粮尽是对全军状态的判断，与打哪里无关。 */
    if (!opts.arrived && GAME.isStarving && GAME.isStarving()) {
      return { ok: false, msg: '粮尽，士卒饥疲，无法出征 —— 宜增产粮草、掠夺敌粮或裁减军伍' };
    }

    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) return { ok: false, msg: t.msg || '目标无效' };

    /* v63（老板）：「野外城每天只能被掠夺一次」。
       拦在 `prepare` 里 —— 出征的两条路（即时结算 / 行军队列 `march.dispatch`）
       都先过这里，所以才拦得住；写在界面里只是提示，绕过界面就失效。
       ⚠️ 只拦「掠夺」：占领（会把据点打掉、当日不再出现）与侦查不受影响。 */
    if (!opts.arrived && mode.id === 'raid' && t.kind === 'fort'
        && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.x, t.y)) {
      return { ok: false, msg: '此据点今日已被掠夺（每日每处限一次），明日再来' };
    }

    if (!opts.arrived) {
      /* v66：门槛与消耗一律走**池子口径**（GAME.staNow）——
         装备体力进上限后，`gen.stamina` 只是"等级那一份的余量"，
         再拿它比门槛会出现"面板显示体力满、却说过不了门槛"的矛盾。 */
      if (GAME.staNow(gen) < mode.stamina) {
        return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + mode.stamina + '），休整或服止血散' };
      }
      if ((gen.energy || 0) < mode.energy) {
        return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + mode.energy + '），可服清心丸' };
      }
      if (mode.battle) {
        var needPop = 0;
        for (var a in atkArmy) needPop += (DATA.TROOPS[a] ? DATA.TROOPS[a].pop : 1) * atkArmy[a];
        if (!needPop) return { ok: false, msg: '请先派遣兵力' };
        var xc = GAME.buildingLevel(city, 'xiaochang') || 0;
        /* v28（需求 1）：校场满级专精 —— 出征容量 +25% */
        var cap = xc * 10000 * (1 + GAME.mastery('marchCapPct', city));
        if (GAME.story) cap = Math.round(cap * GAME.story.leadMult());
        if (GAME.systems.buffActive('military') && s.buffs.military.cap) cap = Math.round(cap * (1 + s.buffs.military.cap));
        if (cap > 0 && needPop > cap) return { ok: false, msg: '校场容量不足（需 Lv' + Math.ceil(needPop / 10000) + ' 校场）' };
        for (var a2 in atkArmy) {
          if ((city.army[a2] || 0) < atkArmy[a2]) {
            return { ok: false, msg: '兵力不足（' + (DATA.TROOPS[a2] ? DATA.TROOPS[a2].name : a2) + '）' };
          }
        }
      }
    }
    return { ok: true, gen: gen, mode: mode, t: t, city: city };
  };

  /* 出征主入口
   * opts.arrived = true 表示这是「行军队列抵达后」的结算：
   *   体力/精力/断粮/兵力校验与扣除都已在出发时完成，此处只负责打与归还。
   * opts.cityId 指定出发城池（行军结算时城池可能已不是当前视图那座）。 */
  GAME.battle.expedition = function (target, modeId, atkArmy, genId, opts) {
    opts = opts || {};
    var s = GAME.state;
    var p = GAME.battle.prepare(target, modeId, atkArmy, genId, opts);
    if (!p.ok) return p;
    var mode = p.mode, gen = p.gen, city = p.city, t = p.t;

    /* ---- 侦查：不接战 ---- */
    if (!mode.battle) {
      GAME.setStaNow(gen, GAME.staNow(gen) - mode.stamina);   /* v66：走唯一写入口 */
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      var sc = GAME.battle.scoutTarget(t, gen);
      GAME.battle.gainExp(gen, 30, '侦察 ' + t.name);
      GAME.statBump('scouts', 1);
      var gd = sc.guard;
      var itL = sc.intel || { got: {}, lv: 0, next: null };
      /* 日志也按分层：没解锁的项不写"守将：无"（那是误导 —— 不是没有，是看不见），
         改写"未解锁"。 */
      var lines = [sc.totalExact
        ? ('守军 ' + U.numText(sc.gNum, 0) + ' 名')
        : ('守军约 ' + U.numText(sc.gNum, 0) + ' 名（未点验）')];
      (sc.roster || []).forEach(function (x) { lines.push(x.name + ' ' + U.numText(x.n, 0)); });
      if (itL.got.guard) {
        lines.push(gd ? ('守将：' + gd.name + '（' + GAME.rankOf(gd).name + ' Lv' + gd.level + '）') : '守将：无');
      } else {
        lines.push('守将：未探得');
      }
      if (itL.got.build && sc.build) lines.push('城防 ' + sc.build.def + ' · 城墙 Lv' + sc.build.wallLv);
      else if (sc.detail.wall) lines.push('目标城防 ' + (t.def || 0));
      if (itL.next) lines.push('（下一层情报：' + itL.next.name + ' 需侦察技巧 Lv' + itL.next.unlock + '）');
      GAME.log('🔭 侦查 ' + t.name + '：' + lines.join('　'));
      if (sc.loot.length) GAME.log('顺道收取：' + sc.loot.join('、'));
      if (sc.treasure) GAME.log('拾得遗落之物：' + sc.treasure);
      return {
        ok: true, mode: mode.id, result: { winner: 'scout' },
        intel: lines, roster: sc.roster, guard: gd, spoils: sc.spoils,
        /* v65：把**分层状态**一起带出去 —— 面板据此决定显示实值还是锁定行。
           ⚠️ `gNum` 必须一起带（面板的"守军总数"行读它）——
             之前漏了，面板会显示「约 undefined 名」；这个真 bug 是 e2e 抓到的。 */
        intelTiers: sc.intel, totalExact: sc.totalExact, gNum: sc.gNum,
        resReport: sc.res, buildReport: sc.build,
        /* v57：战场纵深改由**双方配兵**算（最远射程 + 199）；
           侦察时守军与随行部队都取到，所以这里能给出真实值。 */
        def: t.def || 0,
        field: (GAME.tactic && GAME.tactic.battlefieldOf)
          ? GAME.tactic.battlefieldOf(atkArmy, sc.garrison || t.garrison || {}, t.def || 0,
              { sieging: t.kind !== 'wild',
                wallLv: (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0 })
          : 2000,
        blinded: !!(sc.detail && sc.detail.blinded),
        loot: sc.loot, treasure: sc.treasure,
        msg: '侦查完成：' + lines[0] + (sc.loot.length ? '，顺手得 ' + sc.loot.join('、') : ''),
      };
    }

    /* ---- 掠夺 / 占领：需带兵（校验已在 prepare 完成，这里只做出征即离城的扣除） ---- */
    if (!opts.arrived) {
      /* 出征即离城：此处扣除，战后由 returnArmy 归还幸存者
         （行军模式下由 GAME.march.dispatch 扣除，抵达结算时 opts.arrived=true 不再重复扣） */
      for (var a3 in atkArmy) city.army[a3] -= atkArmy[a3];
      GAME.setStaNow(gen, GAME.staNow(gen) - mode.stamina);   /* v66：体力收支唯一写入口 */
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
    }

    /* 目标城防。旧写法把**我方城墙等级**加到了敌方防御上（`wallLvl` 取自 GAME.currentCity()），
       等于「自己修墙让敌人更硬」；且因 0.6 封顶而长期看不出问题。此处一并修正 */
    var defBonus = (t.def || 0);
    /* v27（需求 3/5）：守将（野地贼将 / 名城守将）参与战斗 —— 双方将领都要加成 */
    /* v59：把**目标城的城墙等级**传给引擎 —— 箭塔射程要用它
       （照搬原版：箭塔射程 = 基础×(1+抛射) + 基础×(城墙等级×3%) + 100） */
    var tWallLv = (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0;
    var result = GAME.battle.simulate(atkArmy, gen, t.garrison, defBonus, t.guard || null,
      { sieging: t.kind === 'city', kind: t.kind, defName: t.name, wallLv: tWallLv,
        /* v62（老板：「工匠作坊可以造箭塔，箭塔默认参与防守」）：
           守方的箭塔座数走**唯一出口** `GAME.towerCountOf` ——
           它把"城防折出"与"工匠作坊建造"合并成一个数。
           NPC 城没有自建箭塔（`city.towers` 未定义）→ 结果与 v59 完全一致；
           玩家城作为守方时，自己造的箭塔自动上阵（不需要任何指派）。 */
        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null });
    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);
    GAME.statBump(mode.occupy ? 'conquerAttempt' : 'raidCount', 1);

    var gains = { res: null, mats: [], equip: [], hero: null, beauty: null };

    if (win) {
      /* v63（老板）：「野外城每天只能被掠夺一次」——**得手才计数**。
         掠夺失败不占用当天的额度（打不过不算掠夺过；否则一次失手就整天没得打，
         与 `prepare` 的拦截语义要一致：拦的是"已掠夺过"，不是"已尝试过"）。 */
      if (t.kind === 'fort' && mode.id === 'raid' && GAME.map.markFortRaided) {
        GAME.map.markFortRaided(t.x, t.y);
        result.fortRaidDaily = true;
      }
      /* 战利品（v15 按原版铁律重排）：
         · **野地**：掠夺有资源；**占领不给资源** —— 收益在长期加成与采集权
         · **城池**：掠夺厚（1.7×），占领薄（0.8×，因城池本身会持续纳税） */
      var isWild = (t.kind === 'wild');
      var mulTbl = isWild ? (DATA.EXPEDITION.wildResMul || {}) : (DATA.EXPEDITION.cityResMul || {});
      var resMul = mulTbl[mode.id];
      if (resMul == null) resMul = 1;
      if (resMul > 0) {
        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */
        var raidBonus = (mode.id === 'raid') ? (1 + TB('pillage')) : 1;
        /* v60（需求 4/6）：**城池**用该城自己的派生库存做战利品来源
           （"侦查看到的数" = "打完搬回来的数"，一个出口）；
           野地/据点仍走 genLoot 的按档位生成。 */
        var loot = (t.kind === 'city' && t.npc)
          ? GAME.npcLoot(t.npc, mode.id, raidBonus)
          : GAME.battle.genLoot(t, resMul * raidBonus);
        /* v60（需求 4）：战利品归**出征的出发城**（资源归属城池） */
        var lootCity = city || GAME.currentCity();
        var Rloot = GAME.res(lootCity);
        for (var lk in loot) Rloot[lk] = (Rloot[lk] || 0) + loot[lk];
        gains.res = loot;
      } else {
        gains.res = null;
        GAME.log('占领不取财货 —— 掠夺得资源，占领得地盘（回报在此地长久的产量加成与采集权）');
      }

      /* 材料 */
      var matTbl = t.kind === 'wild' ? DATA.WILD_MATERIAL[t.terrain] : DATA.CITY_MATERIAL[t.dropType || 'county'];
      var matMul = t.kind === 'wild'
        ? (DATA.EXPEDITION.wildMatMul[mode.id] || 1)
        : (DATA.EXPEDITION.cityMatMul[mode.id] || 1);
      if (matTbl) gains.mats = GAME.battle.grantMaterials(matTbl, matMul, '缴获材料');

      /* 珠宝（掠夺概率更高；**占领野地不取财货**） */
      var jc = DATA.EXPEDITION.jewelChance[mode.id] || 0;
      if (isWild && mode.occupy) jc = 0;
      if (Math.random() < jc) {
        var jewels = (DATA.ITEMS || []).filter(function (it) { return it.type === 'jewel'; });
        if (jewels.length) {
          var top = Math.min(jewels.length, (t.kind === 'city' || t.kind === 'fort') ? t.lv : 4);
          var j = jewels[Math.floor(Math.random() * Math.max(1, top))];
          var jn = 1 + Math.floor(Math.random() * 2);
          s.items[j.id] = (s.items[j.id] || 0) + jn;
          GAME.log('缴获珠宝：' + j.name + ' ×' + jn);
        }
      }

      /* 军械：掠夺亦可得图纸与成品 */
      var eq = GAME.battle.rollEquipLoot(t);
      if (eq.length) { gains.equip = eq; GAME.log('缴获军械：' + eq.join('、')); }

      /* 占领：据而有之 */
      if (mode.occupy) {
        if (t.kind === 'wild') {
          var limit = GAME.buildingLevel(city, 'guanfu') || 1;
          if ((s.wilds || []).length >= limit) {
            GAME.log('野地数量已达上限（官府' + limit + '级），转为就地取材');
          } else {
            s.wilds = s.wilds || [];
            if (!GAME.map.wildAt(t.x, t.y)) {
              /* v15：记录占领时的等级与日期，此后每现实日 -1 级（见 GAME.decayWilds） */
              s.wilds.push({
                x: t.x, y: t.y, type: t.terrain, level: t.lv,
                levelDay: GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000),
              });
            }
            var _add = GAME.wildAddOf(t.terrain, t.lv) || {};
            var _pct = [];
            for (var _r in _add) _pct.push('+' + Math.round(_add[_r] * 100) + '%');
            GAME.log('占领野地：' + DATA.TERRAIN[t.terrain].name + ' Lv' + t.lv
              + '（产量加成 ' + _pct.join('/') + '，可派军采集）');
            GAME.statBump('wilds', 1);
          }
          var enc = GAME.story ? GAME.story.encounterRoll() : null;
          result.encounter = enc;
        } else if (t.kind === 'fort') {
          GAME.battle.razeFort(t, gen);
        } else {
          GAME.onConquer(t.npc, result, gen, city);
        }
      }

      /* 将领经验（v55 · 原版规则；v56 老板调口径）：
         经验 = 歼灭敌军的资源量 / 1000 × 2（胜方），并封顶到"升级需求的 80%"。
         ⚠️ 口径从"野地等级 × 12"改成"**实际歼灭量**"——这是本质修正：
         原来的线性公式对二次增长的升级需求，到后期是 750~840 场一级（实测）。 */
      var expR = GAME.battle.battleExp(result.defLossBy, gen);
      var exps = GAME.battle.gainExp(gen, expR.gain, mode.name + ' ' + t.name);
      /* 战报里体现经验：否则玩家永远不知道打仗还会涨经验，"经验可操作"就无从谈起 */
      result.expGain = expR.gain;
      result.expInfo = exps;
      result.expRaw = expR.raw;
      result.expCapped = expR.capped;
      result.defValue = expR.value;
    } else {
      /* 战败：**不给经验**（v56 · 老板拍板：「胜方才有经验」）。
         原版是"败方拿一半"，我们收掉了。这不是暗改 —— 战报要写一句
         「战败无功，未获经验」，否则原版过来的玩家会以为经验算漏了。 */
      result.expNone = true;
      /* 战败：伤兵在下方 returnArmy 统一结算（此前这里直接 applyWounded 会重复计数） */
      /* v14.1：忠诚的唯一自然下降途径 —— 出征战败挫伤士气。
         （此前是随时间/民心/欠俸慢慢掉，玩家什么都没做也会掉，体验很差） */
      var lLoss = (DATA.LOYALTY && DATA.LOYALTY.defeatLoss) || 8;
      var lBefore = gen.loyalty == null ? 70 : gen.loyalty;
      gen.loyalty = Math.max(0, lBefore - lLoss);
      GAME.log((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）'
        + '，' + gen.name + ' 忠诚 -' + lLoss + '（现 ' + Math.round(gen.loyalty) + '）');
      if (gen.loyalty < (DATA.LOYALTY.warnAt || 50)) {
        GAME.log('⚠️ ' + gen.name + ' 忠诚已低于 ' + DATA.LOYALTY.warnAt + '，加成减半，宜以珠宝赏赐安抚。');
      }
    }

    /* 归队 —— 「派出去的兵能回来」的唯一路径。
       之前 expedition 扣了兵却从不归还 `result.atkRemain`，伤兵也只是个计数，
       等于每次出征都在凭空蒸发军队、治疗是纯金币消耗。 */
    var returned = { back: {}, wounded: {} };
    if (city) returned = GAME.battle.returnArmy(city, atkArmy, result);
    var backN = 0, woundN = 0;
    for (var bk in returned.back) backN += returned.back[bk];
    for (var wk in returned.wounded) woundN += returned.wounded[wk];
    if (backN > 0 || woundN > 0) {
      GAME.log('班师 ' + (city ? city.name : '') + '：' + U.fmt(backN) + ' 名归营'
        + (woundN > 0 ? '，伤兵 ' + U.fmt(woundN) + ' 入营（可花金治疗归队）' : ''));
    }

    /* v20：战报必须包含**战利品**。
       此前 body 只有伤亡，战利品仅写进系统提示，玩家看战报以为「掠夺胜利什么都没得到」。 */
    var lootLines = [];
    if (gains.res) {
      var _lp = [];
      for (var _rk in gains.res) {
        /* v60：资源中文名走**唯一出口** GAME.resName（原先这里内联了一张表，
           与 DATA.RESOURCES 是两个出口 —— 一改名就两边对不上）。 */
        if (gains.res[_rk] > 0) _lp.push(GAME.resName(_rk) + ' +' + U.numText(gains.res[_rk], 0));
      }
      if (_lp.length) lootLines.push('资财：' + _lp.join('　') + '（已入' +
        ((typeof city !== 'undefined' && city) ? city.name
          : (GAME.currentCity() ? GAME.currentCity().name : '出发城')) + '府库）');
    } else if (win && mode.occupy && t.kind === 'wild') {
      lootLines.push('战果：据而有之（占领不取财货，回报在此地长久的产量加成与采集权）');
    } else if (win && mode.occupy && t.kind === 'city') {
      /* v60（需求 4/6）：攻占的口径变了 —— 不再另发一笔财货，
         而是**城池连同其中的库藏**（该城按等级派生的库存 × cityInherit）一起归我。 */
      lootLines.push('战果：城池易主，其中库藏尽归我有（占领不取现财 —— 财货已在城中）');
    }
    if (gains.mats && gains.mats.length) lootLines.push('材料：' + gains.mats.join('、'));
    if (gains.equip && gains.equip.length) lootLines.push('军械：' + gains.equip.join('、'));
    /* v63（老板）：野外城池每日限掠一次 —— 要么告诉玩家"本日额度已用尽"，
       要么他下次点掠夺被拦下来时会以为"功能坏了"。 */
    if (win && t.kind === 'fort' && mode.id === 'raid') {
      lootLines.push('备注：此据点今日已掠夺，**每日每处限一次**，明日可再来');
    }
    /* v27（需求 4）：战报正文**详细列出兵种损耗** ——
       原先只写"我军损失 3,412"一个总数，玩家无法判断是哪一兵种被打残了。 */
    var lossLines = [];
    var al = GAME.battle.troopLossText(result.atkStartBy, result.atkLossBy);
    var dl = GAME.battle.troopLossText(result.defStartBy, result.defLossBy);
    if (al) lossLines.push('我军 ' + al);
    if (dl) lossLines.push('敌军 ' + dl);
    var report = {
      t: U.now(), type: 'war',
      title: (win ? '胜利' : '战败') + ' · ' + mode.name + ' ' + t.name,
      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (lossLines.length ? '<br>【兵种损耗】' + lossLines.join('<br>') : '')
        /* 正文以 HTML 渲染（其余部分用 <br>），换行必须同格式 */
        + (lootLines.length ? '<br>【战利品】' + lootLines.join('；') : (win ? '<br>【战利品】无' : '')),
      loot: lootLines,
      win: win,
      /* 结构化的兵种损耗（战报详情里那张表直接用，不去解析正文） */
      loss: {
        atkStart: result.atkStartBy || {}, atkLoss: result.atkLossBy || {},
        defStart: result.defStartBy || {}, defLoss: result.defLossBy || {},
      },
      /* v27（需求 5）：战报存一份**精简**战斗场景 ——
         整个 roundsLog 带每支部队的每个动作，会让存档迅速膨胀；
         这里只留条带与逐回合兵力（≤16 帧）。 */
      scene: GAME.battle.compactScene(result),
    };
    s.reports.unshift(report);
    if (s.reports.length > 60) s.reports.pop();
    /* v41（需求 4）：新战报 → 未读 +1，公文菜单图标开始闪黄（进公文页清零） */
    s.repUnread = (s.repUnread || 0) + 1;
    /* v41（需求 4）：新战报 → 未读 +1，公文菜单图标开始闪黄（进公文页清零） */
    s.repUnread = (s.repUnread || 0) + 1;
    return {
      ok: true, mode: mode.id, result: result, target: t, gains: gains,
      msg: (win ? mode.name + '成功：' + t.name : mode.name + '失败：' + t.name),
    };
  };

  /* 战后归队：幸存者按类型同比例回城；阵亡者按回收率折算为伤兵（另记兵种构成，治疗后再归队）
     ------------------------------------------------------------------
     此前**两条路径都没有归还**：
       · expedition 只做了 `city.army[id] -= atkArmy[id]`，`result.atkRemain` 从未加回城池
         → 派 10 万、零损失打一场，回来城内是 0，每次出征都在凭空蒸发军队
       · applyWounded 只累加 `s.wounded` 这个数字，heal() 也只是把它清零
         → 「伤兵归队」是空话，治疗成了一笔没有任何回报的金币消耗
     现在统一在这里归还，并记录伤兵的**兵种构成**（`s.woundedArmy`）。 */
  GAME.battle.returnArmy = function (city, sentArmy, result) {
    var s = GAME.state;
    var aStart = 0;
    for (var id in sentArmy) aStart += sentArmy[id];
    if (!city || !aStart) return { back: {}, wounded: {} };
    var keep = Math.max(0, Math.min(1, (result && result.atkRemain || 0) / aStart));
    var rate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    if (GAME.systems.buffActive('military') && s.buffs.military.wound) rate = s.buffs.military.wound;
    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));
    var back = {}, wounded = {}, wTotal = 0;
    for (var id2 in sentArmy) {
      var n = sentArmy[id2] || 0;
      if (n <= 0) continue;
      var alive = Math.floor(n * keep);
      var dead = n - alive;
      if (alive > 0) { city.army[id2] = (city.army[id2] || 0) + alive; back[id2] = alive; }
      var w = Math.floor(dead * rate);
      if (w > 0) { wounded[id2] = w; wTotal += w; }
    }
    if (wTotal > 0) {
      s.woundedArmy = s.woundedArmy || {};
      for (var id3 in wounded) s.woundedArmy[id3] = (s.woundedArmy[id3] || 0) + wounded[id3];
      s.wounded = (s.wounded || 0) + wTotal;
    }
    return { back: back, wounded: wounded };
  };

  /* 兼容旧接口：默认「占领」 */

  /* 野外城池：击破即计入战功（不转为己方城池，避免城池列表被小据点淹没） */
  GAME.battle.razeFort = function (t, gen) {
    var s = GAME.state;
    GAME.statBump('forts', 1);
    var repF = Math.round((20 + t.lv * 5) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));
    s.rep = (s.rep || 0) + repF;
    if (GAME.map.razeFort) GAME.map.razeFort(t.x, t.y);
    GAME.log('破野外城池 ' + t.name + '（声望 +' + repF + '）');
  };

  /* --------- 经验升级（真实公式：等级²×100） --------- */
  GAME.checkLevelUp = function (gen) {
    var need = GAME.expNeedOf(gen);
    var step = 0, from = gen.level;
    /* v29（需求 2）：**资质决定等级上限**（凡品 60 / 良材 100 / 英杰 140 /
       名世 180 / 天授 240）。到顶后经验继续累积但不再升级 ——
       不扣经验，玩家换一个高资质的将或喂丹药仍有意义。 */
    var capLv = (GAME.genLevelCap ? GAME.genLevelCap(gen) : 999);
    while (gen.exp >= need && gen.level < capLv) {
      gen.exp -= need;
      gen.level += 1;
      step = GAME.applyLevelGrowth(gen);   // 资质决定每级成长（凡品+1 … 天授+8）
      need = GAME.expNeedOf(gen);
      GAME.log('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level + '（四维 +' + step + '）');
    }
    var capped = gen.level >= capLv;
    if (capped && from < capLv) {
      GAME.log('🔒 ' + gen.name + ' 已达资质上限 Lv' + capLv
        + '（' + (GAME.rankOf(gen).name) + '），再多的经验也无法提升');
    }
    return { from: from, to: gen.level, up: gen.level - from, step: step, capped: capped, cap: capLv };
  };

  /* 获取经验的**唯一入口**（v26 · 需求 1）
     ------------------------------------------------------------
     原先三处战斗/侦察各自 `gen.exp += x` 后直接调 checkLevelUp，
     好处是短，坏处是：① 公式散落；② 玩家看不到自己涨了多少经验。
     现在统一从这里进，并把「+N 经验（当前/所需）」写进公文，
     让经验从"背后悄悄涨的数字"变成看得见、可操作的东西。 */
  GAME.battle.gainExp = function (gen, amount, why) {
    amount = Math.max(0, Math.round(amount || 0));
    if (!gen || amount <= 0) return null;
    gen.exp = (gen.exp || 0) + amount;
    var r = GAME.checkLevelUp(gen);
    var need = GAME.expNeedOf(gen);
    GAME.log('📗 ' + gen.name + ' 经验 +' + U.numText(amount, 0)
      + (why ? '（' + why + '）' : '')
      + '　当前 Lv' + gen.level + ' ' + U.numText(gen.exp, 0) + ' / ' + U.numText(need, 0));
    return { gain: amount, level: gen.level, up: r.up, exp: gen.exp, need: need, from: r.from };
  };

  /* 兵种损耗文本（v27 · 需求 4）：兵种 初始 → 剩余（损 N） */
  GAME.battle.troopLossText = function (startBy, lossBy) {
    var parts = [];
    Object.keys(lossBy || {}).forEach(function (id) {
      var t = DATA.TROOPS[id];
      var st = (startBy || {})[id] || 0, lost = lossBy[id] || 0;
      if (lost <= 0) return;
      parts.push((t ? t.name : id) + ' ' + U.numText(st, 0) + ' → ' + U.numText(st - lost, 0)
        + '（损 ' + U.numText(lost, 0) + '）');
    });
    return parts.join('　');
  };

  /* 精简战斗场景（供战报存档与详情面板）：条带 ≤16 帧 + 逐回合兵力 */
  GAME.battle.compactScene = function (r) {
    if (!r || r.engine !== 'tactic' || !r.strips || !r.strips.length) return null;
    var n = r.strips.length, idx = [];
    for (var i = 0; i < n; i++) if (i < 14 || i >= n - 2) idx.push(i);
    return {
      field: r.field, rounds: r.rounds,
      rows: idx.map(function (i) {
        var rr = r.roundsLog[i];
        return { r: i + 1, a: rr.a, d: rr.d, gap: rr.gap, s: r.strips[i] };
      }),
      roundsText: r.log,
    };
  };

  GAME.battle.reportText = function (cityName, atkArmy, gen, result) {
    var line1 = '【' + cityName + '】攻城' + (result.winner === 'atk' ? '胜利' : '失败') + '。';
    var line2 = '远征将领：' + (gen ? gen.name : '无') + '。战斗持续 ' + result.rounds + ' 回合。';
    var line3 = '我军损失 ' + result.atkLoss + '，剩余 ' + result.atkRemain + '；敌军损失 ' + result.defLoss + '，剩余 ' + result.defRemain + '。';
    var line4 = '';
    /* v26（需求 1）：经验写进战报正文 —— 这是玩家唯一会认真看战报的地方。
       v55：经验改按"歼灭资源量"折算后，必须把**单场封顶**说明白，
       否则玩家会以为算错了（打大城反而只拿一点点）。
       v56（老板：胜方才有经验）：败方也要写明"未获经验"——
       原版败方是拿一半的，不写一句会被当成 bug。 */
    if (result.expInfo && gen) {
      var ei = result.expInfo;
      line4 = '<br>经验：' + gen.name + ' +' + U.numText(ei.gain, 0)
        + (result.expCapped
          ? '<span style="color:var(--text-dim);">（歼灭 ' + U.numText(result.expRaw || 0, 0)
            + '，已达单场上限 ' + U.numText(ei.gain, 0) + '）</span>'
          : (result.defValue ? '<span style="color:var(--text-dim);">（歼敌值 ' + U.numText(result.defValue, 0) + ' 资源）</span>' : ''))
        + '　Lv' + ei.level + '（' + U.numText(ei.exp, 0) + ' / ' + U.numText(ei.need, 0) + '）'
        + (ei.up > 0 ? '　<b style="color:var(--gold-light);">连升 ' + ei.up + ' 级！</b>' : '');
    } else if (result.expNone && gen) {
      line4 = '<br><span style="color:var(--text-dim);">战败无功，未获经验。</span>';
    }
    return line1 + '<br>' + line2 + '<br>' + line3 + line4;
  };

  /* v60（需求 4）： 已删 —— 战报正文自己拼 lootLines，
     而资源中文名已收口到 GAME.resName。留着一个没人调的函数就是死函数（audit 报过）。 */
  /* ============================================================
   * 行军队列（v18）
   * 出征不再瞬间抵达：按「距离 ÷ 兵种速度」算出行军时长，抵达时才结算。
   * 于是这些东西第一次真正有了意义：
   *   · 速度 spd（取队伍中最慢的兵种 —— 带器械会拖慢全军）
   *   · 驿站（己方城池间提速 1.5~6 倍，按建筑等级）
   *   · 烽火台 10 级（27×27 范围内行军 +50%）
   *   · 天气 move（雨 −20% / 雪 −50% / 雾 −30% / 大风 +10%）
   *   · 行军技巧 / 驾驭技巧 / 车轮技术（按兵种类型分别提速）
   *   · 急行军令（立即完成当前行军）
   * ============================================================ */
  GAME.march = {};

  /* 行军基数：1 格 = 60 游戏秒 ÷ 速度系数（基准速度见 marchBaseSpeed） */
  GAME.march.secPerTile = function () {
    return (DATA.EXPEDITION && DATA.EXPEDITION.marchSecPerTile) || 60;
  };
  /* 再近也要走满 N 现实秒，否则队列一闪而过看不见 */
  GAME.march.minRealSec = function () {
    return (DATA.EXPEDITION && DATA.EXPEDITION.marchMinRealSec) || 2;
  };

  /* 行军耗时（单位：游戏秒，与建造/训练队列口径一致） */
  GAME.march.travelTime = function (from, to, army, secPerTile, gen) {
    var ts = GAME.timeScale();
    var dist = Math.max(Math.abs((from.x || 0) - (to.x || 0)), Math.abs((from.y || 0) - (to.y || 0)));
    if (dist <= 0) dist = 1;
    var fac = GAME.march.speedFactor(army, from, to, gen);
    var gameSec = dist * (secPerTile || GAME.march.secPerTile()) / Math.max(0.05, fac);
    var realSec = Math.max(GAME.march.minRealSec(), gameSec / ts);
    return Math.round(realSec * ts);
  };

  /* 行军速度系数：1.0 = 标准步卒（spd = marchBaseSpeed）、晴、无加成
     v26（需求 2）：主将速度也计入 —— 每 1 点速度 = 全军行军速度 +1 点
     （兵种 spd 量级 100~1000，基准 marchBaseSpeed=300，故 +1 点 ≈ 系数 +1/300）。
     在此之前将领速度只影响战斗先手，对行军毫无作用，是个只显示不生效的死属性。 */
  GAME.march.speedFactor = function (army, from, to, gen) {
    /* ① 最慢兵种决定全军速度（带投石车就别指望跑得快） */
    var slowest = null;
    for (var id in (army || {})) {
      var t = DATA.TROOPS[id];
      if (!t || !(army[id] > 0)) continue;
      var spd = t.spd * spdMultOf(t);          // spdMultOf 已含行军/驾驭/车轮科技
      if (slowest === null || spd < slowest) slowest = spd;
    }
    if (slowest === null) slowest = 100;
    /* DATA.TROOPS 的 spd 在 100~1000 量级，按 marchBaseSpeed(300) 归一 */
    var base = (DATA.EXPEDITION && DATA.EXPEDITION.marchBaseSpeed) || 300;
    var m = slowest / base;

    /* ② 主将速度：求和计算（+1 点 = 全军行军速度 +1 点） */
    var gspd = gen && GAME.genAttrs ? (GAME.genAttrs(gen).spd || 0) : 0;
    if (gspd > 0) m *= (1 + gspd / base);

    /* ③ 天气：雨 −20% / 雪 −50% / 雾 −30% / 大风 +10% */
    if (GAME.story && GAME.story.combatMod) m *= (GAME.story.combatMod().move || 1);

    /* ③ 己方城池的驿站：城池间行军提速 1.5~6 倍 */
    var fc = from && from.cityId ? GAME.cityById(from.cityId) : null;
    if (fc) {
      var yz = GAME.buildingLevel(fc, 'yizhan') || 0;
      var tbl = DATA.BUILDINGS.yizhan && DATA.BUILDINGS.yizhan.speed;
      if (yz > 0 && tbl) m *= (tbl[yz - 1] || 1);
      /* v28（需求 1）：驿站满级专精 —— 行军速度再 ×1.5 */
      if (GAME.mastery && GAME.masteryOf(fc, 'yizhan')) m *= 1.5;

      /* ⑤ 烽火台 10 级：27×27 范围内行军 +50%（半径 13 格）
         v28（需求 1）：满级专精把范围再放 6 格、强度再 +20% */
      var fh = GAME.buildingLevel(fc, 'fenghuotai') || 0;
      var bb = (GAME.mastery && GAME.masteryOf(fc, 'fenghuotai')) ? 0.2 : 0;
      if (fh >= 10 && to) {
        var d = Math.max(Math.abs(fc.x - (to.x || 0)), Math.abs(fc.y - (to.y || 0)));
        if (d <= 13 + bb * 30) m *= (1.5 + bb);
      }
    }
    return m;
  };

  /* 队伍行军速度的“可读”表述（界面展示用） */
  GAME.march.speedText = function (army, from, to, gen) {
    var fac = GAME.march.speedFactor(army, from, to, gen);
    return Math.round(fac * 100) + '%';
  };

  /* 出发：校验 → 扣除 → 入队（真正的结算在抵达时由 tick 触发） */
  GAME.march.dispatch = function (target, modeId, army, genId) {
    var s = GAME.state;
    var p = GAME.battle.prepare(target, modeId, army, genId, {});
    if (!p.ok) return p;
    var city = p.city, gen = p.gen, mode = p.mode, t = p.t;

    for (var a in army) city.army[a] -= army[a];
    GAME.setStaNow(gen, GAME.staNow(gen) - mode.stamina);   /* v66：走唯一写入口 */
    gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
    gen.status = 'march';

    var to = { x: t.x, y: t.y };
    var total = GAME.march.travelTime({ x: city.x, y: city.y, cityId: city.id }, to, army, null, gen);
    s.marches = s.marches || [];
    var m = {
      id: 'mr' + (GAME._marchSeq = (GAME._marchSeq || 0) + 1),
      cityId: city.id, genId: gen.id, modeId: mode.id,
      target: target, tx: t.x, ty: t.y, name: t.name, kind: t.kind,
      army: U.deep(army), elapsed: 0, totalTime: total,
    };
    s.marches.push(m);
    var left = Math.max(0, total / GAME.timeScale());
    GAME.log('🛫 ' + gen.name + ' 率军出发 → ' + t.name + '（' + mode.name
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');
    return {
      ok: true, mode: mode.id, marched: true, march: m,
      msg: '大军已发，约 ' + U.durExact(left) + ' 后抵达 ' + t.name,
    };
  };

  /* 推进（主循环每秒调用）。抵达即结算。 */
  GAME.march.tick = function () {
    var s = GAME.state;
    if (!s || !s.marches || !s.marches.length) return;
    var ts = GAME.timeScale();
    var done = [];
    for (var i = 0; i < s.marches.length; i++) {
      var m = s.marches[i];
      m.elapsed += ts;                       // 本 tick 折合的游戏秒
      if (m.elapsed >= m.totalTime) done.push(m);
    }
    if (!done.length) return;
    s.marches = s.marches.filter(function (x) { return done.indexOf(x) < 0; });
    done.forEach(function (m) { GAME.march.arrive(m); });
  };

  /* 抵达结算：调用与即时出征同一套核心（opts.arrived 跳过校验与扣除） */
  GAME.march.arrive = function (m) {
    var s = GAME.state;
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    var city = GAME.cityById(m.cityId);
    if (!gen) {
      /* 将领已不在（解雇/离去）：兵力原路退回，避免凭空消失 */
      if (city) for (var a in m.army) city.army[a] = (city.army[a] || 0) + m.army[a];
      GAME.log('⚠️ 行军中断：' + m.name + ' 方向的主将已不在，大军折返 ' + ((city && city.name) || ''));
      return null;
    }
    var r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
      { arrived: true, cityId: m.cityId });
    if (gen.status === 'march') gen.status = 'idle';
    if (r && r.result && r.result.winner === 'scout') {
      GAME.log('🔭 ' + gen.name + ' 侦察归来：' + m.name);
    }
    if (GAME.onMarchArrive) GAME.onMarchArrive(m, r);
    return r;
  };

  /* 急行军令：立即完成全部行军 */
  GAME.march.rushAll = function () {
    var s = GAME.state;
    var list = (s.marches || []).slice();
    if (!list.length) return { ok: false, msg: '当前没有行军队列' };
    s.marches = [];
    list.forEach(function (m) { GAME.march.arrive(m); });
    return { ok: true, msg: '急行军令：' + list.length + ' 支大军即刻抵达' };
  };

  /* 撤回：兵力原路返还（无收益） */
  GAME.march.recall = function (id) {
    var s = GAME.state;
    var m = null;
    (s.marches || []).forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return { ok: false, msg: '该行军已结束' };
    var city = GAME.cityById(m.cityId);
    s.marches = s.marches.filter(function (x) { return x.id !== id; });
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    if (gen && gen.status === 'march') gen.status = 'idle';
    if (city) {
      for (var a in m.army) city.army[a] = (city.army[a] || 0) + m.army[a];
      GAME.log('↩️ ' + m.name + ' 方向的大军已召回（兵力已归 ' + city.name + '）');
    }
    return { ok: true, msg: '已召回，兵力归城' };
  };

  /* 行军进度（界面用） */
  GAME.march.progressOf = function (m) {
    var pct = Math.min(100, Math.floor((m.elapsed || 0) / (m.totalTime || 1) * 100));
    var left = Math.max(0, ((m.totalTime || 0) - (m.elapsed || 0)) / GAME.timeScale());
    return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
  };
})();
