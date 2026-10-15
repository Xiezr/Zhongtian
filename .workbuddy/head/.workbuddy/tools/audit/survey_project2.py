# -*- coding: utf-8 -*-
"""补充盘点：素材分解 · 记忆体量 · 项目自建技能 · 测试规模。"""
import io, os, re, glob

ROOT = r'E:\Deepseekdb'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
SKILLS = r'C:\Users\18811\.workbuddy\skills'
MINE = ['vanilla-js-bulk-refactor', 'frontend-e2e-jsdom-verification', 'dead-wiring-audit',
        'ui-design-token-consolidation', 'turn-based-battle-sim', 'game-asset-atlas-pipeline']


def human(n):
    return '%.1fMB' % (n / 1048576) if n >= 1048576 else ('%.0fKB' % (n / 1024) if n >= 1024 else '%dB' % n)


print('=' * 8, '素材分解', '=' * 8)
A = os.path.join(ROOT, 'assets')
for sub in sorted(os.listdir(A)):
    p = os.path.join(A, sub)
    if os.path.isdir(p):
        for d in sorted(os.listdir(p)):
            q = os.path.join(p, d)
            if os.path.isdir(q):
                c = sum(len(fs) for _, _, fs in os.walk(q))
                sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(q) for f in fs)
                tag = ''
                if d == 'ui':
                    tag = '（运行时取图，经 bitmaps.js）'
                elif d == 'raw':
                    tag = '（AI 图集原图·原料）'
                elif d == 'pool':
                    tag = '（通用头像池）'
                elif d.startswith('_'):
                    tag = '（原料/备份）'
                print('   %-22s %8s %4d 个 %s' % (sub + '/' + d, human(sz), c, tag))
            elif d.startswith('hero_'):
                pass
        heros = [f for f in os.listdir(p) if f.startswith('hero_')]
        if heros:
            sz = sum(os.path.getsize(os.path.join(p, f)) for f in heros)
            print('   %-22s %8s %4d 个 （名将回退层 hero_*.webp）' % (sub + '/hero_*', human(sz), len(heros)))

print()
print('=' * 8, '记忆体量', '=' * 8)
for f in sorted(os.listdir(MEM)):
    p = os.path.join(MEM, f)
    if os.path.isfile(p):
        c = io.open(p, encoding='utf-8', errors='ignore').read()
        print('   %-24s %8s %6d 字符 %5d 行' % (f, human(os.path.getsize(p)), len(c), c.count('\n') + 1))

print()
print('=' * 8, '项目自建技能', '=' * 8)
for s in MINE:
    p = os.path.join(SKILLS, s, 'SKILL.md')
    if os.path.exists(p):
        c = io.open(p, encoding='utf-8', errors='ignore').read()
        head = c.split('\n')[1][:60] if c.startswith('---') else c.split('\n')[0][:60]
        print('   %-34s %7d 字符  %s' % (s, len(c), head))

print()
print('=' * 8, '测试规模', '=' * 8)
for f in ['smoke-test.js', 'e2e-test.js', 'audit.js']:
    p = os.path.join(ROOT, f)
    c = io.open(p, encoding='utf-8', errors='ignore').read()
    n_check = len(re.findall(r'\bcheck\(', c))
    print('   %-16s %8s %5d 行 · check( %4d 处' % (f, human(os.path.getsize(p)), c.count('\n') + 1, n_check))
print()
print('=' * 8, 'DESIGN.md 的章节骨架（看它究竟是"规范"还是"史书"）', '=' * 8)
d = io.open(os.path.join(ROOT, 'DESIGN.md'), encoding='utf-8', errors='ignore').read()
h1 = re.findall(r'^# .+$', d, re.M)
print('   一级标题 %d 个，前 30 个：' % len(h1))
for h in h1[:30]:
    print('      ' + h[:74])
