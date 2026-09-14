# -*- coding: utf-8 -*-
"""MEMORY 还差 37 字符：三处收紧（不删任何规则）。"""
import io, os

MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\MEMORY.md'
m = io.open(MEM, encoding='utf-8', newline='').read()
n0 = len(m)


def rep(old, new, label):
    global m
    c = m.count(old)
    assert c == 1, '[%s] 锚点 %d 次' % (label, c)
    m = m.replace(old, new, 1)
    print('   ✓ %s' % label)


rep('  ③ **禁恒真断言**；行为断言必须**能翻转**（破坏一处实现确认它会红 —— 红不了就是装饰）；',
    '  ③ **禁恒真断言**；行为断言必须**能翻转**（红不了就是装饰）；', '铁律③')
rep('- **全站不用下拉框** → `ui.chips/chipSet/genChips`，**点选后不重绘**（只切 class + 写隐藏域）；',
    '- **全站不用下拉框** → `ui.chips/chipSet/genChips`，**点选后不重绘**；', '无下拉框')
rep('- **Python 写项目文件一律 `newline=\'\'`**（默认把 `\\n` 转 `\\r\\n`，毁掉依赖 `\\n` 的跨行正则）',
    '- **Python 写项目文件一律 `newline=\'\'`**（默认把 `\\n` 转 `\\r\\n`，毁掉跨行正则）', 'newline')

io.open(MEM, 'w', encoding='utf-8', newline='').write(m)
print('MEMORY.md：%d → %d 字符（上限 9600，余量 %d）' % (n0, len(m), 9600 - len(m)))
assert len(m) < 9600, '仍超：%d' % len(m)
print('✅ 回到上限内')
