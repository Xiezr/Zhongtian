# -*- coding: utf-8 -*-
"""v89.223 E2 预扫：playtest 目录旧词明细（为显示词同步定范围）。"""
import io, glob

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

WORDS = ['长枪', '枪兵', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '青州',
         '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '义兵', '民夫', '冲车', '床弩',
         '洛阳', '许都', '豫州']
for f in sorted(glob.glob('.workbuddy/tools/playtest/*.js')):
    t = rd(f)
    hits = []
    for i, ln in enumerate(t.split('\n'), 1):
        for w in WORDS:
            if w in ln:
                hits.append((i, w, ln.strip()[:130]))
                break
    if hits:
        print('---- %s (%d 行) ----' % (f, len(hits)))
        for i, w, ln in hits:
            print('  %d [%s] %s' % (i, w, ln))
