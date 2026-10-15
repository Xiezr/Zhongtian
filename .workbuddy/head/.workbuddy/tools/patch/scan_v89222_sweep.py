# -*- coding: utf-8 -*-
"""v89.222 · 全面反扫 v2：只做文本解析（不 import 补丁脚本！）"""
import io, re, glob, os

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

src = rd('.workbuddy/tools/patch/patch_v89217a_names.py')
def section(name):
    i = src.index(name + ' = [')
    j = src.index('\n]', i)
    return re.findall(r"\('([^']+)',\s*'([^']+)'\)", src[i:j])

REGION = section('REGION'); CITY = section('CITY'); HERO = section('HERO_FLOAT')
print('映射表：city=%d region=%d hero=%d' % (len(CITY), len(REGION), len(HERO)))

CITY_OLD = [o for o, n in CITY]
REG_OLD = [o for o, n in REGION]
HERO_OLD = [o for o, n in HERO]
# 复合旧名（不在 174 表里的旧城池名，人工补）
EXTRA_OLD = ['许都', '邺城', '许昌', '洛阳', '弘农', '宛县', '蓟县']

out = []
for f in ['smoke-test.js', 'e2e-test.js']:
    s = rd(f)
    lines = s.split('\n')
    hits = []
    for i, ln in enumerate(lines, 1):
        for w in CITY_OLD + REG_OLD + HERO_OLD:
            if w in ln:
                hits.append('L%-6d (%s) %s' % (i, w, ln.strip()[:170]))
    out.append('===== %s：旧城/区/籍贯名 命中 %d 行 =====' % (f, len(hits)))
    out.extend(hits)
    out.append('---- %s 单字候选（枪/骑/虎/弓，排除已列词后） ----' % f)
    EX = ['长枪', '枪兵', '枪阵', '枪克', '枪打', '拒马', '轻骑', '铁骑', '突骑', '骑兵', '骑马', '坐骑', '游骑',
          '刀盾', '盾卫', '盾牌', '虎豹', '虎', '弓兵', '弓箭', '弓手', '弩手', '弓', '矛手', '长矛', '矛', '枪']
    cnt = 0
    for i, ln in enumerate(lines, 1):
        t = ln
        for w in EX:
            t = t.replace(w, '〇')
        if any(ch in t for ch in ['枪', '骑', '虎', '弓']):
            out.append('L%-6d %s' % (i, ln.strip()[:170])); cnt += 1
    out.append('（共 %d 行）' % cnt)

tool_hits = {}
for f in glob.glob(R + '.workbuddy/tools/**/*.js', recursive=True) + glob.glob(R + '.workbuddy/tools/**/*.py', recursive=True):
    try:
        s = io.open(f, encoding='utf-8', newline='').read()
    except Exception:
        continue
    n = 0
    for w in ['长枪', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '青州', '刀盾', '藤甲', '投石', '弓兵', '许都', '邺城', '洛阳']:
        n += s.count(w)
    if n:
        tool_hits[os.path.relpath(f, R).replace('\\', '/')] = n
out.append('===== 工具目录旧词计数 =====')
for k in sorted(tool_hits, key=lambda x: -tool_hits[x])[:50]:
    out.append('%s  %d' % (k, tool_hits[k]))

io.open(R + '.workbuddy/tmp/scan222_sweep.txt', 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('sweep lines: %d, tool files: %d' % (len(out), len(tool_hits)))
