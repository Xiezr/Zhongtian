# -*- coding: utf-8 -*-
"""
patch_v89118a_captive_elephant.py — v89.118 需求 1（俘虏营） + 需求 2（象兵）

需求 1（老板）：
  · 「俘虏营直接文字显示就行，放图标太大了」→ 俘虏营明细改**纯文字**（伤兵营不动）
  · 「俘虏在被收编那一刻才加人口」→ 收编才加人口（本就如此，注释写明）
  · 「增加的人口数量按俘虏的兵种人口乘以其数量总和，也就是俘虏的总人口」
      → 新增唯一出口 GAME.captivePopOf(camp) = Σ(数量 × TROOPS[].pop)；
        收编执行与界面按钮文案同读它
  · 「俘虏可以无限保留，如有战斗新增，数量增加」
      → 营中不限量（本就如此）；文案写明"单场上限仅指一场"，营中可无限积累

需求 2（老板）：「象兵不设置克制，正常攻防」
  · 从 COUNTER_ATK/COUNTER_DEF 的长枪条目里删掉 nanjiangxiangbing
  · 数值按"正常攻防"标定（probe_v89118_elephant.js 实测）：
      hp 18000→15000 · atk 880→620 · def 400→300
    依据：撤克制后原值对象兵对步兵近乎无损（损 8%）＝"无弱点"换个法子回来；
          标定后 枪战象损 17% / 盾战 19%（赢但肉疼），
          西凉铁骑（同人口）可全歼象兵（凉骑损 52%）—— 强弱由数值自然形成，无特殊克制。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    if p not in files:
        files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(path, old, new, tag):
    s = load(path)
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次（应为 1）→ 中止' % (tag, n))
        sys.exit(1)
    files[path] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ================================================================
# A. 需求 1：俘虏营
# ================================================================

# ---- A1: battle.js —— 新增 captivePopOf + 收编改口径 ----
edit('js/battle.js',
"""  /* 收编为民：全部并入住民（与旧口径同一笔账：人口 += 总俘虏数） */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城池' };
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + n;
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(n) + ' 众为民（人口 +' + U.fmt(n) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(n) + ' 众为民', n: n, city: city.name };
  };""",
"""  /* v89.118（老板「增加的人口数量按俘虏的兵种人口乘以其数量总和，也就是俘虏的总人口」）：
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
  };""",
'A1 battle.js 收编口径（唯一出口 captivePopOf）')

# ---- A2: ui.js —— 明细组件加 textOnly ----
edit('js/ui.js',
"""  ui.armyBreakdownRows = function (map, emptyTxt, extraOf) {""",
"""  /* v89.118（老板「俘虏营直接文字显示就行，放图标太大了」）：
     opts.textOnly = 纯文字行（不摆兵种图标）—— 俘虏营用。
     伤兵营仍带图标（本轮指令只点名俘虏营；要统一改一处调用即可）。 */
  ui.armyBreakdownRows = function (map, emptyTxt, extraOf, opts) {
    var _o = opts || {};""",
'A2a armyBreakdownRows 签名')

edit('js/ui.js',
"""      var nm = DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : (x[0] === 'unknown' ? '来历不明' : x[0]);
      return '<div class="res-line"><span class="lbl">'
        + ((GAME.icons && GAME.icons.forTroop && GAME.icons.forTroop(x[0])) || '')
        + ' ' + U.escape(nm) + '</span><span class="val">' + U.numText(x[1], 0) + ' 人'""",
"""      var nm = DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : (x[0] === 'unknown' ? '来历不明' : x[0]);
      return '<div class="res-line"><span class="lbl">'
        + (_o.textOnly ? '' :
          (((GAME.icons && GAME.icons.forTroop && GAME.icons.forTroop(x[0])) || '') + ' '))
        + U.escape(nm) + '</span><span class="val">' + U.numText(x[1], 0) + ' 人'""",
'A2b armyBreakdownRows 行内图标可选')

# ---- A3: ui.js —— campCard 俘虏营：文案 + 明细 + 按钮口径 ----
edit('js/ui.js',
"""    /* 俘虏营 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var rep = Math.max(1, Math.round(cn / 50));""",
"""    /* 俘虏营 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    /* v89.118：收编按钮文案的"人口 +N"必须与**收编执行**同口径（兵种 pop 折算） */
    var cPop = (GAME.captivePopOf ? GAME.captivePopOf(s.captives) : cn);
    var rep = Math.max(1, Math.round(cn / 50));""",
'A3a campCard 俘虏营人口口径')

edit('js/ui.js',
"""      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
        '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.captives, '（营中无俘虏）') +
        '<div class="camp-rule">来源：' + U.escape(srcTxt) + '　·　折算：敌军逐兵种损失的 <b>' + ratePct +
          '%</b>（单场上限 ' + U.numText(capN, 0) + '）　·　收编为民 = 并入住民；释放 = 换声望</div>' +
        '<div class="auto-line"><button class="btn' + (cn ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
          (cn ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cn, 0) + '）</button>'""",
"""      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
        '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.captives, '（营中无俘虏）', null, { textOnly: true }) +
        '<div class="camp-rule">来源：' + U.escape(srcTxt) + '　·　折算：敌军逐兵种损失的 <b>' + ratePct +
          '%</b>（单场上限 ' + U.numText(capN, 0) + '；<b>营中不限量</b>，可无限积累）　·　' +
          '收编为民 = 按兵种人口并入住民；释放 = 换声望</div>' +
        '<div class="auto-line"><button class="btn' + (cn ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
          (cn ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cPop, 0) + '）</button>'""",
'A3b campCard 俘虏营 compact')

edit('js/ui.js',
"""    return '<div class="story-card"><div class="gold-heading">🪶 俘虏营（本境）' +
      ui.help('俘虏来源：野地 / 据点 / 名城 / 守城得手 —— 按**敌军逐兵种损失**折算（DATA.CAPTIVE：'
        + ratePct + '% · 单场上限 ' + U.numText(capN, 0) + '）。\\n'
        + '收编为民：全部并入住民（人口 +N）；释放：不添人口，换一点声望。\\n'
        + '两处都会清空俘虏营 —— 先看清兵种再决定。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营俘虏</span><span class="val">' + U.numText(cn, 0) + ' 人</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里') +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) + ' 人）　·　' +
        '<b>收编为民</b>：俘虏并入住民（人口 +N）　·　<b>释放</b>：不添人口，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (cn > 0 ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (cn > 0 ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cn, 0) + '）</button>'""",
"""    return '<div class="story-card"><div class="gold-heading">🪶 俘虏营（本境）' +
      ui.help('俘虏来源：野地 / 据点 / 名城 / 守城得手 —— 按**敌军逐兵种损失**折算（DATA.CAPTIVE：'
        + ratePct + '% · 单场上限 ' + U.numText(capN, 0) + '）。\\n'
        + '营中**不限量**：每有新俘获直接累加（单场上限只约束"一场"）。\\n'
        + '收编为民：**收编这一刻**才加人口，增量 = 俘虏的总人口（兵种人数 × 兵种人口）；'
        + '释放：不添人口，换一点声望。\\n'
        + '两处都会清空俘虏营 —— 先看清兵种再决定。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营俘虏</span><span class="val">' + U.numText(cn, 0) + ' 人</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中则<b>不限量</b>，每战新增直接累加）　·　' +
        '<b>收编为民</b>：<b>收编这一刻</b>才加人口，增量 = 俘虏总人口（兵种人数 × 兵种人口）　·　' +
        '<b>释放</b>：不添人口，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (cn > 0 ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (cn > 0 ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cPop, 0) + '）</button>'""",
'A3c campCard 俘虏营 full')

# ================================================================
# B. 需求 2：象兵撤克制 + 数值标定
# ================================================================

# ---- B1: COUNTER_ATK —— 删象兵 ----
edit('js/data.js',
"""       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂） */
    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3,
      /* v89.116（老板「兵种数值是否有误，梳理」）：**南疆象兵**补进来 ——
         它是全表唯一"两张相克表都不出现"的战斗兵种（既不被克、也无克制），
         与下面那条自述原则直接矛盾（"同族里只有轻/铁被克，另三种变成无弱点的骑兵"）。
         实测（probe_v89116_stats）：各 600 人口，长枪全灭、象兵仅损 9 —— 名副其实"无弱点"。
         归入长枪的拒马口径（长枪阵本就是拒兽/拒骑的阵形），与其余五种骑兵同族同办。 */
      nanjiangxiangbing: 3 },""",
"""       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂）
       ⚠️ v89.118（老板令「象兵不设置克制，正常攻防」）：**象兵不进克制表** ——
         它的强弱只由自身 hp/atk/def 决定（数值已按 probe_v89118_elephant 标定：
         对步兵赢但损 15~20%，被同人口西凉铁骑全歼 —— "强但可打"）。 */
    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },""",
'B1 COUNTER_ATK 删象兵')

# ---- B2: COUNTER_DEF —— 删象兵 ----
edit('js/data.js',
"""    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5,
      nanjiangxiangbing: 5 },""",
"""    /* v89.118（老板令「象兵不设置克制，正常攻防」）：象兵不进这张表 ——
       它与骑兵同族但按自己的血厚硬拼，不享"拒马"的防御向加成。 */
    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5 },""",
'B2 COUNTER_DEF 删象兵')

# ---- B3: 象兵数值标定 ----
edit('js/data.js',
"""    nanjiangxiangbing: { id: 'nanjiangxiangbing', cat: 'cav', name: '南疆象兵', icon: '🐘', hp: 18000, atk: 880, def: 400, range: 70, spd: 400, gather: 12, load: 800, pop: 5, time: 3500, cost: { grain: 9000, wood: 1000, iron: 2500 }, unlock: { junying: 9, shuyuan: 8, city: 'yizhou', tech: { yiliao: 8, zhandou: 7 } }, desc: '南疆巨兽，战场重坦' },""",
"""    /* v89.118（老板「象兵不设置克制，正常攻防」）：数值按"无克制、硬碰硬"重新标定 ——
       hp 18000→15000 · atk 880→620 · def 400→300（probe_v89118_elephant 实测）：
         · 撤克制的原值：对象兵对步兵近乎无损（损 8%）＝"无弱点"换个法子回来；
         · 标定后：对长枪/刀盾胜而损 17~19%（强但肉疼）；同人口西凉铁骑可全歼象兵（凉骑损 52%）；
         · 定位从"攻守双绝"改为**血牛重坦**（hp/pop 全表最高 3000、atk/pop 124 最低）。 */
    nanjiangxiangbing: { id: 'nanjiangxiangbing', cat: 'cav', name: '南疆象兵', icon: '🐘', hp: 15000, atk: 620, def: 300, range: 70, spd: 400, gather: 12, load: 800, pop: 5, time: 3500, cost: { grain: 9000, wood: 1000, iron: 2500 }, unlock: { junying: 9, shuyuan: 8, city: 'yizhou', tech: { yiliao: 8, zhandou: 7 } }, desc: '南疆巨兽，血厚守坚；无相克，凭蛮力硬拼' },""",
'B3 象兵数值标定')

# ================================================================
# 落盘（原子 + 自检）
# ================================================================
base = {}
for p in files:
    base[p] = io.open(R + '.workbuddy/backup/v89118/' + os.path.basename(p), encoding='utf-8').read()

for p, s in files.items():
    assert '<<<<<<<' not in s, p
    d0 = (s.count('{') - s.count('}')) - (base[p].count('{') - base[p].count('}'))
    if d0 != 0:
        print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
        sys.exit(1)
    tmp = R + p + '.tmp118a'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s（净 %+d）' % (p, d0))
print('补丁 A/B 完成')
