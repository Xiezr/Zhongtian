# -*- coding: utf-8 -*-
"""v89.222 · 扫描器：用例文件（smoke/e2e）里三族旧词残留全量枚举
三族 = 兵种旧缩写(T) / 机构词(I) / 旧城名(C) / 旧绰号(N)
输出：逐条命中（文件:行 + 类别 + 上下文），供人工分类后再写替换补丁。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

FILES = ['smoke-test.js', 'e2e-test.js']

TROOP = ['长枪', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '大象', '青州',
         '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '枪兵', '矛兵', '弩兵', '骑兵', '刀牌']
INST = ['州城', '州治', '郡城', '郡治', '县城', '都城', '帝都', '州郡', '州府', '太守', '郡守', '郡县', '州界', '郡界', '州牧']
CITY = ['洛阳', '司隶', '幽州', '徐州', '荆州', '兖州', '并州', '益州', '冀州', '交州', '扬州', '豫州', '凉州',
        '宛县', '蓟县', '许都', '许昌', '长安', '邺城', '襄阳', '建业', '成都', '京畿']
NICK = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅', '贼寇']

PAIRS = [(w, 'T') for w in TROOP] + [(w, 'I') for w in INST] + [(w, 'C') for w in CITY] + [(w, 'N') for w in NICK]
CATS = {}
for w, c in PAIRS:
    CATS.setdefault(w, set()).add(c)
WORDS = sorted(CATS.keys(), key=len, reverse=True)
PAT = re.compile('|'.join(re.escape(w) for w in WORDS))

out = []
total = {}
for f in FILES:
    s = rd(f)
    lines = s.split('\n')
    for i, ln in enumerate(lines):
        for m in PAT.finditer(ln):
            w = m.group(0)
            cats = ''.join(sorted(CATS[w]))
            a, b = max(0, m.start() - 44), min(len(ln), m.end() + 44)
            out.append('[%s:%d] (%s:%s)  …%s…' % (f, i + 1, cats, w, ln[a:b]))
            total[f] = total.get(f, 0) + 1
    # 附：该文件里读"需求档案"的行（档案原文校验面）
    for i, ln in enumerate(lines):
        if '需求档案' in ln:
            out.append('[%s:%d] (ARCHIVE)  %s' % (f, i + 1, ln.strip()[:160]))

io.open(R + '.workbuddy/tmp/scan222_hits.txt', 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('hits total = %d  (%s)' % (len(out), ', '.join('%s=%d' % (k, v) for k, v in total.items())))
