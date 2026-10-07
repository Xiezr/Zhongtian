# -*- coding: utf-8 -*-
"""v89.236 清理轮：全量引用面扫描（只读）
目的：找出所有 docs/*.md 的「代码级引用」（readFileSync / io.open / require）
      与「断言级引用」（smoke/e2e 里 indexOf('docs/xxx')），决定移动/删除的安全边界。
"""
import io, os, re

R = 'E:/Deepseekdb/'

# ---------- 1. 收集所有 docs 文件名 ----------
DOCS = []
for root, dirs, files in os.walk(R + 'docs'):
    for f in files:
        if f.endswith(('.md', '.html', '.xlsx', '.css', '.txt')):
            rel = os.path.join(root, f).replace(R, '').replace('\\', '/')
            DOCS.append(rel)
print('docs 文件总数:', len(DOCS))
print()

# ---------- 2. 扫描代码级引用（readFileSync/io.open/require/open）----------
CODE_FILES = []
for sub in ['.workbuddy/tools', 'js']:
    for root, dirs, files in os.walk(R + sub):
        r = root.replace('\\', '/')
        if any(x in r for x in ('/backup', '/tmp', '/patch', '/probe', '/node_modules')):
            continue
        for f in files:
            if f.endswith(('.js', '.py')):
                CODE_FILES.append((root + '/' + f).replace('\\', '/'))
CODE_FILES += [R + 'smoke-test.js', R + 'e2e-test.js', R + 'audit.js']

print('=' * 90)
print('① 代码级引用（真读文件的地方）')
print('=' * 90)
for fp in CODE_FILES:
    try:
        s = io.open(fp, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    hits = []
    for m in re.finditer(r"['\"`]([^'\"`\n]*docs/[^'\"`\n]+\.(?:md|html|xlsx|css|txt))['\"`]", s):
        ln = s.count('\n', 0, m.start()) + 1
        line = s.split('\n')[ln - 1].strip()
        # 只看像"读文件"的上下文
        ctx = s[max(0, m.start() - 120):m.start() + len(m.group(0)) + 40]
        is_read = bool(re.search(r'(readFileSync|io\.open|require\(|open\(|read_text|\.read\(\))', ctx))
        hits.append((ln, m.group(1), 'READ' if is_read else 'str', line[:130]))
    if hits:
        rel = fp.replace(R, '')
        print('##### ' + rel + '  (%d)' % len(hits))
        for ln, p, kind, line in hits[:20]:
            print('  L%-6d [%s] %s | %s' % (ln, kind, p, line[:120]))
print()

# ---------- 3. smoke/e2e 里的 docs 字样断言 ----------
print('=' * 90)
print('② smoke / e2e 里的 docs 字样（断言级）')
print('=' * 90)
for fp in [R + 'smoke-test.js', R + 'e2e-test.js']:
    s = io.open(fp, encoding='utf-8', errors='replace').read()
    hits = []
    for m in re.finditer(r'docs/[^\s\'"`*)\]]+', s):
        ln = s.count('\n', 0, m.start()) + 1
        line = s.split('\n')[ln - 1].strip()
        hits.append((ln, m.group(0), line[:140]))
    print('##### %s  (%d)' % (os.path.basename(fp), len(hits)))
    seen = set()
    for ln, p, line in hits:
        k = (p, line[:60])
        if k in seen:
            continue
        seen.add(k)
        print('  L%-6d %s | %s' % (ln, p, line[:120]))
print()

# ---------- 4. docs 内部交叉引用统计 ----------
print('=' * 90)
print('③ 每个 docs 文件被「其他 docs + 根目录 md」引用的次数')
print('=' * 90)
OTHER = []
for root, dirs, files in os.walk(R + 'docs'):
    for f in files:
        if f.endswith('.md'):
            OTHER.append((root + '/' + f).replace('\\', '/'))
for f in ['需求档案.md', 'DESIGN.md', 'README.md']:
    if os.path.exists(R + f):
        OTHER.append(R + f)
cnt = {}
for fp in OTHER:
    s = io.open(fp, encoding='utf-8', errors='replace').read()
    base = os.path.basename(fp)
    for d in DOCS:
        name = os.path.basename(d)
        if name == base:
            continue
        # 匹配"文件名"或"docs/路径"
        n1 = s.count('docs/' + d.replace('docs/', ''))
        n2 = s.count(name)
        if n1 + n2 > 0:
            cnt[d] = cnt.get(d, 0) + n1 * 2 + n2
zero = [d for d in DOCS if d not in cnt]
print('被引用（有入边）:', len(cnt), ' 零引用:', len(zero))
print()
print('--- 零引用的 docs 文件（潜在可动）---')
for d in sorted(zero):
    sz = os.path.getsize(R + d) // 1024
    print('  %-52s %dKB' % (d, sz))
