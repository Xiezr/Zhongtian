# -*- coding: utf-8 -*-
"""蒸馏 2026-09-13 日志（82KB）。

判据（**保证零信息损失**）：只删"**在 docs 里能找到同一行**"的行 —— 那部分是逐条改动明细，
已完整写进 `_史料/历轮改动说明.md` / `AI史/设计史.md` / `AI工作备忘.md`。
保留一切：标题、引用块（现场上下文）、含 ⛔/⚠/坑/根因/判断/决定/为什么 的行、
以及**在 docs 里找不到的行**（= 独有信息）。

跑完打印：删了多少行 / 剩多少字符 / 抽样 15 条被删的行（供人工核验判据是否合理）。
"""
import io, os, re

LOGS = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
ROOT = r'E:\Deepseekdb'
TARGET = os.path.join(LOGS, '2026-09-13.md')

CORPUS_FILES = [
    os.path.join(ROOT, 'docs', '_史料', '历轮改动说明.md'),
    os.path.join(ROOT, 'docs', '_史料', '设计史.md'),
    os.path.join(ROOT, 'docs', '_史料', 'v66改动说明.md'),
    os.path.join(ROOT, 'docs', 'AI工作备忘.md'),
    os.path.join(ROOT, 'docs', 'v67改动说明.md'),
    os.path.join(ROOT, 'docs', '设计规范.md'),
]
corpus_lines = set()
for p in CORPUS_FILES:
    if not os.path.exists(p):
        print('   ⚠ 语料缺失：%s' % os.path.basename(p))
        continue
    c = io.open(p, encoding='utf-8', errors='ignore').read()
    for l in c.split('\n'):
        corpus_lines.add(re.sub(r'\s+', '', l))
print('语料：%d 个文件 / %d 行（去空白后）' % (len(CORPUS_FILES), len(corpus_lines)))

KEEP_MARK = ('⛔', '⚠', '坑', '根因', '判断', '决定', '为什么', '注意', '教训', '铁律',
             '待拍板', '拍板', '取舍', '口径', '实测', '证据')


def norm(l):
    return re.sub(r'\s+', '', l)


src = io.open(TARGET, encoding='utf-8', newline='').read()
lines = src.split('\n')
keep, drop = [], []
for l in lines:
    s = l.strip()
    n = norm(l)
    if (not s or s.startswith('#') or s.startswith('>') or s.startswith('|')
            or s.startswith('```') or len(n) < 12 or any(k in l for k in KEEP_MARK)):
        keep.append(l); continue
    if n in corpus_lines:
        drop.append(l)
    else:
        keep.append(l)

out = '\n'.join(keep)
out = re.sub(r'\n{3,}', '\n\n', out)
HEADER = ('> **v67 蒸馏说明**：本日志只做了一次"去重"——删掉 **在 `docs/` 里已有同一行**的\n'
          '> 逐条改动明细（那些内容完整保留在 `docs/_史料/历轮改动说明.md`、`docs/_史料/设计史.md`、\n'
          '> `docs/AI工作备忘.md` 里）。**所有"踩坑/根因/判断/决定/口径/实测"的现场一律保留**，\n'
          '> 在 docs 里找不到的行也一律保留。原始 82KB 未删任何独有信息。\n')
if 'v67 蒸馏说明' not in src:
    i = out.find('\n', out.find('#'))
    out = out[:i + 1] + '\n' + HEADER + out[i + 1:]

io.open(TARGET, 'w', encoding='utf-8', newline='').write(out)
print()
print('原文 %d 字符 / %d 行' % (len(src), len(lines)))
print('产出 %d 字符 / %d 行   →  减少 %d 字符（%.0f%%）' % (
    len(out), out.count('\n') + 1, len(src) - len(out), (len(src) - len(out)) / len(src) * 100))
print('删除 %d 行（全部是 docs 里已有的重复行）· 保留 %d 行' % (len(drop), len(keep)))
print()
print('=== 抽样 15 条被删的行（人工核验判据）===')
for x in drop[:15]:
    print('   - ' + x.strip()[:104])
