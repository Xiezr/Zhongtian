# -*- coding: utf-8 -*-
"""搬迁前普查：谁引用了 DESIGN.md / docs 里的文件 / tools 里的脚本。

判据：**先把引用点找全，再搬**。搬完要逐条转接，并复跑普查确认"零残留"。
"""
import io, os, re, glob

ROOT = r'E:\Deepseekdb'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
SKILLS = r'C:\Users\18811\.workbuddy\skills'

# 语料 = 项目内的文档与源码 + 工作记忆 + 技能
FILES = []
FILES += glob.glob(os.path.join(ROOT, 'docs', '**', '*.*'), recursive=True)
FILES += glob.glob(os.path.join(ROOT, '*.md')) + glob.glob(os.path.join(ROOT, '*.js'))
FILES += glob.glob(os.path.join(ROOT, 'js', '*.js'))
FILES += glob.glob(os.path.join(MEM, '*.md')) + glob.glob(os.path.join(MEM, '*.js'))
FILES += glob.glob(os.path.join(SKILLS, '**', '*.md'), recursive=True)
FILES += glob.glob(os.path.join(ROOT, '.workbuddy', 'tools', '*.md'))
FILES = [f for f in FILES if os.path.isfile(f)]

targets_docs = ['DESIGN.md', '历轮改动说明.md', 'v66改动说明.md', 'v67改动说明.md',
                '全面梳理报告.md', '系统全景.html', '资产清理记录_v67.md',
                '数值系统检索报告.html', '热血三国战斗设定检索.md', '资源产出分配方案.md',
                '资源供需图谱.html', '野地守军与经验公式.md', 'AI工作备忘.md',
                '项目地图.md', '图标素材注册表.md', '图标适配流程.md']
tools = [f for f in os.listdir(os.path.join(ROOT, '.workbuddy', 'tools')) if os.path.isfile(
    os.path.join(ROOT, '.workbuddy', 'tools', f))]

print('语料文件 %d 个（含 docs / 根 md / js / 记忆 / 技能 / tools 说明）' % len(FILES))
print()
print('=' * 8, '① DESIGN.md 被谁引用（含"第 N 章/节"这种精确指路）', '=' * 8)
n = 0
for fp in FILES:
    c = io.open(fp, encoding='utf-8', errors='ignore').read()
    if 'DESIGN.md' in c:
        for i, l in enumerate(c.split('\n')):
            if 'DESIGN.md' in l:
                n += 1
                tag = '★' if re.search(r'DESIGN\.md[^\n]{0,12}(第|\d+\.\d+|§)', l) else ' '
                print('  %s %-42s %s' % (tag, os.path.relpath(fp, ROOT) if fp.startswith(ROOT) else os.path.basename(fp), l.strip()[:96]))
print('  合计 %d 处' % n)
print()
print('=' * 8, '② docs 里的文件被谁引用', '=' * 8)
for t in targets_docs:
    if t in ('DESIGN.md', 'AI工作备忘.md', '项目地图.md'):
        continue
    hits = []
    for fp in FILES:
        if os.path.basename(fp) == t:
            continue
        c = io.open(fp, encoding='utf-8', errors='ignore').read()
        if t in c:
            hits.append(os.path.relpath(fp, ROOT) if fp.startswith(ROOT) else 'mem/' + os.path.basename(fp))
    print('  %-28s 引用 %d 处  %s' % (t, len(hits), '、'.join(sorted(set(hits))[:5])))
print()
print('=' * 8, '③ tools 脚本被谁引用', '=' * 8)
ref_map = {}
for t in tools:
    hits = []
    for fp in FILES:
        if os.path.basename(fp) == t:
            continue
        c = io.open(fp, encoding='utf-8', errors='ignore').read()
        if t in c:
            hits.append(os.path.relpath(fp, ROOT) if fp.startswith(ROOT) else 'mem/' + os.path.basename(fp))
    if hits:
        ref_map[t] = hits
for t in sorted(ref_map):
    print('  %-30s %2d 处  %s' % (t, len(ref_map[t]), '、'.join(sorted(set(ref_map[t]))[:4])))
print('  被引用 %d 个 / 共 %d 个' % (len(ref_map), len(tools)))
