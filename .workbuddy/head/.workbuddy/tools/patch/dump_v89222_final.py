# -*- coding: utf-8 -*-
"""v89.222 · 收尾取证：档案原文 / 灰岗用法 / 杂项上下文"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

arc = rd('需求档案.md')
print('===== 档案原文六条（读档案断言要求的串） =====')
for w in ['象兵不设置克制', '步兵1分钟以内，骑兵5分钟以内', '青州=长枪，刀盾=藤甲',
          '766弓箭手', '距离难道不是弓兵的生命线吗', '虎豹稍微加强',
          '弓箭兵不提速']:
    print('%s -> %s' % (w, 'IN' if w in arc else '**MISSING**'))

print()
print('===== 灰岗 用法 =====')
for f in ['js/data.js', 'js/domain.js']:
    lines = rd(f).split('\n')
    for i, ln in enumerate(lines, 1):
        if '灰岗' in ln:
            print('%s L%d  %s' % (f, i, ln.strip()[:200]))
print('--- smoke 中 籍贯/hometown ---')
for i, ln in enumerate(rd('smoke-test.js').split('\n'), 1):
    if '籍贯' in ln or 'hometown' in ln:
        print('smoke L%d  %s' % (i, ln.strip()[:180]))

print()
print('===== COUNTER 墓碑（data.js） =====')
for i, ln in enumerate(rd('js/data.js').split('\n'), 1):
    if 'COUNTER' in ln and ('墓碑' in ln or '退役' in ln or '拒马' in ln or '×' in ln):
        print('L%d  %s' % (i, ln.strip()[:220]))

print()
print('===== L30230-30245 =====')
lines = rd('smoke-test.js').split('\n')
for i in range(30230, 30246):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== L30110-30126 =====')
for i in range(30110, 30127):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== L29608-29626 =====')
for i in range(29608, 29627):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
print()
print('===== L9270-9280 =====')
for i in range(9270, 9281):
    print('L%-6d %s' % (i, lines[i-1].rstrip()[:200]))
