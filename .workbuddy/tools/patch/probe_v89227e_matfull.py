# -*- coding: utf-8 -*-
"""v89.227 探针 E：DATA.MATERIALS 全量 + MAT_SERIES + use 文案 + 名将套/藏珍阁上下文。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


d = rd('js/data.js')

# ---------- 1) DATA.MATERIALS 定位 ----------
print('========== 1) DATA.MATERIALS 定位 ==========')
for m in re.finditer(r'DATA\.MATERIALS', d):
    i = m.start()
    print('  @%d  上下文: %s' % (i, d[max(0, i - 80):i + 60].replace('\n', ' | ')))

# 找到表体（第一个 'DATA.MATERIALS = {' 后到配平 }）
j = d.find('DATA.MATERIALS = {')
if j < 0:
    j = d.find('DATA.MATERIALS =')
seg = None
if j >= 0:
    depth = 0
    started = False
    end = j
    for i in range(j, min(len(d), j + 80000)):
        ch = d[i]
        if ch == '{':
            depth += 1
            started = True
        elif ch == '}':
            depth -= 1
            if started and depth == 0:
                end = i + 1
                break
    seg = d[j:end]
    print()
    print('表长:', len(seg))
    r('# 全表 dump 到 tmp 文件')
    io.open(BASE + '.workbuddy/tmp/p227e_mats_full.txt', 'w', encoding='utf-8', newline='').write(seg)
    print('已 dump:', '.workbuddy/tmp/p227e_mats_full.txt')

# ---------- 2) MAT_SERIES ----------
print()
print('========== 2) MAT_SERIES ==========')
for m in re.finditer(r'MAT_SERIES', d):
    i = m.start()
    print('  @%d  %s' % (i, d[max(0, i - 100):i + 400].split('\n')[0][:220]))

print()
print('========== 3) 名将套 全部行 ==========')
for f in ['js/data.js', 'js/ui.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if '名将套' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:200]))

print()
print('========== 4) 藏珍阁 上下文（表定义 + 面板标题）==========')
for f in ['js/data.js', 'js/ui.js']:
    t = rd(f)
    lines = t.split('\n')
    for i, ln in enumerate(lines, 1):
        if '藏珍阁' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:200]))
