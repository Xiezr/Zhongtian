# -*- coding: utf-8 -*-
"""v89.217 · 命名替换的测试与界面连带（smoke/e2e/ui 按钮）

映射与 patch_v89217a_names.py 同源；本脚本处理"非表结构"的引用面：
  · ui.js 地图按钮「洛阳」→「灰烬城」（产品界面文案）
  · smoke/e2e 的 region 夹具（region: '司隶' ×37 …）
  · smoke/e2e 的字面量断言 / 夹具 / 注释
"""
import io

R = 'E:/Deepseekdb/'
REGION = [
    ('司隶', '烬环'), ('幽州', '霜脊'), ('徐州', '沉陆'), ('荆州', '泽心'),
    ('兖州', '枯河'), ('并州', '黑岭'), ('益州', '雾谷'), ('冀州', '灰野'),
    ('交州', '藤林'), ('扬州', '潮湾'), ('青州', '盐岸'), ('豫州', '碎垣'),
    ('凉州', '风碛'),
]


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def rep(s, old, new, tag, expect=None):
    c = s.count(old)
    if c == 0:
        print('  [miss] %s' % tag)
        return s
    if expect is not None and c != expect:
        raise SystemExit('❌ %s: count=%d expect=%d' % (tag, c, expect))
    print('  [ok] %s x%d' % (tag, c))
    return s.replace(old, new)


# ═══════════ ① ui.js 地图按钮 ═══════════
p = R + 'js/ui.js'
s = rd(p)
if 'data-action="map-capital">洛阳</button>' in s:
    s = s.replace("data-action=\"map-capital\">洛阳</button>", "data-action=\"map-capital\">灰烬城</button>")
    wr(p, s)
    print('  [ok] ui-map-capital按钮')
else:
    print('  [skip] ui 按钮（已是灰烬城）')

# ═══════════ ② smoke-test.js ═══════════
p = R + 'smoke-test.js'
s = rd(p)

for old, new in REGION:
    s = rep(s, "region: '%s'" % old, "region: '%s'" % new, 'smoke-region-%s' % new)

E = [
    ("check('洛阳坐标(265,215)'", "check('旧都坐标(265,215)'"),
    ("check('凉州州城陇县(115,205)', DATA.NPC_CITIES.some(function (c) { return c.name === '陇县' && c.x === 115 && c.y === 205; }));",
     "check('风碛州城风关(115,205)', DATA.NPC_CITIES.some(function (c) { return c.name === '风关' && c.x === 115 && c.y === 205; }));"),
    ("check('地图有回主城/洛阳快捷'", "check('地图有回主城/旧都快捷'"),
    ("var nCity = G.makeCity({ id: 'conq_test', name: '江陵', x: 255, y: 335, type: 'jun', state: '荆州' });",
     "var nCity = G.makeCity({ id: 'conq_test', name: '泽乡', x: 255, y: 335, type: 'jun', state: '泽心' });"),
    ("check('司隶特产为四阶（都城为四阶持续来源）',",
     "check('烬环特产为四阶（旧都为四阶持续来源）',"),
    ("DATA.STATE_SPECIALTY['司隶'].tier === 4 && DATA.MATERIAL_BY_ID[DATA.STATE_SPECIALTY['司隶'].mat].tier === 4);",
     "DATA.STATE_SPECIALTY['烬环'].tier === 4 && DATA.MATERIAL_BY_ID[DATA.STATE_SPECIALTY['烬环'].mat].tier === 4);"),
    ("check('并州为唯一一阶州', DATA.STATE_SPECIALTY['并州'].tier === 1);",
     "check('黑岭为唯一一阶州', DATA.STATE_SPECIALTY['黑岭'].tier === 1);"),
    ("check('州属显式字段优先', G.stateOfCity(nCity) === '荆州');",
     "check('州属显式字段优先', G.stateOfCity(nCity) === '泽心');"),
    ("/* v70（老板需求 5）：出生州由创建界面选（不再恒为司隶）——",
     "/* v70（老板需求 5）：出生州由创建界面选（不再恒为烬环）——"),
    ("return G.stateOfCity({ x: 275, y: 225 }) === '司隶'      /* 洛阳(265,215) 近旁 */",
     "return G.stateOfCity({ x: 275, y: 225 }) === '烬环'      /* 灰烬城(265,215) 近旁 */"),
    ("&& G.stateOfCity({ x: 435, y: 145 }) === '青州';       /* 临淄本城 */",
     "&& G.stateOfCity({ x: 435, y: 145 }) === '盐岸';       /* 盐井本城 */"),
    ("check('specialtyOf 取到荆州织锦', G.specialtyOf(nCity).mat === 'shujin');",
     "check('specialtyOf 取到泽心织锦', G.specialtyOf(nCity).mat === 'shujin');"),
    ("check('未握州治时无加成', G.hasStateSeat('荆州') === false);",
     "check('未握州治时无加成', G.hasStateSeat('泽心') === false);"),
    ("check('握州城 → 州治在握', G.hasStateSeat('荆州') === true);",
     "check('握州城 → 州治在握', G.hasStateSeat('泽心') === true);"),
    ("return sum.cities === 1 && sum.gold > 0 && sum.rep > 0 && !!sum.mats.shujin && sum.seats.indexOf('荆州') >= 0;",
     "return sum.cities === 1 && sum.gold > 0 && sum.rep > 0 && !!sum.mats.shujin && sum.seats.indexOf('泽心') >= 0;"),
    ("var m = DATA.MATERIAL_BY_ID[ DATA.STATE_SPECIALTY['荆州'].mat ];",
     "var m = DATA.MATERIAL_BY_ID[ DATA.STATE_SPECIALTY['泽心'].mat ];"),
    ("/* v65：名城建筑补到\"满级城等级 10 + 档位加成\"（洛阳=都城 → 22），",
     "/* v65：名城建筑补到\"满级城等级 10 + 档位加成\"（灰烬城=旧都 → 22），"),
    ("check('存档中不含 NPC 城数据', rawSave.indexOf('洛阳') < 0);",
     "check('存档中不含 NPC 城数据', rawSave.indexOf('灰烬城') < 0);"),
    ("check('checkVictory 已被调用（攻占洛阳→天下一统）',",
     "check('checkVictory 已被调用（攻占灰烬城→天下一统）',"),
    ("/* v45 语义反转：v29~v44 只放行 type==='self'，而开局城就是洛阳（都城），",
     "/* v45 语义反转：v29~v44 只放行 type==='self'，而开局城就是灰烬城（旧都），"),
    ("var zhou = { name: '临淄', type: 'zhou' }, self = { name: '新城', type: 'self' };",
     "var zhou = { name: '盐井', type: 'zhou' }, self = { name: '旧炉', type: 'self' };"),
    ("var cap = { name: '洛阳', type: 'capital' };",
     "var cap = { name: '灰烬城', type: 'capital' };"),
    ("&& zhou.origName === '临淄' && cap.origName === '洛阳';",
     "&& zhou.origName === '盐井' && cap.origName === '灰烬城';"),
    ("return G.cityLabel({ name: '洛阳', type: 'capital' }) === '洛阳[都城]'\n    && G.cityLabel({ name: '新城', type: 'self' }) === '新城'",
     "return G.cityLabel({ name: '灰烬城', type: 'capital' }) === '灰烬城[都城]'\n    && G.cityLabel({ name: '旧炉', type: 'self' }) === '旧炉'"),
    ("/* v45 语义反转（原：非名城才可改 —— 开局洛阳是都城，于是永远不可改） */",
     "/* v45 语义反转（原：非名城才可改 —— 开局灰烬城是旧都，于是永远不可改） */"),
    ("var i1 = { name: '新城', type: 'self' }, i2 = { name: '洛阳', type: 'capital' }, i3 = { name: '临淄', type: 'zhou' };",
     "var i1 = { name: '旧炉', type: 'self' }, i2 = { name: '灰烬城', type: 'capital' }, i3 = { name: '盐井', type: 'zhou' };"),
    ("&& i1.origName === '新城' && i2.origName === '洛阳' && i3.origName === '临淄';",
     "&& i1.origName === '旧炉' && i2.origName === '灰烬城' && i3.origName === '盐井';"),
    ("var cap = G.makeCity({ id: 'v60c', name: '洛阳', x: 2, y: 2, type: 'capital' });",
     "var cap = G.makeCity({ id: 'v60c', name: '灰烬城', x: 2, y: 2, type: 'capital' });"),
    ("/* 洛阳有历史名将候选；没有候选就是\"什么都没测\" */",
     "/* 旧都有历史名将候选（狂刀/雷吼/黑塔）；没有候选就是\"什么都没测\" */"),
    ("var c = { name: '江陵', type: 'jun', state: '荆州', x: 5, y: 5 };",
     "var c = { name: '泽乡', type: 'jun', state: '泽心', x: 5, y: 5 };"),
    ("&& short.indexOf(full) < 0 && short.indexOf('江陵') >= 0",
     "&& short.indexOf(full) < 0 && short.indexOf('泽乡') >= 0"),
    ("var a = G.pickStartPos('凉州', 4242), b = G.pickStartPos('凉州', 4242);",
     "var a = G.pickStartPos('风碛', 4242), b = G.pickStartPos('风碛', 4242);"),
    ("return c.state === '益州' && G.stateOfCity(c) === '益州'",
     "return c.state === '雾谷' && G.stateOfCity(c) === '雾谷'"),
    ("check('实测：归属 25 万格 · 13 州 · 洛阳格=司隶 · 边界存在 · 缓存命中', (function () {",
     "check('实测：归属 25 万格 · 13 州 · 灰烬城格=烬环 · 边界存在 · 缓存命中', (function () {"),
    ("if (d.state[215 * 500 + 265] !== 0) return false;      /* 洛阳（265,215）→ 司隶 id=0 */",
     "if (d.state[215 * 500 + 265] !== 0) return false;      /* 灰烬城（265,215）→ 烬环 id=0 */"),
    ("&& fonts['normal 27px sans-serif'] === 1;          /* 都城只有一座（洛阳） */",
     "&& fonts['normal 27px sans-serif'] === 1;          /* 旧都只有一座（灰烬城） */"),
    ("var b = uS192.indexOf('data-action=\"map-capital\">洛阳');",
     "var b = uS192.indexOf('data-action=\"map-capital\">灰烬城');"),
    ("/* ⚠️ 键名与 statBump 真实键一字不差（gathers 不是 gather —— 曾写错致凉州系锁死）。 */",
     "/* ⚠️ 键名与 statBump 真实键一字不差（gathers 不是 gather —— 曾写错致相关系列锁死）。 */"),
    ("*   ② 征兵时长按五条对齐关系重排（青州=长枪 · 刀盾=藤甲 · 突骑>弓箭 · 轻骑=虎豹 · 铁骑=西凉）",
     "*   ② 征兵时长按五条对齐关系重排（旧军残部=长枪 · 盾卫=防暴甲兵 · 突击摩托>弩手 · 摩托游骑=王牌战车 · 装甲战车=重甲战车）"),
    ("check('§164② ★ 青州=长枪 · 刀盾=藤甲 · 轻骑=虎豹 · 铁骑=西凉 · 突骑>弩手', (function () {",
     "check('§164② ★ 旧军残部=长枪 · 盾卫=防暴甲兵 · 摩托游骑=王牌战车 · 装甲战车=重甲战车 · 突骑>弩手', (function () {"),
    ("})(), '青州/长枪 ' + DATA.TROOPS.qingzhoubing.time + ' · 刀盾/藤甲 ' + DATA.TROOPS.daodun.time",
     "})(), '旧军/长枪 ' + DATA.TROOPS.qingzhoubing.time + ' · 盾卫/甲兵 ' + DATA.TROOPS.daodun.time"),
]
bad = []
for old, new in E:
    c = s.count(old)
    if c == 0:
        print('  [miss] %s' % old[:52].replace('\n', '⏎'))
        continue
    if c != 1:
        bad.append('x%d | %s' % (c, old[:60]))
        continue
    s = s.replace(old, new)
    print('  [ok] %s' % old[:36].replace('\n', '⏎'))
if bad:
    raise SystemExit('❌ 失配：\n' + '\n'.join(bad))

wr(p, s)
print('✅ smoke-test.js 完成')

# ═══════════ ③ e2e-test.js ═══════════
p = R + 'e2e-test.js'
s = rd(p)
E2 = [
    ("return vals.indexOf('random') >= 0 && vals.indexOf('青州') >= 0 && vals.indexOf('north') < 0;",
     "return vals.indexOf('random') >= 0 && vals.indexOf('盐岸') >= 0 && vals.indexOf('north') < 0;"),
    ("const conq18 = G.makeCity({ id: 'conq_e2e18', name: '江陵', x: 255, y: 335, type: 'jun', state: '荆州' });",
     "const conq18 = G.makeCity({ id: 'conq_e2e18', name: '泽乡', x: 255, y: 335, type: 'jun', state: '泽心' });"),
    ("check('岁贡列出特产（荆州织锦）', govY18.indexOf('织锦') >= 0);",
     "check('岁贡列出特产（泽心织锦）', govY18.indexOf('织锦') >= 0);"),
    ("attrs18.indexOf('江陵') >= 0", "attrs18.indexOf('泽乡') >= 0"),
    ("const extraCity23 = G.makeCity({ id: 'e2e23_b', name: '测试二城', x: 260, y: 230, type: 'jun', state: '荆州' });",
     "const extraCity23 = G.makeCity({ id: 'e2e23_b', name: '测试二城', x: 260, y: 230, type: 'jun', state: '泽心' });"),
    ("document.querySelector('#rename-city-input').value = '汉寿';",
     "document.querySelector('#rename-city-input').value = '泊城';"),
    ("check('改名生效并回到政务厅面板', rnCity.name === '汉寿',",
     "check('改名生效并回到政务厅面板', rnCity.name === '泊城',"),
    ("check('侧栏城池名同步', (document.querySelector('#city-attrs') || {}).textContent.indexOf('汉寿') >= 0);",
     "check('侧栏城池名同步', (document.querySelector('#city-attrs') || {}).textContent.indexOf('泊城') >= 0);"),
    ("⚠️ gathers 键名与 statBump 一字不差（曾写 gather 致凉州系锁死）。 */",
     "⚠️ gathers 键名与 statBump 一字不差（曾写 gather 致相关系列锁死）。 */"),
]
bad = []
for old, new in E2:
    c = s.count(old)
    if c == 0:
        print('  [miss] E2 %s' % old[:52])
        continue
    if c != 1:
        bad.append('x%d | %s' % (c, old[:60]))
        continue
    s = s.replace(old, new)
    print('  [ok] E2 %s' % old[:36])
if bad:
    raise SystemExit('❌ E2 失配：\n' + '\n'.join(bad))
wr(p, s)
print('✅ e2e-test.js 完成')
