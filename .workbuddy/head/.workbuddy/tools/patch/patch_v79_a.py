# -*- coding: utf-8 -*-
"""v79-A · 核心层：爵位加成 + 主城 + 神器（数据 / 状态 / 消费点）。

老板三条：

老板原文：
  1.爵位加成，可看下能加成哪些数据
  2.主城加成，每人可有1个主城，在官府界面中设置，主城名称后有【主城】标识。为主城设置特定功能
  3.神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），神器界面在君主菜单中

落点：
  data.js  —— DATA.RANK_BONUS（22 级逐级曲线）· MAIN_CITY（驻跸加成 + 迁都成本）·
              ARTIFACTS / ARTIFACT（三神器 · 供奉值门槛 · 时长与活动收益）；
              DATA.RANK 清掉两个死字段（shiyi/recruit —— 从来没消费点）
  state.js —— rankBonusOf/Num · mainCityOf/isMainCity/mainCityBonusNum/setMainCity ·
              artPts/artLevelOf/artTick/artGain/artifactBonusNum · cityBonusNum（唯一汇总口）；
              新档加 mainCityId/artifacts 字段；两条时间链挂 artTick
  domain.js—— storeCapOf / buildSlots / genSlotsOf 三处并入 cityBonusNum
  battle.js—— 野地上限并入 cityBonusNum('wildCap') · 声望获得 ×神器 repPct ·
              占城给供奉值（特殊活动）
  systems.js —— 爵位晋升给供奉值（特殊活动）
"""
import io
import re
import sys

DATA = r'E:\Deepseekdb\js\data.js'
ST = r'E:\Deepseekdb\js\state.js'
DOM = r'E:\Deepseekdb\js\domain.js'
BAT = r'E:\Deepseekdb\js\battle.js'
SYS = r'E:\Deepseekdb\js\systems.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. data.js ==')
# A1 · DATA.RANK 清掉两个从未消费的死字段（显示占位：食邑/招募）
t = io.open(DATA, encoding='utf-8', newline='').read()
n_rm = len(re.findall(r', shiyi: \d+, recruit: \d+ \},', t))
if n_rm:
    t2 = re.sub(r', shiyi: \d+, recruit: \d+ \},', ' },', t)
    io.open(DATA, 'w', encoding='utf-8', newline='').write(t2)
    print('  ✓ A1 DATA.RANK 死字段清理（%d 行：shiyi/recruit 从未有消费点）' % n_rm)
else:
    print('  · A1 已清理（跳过）')

# A2 · 爵位加成曲线（挂在 DATA.RANK 之后）
patch(DATA,
"""  DATA.RANK = [""",
"""  /* v79（老板「爵位加成，可看下能加成哪些数据」）：爵位的**第二层回报** ——
     第一层是俸禄（gold/h），这一层挂真实经营加成。22 级逐级递增，曲线在这里生成：
       产/税 +1%/级（封顶 +21%）· 仓储 +2%/级 · Lv8 起同时建造 +1（Lv16 起 +2）
       · 每 3 级 +1 附属野地上限 · 每 4 级 每城将领席位 +1
     消费统一走 GAME.cityBonusNum（与名城/主城/神器同池），不许各处自拼。
     ⚠️ 原表的 shiyi（食邑）/ recruit（招募）两个字段从无消费点（纯显示占位），v79 一并清掉。 */
  DATA.RANK_BONUS = [];
  DATA.RANK = [""",
'A2a RANK 注释头')

patch(DATA,
"""  /* 取某城的档位加成（唯一出口：别处不要再按 type 分支） */""",
"""  /* v79（老板）：主公驻跸之城 —— 「每人可有 1 个主城，在官府界面中设置」。
     主城吃一层**驻跸加成**（下面是全部可加点）；标志走 ui.cityLabelHTML / 下拉框 / 君主列表。 */
  DATA.MAIN_CITY = {
    bonus: { prodPct: 0.15, taxPct: 0.10, storePct: 0.30, genCap: 1, wildCap: 1 },
    moveCost: { gold: 100000 },   // 已有主城时改设收成本（首设免费）
    desc: '君主驻跸：本城产量 +15%、税收 +10%、仓储 +30%、将领席位 +1、附属野地上限 +1',
  };

  /* v79（老板）：「神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），
     神器界面在君主菜单中」——
     三件神器共用一个**供奉值**池（s.artifacts.pts）：时长自动积累（主要），
     特殊活动（攻占城池 / 爵位晋升）大额加速；等级 = 供奉值翻过的门槛数。
     每级加成走 per（perLv），消费统一走 GAME.artifactBonusNum。 */
  DATA.ARTIFACT = {
    maxLv: 10,
    pts: [60, 150, 300, 600, 1000, 1800, 3000, 5000, 8000, 12000],  // 升 Lv(i+1) 门槛
    perGameHour: 3,                              // 游戏时长：每游戏小时 +3 供奉（主要来源）
    capturePts: { fort: 20, county: 40, jun: 80, zhou: 200, capital: 500 },  // 攻占城池
    promotePts: 300,                             // 爵位晋升一次
  };
  DATA.ARTIFACTS = [
    { id: 'yuxi', name: '传国玉玺', icon: '👑', theme: '受命于天',
      per: { taxPct: 0.02, repPct: 0.05 },
      desc: '受命于天，既寿永昌。每级：税收 +2%、声望获得 +5%' },
    { id: 'shending', name: '九州神鼎', icon: '🏺', theme: '定鼎九州',
      per: { prodPct: 0.02, storePct: 0.03 },
      desc: '禹铸九鼎，以镇九州。每级：全境产量 +2%、仓储 +3%' },
    { id: 'hetu', name: '河图洛书', icon: '📜', theme: '天机演算',
      per: { genExpPct: 0.06, storePct: 0.01 },
      desc: '河出图，洛出书。每级：将领经验 +6%、仓储 +1%' },
  ];

  /* 取某城的档位加成（唯一出口：别处不要再按 type 分支） */""",
'A2b MAIN_CITY + ARTIFACTS')

print()
print('== B. state.js ==')
# B1 · 加成汇总层（挂在 perkNum 之后）
patch(ST,
"""  GAME.perkNum = function (city, key) {
    var p = GAME.perkOf(city);
    return (p && p[key]) || 0;
  };""",
"""  GAME.perkNum = function (city, key) {
    var p = GAME.perkOf(city);
    return (p && p[key]) || 0;
  };

  /* ============================================================
   * v79 加成四层（爵位 / 主城 / 神器 + 名城档位）—— **唯一汇总出口**
   * ------------------------------------------------------------
   * 老板三条：「爵位加成」「主城加成」「神器加成」。
   * 它们的落点是同一批经营量（产量/税收/仓储/席位/野地上限…），
   * 所以**合并到一个函数**里相加 —— 消费点永远只调 cityBonusNum，
   * 别处再拼第二个汇总就是本项目的经典失效模式（改了不生效）。
   * ============================================================ */
  /* ① 爵位加成：22 级曲线在 DATA.RANK_BONUS（与 DATA.RANK 同序） */
  GAME.rankBonusOf = function (i) {
    return (DATA.RANK_BONUS || [])[i == null ? ((GAME.state && GAME.state.rank) || 0) : i] || {};
  };
  GAME.rankBonusNum = function (key) {
    var s = GAME.state;
    return (GAME.rankBonusOf((s && s.rank) || 0)[key]) || 0;
  };

  /* ② 主城：每人 1 个（s.mainCityId；新档为空，官府里设） */
  GAME.mainCityOf = function () {
    var s = GAME.state;
    if (!s || !s.mainCityId) return null;
    return GAME.cityById(s.mainCityId);
  };
  GAME.isMainCity = function (city) {
    var s = GAME.state;
    return !!(s && city && s.mainCityId && city.id === s.mainCityId);
  };
  GAME.mainCityBonusNum = function (city, key) {
    if (!GAME.isMainCity(city)) return 0;
    return (DATA.MAIN_CITY.bonus || {})[key] || 0;
  };
  /* 设为主城（首设免费；已有主城时改设收 DATA.MAIN_CITY.moveCost） */
  GAME.setMainCity = function (cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (GAME.isMainCity(city)) return { ok: false, msg: '「' + city.name + '」已是主城' };
    var cost = GAME.mainCityOf() ? (DATA.MAIN_CITY.moveCost || {}) : null;
    if (cost && cost.gold) {
      if ((s.res.gold || 0) < cost.gold) {
        return { ok: false, msg: '迁都需 ' + U.fmt(cost.gold) + ' 金（从府库扣）' };
      }
      s.res.gold -= cost.gold;
    }
    s.mainCityId = city.id;
    GAME.log('🏯 定「' + city.name + '」为主城（' + (DATA.MAIN_CITY.desc || '') + '）');
    return { ok: true, msg: '「' + city.name + '」定为主城' + (cost && cost.gold ? '（迁都花费 ' + U.fmt(cost.gold) + ' 金）' : '') };
  };

  /* ③ 神器：共用一个供奉值池（时长为主 + 活动加速），等级 = 翻过的门槛数 */
  GAME.artStore = function () {
    var s = GAME.state;
    if (!s) return { pts: 0 };
    if (!s.artifacts) s.artifacts = { pts: 0 };
    return s.artifacts;
  };
  GAME.artPts = function () { return GAME.artStore().pts || 0; };
  GAME.artLevelOf = function (artId) {
    var pts = GAME.artPts(), T = (DATA.ARTIFACT && DATA.ARTIFACT.pts) || [], lv = 0;
    for (var i = 0; i < T.length; i++) { if (pts >= T[i]) lv = i + 1; }
    return Math.min(lv, (DATA.ARTIFACT && DATA.ARTIFACT.maxLv) || 10);
  };
  GAME.artGain = function (n, why) {
    n = Math.round(n || 0);
    if (n <= 0) return 0;
    var st = GAME.artStore();
    var lv0 = GAME.artLevelOf();
    st.pts += n;
    var lv1 = GAME.artLevelOf();
    GAME.log('🏺 供奉 +' + U.fmt(n) + (why ? '（' + why + '）' : '') + '　当前 ' + U.fmt(st.pts));
    if (lv1 > lv0) {
      (DATA.ARTIFACTS || []).forEach(function (a) {
        GAME.log('🏺 「' + a.name + '」升至 Lv' + lv1 + ' —— ' + ui77ArtEff(a, lv1));
      });
    }
    return n;
  };
  /* 神器加成（唯一消费口）：Σ 每件神器 等级 × per[key] */
  GAME.artifactBonusNum = function (key) {
    var out = 0;
    (DATA.ARTIFACTS || []).forEach(function (a) {
      var lv = GAME.artLevelOf(a.id);
      if (!a.per || !a.per[key]) return;
      out += a.per[key] * lv;
    });
    return out;
  };
  /* 神器效果文案（日志与界面共用） */
  function ui77ArtEff(a, lv) {
    var parts = [];
    for (var k in (a.per || {})) {
      parts.push(({ prodPct: '产量', taxPct: '税收', storePct: '仓储', genExpPct: '将领经验', repPct: '声望获得' }[k] || k)
        + ' +' + Math.round(a.per[k] * lv * 100) + '%');
    }
    return parts.join(' · ') || '—';
  }
  GAME.artEffText = ui77ArtEff;
  /* 时长积累（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.artTick = function (secGame) {
    if (!secGame || secGame <= 0) return;
    var rate = (DATA.ARTIFACT && DATA.ARTIFACT.perGameHour) || 0;
    if (!rate) return;
    GAME.artGain(secGame / 3600 * rate, '');
  };

  /* 汇总：名城档位 + 爵位 + 主城 + 神器（四层相加，唯一出口） */
  GAME.cityBonusNum = function (city, key) {
    return GAME.perkNum(city, key) + GAME.rankBonusNum(key)
      + GAME.mainCityBonusNum(city, key) + GAME.artifactBonusNum(key);
  };""",
'B1 加成汇总层（rank/mainCity/artifact/cityBonusNum）')

# B2 · 新档字段
patch(ST,
"""      rank: 0,""",
"""      rank: 0,
      mainCityId: null,          // v79：主城（官府里设；驻跸加成 + 【主城】标识）
      artifacts: { pts: 0 },     // v79：神器供奉值（时长自动 + 活动加速）""",
'B2 新档字段')

# B3 · 产量/税收并入 cityBonusNum
patch(ST,
"""    var perkProd = 1 + GAME.perkNum(city, 'prodPct');""",
"""    /* v79：「本城产量」加成 = 名城档位 + 爵位 + 主城 + 神器（唯一汇总口） */
    var perkProd = 1 + GAME.cityBonusNum(city, 'prodPct');""",
'B3a 产量汇总')
patch(ST,
"""    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.perkNum(city, 'taxPct'))
      * (DATA.GOLD_GATE.tax || 1);""",
"""    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct'))
      * (DATA.GOLD_GATE.tax || 1);""",
'B3b 税收汇总')

# B4 · 两条时间链挂 artTick
patch(ST,
"""    if (GAME.tickFarm) GAME.tickFarm(secReal * ts);""",
"""    if (GAME.tickFarm) GAME.tickFarm(secReal * ts);
    if (GAME.artTick) GAME.artTick(secReal * ts);   // v79：神器供奉（离线补算同口径）""",
'B4a 离线链')
patch(ST,
"""    if (GAME.tickFarm) GAME.tickFarm(dtReal * ts);""",
"""    if (GAME.tickFarm) GAME.tickFarm(dtReal * ts);
    if (GAME.artTick) GAME.artTick(dtReal * ts);   // v79：神器供奉（在线主循环）""",
'B4b 在线链')

print()
print('== C. domain.js ==')
patch(DOM,
"""    return Math.round(base * (1 + techB('store'))
      * (1 + (GAME.masteryOf(city, 'cangku') ? 0.5 : 0))
      * (1 + GAME.perkNum(city, 'storePct')));""",
"""    return Math.round(base * (1 + techB('store'))
      * (1 + (GAME.masteryOf(city, 'cangku') ? 0.5 : 0))
      * (1 + GAME.cityBonusNum(city, 'storePct')));   /* v79：+ 爵位/主城/神器 仓储 */""",
'C1 仓储汇总')
patch(DOM,
"""    var base = 2 + GAME.mastery('buildSlot', null) + GAME.perkNum(city, 'buildSlot');""",
"""    var base = 2 + GAME.mastery('buildSlot', null) + GAME.cityBonusNum(city, 'buildSlot');   /* v79：+ 爵位建造位 */""",
'C2 建造队列汇总')
patch(DOM,
"""  GAME.genSlotsOf = function (city) {
    if (!city) return 0;
    /* v28：招贤馆满级专精 —— 房间 +2 */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0);
  };""",
"""  GAME.genSlotsOf = function (city) {
    if (!city) return 0;
    /* v28：招贤馆满级专精 —— 房间 +2
       v79：+ 爵位 / 主城 的将领席位加成（cityBonusNum 汇总口） */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0)
      + GAME.cityBonusNum(city, 'genCap');
  };""",
'C3 将领席位汇总')

print()
print('== D. battle.js ==')
# D1 · 野地上限并入汇总
patch(BAT,
"""          var limit = GAME.buildingLevel(city, 'guanfu') || 1;""",
"""          /* v79：附属野地上限 = 官府等级 + 爵位/主城加成（唯一汇总口） */
          var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');""",
'D1 野地上限汇总')
# D2 · 声望获得 ×神器 repPct
patch(BAT,
"""    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));""",
"""    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1)
      * (1 + GAME.artifactBonusNum('repPct')));   /* v79：传国玉玺 —— 声望获得 +5%/级 */""",
'D2 声望 ×神器')
# D3 · 占城给供奉值（特殊活动）
patch(BAT,
"""    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);""",
"""    /* v79（神器 · 特殊活动）：开疆拓土 → 供奉值大额入账（按城档折算） */
    if (GAME.artGain) {
      GAME.artGain(((DATA.ARTIFACT || {}).capturePts || {})[npcCity.type] || 40, '开疆拓土 · ' + npcCity.name);
    }
    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);""",
'D3 占城供奉')
# D4 · 将领经验 ×神器 genExpPct
patch(BAT,
"""  GAME.battle.gainExp = function (gen, amount, why) {
    amount = Math.max(0, Math.round(amount || 0));""",
"""  GAME.battle.gainExp = function (gen, amount, why) {
    amount = Math.max(0, Math.round(amount || 0));
    /* v79：河图洛书 —— 将领经验 +6%/级（唯一消费口） */
    if (amount > 0 && GAME.artifactBonusNum) {
      amount = Math.round(amount * (1 + GAME.artifactBonusNum('genExpPct')));
    }""",
'D4 经验 ×神器')

print()
print('== E. systems.js ==')
patch(SYS,
"""    s.rank += 1;
    GAME.log('晋升爵位：' + DATA.RANK[s.rank].name);""",
"""    s.rank += 1;
    /* v79（神器 · 特殊活动）：爵位晋升 → 供奉值大额入账 */
    if (GAME.artGain) GAME.artGain(((DATA.ARTIFACT || {}).promotePts) || 0, '爵位晋升 · ' + DATA.RANK[s.rank].name);
    GAME.log('晋升爵位：' + DATA.RANK[s.rank].name);""",
'E1 晋升供奉')

print()
print('全部完成。')
