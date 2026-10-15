# -*- coding: utf-8 -*-
"""v89.227 P2：批次二 · 材料体系汉化 —— 24 名核查清理 + 六大系列名/use + 特产 lore + 描述去古风。"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    if DRY:
        return
    tmp = BASE + p + '.tmp227'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)


def rep(p, old, new, cnt=1, tag=''):
    s = rd(p)
    c = s.count(old)
    assert c == cnt, '%s: [%s] x%d (expect %d)' % (p, tag or old[:60], c, cnt)
    wr(p, s.replace(old, new))
    print('  [ok] %s %s' % (p, tag))


P = 'js/data.js'

# ========== A) 24 材料表：逐行替换（改动 = 名/描述；id/price/tier 一律不动）==========
rep(P, "name: '粗铁',   price: 10,  desc: '寻常生铁，炉火可锻。山野矿脉皆出。'",
       "name: '粗铁',   price: 10,  desc: '废墟回炉所得，杂质未清，炉火可再锻。'", tag='fatie')
rep(P, "desc: '百炼去杂，刃口不卷。唯城池武库有之。'",
       "desc: '熔铸去杂，刃口不卷。唯城池武库有之。'", tag='jingtie（百炼→熔铸先行，P3 不再重复）')
rep(P, "desc: '折叠锻打千层，纹如流水，削铁如泥。'",
       "desc: '层叠锻打千层以上，断面流纹，硬度冠绝。'", tag='bintie')
rep(P, "desc: '天外坠铁，非人间炉火所能熔。'",
       "desc: '天外坠铁，现有熔炉无法熔化，只能冷作成型。'", tag='yuntie')
rep(P, "desc: '纹理细密，经年不蠹，造弓之上材。'",
       "desc: '纹理细密，经年不蠹，制弩之上材。'", tag='nanmu')
rep(P, "desc: '香气沉郁，坚重几与铁石同。'",
       "desc: '树脂浸透成材，坚重几与铁石同。'", tag='tanmu')
rep(P, "name: '复合材',   price: 280, desc: '上古通天之木，得其一段可造神兵之柄。'",
       "name: '复合材',   price: 280, desc: '多层纤维热压复合，强度超钢，重型构架之选。'", tag='jianmu')
rep(P, "name: '硬甲皮',   price: 95,  desc: '犀皮七层，箭矢难透。'",
       "name: '硬甲皮',   price: 95,  desc: '多层压合硬化，箭矢难透。'", tag='xige')
rep(P, "name: '变异皮',   price: 300, desc: '蛟龙之皮，入水不濡，刀枪难入。'",
       "name: '变异皮',   price: 300, desc: '变异生物的再生皮层，入水不濡，刀枪难入。'", tag='jiaoge')
rep(P, "name: '泰坦筋',   price: 320, desc: '真龙之筋，一丝可当千钧。'",
       "name: '仿生腱',   price: 320, desc: '人工培育的腱束纤维，一丝可当千钧。'", tag='longjin')
rep(P, "name: '河石',   price: 12,  desc: '河中卵石，琢磨可成小件。'",
       "name: '碎晶',   price: 12,  desc: '废墟中拣出的晶体碎块，打磨可制小件。'", tag='heshi')
rep(P, "name: '青玉',   price: 36,  desc: '色青质密，为佩为玺。'",
       "name: '晶坯',   price: 36,  desc: '重熔浇铸的晶体坯料，质密均匀。'", tag='qingyu')
rep(P, "name: '羊脂玉', price: 110, desc: '温润如脂，王侯所宝。'",
       "name: '纯晶', price: 110, desc: '高纯提炼，透光无瑕，精密器件之关键料。'", tag='yangzhi')
rep(P, "name: '昆山玉', price: 340, desc: '昆山之玉，天下至宝，得之可镇国。'",
       "name: '源晶', price: 340, desc: '高能晶核，能量密度惊人，可驱动重载装备。'", tag='kunshan')
rep(P, "name: '帆布',   price: 8,   desc: '粗麻织就，为袍为帐。'",
       "name: '帆布',   price: 8,   desc: '回收纤维粗织，为袍为帐。'", tag='mabu')
rep(P, "name: '细布',   price: 26,  desc: '蚕丝细布，轻柔生光。'",
       "name: '细布',   price: 26,  desc: '精纺纤维，轻柔生光。'", tag='xijuan')
rep(P, "name: '织锦',   price: 92,  desc: '蜀中织锦，一寸千金。'",
       "name: '高强纤维',   price: 92,  desc: '多股合捻的高强纤维，一寸千金。'", tag='shujin')
rep(P, "name: '云缎',   price: 290, desc: '云霞之锦，日光下五色流转。'",
       "name: '光学纤维',   price: 290, desc: '纤维束内流光五色，信号传导之材。'", tag='yunjin')

# ========== B) 五段系列注释（MATERIALS 内）==========
rep(P, "/* 铁系：兵刃甲胄之本 */", "/* 铁系：机甲构件之骨 */", tag='注释·铁')
rep(P, "/* 木系：弓弩器械之干 */", "/* 木系：器械机架之干 */", tag='注释·木')
rep(P, "/* 革系：甲裳靴履之肤 */", "/* 革系：护具外装之肤 */", tag='注释·革')
rep(P, "/* 筋系：弓弦索具之力 */", "/* 筋系：传动牵索之力 */", tag='注释·筋')
rep(P, "/* 玉系：佩饰玺绶之华 */", "/* 晶系：能量储输之华 */", tag='注释·玉')
rep(P, "/* 丝系：战袍旗幡之彩 */", "/* 纤维系：蒙皮标识之彩 */", tag='注释·丝')

# ========== C) MAT_SERIES 六行：名 + use ==========
rep(P, "    { id: 'iron',    name: '铁系', tone: '#98a2b2', use: '刀兵甲胄之骨' },",
       "    { id: 'iron',    name: '铁系', tone: '#98a2b2', use: '机甲构件之骨' },", tag='series·iron')
rep(P, "    { id: 'wood',    name: '木系', tone: '#a8814c', use: '弓弩器械之干' },",
       "    { id: 'wood',    name: '木系', tone: '#a8814c', use: '器械机架之干' },", tag='series·wood')
rep(P, "    { id: 'leather', name: '革系', tone: '#a06f4a', use: '甲裳靴履之肤' },",
       "    { id: 'leather', name: '革系', tone: '#a06f4a', use: '护具外装之肤' },", tag='series·leather')
rep(P, "    { id: 'sinew',   name: '筋系', tone: '#b89a6c', use: '弓弦索具之力' },",
       "    { id: 'sinew',   name: '筋系', tone: '#b89a6c', use: '传动牵索之力' },", tag='series·sinew')
rep(P, "    { id: 'jade',    name: '玉系', tone: '#74b0a6', use: '佩饰玺绶之华' },",
       "    { id: 'jade',    name: '晶系', tone: '#74b0a6', use: '能量储输之华' },", tag='series·jade')
rep(P, "    { id: 'silk',    name: '丝系', tone: '#c07f96', use: '战袍旗幡之彩' },",
       "    { id: 'silk',    name: '纤维系', tone: '#c07f96', use: '蒙皮标识之彩' },", tag='series·silk')

# ========== D) 特产 lore（3 条提到旧材料名）==========
rep(P, "lore: '江畔以南，玉矿隐见。'", "lore: '江畔以南，晶矿隐见。'", tag='潮湾 lore')
rep(P, "lore: '南境旧织造区，织锦充于市集。'", "lore: '南境旧织造区，高强纤维充于市集。'", tag='泽心 lore')
rep(P, "lore: '极南之地，美玉温润如脂。'", "lore: '极南之地，纯晶温润透光。'", tag='藤林 lore')

# ========== 写后自检 ==========
if not DRY:
    d = rd(P)
    # 硬断言：新名在册 / 旧名（作为材料 name）清零
    assert d.count("name: '高强纤维'") == 1 and d.count("name: '光学纤维'") == 1
    assert d.count("name: '碎晶'") == 1 and d.count("name: '晶坯'") == 1 and d.count("name: '纯晶'") == 1 and d.count("name: '源晶'") == 1
    assert d.count("name: '仿生腱'") == 1
    assert "name: '羊脂玉'" not in d and "name: '昆山玉'" not in d and "name: '泰坦筋'" not in d and "name: '云缎'" not in d and "name: '织锦'" not in d and "name: '青玉'" not in d and "name: '河石'" not in d
    # 软警告：模糊词残余（人工判读历史注释是否合法）
    for w in ['羊脂玉', '昆山玉', '泰坦筋', '云缎', '河石', '织锦', '蛟龙', '犀皮', '蜀中', '王侯']:
        c = d.count(w)
        if c:
            print('  [warn] data.js 残余 %s x%d（请核是否历史注释）' % (w, c))
    print('P2 自检通过：18 行材料 + 6 注释 + 6 系列 + 3 lore')
else:
    print('P2 DRY 完成')
print('P2 DONE')
