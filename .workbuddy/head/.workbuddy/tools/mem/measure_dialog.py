# -*- coding: utf-8 -*-
"""量"本次对话的记录"有多少与 docs 重复（决定压缩能删多少、以及会不会丢信息）。"""
import io, os, re

LOGS = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
ROOT = r'E:\Deepseekdb'
TARGET = os.path.join(LOGS, '2026-09-14.md')

CORPUS = [os.path.join(ROOT, 'docs', 'v67改动说明.md'),
          os.path.join(ROOT, 'docs', '项目地图.md'),
          os.path.join(ROOT, 'docs', '设计规范.md'),
          os.path.join(ROOT, 'docs', 'AI工作备忘.md'),
          os.path.join(ROOT, 'docs', '_史料', '设计史.md'),
          os.path.join(ROOT, 'docs', '_史料', '历轮改动说明.md'),
          os.path.join(ROOT, 'docs', '_史料', 'v66改动说明.md'),
          os.path.join(ROOT, 'docs', '_史料', '资产清理记录_v67.md')]

cl = set()
for p in CORPUS:
    if not os.path.exists(p):
        print('   ⚠ 缺：%s' % os.path.basename(p)); continue
    for l in io.open(p, encoding='utf-8', errors='ignore').read().split('\n'):
        cl.add(re.sub(r'\s+', '', l))
print('语料：%d 份 / %d 行' % (len(CORPUS), len(cl)))

src = io.open(TARGET, encoding='utf-8', newline='').read()
lines = src.split('\n')
print('\n2026-09-14.md：%d 字符 / %d 行' % (len(src), len(lines)))
# 分节统计
secs = [(i, l) for i, l in enumerate(lines) if l.startswith('#')]
print('标题 %d 个：' % len(secs))
for i, l in secs:
    end = next((j for j, x in secs if j > i), len(lines))
    seg = '\n'.join(lines[i:end])
    print('   %5d 行  %6d 字符  %s' % (i + 1, len(seg), l[:64]))

# 逐节算重叠
print('\n=== 与 docs 逐行重叠（只计"长度≥12 且非标题/非引用/非表格"的行）===')
keep_mark = ('⛔', '⚠', '坑', '根因', '判断', '决定', '为什么', '注意', '教训', '铁律', '待拍板', '口径', '实测', '证据')
for i, l in secs:
    end = next((j for j, x in secs if j > i), len(lines))
    seg_lines = lines[i:end]
    cand = [x for x in seg_lines
            if x.strip() and not x.strip().startswith(('#', '>', '|', '```'))
            and len(re.sub(r'\s+', '', x)) >= 12 and not any(k in x for k in keep_mark)]
    dup = [x for x in cand if re.sub(r'\s+', '', x) in cl]
    print('   %-58s 候选 %3d · 与 docs 重复 %3d' % (l[:56], len(cand), len(dup)))
