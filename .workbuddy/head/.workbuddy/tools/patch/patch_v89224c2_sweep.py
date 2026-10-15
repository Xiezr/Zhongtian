# -*- coding: utf-8 -*-
"""v89.224c2：装备双轨扫尾 + 资质五档 + 六维四项（全局·带档案守卫掩码）。
映射源：docs/废土术语映射表.md"""
import io, os, re
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
import glob

FILES = sorted(glob.glob(BASE + 'js/*.js')) + [BASE + 'index.html', BASE + 'smoke-test.js', BASE + 'e2e-test.js']
def rel(p): return p.replace(BASE, '')

# 读全部
S = {p: io.open(p, encoding='utf-8', newline='').read() for p in FILES}

# ---- 守卫掩码：smoke 里"读需求档案"守卫引用的原文串不许改 ----
MASKS = []
if BASE + 'smoke-test.js' in S:
    sm = S[BASE + 'smoke-test.js']
    for m in re.finditer(r"indexOf\('([^']{4,60})'\)", sm):
        seg = sm[max(0, m.start() - 180):m.start()]
        if '需求档案' in seg:
            MASKS.append(m.group(1))
# 已知手工掩码（若扫描没抓到）
for extra in ["内政对税收也应有加成", "视双方将领资质和等级差设计"]:
    if extra not in MASKS: MASKS.append(extra)
MASKS = sorted(set(MASKS), key=len, reverse=True)
print('守卫掩码 %d 条:' % len(MASKS))
for x in MASKS: print('   -', x)

def protect(s):
    for i, x in enumerate(MASKS):
        s = s.replace(x, '\u0001P%02d\u0001' % i)
    return s
def unprotect(s):
    for i, x in enumerate(MASKS):
        s = s.replace('\u0001P%02d\u0001' % i, x)
    return s

REPL = [
    # 组合词先行（含图标前缀，避免裸词先吃掉把图标留下）
    ('⚔ 军中装备', '⚙ 机甲部件'),
    ('☯ 改造装备', '🧬 基因强化'),
    ('☯ 改造', '🧬 基因'),
    ('⚔ 军中', '⚙ 机甲'),
    # 装备双轨扫尾
    ('军装', '机甲'),
    ('改造装备', '基因强化件'),
    ('改造件', '基因强化件'),
    ('军中装备', '机甲部件'),
    ('装备栏', '部件栏'),
    # 资质五档
    ('凡品', '凡人'),
    ('良材', '突变体'),
    ('英杰', '进化体'),
    ('名世', '觉醒体'),
    ('天授', '天启体'),
    # 六维四项
    ('统率', '指挥'),
    ('内政', '治理'),
    ('勇武', '武力'),
    ('智谋', '谋略'),
]

report = []
for p in FILES:
    s = protect(S[p]); n = 0
    for a, b in REPL:
        c = s.count(a)
        if c:
            s = s.replace(a, b); n += c
    s = unprotect(s)
    if n and not DRY:
        tmp = p + '.tmp224c2'
        io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
        os.replace(tmp, p)
    report.append('%s: %d' % (rel(p), n))

print('[%s] 替换分布:' % ('DRY' if DRY else 'REAL'))
for r in report:
    if not r.endswith(': 0'): print('  ' + r)

if not DRY:
    # 核验：旧词归零（可执行形态，smoke 的掩码串除外）
    for p in FILES:
        s = io.open(p, encoding='utf-8', newline='').read()
        for a, _ in REPL[:7]:
            c = s.count(a)
            if c:
                print('  ⚠ 残留 %s ×%d (%s)' % (a, c, rel(p)))
    print('[核验] 装备双轨旧词扫描完成（残留会打印在上方，掩码串不计）')
