# -*- coding: utf-8 -*-
"""v89.229c16：产品侧注释随兵种重构换代（长词优先 · 沿革注释豁免 · 逐行打印供复核）"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
FILES = ['js/data.js', 'js/domain.js', 'js/tactic.js', 'js/battle.js', 'js/map.js', 'js/ui.js',
         'js/systems.js', 'js/state.js', 'js/main.js', 'js/questdata.js', 'js/icons.js', 'index.html']
# 长词优先（防子串先被打掉）
MAP = [
    ('重弩车', '无人轰炸机'), ('破门车', '自行火炮'), ('迫击炮', '自行火炮'),
    ('变异巨兽', '泰坦机甲'), ('防暴甲兵', '电磁盾卫'), ('突击摩托', '武装直升机'),
    ('王牌战车', '狂猎'), ('装甲战车', '主战机甲'), ('重甲战车', '主战机甲'),
    ('摩托游骑', '伏击车'), ('旧军残部', '狂猎'), ('搬运工', '板车'),
    ('侦察兵', '侦察单元'), ('运输车', '运输平台'), ('长矛手', '步行机'),
    ('民兵', '步行机'), ('弩手', '导弹车'), ('象兵', '泰坦机甲'),
    ('虎豹骑', '狂猎'), ('突骑兵', '武装直升机'), ('西凉铁骑', '主战机甲'),
    ('轻骑', '伏击车'), ('铁骑', '主战机甲'), ('青州兵', '狂猎'), ('藤甲兵', '电磁盾卫'),
]
# 沿革/映射类行：出现这些标志之一 → 整行不改（保留旧词才有意义）
KEEP = ['为当时称谓', '原名', '原「', '旧名', '见映射', '当时称谓', '原版', '旧文档', '史料']

LOG = []
tot = 0
for rel in FILES:
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if not os.path.exists(p):
        continue
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    lines = s.split('\n')
    hits = []
    for idx, line in enumerate(lines):
        if any(k in line for k in KEEP):
            continue
        newl = line
        for old, new in MAP:
            if old in newl:
                newl = newl.replace(old, new)
        if newl != line:
            hits.append((idx + 1, line.strip()[:120], newl.strip()[:120]))
            lines[idx] = newl
    if hits:
        io.open(p, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
        LOG.append('##### %s  (%d 行)' % (rel, len(hits)))
        for ln, a, b in hits:
            LOG.append('  L%-6d %s' % (ln, a))
            LOG.append('     →   %s' % b)
        tot += len(hits)
LOG.append('合计改 %d 行' % tot)

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c16_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('合计改 %d 行 → .workbuddy/tmp/p229c16_report.txt\n' % tot)
