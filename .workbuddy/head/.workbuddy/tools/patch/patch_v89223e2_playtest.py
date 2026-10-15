# -*- coding: utf-8 -*-
"""v89.223e2：playtest 显示词与注释同步（义兵→民兵 / 轻骑→摩托游骑 / 铁骑→装甲战车）。
用法: DRY=1 python patch_v89223e2_playtest.py
"""
import io, os, sys

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

DRY = os.environ.get('DRY') == '1'
B = '.workbuddy/tools/playtest/'
FILES = ['play_600x.js', 'play_farm2_600x.js', 'play_gold_600x.js', 'play_strat_600x.js',
         'play_rush_1x.js', 'play_v89118.js']
PAIRS = [('轻骑兵', '摩托游骑'), ('轻骑', '摩托游骑'),
         ('铁骑兵', '装甲战车'), ('铁骑', '装甲战车'),
         ('义兵', '民兵')]
total = 0
for name in FILES:
    f = B + name
    s = rd(f)
    n0 = s
    for old, new in PAIRS:
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            total += c
            print('[ok] %s: %s x%d -> %s' % (name, old, c, new))
    if s != n0 and not DRY:
        wr(f, s)
print(('DRY 预检完成' if DRY else '已落盘') + '（共 %d 处）' % total)
