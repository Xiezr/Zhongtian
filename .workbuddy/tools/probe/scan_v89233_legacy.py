# -*- coding: utf-8 -*-
"""v89.233 侦察：产品 js + index.html 里的'旧术语'残留扫描（注释层为主）

词表 = 历轮换皮已应清代的旧词（v89.214/217/219/222/223/224/228/229/231）。
输出：按文件 → 按词 → 行号+行内容，供人工分类（真残留 vs 设计保留 vs 引述）。
"""
import io, os, re

WORDS = [
    # v89.228 人口/货币族
    ('人口', None), ('万金', None), ('金币', None), ('银两', None), ('金银', None),
    # 资源旧名
    ('粮食', None), ('粮草', None), ('木料', None), ('石料', None), ('碎石', None),
    ('铁锭', None), ('铁矿', None), ('石矿', None), ('伐木', None), ('矿场', None),
    # 兵种旧名（全称）
    ('民兵', None), ('义兵', None), ('长矛手', None), ('侦察兵', None), ('搬运工', None),
    ('轻骑', None), ('铁骑', None), ('虎豹骑', None), ('突骑兵', None), ('西凉铁骑', None),
    ('青州兵', None), ('刀盾兵', None), ('藤甲兵', None), ('投石车', None), ('冲车', None),
    ('床弩', None), ('弩手', None), ('弓兵', None), ('弓手', None), ('枪兵', None),
    ('摩托游骑', None), ('装甲战车', None), ('运输车', None), ('重弩车', None), ('破门车', None),
    ('迫击炮', None), ('旧军残部', None), ('防暴甲兵', None), ('突击摩托', None),
    ('王牌战车', None), ('重甲战车', None), ('变异巨兽', None), ('象兵', None),
    # 官制旧词
    ('太守', None), ('郡守', None), ('县令', None), ('州牧', None), ('刺史', None),
    ('知府', None), ('衙门', None), ('朝廷', None), ('诸侯', None),
    # 城名旧词（v89.217 架空化）
    ('洛阳', None), ('长安', None), ('许昌', None), ('许都', None), ('邺城', None),
    ('宛城', None), ('宛县', None), ('东平', None), ('司隶', None), ('成都', None),
    # 机构/行政后缀（v89.219）
    ('州城', None), ('州治', None), ('郡城', None), ('郡治', None), ('县城', None), ('州郡', None),
    # 科技旧名（v89.231）
    ('练兵技巧', None), ('战斗技巧', None), ('打造技巧', None), ('侦察技巧', None),
    ('防护技巧', None), ('负重技巧', None), ('行军技巧', None), ('抛射技巧', None),
    ('驾驭技巧', None), ('建筑技术', None), ('储存技术', None), ('补给技巧', None),
    ('统帅能力', None), ('城防技术', None), ('维修技术', None), ('抢掠技巧', None),
    ('合成技巧', None), ('车轮技术', None), ('机修技巧', None), ('研究技巧', None),
    ('种植技术', None), ('砍伐技术', None), ('挖掘技术', None), ('冶炼技术', None),
    # 其它高频旧词
    ('练兵', None), ('练功', None), ('校场', None), ('演武', None), ('阅兵', None),
    ('坊市', None), ('集市', None), ('客栈', None), ('酒店', None), ('钱庄', None),
    ('书院', None), ('藏书阁', None), ('藏经阁', None), ('武将', None), ('文官', None),
    ('士卒', None), ('军饷', None), ('俸禄', None), ('赋税', None), ('徭役', None),
]

FILES = ['js/data.js', 'js/ui.js', 'js/main.js', 'js/systems.js', 'js/domain.js',
         'js/state.js', 'js/battle.js', 'js/story.js', 'js/questdata.js', 'js/map.js',
         'js/tactic.js', 'js/icons.js', 'js/gicons.js', 'index.html']

total = 0
for f in FILES:
    p = 'E:/Deepseekdb/' + f
    s = io.open(p, encoding='utf-8', errors='replace').read()
    lines = s.split('\n')
    rows = []
    for w, _ in WORDS:
        pos = 0
        while True:
            i = s.find(w, pos)
            if i < 0:
                break
            ln = s.count('\n', 0, i) + 1
            col = i - s.rfind('\n', 0, i) - 1
            line = lines[ln - 1]
            ctx = line[max(0, col - 20):col + 24]
            rows.append((ln, col, w, ctx))
            pos = i + len(w)
    if rows:
        print('########## ' + f + '  (%d)' % len(rows))
        for ln, col, w, ctx in sorted(rows):
            print('L%-6d [%s] %s' % (ln, w, ctx.replace('\t', ' ')))
        print()
        total += len(rows)
print('== 合计 %d ==' % total)
