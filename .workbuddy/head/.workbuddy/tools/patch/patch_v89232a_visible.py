# -*- coding: utf-8 -*-
"""v89.232 批次 A：产品可见面废土化收尾（39 处）
范围：运行时字符串（会拼接进 UI 的）——单字资源名/联合文案/旧建筑名/旧材料名；
注释历史面不在本轮范围（沿革注/引述按既定口径保留）。
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []
ERR = []

def rep(f, tag, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    if c != cnt:
        ERR.append('%s · %s: count=%d (want %d)' % (f, tag, c, cnt))
        return
    s = s.replace(old, new)
    wr(f, s)
    REPORT.append('[ok] %s · %s' % (f, tag))

# ================= data.js =================
D = 'js/data.js'
rep(D, 'terrain.plain', "desc: '可建新城。粮 +3%/级'", "desc: '可建新城。净水 +3%/级'")
rep(D, 'terrain.caoyuan', "desc: '粮 +3%/级' }", "desc: '净水 +3%/级' }")
rep(D, 'terrain.zhaoze', "desc: '粮 +5%/级' }", "desc: '净水 +5%/级' }")
rep(D, 'terrain.lake', "desc: '粮 +8%/级（粮产最高）' }", "desc: '净水 +8%/级（净水产量最高）' }")
rep(D, 'terrain.forest', "desc: '木 +5%/级' }", "desc: '生物质 +5%/级' }")
rep(D, 'terrain.desert', "desc: '石 +5%/级' }", "desc: '电能 +5%/级' }")
rep(D, 'terrain.hill', "desc: '铁 +5%/级' }", "desc: '废钢 +5%/级' }")
# 注释块（v15 段 · 现行机制说明）
rep(D, 'terrain.note.plain', '   *   平原 / 草原  粮 +3%/级', '   *   平原 / 草原  净水 +3%/级')
rep(D, 'terrain.note.zhaoze', '   *   沼泽         粮 +5%/级', '   *   沼泽         净水 +5%/级')
rep(D, 'terrain.note.lake', '   *   湖泊         粮 +8%/级', '   *   湖泊         净水 +8%/级')
rep(D, 'terrain.note.forest', '   *   森林         木 +5%/级', '   *   森林         生物质 +5%/级')
rep(D, 'terrain.note.desert', '   *   荒漠         石 +5%/级', '   *   荒漠         电能 +5%/级')
rep(D, 'terrain.note.hill', '   *   山地         铁 +5%/级', '   *   山地         废钢 +5%/级')
# 征调文案
rep(D, 'levy.desc', '按本城等级获得粮木石铁各一笔（每日一次）', '按本城等级获得净水/生物质/电能/废钢各一笔（每日一次）')
# 季节
rep(D, 'season.spring', "desc: '春耕之时，粮产略增'", "desc: '春汛将至，净水略增'")
rep(D, 'season.summer', "desc: '夏日方长，粮产更盛'", "desc: '雨量丰沛，净水更盛'")
rep(D, 'season.autumn', "desc: '秋收之际，粮产最丰'", "desc: '秋水澄清，净水最丰'")
rep(D, 'season.winter', "desc: '冬寒地冻，粮产锐减'", "desc: '河道封冻，净水锐减'")
# 天气
rep(D, 'weather.rain', '霖雨不止：粮产 −15%', '霖雨不止：净水 −15%')
rep(D, 'weather.snow', '大雪封道：粮产 −30%', '大雪封道：净水 −30%')
# 奇遇（奖励指向含糊化）
rep(D, 'encounter.ruin', '地下或有余粮', '地下或有所藏')
# 垂钓 / 行猎（去掉与奖励资源错位的"粮"括注）
rep(D, 'lake.desc', '肥鱼入篓充作军粮', '肥鱼入篓')
rep(D, 'lake.outcome', '肥鱼入篓（充作净水配给）', '肥鱼入篓')
rep(D, 'forest.desc', '亦可得野味充粮', '亦可得野味')
rep(D, 'forest.outcome', '猎得野味（充粮）', '猎得野味')

# ================= ui.js =================
U = 'js/ui.js'
# 锻造间副标题（拆分串：全角+半角混用）
rep(U, 'forge.sub.iron',
    "'　铁 ' + U.numText(s.res.iron || 0, 0) + '　木 ' + U.numText(s.res.wood || 0, 0) +",
    "'　废钢 ' + U.numText(s.res.iron || 0, 0) + '　生物质 ' + U.numText(s.res.wood || 0, 0) +")
rep(U, 'forge.sub.stone',
    "'　石 ' + U.numText(s.res.stone || 0, 0),",
    "'　电能 ' + U.numText(s.res.stone || 0, 0),")
# 派系面板（建筑现名：基因实验室）
rep(U, 'sect.title', "'⚔️ 派系驻地'", "'⚔️ 派系'")
rep(U, 'sect.found1', "须派系驻地 <b>Lv", "须基因实验室 <b>Lv")
rep(U, 'sect.found2', "'派系驻地等级不足'", "'基因实验室等级不足'")
rep(U, 'sect.found3', '派系驻地 Lv 不足。', '基因实验室 Lv 不足。')
# 交易站比价
rep(U, 'market.ratio', '比价 <b>粮 1 : 木 2 : 石 3 : 铁 4</b>（粮最便宜）',
    '比价 <b>净水 1 : 生物质 2 : 电能 3 : 废钢 4</b>（净水最便宜）')
# 建造费用口径行
rep(U, 'cost.line', '（金：全境通用 · 粮木石铁：按本城结算）',
    '（金：全境通用 · 净水/生物质/电能/废钢：按本城结算）')
# 堆场悬停
rep(U, 'ext.tip', "'粮 · 产'", "'净水 · 产'")
# 筑城按钮
rep(U, 'build.city', '🏯 筑城（粮木石铁金 各 1 万）', '🏯 筑城（净水/生物质/电能/废钢/旧币 各 1 万）')
# 据点可采材料（河石→碎晶）
rep(U, 'fort.mats', '粗铁 · 松木 · 生皮 · 兽筋 · 河石 · 帆布', '粗铁 · 松木 · 生皮 · 兽筋 · 碎晶 · 帆布')
# 出征库藏行
rep(U, 'spoil.grain', '">库藏　粮 <b>\'', '">库藏　净水 <b>\'')
rep(U, 'spoil.wood', "'　木 ' + U.fmt(nci.res.wood) + '　石 ' + U.fmt(nci.res.stone) + '　铁 ' + U.fmt(nci.res.iron) +",
    "'　生物质 ' + U.fmt(nci.res.wood) + '　电能 ' + U.fmt(nci.res.stone) + '　废钢 ' + U.fmt(nci.res.iron) +")
# 材料研发行（羊脂玉→纯晶 · 织锦→高强纤维）
rep(U, 'farm.matline', '钢锭 / 铁木 / 硬甲皮 / 巨兽筋 / 羊脂玉 / 织锦', '钢锭 / 铁木 / 硬甲皮 / 巨兽筋 / 纯晶 / 高强纤维')

# ================= main.js =================
rep('js/main.js', 'terrain.bonus',
    "{ grain: '粮', wood: '木', stone: '石', iron: '铁', gold: '金' }",
    "{ grain: '净水', wood: '生物质', stone: '电能', iron: '废钢', gold: '旧币' }")

# ================= systems.js =================
rep('js/systems.js', 'chest.rn',
    "var RN = { grain: '粮', wood: '木', stone: '石', iron: '铁' };",
    "var RN = { grain: '净水', wood: '生物质', stone: '电能', iron: '废钢' };")

# ================= domain.js =================
G = 'js/domain.js'
rep(G, 'citycost.lack', "需 粮/木/石/铁/金 各 ", "需 净水/生物质/电能/废钢/旧币 各 ")
rep(G, 'citycost.log', "耗 粮木石铁金 各 ", "耗 净水/生物质/电能/废钢/旧币 各 ")
rep(G, 'levy.gain', "'粮木石铁各 +'", "'净水/生物质/电能/废钢各 +'")
rep(G, 'sect.chk', "'本城尚未建造派系驻地'", "'本城尚未建造基因实验室'")
rep(G, 'sect.join', "'派系驻地需 Lv'", "'基因实验室需 Lv'")
rep(G, 'sect.found', "'立派须派系驻地 Lv'", "'立派须基因实验室 Lv'")

# ================= questdata.js =================
rep('js/questdata.js', 'quest.r06', "title: '伏击断粮'", "title: '伏击断水'")

print('\n'.join(REPORT))
if ERR:
    print('\n!!! 失败项：')
    print('\n'.join(ERR))
else:
    print('\n全部 %d 处落地。' % len(REPORT))
