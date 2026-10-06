# -*- coding: utf-8 -*-
"""v89.222 · 兵牌简称 troopAbOf 现状 + 相关区段"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

for f in ['js/data.js', 'js/ui.js', 'js/tactic.js', 'js/battle.js', 'js/domain.js']:
    s = rd(f)
    if 'troopAbOf' in s or ' ab:' in s or "'ab'" in s:
        lines = s.split('\n')
        for i, ln in enumerate(lines, 1):
            if 'troopAbOf' in ln or 'ab:' in ln:
                print('%s L%d  %s' % (f, i, ln.strip()[:200]))

print()
print('===== smoke L730-745 =====')
lines = rd('smoke-test.js').split('\n')
for i in range(730, 746):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== smoke L26880-26900 =====')
for i in range(26880, 26901):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== smoke L23385-23398 =====')
for i in range(23385, 23399):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== smoke L27084-27092 =====')
for i in range(27084, 27093):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
