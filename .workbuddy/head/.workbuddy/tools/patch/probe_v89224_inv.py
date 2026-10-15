# -*- coding: utf-8 -*-
"""probe_v89224_inv.py — v89.224 术语/系统全量盘点（1-6 号任务取证）"""
import io, re, json, collections

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

OUT = []
def p(*a):
    OUT.append(' '.join(str(x) for x in a))

# ---------- 1. 页面页签/目录栏 ----------
p('=' * 30, '1. index.html 页签/导航', '=' * 30)
s = rd('index.html')
for i, ln in enumerate(s.split('\n'), 1):
    if re.search(r'data-view=|nav-tab|\.tab\b', ln) and re.search(r'>[^<>]{1,20}<', ln):
        m = re.findall(r'data-view="([a-z_]+)"[^>]*>\s*([^<]{1,30})<', ln)
        if m:
            p('L%d' % i, m)

# ---------- 2. ui.js 里各 view 标题 ----------
p()
p('=' * 30, '2. ui.js 视图标题（gold-heading/大写标题）', '=' * 30)
s = rd('js/ui.js')
titles = re.findall(r"'<div class=\"gold-heading\">([^<]{2,30})", s)
p('gold-heading 样本:', dict(collections.Counter(titles[:60])))

# ---------- 3. 装备系统：槽位/品质/套装 ----------
p()
p('=' * 30, '3. 装备槽位与品质', '=' * 30)
s = rd('js/data.js')
i = s.find('SLOT_DEF')
if i < 0:
    i = s.find('slot:')
# 找槽位名表
m = re.search(r'(EQUIP_SLOTS|SLOTS|SLOT_LIST)\s*=\s*\[(.*?)\];', s, re.S)
if m:
    p('槽位表', m.group(1), ':', m.group(2)[:800])
for kw in ['slotName', 'SLOT_NAME', 'slotOfName']:
    i = s.find(kw)
    if i > 0:
        p(kw, '→', s[i:i+400].replace('\n', ' ')[:400])

# ---------- 4. 六维/属性 ----------
p()
p('=' * 30, '4. 六维/将领属性', '=' * 30)
for kw in ['STAT_NAMES', 'ATTR_NAMES', '维度', '六维', '武力']:
    for i, ln in enumerate(s.split('\n'), 1):
        if kw in ln:
            p('data.js L%d: %s' % (i, ln.strip()[:200]))
            if kw in ('STAT_NAMES', 'ATTR_NAMES'):
                p('   →', s[s.find(kw):s.find(kw) + 500].replace('\n', ' ')[:500])
            break
s2 = rd('js/ui.js')
for i, ln in enumerate(s2.split('\n'), 1):
    if '六维' in ln:
        p('ui.js L%d: %s' % (i, ln.strip()[:220]))
        if i > 0:
            break

# ---------- 5. 资源表 ----------
p()
p('=' * 30, '5. 资源表（粮/木/石/铁/金/人口）', '=' * 30)
for kw in ['RES_NAMES', 'RES_NAME', 'resName', '粮草', '木材']:
    i = s.find(kw)
    if i >= 0:
        p(kw, '→', s[i:i + 300].replace('\n', ' ')[:300])

# ---------- 6. FARM 表 ----------
p()
p('=' * 30, '6. 基因实验室 FARM 表', '=' * 30)
i = s.find('DATA.FARM')
if i >= 0:
    seg = s[i:i + 2600]
    p(seg)
OUT.append('')
io.open('.workbuddy/tmp/p224_inv1.txt', 'w', encoding='utf-8').write('\n'.join(OUT))
print('written p224_inv1.txt, %d lines' % len(OUT))
