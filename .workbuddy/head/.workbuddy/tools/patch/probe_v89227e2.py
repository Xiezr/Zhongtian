# -*- coding: utf-8 -*-
"""v89.227 探针 E2：DATA.MATERIALS 全量 + MAT_SERIES（修正数组配平）。"""
import io, re

BASE = 'E:/Deepseekdb/'
d = io.open(BASE + 'js/data.js', encoding='utf-8', newline='').read()

# ---------- 1) 材料表：从 'DATA.MATERIALS = [' 起做 [] 配平 ----------
j = d.find('DATA.MATERIALS = [')
assert j >= 0, 'find MATERIALS'
depth = 0
end = j
for i in range(j, min(len(d), j + 100000)):
    ch = d[i]
    if ch == '[':
        depth += 1
    elif ch == ']':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
seg = d[j:end]
print('材料表长度:', len(seg))
io.open(BASE + '.workbuddy/tmp/p227e_mats_full.txt', 'w', encoding='utf-8', newline='').write(seg)
print('已 dump → .workbuddy/tmp/p227e_mats_full.txt')
print()

# ---------- 2) 六系列 ----------
k = d.find('DATA.MAT_SERIES = [')
if k >= 0:
    depth = 0
    end2 = k
    for i in range(k, min(len(d), k + 20000)):
        ch = d[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end2 = i + 1
                break
    print('========== MAT_SERIES ==========')
    print(d[k:end2])
print()

# ---------- 3) 名将套 / 藏珍阁 ----------
print('========== 名将套 行 ==========')
for f in ['js/data.js', 'js/ui.js']:
    t = io.open(BASE + f, encoding='utf-8', newline='').read()
    for i, ln in enumerate(t.split('\n'), 1):
        if '名将套' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:220]))
print()
print('========== 藏珍阁 行 ==========')
for f in ['js/data.js', 'js/ui.js']:
    t = io.open(BASE + f, encoding='utf-8', newline='').read()
    for i, ln in enumerate(t.split('\n'), 1):
        if '藏珍阁' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:200]))
