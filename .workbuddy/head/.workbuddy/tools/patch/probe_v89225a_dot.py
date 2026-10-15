# -*- coding: utf-8 -*-
# v89.225 探针 A：找"建筑前边的带颜色棋子"的真身
# 扫描城内地块/建筑渲染相关的色标/色点/小旗/圆点元素
import io, re

def rd(p):
    return io.open('E:/Deepseekdb/' + p, encoding='utf-8', newline='').read()

s = rd('js/ui.js')
print('=== ui.js 中 "city" 渲染函数名 ===')
for m in re.finditer(r'ui\.(\w*[Cc]ity\w*|\w*[Cc]ell\w*|\w*[Bb]uild\w*)\s*=\s*function', s):
    print('  ', m.group(1))

print()
print('=== 关键词扫描（色标候选） ===')
for w in ['dot', 'pip', 'chip', 'flag', 'badge', 'color', 'pip-', 'bdot', 'cell-', 'cellCol', 'tint', 'stripe']:
    lines = []
    for i, ln in enumerate(s.split('\n'), 1):
        if w in ln:
            lines.append((i, ln.strip()[:170]))
    if lines:
        print('--- %s (%d 处) ---' % (w, len(lines)))
        for i, ln in lines[:12]:
            print('  L%d %s' % (i, ln))

print()
print('=== DATA.SERIES / SERIES_OF / paint / flag 定义 ===')
d = rd('js/data.js')
for w in ['SERIES', 'paint', 'flag']:
    idxs = [m.start() for m in re.finditer(re.escape(w), d)][:8]
    print('%s: %d 处' % (w, d.count(w)))
