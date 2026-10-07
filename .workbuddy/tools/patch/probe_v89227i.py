# -*- coding: utf-8 -*-
"""v89.227 探针 I：藏珍阁导航标签 + 名将套测试占用 + 注释块原文。"""
import io

BASE = 'E:/Deepseekdb/'

def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()

# 1) 藏珍阁导航标签
print('========== 1) 导航标签（collect / 藏珍 / 宝阁）==========')
u = rd('js/ui.js')
for pat in ['collect', '藏珍', '宝阁', '陈列']:
    print('--- ui.js %s ---' % pat)
    for i, ln in enumerate(u.split('\n'), 1):
        if pat in ln and ('data-view' in ln or 'nav' in ln.lower() or 'tab' in ln.lower() or '菜单' in ln or 'gold-heading' in ln):
            print('  L%-6d %s' % (i, ln.strip()[:170]))
h = rd('index.html')
for i, ln in enumerate(h.split('\n'), 1):
    if 'data-view="collect"' in ln or ('collect' in ln and ('nav' in ln or '按钮' in ln or 'data-view' in ln)):
        print('  index.html L%-6d %s' % (i, ln.strip()[:170]))

# 2) 名将套/神武套 在测试与工具中的占用
print()
print('========== 2) 名将套/神武套 测试占用 ==========')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if '名将套' in ln or '神武套' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:170]))
print('(空=无)')

# 3) 注释块原文（data.js 1290-1348 / 2710-2720 / 4335-4345 / ui.js 10685-10695）
print()
print('========== 3) 注释块原文 ==========')
d = rd('js/data.js')
dl = d.split('\n')
for a, b, tag in [(1289, 1348, 'data 1290-1348'), (2709, 2720, 'data 2710-2720'), (4334, 4345, 'data 4335-4345'), (5328, 5336, 'data 5329-5336')]:
    print('--- %s ---' % tag)
    for i in range(a, b):
        print('L%-6d|%s' % (i + 1, dl[i]))
    print()
ul = u.split('\n')
print('--- ui 10685-10695 ---')
for i in range(10684, 10695):
    print('L%-6d|%s' % (i + 1, ul[i]))
