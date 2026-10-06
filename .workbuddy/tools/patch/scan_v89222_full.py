# -*- coding: utf-8 -*-
"""v89.222 · 细扫：全量命中行原文 + 概念词/单字弓的现行口径"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

TROOP = ['长枪', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '大象', '青州',
         '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '枪兵', '矛兵', '弩兵', '骑兵', '刀牌']
INST = ['州城', '州治', '郡城', '郡治', '县城', '都城', '帝都', '州郡', '州府', '太守', '郡守', '郡县', '州界', '郡界', '州牧']
CITY = ['洛阳', '司隶', '幽州', '徐州', '荆州', '兖州', '并州', '益州', '冀州', '交州', '扬州', '豫州', '凉州',
        '宛县', '蓟县', '许都', '许昌', '长安', '邺城', '襄阳', '建业', '成都', '京畿']
NICK = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅', '贼寇']
ALL = TROOP + INST + CITY + NICK
PAT = re.compile('|'.join(re.escape(w) for w in sorted(set(ALL), key=len, reverse=True)))
STRIP = re.compile(r"^\s*G\.newGame\(\{ name: '[^']*', cityName: '许都'[^}]*\}\);?\s*$|cityName: '许都'")

out = []
for f in ['smoke-test.js', 'e2e-test.js']:
    s = rd(f)
    lines = s.split('\n')
    out.append('########## %s ##########' % f)
    for i, ln in enumerate(lines, 1):
        if not PAT.search(ln):
            continue
        if STRIP.search(ln) and ln.count(':') <= 2:
            continue  # 纯 cityName 造局行，统一处理，不逐条列
        out.append('L%-6d %s' % (i, ln.rstrip()[:400]))
    # 单字"弓"（不含 弓兵/弓箭/弓手）
    out.append('---- 单字弓（排除弓兵/弓箭/弓手） ----')
    for i, ln in enumerate(lines, 1):
        t = ln.replace('弓兵', '').replace('弓箭', '').replace('弓手', '')
        if '弓' in t:
            out.append('L%-6d %s' % (i, ln.rstrip()[:300]))

# 概念词在产品侧的现行写法
out.append('')
out.append('########## 概念词现行口径（js/ + tests） ##########')
for w in ['拒马', '枪阵', '枪克骑', '随军辎重', '壁垒刀盾', '矛阵', '盾卫挡', '骑兵']:
    for f in ['js/data.js', 'js/tactic.js', 'js/battle.js', 'js/domain.js', 'js/ui.js', 'smoke-test.js', 'e2e-test.js']:
        s = rd(f)
        c = s.count(w)
        if c:
            out.append('%s  %s x%d' % (w, f, c))

io.open(R + '.workbuddy/tmp/scan222_full.txt', 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('lines=%d' % len(out))
