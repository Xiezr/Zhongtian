# -*- coding: utf-8 -*-
"""v89.219-a：机构词更换（产品 + 测试 **同映射同改**）
   —— 州→区（辖区）· 州城/州治→首府 · 郡城/郡治→重镇 · 县城→聚落 · 都城/帝都→旧都
      州界/郡界→区界/镇界 · 太守系 NPC 头衔 → 废土头衔 · 行政后缀（郡/县）退役。

   纪律：
   · 先总映射（长词在前的复合词表），再逐条锚定的"紧凑缩写"（县1/郡2/州3/都5 之类）；
   · 每段带计数断言；**先全检内存、后统一落盘**（缺一不写，避免半套）；
   · 只改产品与测试；`需求档案.md` 是历史记录、**不参与改名**（其引用由 revert 脚本还原）。
   用法：python patch_v89219a_words.py [--dry]
"""
import io, glob, os, sys, re

R = 'E:/Deepseekdb/'
DRY = ('--dry' in sys.argv)

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

FILES = sorted(glob.glob(R + 'js/*.js')) + [R + 'index.html', R + 'smoke-test.js', R + 'e2e-test.js']

# ---------- ① 总映射（复合词；长词在前，防子串先被打掉） ----------
MAP = [
    ('州郡岁贡', '辖区岁贡'),
    ('雄踞州郡', '雄踞一方'),
    ('郡国游兵', '废土游兵'),
    ('州城池', '辖区内城池'),      # '州城' + '池' 的跨词边界（"占该州城池"），先于 '州城' 处理
    ('州城', '首府'), ('州治', '首府'), ('州界', '区界'),
    ('郡城', '重镇'), ('郡治', '重镇'), ('郡界', '镇界'),
    ('县城', '聚落'),
    ('帝都', '旧都'), ('都城', '旧都'),
    ('本州', '本区'), ('该州', '该区'), ('全州', '全区'), ('各州', '各区'),
    ('每州', '每区'), ('择一州', '择一区'), ('所选州', '所选区'), ('哪个州', '哪个区'),
    ('十三州', '十三区'), ('州属', '区属'), ('州特产', '辖区特产'), ('本郡', '本镇'),
]
# '州郡' → '辖区'：**不能吃进 '州郡县'**（逐条锚定的 SPEC）—— 负向前瞻保护；
# 另：MAP 先跑会把 '州郡县城' 的 '县城' 变成 '聚落'，故 '聚落' 也一并排除。
MAPRE = [(r'州郡(?!县|聚落)', '辖区')]

# ---------- ② 逐条锚定（紧凑缩写；跑在总映射**之后**，锚点按落盘后形态） ----------
SPEC = [
    ('js/data.js', '首占名城（县1/郡2/州3/都5）', '首占名城（聚落1/重镇2/首府3/旧都5）', 1),
    ('js/data.js', "DATA.NPC_GUARD_TITLE = ['太守', '都尉', '校尉', '长史', '中郎将', '偏将军'];",
                   "DATA.NPC_GUARD_TITLE = ['城守', '武卫', '队长', '文书', '统领', '副统领'];", 1),
    ('js/data.js', "'寻常之才，可为县吏。等级上限 60。'", "'寻常之才，可为聚落管事。等级上限 60。'", 1),
    ('js/data.js', "'可当一郡之任。等级上限 100。'", "'可当一镇之任。等级上限 100。'", 1),
    ('js/ui.js', "（县 ' + ((A.capturePts || {}).county || 0)", "（聚落 ' + ((A.capturePts || {}).county || 0)", 1),
    ('js/ui.js', "' / 郡 ' + ((A.capturePts || {}).jun || 0)", "' / 重镇 ' + ((A.capturePts || {}).jun || 0)", 1),
    ('js/ui.js', "' / 州 ' + ((A.capturePts || {}).zhou || 0)", "' / 首府 ' + ((A.capturePts || {}).zhou || 0)", 1),
    ('js/ui.js', '<span class="val">县 +', '<span class="val">聚落 +', 1),
    ('js/ui.js', "' · 郡 +' + (man.jun || 2) + ' · 州 +' + (man.zhou || 3) + ' · 都 +'",
                 "' · 重镇 +' + (man.jun || 2) + ' · 首府 +' + (man.zhou || 3) + ' · 旧都 +'", 1),
    ('js/ui.js', "+ n + ' 县）'", "+ n + ' 聚落）'", 1),
    ('js/ui.js', '<label>州</label>', '<label>区</label>', 1),
    ('js/ui.js', '<label>郡</label>', '<label>镇</label>', 1),
    ('js/ui.js', '（县按就近归属', '（聚落按就近归属', 1),
    ('js/ui.js', '显示州郡县坐标', '显示区镇落坐标', 1),   # 注释行（无引号包裹）
    ('js/ui.js', '州郡县全称 + 坐标', '区镇落全称 + 坐标', 1),
    ('js/domain.js', '按州郡县标识（假设青州琅琊郡XX县）', '按「区 · 重镇 · 聚落」标识（假设：盐岸区 · 霜堡 · 冰垒）', 1),
    ('js/domain.js', '攻占来的名城/州郡聚落带 origId', '攻占来的各档名城带 origId', 1),
    ('smoke-test.js', '含州郡县 + 坐标', '含区镇落 + 坐标', 1),
    ('smoke-test.js', '显示州郡县坐标', '显示区镇落坐标', 1),
    ('smoke-test.js', '名城（都州郡县）', '名城（旧都/首府/重镇/聚落）', 2),
    ('smoke-test.js', '州郡县 · 满配数量表', '区镇落 · 满配数量表', 1),
]

# ---------- ③ 行政后缀退役（domain.js 两个出口 + smoke 断言按新口径重写） ----------
FIX = [
    ('js/domain.js',
     "  /* 行政名规范化：已带后缀（郡/国/县/道）的原样保留，否则补一个 —— 不造新名 */\n"
     "  GAME.junNameOf = function (raw) {\n"
     "    raw = String(raw == null ? '' : raw);\n"
     "    return /[郡国县道州]$/.test(raw) ? raw : raw + '郡';\n"
     "  };\n"
     "  GAME.countyNameOf = function (raw) {\n"
     "    raw = String(raw == null ? '' : raw);\n"
     "    return /[郡国县道]$/.test(raw) ? raw : raw + '县';\n"
     "  };",
     "  /* ⛔ v89.219：行政后缀（郡/县）随机构词退役 —— 架空城名自带辨识度（霜堡 / 冰垒），\n"
     "     全称 = 「区 · [重镇 ·] 城名」，不再补后缀。\n"
     "     两个出口**保留为规范化出口**（原样返回）：城名 / 全称 / 产地标签全走它们 ——\n"
     "     将来若要再规范化（如统一加后缀），只改这里一处。 */\n"
     "  GAME.junNameOf = function (raw) {\n"
     "    return String(raw == null ? '' : raw);\n"
     "  };\n"
     "  GAME.countyNameOf = function (raw) {\n"
     "    return String(raw == null ? '' : raw);\n"
     "  };"),
    ('smoke-test.js',
     "    check('★ 名城全称 = 州 · 郡 · 县（旧都/首府/重镇/聚落各一例）', (function () {\n"
     "      function byType(t) { var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === t) hit = c; }); return hit; }\n"
     "      var cap = G.cityFullName(byType('capital'));\n"
     "      var zhou = G.cityFullName(byType('zhou'));\n"
     "      var jun = G.cityFullName(byType('jun'));\n"
     "      var cty = G.cityFullName(byType('county'));\n"
     "      return cap.split(' · ').length === 2 && zhou.split(' · ').length === 2\n"
     "        && jun.split(' · ').length === 2 && cty.split(' · ').length === 3\n"
     "        && /[郡国县道]$/.test(jun.split(' · ')[1]) && /县$/.test(cty.split(' · ')[2]);\n"
     "    })(), (function () {",
     "    /* v89.219 规则变更：行政后缀（郡/县）随机构词退役 —— 全称 =「区 · [重镇 ·] 城名」，\n"
     "       旧「第 N 段以 郡/县 结尾」判据按新口径重写（不是放宽：新增了**零后缀**的反向断言）。 */\n"
     "    check('★ 名城全称 = 区 · [重镇 ·] 城名（旧都/首府/重镇/聚落各一例 · v89.219 后缀退役）', (function () {\n"
     "      function byType(t) { var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === t) hit = c; }); return hit; }\n"
     "      var cap = G.cityFullName(byType('capital'));\n"
     "      var zhou = G.cityFullName(byType('zhou'));\n"
     "      var jun = G.cityFullName(byType('jun'));\n"
     "      var cty = G.cityFullName(byType('county'));\n"
     "      return cap.split(' · ').length === 2 && zhou.split(' · ').length === 2\n"
     "        && jun.split(' · ').length === 2 && cty.split(' · ').length === 3\n"
     "        && !/[郡县]$/.test(jun.split(' · ')[1]) && !/[郡县]$/.test(cty.split(' · ')[2])\n"
     "        && G.junNameOf('霜堡') === '霜堡' && G.countyNameOf('冰垒') === '冰垒';\n"
     "    })(), (function () {"),
]

def _key(p):
    return os.path.normcase(os.path.normpath(p))

bad = []
# -- 预检：SPEC / FIX 的锚点（落在**总映射之后**的形态上，故预检时要模拟映射） --
sim = {}
mapcnt = {}
for p in FILES:
    sim[_key(p)] = rd(p)
for old, new in MAP:
    for p in sim:
        c = sim[p].count(old)
        if c:
            sim[p] = sim[p].replace(old, new)
            mapcnt[p] = mapcnt.get(p, 0) + c
for pat, new in MAPRE:
    for p in sim:
        sim[p], n = re.subn(pat, new, sim[p])
        if n:
            mapcnt[p] = mapcnt.get(p, 0) + n

for f, old, new, exp in SPEC:
    c = sim[_key(R + f)].count(old)
    if c != exp:
        bad.append('SPEC %s 期望 %d 实得 %d | %s' % (f, exp, c, old[:44]))
for f, old, new in FIX:
    c = sim[_key(R + f)].count(old)
    if c != 1:
        bad.append('FIX %s 期望 1 实得 %d | %s' % (f, c, old[:44]))

if bad:
    print('❌ 预检失配（未落盘）：')
    for b in bad:
        print('   ' + b)
    sys.exit(1)

if DRY:
    tot = sum(mapcnt.values())
    for p in sorted(mapcnt):
        print('  [dry] %s x%d' % (p.replace('\\', '/').split('Deepseekdb/')[-1], mapcnt[p]))
    print('dry-run 完：总映射 %d 处；SPEC %d 条 · FIX %d 条锚点全命中' % (tot, len(SPEC), len(FIX)))
    sys.exit(0)

# -- 正式落盘：总映射 → SPEC → FIX --
for p in FILES:
    s = rd(p)
    n = 0
    for old, new in MAP:
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            n += c
    for pat, new in MAPRE:
        s, c2 = re.subn(pat, new, s)
        n += c2
    if n:
        wr(p, s)
        print('  [map] %s x%d' % (os.path.relpath(p, R), n))

for f, old, new, exp in SPEC:
    p = R + f
    s = rd(p)
    assert s.count(old) == exp, 'SPEC re-check %s' % old[:30]
    wr(p, s.replace(old, new))
    print('  [spec] %s | %s' % (f, old[:34]))

for f, old, new in FIX:
    p = R + f
    s = rd(p)
    assert s.count(old) == 1, 'FIX re-check %s' % old[:30]
    wr(p, s.replace(old, new))
    print('  [fix] %s' % f)

print('✅ v89.219-a 机构词落盘完成')
