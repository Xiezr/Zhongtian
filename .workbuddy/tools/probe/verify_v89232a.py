# -*- coding: utf-8 -*-
"""v89.232 批次 A 落盘验证（干净版）：逐条 new 在 + old 无"""
import io

R = 'E:/Deepseekdb/'
# (文件, new串, old串)
CHECKS = [
    ('js/data.js', "可建新城。净水 +3%/级", "可建新城。粮 +3%/级"),
    ('js/data.js', "净水 +8%/级（净水产量最高）", "粮 +8%/级（粮产最高）"),
    ('js/data.js', "生物质 +5%/级", "木 +5%/级'"),
    ('js/data.js', "电能 +5%/级", "石 +5%/级'"),
    ('js/data.js', "废钢 +5%/级", "铁 +5%/级'"),
    ('js/data.js', "净水/生物质/电能/废钢各一笔", "粮木石铁各一笔"),
    ('js/data.js', "春汛将至，净水略增", "春耕之时"),
    ('js/data.js', "霖雨不止：净水 −15%", "霖雨不止：粮产"),
    ('js/data.js', "地下或有所藏", "地下或有余粮"),
    ('js/data.js', "泽畔垂钓：肥鱼入篓，偶得水中沉物。", "肥鱼入篓充作军粮"),
    ('js/data.js', "猎得野味', grain", "猎得野味（充粮）"),
    ('js/ui.js', "'⚔️ 派系' + (lv", "'⚔️ 派系驻地' + (lv"),
    ('js/ui.js', "须基因实验室 <b>Lv", "须派系驻地 <b>Lv"),
    ('js/ui.js', "基因实验室等级不足", "派系驻地等级不足"),
    ('js/ui.js', "比价 <b>净水 1 : 生物质 2 : 电能 3 : 废钢 4</b>", "比价 <b>粮 1 : 木 2 : 石 3 : 铁 4</b>"),
    ('js/ui.js', "净水/生物质/电能/废钢：按本城结算", "粮木石铁：按本城结算"),
    ('js/ui.js', "🏯 筑城（净水/生物质/电能/废钢/旧币 各 1 万）", "🏯 筑城（粮木石铁金 各 1 万）"),
    ('js/ui.js', "兽筋 · 碎晶 · 帆布", "兽筋 · 河石 · 帆布"),
    ('js/ui.js', "库藏　净水 <b>", "库藏　粮 <b>"),
    ('js/ui.js', "纯晶 / 高强纤维", "羊脂玉 / 织锦"),
    ('js/main.js', "grain: '净水', wood: '生物质', stone: '电能', iron: '废钢', gold: '旧币'", "grain: '粮', wood: '木'"),
    ('js/systems.js', "var RN = { grain: '净水', wood: '生物质', stone: '电能', iron: '废钢' };", "var RN = { grain: '粮'"),
    ('js/domain.js', "需 净水/生物质/电能/废钢/旧币 各 ", "需 粮/木/石/铁/金 各 "),
    ('js/domain.js', "耗 净水/生物质/电能/废钢/旧币 各 ", "耗 粮木石铁金 各 "),
    ('js/domain.js', "'净水/生物质/电能/废钢各 +'", "'粮木石铁各 +'"),
    ('js/domain.js', "本城尚未建造基因实验室", "本城尚未建造派系驻地"),
    ('js/domain.js', "基因实验室需 Lv", "'派系驻地需 Lv'"),
    ('js/domain.js', "立派须基因实验室 Lv", "立派须派系驻地 Lv"),
    ('js/questdata.js', "title: '伏击断水'", "title: '伏击断粮'"),
]

bad = 0
for f, new, old in CHECKS:
    s = io.open(R + f, encoding='utf-8').read()
    n_ok = new in s
    o_bad = old in s
    if n_ok and not o_bad:
        print('✅ %-16s %s' % (f, new[:52]))
    else:
        bad += 1
        print('❌ %-16s [%s | %s] %s' % (f, 'new-OK' if n_ok else 'NEW-MISS', 'old-仍存' if o_bad else 'old-净', new[:44]))
print('\n失败 %d / %d' % (bad, len(CHECKS)))
