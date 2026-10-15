#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v91.29 建筑改名（显示名）：补给站→传送站 · 车库→载具研究所 · 货仓→战储仓 ·
   酒馆→征召大厅 · 招募站→英雄枢纽 · 研习所→科研中心 · 训练营→军营。id 不动，零存档影响。保 LF。"""
import io, glob

MAP = [
    ('招募站', '英雄枢纽'),   # 3 字，先于「招募」
    ('补给站', '传送站'),
    ('训练营', '军营'),
    ('研习所', '科研中心'),
    ('征召大厅', '征召大厅'),   # 占位（防空）
    ('货仓', '战储仓'),
    ('酒馆', '征召大厅'),
    ('车库', '载具研究所'),
]
FILES = sorted(glob.glob('js/*.js')) + ['index.html', 'smoke-test.js', 'e2e-test.js']
tot = {}
for f in FILES:
    with io.open(f, encoding='utf-8', newline='') as fh:
        src = fh.read()
    out = src
    for a, b in MAP:
        if a == b: continue
        if a in out:
            n = out.count(a); tot[a] = tot.get(a, 0) + n; out = out.replace(a, b)
    if out != src:
        with io.open(f, 'w', encoding='utf-8', newline='') as fh:
            fh.write(out)
for a, b in MAP:
    if a != b: print('%-8s -> %-8s : %d' % (a, b, tot.get(a, 0)))
