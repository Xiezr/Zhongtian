/* ============================================================
 * battle.js  回合制战斗（真实数值版）
 * 速度先手、远程射程优势、将领四维加成、科技/宝物加成、伤兵营
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  GAME.battle = {};

  /* v89.86（整改 P-25）：行军队列抵达结算的「军账守恒」标记 ——
     dispatch 时兵力已扣离本城；此后无论结算成功、目标熄灭还是中途异常，
     兵力都必须有去向（归城 / 驻军 / 伤兵营）。
     `GAME.march.arrive` 在结算前置 false；`GAME.battle.expedition` 在归还点置 true；
     arrive 的失败兜底读它决定是否把兵原路退回（防双重回补）。
     全链路同步执行，不存在跨帧残留。 */
  var _expArmySettled = true;

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
      /* 将领加成 —— v52 链、v89.96 改双刻度（唯一原子见 domain.js atkPctOf）：
           勇武：每 20 点 → 全军攻击 +1%（无上限属性，单独降率）
           装备：每 10 攻击值 → 全军攻击 +1%（v52 口径，有天花板）
           genAttrs.atkPct 是**唯一换算原子**，UI / 战报 / 战斗引擎三处同源；
           旧 `× (1 + a.atk/10000)` 旁路与 tactic 侧的"装备绝对值加法"均已清除。 */
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
      /* 门派被动（v89.86 · 青锋阁「部队攻击 +6%」）—— 与科技/宝物/羁绊同链相乘 */
      if (GAME.sectBonus) atkMult *= (1 + GAME.sectBonus('atkPct'));
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
    /* 门派被动（v89.86 · 虎啸营「攻城伤害 +8%」）—— 仅攻城生效 */
    if (opts.sieging && GAME.sectBonus) siegeMult *= (1 + GAME.sectBonus('siegePct'));
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
  /* 治疗费**唯一出口**（伤兵 × 10 金）—— 弹窗、自动治疗、断言共读这一处（v89.115 抽取，
     此前"n * 10"在 battle.heal 与 ui.woundedBlock 各写一份）。 */
  GAME.healFeeOf = function (n) { return Math.max(0, Math.floor(n || 0)) * 10; };
  GAME.battle.heal = function (cityId) {
    var s = GAME.state;
    var n = s.wounded || 0;
    if (!n) return { ok: false, msg: '伤兵营为空' };
    var gold = GAME.healFeeOf(n);
    if ((s.res.gold || 0) < gold) return { ok: false, msg: '黄金不足（需 ' + U.fmt(gold) + '）' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    s.res.gold -= gold;
    /* 真正归队：按兵种把伤兵加回城池。
       此前只是 `s.wounded = 0` 然后把「归队」写进日志 —— 兵没有回来，
       治疗纯粹是一笔没有回报的金币消耗。 */
    var comp = s.woundedArmy || {}, back = 0, backBy = {};
    for (var id in comp) {
      var c = comp[id] || 0;
      if (c <= 0 || !city) continue;
      city.army[id] = (city.army[id] || 0) + c;
      back += c;
      backBy[id] = (backBy[id] || 0) + c;      /* v89.116：逐兵种明细（界面要列出来） */
    }
    s.wounded = 0;
    s.woundedArmy = {};
    if (back > 0) {
      GAME.log.war('治疗伤兵 ' + U.fmt(back) + ' 名，已归入 ' + city.name);
      return { ok: true, msg: '治疗伤兵 ' + U.fmt(back) + ' 名归队', back: back, backBy: backBy,
        gold: gold, city: city.name };
    }
    /* 无兵种构成记录（历史存档）：无法还原，只能遣散 */
    GAME.log.war('治疗伤兵 ' + U.fmt(n) + ' 名（无兵种记录，已就地遣散）');
    return { ok: true, msg: '治疗完毕（' + U.fmt(n) + ' 名无兵种记录，已遣散）' };
  };

  /* ============================================================
   * v89.87（老板需求 4）：战斗观战 —— 会话挂起 / 逐回合推进 / 落账重放
   * ------------------------------------------------------------
   * · 玩家出征战斗抵达后不再即时结算：挂起到 `s.battles`（纯数据，随存档走），
   *   由战场界面逐回合指挥（`settings.battleSec` 真实秒/回合，点「完成」提前结算）；
   * · 会话引擎 = `GAME.tactic.begin` 的**确定性**会话（同输入必得同结果），
   *   每回合指令快照进 `history` —— 读档恢复 = 重建会话 + 按 history 重放；
   * · 战斗结束 → `finishBattle` 重入 expedition（opts._result/_sim）走既有落账段；
   * · 无界面时也照常走表（60 秒一回合自动结算）——"后台照常走"（老板拍板）。
   * ============================================================ */
  /* 是否需要玩家指挥（观战）：未显式自动 + 设置开启 */
  GAME.battle._needWatch = function (opts) {
    var s = GAME.state;
    if (opts && opts.auto) return false;
    return !(s && s.settings && s.settings.battleWatch === false);
  };

  /* 建立/重建会话：按 history 重放到当前回合（读档恢复与首建同一路径） */
  GAME.battle._makeEnv = function (rec) {
    var s = GAME.state;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var env = GAME.tactic.begin(rec.atkArmy, gen, rec.sim.scArmy || {}, rec.sim.scVal || 0,
      rec.sim.scGen || null, rec.sim.simOpts || {});
    (rec.history || []).forEach(function (h) {
      for (var tid in (h || {})) env.setCmd('atk', tid, h[tid]);
      env.step();
    });
    return env;
  };

  /* 挂起：保存战斗输入与落账上下文（s.battles 全为纯数据，可随存档往返） */
  GAME.battle._suspendExpedition = function (target, modeId, atkArmy, genId, opts, simIn) {
    var s = GAME.state;
    s.battles = s.battles || [];
    var id = 'bt' + (GAME._battleSeq = (GAME._battleSeq || 0) + 1);
    var rec = {
      id: id, kind: 'expedition', side: 'atk',
      target: U.deep(target), modeId: modeId,
      atkArmy: U.deep(atkArmy), genId: genId,
      cityId: opts.cityId || null, scheme: opts.scheme || null,
      ops: GAME.opsIdOf(opts.ops),                 /* v89.94（E2）：随军战法（落账时读） */
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             /* v89.118：战斗加成快照随挂起会话走（结算与重跑同源） */
             boost: simIn.boost || null },
      round: 0, cnt: (s.settings && s.settings.battleSec) || 60, state: 'live',
      cmd: {}, history: [], snapLast: null, evLast: [], gapLast: null,
      bornAt: U.now(),
    };
    s.battles.push(rec);
    GAME._bsess = GAME._bsess || {};
    GAME._bsess[id] = GAME.battle._makeEnv(rec);
    GAME.log.war('⚔️ 大军已抵 ' + ((rec.target && rec.target.name) || '目标')
      + '，战斗待指挥（每回合 ' + rec.cnt + ' 秒，可点「完成」提前结算）');
    return { ok: true, pending: true, battleId: id, target: rec.target,
             msg: '抵达' + ((rec.target && rec.target.name) || '') + '，战斗待指挥' };
  };

  /* 找记录 */
  GAME.battle._recOf = function (id) {
    var out = null;
    ((GAME.state && GAME.state.battles) || []).forEach(function (b) { if (b.id === id) out = b; });
    return out;
  };

  /* 推进一回合：指令先落会话、快照进 history（重放一致），再 step */
  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var snapCmd = U.deep(rec.cmd || {});
    rec.history.push(snapCmd);
    for (var tid in snapCmd) ses.setCmd('atk', tid, snapCmd[tid]);
    var r = ses.step();
    if (!r) return null;
    rec.round = r.r;
    rec.gapLast = r.gap;
    rec.evLast = r.events || [];
    rec.snapLast = r.snap || null;
    if (r.over) GAME.battle.finishBattle(id);
    return r;
  };

  /* 自动：用当前指令一键跑完（history 逐回合同步，读档重放仍一致） */
  GAME.battle.autoBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var snapCmd = U.deep(rec.cmd || {});
    for (var tid in snapCmd) ses.setCmd('atk', tid, snapCmd[tid]);
    var guard = 0;
    while (!ses.over && guard++ < 200) {
      rec.history.push(U.deep(snapCmd));
      ses.step();
    }
    return GAME.battle.finishBattle(id);
  };

  /* 结束：收尾组装 result → 重入 expedition 落账（_result/_sim）→ 清挂起
     ------------------------------------------------------------
     v89.94（B2 · E1）：落账段拆成 `_settleBattle` —— 「完成」与「主动撤退」
     走**同一段落账**，只在 result 上差一个 retreat 旗标（不复制落账逻辑）。 */
  GAME.battle.finishBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    return GAME.battle._settleBattle(id, ses.finish());
  };

  /* v89.94（B2 · E1）：主动撤退 —— 撤出战斗、带走残部、保留已造成的破防（按半计）。
     与"打完"只有两点不同：① result.retreat=true（破防 ×0.5、战报写明"主动撤退"）；
     ② 不判胜（目标未下 —— 哪怕台上占优，撤了就是没拿下）。 */
  GAME.battle.retreatBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var result = ses.finish();
    result.retreat = true;
    if (result.winner === 'atk') result.winner = 'def';
    return GAME.battle._settleBattle(id, result);
  };

  /* 落账段（finishBattle / retreatBattle 共用） */
  GAME.battle._settleBattle = function (id, result) {
    var s = GAME.state;
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!rec) return null;
    rec.state = 'done';
    /* v89.102（沙盘）：把**逐回合指令**一并带进落账 —— 战报里的沙盘配方要靠它
       重放（否则玩家在战场上改过的动作/目标会丢，重跑跑出另一场仗）。 */
    if (rec.sim && !rec.sim.history) rec.sim.history = U.deep(rec.history || []);
    var resp = null, err = null;
    _expArmySettled = false;
    try {
      resp = GAME.battle.expedition(rec.target, rec.modeId, rec.atkArmy, rec.genId,
        { arrived: true, cityId: rec.cityId, scheme: rec.scheme, ops: rec.ops || 'assault',
          _result: result, _sim: rec.sim });
    } catch (e) { err = e; }
    /* 将领状态收尾（等价 arrive 的 idle 设置） */
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    if (gen && gen.status === 'march') gen.status = 'idle';
    /* 军账兜底（P-25 同口径）：落账异常 / 目标失效 → 折返 */
    if (err || !resp || resp.ok === false) {
      var city = rec.cityId ? GAME.cityById(rec.cityId) : null;
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in rec.atkArmy) city.army[aR] = (city.army[aR] || 0) + rec.atkArmy[aR];
        rolled = true;
      }
      _expArmySettled = true;
      GAME.log.war('⚠️ 战斗结算中止（' + (err ? '异常' : ((resp && resp.msg) || '目标已不存在')) + '）：'
        + (rolled ? '大军折返 ' + city.name : '军账已结'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[finishBattle] 落账异常：', err);
    }
    s.battles = (s.battles || []).filter(function (b) { return b.id !== id; });
    delete GAME._bsess[id];
    GAME._battleJustDone = {
      id: id, ok: !(err || !resp || resp.ok === false),
      winner: result.winner, rounds: result.rounds,
      atkLoss: result.atkLoss, defLoss: result.defLoss,
      resp: resp || null, rolled: !!(err || !resp || resp.ok === false),
    };
    if (GAME.ui && GAME.ui.onBattleDone) GAME.ui.onBattleDone(GAME._battleJustDone);
    /* v89.93（E4）：战斗结果 —— 胜/败两声（反馈层最该有的两秒） */
    if (GAME.sfx) GAME.sfx(result.winner === 'atk' ? 'win' : 'lose');
    return resp;
  };

  /* 主循环倒计时（真实秒）：「后台照常走」——界面关闭也按表推进；
     界面动画播放中（rec.anim）暂停计时。 */
  GAME.battle.tick = function (dt) {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    var sec = (s.settings && s.settings.battleSec) || 60;
    s.battles.slice().forEach(function (rec) {
      if (rec.state !== 'live' || rec.anim) return;
      if (rec.cnt == null) rec.cnt = sec;
      rec.cnt -= (dt || 1);
      if (rec.cnt <= 0) {
        rec.cnt = sec;
        GAME.battle.stepBattle(rec.id);
      }
    });
  };

  /* 读档恢复：重建会话（按 history 重放）——live 战斗继续等指挥 */
  GAME.battle.restoreBattles = function () {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    GAME._bsess = GAME._bsess || {};
    var drop = [];
    s.battles.forEach(function (rec) {
      rec.anim = false;
      if (rec.state !== 'live') { drop.push(rec.id); return; }
      try {
        GAME._bsess[rec.id] = GAME.battle._makeEnv(rec);
      } catch (e) {
        try { GAME.battle.autoBattle(rec.id); } catch (e2) { drop.push(rec.id); }
      }
    });
    if (drop.length) s.battles = s.battles.filter(function (b) { return drop.indexOf(b.id) < 0; });
  };

  /* 待指挥战斗数（军务 / 徽标用） */
  GAME.battle.pendingCount = function () {
    var s = GAME.state;
    if (!s || !s.battles) return 0;
    var n = 0;
    s.battles.forEach(function (b) { if (b.state === 'live') n++; });
    return n;
  };

  /* --------- 攻占处理 ---------
     v60（需求 4/6）：新城**继承该城剩余的库藏** —— 未占据时那份库存是派生的，
     占领就地转正（× cityInherit）。不继承的话，打下一座 9 级州城只能得到一座
     "0 粮 0 金"的空城，与"这城本该有多少"完全脱节。
     fromCity 是**出征的出发城**（战利品记在它头上，资源归属城池）。 */
  /* ============================================================
   * v89.99（老板：「人口不足就开发其他路径」）：**俘获迁民** —— 唯一出口
   * 打胜据点/名城时，按敌军损失比例把溃卒收编为「出征城」的人口。
   * 参数全在 DATA.CAPTIVE（kinds 白名单：野地不俘、小仗不收、有上限）。
   * ============================================================ */
  /* v89.113：`enemyLoss` = 敌军损失的**显式口径**（可选）。
     攻方视角可直接读 result.defLoss；**防御战**里我方是守方、敌军损失在 result.atkLoss ——
     靠 target 自己猜一定会错（这正是"守城没有俘虏/数字对不上"的一类病根）。 */
  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：俘获当场折算成一个**总数**，直接 `pop += gain` 完事 ——
   *   既没有"俘虏营"这个落点，也看不出抓到的是些什么兵。
   * 现在：按**敌军的逐兵种损失表**折算，逐兵种入 `s.captives`（俘虏营）：
   *   · 攻方视角：敌军 = 守方 → `result.defLossBy`
   *   · 守方视角（守城）：敌军 = 攻方 → `result.atkLossBy`
   *   总数仍按 `DATA.CAPTIVE.rate` 折、仍受 `min/cap` 约束（口径不变），
   *   逐兵种分配用"按权重取整 + 余数补最大项"（与 `assignArmy` 同手法，避免取整丢人）。
   * 收编 / 释放由玩家在军务处决定（`GAME.doConscriptCaptives` / `doReleaseCaptives`）。
   * ============================================================ */
  GAME.battle.captiveGain = function (city, result, target, enemyLoss, enemyLossBy) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['wild', 'fort', 'city', 'defense'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = (enemyLoss != null) ? enemyLoss : (result.defLoss || 0);
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.08 : cfg.rate));
    if (gain < (cfg.min == null ? 15 : cfg.min)) return { gain: 0 };
    gain = Math.min(cfg.cap == null ? 500 : cfg.cap, gain);
    /* 逐兵种分配：没有明细（旧档 / 骰子引擎）→ 落一个 'unknown' 桶，
       界面显示"来历不明的一批"，不假装知道兵种。 */
    var by = enemyLossBy || {};
    var keys = [];
    var tot = 0;
    for (var k in by) { var v = Math.max(0, Math.floor(by[k] || 0)); if (v > 0) { keys.push(k); tot += v; } }
    var out = {};
    if (!keys.length) {
      out.unknown = gain;
    } else {
      var used = 0;
      keys.forEach(function (kk) {
        var n = Math.floor(gain * (Math.floor(by[kk]) / tot));
        if (n > 0) { out[kk] = n; used += n; }
      });
      var rest = gain - used;
      if (rest > 0) {                        /* 余数补给损失最大的一项（不丢人） */
        var top = keys[0];
        keys.forEach(function (kk) { if ((by[kk] || 0) > (by[top] || 0)) top = kk; });
        out[top] = (out[top] || 0) + rest;
      }
    }
    var s = GAME.state;
    s.captives = s.captives || {};
    for (var ck in out) s.captives[ck] = (s.captives[ck] || 0) + out[ck];
    return { gain: gain, byType: out, city: city.name };
  };

  /* ---- 俘虏营的两个出口（唯一出口：军务处按钮、探针、测试都走它们）---- */
  GAME.captivesTotalOf = function (camp) {
    var s = GAME.state, t = 0;
    for (var k in (s.captives || {})) t += Math.max(0, s.captives[k] || 0);
    return t;
  };
  /* v89.118（老板「增加的人口数量按俘虏的兵种人口乘以其数量总和，也就是俘虏的总人口」）：
     收编人口口径的**唯一出口** —— Σ(兵种数量 × 该兵种 `pop`)。
     界面按钮文案（campCard）、收编执行、探针与断言都读它，不许各算一份。
     'unknown'（旧档 / 无明细的来路）按 pop=1 计 —— 不假装知道兵种，也不虚增。 */
  GAME.captivePopOf = function (camp) {
    var map = camp || (GAME.state || {}).captives || {};
    var t = 0;
    for (var k in map) {
      var n = Math.max(0, Math.floor(map[k] || 0));
      if (!n) continue;
      var tt = DATA.TROOPS[k];
      t += n * ((tt && tt.pop) || 1);
    }
    return t;
  };
  /* 收编为民：**在收编这一刻**才加人口（老板口径），增量 = 俘虏的总人口（按兵种 pop 折算）。
     旧口径是"人口 += 人头数"，对本作的分兵种俘虏营不成立（弓手/象兵本就占多个人口）。 */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城池' };
    var addPop = GAME.captivePopOf(s.captives);
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + addPop;
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(n) + ' 众为民（按兵种折算人口 +' +
      U.fmt(addPop) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(n) + ' 众为民（人口 +' + U.fmt(addPop) + '）',
      n: n, pop: addPop, city: city.name };
  };
  /* 释放：不添人口，换一点声望（"仁义之师"的实惠，但明显小于收编的收益） */
  GAME.doReleaseCaptives = function () {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var rep = Math.max(1, Math.round(n / 50));
    s.rep = (s.rep || 0) + rep;
    s.captives = {};
    GAME.log.sys('🕊 释放俘虏 ' + U.fmt(n) + ' 众（声望 +' + rep + '）');
    return { ok: true, msg: '释放 ' + U.fmt(n) + ' 众（声望 +' + rep + '）', n: n, rep: rep };
  };

  GAME.onConquer = function (npcCity, result, gen, fromCity) {
    var s = GAME.state;
    /* v89.108（兜底）：领地上限 —— 正常已在 battle.prepare 拦下（发起与抵达各一次），
       此闸只防"绕过 prepare 的路径"，宁可不占也不破上限。 */
    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    if (!_cc108.ok) {
      GAME.log.war('⚠️ ' + npcCity.name + ' 城垣已破，但' + _cc108.msg + ' —— 此城未能纳入版图');
      return { ok: false, msg: _cc108.msg };
    }
    /* v89.95（A1）：**首占名城 → 节钺**（黄金买不到的稀缺资源，见 DATA.JIEYUE）。
       同一座城只算一次（jieyueClaim 幂等）；档位越高的城给得越多。 */
    var _hfCfg = DATA.JIEYUE || { byTier: {} };
    var _hfN = ((_hfCfg.byTier || {})[npcCity.type]) || 0;
    if (_hfN > 0 && GAME.jieyueClaim) {
      GAME.jieyueClaim('city:' + npcCity.id, _hfN, '首占 ' + npcCity.name);
    }
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
    /* v89.79：占城继承的是**档位等级**（12/16/20/24）—— 与 cityLvOf 同值，
       所以占下来的城"城等级 = 官府等级"依然成立。 */
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
    if (eq.length) GAME.log.war('缴获军械：' + eq.join('、'));
    s.cities.push(newCity);
    /* 声望（受赛季国策「人心思附」加成） */
    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1)
      * (1 + GAME.artifactBonusNum('repPct')));   /* v79：传国玉玺 —— 声望获得 +5%/级 */
    s.rep += repGain;
    /* v89.89（老板拍板 · C3）：开疆拓土 → **门派声望**（门派系统规则 §六"占城"来源）。
       一次性按城档发（DATA.SECT_CONQUER_REP），未入派自动拒（sectRepGain 内部守卫）。 */
    var _sg = GAME.sectRepGain ? GAME.sectRepGain('conquer',
      (DATA.SECT_CONQUER_REP || {})[npcCity.type] || 0) : { ok: false };
    if (_sg.ok) {
      GAME.log.war('🎋 门派声望 +' + _sg.gain + '（开疆拓土 · ' + npcCity.name + '）'
        + (_sg.rankUp ? '　🎉 晋升「' + _sg.rankUp + '」' : ''));
    }
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
    /* v79（神器 · 特殊活动）：开疆拓土 → 供奉值大额入账（按城档折算） */
    if (GAME.artGain) {
      GAME.artGain(((DATA.ARTIFACT || {}).capturePts || {})[npcCity.type] || 40, '开疆拓土 · ' + npcCity.name);
    }
    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);
    /* v86：挑拨离间 —— 守将忠诚 ≤25（累计施计 ≥3 次）时，战胜后 50% 倒戈归降。
       种子不用随机数：同一个城同一局结果稳定（照 invasionRoll 先例，
       断言可复现；roll 值仅由城 id 与结果决定）。 */
    (function () {
      if (!GAME.schemeOf || !GAME.schemeMarksOf) return;
      var _tk = 'npc:' + npcCity.id;
      var _n = GAME.schemeMarksOf(_tk, 'tiaobo');
      if (!_n) return;
      var _tsc = GAME.schemeOf('tiaobo');
      var _loy = Math.max(0, 100 - _tsc.eff.loyaltyDrop * _n);
      if (_loy > _tsc.eff.joinAt) return;
      var _roll = GAME.invasionRoll ? GAME.invasionRoll('tj|' + npcCity.id + '|' + _n) : Math.random();
      if (_roll >= _tsc.eff.joinChance) return;
      var _ng = GAME.npcCityInfo ? GAME.npcCityInfo(npcCity).guard : null;
      if (!_ng) return;
      var _gj = GAME.makeHero(_ng, _ng.level);
      _gj.loyalty = 50;
      if (fromCity) _gj.cityId = fromCity.id;
      s.generals.push(_gj);
      GAME.log.war('🕸️ 挑拨离间奏效：守将 ' + _ng.name + ' 倒戈归降，愿效犬马之劳！');
    })();
    /* 美人 50% 几率（攻占郡城/州城） */
    if (npcCity.type !== 'capital' && Math.random() < 0.5) GAME.battle.grantBeauty(npcCity);
    GAME.advanceConquer();
    GAME.log.war('占领新城池：' + npcCity.name + '！（威望 +' + repGain + '）');
    /* v89.93（整改 E5）：**占城演出** —— 核心目标达成，值一张卡（此前只有一行日志） */
    if (GAME.ui && GAME.ui.moment) {
      GAME.ui.moment({
        kind: 'card', icon: '🏯', title: '克城 · ' + npcCity.name,
        /* v89.116：原读 `DATA.CITY_TIER_NAME`（不存在）→ 提示里显示原始英文键。
           真口径 = `GAME.cityTierName`（读 DATA.CITY_TIER，与城池信息面板同源）。 */
        sub: '威望 +' + repGain + '　·　' + (npcCity.state || '') + '　·　'
          + (GAME.cityTierName ? GAME.cityTierName({ type: npcCity.type }) : npcCity.type),
        lines: ['城防已破，府库入我囊中。', '「' + npcCity.name + '」自此易帜，天下侧目。']
      });
      GAME.ui.sfx('rank');
    }
    /* 胜利判定：攻占帝都洛阳 → 天下一统（此前该函数定义了却从未被调用） */
    if (GAME.checkVictory) GAME.checkVictory();
  };

  /* ============================================================
   * v89.115（老板「设计斗将战」）：**斗将战**（将领个人战 · 军队战前）
   * ------------------------------------------------------------
   * · 触发：只在**双方都有将领**时才有得斗（出击打野地/据点/名城 · 我方主将 vs 守将）；
   *   概率 = DATA.DUEL.chance（50%）。敌方无将（如流寇来袭）→ 不触发。
   * · 个人战：逐合比"勇武 ×2 + 统率 + 智谋 ×0.5 + 等级 ×2"（各带确定性抖动），
   *   先占先多者胜（DATA.DUEL.rounds 合）。
   * · 结果：胜者将领**属性 +bonusPct（10%）** —— 以"深拷贝并放大属性"实现，
   *   原件不动 → 天然只是"这一战"；加成经 genAttrs 链（攻/防/统率覆盖/速度）
   *   传导成**全军战斗力**。
   * · 确定性：种子由调用方给（同一个 seed 必得同一结果）—— 观战挂起与沙盘配方
   *   都靠"把结果存进 _sim"来复现，重放绝不重掷（v89.87 会话制的同一原则）。
   * ============================================================ */
  GAME.battle.duelBoostOf = function (g, pct) {
    if (!g) return g;
    var D = DATA.DUEL || {};
    var m = 1 + (pct == null ? (D.bonusPct == null ? 0.10 : D.bonusPct) : pct);
    var out = U.deep(g);
    ['tong', 'yw', 'zm', 'nz', 'spd'].forEach(function (k) {
      out[k] = Math.round((out[k] || 0) * m);
    });
    out._duelBoost = m;                 /* 标记：让战报/断言能看出"这是斗将后的那一份" */
    return out;
  };
  /* 斗将种子（确定性随机源）：同一场战斗一个值 —— 目标坐标 + 现实毫秒 */
  GAME.battle.duelSeedOf = function (target) {
    var t = target || {};
    return (t.x == null ? '-' : t.x) + ',' + (t.y == null ? '-' : t.y) + '@' + U.now();
  };
  /* 掷一次斗将（纯函数：只读两名将领，不落任何状态） */
  GAME.battle.rollDuel = function (atkGen, defGen, seed) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return null;
    var roll = GAME.invasionRoll('duel|' + atkGen.id + '|' + defGen.id + '|' + (seed == null ? 0 : seed));
    var ch = (D.chance == null ? 0.5 : D.chance);
    if (roll >= ch) return { done: false, chance: ch, log: ['二将未及交锋（斗将未触发）'] };
    var pa = GAME.genAttrs ? GAME.genAttrs(atkGen) : atkGen;
    var pb = GAME.genAttrs ? GAME.genAttrs(defGen) : defGen;
    function power(a, g, salt) {
      var v = (a.yw || 0) * 2 + (a.tong || 0) + (a.zm || 0) * 0.5 + (g.level || 1) * 2;
      return v * (0.85 + GAME.invasionRoll('duelp|' + g.id + '|' + salt) * 0.3);
    }
    var rounds = Math.max(1, D.rounds == null ? 3 : D.rounds);
    var wa = 0, wb = 0, log = [];
    for (var i = 1; i <= rounds; i++) {
      if (power(pa, atkGen, i) >= power(pb, defGen, i + 100)) { wa++; log.push('第' + i + '合 ' + atkGen.name + ' 占先'); }
      else { wb++; log.push('第' + i + '合 ' + defGen.name + ' 占先'); }
    }
    var winner = (wa >= wb) ? 'atk' : 'def';
    log.push('斗将 ' + rounds + ' 合，' + (winner === 'atk' ? atkGen.name : defGen.name) + ' 胜（' + wa + ' : ' + wb + '）');
    return { done: true, winner: winner, wa: wa, wb: wb, rounds: rounds,
      winnerName: (winner === 'atk' ? atkGen.name : defGen.name),
      bonusPct: (D.bonusPct == null ? 0.10 : D.bonusPct), log: log };
  };
  /* 出征面板的预告一句（无守将/不适用 → 空串） */
  GAME.battle.duelPreviewOf = function (atkGen, defGen) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return '';
    return '⚔ 斗将：' + U.escape(atkGen.name) + ' vs ' + U.escape(defGen.name) +
      '（战前 ' + Math.round((D.chance == null ? 0.5 : D.chance) * 100) + '% 触发 · 胜者全军 +' +
      Math.round((D.bonusPct == null ? 0.10 : D.bonusPct) * 100) + '%）';
  };

  /* 战利品按城类型 */
  GAME.battle.genLootEx = function (c, extMul, rnd, dry) {
    var tier = (c && c.type) ? c.type
      : (c && c.kind === 'wild' ? 'wild'
      : ((c && c.dropType) || 'county'));
    /* v89.109（老板「10 级野外城池资源量那么少，必有错误」）：三处修正 ——
       ① 据点曲线 1.35 → **2.15**：取证（probe_v89109_fortres.js）——
          旧口径下 Lv10 据点打 22.4 万守军只抢 44 万资源（掠夺/守军 = 1.97），
          而县城同口径是 785 —— 打一场损兵成本就 ≥2000 万（1 万长枪 ≈ 1050 万资源），
          掠夺 44 万 = 血亏 50 倍。新曲线 Lv10 ≈ 3200 万（≈ 阵亡两万兵的成本，保本略赚）。
       ② **野地补等级曲线**：旧口径 Lv1/5/10 掠夺量恒为 12.7 万（tier 落 'county'
          不吃 lv）—— 高级野地白打。补 1.45^(lv-1)。同等级下**据点 > 野地**仍成立
          （Lv8：425 万 vs 172 万）。
       ③ 档位表补 `wild: 0.9` —— tier 判据新增 'wild' 后，若表里没有它就会落
          `|| 1` 兜底，白涨 11%（改判据不能改到不该改的口径）。 */
    var mult = { wild: 0.9, fort: 0.5, county: 0.9, jun: 1, zhou: 3, capital: 8 }[tier] || 1;
    mult *= (extMul == null ? 1 : extMul);
    if (tier === 'fort') mult *= Math.pow(2.15, (c.lv || c.level || 1) - 1);
    if (tier === 'wild') mult *= Math.pow(1.45, (c.lv || c.level || 1) - 1);
    /* 负重技巧：掠夺与采集收获 +5%/级（负重 = 能搬回来多少） */
    mult *= (1 + TB('load'));
    /* v89.114：随机源与落账开关**显式传入**（`rnd` 默认 Math.random）——
       出征面板的"目标估掠"用同一公式取区间中值（rnd 恒 0.5、dry=true 不落账），
       于是"面板看到的量"与"结算搬回来的量"永远同一份公式，不会两处漂移。 */
    var rd = rnd || Math.random;
    var out = {
      grain: Math.round((20000 + rd() * 30000) * mult),
      wood: Math.round((15000 + rd() * 25000) * mult),
      stone: Math.round((10000 + rd() * 20000) * mult),
      iron: Math.round((8000 + rd() * 15000) * mult),
      gold: Math.round((10000 + rd() * 20000) * mult),
    };
    /* 珠宝：忠诚管理的补给来源（越高等级城池越多）。dry（估算）不掷骰、不落账 */
    if (!dry && rd() < 0.55) {
      var jewels = DATA.ITEMS.filter(function (it) { return it.type === 'jewel'; });
      var jTop = Math.min(jewels.length, mult + 3);
      var j = jewels[Math.floor(rd() * jTop)];
      var cnt = 1 + Math.floor(rd() * (mult > 2 ? 3 : 1));
      GAME.state.items[j.id] = (GAME.state.items[j.id] || 0) + cnt;
      GAME.log.war('缴获珠宝：' + j.name + ' ×' + cnt);
    }
    return out;
  };
  /* 正常掷骰生成（原入口，签名不变） */
  GAME.battle.genLoot = function (c, extMul) {
    return GAME.battle.genLootEx(c, extMul, Math.random, false);
  };
  /* 期望口径（不掷骰、不落账）：出征面板「目标估掠」用 —— 只给基准量，
     战时加成（抢掠技巧 / 趁火打劫）因人而异，不进估算。 */
  GAME.battle.lootEstOf = function (c, extMul) {
    return GAME.battle.genLootEx(c, extMul, function () { return 0.5; }, true);
  };

  /* ============================================================
   * v89.109（老板「只有打破城墙并杀死出城迎战的军队，才能进行资源掠夺」）
   * —— **掠夺前置闸，唯一出口**（我方掠夺 NPC 与敌方来掠夺我方，共用这一个判据）
   * ------------------------------------------------------------
   * 判定（看一场战斗的 result）：
   *   ① **破防**：城防工事（箭塔 = 城墙的具象）被拆光，**或**守军被全歼 ——
   *      两者达成其一即算"这座城已经失去抵抗"（无工事的目标视为无墙可破，恒过）；
   *   ② **出城迎战部队被歼灭**：守方若把某些兵种设为出城迎战（sortie），
   *      它们在野战军全部阵亡前挡住攻方（tactic 里连拆墙都被拦），
   *      所以"杀光他们"是破城的一部分；没有出城部队时恒过。
   * ⚠️ 只闸**掠夺资源**（战利品）—— 兵损、经验、材料/军械掉落照旧：
   *    打仗本身的代价与收益不受影响，缺的只是"搬走库藏"这一步。
   * ============================================================ */
  GAME.battle.lootGateOf = function (r, t) {
    if (!r) return { ok: true, msg: '' };
    if (r.engine !== 'tactic') return { ok: true, msg: '' };   /* 骰子引擎（旧口径回退）不受闸 */
    var wallOk = !(r.towerStart > 0) || (r.towerLeft <= 0) || (r.defRemain <= 0);
    var sortieOk = !(r.defSortieStart > 0) || (r.defSortieLeft <= 0);
    if (wallOk && sortieOk) return { ok: true, msg: '' };
    var why = [];
    if (!wallOk) {
      why.push('城墙未破（城防工事余 ' + r.towerLeft + '/' + r.towerStart + '，守军余 '
        + U.numText(r.defRemain, 0) + '）');
    }
    if (!sortieOk) {
      why.push('出城迎战的守军尚未歼灭（余 ' + U.numText(r.defSortieLeft, 0) + '）');
    }
    return { ok: false, msg: '掠夺无功而返：' + why.join('、')
      + ' —— 破墙（打箭塔）或全歼守军后，再来劫掠' };
  };

  /* ============================================================
   * v89.114（老板「为兵种增加负重属性…掠夺返回的物资数量，与军队总负重有关」）
   * —— **掠夺搬运：两个唯一出口**（幸存编制 / 搬运计划）
   * ------------------------------------------------------------
   * 病根：掠夺量一直是"凭空全给" —— 打多少给多少，与带了多少人、多少人活着
   * 回来毫无关系。负重（DATA.TROOPS[].load）只在"随军辎重"一条线上生效。
   *
   * 口径（两条）：
   *   ① **幸存编制**（`survivedArmyOf`）= 逐兵种 floor(编制 × 幸存率)，
   *      幸存率 = `result.atkRemain / 编制总数`（与 `returnArmy` 归队同一把尺，
   *      `returnArmy` 已改为直接调本函数 —— 一个算法、两处消费，不许各算一份）。
   *   ② **搬运计划**（`haulPlanOf`）= 能搬走多少：
   *        cap  = 幸存部队总载重（`cargoCapOf`） − 去程随军辎重（一支部队一份运力）
   *        超载时按同一比例缩放各类战利品（保持结构），余数**留在原处**（下次可再取）。
   *
   * 设计效果（标定见 probe_v89114_load.js）：纯战兵编队可搬同级战利品约 1/4~1/3；
   * 编入 ~1% 辎重车（或 5% 民夫）即可全数搬回 —— "带不带后勤"从此是一道真题。
   * ============================================================ */
  GAME.battle.survivedArmyOf = function (sentArmy, result) {
    var out = {}, aStart = 0, id;
    for (id in (sentArmy || {})) aStart += Math.max(0, Math.floor(sentArmy[id] || 0));
    if (!aStart) return out;
    var keep = Math.max(0, Math.min(1, (result && result.atkRemain || 0) / aStart));
    for (id in sentArmy) {
      var n = Math.floor(sentArmy[id] || 0);
      if (n > 0) out[id] = Math.floor(n * keep);
    }
    return out;
  };
  /* 搬运上限（单一算式）：幸存部队的载重 − 去程已载辎重（下限 0） */
  GAME.battle.haulCapOf = function (o) {
    o = o || {};
    var surv = GAME.battle.survivedArmyOf(o.army || {}, o.result);
    return Math.max(0, GAME.cargoCapOf(surv) - GAME.cargoLoadOf(o.cargo || null));
  };
  /* 一批战利品的**重量**（粮木石铁金同权 1:1，与 cargoLoadOf 同源同口径） */
  GAME.battle.lootWeightOf = function (loot) {
    var w = 0, keys = GAME.TRANSPORT_KEYS || [];
    for (var i = 0; i < keys.length; i++) {
      w += Math.max(0, Math.floor((loot || {})[keys[i]] || 0));
    }
    return w;
  };
  /* 搬运计划（纯函数，不落账）：{ cap, weight, factor, keep, left, kept, lost } */
  GAME.battle.haulPlanOf = function (o) {
    o = o || {};
    var loot = o.loot || {};
    var cap = GAME.battle.haulCapOf(o);
    var wt = GAME.battle.lootWeightOf(loot);
    var factor = wt > 0 ? Math.min(1, cap / wt) : 1;
    var keep = {}, left = {}, kept = 0;
    (GAME.TRANSPORT_KEYS || []).forEach(function (k) {
      var v = Math.max(0, Math.floor(loot[k] || 0));
      var g = Math.floor(v * factor);     /* 逐项 floor → 总量必然 ≤ cap（不会超装） */
      keep[k] = g;
      left[k] = v - g;
      kept += g;
    });
    return { cap: cap, weight: wt, factor: factor, keep: keep, left: left,
      kept: kept, lost: wt - kept };
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
    if (got.length && label) GAME.log.war(label + '：' + got.join('、'));
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
        GAME.addEquip(id);   /* v79：缴获入包走实例唯一出口 */
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
    GAME.log.war('镇守名将 ' + h.name + ' 归降！（攻打城池必降）');
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
    GAME.log.war('获得美人 ' + b.name + '！（掠夺/占领野外城池50%几率）');
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

  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，按「每 12 级一个台阶」给经验打折（唯一出口）。
     · expTierOf：将领等级 → 该吃满的野地等级（1~10；>120 封顶在 10 级野地）
     · expPenaltyOf：野地等级 ≥ 台阶 → 1（吃满）；每差一档 ×decay，地板 minMul
     野地 0 级按 1 级对待（尚未长成的野地不比 1 级更差）。 */
  GAME.battle.expTierOf = function (genLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 10 };
    return Math.min(P.maxLv, Math.max(1, Math.ceil((genLevel || 1) / P.tier)));
  };
  GAME.battle.expPenaltyOf = function (genLevel, wildLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };
    var need = GAME.battle.expTierOf(genLevel);
    var wl = Math.max(1, Math.round(wildLevel || 1));
    if (wl >= need) return { mul: 1, need: need, wl: wl, gap: 0 };
    var gap = need - wl;
    return { mul: Math.max(P.minMul, Math.pow(P.decay, gap)), need: need, wl: wl, gap: gap };
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
    /* v89.87（老板需求 2）：调兵目标 —— 本境自家城池（走行军通道） */
    if (target.kind === 'owncity') {
      var oc = GAME.cityById(target.id);
      if (!oc) return { ok: false, msg: '目标城池不存在' };
      return { ok: true, kind: 'owncity', id: oc.id, x: oc.x, y: oc.y, name: oc.name, city: oc };
    }
    if (target.kind === 'city') {
      var npc = target.npc || null;   // 允许直接传入城池对象（测试/临时目标）
      if (!npc) (s.map.cities || []).forEach(function (c) { if (c.id === target.id) npc = c; });
      if (!npc) return { ok: false, msg: '目标城池不存在（可能已被攻占）' };
      /* v60（需求 6）：未占据城池**有守将** —— 由 GAME.npcCityGuard 按城 id 确定性
         派生（老板：「均有守将，为守将六维进行随机设定（避免存储，在接触时生成即可）」）。
         同一座城每次读到的是同一个人，且它的六维会真的参与战斗（守方将领加成）。 */
      var ng = GAME.npcCityGuard(npc);
      /* v89.115：**坐标带上**（x/y）—— 面板的行军估算 / 军师估算 / 搬运预估都读它；
         此前返回值没有 x/y，按 id 传目标时预估区会整体早退成空白
         （实机诊断：`🛫 目标无坐标，无法估算行军`）。 */
      return { ok: true, kind: 'city', id: npc.id, lv: GAME.cityLvOf(npc), name: npc.name,
        x: npc.x, y: npc.y,
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
      /* v89.76 修 bug：`DATA.RESOURCES` **本身就含 `pop`**，这里原先又补推一行「人口」，
         于是侦查公文里「人口」印了两遍（老板截图：`人口 24.9万　人口 24.9万`）。
         删掉补推那一行 —— 顺序由 `DATA.RESOURCES` 独家决定。 */
      (DATA.RESOURCES || []).forEach(function (m) {
        if (R[m.key] == null) return;
        rows.push({ name: m.name, v: Math.round(R[m.key]) });
      });
      return { kind: 'store', title: '城内库藏（占领后尽归我有）', rows: rows };
    }
    if (t.kind === 'fort' && GAME.battle.genLoot) {
      /* v89.88：口径对齐**实际结算** —— 据点掠夺在 `expedition` 里走
         `cityResMul.raid`（0.5），原先这里读 `wildResMul.raid`（1.2），
         "侦查看到的掠夺可得"比打完拿到的虚报 **2.4 倍**
         （侦查的数 ≠ 打完的数，正是本项目最忌讳的一类不一致）。
         ⚠️ 战时的抢掠技巧 / 计略加成因人而异，这里给的是**基准量**。 */
      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.cityResMul && DATA.EXPEDITION.cityResMul.raid) || 0.5;
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
    /* v89.77：**城外**建筑也要报出来 —— 老板要的是"城**内外**建筑全是 12/16"，
       原先只报城内，他看不到城外那部分，没法确认。 */
    var extN = 0, extLv = 0;
    if (t.kind === 'city' && t.npc) {
      buildLv = GAME.npcBuildLvOf(t.npc);
      summary = GAME.planSummaryOf(GAME.cityLvOf(t.npc), buildLv);
      var sh = GAME.npcCityShadow(t.npc);
      wallLv = GAME.buildingLevel(sh, 'chengqiang') || buildLv;
      def = GAME.cityDefense(sh);
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
      extN = (sh.extGrid || []).length;
      extLv = extN ? (sh.extGrid[0].lv || buildLv) : buildLv;
    } else if (t.kind === 'fort' && t.fort && GAME.fortPlanOf) {
      var fp = GAME.fortPlanOf(t.fort);
      summary = { plan: fp, items: fp.items, total: fp.total, minfang: fp.minfang };
      buildLv = fp.buildLv; wallLv = fp.wallLv; def = fp.def;
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
      extN = GAME.extPlanOf ? GAME.extPlanOf(fp.level).length : 0;
      extLv = fp.buildLv;
    } else {
      return null;         // 野地没有建筑
    }
    return {
      col: summary.plan.col, row: summary.plan.row, total: summary.total,
      buildLv: buildLv, wallLv: wallLv, def: def, towers: towers,
      items: summary.items || [], minfang: summary.minfang || 0,
      extN: extN, extLv: extLv,
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

  /* ============================================================
   * v89.102（老板）：「校场出征应限制总兵力数而不是人口」
   * ------------------------------------------------------------
   * 老板原话：「谁家校场按人口，不是按人数」。
   * 改前口径 = Σ(兵种.pop × 数量)（人口当量）—— 于是同样"一万人马"，
   * 带轻骑（pop 2）比带义兵（pop 1）少吃一半容量，与"校场点兵"的
   * 直觉完全相反（校场点的是**人头**）。
   * 现在：容量 = 校场等级 × 10000（**人马**），再乘三条加成链
   * （满级专精 / 年号 / 军事增益）。
   * ⚠️ 人口仍是**募兵**时的消耗（GAME.train / trainLimitOf 一字不动）——
   *    改的只是"出征这道门"的量纲。
   * 唯一出口：出征校验 / 调兵校验 / 抵达复验 / 界面提示 / 测试全读这里，
   * 不许任何一处再各算一遍（否则又会出现"面板说能出兵、一发兵被拦"）。
   * ============================================================ */
  GAME.battle.MARCH_MEN_PER_LV = 10000;
  /* 总兵力数（人头）—— 出征容量的计量单位 */
  GAME.battle.marchMenOf = function (army) {
    var n = 0;
    for (var id in (army || {})) n += Math.floor(army[id] || 0);
    return n;
  };
  /* 城池的出征容量（人马）。无校场 → 0（= 不设限，见调用处的 `cap > 0` 判据） */
  GAME.battle.marchCapOf = function (city) {
    if (!city) return 0;
    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;
    var cap = xc * GAME.battle.MARCH_MEN_PER_LV * (1 + GAME.mastery('marchCapPct', city));
    if (GAME.story) cap = Math.round(cap * GAME.story.leadMult());
    var s = GAME.state;
    if (GAME.systems.buffActive('military') && s && s.buffs && s.buffs.military.cap) {
      cap = Math.round(cap * (1 + s.buffs.military.cap));
    }
    return cap;
  };
  /* 报错文案用：装得下 `men` 人所需的校场等级（与容量口径同源，不另算） */
  GAME.battle.marchCapLvFor = function (men) {
    return Math.max(1, Math.ceil((men || 0) / GAME.battle.MARCH_MEN_PER_LV));
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
    /* v89.117（老板「城主和守将不能执行出征动作」）：与界面**同一判据**（唯一出口
       GAME.marchBlockOf）—— 界面置灰只是提示，这里才是拦得住的那道闸
       （自动出征 / 脚本 / 老档里的旧配置都会经过 prepare）。 */
    var _mb = GAME.marchBlockOf(gen);
    if (_mb) return { ok: false, msg: gen.name + ' 不可出征：' + _mb };

    /* v89.36（老板「维持军队无需耗粮食」）：断粮门槛随军粮维持一并退役 ——
       军队不再吃粮，出征不再有"粮尽"拦截（缺粮哗变系统同时移出）。 */

    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) return { ok: false, msg: t.msg || '目标无效' };

    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };
    if (mode.id === 'station' && !(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
      return { ok: false, msg: '驻守目标须是已属我方的野地' };
    }
    if (mode.id === 'gather' && !(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
      return { ok: false, msg: '采集目标须是已属我方的野地' };
    }

    /* v89.94（B2 · E2）：战法校验 —— 围困须据点/城池、奇袭须有计略（与界面同一判据） */
    var _opsIssue = GAME.opsConfigIssueOf(opts.ops, t, opts.scheme || null);
    if (_opsIssue) return { ok: false, msg: _opsIssue };

    /* v89.108（老板）：**领地上限** —— 占领城池 / 拔除据点都会产出一座新城，先过这道闸。
       拦在 `prepare` = 出征两条路（即时结算 / 行军队列）都拦得住；
       **抵达时（opts.arrived）同样拦**：出发后若别处先占了城，兵原路折返（军账守恒护栏
       在 march.arrive / _settleBattle 里），不会"白占一座超编城"。 */
    if (mode.occupy && (t.kind === 'city' || t.kind === 'fort')) {
      var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!_cc108.ok) return { ok: false, msg: _cc108.msg };
    }

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
        /* v89.102（老板）：校场容量按**总兵力数（人头）**计 —— 见 marchCapOf 段注释 */
        var needMen = GAME.battle.marchMenOf(atkArmy);
        if (!needMen) return { ok: false, msg: '请先派遣兵力' };
        var cap = GAME.battle.marchCapOf(city);
        if (cap > 0 && needMen > cap) {
          return { ok: false, msg: '校场容量不足（需 Lv' + GAME.battle.marchCapLvFor(needMen) + ' 校场）' };
        }
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

    /* ============================================================
     * v89.87（老板需求 2）：非战斗行动抵达落账 —— 调兵（owncity）/ 采集（gather）
     * ------------------------------------------------------------
     * 两条路径与出征共用同一行军通道（dispatch 出发时已扣兵/体力），
     * 抵达时在此落账。**必须放在侦查判定之前**：两者的 mode.battle 都是
     * false，若按顺序走会被当成侦查结算（探守军、写侦查公文）。
     * · 调兵：抵达入城（再验一次目标城校场，超容则整体折返）；
     * · 采集：调既有 startGather 的 arrived 路径（跳过重复扣减）。
     * ============================================================ */
    if (t.kind === 'owncity') {
      var _to = t.city;
      /* v89.102：调兵容量与出征**同一把尺**（校场等级 × 1 万人马 + 加成链）——
         改前这里只算裸容量（不含专精/年号/增益），比出发时的门更严，
         于是"刚发出的兵，到了自家城门被拦折返"。 */
      var _ocap = GAME.battle.marchCapOf(_to);
      var _np = GAME.battle.marchMenOf(_to.army);
      var _ap = GAME.battle.marchMenOf(atkArmy);
      if (_ocap > 0 && _np + _ap > _ocap) {
        /* 折返（_expArmySettled 保持 false → arrive 兜底原路退回出发城） */
        return { ok: false, msg: _to.name + ' 校场容量不足（途中已满编）' };
      }
      var _mv = 0;
      for (var _ok2 in atkArmy) {
        var _n2 = Math.floor(atkArmy[_ok2] || 0);
        if (_n2 <= 0) continue;
        _to.army[_ok2] = (_to.army[_ok2] || 0) + _n2;
        _mv += _n2;
      }
      gen.cityId = _to.id;                    /* 主将随军入驻新城（城建制） */
      _expArmySettled = true;                 /* 军账已结（兵入新城） */
      /* v89.103（老板「资源运输采用出征界面」）：**随军辎重落账** ——
         与"即时运输"同一套口径（GAME.transportPlanOf / transportApply）：
         距离损耗 + 目的地仓容；装不下的原路退回出发城（不抽损耗）。
         ⚠️ 放在兵力入城之后：军账已结（_expArmySettled=true），
            辎重的增减都是"落账"而不是"回滚"。 */
      var _cg = opts.cargo || null;
      var _cgOut = null;
      if (_cg) {
        _cgOut = GAME.transportCargo(_cg, city, _to);
        if (_cgOut.keys.length) {
          GAME.log.war('🚚 辎重抵 ' + _to.name + '：' + _cgOut.lines.join('；'));
        }
      }
      GAME.log.war('🚚 军队调防：' + U.fmt(_mv) + ' 兵入 ' + _to.name + '（' + gen.name + ' 统带）');
      return { ok: true, mode: mode.id, peaceful: true, target: t, moved: _mv, cargo: _cgOut,
        msg: '已入驻 ' + _to.name + '（+' + U.fmt(_mv) + ' 兵'
          + (_cgOut && _cgOut.keys.length ? ' · 辎重实收 ' + U.fmt(_cgOut.landed) + ' 单位' : '') + '）' };
    }
    if (mode.id === 'gather') {
      var _gr = GAME.startGather(t.x, t.y, gen.id, atkArmy, { arrived: true, cityId: city.id });
      if (_gr.ok) _expArmySettled = true;     /* 兵已移交采集队（军账在采集记录上） */
      return { ok: _gr.ok, mode: 'gather', peaceful: true, target: t, gather: _gr,
        msg: _gr.msg };
    }

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
      /* v89.73（老板：「侦察后形成公文报告，不只是弹窗」）
         ------------------------------------------------------------
         改前侦查结果只活在那个弹窗里 —— 一关就没了，想回头比对"上次看的守军
         是多少"只能再派一次斥候。现在**同时落一份公文**（进公文页可回看）。
         正文按**已解锁的层**写（与弹窗同一口径）：没解锁的写"未探得"，
         而不是写"守将：无" —— 那是误导，不是没有，是看不见。 */
      (function () {
        var rp = [lines.join('<br>')];
        if (sc.loot && sc.loot.length) rp.push('【顺手所得】' + sc.loot.join('、'));
        if (sc.treasure) rp.push('【意外发现】' + sc.treasure);
        rp.push('【情报层级】侦察技巧 Lv' + itL.lv + (itL.next
          ? '　·　下一层：' + itL.next.name + '（还差 ' + (itL.next.unlock - itL.lv) + ' 级）'
          : '　·　六层情报全开'));
        rp.push('【顺手拾获】不受分层影响 —— 任何等级都能捡到。');
        s.reports.unshift({
          t: U.now(), type: 'scout',
          title: '侦查回报 · ' + (sc.totalExact ? '' : '（约略）') + t.name,
          body: rp.join('<br>'),
          loot: (sc.loot || []).slice(), win: true,
          intel: { lv: itL.lv, target: t.name },
          /* ============================================================
           * v89.102（老板）：「侦查报告不要自动冒出来」
           * ------------------------------------------------------------
           * 改前：行军抵达（或即时报捷）后**自动弹**分层面板 —— 玩家正在做别的
           * 事也会被盖住。现在改为**只落公文**（公文菜单图标闪黄提示），
           * 玩家点进公文里这一条，再按「展开侦查面板」看完整分层情报。
           * 为此把面板需要的那几个字段**随公文一起存**（口径与当场一致：
           * 已解锁的层给准确值、未解锁的层显示锁定行）。
           * ============================================================ */
          scout: {
            kind: t.kind, name: t.name,
            intelTiers: sc.intel, totalExact: sc.totalExact, gNum: sc.gNum,
            roster: (sc.roster || []).slice(), guard: gd || null,
            loot: (sc.loot || []).slice(), treasure: sc.treasure || null,
            resReport: sc.res || null, buildReport: sc.build || null,
            def: t.def || 0,
            field: (GAME.tactic && GAME.tactic.battlefieldOf)
              ? GAME.tactic.battlefieldOf(atkArmy, sc.garrison || t.garrison || {}, t.def || 0,
                  { sieging: t.kind !== 'wild',
                    wallLv: (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0 })
              : 2000,
            blinded: !!(sc.detail && sc.detail.blinded),
          },
        });
        /* v89.107：上限走 DATA.REPORT_MAX；挤掉最旧的**未收藏**那份
           （收藏 = 玩家点名要留，不许被上限挤掉 —— 试玩里 436 场只留 60 份时发现的） */
        while (s.reports.length > (DATA.REPORT_MAX || 60)) {
          var _drop = -1;
          for (var _ri = s.reports.length - 1; _ri >= 0; _ri--) {
            if (!s.reports[_ri].fav) { _drop = _ri; break; }
          }
          if (_drop < 0) break;
          s.reports.splice(_drop, 1);
        }
        s.repUnread = (s.repUnread || 0) + 1;      /* 与战报同一套"未读闪黄" */
      })();
      /* v89.86（整改 P-25）：行军队列抵达的侦查 —— dispatch 时随行兵力已扣离本城，
         而侦查不接战，随行者须原路归城（修复前"带兵侦查 = 凭空丢兵"）。 */
      if (opts.arrived) {
        var _cS = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
        var _aS = 0;
        for (var _kS in atkArmy) _aS += (atkArmy[_kS] || 0);
        if (_cS && _aS > 0) GAME.battle.returnArmy(_cS, atkArmy, { atkRemain: _aS });
        _expArmySettled = true;      /* 军账已结（随行者归城 / 本就无兵） */
      }
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

    /* ---- v89.63「派遣」(station)：到**已属我方**的野地不接战，到了就驻 ----
       放在上面扣兵/扣体力之后 —— 即时出征与行军队列（dispatch 已扣）两条路径
       走到这里都已完成扣减，所以本段**只负责入驻**，不重复扣任何东西。
       为什么必须短路：己方野地上没有"守军"可打，走战斗结算会出现
       "自己打自己地盘、还按己方守军算伤害"的荒谬结果。 */
    if (mode.station && t.kind === 'wild' && GAME.map.wildAt(t.x, t.y)) {
      var _ga = GAME.wildGarrisonAdd(t.x, t.y, atkArmy, city.id);
      if (_ga.overflow) {
        for (var _o1 in _ga.overflow) city.army[_o1] = (city.army[_o1] || 0) + _ga.overflow[_o1];
      }
      var _stMsg = '派遣驻守 ' + U.fmt(_ga.add || 0) + ' 名（守地不衰减）';
      GAME.log.war('🛡️ ' + t.name + '：' + _stMsg
        + (_ga.overflow && Object.keys(_ga.overflow).length ? '；超出驻军上限者已回城' : ''));
      _expArmySettled = true;      /* v89.86（P-25）：军账已结（驻军 / 溢出均已落地） */
      return {
        ok: true, mode: mode.id, result: { winner: 'atk' }, target: t,
        peaceful: true, msg: _stMsg,
      };
    }

    /* 目标城防。旧写法把**我方城墙等级**加到了敌方防御上（`wallLvl` 取自 GAME.currentCity()），
       等于「自己修墙让敌人更硬」；且因 0.6 封顶而长期看不出问题。此处一并修正 */
    var defBonus = (t.def || 0);
    /* v27（需求 3/5）：守将（野地贼将 / 名城守将）参与战斗 —— 双方将领都要加成 */
    /* v59：把**目标城的城墙等级**传给引擎 —— 箭塔射程要用它
       （照搬原版：箭塔射程 = 基础×(1+抛射) + 基础×(城墙等级×3%) + 100） */
    var tWallLv = (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0;
    /* v86（老板「按计划进行」· G1）：计谋效果 —— **全部作用于战斗入参**（零引擎改动）：
       妖言惑众→守军副本 −15%；火烧粮草→城防值 −30%；挑拨离间→守将加成减半。
       累计施计次数走 state 层唯一出口 schemeMarksOf（挑拨：忠诚 = 100 − 25×n）。 */
    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    /* v89.94（B2 · E2）：战法 —— 奇袭放大本战计略效果（opsIdOf 收敛一切脏值） */
    var opsId = GAME.opsIdOf(opts.ops);
    var _opsMul = (opsId === 'surprise') ? (((DATA.SIEGE || {}).surprise || {}).schemeMul || 1.5) : 1;
    if (opts.scheme) {
      var _sc = GAME.schemeOf(opts.scheme);
      if (_sc) {
        if (_sc.id === 'yaoyan') {
          var _ga = {};
          for (var _gk in (scArmy || {})) {
            _ga[_gk] = Math.max(1, Math.round((scArmy[_gk] || 0) * (1 + _sc.eff.guardPct * _opsMul)));
          }
          scArmy = _ga;
          scNote = '妖言惑众 · 守军逃散 ' + Math.round(-_sc.eff.guardPct * _opsMul * 100) + '%';
        } else if (_sc.id === 'huoshao') {
          scVal = Math.round((defBonus || 0) * (1 - Math.min(0.9, _sc.eff.defCut * _opsMul)));
          scNote = '火烧粮草 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut * _opsMul) * 100) + '%';
        } else if (_sc.id === 'tiaobo') {
          var _tn = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
          var _loy = Math.max(0, 100 - _sc.eff.loyaltyDrop * _opsMul * _tn);
          if (scGen && _loy <= _sc.eff.faintAt) {
            scGen = U.deep(scGen);
            scGen.zm = Math.round((scGen.zm || 0) * 0.5);
            scNote = '挑拨离间 · 守将离心（忠诚 ' + _loy + '，加成减半）';
          } else {
            scNote = '挑拨离间 · 谗言已下（守将忠诚 ' + _loy + '）';
          }
        }
        /* 趁火打劫（掠夺系数）与金蝉脱壳（战败保全）在下方各自结算点另行注明 */
      }
      if (opsId === 'surprise' && scNote) scNote += '（奇袭 ×' + _opsMul + '）';
    }
    /* ============================================================
     * v89.94（B2 · E1/E2）：围攻与战法 —— 只作用于**战斗入参**（零引擎改动）
     * ------------------------------------------------------------
     * · 围困：守军 −12%、城防同步疲敝（断粮之效）；
     * · 围攻（据点/县城）：守军与城防按**当前守备值**缩放 —— 破防越多越好打；
     * · 奇袭已在上方放大计略效果。
     * ⚠️ 必须发生在**观战挂起之前**：挂起时保存的 scArmy/scVal 是权威输入，
     *    重放读它（`opts._sim`）不重算 —— 否则同一场战斗两次结算结果会不同。
     * ⚠️ 缩放对**掠夺/占领都生效**（城破了就是破了），但**破防只有占领推进**。
     * ============================================================ */
    if (!opts._sim) {
      if (opsId === 'encircle' && scArmy) {
        var _ecCfg = (DATA.SIEGE || {}).encircle || {};
        var _ecCut = _ecCfg.garrisonCut == null ? 0.12 : _ecCfg.garrisonCut;
        var _ecA = {};
        for (var _ecK in scArmy) {
          var _ecV = scArmy[_ecK] || 0;
          _ecA[_ecK] = _ecV > 0 ? Math.max(1, Math.round(_ecV * (1 - _ecCut))) : 0;
        }
        scArmy = _ecA;
        scVal = Math.round(scVal * (1 - _ecCut));      /* 被围的守军无暇修葺城防 */
        scNote = (scNote ? scNote + '；' : '') + '围困 · 守军疲敝 −' + Math.round(_ecCut * 100) + '%';
      }
      if (GAME.siegeScopeOf(t)) {
        var _sgS = GAME.siegeScaleOf(t);
        var _sgA = {};
        for (var _sgK in scArmy) {
          var _sgV = scArmy[_sgK] || 0;
          _sgA[_sgK] = _sgV > 0 ? Math.max(1, Math.round(_sgV * _sgS.garrison)) : 0;
        }
        scArmy = _sgA;
        scVal = Math.round(scVal * _sgS.def);
        if (_sgS.hold < 100) {
          scNote = (scNote ? scNote + '；' : '') + '围攻已成 · 守备仅余 ' + Math.round(_sgS.hold)
            + '%（守军与城防同步衰减）';
        }
      }
    }
    /* ============================================================
     * v89.87（老板需求 4 · 战斗观战）：出征战斗改为**会话制**
     * ------------------------------------------------------------
     * 开启观战（settings.battleWatch !== false）且非自动时，抵达不再立即
     * 跑完模拟 —— 在此建立战场会话并挂起（GAME.battle.stepBattle 逐回合
     * 推进，60 真实秒/回合、可提前完成）；战斗结束由 finishBattle 带
     * `opts._result` 重入本函数，从同一锚点继续走下方**既有落账段** ——
     * 一场战斗、一段代码、两条路径，落账逻辑零复制。
     * `opts._sim`：挂起时保存的战斗输入（重放用 —— 保证与首算逐字节一致）。
     * ============================================================ */
    var simOpts = { sieging: t.kind === 'city', kind: t.kind, defName: t.name, wallLv: tWallLv,
        /* v62（老板：「工匠作坊可以造箭塔，箭塔默认参与防守」）：
           守方的箭塔座数走**唯一出口** `GAME.towerCountOf` ——
           它把"城防折出"与"工匠作坊建造"合并成一个数。
           NPC 城没有自建箭塔（`city.towers` 未定义）→ 结果与 v59 完全一致；
           玩家城作为守方时，自己造的箭塔自动上阵（不需要任何指派）。 */
        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null };
    /* ---- v89.115（老板「设计斗将战，为将领个人战，军队作战中概率触发（50%），
       斗将战在军队战前进行，斗将战胜利将获得临时 10% 将领属性加成」）----
       战前斗将：胜方主将拿到一份**属性 +10% 的副本**（原件不动 = 只此一战），
       由 genAttrs 加成链传导到全军。结果随 `_sim` 存走 —— 重放/挂起不重掷。 */
    var duel = null, genSim = gen;
    function _doDuel() {
      duel = GAME.battle.rollDuel(gen, scGen, GAME.battle.duelSeedOf(target));
      if (duel && duel.done) {
        if (duel.winner === 'atk') genSim = GAME.battle.duelBoostOf(gen);
        else scGen = GAME.battle.duelBoostOf(scGen);
        GAME.log.war('⚔ 斗将：' + duel.log.join('；'));
      }
      return duel;
    }
    /* v89.118：战斗加成快照 —— 开打那一刻采集；重放沿用挂起时的那份（三者同源） */
    var _boost = (opts._sim && opts._sim.boost) || GAME.battle.boostSnapshot();
    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;
      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;
      duel = opts._sim.duel || null;
      genSim = opts._sim.genSim || gen;
    } else if (!opts._result && GAME.battle._needWatch(opts)) {
      /* 观战：**先斗将**（战前发生），结果与加成后的两份将领一并挂起 */
      _doDuel();
      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim, boost: _boost });
    } else if (!opts._sim) {
      /* 即时结算（非观战、非重放）：同样战前斗将 */
      _doDuel();
    }
    /* v89.118：结算也在加成快照内跑 —— 史实结果 = "那一刻的加成"下的结果，
       与沙盘重跑（装回同一份快照）逐字节同源。 */
    var result = opts._result || GAME.battle.withBoost(_boost, function () {
      return GAME.battle.simulate(atkArmy, genSim, scArmy, scVal, scGen, simOpts);
    });
    if (duel) result.duel = duel;
    /* ============================================================
     * v89.102（沙盘）：**开打前那一刻的输入快照**（配方专用）
     * ------------------------------------------------------------
     * 必须在下面这些"会改输入"的步骤**之前**取：
     *   · `returnArmy(city, atkArmy, …)` 结算归队时会把 `atkArmy` 逐项清零
     *     —— 真机实测：战后取配方拿到的是 `{qingji:0, gongjian:0, …}`，
     *       重跑成了**空阵**（0 回合 0 损失），而校验又是 0==0 **假通过**；
     *   · `gainExp(gen, …)` 可能让将领当场升级 —— 用战后的将重跑，同配方跑出另一场仗。
     * 这个坑靠"真浏览器截图脚本里推演按钮被禁用"才暴露（Node 探针里将领没升级、
     * 也没走到 returnArmy 之后，所以一直绿）。
     * ============================================================ */
    /* v89.115：配方里的主将用**斗将后的那份**（genSim）—— 否则沙盘重跑会少一个 +10% 的加成，
       校验必然对不上（v89.102 的教训：配方必须与"开打那一刻的输入"逐字节一致）。 */
    var _sbArmy = U.deep(atkArmy), _sbGen = genSim ? U.deep(genSim) : null;
    /* v86：计谋注脚 —— 战报/日志可见（金蝉脱壳只在战败时另算保全） */
    if (scNote) result.schemeNote = scNote;
    if (opts.scheme === 'jintui' && result.winner !== 'atk') {
      var _jt = GAME.schemeOf('jintui');
      result.schemeKeep = _jt ? Math.min(1, _jt.eff.woundedKeep * _opsMul) : 0;
      result.schemeNote = '金蝉脱壳 · 保全而退（阵亡 ' + Math.round(result.schemeKeep * 100) + '% 转伤兵）';
    }
    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);
    GAME.statBump(mode.occupy ? 'conquerAttempt' : 'raidCount', 1);

    /* ============================================================
     * v89.94（B2 · E1）：围攻破防 —— **占领**打据点/县城时，每战都推进守备值
     * ------------------------------------------------------------
     * · 不论胜负都破防（战败也留下战果）—— 这就是"五五开"敢打的理由；
     * · 破防量按**战力比**取：45% × 比，夹在 [8%, 55%]（围困 ×1.5、撤退 ×0.5）；
     * · 守备归零 + 本战获胜 = 下城；否则"守军退守内城"，整军再来。
     * ============================================================ */
    var siegeOut = null;
    if (mode.occupy && GAME.siegeScopeOf(t)) {
      var _tpS = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
      var _aP = 0, _dP = 0, _kk;
      for (_kk in (result.atkStartBy || {})) _aP += (result.atkStartBy[_kk] || 0) * (_tpS ? _tpS(_kk) : 1);
      for (_kk in (result.defStartBy || {})) _dP += (result.defStartBy[_kk] || 0) * (_tpS ? _tpS(_kk) : 1);
      var _divS = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      _dP = _dP * (1 + ((result.defBonusEff || 0) / _divS));
      var _ratioS = _dP > 0 ? (_aP / _dP) : 1;
      var _chipS = GAME.siegeChipOf(_ratioS, opsId);
      if (result.retreat) {
        _chipS = Math.max(1, Math.round(_chipS * ((DATA.SIEGE || {}).retreatChipMul == null
          ? 0.5 : (DATA.SIEGE || {}).retreatChipMul)));
      }
      siegeOut = GAME.siegeChipApply(t, _chipS);
      result.siege = { chip: siegeOut.chip, hold: siegeOut.hold, waves: siegeOut.waves,
        broke: siegeOut.broke, ratio: Math.round(_ratioS * 100) / 100, retreat: !!result.retreat };
      GAME.log.war((result.retreat ? '🏳️ 主动撤退' : (win ? '⚔️ 得胜' : '⚔️ 受挫'))
        + '：' + t.name + ' 守备 −' + siegeOut.chip + '% → 余 ' + Math.round(siegeOut.hold) + '%（第 '
        + siegeOut.waves + ' 波）'
        + (siegeOut.broke ? ' —— 城垣已破，再胜一阵即可拔城' : ''));
    }

    var gains = { res: null, mats: [], equip: [], hero: null, beauty: null, seeds: [] };

    if (win) {
      /* v89.99：俘获迁民 —— 攻破据点/名城，溃卒入**俘虏营**（唯一出口 captiveGain）
         v89.116：把敌军（= 守方）的逐兵种损失表一起传进去 —— 俘虏营要按兵种列清单 */
      var _capt99 = GAME.battle.captiveGain(city, result, t, null, result.defLossBy);
      if (_capt99 && _capt99.gain > 0) {
        result.captives = _capt99;
        GAME.log.war('🪶 俘获迁民：' + _capt99.city + ' +' + U.fmt(_capt99.gain) + ' 人（溃卒收编）');
      }
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
      /* v89.109：掠夺资源**先过城防闸**（唯一出口 lootGateOf）——
         未破墙 / 未歼野战军 → 这一趟抢不到东西（战斗照打照记，兵损经验材料不受影响）。 */
      var _lg109 = (resMul > 0) ? GAME.battle.lootGateOf(result, t) : { ok: true, msg: '' };
      if (resMul > 0 && !_lg109.ok) {
        result.lootGate = _lg109;
        GAME.log.war('🧱 ' + _lg109.msg);
      }
      if (resMul > 0 && _lg109.ok) {
        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */
        var raidBonus = (mode.id === 'raid') ? (1 + TB('pillage')) : 1;
        /* v86：趁火打劫 —— 本战掠夺资源 +30%（乘乱取利，与抢掠技巧叠乘） */
        if (opts.scheme === 'chenhuo') {
          var _ch = GAME.schemeOf('chenhuo');
          raidBonus *= 1 + (_ch ? _ch.eff.lootPct * _opsMul : 0);
        }
        /* v60（需求 4/6）：**城池**用该城自己的派生库存做战利品来源
           （"侦查看到的数" = "打完搬回来的数"，一个出口）；
           野地/据点仍走 genLoot 的按档位生成。 */
        var loot = (t.kind === 'city' && t.npc)
          ? GAME.npcLoot(t.npc, mode.id, raidBonus)
          : GAME.battle.genLoot(t, resMul * raidBonus);
        /* v89.114（老板「掠夺返回的物资数量与军队总负重有关」）：
           战利品总重 ≤ **随军载重**（幸存部队，扣去去程已载辎重）。
           超载时按比例缩减，余数留在原处（战报里明示"未能装下"，下次可再取）。 */
        var _haul = GAME.battle.haulPlanOf({ army: atkArmy, result: result, cargo: opts.cargo, loot: loot });
        loot = _haul.keep;
        gains.haul = _haul;
        /* v60（需求 4）：战利品归**出征的出发城**（资源归属城池） */
        var lootCity = city || GAME.currentCity();
        var Rloot = GAME.res(lootCity);
        for (var lk in loot) { if (loot[lk] > 0) Rloot[lk] = (Rloot[lk] || 0) + loot[lk]; }
        gains.res = loot;
      } else if (resMul <= 0) {
        gains.res = null;
        GAME.log.war('占领不取财货 —— 掠夺得资源，占领得地盘（回报在此地长久的产量加成与采集权）');
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
          GAME.log.war('缴获珠宝：' + j.name + ' ×' + jn);
        }
      }

      /* 军械：掠夺亦可得图纸与成品 */
      var eq = GAME.battle.rollEquipLoot(t);
      if (eq.length) { gains.equip = eq; GAME.log.war('缴获军械：' + eq.join('、')); }

      /* v78（老板需求 1）：种子 —— 出征获胜的缴获之一（种子另一主渠道是采集）。
         城档折算见 DATA.SEED_DROP.cityLv；野地按自身等级。 */
      var seedLv = (t.kind === 'wild')
        ? (t.lv || 1)
        : (((DATA.SEED_DROP || {}).cityLv || {})[t.dropType || 'county'] || (t.lv || 3));
      var seedGot = GAME.grantSeedDrop(seedLv, DATA.SEED_DROP.battleMult, '缴获种子');
      if (seedGot.length) gains.seeds = seedGot;

      /* v89.51：灵气精华 —— 缴获线的产出（与种子同源的"顺带所得"，
         补上蕴养修炼装备在游历剥离之后的产出口） */
      var essLoot = GAME.grantEssenceDrop(seedLv, DATA.ESSENCE_DROP.battleMult, '✨ 缴获灵气精华');
      if (essLoot.length) gains.essence = essLoot;

      /* 占领：据而有之 */
      if (mode.occupy) {
        if (t.kind === 'wild') {
          /* v79：附属野地上限 = 官府等级 + 爵位/主城加成（唯一汇总口） */
          var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');
          if ((s.wilds || []).length >= limit) {
            GAME.log.war('野地数量已达上限（官府' + limit + '级），转为就地取材');
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
            GAME.log.war('占领野地：' + DATA.TERRAIN[t.terrain].name + ' Lv' + t.lv
              + '（产量加成 ' + _pct.join('/') + '，可派军采集）');
            GAME.statBump('wilds', 1);
          }
          var enc = GAME.story ? GAME.story.encounterRoll() : null;
          result.encounter = enc;
        } else if (t.kind === 'fort') {
          if (!siegeOut || siegeOut.broke) {
            /* v89.103（老板「拔除据点可以占据该据点」）：拔除 = **据而有之** ——
               据点就地转成我方一座城（详见 GAME.claimFort）。 */
            var _occ103 = GAME.claimFort(t, gen, city, result);
            if (_occ103 && _occ103.ok) result.claimed = _occ103;
            if (siegeOut) GAME.siegeClear(t);      /* v89.94：下城即清围攻档 */
          } else {
            /* 围攻未果：城垣未破 —— 兵回城，守备保留（下波再来） */
            GAME.log.war('🏯 ' + t.name + ' 城垣未破（守备余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝围攻，多波次磨）');
          }
        } else {
          if (!siegeOut || siegeOut.broke) {
            GAME.onConquer(t.npc, result, gen, city);
            if (siegeOut) GAME.siegeClear(t);
          } else {
            GAME.log.war('🏯 ' + t.name + ' 城垣未破（守备余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝围攻，多波次磨）');
          }
        }
      }

      /* 将领经验（v55 · 原版规则；v56 老板调口径）：
         经验 = 歼灭敌军的资源量 / 1000 × 2（胜方），并封顶到"升级需求的 80%"。
         ⚠️ 口径从"野地等级 × 12"改成"**实际歼灭量**"——这是本质修正：
         原来的线性公式对二次增长的升级需求，到后期是 750~840 场一级（实测）。 */
      var expR = GAME.battle.battleExp(result.defLossBy, gen);
      /* v83（老板）：「形成经验惩罚机制」——掠夺 / 占领野地时按台阶打折。
         野地以外（城池 / 野外城池）不适用；打折后保底 1 点（不至于完全归零）。 */
      if (t.kind === 'wild' && expR.gain > 0) {
        var penR = GAME.battle.expPenaltyOf(gen.level, t.lv);
        if (penR.mul < 1) {
          result.expPenalty = {
            mul: penR.mul, need: penR.need, wl: penR.wl, gap: penR.gap,
            before: expR.gain, after: Math.max(1, Math.round(expR.gain * penR.mul)),
          };
          expR.gain = result.expPenalty.after;
        }
      }
      var whyEx = mode.name + ' ' + t.name
        + (result.expPenalty ? '（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2) + '）' : '');
      var exps = GAME.battle.gainExp(gen, expR.gain, whyEx);
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
      /* v89.94（B2 · E1）：**主动撤退不是战败** —— 撤退是决策（保全而退），
         不该被当失败惩罚：不扣忠诚、不写"坚守不退"，写清"破防已保留"。 */
      if (result.retreat) {
        GAME.log.war('🏳️ ' + gen.name + ' 主动撤退：' + t.name + ' 未克（破防已保留，残部带回）');
      } else {
      /* v14.1：忠诚的唯一自然下降途径 —— 出征战败挫伤士气。
         （此前是随时间/民心/欠俸慢慢掉，玩家什么都没做也会掉，体验很差） */
      var lLoss = (DATA.LOYALTY && DATA.LOYALTY.defeatLoss) || 8;
      var lBefore = gen.loyalty == null ? 70 : gen.loyalty;
      /* v89.40（老板）：「君主不会掉忠诚」—— 战败挫伤不适用于君主
         （与「不可解雇 / 绝不离去」同源：忠诚对君主无意义，详情页也不再出忠诚行）。 */
      if (GAME.isLordGeneral(gen)) {
        GAME.log.war((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）');
      } else {
        gen.loyalty = Math.max(0, lBefore - lLoss);
        GAME.log.war((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）'
          + '，' + gen.name + ' 忠诚 -' + lLoss + '（现 ' + Math.round(gen.loyalty) + '）');
        if (gen.loyalty < (DATA.LOYALTY.warnAt || 50)) {
          GAME.log.war('⚠️ ' + gen.name + ' 忠诚已低于 ' + DATA.LOYALTY.warnAt + '，加成减半，宜以珠宝赏赐安抚。');
        }
      }
      }
    }

    /* 归队 —— 「派出去的兵能回来」的唯一路径。
       之前 expedition 扣了兵却从不归还 `result.atkRemain`，伤兵也只是个计数，
       等于每次出征都在凭空蒸发军队、治疗是纯金币消耗。 */
    var returned = { back: {}, wounded: {} };
    /* v89.63：「派遣」打下来的兵**留驻该地**（伤兵仍回城医治）——
       于是"出兵"与"驻守"合成一道手续，那道独立的「派军驻守」按钮就此退场。 */
    var _stW = (mode.station && t.kind === 'wild' && win) ? GAME.map.wildAt(t.x, t.y) : null;
    var _stAdd = 0;
    if (city) {
      returned = GAME.battle.returnArmy(city, atkArmy, result, _stW ? function (back) {
        var _gb = GAME.wildGarrisonAdd(t.x, t.y, back, city.id);
        if (_gb.overflow) {
          for (var _o2 in _gb.overflow) city.army[_o2] = (city.army[_o2] || 0) + _gb.overflow[_o2];
        }
        _stAdd = _gb.add || 0;
      } : null);
    }
    _expArmySettled = true;      /* v89.86（P-25）：军账已结（幸存者 / 伤兵均已入账） */
    var backN = 0, woundN = 0;
    for (var bk in returned.back) backN += returned.back[bk];
    for (var wk in returned.wounded) woundN += returned.wounded[wk];
    if (_stW) {
      GAME.log.war('🛡️ 派遣驻守：' + U.fmt(_stAdd) + ' 名留驻 ' + t.name
        + (woundN > 0 ? '，伤兵 ' + U.fmt(woundN) + ' 回城医治' : ''));
    } else if (backN > 0 || woundN > 0) {
      GAME.log.war('班师 ' + (city ? city.name : '') + '：' + U.fmt(backN) + ' 名归营'
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
          : (GAME.currentCity() ? GAME.currentCity().name : '出发城')) + '府库' +
        /* v89.114：运力口径随行（"搬了多少"与"最多能搬多少"同源 haulPlanOf） */
        ((gains.haul && gains.haul.weight > 0)
          ? '；随军载重 ' + U.fmt(gains.haul.cap) + ' ／ 实载 ' + U.fmt(gains.haul.kept) : '') + '）');
    } else if (win && mode.occupy && t.kind === 'wild') {
      lootLines.push('战果：据而有之（占领不取财货，回报在此地长久的产量加成与采集权）');
    } else if (win && mode.occupy && t.kind === 'city') {
      /* v60（需求 4/6）：攻占的口径变了 —— 不再另发一笔财货，
         而是**城池连同其中的库藏**（该城按等级派生的库存 × cityInherit）一起归我。 */
      lootLines.push('战果：城池易主，其中库藏尽归我有（占领不取现财 —— 财货已在城中）');
    } else if (win && mode.occupy && t.kind === 'fort' && result.claimed) {
      /* v89.103（老板「拔除据点可以占据该据点」）：拔除 = 据而有之 */
      lootLines.push('战果：**就地据守** —— ' + t.name + ' 已成为我城（建筑 Lv'
        + result.claimed.lv + ' 转正 · 人口 ' + U.fmt((result.claimed.city.res || {}).pop || 0)
        + ' 归附 · 该地不再生成据点）');
    }
    /* v89.114：运力不足的明示（唯一出口 haulPlanOf 的结果）——
       "搬回来多少"与"最多能搬多少"写进战报，玩家一眼看出差在后勤。 */
    if (gains.haul && gains.haul.lost > 0) {
      lootLines.push('🚚 运力不足：库藏重 ' + U.fmt(gains.haul.weight) + '，随军载重仅 '
        + U.fmt(gains.haul.cap) + ' —— 尚有 ' + U.fmt(gains.haul.lost)
        + ' 未能装下（仍留库中，下次可再取；编入辎重车或民夫可提高搬运量）');
    }
    if (gains.mats && gains.mats.length) lootLines.push('材料：' + gains.mats.join('、'));
    if (gains.equip && gains.equip.length) lootLines.push('军械：' + gains.equip.join('、'));
    /* v89.113（老板「战斗胜利为什么没有俘虏」）：俘虏进战利品清单 —— 玩家一眼可见 */
    if (result.captives && result.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cpl = [];
      for (var _ck in (result.captives.byType || {})) {
        if (!result.captives.byType[_ck]) continue;
        _cpl.push((DATA.TROOPS[_ck] ? DATA.TROOPS[_ck].name : (_ck === 'unknown' ? '来历不明' : _ck))
          + ' ×' + U.fmt(result.captives.byType[_ck]));
      }
      lootLines.push('俘虏：' + U.fmt(result.captives.gain) + ' 众入营'
        + (_cpl.length ? '（' + _cpl.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编为民');
    }
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
        + (result.duel && result.duel.done
          ? '<br>【斗将】' + result.duel.log.join('；') + '　·　' + result.duel.winnerName +
            ' 得势：其全军将领属性 +' + Math.round((result.duel.bonusPct || 0.10) * 100) + '%（限本战）'
          : '')
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')
        + (result.retreat ? '<br>【撤退】主动撤退：残部带回，本波破防按半计（围攻进度保留）。' : '')
        + (result.siege ? '<br>【围攻】' + (result.siege.retreat ? '撤退收兵 · ' : '')
          + '破防 ' + result.siege.chip + '% → 守备余 ' + Math.round(result.siege.hold) + '%（第 '
          + result.siege.waves + ' 波' + (result.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）' : '')
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
      /* v89.94（B2 · E3）：分回合回放的关键帧（≤10 帧 + 关键帧标记；增量 <2KB/场） */
      replay: GAME.battle.replayFramesOf(result),
      /* v89.102（老板「固定沙盘 · 逐兵种逐帧」）：沙盘**配方** ——
         打开战报时用同一把引擎重跑，得到逐帧画面（每个兵种的移动/攻击各一帧）。
         存配方不存帧：≈2KB/场，且口径永远跟着引擎走。
         `_sim.history` = 观战路径的逐回合指令（即时结算的仗为 null）。 */
      sandbox: GAME.battle.sandboxRecipeOf(result, _sbArmy, _sbGen, scArmy, scVal, scGen, simOpts,
        { cmds: (opts._sim && opts._sim.history) || null,
          place: { kind: t.kind, terrain: t.terrain || null },
          boost: _boost }),
      /* v89.94（B2 · E3）：以少胜多 —— 以弱胜强的一仗才值得晒 */
      underdog: GAME.battle.underdogOf(result),
      /* v89.94（B2 · E1）：围攻战果（据点/县城才有）—— 列表与详情都要显示"还差多少" */
      siege: result.siege || null,
    };
    s.reports.unshift(report);
    /* v89.107：同上 —— 上限一处（DATA.REPORT_MAX），挤掉跳过收藏 */
    while (s.reports.length > (DATA.REPORT_MAX || 60)) {
      var _d2 = -1;
      for (var _r2 = s.reports.length - 1; _r2 >= 0; _r2--) {
        if (!s.reports[_r2].fav) { _d2 = _r2; break; }
      }
      if (_d2 < 0) break;
      s.reports.splice(_d2, 1);
    }
    /* v41（需求 4）：新战报 → 未读 +1，公文菜单图标开始闪黄（进公文页清零） */
    s.repUnread = (s.repUnread || 0) + 1;   /* v82：收编同段重复行（原先每份战报 +2） */
    return {
      ok: true, mode: mode.id, result: result, target: t, gains: gains,
      msg: (win
        ? ((siegeOut && !siegeOut.broke)
          ? '围攻得势：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（未下城）'
          : mode.name + '成功：' + t.name)
        : ((siegeOut && siegeOut.chip)
          ? '围攻受挫：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（战果已入账）'
          : mode.name + '失败：' + t.name)),
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
  /* v89.63：新增可选的第 4 参 `backSink` —— 由调用方决定"活着的兵"去哪。
     出征「派遣」(station) 用它把幸存者直接送进野地驻军（而不是回城）；
     不传则完全维持旧行为（回城）。伤兵**始终回城**（要医治，不能扔在野外）。 */
  GAME.battle.returnArmy = function (city, sentArmy, result, backSink) {
    var s = GAME.state;
    var aStart = 0;
    for (var id in sentArmy) aStart += sentArmy[id];
    if (!city || !aStart) return { back: {}, wounded: {} };
    /* v89.114：幸存编制改走**唯一出口** `survivedArmyOf`（与掠夺搬运同一把尺）——
       原先这里另算一份 keep；两处算法各自演化，就会出现"搬货按 A、归队按 B"。
       归队与搬货的差别只在 rate（伤兵回收率）：归队把阵亡者的一部分折成伤兵。 */
    var surv = GAME.battle.survivedArmyOf(sentArmy, result);
    var rate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    /* v86：金蝉脱壳 —— 战败时额外保全（阵亡转伤兵，与军医/治疗科技同链相加） */
    if (result && result.schemeKeep) rate = Math.min(0.9, rate + result.schemeKeep);
    if (GAME.systems.buffActive('military') && s.buffs.military.wound) rate = s.buffs.military.wound;
    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));
    /* 门派被动（v89.86 · 百草堂「战后伤兵回复 +15%」）—— 与军医/维修科技同链 */
    if (GAME.sectBonus) rate = Math.min(0.9, rate * (1 + GAME.sectBonus('woundPct')));
    var back = {}, wounded = {}, wTotal = 0;
    for (var id2 in sentArmy) {
      var n = sentArmy[id2] || 0;
      if (n <= 0) continue;
      var alive = surv[id2] || 0;      /* v89.114：来自 survivedArmyOf（唯一出口） */
      var dead = n - alive;
      if (alive > 0) {
        back[id2] = alive;
        if (!backSink) city.army[id2] = (city.army[id2] || 0) + alive;   /* 有 backSink 时目的地由调用方落地 */
      }
      var w = Math.floor(dead * rate);
      if (w > 0) { wounded[id2] = w; wTotal += w; }
    }
    if (wTotal > 0) {
      s.woundedArmy = s.woundedArmy || {};
      for (var id3 in wounded) s.woundedArmy[id3] = (s.woundedArmy[id3] || 0) + wounded[id3];
      s.wounded = (s.wounded || 0) + wTotal;
    }
    if (backSink && Object.keys(back).length) backSink(back);   /* 唯一出口：去哪由调用方说了算 */
    return { back: back, wounded: wounded };
  };

  /* 兼容旧接口：默认「占领」 */

  /* ============================================================
   * v89.103（老板「拔除据点可以占据该据点（成为自己的城池）」）
   * ------------------------------------------------------------
   * 改前：占领打下一座野外城池 = **拔除**（当日移除、次日重置、谁也不得）——
   *   于是 v89.94 那套"磨守备值"的围攻机制对据点毫无回报：磨下来一场空。
   * 现在：拔除 = **据而有之** —— 据点就地转为我方一座城：
   *   · 建筑**就地转正**（野城本来就是"建筑全满"；布局与侦查面板、守军
   *     同出一源：GAME.fortPlanOf / GAME.npcCityShadow）→ 拿到的是满配城；
   *   · 城里的人跟着留下（人口 = 该布局民房满员，与侦查看到的数字同一个）；
   *   · 库藏不继承 —— 据点本就没有库藏（掠夺所得是"打下来才有"的），
   *     所以按新城启动物资发一份，够它自己开张；
   *   · 永久登记（GAME.map.markFortTaken）→ 该格从此不再生成据点。
   * 返回 { ok, city, rep, lv }：调用方（战报/日志）据此写"就地据守"。
   * ============================================================ */
  GAME.claimFort = function (t, gen, fromCity, result) {
    var s = GAME.state;
    if (!t || t.kind !== 'fort' || !t.fort) return { ok: false, msg: '不是野外城池' };
    /* v89.108（兜底）：领地上限 —— 据点转正 = 一座新城（防"绕过 prepare 的路径"） */
    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    if (!_cc108.ok) return { ok: false, msg: _cc108.msg };
    var f = t.fort;
    var lv = Math.max(1, f.level || 1);
    /* 布局唯一出口：与"侦查看到的布局 / 守军"同一份 */
    var shadow = GAME.npcCityShadow
      ? GAME.npcCityShadow({ id: 'fort_' + f.x + '_' + f.y, name: f.name, x: f.x, y: f.y,
        level: lv, type: 'self', def: GAME.fortDefOf ? GAME.fortDefOf(f) : 0 })
      : null;
    var city = GAME.makeCity({
      id: 'occ_' + f.x + '_' + f.y,
      name: f.name,
      x: f.x, y: f.y,
      /* 自建城档位（type='self'）：无岁贡、靠城外地块与税收 ——
         与"打下来的一座野城"相称；城等级跟随官府（= 布局等级）。 */
      type: 'self',
      res: Object.assign({}, DATA.NEW_CITY_RES || {}),
    });
    city.level = lv;
    city.def = GAME.fortDefOf ? GAME.fortDefOf(f) : 0;
    city.fromFort = { x: f.x, y: f.y, level: lv };        /* 出身（界面/战报用） */
    if (shadow) {
      city.col = shadow.col; city.row = shadow.row;
      city.cells = shadow.cells.map(function (c) {
        return { build: c.build ? { id: c.build.id, lvl: c.build.lvl } : null,
          pending: null, official: !!c.official };
      });
      city.extGrid = shadow.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
      city.wallLv = shadow.wallLv;
    }
    /* 城里的人跟着留下（口径 = 该布局民房满员，与侦查面板同一数字） */
    if (GAME.planPopCapOf) city.res.pop = GAME.planPopCapOf(lv);
    s.cities.push(city);
    if (GAME.map.markFortTaken) GAME.map.markFortTaken(f.x, f.y, city.id);
    if (GAME.map.razeFort) GAME.map.razeFort(f.x, f.y);    /* 当日标记：今日不再出现 */
    var tile = GAME.map.tile(f.x, f.y);
    if (tile) tile.terrain = 'city';
    GAME.statBump('forts', 1);
    var repF = Math.round((20 + lv * 5) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));
    s.rep = (s.rep || 0) + repF;
    GAME.log.war('🚩 破 ' + f.name + '（野外城池 Lv' + lv + '）—— **就地据守**：'
      + '全城建筑转正 · 人口 ' + U.fmt(city.res.pop || 0) + ' 归附（声望 +' + repF + '）');
    return { ok: true, city: city, rep: repF, lv: lv,
      msg: f.name + ' 已归我（建筑 Lv' + lv + ' 转正 · 人口 ' + U.fmt(city.res.pop || 0) + '）' };
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
      GAME.log.sys('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level +
        '（自动加点 +' + step + ' · 自由点 +' + step + '）');
    }
    var capped = gen.level >= capLv;
    if (capped && from < capLv) {
      /* v89.65：君主的段顶不是"资质顶"，文案与真实原因对齐（否则玩家以为练到头了，
         其实该去练功突破） */
      if (gen.isLord) {
        GAME.log.sys('🔒 ' + gen.name + ' 已达本段上限 Lv' + capLv
          + '（君主每 ' + DATA.LORD_BREAK.step + ' 级一段）—— 练功攒修为后突破可续升');
      } else {
        GAME.log.sys('🔒 ' + gen.name + ' 已达资质上限 Lv' + capLv
          + '（' + (GAME.rankOf(gen).name) + '），再多的经验也无法提升');
      }
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
    /* v79：河图洛书 —— 将领经验 +6%/级（唯一消费口） */
    if (amount > 0 && GAME.artifactBonusNum) {
      amount = Math.round(amount * (1 + GAME.artifactBonusNum('genExpPct')));
    }
    if (!gen || amount <= 0) return null;
    gen.exp = (gen.exp || 0) + amount;
    var r = GAME.checkLevelUp(gen);
    if (r && r.up && GAME.sfx) GAME.sfx('levelup');   /* v89.93（E4）：升级音 */
    var need = GAME.expNeedOf(gen);
    GAME.log.sys('📗 ' + gen.name + ' 经验 +' + U.numText(amount, 0)
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

  /* ============================================================
   * v89.94（B2 · E3）：战报回放的数据侧 —— 战力口径 / 以少胜多 / 关键帧
   * ------------------------------------------------------------
   * · armyPowerOf：兵种构成 → 战力（走 STORY.troopPower 唯一出口，与来袭/家底同一把尺）；
   * · underdogOf：以弱胜强（我方战力 < 守方战力×0.8 且赢）；
   * · replayFramesOf：从 roundsLog 抽 ≤maxFrames 帧（首 2 + 尾 2 + 首杀/破塔/折半/最烈），
   *   每帧带条带与一行事件（截断到 maxEv 字），并给关键帧标记。
   *   验收线：战报增量 < 2KB/场（probe 实测钉住）。
   * ============================================================ */
  GAME.battle.armyPowerOf = function (by) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var n = 0;
    for (var k in (by || {})) {
      n += (by[k] || 0) * (tp ? tp(k) : ((DATA.TROOPS[k] || {}).power || 1));
    }
    return Math.round(n);
  };
  GAME.battle.underdogOf = function (r) {
    if (!r || r.winner !== 'atk') return false;
    var a = GAME.battle.armyPowerOf(r.atkStartBy);
    var d0 = GAME.battle.armyPowerOf(r.defStartBy);
    var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
    var d = d0 * (1 + ((r.defBonusEff || 0) / div));
    return d > 0 && a > 0 && a < d * 0.8;
  };
  GAME.battle.replayFramesOf = function (r) {
    var cfg = DATA.REPLAY || {};
    var maxFrames = cfg.maxFrames || 10, maxEv = cfg.maxEv || 56;
    if (!r || r.engine !== 'tactic' || !r.roundsLog || !r.roundsLog.length) return null;
    var log = r.roundsLog, strips = r.strips || [], n = log.length;
    function evLine(rr) {
      var parts = [], hostOf = {};
      /* v89.119（老板「反击应该在敌方出手后…反击和对方出手记录在同一行」）：
         反击并入**引发它的那次出手**同一段，口径与回合记录/战报纪要一致
         （唯一配对规则：counter.targetId === 该出手的 id，且阵营相反）。 */
      (rr.events || []).forEach(function (e) {
        if (parts.length >= 3) return;
        if (e.kind === 'attack') {
          parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
            + ' 杀 ' + U.numText(e.kill || 0, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = parts.length - 1;
        } else if (e.kind === 'counter') {
          var hk = (e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId;
          var hi = hostOf[hk];
          if (hi != null) parts[hi] += '（对方' + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';
          else parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0));
        } else if (e.kind === 'tower') {
          parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
        } else if (e.kind === 'wall') {
          parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
        }
      });
      var s0 = parts.join('；');
      if (s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
      return s0;
    }
    var a0 = (log[0] && log[0].a) || 0, d0 = (log[0] && log[0].d) || 0;
    var picks = {};
    [0, 1, n - 2, n - 1].forEach(function (i) { if (i >= 0 && i < n) picks[i] = true; });
    var firstKill = -1, firstTower = -1, halfA = -1, halfD = -1, maxKill = 0, maxIdx = -1;
    log.forEach(function (rr, i) {
      var k = 0;
      (rr.events || []).forEach(function (e) {
        if (e.kill) k += e.kill;
        if (firstKill < 0 && (e.kill || 0) > 0) firstKill = i;
        if (firstTower < 0 && e.kind === 'tower') firstTower = i;
      });
      if (k > maxKill) { maxKill = k; maxIdx = i; }
      if (halfA < 0 && a0 > 0 && rr.a <= a0 * 0.5) halfA = i;
      if (halfD < 0 && d0 > 0 && rr.d <= d0 * 0.5) halfD = i;
    });
    [firstKill, firstTower, maxIdx].forEach(function (i) { if (i >= 0) picks[i] = true; });
    [halfA, halfD].forEach(function (i) { if (i >= 0) picks[i] = true; });
    var idx = Object.keys(picks).map(Number).sort(function (x, y) { return x - y; });
    while (idx.length > maxFrames) idx.splice(idx.length - 2, 1);      /* 优先保首尾 */
    var frames = idx.map(function (i) {
      var rr = log[i];
      return { r: rr.r, a: rr.a, d: rr.d, gap: rr.gap, s: strips[i] || '', ev: evLine(rr) };
    });
    var key = [];
    if (firstKill >= 0) key.push({ r: log[firstKill].r, tag: 'first', text: '初次接敌' });
    if (firstTower >= 0) key.push({ r: log[firstTower].r, tag: 'tower', text: '攻破箭塔' });
    if (halfD >= 0) key.push({ r: log[halfD].r, tag: 'half', text: '敌军折半' });
    if (halfA >= 0) key.push({ r: log[halfA].r, tag: 'lost', text: '我军折半' });
    if (maxIdx >= 0) key.push({ r: log[maxIdx].r, tag: 'hot', text: '最烈一回合' });
    key.push({ r: log[n - 1].r, tag: 'final',
      text: r.retreat ? '主动撤退' : (r.winner === 'atk' ? '得胜' : '力尽') });
    return { field: r.field, rounds: n, frames: frames, key: key, retreat: !!r.retreat };
  };

  /* ============================================================
   * v89.102（老板「固定沙盘 · 逐兵种逐帧」）：战报沙盘 —— 数据侧
   * ------------------------------------------------------------
   * 存储策略：**存配方，不存帧**。
   *   · 引擎完全确定（tactic.js 头注：同样输入必得同样结果）——
   *     沙盘打开时用同一把引擎、同一组输入重跑，得到的就是那一仗的
   *     逐帧画面（每个兵种的移动 / 攻击各一帧）；
   *   · 配方 ≈ 2KB/场，比"存全量帧"（5~20KB/场）省一个数量级，
   *     而且口径永远跟着引擎走（引擎一改，画面自动同步，不会留下
   *     "用旧公式画出来的历史帧"）；
   *   · `init` 必须一并存：重跑时以 `opts.stances` 原样覆盖双方动作/目标，
   *     否则玩家事后改了出征战术，同一份战报会跑出另一场仗。
   * 校验：重跑结果与战报记下的回合数 / 双方损失逐项相等才算"忠实"；
   *   不相等（战后又升了科技，全局加成已变）→ 沙盘退回关键帧回放并在
   *   标题栏写明原因 —— 宁可说清"看不了逐帧"，也不给一幅假画面。
   * ============================================================ */
  GAME.battle.SANDBOX_KIND = { move: 'm', retreat: 'r', attack: 'a', counter: 'c', tower: 't', wall: 'w' };

  /* ============================================================
   * v89.118（600×30h 试玩）：「战斗加成快照」—— 沙盘保真度的根因修复
   * ------------------------------------------------------------
   * 引擎在结算/重跑时读**全局**加成：`systems.techBonus`（科技）、
   * `STORY.combatMod()`（天时 weather + 年号 era）、`STORY.atkMult/siegeMult/
   * cityDefMult`（羁绊）、`state.buffs`（战鼓 buff）。这些在 30 小时里都会漂移 ——
   * 于是**重跑读"现在"、史实读"那一刻"**，verify 必然出现假不一致（实测 23 场）。
   *
   * 口径（沿用 v89.102 的教训"配方必须与开打那一刻逐字节一致"）：
   *   · boostSnapshot() 在**开打那一刻**采集（纯数据小快照）；
   *   · withBoost() 在结算/重跑期间把它临时装回全局读点，用完**逐项还原**；
   *   · 快照随配方与挂起会话走（rc.boost / _sim.boost）——
   *     史实结算、挂起重放、沙盘重跑三者同源。
   * 采集清单 = 引擎侧全部全局读点（tactic.js 里的 TB/combatMod/atkMult/siegeMult/
   * buffActive 与 state.buffs）—— 新增读点时要往这里补一项，别只改一边。
   * ============================================================ */
  GAME.battle.boostSnapshot = function () {
    var st = GAME.state || {}, S = GAME.story || {};
    try {
      return {
        techs: U.deep(st.techs || {}),            /* → systems.techBonus（TB 全部 type） */
        world: U.deep(st.world || {}),            /* → STORY.combatMod（天时/年号，由 world 推导） */
        buffs: U.deep(st.buffs || {}),            /* → systems.buffActive + st.buffs.military */
        atkMult: (S.atkMult ? S.atkMult() : 1),   /* 羁绊「攻」× 年号 atkEra */
        siegeMult: (S.siegeMult ? S.siegeMult() : 1),
        cityDefMult: (S.cityDefMult ? S.cityDefMult() : 1),
        defAdd: (S.defMult ? S.defMult() : 0),    /* 羁绊「守御」（战役层也读） */
      };
    } catch (e) { return null; }
  };
  /* 把快照装回全局读点跑 fn，然后逐项还原。bs 为空 → 直接跑（旧档 / 无快照的仗）。 */
  GAME.battle.withBoost = function (bs, fn) {
    if (!fn) return null;
    if (!bs) return fn();
    var st = GAME.state, S = GAME.story;
    if (!st || !S) return fn();
    var bak = {
      techs: st.techs, world: st.world, buffs: st.buffs,
      atkMult: S.atkMult, siegeMult: S.siegeMult, cityDefMult: S.cityDefMult, defMult: S.defMult,
    };
    try {
      if (bs.techs) st.techs = bs.techs;
      if (bs.world) st.world = bs.world;
      st.buffs = bs.buffs || {};
      if (bs.atkMult != null) S.atkMult = function () { return bs.atkMult; };
      if (bs.siegeMult != null) S.siegeMult = function () { return bs.siegeMult; };
      if (bs.cityDefMult != null) S.cityDefMult = function () { return bs.cityDefMult; };
      if (bs.defAdd != null) S.defMult = function () { return bs.defAdd; };
      return fn();
    } finally {
      st.techs = bak.techs; st.world = bak.world; st.buffs = bak.buffs;
      S.atkMult = bak.atkMult; S.siegeMult = bak.siegeMult;
      S.cityDefMult = bak.cityDefMult; S.defMult = bak.defMult;
    }
  };

  GAME.battle.sandboxRecipeOf = function (r, atkArmy, gen, scArmy, scVal, scGen, simOpts, extra) {
    if (!r || r.engine !== 'tactic' || !r.unitsInit) return null;
    extra = extra || {};
    /* 阵位只留"动作 + 目标"两个字段：行位（adv）是动作的函数，引擎自己会算 */
    function brief(list) {
      return (list || []).map(function (u) { return { id: u.id, s: u.stance || 'advance', t: u.target || '' }; });
    }
    return {
      atkArmy: U.deep(atkArmy || {}),
      gen: gen ? U.deep(gen) : null,
      scArmy: U.deep(scArmy || {}),
      scVal: scVal || 0,
      scGen: scGen ? U.deep(scGen) : null,
      simOpts: U.deep(simOpts || {}),
      init: { atk: brief(r.unitsInit.atk), def: brief(r.unitsInit.def) },
      /* v89.102：**逐回合指令快照**（观战路径才有）——
         玩家在战场上逐回合改动作/目标的那种仗，重跑必须按 history 重放，
         否则重跑用的还是"初始阵位"，校验必然不过（那是"少了指令"，
         不是"科技变了"）。没有 history（即时结算的仗）→ 恒用初始阵位。 */
      cmds: (extra.cmds && extra.cmds.length) ? U.deep(extra.cmds) : null,
      /* 沙盘底图用：目标的地形/种类（纯画面，不参与任何结算） */
      place: extra.place || null,
      /* v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘，并增加右侧（我方守城）
         的城墙示意」）：**视角** —— 沙盘画面上"哪一边是我"。
         'atk'（默认）= 我攻敌守（出征口径）；'def' = 我守敌攻（来袭口径）：
         界面据此把标签、可操作侧、城墙位置整个反过来。
         `wall`：城墙示意（等级 + 箭塔数），只有守城仗才有。 */
      ourSide: (extra.ourSide === 'def') ? 'def' : 'atk',
      wall: extra.wall || null,
      /* v89.118：**战斗加成快照**（开打那一刻的科技/天时/年号/羁绊/战鼓）——
         重跑靠它把全局读点装回史实那一刻（否则 30h 后重跑必然 verify=false）。 */
      boost: extra.boost || null,
      /* 史实结果（校验沙盘忠实度的锚点，不参与画面） */
      result: { rounds: r.rounds, atkLoss: r.atkLoss, defLoss: r.defLoss },
    };
  };

  /* 由战报重建沙盘。
     返回 null = 这份战报没有（或无法建立）沙盘 —— 上层退回关键帧回放。
     { field, rounds, maxRounds, ids[], init, frames[], per[], towers, verify, hist, sim,
       kinds: {动作字符 → 中文} } */
  GAME.battle.sandboxOf = function (rep) {
    var rc = rep && rep.sandbox;
    if (!rc || !GAME.tactic || !GAME.tactic.begin) return null;
    /* v89.118：重跑期间把**史实那一刻的加成快照**装回全局读点 —— 否则读的是"现在"
       的科技/天时/年号/羁绊/战鼓，与史实不同源（30h 试玩实测 23 场假不一致）。 */
    return GAME.battle.withBoost(rc.boost || null, function () {
      return GAME.battle._sandboxBuild(rc);
    });
  };
  /* 沙盘构建本体（在 withBoost 的加成快照内执行；逻辑与 v89.102 逐字相同） */
  GAME.battle._sandboxBuild = function (rc) {
    /* 快照缺失 / 空阵 → 没有沙盘（不许拿"0 回合 0 损失"当通过：那是假绿，
       真机踩过 —— `returnArmy` 清零后的 atkArmy 被写进配方）。 */
    if (GAME.battle.marchMenOf(rc.atkArmy) <= 0) return null;
    /* 快照缺失 / 空阵 → 没有沙盘（不许拿"0 回合 0 损失"当通过：那是假绿，
       真机踩过 —— `returnArmy` 清零后的 atkArmy 被写进配方）。 */
    if (GAME.battle.marchMenOf(rc.atkArmy) <= 0) return null;
    var K = GAME.battle.SANDBOX_KIND;
    var ids = [], idIdx = {};
    function iid(s) {
      if (!s) return -1;
      if (!(s in idIdx)) { idIdx[s] = ids.length; ids.push(s); }
      return idIdx[s];
    }
    var stances = { atk: {}, def: {} };
    (((rc.init || {}).atk) || []).forEach(function (u) { stances.atk[u.id] = { s: u.s, t: u.t }; });
    (((rc.init || {}).def) || []).forEach(function (u) { stances.def[u.id] = { s: u.s, t: u.t }; });
    var opts = U.deep(rc.simOpts || {});
    opts.stances = stances;
    var env;
    try {
      env = GAME.tactic.begin(rc.atkArmy || {}, rc.gen || null, rc.scArmy || {}, rc.scVal || 0,
        rc.scGen || null, opts);
    } catch (e) { return null; }
    var init = env.snap();
    /* v89.102：逐回合指令重放（与 `_makeEnv` 同一手法 —— 观战路径的史实指令） */
    var cmds = rc.cmds || null;
    var frames = [], per = [], guard = 0;
    while (!env.over && guard++ < (GAME.tactic.MAX_ROUNDS || 30) + 5) {
      var _ci = per.length;
      if (cmds && cmds[_ci]) {
        for (var _tid in cmds[_ci]) env.setCmd('atk', _tid, cmds[_ci][_tid]);
      }
      var st = env.step();
      if (!st) break;
      per.push([st.r, st.a, st.d, st.gap]);
      (st.events || []).forEach(function (e) {
        var tgt = e.targetId || '';
        if (e.kind === 'wall' && e.hits && e.hits[0]) tgt = e.hits[0].id;
        frames.push([
          st.r || 0,
          e.side === 'atk' ? 0 : 1,
          iid(e.id || ''),
          K[e.kind] || '?',
          iid(tgt),
          Math.round(e.step || e.kill || e.destroy || 0),
          Math.round(e.kind === 'tower' ? (e.left || 0) : (e.gap || 0)),
        ]);
      });
    }
    var fin = env.finish();
    /* 一帧都没有 = 重跑没跑起来（空阵/输入不全）→ 没有沙盘，别给"空画面" */
    if (!frames.length) return null;
    var aL = 0, dL = 0, k;
    for (k in (fin.atkLossBy || {})) aL += fin.atkLossBy[k];
    for (k in (fin.defLossBy || {})) dL += fin.defLossBy[k];
    var hist = rc.result || null;
    /* ⚠️ 必须要求双方回合数 ≥1：`0 === 0` 会让空阵"校验通过"（真机踩过，见上手注释） */
    var verify = !!hist && hist.rounds >= 1 && fin.rounds >= 1
      && fin.rounds === hist.rounds && aL === hist.atkLoss && dL === hist.defLoss;
    return {
      field: init.field || 1, rounds: per.length, maxRounds: init.maxRounds || (GAME.tactic.MAX_ROUNDS || 30),
      ids: ids, init: init, frames: frames, per: per,
      towers: init.towers ? init.towers.start : 0,
      /* v89.116：视角 / 城墙 / 地形随配方带出 ——
         ⚠️ `place` 此前**从没被携带过**（配方里存了，返回时丢了）：
            界面 `sdFieldHTML` 读 `sb.place` 取野地地形贴图，于是那张贴图一直没生效。 */
      ourSide: (rc.ourSide === 'def') ? 'def' : 'atk',
      wall: rc.wall || null,
      place: rc.place || null,
      verify: verify,
      hist: hist, sim: { rounds: fin.rounds, atkLoss: aL, defLoss: dL, winner: fin.winner },
      kinds: K,
    };
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
        /* v83（老板）：「形成经验惩罚机制」——越级打野地要把打折原因写明白，
           否则玩家会以为经验算漏了（与"单场封顶"同一原则）。 */
        + (result.expPenalty
          ? '<span style="color:var(--text-dim);">（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2)
            + '：Lv' + gen.level + ' 宜打 ' + result.expPenalty.need + ' 级野地）</span>'
          : (result.expCapped
            ? '<span style="color:var(--text-dim);">（歼灭 ' + U.numText(result.expRaw || 0, 0)
              + '，已达单场上限 ' + U.numText(ei.gain, 0) + '）</span>'
            : (result.defValue
              /* v89.89（A3 · 100+ 轮实玩期待）：口径就地解释 —— 悬停「歼敌值」看折算规则
                 （100+ 轮实玩实测："歼敌值 3,120 资源"口径费解）。 */
              ? '<span style="color:var(--text-dim);">（<span style="cursor:help;" '
                + 'title="歼敌值 = 按歼灭敌军的资源造价折算（与将领经验同一口径）">歼敌值</span> '
                + U.numText(result.defValue, 0) + ' 资源）</span>' : '')))
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

    /* ③c 门派被动（v89.86 · 玄鹤门「行军速度 +8%」）—— 唯一出口 sectBonus */
    if (GAME.sectBonus) m *= (1 + GAME.sectBonus('marchPct'));

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
  GAME.march.dispatch = function (target, modeId, army, genId, schemeId, ops, extra) {
    var s = GAME.state;
    /* v89.94（B2 · E2）：战法随军 —— 校验与 prepare 同一判据（含"奇袭须有计略"） */
    var opsId = GAME.opsIdOf(ops);
    var p = GAME.battle.prepare(target, modeId, army, genId, { ops: opsId, scheme: schemeId || null });
    if (!p.ok) return p;
    var city = p.city, gen = p.gen, mode = p.mode, t = p.t;
    /* ============================================================
     * v89.103（老板「资源运输应当采用出征界面」）：**随军辎重**（extra.cargo）
     * ------------------------------------------------------------
     * 校验在这里、扣减也在这里（与兵力同一时刻出门）：
     *   · 库存够不够；· 运力够不够（随军载重 = Σ 兵数 × 兵种载重）。
     * 抵达时由 expedition 的 owncity 分支按同一套运输口径落账；
     * 失败/召回在 arrive / recall 里原路退回。**任何一步都不许让货凭空消失。**
     * ============================================================ */
    var cargo = null;
    if (extra && extra.cargo) {
      cargo = {};
      for (var ck in extra.cargo) {
        var cn = Math.floor(extra.cargo[ck] || 0);
        if (cn <= 0) continue;
        if (GAME.TRANSPORT_KEYS.indexOf(ck) < 0) continue;
        var chave = Math.floor(GAME.res(city)[ck] || 0);
        if (chave < cn) return { ok: false, msg: GAME.resName(ck) + '不足（现有 ' + U.fmt(chave) + '）' };
        cargo[ck] = cn;
      }
      if (!Object.keys(cargo).length) cargo = null;
      if (cargo) {
        var _capW = GAME.cargoCapOf(army), _needW = GAME.cargoLoadOf(cargo);
        if (_needW > _capW) {
          return { ok: false, msg: '运力不足：辎重 ' + U.fmt(_needW) + ' ＞ 随军载重 ' + U.fmt(_capW)
            + '（多带民夫 / 辎重车）' };
        }
      }
    }
    /* v86（老板「按计划进行」· G1）：计谋 —— 校验与计费在出发时完成；
       效果由抵达时的 expedition 读 opts.scheme（行军途中不占战斗状态）。 */
    var scheme = null;
    if (schemeId) {
      var schk = GAME.schemePrepare(schemeId, t, gen);
      if (!schk.ok) return schk;
      GAME.schemeUse(schemeId, t, gen);
      scheme = schemeId;
    }

    for (var a in army) city.army[a] -= army[a];
    var cargoTxt = '';
    if (cargo) {
      var _Rc = GAME.res(city);
      var _parts = [];
      for (var ck2 in cargo) {
        _Rc[ck2] = (_Rc[ck2] || 0) - cargo[ck2];
        _parts.push(GAME.resName(ck2) + U.fmt(cargo[ck2]));
      }
      cargoTxt = '　辎重 ' + _parts.join('/');
    }
    GAME.setStaNow(gen, GAME.staNow(gen) - mode.stamina);   /* v66：走唯一写入口 */
    gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
    gen.status = 'march';

    var to = { x: t.x, y: t.y };
    var total = GAME.march.travelTime({ x: city.x, y: city.y, cityId: city.id }, to, army, null, gen);
    /* v86：千里奔袭 —— 本次行军 +30%（只影响这一趟，不改全局速度链） */
    if (scheme === 'benxi') {
      var _bx = GAME.schemeOf('benxi');
      total = Math.round(total / (1 + (_bx ? _bx.eff.marchPct : 0)));
    }
    /* v89.94（B2 · E2）：围师必久 —— 围困行军 ×1.5（多出来的时间就是"围"） */
    if (opsId === 'encircle') {
      total = Math.round(total * (((DATA.SIEGE || {}).encircle || {}).marchMul || 1.5));
    }
    s.marches = s.marches || [];
    var m = {
      id: 'mr' + (GAME._marchSeq = (GAME._marchSeq || 0) + 1),
      cityId: city.id, genId: gen.id, modeId: mode.id,
      target: target, tx: t.x, ty: t.y, name: t.name, kind: t.kind,
      army: U.deep(army), elapsed: 0, totalTime: total,
      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
      ops: opsId,                        /* v89.94：随军战法（抵达时读） */
      cargo: cargo || null,              /* v89.103：随军辎重（抵达落账 / 失败退回） */
    };
    s.marches.push(m);
    var left = Math.max(0, total / GAME.timeScale());
    GAME.log.war('🛫 ' + gen.name + ' 率军出发 → ' + t.name + '（' + mode.name
      + (opsId !== 'assault' ? ' · ' + GAME.opsOf(opsId).name : '')
      + cargoTxt
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');
    if (GAME.sfx) GAME.sfx('march');      /* v89.93（E4）：出征音 */
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
      GAME.log.war('⚠️ 行军中断：' + m.name + ' 方向的主将已不在，大军折返 ' + ((city && city.name) || ''));
      return null;
    }
    /* v89.86（整改 P-25）：军账守恒护栏 —— 详见 `_expArmySettled` 定义。
       抵达结算失败（目标在途中熄灭：据点当日已拔除 / 城池被夺 …）或抛异常时，
       把仍挂在行军账上的兵力原路退回，绝不让"派出去的兵"凭空消失。 */
    _expArmySettled = false;
    var r = null, err = null;
    try {
      r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
        { arrived: true, cityId: m.cityId, scheme: m.scheme || null, ops: m.ops || 'assault',
          cargo: m.cargo || null });      /* v89.103：随军辎重（owncity 分支落账） */
    } catch (e) { err = e; }
    /* v89.87：观战挂起（pending）时将领**保持征战在外**，不置 idle ——
       等 finishBattle 落账后统一收尾（否则战斗中将领会被当成空闲可再派遣） */
    if (!(r && r.pending) && gen.status === 'march') gen.status = 'idle';
    if (err || !r || r.ok === false) {
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in m.army) city.army[aR] = (city.army[aR] || 0) + m.army[aR];
        /* v89.103：辎重与兵力同进退 —— 结算失败时原路退回，不许凭空消失 */
        if (m.cargo) {
          var _Rbk = GAME.res(city);
          for (var ckR in m.cargo) _Rbk[ckR] = (_Rbk[ckR] || 0) + m.cargo[ckR];
        }
        rolled = true;
      }
      _expArmySettled = true;
      var whyR = err ? '结算异常' : ((r && r.msg) || '目标已不存在');
      GAME.log.war('⚠️ ' + m.name + ' 方向进军中止（' + whyR + '）：'
        + (rolled ? '大军原路折返 ' + city.name : '军账已结，兵已入城 / 伤兵营'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[march.arrive] 抵达结算异常：', err);
      if (GAME.onMarchArrive) {
        GAME.onMarchArrive(m, { ok: false, rolled: rolled, msg: whyR, err: err ? String((err && err.message) || err) : null });
      }
      return { ok: false, rolled: rolled, msg: whyR };
    }
    if (r.result && r.result.winner === 'scout') {
      GAME.log.war('🔭 ' + gen.name + ' 侦察归来：' + m.name);
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
      /* v89.103：随军辎重同样原路回城（召回 = 这一趟没发生） */
      if (m.cargo) {
        var _Rrc = GAME.res(city);
        for (var ckC in m.cargo) _Rrc[ckC] = (_Rrc[ckC] || 0) + m.cargo[ckC];
        GAME.log.war('↩️ ' + m.name + ' 方向的辎重也已原路回 ' + city.name);
      }
      GAME.log.war('↩️ ' + m.name + ' 方向的大军已召回（兵力已归 ' + city.name + '）');
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
