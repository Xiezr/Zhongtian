# -*- coding: utf-8 -*-
# v89.225 探针 G：建筑表全量 dump（多行条目）+ 酒馆/招募站/训练营/练兵场 定位
import io, re

def rd(p):
    return io.open('E:/Deepseekdb/' + p, encoding='utf-8', newline='').read()

d = rd('js/data.js')
i = d.find('DATA.BUILDINGS = {')
if i < 0:
    print('DATA.BUILDINGS not found, try other form')
    for m in re.finditer(r'DATA\.BUILDINGS\w*\s*=', d):
        print(m.group(0), m.start())
else:
    j = d.find('\n  };', i)
    seg = d[i:j]
    # 完整条目：id: { ... }（多行）—— 用块的起止扫描
    # 逐个建筑：找 "    <id>: {" 到下一个 "    <id>: {" 或结尾
    entries = []
    pos = 0
    pat = re.compile(r'\n    (\w+): \{')
    ms = list(pat.finditer(seg))
    for k, m in enumerate(ms):
        bid = m.group(1)
        end = ms[k+1].start() if k+1 < len(ms) else len(seg)
        blob = seg[m.start():end]
        name_m = re.search(r"name:\s*'([^']+)'", blob)
        ser_m = re.search(r"series:\s*'(\w+)'", blob)
        entries.append((bid, name_m.group(1) if name_m else '?', ser_m.group(1) if ser_m else '-'))
    print('=== 建筑全表（%d 条）=== ' % len(entries))
    for bid, nm, ser in entries:
        print('  %-18s %-14s %s' % (bid, ser, nm))
    print()
    print('=== 点名的四个 ===')
    for kw in ['酒馆', '招募', '训练', '练兵', '招贤']:
        for bid, nm, ser in entries:
            if kw in nm:
                print('  %s → %s (%s)' % (kw, nm, ser))
