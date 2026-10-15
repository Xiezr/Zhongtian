# -*- coding: utf-8 -*-
"""v89.227 探针 F：DATA.SETS 全量 + 名将套所在段 + 材料 series.name 消费面。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


d = rd('js/data.js')

# ---------- 1) DATA.SETS 全量 ----------
j = d.find('DATA.SETS')
print('========== 1) DATA.SETS 定位 ==========')
for m in re.finditer(r'DATA\.SETS', d):
    i = m.start()
    print('  @%d  %s' % (i, d[max(0, i - 60):i + 80].split('\n')[0][:160]))

k = d.find('DATA.SETS = {')
if k >= 0:
    depth = 0
    started = False
    end = k
    for i in range(k, min(len(d), k + 40000)):
        ch = d[i]
        if ch == '{':
            depth += 1
            started = True
        elif ch == '}':
            depth -= 1
            if started and depth == 0:
                end = i + 1
                break
    seg = d[k:end]
    print()
    print('SETS 表长:', len(seg))
    # 只打 id/name/tier 行
    for i, ln in enumerate(seg.split('\n'), 1):
        if re.search(r"id: '\w+', name:", ln) or 'SETS = {' in ln:
            print('  %s' % ln.strip()[:180])

print()
print('========== 2) 所有套装名（去重）==========')
names = set(re.findall(r"name: '([^']*套[^']*)'", d))
for n in sorted(names):
    print('  ', n)

print()
print('========== 3) 名将套/神武套 在 data.js 的相关段落 ==========')
lines = d.split('\n')
for i, ln in enumerate(lines, 1):
    if '名将' in ln or '神武' in ln:
        print('  L%-6d %s' % (i, ln.strip()[:190]))

print()
print('========== 4) MAT_SERIES.name / use 消费面 ==========')
for f in ['js/data.js', 'js/ui.js', 'js/domain.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if 'MAT_SERIES' in ln and 'data.js' != f:
            print('  %s:%d  %s' % (f, i, ln.strip()[:160]))
        if '.use' in ln and ('MAT_SERIES' in ln or 'matSeries' in ln):
            print('  %s:%d  %s' % (f, i, ln.strip()[:160]))
