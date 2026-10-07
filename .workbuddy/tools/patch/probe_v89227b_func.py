# -*- coding: utf-8 -*-
"""v89.227 探针 B：BLDG_FUNC（建筑功能按钮表）+ SERIES 消费行精确原文。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


d = rd('js/data.js')
u = rd('js/ui.js')
m = rd('js/main.js')

# ---------- 1) BLDG_FUNC 定位与全量 ----------
print('========== BLDG_FUNC ==========')
for f, t in [('data.js', d), ('ui.js', u), ('main.js', m)]:
    for pat in ['BLDG_FUNC', 'BLD_FUNC', 'bldFunc', 'BUILD_FUNC']:
        c = t.count(pat)
        if c:
            print('  %s: %s x%d' % (f, pat, c))
print()
j = u.find('BLDG_FUNC')
if j < 0:
    j = d.find('BLDG_FUNC')
if j < 0:
    j = m.find('BLDG_FUNC')
if j >= 0:
    seg = u[j:j + 3000] if u.find('BLDG_FUNC') >= 0 else (d[j:j + 3000] if d.find('BLDG_FUNC') >= 0 else m[j:j + 3000])
    # 找到表定义并 dump 到下一个大括号结束
    print(seg[:2800])
else:
    print('未找到 BLDG_FUNC —— 换搜按钮标签')
    for pat in ["'open-", '"open-', "data-action=\"open-"]:
        hits = []
        for i, ln in enumerate(u.split('\n'), 1):
            if pat in ln:
                hits.append((i, ln.strip()[:160]))
        if hits:
            print('--- ui.js 含 %s x%d（前 24）---' % (pat, len(hits)))
            for i, ln in hits[:24]:
                print('  L%d  %s' % (i, ln))

# ---------- 2) SERIES 精确引用行 ----------
print()
print('========== SERIES / ser- 精确引用 ==========')
for f, t in [('js/data.js', d), ('js/ui.js', u), ('js/main.js', m)]:
    for i, ln in enumerate(t.split('\n'), 1):
        if 'SERIES_OF' in ln or 'DATA.SERIES' in ln or "'ser-" in ln or '"ser-' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:170]))
