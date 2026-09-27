# -*- coding: utf-8 -*-
# v89.152f：修理 id/名 冲突 —— 青玉→璞玉(puyu)、和田玉→独山玉(dushanyu)；迁移表收敛为 14 行（夜明珠转正保留）
import io, re

P = 'E:/Deepseekdb/js/data.js'
PI = 'E:/Deepseekdb/js/icons.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

# ---------- ① 珠宝定义两处 ----------
A1 = u"    { id: 'qingyu', name: '青玉', type: 'jewel', loyalty: 20, price: 10, desc: '赏赐忠诚 +20（森林所产）' },"
A1N = u"    { id: 'puyu', name: '璞玉', type: 'jewel', loyalty: 20, price: 10, desc: '赏赐忠诚 +20（森林所产 · 未雕之原石）' },"
if A1 in s:
    assert s.count(A1) == 1
    s = s.replace(A1, A1N)
    print('D1: qingyu -> puyu')
else:
    print('D1: skip')

A2 = u"    { id: 'hetianyu', name: '和田玉', type: 'jewel', loyalty: 100, price: 240, desc: '赏赐忠诚 +100（山地所产）' },"
A2N = u"    { id: 'dushanyu', name: '独山玉', type: 'jewel', loyalty: 100, price: 240, desc: '赏赐忠诚 +100（山地所产 · 玉中君子）' },"
if A2 in s:
    assert s.count(A2) == 1
    s = s.replace(A2, A2N)
    print('D2: hetianyu -> dushanyu')
else:
    print('D2: skip')

# ---------- ② 命名清单注释 ----------
for old, new in [(u'青玉(森)', u'璞玉(森)'), (u'和田玉(山)', u'独山玉(山)'), (u'蚌珠→和田玉', u'蚌珠→独山玉')]:
    if old in s:
        assert s.count(old) == 1, 'comment count ' + old
        s = s.replace(old, new)
        print('comment: ' + old + ' -> ' + new)
    else:
        print('comment skip: ' + old)

# ---------- ③ 地形表 ----------
if u"forest:  ['qingyu'" in s:
    assert s.count(u"forest:  ['qingyu', 'cuiyu', 'chenxiang']") == 1
    s = s.replace(u"forest:  ['qingyu', 'cuiyu', 'chenxiang']", u"forest:  ['puyu', 'cuiyu', 'chenxiang']")
    print('T1: forest')
else:
    print('T1: skip')
if u"'hetianyu']," in s:
    assert s.count(u"hill:    ['lvsongshi', 'bixi', 'hetianyu'],") == 1
    s = s.replace(u"hill:    ['lvsongshi', 'bixi', 'hetianyu'],", u"hill:    ['lvsongshi', 'bixi', 'dushanyu'],")
    print('T2: hill')
else:
    print('T2: skip')

# ---------- ④ jewelMinLv（由 ⑤ 的全量替换覆盖，这里只报告） ----------
print('M: jewelMinLv covered by step 5 (qingyu:%d, hetianyu:%d)' % (s.count(u'qingyu:'), s.count(u'hetianyu:')))

# ---------- ⑤ RANK 表（qingyu / hetianyu 全量替换） ----------
n1 = s.count(u'qingyu: ')
n2 = s.count(u'hetianyu: ')
s = s.replace(u'qingyu: ', u'puyu: ').replace(u'hetianyu: ', u'dushanyu: ')
print('RANK: qingyu x%d, hetianyu x%d' % (n1, n2))

# ---------- ⑥ 迁移表收敛为 14 行（夜明珠转正保留） ----------
OLD_MIG = u"""  DATA.JEWEL_MIG152 = {
    zhenzhu: 'bengzhu', shanhu: 'mila', liuli: 'meiyu', hupo: 'qingyu',
    manao: 'lvsongshi', shuijing: 'yusui', feicui: 'yinchenmu', yushi: 'cuiyu',
    yemingzhu: 'danbaishi', xueshanhu: 'jiaorenlei', longyan: 'tianzhu',
    lantianyu: 'longxianxiang', fengyu: 'chenxiang', heshibi: 'yemingzhu',
    chuanguo: 'hetianyu',
  };"""
NEW_MIG = u"""  DATA.JEWEL_MIG152 = {
    zhenzhu: 'bengzhu', shanhu: 'mila', liuli: 'meiyu', hupo: 'puyu',
    manao: 'lvsongshi', shuijing: 'yusui', feicui: 'yinchenmu', yushi: 'cuiyu',
    xueshanhu: 'jiaorenlei', longyan: 'tianzhu',
    lantianyu: 'longxianxiang', fengyu: 'chenxiang',
    heshibi: 'yemingzhu', chuanguo: 'dushanyu',
  };"""
if OLD_MIG in s:
    s = s.replace(OLD_MIG, NEW_MIG)
    print('MIG: 15 -> 14 rows')
else:
    print('MIG: skip')

# ---------- ⑦ 迁移表头注释更新 ----------
OLD_C = u"""   * v89.152：珠宝体系重设 —— **旧 15 种 -> 新 18 种**的等值换算表
   * ------------------------------------------------------------
   * 老板：「目前的珠宝体系更换掉（实际上就是换掉名字）」—— 换算按 **price 一一对应**
   * （旧珍珠 2 -> 新蚌珠 2 …… 旧传国玉玺 240 -> 新和田玉 240），玩家资产零损耗。
   * 老的库存键（s.items 里的旧 id）由 `GAME.migrateJewels152` 按本表搬运
   * （读档/首 tick 执行 · 幂等标记 s.jewelMig152）。
   * ⚠️ 表内"目标键"与新体系 id 同名不算冲突（旧夜明珠->蛋白石；新夜明珠是另一颗）——
   *   迁移算法"先把旧键全部摘下，再写入目标键"，摘与写分两步，天然安全。"""
NEW_C = u"""   * v89.152：珠宝体系重设 —— **旧 15 种 -> 新 18 种**的等值换算表
   * ------------------------------------------------------------
   * 老板：「目前的珠宝体系更换掉（实际上就是换掉名字）」—— 换算按 **price 一一对应**
   * （旧珍珠 2 -> 新蚌珠 2 …… 旧传国玉玺 240 -> 新独山玉 240），玩家资产零损耗。
   * **「夜明珠」是唯一保留项**（老板 v89.140 点名的"全地形珠"机制）——
   *   它**不在本表里**：老档手里的夜明珠按**原名原物**保留，随新体系自动升格为顶级珠
   *   （48 -> 150 价位，数量不变）。
   * 老的库存键（s.items 里的旧 id）由 `GAME.migrateJewels152` 按本表搬运
   * （读档/首 tick 执行 · 幂等标记 s.jewelMig152）。
   * ⚠️ 表内所有"源键"（14 个）都是从 DATA.ITEMS 退役的旧 id —— 迁移"先摘后写"，
   *   与任何新 id（含 yemingzhu）都不冲突。"""
if OLD_C in s:
    s = s.replace(OLD_C, NEW_C)
    print('CMT: mig head')
else:
    print('CMT: skip')

# ---------- 写盘 + 自检 ----------
def cb(t):
    return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
assert cb(s) == cb(io.open(P, encoding='utf-8', newline='').read()), 'brace changed'
io.open(P, 'w', encoding='utf-8', newline='').write(s)

chk = io.open(P, encoding='utf-8', newline='').read()
# 判据 = 珠宝定义形态（材料表里的「青玉」id/名要保留 —— 那是另一条体系）
assert u"{ id: 'qingyu', name: '青玉', type: 'jewel'" not in chk, 'qingyu jewel def remains'
assert u"{ id: 'hetianyu'" not in chk, 'hetianyu still present'
assert chk.count(u"id: 'puyu'") == 1 and chk.count(u"id: 'dushanyu'") == 1
assert chk.count(u"type: 'jewel'") == 18
assert chk.count(u'JEWEL_MIG152 = {') == 1
print('OK data len %d -> %d' % (orig, len(chk)))

# ---------- icons.js 同步（只动 GEM_PAL 两行；材料图标映射里的 'qingyu' 保留） ----------
si = io.open(PI, encoding='utf-8', newline='').read()
if u"qingyu: ['#8fc4a8'" in si:
    assert si.count(u"qingyu: ['#8fc4a8'") == 1 and si.count(u"hetianyu: ['#f4f0e4'") == 1
    si = si.replace(u"qingyu: ['#8fc4a8', '#3c7858']", u"puyu: ['#a8c8b0', '#5c8a68']")
    si = si.replace(u"/* 青玉：青绿 */", u"/* 璞玉：原石青白 */")
    si = si.replace(u"hetianyu: ['#f4f0e4', '#c8bca0']", u"dushanyu: ['#e4f0e8', '#a8c4b0']")
    si = si.replace(u"/* 和田玉：羊脂白 */", u"/* 独山玉：玉中君子 */")
    io.open(PI, 'w', encoding='utf-8', newline='').write(si)
    print('icons updated')
else:
    print('icons skip')
chi = io.open(PI, encoding='utf-8', newline='').read()
assert u"qingyu: [" not in chi and u'hetianyu' not in chi
assert chi.count(u'puyu:') == 1 and chi.count(u'dushanyu:') == 1
print('SELF-CHECK PASS')
