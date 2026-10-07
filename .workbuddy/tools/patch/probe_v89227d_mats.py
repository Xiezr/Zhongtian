# -*- coding: utf-8 -*-
"""v89.227 探针 D：批次二范围取证 —— 材料 24 名 + 系列 + use 文案 + 专名。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


d = rd('js/data.js')

# ---------- 1) 材料表定位 ----------
print('========== 1) 材料表定位 ==========')
for pat in ['DATA.MATS', 'DATA.MATERIALS', 'MATS =', 'matSeries', 'MAT_SERIES']:
    print('  %s x%d' % (pat, d.count(pat)))

j = d.find('DATA.MATS')
if j >= 0:
    # 找表起止
    k = j
    depth = 0
    started = False
    end = k
    for i in range(j, min(len(d), j + 60000)):
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
    print('  表长:', len(seg))
    print()
    print(seg[:3000])
print()

# ---------- 2) 专名搜索 ----------
print('========== 2) 专名现状（百炼 / 藏珍阁 / 名将套）==========')
for w in ['百炼', '藏珍阁', '名将套', '遗物', '收藏']:
    for f in ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/systems.js', 'js/state.js', 'index.html']:
        try:
            t = rd(f)
        except Exception:
            continue
        c = t.count(w)
        if c:
            print('  %-8s %-16s x%d' % (w, f, c))
    print()

print('========== 3) 百炼/藏珍阁 具体行 ==========')
for f in ['js/data.js', 'js/ui.js', 'js/systems.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if '百炼' in ln or '藏珍阁' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:170]))
