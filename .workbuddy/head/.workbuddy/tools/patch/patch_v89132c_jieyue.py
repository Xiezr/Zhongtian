# -*- coding: utf-8 -*-
"""v89.132 补丁 C：节钺开拓（老板需求 3「节钺设计再开拓一下」）
- data.js：DATA.JIEYUE 新增 xcMax / genMax（两种新扩编的次数上限）+ desc 重写
- domain.js：扩编族收成唯一出口 jieyueExpandOf / jieyueExpand（city/xc/gen 三种）；
  genSlotsOf 注入「招贤纳士」席位加成（+1/次，至多 genMax）
- battle.js：marchCapOf 注入「校场扩编」容量加成（+1 万人马/次，至多 xcMax）
- ui.js：校场面板 / 招贤馆面板 各加扩编入口；君主信息表「节钺」行改为可点开面板；
  新增 ui.openJieyue（余额 + 来源 + 四用途 + 全境进度）
- main.js：新增 case（jieyue-xc / jieyue-gen / open-jieyue），jieyue-expand 改调统一出口
跑：python .workbuddy/tools/patch/patch_v89132c_jieyue.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

# ============ 1) data.js ============
d = rd('js/data.js')
old_c = ("   *   · 问鼎天授（名世 → 天授，每将 1 枚）：顶档资质从此不是\"种一株天授果\"就能到；\n"
         "   *   · 城池扩编（每城 +1 建造位，每城最多 citySlotMax 次）：城市铺开的节奏闸。\n")
new_c = ("   *   · 问鼎天授（名世 → 天授，每将 1 枚）：顶档资质从此不是\"种一株天授果\"就能到；\n"
         "   *   · 城池扩编（每城 +1 建造位，每城最多 citySlotMax 次）：城市铺开的节奏闸；\n"
         "   *   · 校场扩编（每城 出征容量 +1 万人马，每城最多 xcMax 次）· v89.132 新增：\n"
         "   *     军力投放的节奏闸 —— 只加出征容量，不动募兵名额与练兵收益；\n"
         "   *   · 招贤纳士（每城 将领席位 +1，每城最多 genMax 次）· v89.132 新增：\n"
         "   *     人才容量的节奏闸。\n")
d = rep1(d, old_c, new_c, '1a 注释块')

old_j = ("  DATA.JIEYUE = {\n"
         "    name: '节钺', icon: '🪓',\n"
         "    byTier: { county: 1, jun: 2, zhou: 3, capital: 5 },\n"
         "    rankEvery: 4,\n"
         "    citySlotMax: 2,\n"
         "    tianshouCost: 1,\n"
         "    tianshouTo: 'tian',           /* 顶档的资质 id（gen.rank 用的就是它） */\n"
         "    desc: '黄金买不到：首次攻占名城（县1/郡2/州3/都5）· 爵位每 4 档 +1。用途：名世→天授（1 枚）· 城池扩编（建造位 +1，每城至多 2 次）。',\n"
         "  };\n")
new_j = ("  DATA.JIEYUE = {\n"
         "    name: '节钺', icon: '🪓',\n"
         "    byTier: { county: 1, jun: 2, zhou: 3, capital: 5 },\n"
         "    rankEvery: 4,\n"
         "    citySlotMax: 2,               /* 城建扩编：建造位 +1（每城至多 2 次） */\n"
         "    xcMax: 2,                     /* v89.132：校场扩编 —— 出征容量 +1 万人马（每城至多 2 次） */\n"
         "    genMax: 2,                    /* v89.132：招贤纳士 —— 本城将领席位 +1（每城至多 2 次） */\n"
         "    tianshouCost: 1,\n"
         "    tianshouTo: 'tian',           /* 顶档的资质 id（gen.rank 用的就是它） */\n"
         "    desc: '黄金买不到的「开门」资源：首占名城（县1/郡2/州3/都5）· 爵位每 4 档 +1。'\n"
         "      + '用途：① 名世→天授（1 枚）② 城建扩编 · 建造位 +1 ③ 校场扩编 · 出征容量 +1 万人马 '\n"
         "      + '④ 招贤纳士 · 将领席位 +1 —— ②③④ 每城各至多 2 次。',\n"
         "  };\n")
d = rep1(d, old_j, new_j, '1b 数据表')
wr('js/data.js', d)

# ============ 2) domain.js ============
dm = rd('js/domain.js')
old_x = ("  /* 城池扩编：每城 +1 建造位，每城最多 citySlotMax 次（另扣 1 枚节钺） */\n"
         "  GAME.jieyueExpandCity = function (cityId) {\n"
         "    var s0 = GAME.state;\n"
         "    var c = cityId ? GAME.cityById(cityId) : GAME.currentCity();\n"
         "    if (!c) return { ok: false, msg: '城池不存在' };\n"
         "    var C = GAME.jieyueCfg();\n"
         "    var used = c.jieyueSlots || 0;\n"
         "    if (used >= (C.citySlotMax || 2)) {\n"
         "      return { ok: false, msg: c.name + ' 已扩编 ' + used + ' 次（每城上限 ' + (C.citySlotMax || 2) + ' 次）' };\n"
         "    }\n"
         "    var sp = GAME.jieyueSpend(1, '扩编 · ' + c.name);\n"
         "    if (!sp.ok) return sp;\n"
         "    c.jieyueSlots = used + 1;\n"
         "    GAME.log('🏗️ ' + c.name + ' 扩编：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格）');\n"
         "    return { ok: true, msg: c.name + ' 扩编成功：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格，已用节钺 '\n"
         "      + c.jieyueSlots + '/' + (C.citySlotMax || 2) + '）' };\n"
         "  };\n")
new_x = r'''  /* ============================================================
   * v89.132（老板「节钺设计再开拓一下」）：**扩编族** —— 三种「编制 +1」共用一套口径。
   * ------------------------------------------------------------
   *   · 城建扩编（city）：建造位 +1（每城至多 citySlotMax）—— v89.95 既有；
   *   · 校场扩编（xc）  ：出征容量 +1 万人马（等效校场 +1 级；**只加容量口径**，
   *     募兵名额 / 练兵收益仍由建筑等级决定，不随之膨胀）—— v89.132 新增；
   *   · 招贤纳士（gen） ：本城将领席位 +1（进 genSlotsOf 唯一出口）—— v89.132 新增。
   * 判据、消耗、进度（used/max）全走 jieyueExpandOf；界面只读它，不许各算一份。
   * 前置：xc 须有校场、gen 须有招贤馆（没建筑就谈不上"扩编"）。
   * ============================================================ */
  GAME.JIEYUE_KIND = {
    city: { field: 'jieyueSlots', max: 'citySlotMax', label: '城建扩编' },
    xc:   { field: 'jieyueXc',    max: 'xcMax',       label: '校场扩编' },
    gen:  { field: 'jieyueGen',   max: 'genMax',      label: '招贤纳士' }
  };
  GAME.jieyueExpandOf = function (city, kind) {
    var C = GAME.jieyueCfg();
    var K = GAME.JIEYUE_KIND[kind];
    if (!city || !K) return { ok: false, used: 0, max: 0, msg: '参数无效' };
    var max = C[K.max] || 2;
    var used = city[K.field] || 0;
    if (kind === 'xc' && !(GAME.buildingLevel(city, 'xiaochang') > 0)) {
      return { ok: false, used: used, max: max, msg: '本城尚无校场 —— 先建校场，再谈扩编' };
    }
    if (kind === 'gen' && !(GAME.buildingLevel(city, 'zhaoxianguan') > 0)) {
      return { ok: false, used: used, max: max, msg: '本城尚无招贤馆 —— 先建招贤馆，再谈纳士' };
    }
    if (used >= max) {
      return { ok: false, used: used, max: max,
        msg: city.name + ' 已扩编 ' + used + ' 次（每城上限 ' + max + ' 次）' };
    }
    if (GAME.jieyueOf() < 1) {
      return { ok: false, used: used, max: max,
        msg: '节钺不足（需 1 枚）—— 节钺只能靠攻占名城与爵位赏赐获得' };
    }
    return { ok: true, used: used, max: max };
  };
  GAME.jieyueExpand = function (kind, cityId) {
    var c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var K = GAME.JIEYUE_KIND[kind];
    var chk = GAME.jieyueExpandOf(c, kind);
    if (!chk.ok) return chk;
    var sp = GAME.jieyueSpend(1, K.label + ' · ' + c.name);
    if (!sp.ok) return sp;                       /* 与前面判据同源，正常不会走到 */
    c[K.field] = (c[K.field] || 0) + 1;
    var msg = {
      city: c.name + ' 扩编成功：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格，已用节钺 '
        + c[K.field] + '/' + chk.max + '）',
      xc: c.name + ' 校场扩编：出征容量 +1 万人马（现 ' + U.fmt(GAME.battle.marchCapOf(c))
        + '，已用节钺 ' + c[K.field] + '/' + chk.max + '）',
      gen: c.name + ' 招贤纳士：将领席位 +1（现 ' + GAME.genSlotsOf(c) + ' 席，已用节钺 '
        + c[K.field] + '/' + chk.max + '）'
    }[kind];
    GAME.log('🪓 ' + msg);
    return { ok: true, msg: msg };
  };
'''
dm = rep1(dm, old_x, new_x, '2a 扩编族')

old_g = ("    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)\n"
         "      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0)\n"
         "      + GAME.cityBonusNum(city, 'genCap');\n")
new_g = ("    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)\n"
         "      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0)\n"
         "      + GAME.cityBonusNum(city, 'genCap')\n"
         "      /* v89.132（老板「节钺设计再开拓一下」）：招贤纳士 —— 每城 +1 席（至多 genMax） */\n"
         "      + Math.min(city.jieyueGen || 0, (DATA.JIEYUE || {}).genMax || 2);\n")
dm = rep1(dm, old_g, new_g, '2b genSlotsOf')
assert dm.count('jieyueExpandCity') == 0, '旧出口残留'
assert dm.count('jieyueExpandOf') >= 3
wr('js/domain.js', dm)

# ============ 3) battle.js ============
b = rd('js/battle.js')
old_b = ("  GAME.battle.marchCapOf = function (city) {\n"
         "    if (!city) return 0;\n"
         "    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;\n"
         "    var cap = xc * GAME.battle.MARCH_MEN_PER_LV * (1 + GAME.mastery('marchCapPct', city));\n")
new_b = ("  GAME.battle.marchCapOf = function (city) {\n"
         "    if (!city) return 0;\n"
         "    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;\n"
         "    /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 校场扩编 —— 每城 +1 万人马\n"
         "       （等效校场 +1 级）。**只加出征容量这一项**：募兵名额 / 练兵收益等仍由\n"
         "       建筑等级决定，不随之膨胀；无校场 → 仍为 0（不设限），不凭空开闸。 */\n"
         "    var _jx = Math.min(city.jieyueXc || 0, (DATA.JIEYUE || {}).xcMax || 2);\n"
         "    if (xc > 0) xc += _jx;\n"
         "    var cap = xc * GAME.battle.MARCH_MEN_PER_LV * (1 + GAME.mastery('marchCapPct', city));\n")
b = rep1(b, old_b, new_b, '3 marchCapOf')
wr('js/battle.js', b)

# ============ 4) ui.js ============
ui = rd('js/ui.js')

# 4a 校场面板：出征兵力上限行后加扩编按钮
old_xc = ("      /* v89.102（老板「校场按人数不按人口」）：上限口径 = 人马（总兵力数） */\n"
          "      '<div class=\"attr\"><span class=\"k\">出征兵力上限</span><span class=\"v\">' + U.numText(marchCap, 0) + ' 人马</span></div>' +\n")
new_xc = ("      /* v89.102（老板「校场按人数不按人口」）：上限口径 = 人马（总兵力数） */\n"
          "      '<div class=\"attr\"><span class=\"k\">出征兵力上限</span><span class=\"v\">' + U.numText(marchCap, 0) + ' 人马</span></div>' +\n"
          "      /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 校场扩编入口（唯一落点 = 校场面板） */\n"
          "      '<div class=\"auto-line\"><button class=\"btn\" data-action=\"jieyue-xc\" data-city=\"' + c.id +\n"
          "        '\" title=\"' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')\n"
          "          + ((DATA.JIEYUE || {}).desc || '')) + '\">🪓 节钺 · 校场扩编（' +\n"
          "        (function () {\n"
          "          var jx = GAME.jieyueExpandOf(c, 'xc');\n"
          "          return (jx.used >= jx.max)\n"
          "            ? '本城已满 ' + jx.used + '/' + jx.max\n"
          "            : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();\n"
          "        })() + '）</button>' +\n"
          "        '<span class=\"ui-sub\">出征容量 +1 万人马（等效校场 +1 级）</span></div>' +\n")
ui = rep1(ui, old_xc, new_xc, '4a 校场面板')

# 4b 招贤馆面板：席位行后加扩编按钮
old_hz = ("      '<div class=\"attr\"><span class=\"k\">每级房间</span><span class=\"v\">+1 席</span></div>' +\n")
new_hz = ("      '<div class=\"attr\"><span class=\"k\">每级房间</span><span class=\"v\">+1 席</span></div>' +\n"
          "      /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 招贤纳士入口（唯一落点 = 招贤馆面板） */\n"
          "      '<div class=\"auto-line\"><button class=\"btn\" data-action=\"jieyue-gen\" data-city=\"' + c.id +\n"
          "        '\" title=\"' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')\n"
          "          + ((DATA.JIEYUE || {}).desc || '')) + '\">🪓 节钺 · 招贤纳士（' +\n"
          "        (function () {\n"
          "          var jg = GAME.jieyueExpandOf(c, 'gen');\n"
          "          return (jg.used >= jg.max)\n"
          "            ? '本城已满 ' + jg.used + '/' + jg.max\n"
          "            : '本城 ' + jg.used + '/' + jg.max + '　持符 ' + GAME.jieyueOf();\n"
          "        })() + '）</button>' +\n"
          "        '<span class=\"ui-sub\">将领席位 +1（至多 ' + ((DATA.JIEYUE || {}).genMax || 2) + ' 次）</span></div>' +\n")
ui = rep1(ui, old_hz, new_hz, '4b 招贤馆面板')

# 4c 君主信息表「节钺」行 → 可点开面板
old_lr = ("          '<tr><td class=\"k\">节钺</td><td title=\"' +\n"
          "            U.escape((DATA.JIEYUE || {}).desc || '') + '\">' +\n"
          "            ((DATA.JIEYUE || {}).icon || '🪓') + ' ×<b>' + GAME.jieyueOf() + '</b>' +\n"
          "            ' <span class=\"ui-sub\">（攻占名城 / 爵位每 ' +\n"
          "            ((DATA.JIEYUE || {}).rankEvery || 4) + ' 档 +1）</span></td></tr>' +\n")
new_lr = ("          /* v89.132（老板「节钺设计再开拓一下」）：整行改为**面板入口** ——\n"
          "             余额 + 来源 + 四种用途 + 全境进度都在 ui.openJieyue 里。 */\n"
          "          '<tr><td class=\"k\">节钺</td><td title=\"' +\n"
          "            U.escape((DATA.JIEYUE || {}).desc || '') + '\">' +\n"
          "            '<button class=\"btn sm\" data-action=\"open-jieyue\">' +\n"
          "            ((DATA.JIEYUE || {}).icon || '🪓') + ' ×<b>' + GAME.jieyueOf() + '</b>' +\n"
          "            '　查看用途</button>' +\n"
          "            ' <span class=\"ui-sub\">（攻占名城 / 爵位每 ' +\n"
          "            ((DATA.JIEYUE || {}).rankEvery || 4) + ' 档 +1）</span></td></tr>' +\n")
ui = rep1(ui, old_lr, new_lr, '4c 节钺行')

# 4d 新增 ui.openJieyue（插在 openHostel 之前）
old_hos = "  ui.openHostel = function () {\n"
new_jy = r'''  /* ============================================================
   * v89.132（老板「节钺设计再开拓一下」）：节钺专属面板 ——
   * 「余额 · 来源 · 四种用途 · 全境扩编进度」一屏说完。
   * 数字一律读唯一出口（jieyueOf / jieyueExpandOf / DATA.JIEYUE），不抄文案。
   * ============================================================ */
  ui.openJieyue = function () {
    var s = GAME.state;
    var C = DATA.JIEYUE || {};
    var kinds = ['city', 'xc', 'gen'];
    var used = 0, max = 0;
    (s.cities || []).forEach(function (c) {
      kinds.forEach(function (k) {
        var st = GAME.jieyueExpandOf(c, k);
        used += st.used; max += st.max;
      });
    });
    var man = C.byTier || {};
    var rankN = Math.floor(((DATA.RANK || []).length - 1) / (C.rankEvery || 4));
    var body =
      '<div class="res-line"><span class="lbl">余额</span><span class="val">' + (C.icon || '🪓') +
        ' ×<b>' + GAME.jieyueOf() + '</b> 枚</span></div>' +
      '<div class="note">黄金买不到的「开门」资源 —— 不解锁强度，只解锁「再往上走」的资格：' +
        '顶档资质、编制扩张，都要它放行。</div>' +
      '<div class="gold-heading" style="margin-top:10px;">🪙 获得（只能打出来 / 赐下来）</div>' +
      '<div class="res-line"><span class="lbl">首占名城</span><span class="val">县 +' +
        (man.county || 1) + ' · 郡 +' + (man.jun || 2) + ' · 州 +' + (man.zhou || 3) + ' · 都 +' +
        (man.capital || 5) + '　（同一座城只算一次）</span></div>' +
      '<div class="res-line"><span class="lbl">爵位赏赐</span><span class="val">每 ' +
        (C.rankEvery || 4) + ' 档 +1（共 ' + rankN + ' 枚）</span></div>' +
      '<div class="gold-heading" style="margin-top:10px;">🛠️ 用途</div>' +
      '<div class="res-line"><span class="lbl">① 问鼎天授</span><span class="val">1 枚 / 将 —— 名世 → 天授（将领面板 · 资质晋升）</span></div>' +
      '<div class="res-line"><span class="lbl">② 城建扩编</span><span class="val">1 枚 / 次 —— 建造位 +1（城池面板 · 每城 ≤' + (C.citySlotMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">③ 校场扩编</span><span class="val">1 枚 / 次 —— 出征容量 +1 万人马（校场面板 · 每城 ≤' + (C.xcMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">④ 招贤纳士</span><span class="val">1 枚 / 次 —— 将领席位 +1（招贤馆面板 · 每城 ≤' + (C.genMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">全境扩编</span><span class="val">已用 ' + used + ' / 上限 ' + max + ' 次</span></div>';
    ui.openShell({
      title: (C.icon || '🪓') + ' 节钺',
      sub: '现有 ' + GAME.jieyueOf() + ' 枚 · 全境扩编 ' + used + '/' + max,
      size: 'sm',
      body: body
    });
  };

'''
ui = rep1(ui, old_hos, new_jy + old_hos, '4d openJieyue')

for sent in ['ui.openJieyue = function', 'open-jieyue', 'jieyue-xc', 'jieyue-gen',
             "GAME.jieyueExpandOf(c, 'xc')", "GAME.jieyueExpandOf(c, 'gen')"]:
    assert ui.count(sent) >= 1, '丢失哨兵: ' + sent
wr('js/ui.js', ui)

# ============ 5) main.js ============
mj = rd('js/main.js')
old_case = ("      /* v89.95（A1）：节钺扩编（每城 +1 建造位，至多 2 次）—— 结果 toast + 重开面板 */\n"
            "      case 'jieyue-expand': {\n"
            "        var _heR = GAME.jieyueExpandCity(el.dataset.city);\n"
            "        ui.toast((_heR.ok ? '🪓 ' : '⚠️ ') + _heR.msg);\n"
            "        if (_heR.ok) {\n"
            "          GAME.refreshAll();\n"
            "          var _heC = GAME.cityById(el.dataset.city);\n"
            "          if (_heC) ui.openCityPanel(_heC);\n"
            "        }\n"
            "        break;\n"
            "      }\n")
new_case = ("      /* v89.95（A1）：节钺扩编（每城 +1 建造位，至多 2 次）—— 结果 toast + 重开面板\n"
            "         v89.132：改走统一出口 GAME.jieyueExpand（city/xc/gen 三族共用一套判据） */\n"
            "      case 'jieyue-expand': {\n"
            "        var _heR = GAME.jieyueExpand('city', el.dataset.city);\n"
            "        ui.toast((_heR.ok ? '🪓 ' : '⚠️ ') + _heR.msg);\n"
            "        if (_heR.ok) {\n"
            "          GAME.refreshAll();\n"
            "          var _heC = GAME.cityById(el.dataset.city);\n"
            "          if (_heC) ui.openCityPanel(_heC);\n"
            "        }\n"
            "        break;\n"
            "      }\n"
            "      /* v89.132（老板「节钺设计再开拓一下」）：校场扩编 / 招贤纳士 / 节钺面板 */\n"
            "      case 'jieyue-xc': {\n"
            "        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);\n"
            "        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);\n"
            "        if (_jxR.ok) { GAME.refreshAll(); ui.openXiaochang(); }\n"
            "        break;\n"
            "      }\n"
            "      case 'jieyue-gen': {\n"
            "        var _jgR = GAME.jieyueExpand('gen', el.dataset.city);\n"
            "        ui.toast((_jgR.ok ? '🪓 ' : '⚠️ ') + _jgR.msg);\n"
            "        if (_jgR.ok) { GAME.refreshAll(); ui.openHostel(); }\n"
            "        break;\n"
            "      }\n"
            "      case 'open-jieyue': ui.openJieyue(); break;\n")
mj = rep1(mj, old_case, new_case, '5 main case')
assert mj.count('jieyueExpandCity') == 0
wr('js/main.js', mj)

print('OK · data.js', len(d), '· domain.js', len(dm), '· battle.js', len(b), '· ui.js', len(ui), '· main.js', len(mj))
