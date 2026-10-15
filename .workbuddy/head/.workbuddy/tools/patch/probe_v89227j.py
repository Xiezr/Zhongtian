# -*- coding: utf-8 -*-
"""v89.227 探针 J：旧 key 残留面 + 八族/七族字样 + §225 段原文 + smoke 材料名行。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


print('========== 1) 旧 key 引用面（ser-/SERIES_OF.xxx）==========')
for f in ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/map.js', 'smoke-test.js', 'e2e-test.js', 'index.html']:
    t = rd(f)
    for k in ['store', 'edu', 'biz', 'road', 'recruit']:
        for pat in ["ser-%s" % k, "SERIES_OF.%s" % k, "SERIES.%s" % k]:
            if pat in t:
                print('  %s : %s' % (f, pat))

print()
print('========== 2) 八族/七族/族数 字样 ==========')
for f in ['js/data.js', 'js/ui.js', 'smoke-test.js', 'e2e-test.js', 'index.html']:
    t = rd(f)
    for pat in ['八族', '七族', '8 族', '8族']:
        c = t.count(pat)
        if c:
            print('  %s: %s x%d' % (f, pat, c))

print()
print('========== 3) smoke 材料名行 ==========')
t = rd('smoke-test.js')
for i, ln in enumerate(t.split('\n'), 1):
    if any(w in ln for w in ['青玉', '织锦', '泰坦筋', '河石', '羊脂玉', '昆山玉', '云缎', '蛟', '犀']):
        print('  L%-6d %s' % (i, ln.strip()[:180]))

print()
print('========== 4) §225 段完整原文（34985-35062）==========')
lines = t.split('\n')
for i in range(34984, 35062):
    print('L%-6d|%s' % (i + 1, lines[i]))
