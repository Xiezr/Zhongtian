# -*- coding: utf-8 -*-
"""v89.227 探针 A：城内族色精简 —— 分组依据取证。
1) 16 建筑清单：id / 现名 / series / 有无专属操作面板（按钮表）
2) 建筑按钮表（BLD_*）全量 dump —— "无特定菜单操作"的判据来源
3) SERIES / SERIES_OF 的消费面（确认合并 key 的涟漪范围）
"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


d = rd('js/data.js')

# ---------- 1) 建筑清单 ----------
print('========== 1) 建筑清单（16）==========')
i = d.find('DATA.BUILDINGS = {')
blk = d[i:d.find('\n  };', i)]
rows = []
for m in re.finditer(r"id: '([a-z]+)', series: '([a-z]+)', name: '([^']+)'", blk):
    rows.append((m.group(1), m.group(2), m.group(3)))
for bid, ser, nm in rows:
    print('  %-16s %-8s %s' % (bid, ser, nm))
print()
print('BUILDINGS 内总数:', len(rows))

# ---------- 2) 建筑按钮/动作表 ----------
print()
print('========== 2) 按钮/动作表定位 ==========')
for pat in ['BLD_BTN', 'bldBtn', 'bldActions', 'BLD_ACT', 'bldMenu', 'bldPanel', "data-bld"]:
    hits = [m.start() for m in re.finditer(pat, d)]
    if hits:
        print('  data.js 命中 %-12s x%d' % (pat, len(hits)))

u = rd('js/ui.js')
for pat in ['BLD_BTN', 'bldBtn', 'openBldg', 'bldActions', 'buildPanel', 'renderBld', 'openBuilding']:
    hits = [m.start() for m in re.finditer(pat, u)]
    if hits:
        print('  ui.js 命中 %-12s x%d' % (pat, len(hits)))

# ---------- 3) 建筑面板按钮表 dump（尝试常见命名）----------
print()
print('========== 3) 按钮表原文 ==========')
for nm in ['BLD_BTN', 'BLD_ACTION', 'BLD_ACTS', 'bldActs', 'bldBtns']:
    j = u.find(nm + ' = {')
    if j < 0:
        j = u.find(nm + ' = [')
    if j >= 0:
        seg = u[j:j + 2500]
        print('--- ui.js:', nm, '---')
        print(seg[:2400])
        break
else:
    # 尝试从建筑面板渲染函数里找按钮
    for pat in ['建筑面板', 'bld-panel', 'build-panel', 'bldPanelHTML', 'bldgPanel']:
        j = u.find(pat)
        if j >= 0:
            print('--- 命中 %s @%d ---' % (pat, j))
            print(u[max(0, j - 600):j + 1200])
            break

# ---------- 4) SERIES 消费面 ----------
print()
print('========== 4) SERIES / SERIES_OF 消费面 ==========')
for f in ['js/data.js', 'js/ui.js', 'js/map.js', 'js/domain.js', 'js/state.js', 'js/main.js', 'smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    for pat in ['SERIES_OF', 'DATA.SERIES[', 'ser-', 'SERIES ']:
        cnt = t.count(pat)
        if cnt:
            print('  %-16s %-14s x%d' % (f, pat, cnt))
print()
print('具体引用行（SERIES_OF / DATA.SERIES）：')
for f in ['js/data.js', 'js/ui.js', 'js/map.js', 'js/domain.js', 'js/state.js', 'js/main.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if 'SERIES_OF' in ln or 'DATA.SERIES' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:150]))
