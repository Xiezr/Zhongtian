# -*- coding: utf-8 -*-
"""
v89.105 基调统一 · 第三轮：独一份的艺术面归入语义令牌
============================================================
第二轮之后剩 30 处。它们分两类：
  A. 已在第二轮立好语义令牌、只是**用法处还没换**（卷轴/印章/头像球/小地图…）
  B. 第二轮之后新出现的（v89.103 沙盘 + v89.104 界面）——**敌军红**、**接触线金**、
     战绩绿辉光：同一支色调在四处各写一遍裸值，正好是"基调不统一"的新病灶。

输出：全部换成 `var(--语义名)`；本轮新增的令牌一并写入 :root。
范围仍**排除 :root 定义块**（按值替换的老坑）。
"""
import io, os, re, sys

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(R, 'index.html')
DRY = '--apply' not in sys.argv
s = io.open(SRC, encoding='utf-8').read()
orig = s

# ---------- 1. 本轮新增令牌 ----------
NEW = """
    /* v89.105：以下几条来自**功能推进中长出来的新色**（沙盘/战场/自动开关）——
       同一支调子在四五处各写一遍裸值，是"基调漂移"的最新病灶，一并归名。 */
    --foe-rgb: 190,84,74;        /* 敌军侧（兵牌/接触线断开/战报条）：偏冷的朱红 */
    --contact-rgb: 232,176,60;   /* 接触线（沙盘交战标记）：琥珀金 */
    --win-rgb: 79,191,106;       /* 战报"胜"字辉光 */
    --gold-line: #6b5a2c;        /* 深金分隔线（史册条目左缘） */
    --gd-chip-ink: #d8b0f0;      /* 详情页奇遇芯片的字色 */
"""
anchor = "    /* 深红（红钮的底与边） */\n    --red-deep: #5c1a10;\n"
assert anchor in s, '锚点丢失'
s = s.replace(anchor, anchor + NEW, 1)

# ---------- 2. 用法映射（长串优先） ----------
MAP = [
    # 渐变（必须先替，否则内部的 hex 会被后面的单色规则吃掉一半）
    ('radial-gradient(50% 46% at 50% 62%, rgba(24,40,6,.30), rgba(24,40,6,0) 72%)',
     'radial-gradient(50% 46% at 50% 62%, rgba(var(--tile-busy-rgb),.30), rgba(var(--tile-busy-rgb),0) 72%)'),
    ('linear-gradient(90deg, #7bc96f, #e8c878)', 'var(--grad-kbar)'),
    ('linear-gradient(180deg, #3d3826, #26231a)', 'var(--grad-bb-toggle)'),
    ('radial-gradient(circle at 50% 30%, #3a3a4a, #24242e)', 'var(--grad-avatar)'),
    ('linear-gradient(180deg, #2b2a22, #211f18)', 'var(--grad-palace-busy)'),
    ('linear-gradient(180deg, #3a5c3c, #26402a)', 'var(--grad-auto-on)'),
    ('linear-gradient(180deg, #6b5330, #3c2c16 55%, #241a0c)', 'var(--grad-scroll-axis)'),
    ('radial-gradient(circle at 35% 30%, #a98a4e, #4a3618 62%, #221a0b)', 'var(--grad-scroll-knob)'),
    ('linear-gradient(160deg, #9d3524, #6d2114)', 'var(--grad-seal)'),
    ('linear-gradient(180deg, #9d3524, #5f1c11)', 'var(--grad-seal-flat)'),
    # rgba 单色
    ('rgba(30,20,6,.52)', 'rgba(var(--tile-veil-rgb),.52)'),
    ('rgba(48,76,14,.66)', 'rgba(var(--tile-add-rgb),.66)'),
    ('rgba(30,24,12,.95)', 'var(--toast-bg)'),
    ('rgba(30,24,12,.97)', 'var(--mo-bg)'),
    ('rgba(255,200,170,.18)', 'rgba(var(--seal-hi-rgb),.18)'),
    ('rgba(79,191,106,.55)', 'rgba(var(--win-rgb),.55)'),
    ('rgba(190, 84, 74, .16)', 'rgba(var(--foe-rgb),.16)'),
    ('rgba(190, 84, 74, .48)', 'rgba(var(--foe-rgb),.48)'),
    ('rgba(190, 84, 74, .55)', 'rgba(var(--foe-rgb),.55)'),
    ('rgba(190, 84, 74, .18)', 'rgba(var(--foe-rgb),.18)'),
    ('rgba(190, 84, 74, .5)', 'rgba(var(--foe-rgb),.5)'),
    ('rgba(232, 176, 60, .45)', 'rgba(var(--contact-rgb),.45)'),
    ('rgba(216,138,184,.5)', 'rgba(var(--beauty-tag-rgb),.5)'),
    # hex 单色
    ('#6b5a2c', 'var(--gold-line)'),
    ('#84a050', 'var(--map-ground)'),
    ('#9c9078', 'var(--gd-lore-ink)'),
    ('#2a2416', 'var(--gd-bar-line)'),
    ('#d8b0f0', 'var(--gd-chip-ink)'),
    ('#d88ab8', 'var(--beauty-tag)'),
    ('#24242e', 'var(--avcell-bg)'),
]

# 需要补 -rgb 的（被上面引用但可能还没定义）
NEED_RGB = {'beauty-tag': '224,138,176'}   # = --beauty-tag #e08ab0

# ---------- 3. 施工：保护 :root ----------
root_span = re.search(r'(:root\s*\{.*?\n  \})', s, re.S)
assert root_span
ROOT_TXT = root_span.group(1)
PH = '/*__V89105_ROOT__*/'
s = s[:root_span.start()] + PH + s[root_span.end():]

spans = [(mm.start(), mm.end()) for mm in re.finditer(r'<style>[\s\S]*?</style>', s)]
stats = {'n': 0, 'kinds': set()}
def do(txt):
    for a, b in MAP:
        if a in txt:
            stats['n'] += txt.count(a)
            stats['kinds'].add(a[:34])
            txt = txt.replace(a, b)
    return txt

pieces, prev = [], 0
for a, b in spans:
    pieces.append(s[prev:a])
    pieces.append(do(s[a:b]))
    prev = b
pieces.append(s[prev:])
s = ''.join(pieces)

# 补 -rgb 定义
extra_rgb = []
for nm, v in NEED_RGB.items():
    if ('--%s-rgb' % nm) not in s:
        extra_rgb.append('    --%s-rgb: %s;' % (nm, v))
if extra_rgb:
    anchor2 = '    /* v89.105：以下三元组由上面的命名色自动派生（alpha 合成的唯一来源） */\n'
    if anchor2 in s:
        s = s.replace(anchor2, anchor2 + '\n'.join(extra_rgb) + '\n', 1)
    else:
        s = s.replace('    --gold-soft-rgb: 232,206,136;\n',
                      '    --gold-soft-rgb: 232,206,136;\n' + '\n'.join(extra_rgb) + '\n', 1)

s = s.replace(PH, ROOT_TXT)

print('===== v89.105 第三轮 %s =====' % ('【干跑】' if DRY else '【已写入】'))
print('  替换 %d 处，涉及 %d 种字面量' % (stats['n'], len(stats['kinds'])))
for k in sorted(stats['kinds']):
    print('    ' + k)
if extra_rgb:
    print('  补三元组：' + ' '.join(extra_rgb))

if DRY:
    print('（干跑）')
else:
    bad = re.findall(r'var\(--[a-z0-9-]*\)-rgb\)|--([a-z0-9-]+)\s*:\s*var\(--\1\)', s)
    assert not bad, '坏值：%s' % bad[:5]
    assert s.count('{') == s.count('}'), '括号不配平'
    io.open(SRC, 'w', encoding='utf-8', newline='').write(s)
    print('  自检 ✅ 坏值 0 · 括号 %d/%d' % (s.count('{'), s.count('}')))
    print('已写入 ' + SRC)
