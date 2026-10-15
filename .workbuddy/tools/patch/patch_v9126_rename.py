#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v91.26 旧词改名（A+B 组）：城池→城市 等。产品代码 + 测试同映射同改（不碰 docs/需求档案）。保 LF。"""
import io, os, glob

MAP = [
    # 长词优先，防误伤
    ('招贤纳士', '招揽人才'),
    ('将军战录', '战功录'),
    ('托孤之臣', '股肱之臣'),
    ('能臣', '贤才'),
    ('城池', '城市'),
    ('讨伐', '清剿'),
    ('主公', '君主'),
    ('太守', '长官'),
]
FILES = sorted(glob.glob('js/*.js')) + ['index.html', 'smoke-test.js', 'e2e-test.js']

total = {}
for f in FILES:
    with io.open(f, encoding='utf-8', newline='') as fh:
        src = fh.read()
    out = src
    for a, b in MAP:
        if a in out:
            n = out.count(a)
            out = out.replace(a, b)
            total[a] = total.get(a, 0) + n
    if out != src:
        with io.open(f, 'w', encoding='utf-8', newline='') as fh:
            fh.write(out)
for a, b in MAP:
    print('%-12s -> %-12s : %d' % (a, b, total.get(a, 0)))
