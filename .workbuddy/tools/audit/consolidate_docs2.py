# -*- coding: utf-8 -*-
"""集中存放 · 第二步：引用转接 + 终检（docs 分档与 DESIGN 拆分已在第一步完成）。

只处理**文本**文件（上一步崩在读 xlsx 上：二进制不能用 utf-8 读）。
转接三类：
  ① 路径式 `docs/NAME` → `docs/<子目录>/NAME`
  ② 反引号裸名 `` `NAME` `` → `` `_文献/NAME` ``（子目录内）
  ③ 章节式「DESIGN.md 第 N 章」→ 第 1~10 章→`docs/设计规范.md`；第 11 章起→`docs/_史料/设计史.md`
"""
import io, os, re, glob

ROOT = r'E:\Deepseekdb'
DOCS = os.path.join(ROOT, 'docs')
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
TEXT_EXT = ('.md', '.html', '.js', '.json', '.txt', '.css')

MOVED = {
    '历轮改动说明.md': '_史料', 'v66改动说明.md': '_史料', '全面梳理报告.md': '_史料',
    '系统全景.html': '_史料', '资产清理记录_v67.md': '_史料',
    '数值系统检索报告.html': '_参考', '热血三国战斗设定检索.md': '_参考',
    '资源产出分配方案.md': '_参考', '资源供需图谱.html': '_参考', '野地归军与经验公式.md': '_参考',
    '野地守军与经验公式.md': '_参考',
}
SKIP = {'项目地图.md', '设计史.md', '设计规范.md'}


def rd(p):
    return io.open(p, encoding='utf-8', errors='ignore', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


# ---------- 校验第一步的产物 ----------
print('=== 校验 DESIGN 拆分结果 ===')
sp = os.path.join(DOCS, '设计规范.md')
se = os.path.join(DOCS, '_史料', '设计史.md')
h = rd(sp)
print('   设计规范.md 开头：', repr(h[:70]))
print('   设计规范.md 含「## 10. 」：', '## 10. ' in h, '｜含「## 11. 」：', '## 11. ' in h, '（应为 False）')
e = rd(se)
print('   设计史.md  开头：', repr(e[:70]))
print('   设计史.md  含「## 11. 」：', '## 11. ' in e, '｜含「## 46.5」：', '## 46.5' in e)
print('   DESIGN.md 字符数：', len(rd(os.path.join(ROOT, 'DESIGN.md'))))

TARGETS = []
for pat in [os.path.join(DOCS, '**', '*'), os.path.join(ROOT, '*.md'), os.path.join(ROOT, 'js', '*.js'),
            os.path.join(MEM, '*.md'), os.path.join(ROOT, '.workbuddy', 'tools', '*.md'),
            r'C:\Users\18811\.workbuddy\skills\vanilla-js-bulk-refactor\SKILL.md',
            r'C:\Users\18811\.workbuddy\skills\frontend-e2e-jsdom-verification\SKILL.md']:
    TARGETS += glob.glob(pat, recursive=True)
TARGETS = [t for t in TARGETS if os.path.isfile(t) and t.lower().endswith(TEXT_EXT)
           and os.path.basename(t) not in SKIP and os.path.basename(t) != 'DESIGN.md']
print('   参与转接的文本文件：%d 个' % len(TARGETS))

# ---------- ①② 路径与裸名 ----------
n1, n1f = 0, 0
for fp in TARGETS:
    c = rd(fp)
    o = c
    for name, sub in MOVED.items():
        c = c.replace('docs/' + name, 'docs/%s/%s' % (sub, name))
        c = c.replace('`%s`' % name, '`%s/%s`' % (sub, name))
    if c != o:
        wr(fp, c)
        n1 += 1
        n1f += sum(1 for _ in range(1))
print('\n① 路径/裸名转接：%d 份文件' % n1)

# ---------- ③ 章节式 ----------
chap, nc = [], 0
for fp in TARGETS:
    lines = rd(fp).split('\n')
    ch = False
    for k, l in enumerate(lines):
        if 'DESIGN.md' not in l:
            continue
        m = re.search(r'DESIGN\.md\s*(?:第\s*)?(\d+)(?:\s*[–~—-]\s*(\d+))?\s*章', l)
        if not m:
            continue
        a = int(m.group(1)); b = int(m.group(2)) if m.group(2) else a
        if b <= 10:
            tgt = 'docs/设计规范.md'
        elif a >= 11:
            tgt = 'docs/_史料/设计史.md'
        else:
            continue
        lines[k] = re.sub(r'DESIGN\.md(?=\s*(?:第\s*)?\d)', tgt, l, count=1)
        ch = True
        chap.append('%-22s 第 %s 章 → %s' % (os.path.basename(fp), m.group(1), tgt))
    if ch:
        wr(fp, '\n'.join(lines))
        nc += 1
print('② 章节式转接：%d 份 / %d 处' % (nc, len(chap)))
for x in chap[:14]:
    print('      ' + x)

# ---------- ④ 终检 ----------
print('\n③ 终检：残留（应为 0）')
bad = []
for fp in TARGETS + [os.path.join(DOCS, '项目地图.md')]:
    c = rd(fp)
    for name, sub in MOVED.items():
        if name == '野地归军与经验公式.md':
            continue
        if ('docs/' + name) in c:
            bad.append('%s 仍写 docs/%s' % (os.path.basename(fp), name))
        if ('`%s`' % name) in c and os.path.basename(fp) != '项目地图.md':
            bad.append('%s 仍写裸名 `%s`' % (os.path.basename(fp), name))
print('   残留 %d 处' % len(bad))
for x in bad[:15]:
    print('      ' + x)

print('\n④ docs 新结构')
for r, ds, fs in os.walk(DOCS):
    rel = os.path.relpath(r, DOCS)
    tag = 'docs/' if rel == '.' else 'docs/%s/' % rel
    for f in sorted(fs):
        print('   %-30s %7.0fKB' % (tag + f, os.path.getsize(os.path.join(r, f)) / 1024))
