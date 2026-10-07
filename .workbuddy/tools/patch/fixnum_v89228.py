# -*- coding: utf-8 -*-
"""v89.228 口径修正：docs 同步量 1260 → 1380 处（实测 711+270+83+141+23+19+17+7+18+2+9+0=1300 + C2 77 = 1377）。
用法：python fixnum_v89228.py
"""
import io, os

BASE = 'E:/Deepseekdb/'
FILES = ['需求档案.md', 'docs/废土术语映射表.md', 'docs/v89228-名录换代与旧币幸存者.md', 'docs/数据表索引.md']
OLDS = ['约 1260 处', '约 1260']
total = 0
for f in FILES:
    p = BASE + f
    s = io.open(p, encoding='utf-8', newline='').read()
    o = s
    s = s.replace('约 1260 处', '约 1380 处').replace('12 份约 1260', '12 份约 1380')
    if s != o:
        io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
        os.replace(p + '.tmp', p)
        n = o.count('1260')
        total += n
        print('%s：%d 处修正' % (f, n))
print('完成（共 %d 处）' % total)
