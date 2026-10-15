# -*- coding: utf-8 -*-
"""集中存放 · 第一步：docs 分档 + 拆 DESIGN.md + 引用转接。

结构（顶层只放"活的"）：
  docs/                     活规范与台账
  docs/_史料/                时点快照 + 逐轮记录（原 DESIGN 第 11 章起 / 历轮说明 / 报告快照）
  docs/_参考/                设计输入资料（数值检索报告、战斗检索、资源方案、供需图谱、野地公式）

DESIGN.md 处理：**不删**，改成 20 行指针（保留"第 N 章"这种指路可解析），
把"规范（1~10 章）"与"编年史（11 章起）"分到两个**用途命名**的文件里。
"""
import io, os, re, glob, shutil

ROOT = r'E:\Deepseekdb'
DOCS = os.path.join(ROOT, 'docs')
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
REPORT, FAIL = [], []


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


# ---------------- 0 预检：谁会因为 docs 搬迁而断 ----------------
print('=== 预检：源码/测试里是否引用 docs 路径 ===')
for rel in ['js/state.js', 'js/data.js', 'js/ui.js', 'smoke-test.js', 'e2e-test.js', 'audit.js', 'index.html']:
    c = rd(os.path.join(ROOT, rel))
    hits = [l.strip()[:90] for l in c.split('\n') if re.search(r'docs[/\\][^\s`\'"]+\.(md|html|xlsx)', l)]
    if hits:
        print('   %-16s %d 处' % (rel, len(hits)))
        for h in hits[:4]:
            print('      ' + h)

# ---------------- 1 建目录并搬文件 ----------------
HIST = ['历轮改动说明.md', 'v66改动说明.md', '全面梳理报告.md', '系统全景.html', '资产清理记录_v67.md']
REF = ['数值系统检索报告.html', '热血三国战斗设定检索.md', '资源产出分配方案.md',
       '资源供需图谱.html', '野地守军与经验公式.md']
for d in ['_史料', '_参考']:
    os.makedirs(os.path.join(DOCS, d), exist_ok=True)

MOVED = {}
for name in HIST:
    src = os.path.join(DOCS, name)
    if os.path.exists(src):
        shutil.move(src, os.path.join(DOCS, '_史料', name))
        MOVED[name] = '_史料'
for name in REF:
    src = os.path.join(DOCS, name)
    if os.path.exists(src):
        shutil.move(src, os.path.join(DOCS, '_参考', name))
        MOVED[name] = '_参考'
print()
print('=== ① 搬迁 %d 份 ===' % len(MOVED))
for k, v in MOVED.items():
    print('   docs/%-28s → docs/%s/' % (k, v))

# ---------------- 2 DESIGN.md 拆分 ----------------
d = rd(os.path.join(ROOT, 'DESIGN.md'))
anchor = '## 11. 数值系统接入'
i = d.index(anchor)
head, tail = d[:i].rstrip() + '\n', d[i:].rstrip() + '\n'
assert len(head) > 3000 and len(tail) > 100000, (len(head), len(tail))

wr(os.path.join(DOCS, '设计规范.md'),
   '# 设计规范（当前）\n\n'
   '> 本文件 = **只看这一份就够了的当前规范**（原 `DESIGN.md` 第 1~10 章）。\n'
   '> **本章号与原文一致**（1~10），所以别处写的「DESIGN.md 第 N 章」都能对上。\n'
   '> 逐版本编年史（v2 → v67 的全部过程与踩坑）→ `docs/_史料/设计史.md`（同章号，从第 11 章起）。\n\n'
   + head.split('\n', 1)[1].lstrip('\n') if head.startswith('#') else head)

wr(os.path.join(DOCS, '_史料', '设计史.md'),
   '# 设计史（逐版本编年）\n\n'
   '> 本文件 = **原 `DESIGN.md` 第 11 章起的全部内容**（v2 → v67，按版本编年）。\n'
   '> 当前有效的规范在 `docs/设计规范.md`（第 1~10 章）。**本文件的章号与原文一致**，\n'
   '> 所以别处写的「DESIGN.md 第 43 章」在这里能找到。\n'
   '> ⚠️ 本文件里的"当时测试数"是**史实**，不是当前基线；当前基线见 `MEMORY.md`。\n\n'
   + tail)

wr(os.path.join(ROOT, 'DESIGN.md'),
   '# DESIGN.md —— 指针（v67 拆分后）\n\n'
   '> 这份文件原来是 232KB / 4107 行的混合体：**只有 4% 是"当前规范"，96% 是按版本编的史书**。\n'
   '> v67 按用途拆成两份，本文件只留指针，避免"改规范的人要先翻 4000 行历史"。\n\n'
   '| 你要找什么 | 去哪 |\n|---|---|\n'
   '| **当前规范**（架构 / 加载顺序 / 数据结构 / 命名空间 / 界面布局 / 战斗 / 胜利条件 / 扩展点） | `docs/设计规范.md`（原第 **1~10** 章） |\n'
   '| **逐版本编年史**（v2 → v67 的每次改动、踩坑、事故与恢复） | `docs/_史料/设计史.md`（原第 **11 章起**） |\n'
   '| 产物与规则的总地图 | `docs/项目地图.md` |\n'
   '| 每次动手都要遵守的强制规则 | 工作区 `.workbuddy/memory/MEMORY.md` |\n'
   '| 案例与细则（单一出口清单 / 界面细目 / 待拍板积压） | `docs/AI工作备忘.md` |\n'
   '| 工具索引（62 个，按用途分组） | `.workbuddy/tools/README_INDEX.md` |\n\n'
   '**章号对照**：两份文件都**保留原章号**。所以历史上任何一句「DESIGN.md 第 43 章」——\n'
   '第 1~10 章去 `设计规范.md` 找，第 11 章及以后去 `_史料/设计史.md` 找。\n')
print()
print('=== ② DESIGN.md 拆分 ===')
print('   规范 → docs/设计规范.md            %d 字符' % len(rd(os.path.join(DOCS, '设计规范.md'))))
print('   史   → docs/_史料/设计史.md        %d 字符' % len(rd(os.path.join(DOCS, '_史料', '设计史.md'))))
print('   指针 → DESIGN.md                   %d 字符（原 123887）' % len(rd(os.path.join(ROOT, 'DESIGN.md'))))

# ---------------- 3 引用转接 ----------------
TARGETS = []
TARGETS += glob.glob(os.path.join(DOCS, '**', '*.*'), recursive=True)
TARGETS += glob.glob(os.path.join(ROOT, '*.md')) + glob.glob(os.path.join(ROOT, 'js', '*.js'))
TARGETS += glob.glob(os.path.join(MEM, '*.md'))
TARGETS += glob.glob(r'C:\Users\18811\.workbuddy\skills\vanilla-js-bulk-refactor\SKILL.md')
TARGETS += glob.glob(r'C:\Users\18811\.workbuddy\skills\frontend-e2e-jsdom-verification\SKILL.md')
TARGETS += glob.glob(os.path.join(ROOT, '.workbuddy', 'tools', '*.md'))
TARGETS = [t for t in TARGETS if os.path.isfile(t) and os.path.basename(t) not in ('设计史.md', '设计规范.md')]

n_path = n_chap = 0
chap_log = []
for fp in TARGETS:
    if os.path.basename(fp) == '项目地图.md':      # 地图稍后整体重写，不在这一轮改
        continue
    c = rd(fp)
    o = c
    # ① 路径式引用：docs/NAME
    for name, sub in MOVED.items():
        c = c.replace('docs/' + name, 'docs/%s/%s' % (sub, name))
    # ② 反引号裸名：`NAME` → `_史料/NAME`
    for name, sub in MOVED.items():
        c = c.replace('`%s`' % name, '`%s/%s`' % (sub, name))
    if c != o:
        n_path += 1
        wr(fp, c)
    # ③ 章节式引用：DESIGN.md 第 N 章 → 按 N 分流
    c2 = rd(fp) if c != o else c
    lines = c2.split('\n')
    ch = False
    for k, l in enumerate(lines):
        if 'DESIGN.md' not in l:
            continue
        m = re.search(r'DESIGN\.md\s*(?:第\s*)?(\d+)(?:\s*[–~-]\s*(\d+))?\s*(章|\.)?', l)
        if not m:
            continue
        a = int(m.group(1))
        b = int(m.group(2)) if m.group(2) else a
        if b <= 10:
            tgt = 'docs/设计规范.md'
        elif a >= 11:
            tgt = 'docs/_史料/设计史.md'
        else:
            continue          # 跨 10/11 的区间：留 DESIGN.md（指针里有对照表）
        lines[k] = re.sub(r'DESIGN\.md(?=\s*(?:第\s*)?\d)', tgt, l, count=1)
        ch = True
        chap_log.append('%s: 第 %d%s 章 → %s' % (os.path.basename(fp), a,
                                                ('–%d' % b) if b != a else '', tgt))
    if ch:
        wr(fp, '\n'.join(lines))
        n_chap += 1
print()
print('=== ③ 引用转接 ===')
print('   路径/裸名转接：%d 份文件' % n_path)
print('   章节式转接：%d 份文件 / %d 处' % (n_chap, len(chap_log)))
for x in chap_log[:12]:
    print('      ' + x)

# ---------------- 4 终检：还有没有"断掉的"引用 ----------------
print()
print('=== ④ 终检 ===')
bad = []
for fp in TARGETS:
    if os.path.basename(fp) in ('项目地图.md', 'DESIGN.md', '设计史.md', '设计规范.md'):
        continue
    c = rd(fp)
    for name, sub in MOVED.items():
        if ('docs/' + name) in c:                       # 没转到子目录
            bad.append('%s 仍写 docs/%s' % (os.path.basename(fp), name))
        if ('`%s`' % name) in c:
            bad.append('%s 仍写裸名 `%s`' % (os.path.basename(fp), name))
print('   残留 %d 处' % len(bad))
for x in bad[:12]:
    print('      ' + x)
print()
print('=== ⑤ docs 新结构 ===')
for r, ds, fs in os.walk(DOCS):
    rel = os.path.relpath(r, DOCS)
    if rel == '.':
        for f in sorted(fs):
            print('   docs/%-30s %7.0fKB' % (f, os.path.getsize(os.path.join(r, f)) / 1024))
    else:
        print('   [%s/]' % rel)
        for f in sorted(fs):
            print('      %-30s %7.0fKB' % (f, os.path.getsize(os.path.join(r, f)) / 1024))
