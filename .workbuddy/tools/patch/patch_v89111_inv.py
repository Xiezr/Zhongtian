# -*- coding: utf-8 -*-
"""
v89.111 来袭改造 —— 每日 9 时一场（目标城轮转）+ 提前 4 时只报一次 + 警讯含剩余时间
纪律：先备份 → 内存全量替换逐条 assert → 落盘 → node --check
跑法：python .workbuddy/tools/patch/patch_v89111_inv.py
"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')
NODE = r'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'

files = ['js/data.js', 'js/state.js', 'js/ui.js']
orig = {}
for f in files:
    p = os.path.join(R, f)
    orig[f] = io.open(p, encoding='utf-8').read()
    shutil.copy2(p, os.path.join(BK, os.path.basename(f).replace('.js', '.v89110.js')))
print('[备份] 3 个文件 → .workbuddy/backup/*.v89110.js')

new = dict(orig)
def rep(f, a, b, n=1):
    s = new[f]
    assert a in s, '未命中[' + f + ']：' + a[:90].replace('\n', '⏎')
    assert s.count(a) == n, '命中数不符[' + f + '] 期望%d 实际%d：%s' % (n, s.count(a), a[:60].replace('\n', '⏎'))
    new[f] = s.replace(a, b, n)

# ============================================================
# ① data.js：INVASION 新口径
# ============================================================
rep('js/data.js', """  DATA.INVASION = {
    enabled: true,
    unlockCities: 2,          // 玩家达到几座城才开始有人来打（别一开局就挨打）
    baseDays: 4,              // 基础间隔（游戏日）
    minDays: 2,               // 间隔下限（城越多越紧）
    tightenPerCity: 0.12,     // 每多一座城，间隔缩短 12%
    warnHours: 12,            // 基础预警提前量（游戏小时）
    beaconBonusHours: 12,     // 每级烽火台额外提前（小时）
    warnBeaconMax: 3,         // 烽火台记级上限（超过按此算）
    ratioMin: 0.28,           // 来袭战力 ÷ 玩家全境战力 —— 下界""",
"""  /* v89.111（老板「自动攻城固定每日9点即可，提前4h提醒一次，无需频繁报告来袭预警」）：
     来袭从"每城各自 2~4 天的随机间隔"改成**每天固定一场**：
       · 来犯时刻 = 每天 `attackHour` 点（游戏时）—— 全场唯一；
       · 目标城按日**轮转**（cities[日序 % 城数]）—— 确定、可预判、人人有份；
       · 预警 = 提前 `warnHours` 游戏时**只报一次**（默认 9 点来犯 → 5 点报）。
     退役口径：baseDays / minDays / tightenPerCity（旧间隔）；
       beaconBonusHours / warnBeaconMax（烽火台不再改"提前量"，改管**情报详略**）。 */
  DATA.INVASION = {
    enabled: true,
    unlockCities: 2,          // 玩家达到几座城才开始有人来打（别一开局就挨打）
    attackHour: 9,            // ⏰ 来犯时刻（游戏小时）：每天一场，只在这个点
    warnHours: 4,             // 预警提前量（固定；到点前只报一次）
    intelBeaconMax: 3,        // 烽火台**情报等级**上限（Lv1 +战力 / Lv2 +兵种明细）
    ratioMin: 0.28,           // 来袭战力 ÷ 玩家全境战力 —— 下界""")

# ============================================================
# ② state.js
# ============================================================
S = 'js/state.js'

# ②-0 模块注释
rep(S, """   *   invasionTick(gameHours)   时间轮推进（**在线 tickOnce 与离线 simulateBulk 共用**）
   *   invasionDueAt(city)       下次来袭时间（游戏秒；供界面读）
   *   armyPowerOf(city)         本城兵力战力（单兵战力复用 story.troopPower，不另造出口）
   *   defensePowerOf(city)      本城守备力 —— **城防在这里被真正消费**
   *   invasionPowerOf(city)     本次来袭规模
   *   invasionResolve(city)     结算
   * 状态存在 `city.inv = { nextAt, warned }` —— 跨时间且会被修改，**必须入存档**。""",
"""   *   invasionTick(gameHours)   时间轮推进（**在线 tickOnce 与离线 simulateBulk 共用**）
   *   invasionDueAt(city)       本城下一次被袭时刻（游戏秒；供界面读）
   *   invasionTargetOfDay(day)  第 day 天的目标城（按日轮转）
   *   invasionSrcOf(city, day)  本场来袭的势力（唯一出口：预警与结算**同一个**）
   *   invasionIntelTextOf(...)  警讯敌情（按烽火台情报等级给详略）
   *   armyPowerOf(city)         本城兵力战力（单兵战力复用 story.troopPower，不另造出口）
   *   defensePowerOf(city)      本城守备力 —— **城防在这里被真正消费**
   *   invasionPowerOf(city)     本次来袭规模
   *   invasionResolve(city)     结算
   * v89.111（老板「固定每日9点」）：状态改为**全局** `s.inv = { lastDay, warnedDay }`
   *   —— 跨时间且会被修改，**必须入存档**；老的 `city.inv`（每城各排各的）随之退役。""")

# ②-1 排期：invasionDueAt + invasionIntervalSec → 新一组唯一出口
rep(S, """  /* 下次来袭时间（游戏秒）。首次进入解锁条件时排期，之后按间隔滚动。 */
  GAME.invasionDueAt = function (city) {
    var I = DATA.INVASION || {};
    if (!city) return 0;
    var s = GAME.state;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || s.settings.invasion === false) return 0;
    if ((s.cities || []).length < need) return 0;
    if (!city.inv) return 0;
    return city.inv.nextAt || 0;
  };

  /* 间隔（游戏秒）：城越多越紧，但不低于 minDays */
  GAME.invasionIntervalSec = function () {
    var I = DATA.INVASION || {};
    var s = GAME.state;
    var n = (s.cities || []).length;
    var days = (I.baseDays || 4) - Math.max(0, n - 1) * (I.tightenPerCity || 0);
    days = Math.max(I.minDays || 2, days);
    return Math.round(days * 86400);
  };""",
"""  /* ============================================================
   * v89.111（老板）：「自动攻城固定每日9点即可，提前4h提醒一次，
   *   无需频繁报告来袭预警」+「其他势力攻打，烽火警讯显示其军队来袭剩余时间」
   * ------------------------------------------------------------
   * 节奏 = **每天一场**：
   *   · 来犯时刻唯一：每天 `attackHour`（默认 9）点整（游戏秒 = 日序×86400 + 9×3600）；
   *   · 目标城按日**轮转**：`cities[日序 % 城数]` —— 确定、可预判、人人有份；
   *   · 预警只报一次：提前 `warnHours`（默认 4）小时那条，进窗即报、当天不补报。
   * 旧的"每城各排各的 + 城越多间隔越短"整套口径退役（invasionIntervalSec 已删）。
   * ============================================================ */
  GAME.invasionDayOf = function (sec) { return Math.floor((sec || 0) / 86400); };
  /* 第 day 天的来犯时刻（游戏秒） */
  GAME.invasionDueOfDay = function (day) {
    var I = DATA.INVASION || {};
    return Math.floor(day) * 86400 + (I.attackHour == null ? 9 : I.attackHour) * 3600;
  };
  /* 第 day 天的目标城（按日轮转；城列表为空 → null） */
  GAME.invasionTargetOfDay = function (day) {
    var s = GAME.state;
    var list = (s && s.cities) || [];
    if (!list.length) return null;
    var n = list.length;
    var i = ((Math.floor(day) % n) + n) % n;
    return list[i];
  };
  /* 本城**下一次**被袭时刻（游戏秒）—— 界面 / 烽火台闪烁 / 断言都读这里 */
  GAME.invasionDueAt = function (city) {
    var I = DATA.INVASION || {};
    if (!city) return 0;
    var s = GAME.state;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || (s.settings && s.settings.invasion === false)) return 0;
    var list = s.cities || [];
    if (list.length < need) return 0;
    var idx = list.indexOf(city);
    if (idx < 0) return 0;
    var now = (s.world && s.world.elapsed) || 0;
    var day = GAME.invasionDayOf(now);
    var n = list.length;
    var t = ((day % n) + n) % n;
    var d = day;
    if (t !== idx) d = day + (((idx - t) % n) + n) % n;      /* 轮到本城还要几天 */
    else if (now >= GAME.invasionDueOfDay(day)) d = day + n;  /* 今天的已过 → 下一轮 */
    return GAME.invasionDueOfDay(d);
  };
  /* 本场来袭的势力 —— **唯一出口**：预警报的和结算打的必须是同一个（"报谁就是谁来"） */
  GAME.invasionSrcOf = function (city, dayIdx) {
    var I = DATA.INVASION || {};
    var arr = I.sources || ['敌军'];
    return arr[Math.floor(GAME.invasionRoll('src|' + (city && city.id) + '|' + dayIdx) * arr.length)];
  };
  /* 烽火台情报等级（0 ~ intelBeaconMax）：不再改"提前量"，改管敌情详略 */
  GAME.invasionIntelLvOf = function (city) {
    var I = DATA.INVASION || {};
    return Math.min(I.intelBeaconMax == null ? 3 : I.intelBeaconMax,
      (city && GAME.buildingLevel(city, 'fenghuotai')) || 0);
  };
  /* 警讯里的敌情一段（唯一出口：烽火页与烽火警讯共用）——
     Lv0：只报势力；Lv1：+战力；Lv2+：+兵种明细（按数量取前 3 项）。 */
  GAME.invasionIntelTextOf = function (city, dayIdx) {
    var lv = GAME.invasionIntelLvOf(city);
    var txt = '「' + GAME.invasionSrcOf(city, dayIdx) + '」';
    if (lv < 1) return txt;
    var ia = GAME.invasionArmyOf ? GAME.invasionArmyOf(city, dayIdx) : null;
    if (!ia) return txt;
    if (ia.power) txt += ' · 约 ' + U.fmt(ia.power) + ' 战力';
    if (lv >= 2 && ia.army) {
      var arr = [];
      for (var k in ia.army) { if (ia.army[k]) arr.push([k, ia.army[k]]); }
      arr.sort(function (a, b) { return b[1] - a[1]; });
      var bits = arr.slice(0, 3).map(function (x) {
        return (DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : x[0]) + ' ×' + U.fmt(x[1]);
      });
      if (arr.length > 3) bits.push('等');
      if (bits.length) txt += '（' + bits.join('、') + '）';
    }
    return txt;
  };""")

# ②-2 预警窗：固定提前量 + 情报等级
rep(S, """  /* ============================================================
   * v89.107（老板）：「有警报时，建筑烽火台颜色明暗闪烁」
   * ------------------------------------------------------------
   * 预警窗 = 唯一出口。三处都读它，不许各算一份：
   *   · invasionTick 的报信分支（「🔥 烽火：…」消息）
   *   · 军务 · 烽火页（预警/布防/流水）
   *   · 城内棋盘上烽火台的闪烁（ui.buildCellHTML 挂 .alarm）
   * warnSec = (warnHours + 烽火台等级 × beaconBonusHours) 小时。
   * 烽火台没建 → bc = 0 → 窗口只有 warnHours（预警偏迟），这正是它的价值。
   * ============================================================ */
  GAME.invasionWarnSec = function (city) {
    var I = DATA.INVASION || {};
    var bc = Math.min(I.warnBeaconMax || 3, (city && GAME.buildingLevel(city, 'fenghuotai')) || 0);
    return { bc: bc, warnSec: ((I.warnHours || 12) + bc * (I.beaconBonusHours || 12)) * 3600 };
  };""",
"""  /* ============================================================
   * v89.107（老板）：「有警报时，建筑烽火台颜色明暗闪烁」
   * ------------------------------------------------------------
   * 预警窗 = 唯一出口。三处都读它，不许各算一份：
   *   · invasionTick 的报信分支（「🔥 烽火：…」消息）
   *   · 军务 · 烽火页（预警/布防/流水）
   *   · 城内棋盘上烽火台的闪烁（ui.buildCellHTML 挂 .alarm）
   * v89.111（老板「提前4h提醒一次」）：窗口改**固定提前量**（warnHours，默认 4 时），
   *   烽火台不再改变"提前量" —— 它改管**情报等级**（bc 字段即情报级，供文案用）。
   * ============================================================ */
  GAME.invasionWarnSec = function (city) {
    var I = DATA.INVASION || {};
    return { bc: GAME.invasionIntelLvOf(city), warnSec: (I.warnHours == null ? 4 : I.warnHours) * 3600 };
  };""")

# ②-3 主循环：每日一场 + 轮转目标 + 单次预警
rep(S, """  /* 时间轮推进 —— **在线 tickOnce 与离线 simulateBulk 共用这一处**。
     gameHours：本次推进经过的游戏小时数（离线补算会传一大段）。 */
  GAME.invasionTick = function (gameHours) {
    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (s.settings && s.settings.invasion === false) return 0;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if ((s.cities || []).length < need) return 0;
    var now = (s.world && s.world.elapsed) || 0;
    var fired = 0;

    s.cities.forEach(function (city) {
      if (!city.inv) city.inv = { nextAt: now + GAME.invasionIntervalSec(), warned: false };
      /* 离线可能一次跨过多个周期 —— 用 while 逐个结算，不许只判一次 */
      var guard = 0;
      while (city.inv.nextAt <= now && guard++ < 50) {
        /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；周期照常推进）。
           显式读 eff.invSkip：效果键必须有字面读取点（防死数据，smoke §71 守）。 */
        var _kc = GAME.schemeDefOf(city, 'kongcheng', now);
        if (_kc && _kc.eff.invSkip) {
          GAME.schemeDefConsume(city, 'kongcheng', now);
          GAME.log.beacon('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
          city.inv.nextAt += GAME.invasionIntervalSec();
          city.inv.warned = false;
          continue;
        }
        /* v89.109：src 提前算 —— 防御战报的标题要用它（resolve 现在真要打一仗并写战报） */
        var src = (I.sources || ['敌军'])[Math.floor(GAME.invasionRoll('src|' + city.id + '|' + city.inv.nextAt) * (I.sources || ['敌军']).length)];
        var detail = GAME.invasionResolve(city, src);
        fired++;
        var head = detail.held
          ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : (detail.lootOk
            ? '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
            : '⚠️ ' + city.name + ' 城门失守但**未被掠**（' + src + ' 未能破防）');
        var bits = [];
        for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
        if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
        if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
        if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
        if (detail.battle) bits.push('战报已入公文（' + detail.battle.rounds + ' 回合）');
        GAME.log.beacon(head + (bits.length ? '：' + bits.join('、') : ''));
        city.inv.nextAt += GAME.invasionIntervalSec();
        city.inv.warned = false;
      }
      /* 预警：进预警窗先报一次（窗口口径走唯一出口 invasionAlertOf，
         与军务·烽火页、城内烽火台闪烁同源） */
      var _al = GAME.invasionAlertOf(city);
      if (!city.inv.warned && _al) {
        city.inv.warned = true;
        GAME.log.beacon('🔥 烽火：' + city.name + ' 约 ' + _al.hrs + ' 游戏时后将有兵马犯境'
          + (_al.beaconLv > 0 ? '（烽火台 Lv' + _al.beaconLv + ' 提前预警）' : '（无烽火台，预警较迟）'));
        if (GAME.sfx) GAME.sfx('alarm');     /* v89.93（E4）：警报告警音 */
      }
    });
    return fired;
  };""",
"""  /* 时间轮推进 —— **在线 tickOnce 与离线 simulateBulk 共用这一处**。
     v89.111：结算粒度 = **天**（每个跨过的来犯时刻结算一场；离线逐日补算）。
     gameHours：本次推进经过的游戏小时数（本函数只用于语义说明，时间读 world.elapsed）。 */
  GAME.invasionTick = function (gameHours) {
    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (s.settings && s.settings.invasion === false) return 0;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if ((s.cities || []).length < need) return 0;
    var now = (s.world && s.world.elapsed) || 0;
    var day = GAME.invasionDayOf(now);
    /* 最近一个**已到**的来犯时刻所在日（今天 9 点没过就算昨天） */
    var dueDay = (now >= GAME.invasionDueOfDay(day)) ? day : (day - 1);
    if (!s.inv) s.inv = { lastDay: dueDay, warnedDay: -1 };   /* 首次：从"下一次"开始算 */
    var fired = 0;
    var guard = 0;
    /* 补算：跨过的每一天各结算一场（离线一次跨多天也不会漏） */
    while (s.inv.lastDay < dueDay && guard++ < 30) {
      var d = s.inv.lastDay + 1;
      var city = GAME.invasionTargetOfDay(d);
      if (!city) break;
      /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；当日照常推进）。
         显式读 eff.invSkip：效果键必须有字面读取点（防死数据，smoke §71 守）。 */
      var _kc = GAME.schemeDefOf(city, 'kongcheng', now);
      if (_kc && _kc.eff.invSkip) {
        GAME.schemeDefConsume(city, 'kongcheng', now);
        GAME.log.beacon('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
        s.inv.lastDay = d;
        continue;
      }
      var src = GAME.invasionSrcOf(city, d);       /* 与预警同一个出口："报谁就是谁来" */
      var detail = GAME.invasionResolve(city, src);
      fired++;
      var head = detail.held
        ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
        : (detail.lootOk
          ? '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : '⚠️ ' + city.name + ' 城门失守但**未被掠**（' + src + ' 未能破防）');
      var bits = [];
      for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
      if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
      if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
      if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
      if (detail.battle) bits.push('战报已入公文（' + detail.battle.rounds + ' 回合）');
      GAME.log.beacon(head + (bits.length ? '：' + bits.join('、') : ''));
      s.inv.lastDay = d;
    }
    /* ---- 预警：下一场的提前 warnHours 内**只报一次** ----
       （老板：「无需频繁报告来袭预警」—— 每天至多这一条；离线跨天不补报历史场次） */
    var nextDue = GAME.invasionDueOfDay(s.inv.lastDay + 1);
    var left = nextDue - now;
    var nDay = GAME.invasionDayOf(nextDue);
    var warnSec = (I.warnHours == null ? 4 : I.warnHours) * 3600;
    if (left > 0 && left <= warnSec && s.inv.warnedDay !== nDay) {
      var tgt = GAME.invasionTargetOfDay(nDay);
      if (tgt) {
        s.inv.warnedDay = nDay;
        GAME.log.beacon('🔥 烽火：' + GAME.invasionIntelTextOf(tgt, nDay) +
          ' 将于' + (nDay === day ? '今日' : '明日') + ' ' +
          (I.attackHour == null ? 9 : I.attackHour) + ' 时犯『' + tgt.name +
          '』（剩余 ' + U.dur(left) + '）');
        if (GAME.sfx) GAME.sfx('alarm');     /* v89.93（E4）：警报告告警音 */
      }
    }
    return fired;
  };""")

# ============================================================
# ③ ui.js：烽火页 —— 显示来袭剩余时间 + 来犯势力（老板第 2 条）
# ============================================================
U = 'js/ui.js'
rep(U, """  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* ① 预警 */
    var rows = [];
    (s.cities || []).forEach(function (ct) {
      var due = GAME.invasionDueAt(ct);
      if (!due) return;
      var al = GAME.invasionAlertOf(ct);
      var w = GAME.invasionWarnSec(ct);
      var leftH = Math.max(0, Math.round((due - now) / 3600));
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      rows.push({ ct: ct, al: al, leftH: leftH, def: def, bc: w.bc, left: due - now });
    });
    rows.sort(function (a, b) { return a.left - b.left; });
    var next = rows[0];
    out += '<div class="story-card"><div class="gold-heading">🔥 烽火 · 预警' +
      ui.help('预警窗 = ' + (DATA.INVASION.warnHours || 12) + ' 游戏时 + 烽火台每级 +' +
        (DATA.INVASION.beaconBonusHours || 12) + ' 时（最多 Lv' + (DATA.INVASION.warnBeaconMax || 3) +
        ' 加成）。\\n进窗即有警报：**城内烽火台会明暗闪烁**。\\n预警只报一次，来袭由 invasionTick 结算。') + '</div>';
    if (!rows.length) {
      out += '<div class="q-empty">暂无排期 —— 拥有 2 座以上城池后，敌军会定期来犯' +
        '（城越多间隔越短）。</div></div>';
    } else {
      out += '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' +
        (next.al ? '<b style="color:var(--red-light);">⚠ 警报中</b>：' + U.escape(next.ct.name) +
            ' 约 ' + next.leftH + ' 游戏时后来袭' : '最近一场：' + U.escape(next.ct.name) +
            ' 约 ' + next.leftH + ' 游戏时后') + '</div>' +
        '<table class="tbl"><thead><tr><th>城池</th><th class="ctr">下次来袭</th>' +
        '<th class="ctr">烽火台</th><th class="num">守备力</th><th class="ctr">状态</th></tr></thead><tbody>' +
        rows.slice(0, 12).map(function (r) {
          return '<tr><td>' + (r.al ? '🔥 ' : '') + U.escape(r.ct.name) + '</td>' +
            '<td class="ctr">' + r.leftH + ' 游戏时</td>' +
            '<td class="ctr">' + (r.bc > 0 ? 'Lv' + r.bc : '<span style="color:var(--text-dim);">无</span>') + '</td>' +
            '<td class="num">' + U.fmt(r.def) + '</td>' +
            '<td class="ctr">' + (r.al
              ? '<b style="color:var(--red-light);">警报中（闪烁）</b>'
              : '<span style="color:var(--text-dim);">排队中</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (rows.length > 12 ? '<div class="ui-sub" style="text-align:center;">另有 ' + (rows.length - 12) + ' 城未列出</div>' : '') +
        '</div>';
    }""",
"""  /* 下次来袭的显示文本（v89.111）：绝对（今日/明日 9 时）+ **剩余时间**（老板第 2 条） */
  ui.invDueText = function (due, now) {
    var AH = (DATA.INVASION.attackHour == null ? 9 : DATA.INVASION.attackHour);
    var dDue = GAME.invasionDayOf(due), dNow = GAME.invasionDayOf(now);
    var dayTxt = dDue === dNow ? '今日' : (dDue === dNow + 1 ? '明日' : ((dDue - dNow) + ' 天后'));
    return dayTxt + ' ' + AH + ' 时' +
      '<br><span style="color:var(--text-dim);font-size:var(--fs-sub);">剩余 ' +
      U.dur(Math.max(0, due - now)) + '</span>';
  };
  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* ① 预警 —— v89.111（老板）：每日 9 时一场（目标轮转）；警讯显示**来袭剩余时间** */
    var rows = [];
    (s.cities || []).forEach(function (ct) {
      var due = GAME.invasionDueAt(ct);
      if (!due) return;
      var al = GAME.invasionAlertOf(ct);
      var w = GAME.invasionWarnSec(ct);
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      rows.push({ ct: ct, al: al, due: due, def: def, bc: w.bc, left: due - now });
    });
    rows.sort(function (a, b) { return a.left - b.left; });
    var next = rows[0];
    var AH = (DATA.INVASION.attackHour == null ? 9 : DATA.INVASION.attackHour);
    out += '<div class="story-card"><div class="gold-heading">🔥 烽火 · 预警' +
      ui.help('来犯固定在**每日 ' + AH + ' 时**（游戏时间），目标城按日轮转。\\n提前 ' +
        (DATA.INVASION.warnHours == null ? 4 : DATA.INVASION.warnHours) +
        ' 游戏时**只报一次**，警讯里含来袭剩余时间。\\n进窗后：城内烽火台会明暗闪烁。\\n' +
        '烽火台越高 → 警讯里的敌情越细（Lv1 +战力 · Lv2 +兵种明细）。') + '</div>';
    if (!rows.length) {
      out += '<div class="q-empty">暂无排期 —— 拥有 2 座以上城池后，敌军**每日 ' + AH +
        ' 时**来犯（目标城按日轮转）。</div></div>';
    } else {
      out += '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' +
        (next.al ? '<b style="color:var(--red-light);">⚠ 警报中</b>：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left)) + '（' + AH + ' 时来犯）'
          : '最近一场：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left))) + '</div>' +
        '<table class="tbl"><thead><tr><th>城池</th><th class="ctr">下次来袭</th>' +
        '<th>来犯</th><th class="ctr">烽火台</th><th class="num">守备力</th><th class="ctr">状态</th></tr></thead><tbody>' +
        rows.slice(0, 12).map(function (r) {
          return '<tr><td>' + (r.al ? '🔥 ' : '') + U.escape(r.ct.name) + '</td>' +
            '<td class="ctr">' + ui.invDueText(r.due, now) + '</td>' +
            '<td>' + U.escape(GAME.invasionIntelTextOf(r.ct, GAME.invasionDayOf(r.due))) + '</td>' +
            '<td class="ctr">' + (r.bc > 0 ? 'Lv' + r.bc : '<span style="color:var(--text-dim);">无</span>') + '</td>' +
            '<td class="num">' + U.fmt(r.def) + '</td>' +
            '<td class="ctr">' + (r.al
              ? '<b style="color:var(--red-light);">警报中（闪烁）</b>'
              : '<span style="color:var(--text-dim);">待命</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (rows.length > 12 ? '<div class="ui-sub" style="text-align:center;">另有 ' + (rows.length - 12) + ' 城未列出</div>' : '') +
        '</div>';
    }""")

# ============================================================
# 落盘 + 自检
# ============================================================
for f in files:
    io.open(os.path.join(R, f), 'w', encoding='utf-8', newline='').write(new[f])
print('[落盘] 3 个文件已更新')
ok = True
for f in files:
    r = subprocess.run([NODE, '--check', os.path.join(R, f)], capture_output=True, text=True)
    if r.returncode != 0:
        ok = False
        print('[语法失败] ' + f + '\n' + r.stderr[:600])
print('[自检] node --check：' + ('全部通过' if ok else '有失败'))
# 关键模式复查
st = new['js/state.js']
for pat, want, name in [
    ('GAME.invasionIntervalSec', False, '旧间隔函数已删'),
    ('city.inv.nextAt', False, '旧 per-city 排期已删'),
    ('GAME.invasionTargetOfDay = function', True, '轮转目标出口'),
    ('GAME.invasionSrcOf = function', True, '势力唯一出口'),
    ('s.inv.lastDay', True, '全局排期状态'),
]:
    hit = pat in st
    flag = 'OK' if hit == want else '!!异常!!'
    if hit != want:
        ok = False
    print('  [%s] %s（%s）' % (flag, name, '存在' if want else '不存在'))
print('[完成] ' + ('✔' if ok else '✘ 有异常'))
