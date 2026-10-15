# -*- coding: utf-8 -*-
"""项目全景盘点：产物清单 + 规则分布 + 引用关系（为"是否完整/精简/集中"提供证据）。"""
import io, os, re, glob, json, time

ROOT = r'E:\Deepseekdb'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
SKILLS = r'C:\Users\18811\.workbuddy\skills'


def human(n):
    return '%.1fMB' % (n / 1048576) if n >= 1048576 else ('%.0fKB' % (n / 1024) if n >= 1024 else '%dB' % n)


def tree(p, label, depth=1, skip=('__pycache__', )):
    print('=' * 8, label, '=' * 8)
    if os.path.isfile(p):
        print('   %-40s %8s' % (os.path.basename(p), human(os.path.getsize(p))))
        return
    ents = sorted(os.listdir(p))
    tf = tn = 0
    for n in ents:
        fp = os.path.join(p, n)
        if os.path.isdir(fp):
            cnt = sum(len(fs) for _, _, fs in os.walk(fp))
            sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(fp) for f in fs)
            tf += cnt; tn += sz
            print('   [DIR ] %-34s %8s %4d 个' % (n, human(sz), cnt))
        else:
            tf += 1; tn += os.path.getsize(fp)
            print('   [FILE] %-34s %8s' % (n, human(os.path.getsize(fp))))
    print('   合计 %d 个 / %s' % (tf, human(tn)))


tree(ROOT, '① 项目根')
tree(os.path.join(ROOT, 'js'), '② js/')
tree(os.path.join(ROOT, 'docs'), '③ docs/')
tree(os.path.join(ROOT, '.workbuddy', 'tools'), '④ tools/')
print()

# ---------- 规则分布 ----------
print('=' * 8, '⑤ 规则/规范都在哪（按体量排序）', '=' * 8)
RULE_FILES = [
    (os.path.join(ROOT, 'DESIGN.md'), 'DESIGN.md'),
    (os.path.join(ROOT, '需求档案.md'), '需求档案.md'),
    (os.path.join(MEM, 'MEMORY.md'), 'MEMORY.md（工作记忆·常驻）'),
    (os.path.join(ROOT, 'docs', 'AI工作备忘.md'), 'docs/AI工作备忘.md'),
]
RULE_FILES += [(p, 'docs/' + os.path.basename(p)) for p in glob.glob(os.path.join(ROOT, 'docs', '*.md'))]
RULE_FILES += [(p, 'skill/' + os.path.basename(os.path.dirname(p))) for p in glob.glob(os.path.join(SKILLS, '*', 'SKILL.md'))]
RULE_FILES += [(p, 'memory/' + os.path.basename(p)) for p in sorted(glob.glob(os.path.join(MEM, '*.md')))]
seen = set()
rows = []
for p, label in RULE_FILES:
    if p in seen or not os.path.exists(p):
        continue
    seen.add(p)
    c = io.open(p, encoding='utf-8', errors='ignore').read()
    rows.append((len(c), label, c.count('\n') + 1,
                 len(re.findall(r'^\s*(?:[-*·]|\d+\.)\s', c, re.M))))
for n, label, lines, bullets in sorted(rows, reverse=True):
    print('   %-38s %7d 字符 %5d 行  %4d 条' % (label, n, lines, bullets))
print()

# ---------- 引用关系：谁被文档点名 ----------
print('=' * 8, '⑥ 引用扫描（语料 = docs + 根 md + 记忆 + 技能 + 源码）', '=' * 8)
corpus = ''
for pat in [os.path.join(ROOT, 'docs', '*'), os.path.join(ROOT, '*.md'),
            os.path.join(MEM, '*.md'), os.path.join(ROOT, 'js', '*.js'),
            os.path.join(ROOT, 'smoke-test.js'), os.path.join(ROOT, 'e2e-test.js'),
            os.path.join(ROOT, 'audit.js')]:
    for p in glob.glob(pat):
        if os.path.isfile(p):
            corpus += io.open(p, encoding='utf-8', errors='ignore').read()
for p in glob.glob(os.path.join(SKILLS, '**', '*.md'), recursive=True):
    corpus += io.open(p, encoding='utf-8', errors='ignore').read()
print('   语料 %d 字符' % len(corpus))

tools = sorted(os.listdir(os.path.join(ROOT, '.workbuddy', 'tools')))
dead_tools = [t for t in tools if t not in corpus]
print('   tools %d 个 · **文档/源码里从未点名 %d 个**：' % (len(tools), len(dead_tools)))
for t in dead_tools:
    print('      %-32s %8s' % (t, human(os.path.getsize(os.path.join(ROOT, '.workbuddy', 'tools', t)))))
print()
docs = sorted(os.listdir(os.path.join(ROOT, 'docs')))
dead_docs = [d for d in docs if d not in corpus]
print('   docs %d 份 · **从未被点名 %d 份**：%s' % (len(docs), len(dead_docs), '、'.join(dead_docs) or '无'))
print()
shots = sorted(os.listdir(os.path.join(ROOT, '.workbuddy', 'shots')))
dead_shots = [s for s in shots if s not in corpus]
print('   shots %d 张 · 未被点名 %d 张：%s' % (len(shots), len(dead_shots), '、'.join(dead_shots) or '无'))
print()

# ---------- 数字漂移检查（同一事实多处维护的报警） ----------
print('=' * 8, '⑦ 同一事实多处维护检查（数字漂移）', '=' * 8)
pats = {'smoke 通过数': r'smoke[^0-9]{0,12}(\d{4})',
        'e2e 通过数': r'e2e[^0-9]{0,14}(\d{3})',
        'tools 个数': r'tools/`?（?(\d+) ?个',
        '注册表项数': r'注册表 ?(\d+)'}
for k, pat in pats.items():
    hits = {}
    for p in glob.glob(os.path.join(ROOT, 'docs', '*.md')) + glob.glob(os.path.join(ROOT, '*.md')) + glob.glob(os.path.join(MEM, '*.md')):
        c = io.open(p, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(pat, c):
            hits.setdefault(m.group(1), []).append(os.path.basename(p))
    print('   %-12s → %s' % (k, '；'.join('%s×%d(%s)' % (v, len(fs), ','.join(sorted(set(fs))[:3])) for v, fs in sorted(hits.items())) or '未命中'))
