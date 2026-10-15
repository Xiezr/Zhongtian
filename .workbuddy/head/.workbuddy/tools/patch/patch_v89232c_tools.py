# -*- coding: utf-8 -*-
"""v89.232 批次 C：活工具面废土化收尾（22 件 · 术语换代 + 展示文本对齐）
口径：
  · 资源名 → 全名（净水/生物质/电能/废钢）
  · 货币「金」（得金/金 −/数字+金 之外的动词/主语用法）→ 本批不动（另议）
  · 「数字+金」「万金」→ 旧币（v89.228 既定口径）
  · 正则/逻辑行不动（只清展示文本与标签）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []

# ---------- 多字词表（22 件全跑） ----------
WORDS = [
    ('将领', '英雄'), ('宿将', '英雄'), ('客栈', '酒馆'), ('商城', '游商'), ('校场', '练兵场'),
    ('民房', '居所'), ('仓库', '货仓'), ('城墙', '围墙'), ('书院', '研习所'),
    ('人口', '幸存者'), ('黄金', '旧币'), ('金币', '旧币'), ('万金', '万旧币'),
    ('英杰', '进化体'), ('名世', '觉醒体'), ('天授', '天启体'),
    ('内政', '治理'), ('统率', '指挥'), ('勇武', '武力'), ('智谋', '谋略'),
    ('百炼', '熔铸'), ('藏珍阁', '陈列馆'),
    ('倚天套', '陨锋套'), ('倚天长剑', '陨锋长剑'), ('游侠套', '游猎套'),
    ('陷阵套', '冲锋套'), ('守御套', '壁垒套'), ('天策套', '智囊套'),
    ('搬运工', '板车'), ('摩托游骑', '伏击车'), ('侦察兵', '侦察单元'), ('长矛手', '步行机'),
    ('运输车', '运输平台'), ('重弩车', '无人轰炸机'), ('破门车', '自行火炮'), ('迫击炮', '自行火炮'),
    ('弩手', '导弹车'), ('装甲战车', '主战机甲'),
    ('木料', '生物质'), ('碎石', '电能'), ('废铁', '废钢'),
    ('种田秘境', '基因实验室'), ('灵草作物', '基因调试'),
    ('秘境/农庄', '基因实验室'), ('秘境', '基因实验室'),
]
# 注意：'秘境' 单独条放最后（先长后短，防 '种田秘境' 被短词先吃掉）

FILES = [
    '.workbuddy/tools/audit/audit_v89105_chains.js',
    '.workbuddy/tools/audit/audit_v89105_modals.js',
    '.workbuddy/tools/audit/audit_v89112_pressure.js',
    '.workbuddy/tools/audit/economy_audit.js',
    '.workbuddy/tools/audit/audit_v89206_systemmatrix.js',
    '.workbuddy/tools/audit/audit_v89208_systemmatrix.js',
    '.workbuddy/tools/gen/gen_v89194_price_table.js',
    '.workbuddy/tools/gen/gen_v89125_build_times.js',
    '.workbuddy/tools/play/lifecycle_v89121.js',
    '.workbuddy/tools/playtest/play_600x.js',
    '.workbuddy/tools/playtest/play_farm2_600x.js',
    '.workbuddy/tools/playtest/play_gold_600x.js',
    '.workbuddy/tools/playtest/play_rush_1x.js',
    '.workbuddy/tools/playtest/play_strat_600x.js',
    '.workbuddy/tools/playtest/play_v89118.js',
    '.workbuddy/tools/playtest/gold_section.js',
    '.workbuddy/tools/playtest/analyze_600.py',
    '.workbuddy/tools/playtest/analyze_gold.py',
    '.workbuddy/tools/playtest/analyze_strat.py',
    '.workbuddy/tools/playtest/analyze_v89100.js',
    '.workbuddy/tools/playtest/analyze_v89107_play30h.js',
    '.workbuddy/tools/playtest/analyze_v89141_96h.js',
]

for f in FILES:
    s = rd(f)
    hits = []
    for old, new in WORDS:
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            hits.append('%s×%d' % (old, c))
    wr(f, s)
    REPORT.append('[ok] %s  %s' % (f.split('/')[-1], ' · '.join(hits) if hits else '(无命中)'))

# ---------- 单字/整句专项 ----------
def rep(f, tag, old, new, cnt=1, soft=False):
    s = rd(f)
    c = s.count(old)
    if soft:
        if c == 0:
            REPORT.append('    ~ %s · %s（无命中，跳过）' % (f.split('/')[-1], tag))
            return
    elif c != cnt:
        REPORT.append('!!! %s · %s：count=%d (want %d)' % (f.split('/')[-1], tag, c, cnt))
        return
    s = s.replace(old, new)
    wr(f, s)
    REPORT.append('    ✓ %s · %s ×%d' % (f.split('/')[-1], tag, c))

PLAYS = ['.workbuddy/tools/playtest/' + x for x in
         ['play_600x.js', 'play_farm2_600x.js', 'play_gold_600x.js', 'play_rush_1x.js',
          'play_strat_600x.js', 'play_v89118.js']]
for f in PLAYS:
    rep(f, 'init.res',
        '初始资源 粮木石铁金各 2 万 · 人口 200 · 城外预设 2田1木1石1铁',
        '初始资源 净水/生物质/电能/废钢/旧币各 2 万 · 幸存者 200 · 城外预设 2净化厂 1水培温室 1发电站 1电弧熔炉')

C = '.workbuddy/tools/audit/audit_v89105_chains.js'
rep(C, 'convoy', '粮 30,000 起运', '净水 30,000 起运')
rep(C, 'subcity', '分城粮 +', '分城净水 +')

A6 = '.workbuddy/tools/playtest/analyze_600.py'
rep(A6, 'hdr1', '| 年 | 现实min | 粮 | 木 | 石 | 铁 | 金 | 人口/上限 |',
    '| 年 | 现实min | 净水 | 生物质 | 电能 | 废钢 | 金 | 幸存者/上限 |')
rep(A6, 'curve', '（兵力 / 金 / 人口 / 木——四大关键指标）',
    '（兵力 / 金 / 幸存者 / 生物质——四大关键指标）')
rep(A6, 'hdr2', '| 年 | 兵力 | 城外驻军 | 金 | 人口 | 木 | 石 |',
    '| 年 | 兵力 | 城外驻军 | 金 | 幸存者 | 生物质 | 电能 |')
rep(A6, 'loss', "被破累计损失：粮 %s · 木 %s · 石 %s · 铁 %s · 金 %s",
    "被破累计损失：净水 %s · 生物质 %s · 电能 %s · 废钢 %s · 金 %s")
rep(A6, 'sell', "市场售粮：%d 笔，累计售出 %s 粮、换金 %s（均价 ≈ %.1f 粮/金）",
    "市场售水：%d 笔，累计售出 %s 净水、换金 %s（均价 ≈ %.1f 净水/金）")

rep('.workbuddy/tools/playtest/analyze_v89141_96h.js', 'hdr',
    '金     粮      木     石      铁    人口/上限',
    '金     净水      生物质     电能      废钢    幸存者/上限')

rep('.workbuddy/tools/gen/gen_v89194_price_table.js', 'num.gold', "' 金'", "' 旧币'", cnt=1)
rep('.workbuddy/tools/gen/gen_v89194_price_table.js', '40w', '40 万金', '40 万旧币')
rep('.workbuddy/tools/gen/gen_v89194_price_table.js', '24w', '24 万金', '24 万旧币')

rep('.workbuddy/tools/gen/gen_v89125_build_times.js', 'stone.share',
    '石料占 66%（砖石工程主材）', '电能占 66%（体量最大的一项）')

print('\n'.join(REPORT))
