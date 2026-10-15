# -*- coding: utf-8 -*-
"""
v89.105 基调统一 · 第二轮：裸 alpha 色回归命名色
============================================================
第一轮之后残余 68 处裸色，肉眼一看规律就出来了：
  `rgba(95,191,106,.45)`  ==  --rank-liang(#5fbf6a) + alpha
  `rgba(216,168,60,.6)`   ==  --q4(#d8a83c) + alpha
  `rgba(123,201,111,.4)`  ==  --green-ok(#7bc96f) + alpha
  `rgba(168,58,44,.7)`    ==  --cinnabar(#a83a2c) + alpha
——**同一个颜色，一个走名字、一个走裸 RGB**。这是"基调不统一"在代码层的原形。

做法：**从 :root 的令牌定义里反推三元组表**（不另抄一份 —— 抄了就又多一个来源），
凡 rgba 字面量的 RGB 命中某个已命名色，就写回 `rgba(var(--那色的-rgb), α)`；
命中色若还没定义 `-rgb` 三元组，就地补一条。

另有 4 处**近色偏移**（老实现自己写歪的，与同名色差 2~30/255）走别名表归正，
其余一次性艺术面（卷轴/印章/头像球）另立语义令牌 —— 它们不是"重复"，是独一份。
"""
import io, os, re, sys, json

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(R, 'index.html')
DRY = '--apply' not in sys.argv
s = io.open(SRC, encoding='utf-8').read()
orig = s

# ---------- 1. 从 :root 反推：六位 hex → 令牌名 ----------
root_m = re.search(r':root\s*\{(.*?)\n  \}', s, re.S)
assert root_m, '未找到 :root 块'
root = root_m.group(1)
hex2name = {}
for mm in re.finditer(r'--([a-z0-9-]+)\s*:\s*#([0-9a-fA-F]{6})\s*;', root):
    name, hx = mm.group(1), mm.group(2).lower()
    r, g, b = int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16)
    # 允许一个色被多个令牌共用；优先取"基础名"（不含 -light/-dark 之类的后缀先来后到由出现顺序决定）
    hex2name.setdefault('%d,%d,%d' % (r, g, b), name)

# 已存在的 -rgb 三元组（**连值一起取**）——复用前必须核对色值，
# 否则 `--gold-rgb(201,162,75)` 会被拿去顶 `--gold(#cfa856=207,168,86)` 的 alpha 变体，
# 静默换色（差 6/255 看不出来，但那就是"不统一"的另一种写法）。
have_rgb = {}
for mm in re.finditer(r'--([a-z0-9-]+)-rgb\s*:\s*([\d,\s]+);', root):
    have_rgb[mm.group(1)] = re.sub(r'\s+', '', mm.group(2))
MISMATCH = []

# ---------- 2. 近色别名（老实现自己写歪的） ----------
# 键 = 裸字面量里的 RGB，值 = 目标令牌名（其色值就是"正色"）
ALIAS = {
    '154,154,140': 'rank-fan',      # --rank-fan #9c9c8c = 156,156,140（差 2，肉眼不可辨）
    '90,160,110': 'q2',             # .ia.q2 自写的中绿 → 归 --q2 #6fbf7a
    '74,140,200': 'q3',             # .ia.q3 自写的蓝 → 归 --q3 #5aa0d8
    '190,140,60': 'q4',             # .ia.q4 自写的棕 → 归 --q4 #d8a83c
    '20,22,28': 'slab-0',           # .doll-slot.empty 的旧页底色 → 归深底阶
    '156,106,214': 'wonder',        # 奇遇紫的旧值 → 归 --wonder（青莲紫）
    '63,169,201': 'blue-info',      # 见闻蓝 → 归 --blue-info
    '214,178,105': 'gold-soft-rgb',  # 宫殿悬停描边 → 归柔金
}
# 上行 gold-soft-rgb 特殊：目标是已存在的三元组令牌（值 232,206,136）
ALIAS_TRIPLET = {'214,178,105': 'gold-soft'}

# ---------- 3. 一次性艺术面：另立语义令牌（不是重复，是独一份） ----------
EXTRA_TOKENS = """
    /* v89.105：以下为**独一份的艺术面**（卷轴/印章/头像球/小地图底…）——
       它们各自的渐变色值只出现一次，不存在"重复"，所以不算漂移；
       但仍集中声明，理由同前：换肤/调色时只有一处要改。 */
    --map-ground: #84a050;                                   /* 小地图地面色 */
    --grad-scroll-axis: linear-gradient(180deg, #6b5330, #3c2c16 55%, #241a0c);
    --grad-scroll-knob: radial-gradient(circle at 35% 30%, #a98a4e, #4a3618 62%, #221a0b);
    --grad-seal: linear-gradient(160deg, #9d3524, #6d2114);   /* 朱印 */
    --grad-seal-flat: linear-gradient(180deg, #9d3524, #5f1c11);
    --seal-hi-rgb: 255,200,170;                              /* 朱印高光 */
    --grad-avatar: radial-gradient(circle at 50% 30%, #3a3a4a, #24242e);
    --avcell-bg: #24242e;                                    /* 头像格底 */
    --grad-auto-on: linear-gradient(180deg, #3a5c3c, #26402a);   /* 自动开关·开 */
    --grad-bb-toggle: linear-gradient(180deg, #3d3826, #26231a); /* 小地图标签钮·开 */
    --grad-kbar: linear-gradient(90deg, #7bc96f, #e8c878);       /* 建造进度条 */
    --grad-palace-busy: linear-gradient(180deg, #2b2a22, #211f18);
    --ledger-rgb: 168,58,44;                                 /* 黄册朱线（= 朱砂族） */
    --toast-bg: rgba(30,24,12,.95);
    --mo-bg: rgba(30,24,12,.97);
    --gd-lore-ink: #9c9078;                                  /* 详情页引文墨 */
    --gd-bar-line: #2a2416;
    --tile-busy-rgb: 24,40,6;                                /* 地块悬停辉光 */
    --tile-veil-rgb: 30,20,6;                                /* 地块标签纱 */
    --tile-add-rgb: 48,76,14;                                /* 空地加号 */
"""
anchor = "    /* 深红（红钮的底与边） */\n    --red-deep: #5c1a10;\n"
assert anchor in s
s = s.replace(anchor, anchor + EXTRA_TOKENS, 1)

# ---------- 4. 扫 CSS，把 rgba 字面量归名 ----------
added_rgb = set()
stats = {'hit': 0, 'newtok': 0}

def wrap(mm):
    r, g, b = mm.group(1).strip(), mm.group(2).strip(), mm.group(3).strip()
    key = '%s,%s,%s' % (r, g, b)
    name = None
    if key in hex2name:
        name = hex2name[key]
    elif key in ALIAS:
        name = ALIAS[key]
    elif key in ALIAS_TRIPLET:
        name = ALIAS_TRIPLET[key]
    else:
        return mm.group(0)
    if name.endswith('-rgb'):
        nm, trip = name[:-4], key
    else:
        nm, trip = name, None
    # 目标色值（用于核对复用是否安全）
    target = None
    for k, v in hex2name.items():
        if v == nm:
            target = k; break
    if nm in have_rgb:
        if target and have_rgb[nm] != target:
            MISMATCH.append('%s：定义 %s ≠ 目标 %s（不改）' % (nm, have_rgb[nm], target))
            return mm.group(0)
        stats['hit'] += 1
        return 'rgba(var(--' + nm + '-rgb),'
    if target:
        have_rgb[nm] = target
        added_rgb.add(nm)
    stats['hit'] += 1
    return 'rgba(var(--' + nm + '-rgb),'

# 替换范围 = <style> 段，且**排除 :root 定义块**
#   ⚠️ 第一轮踩过的坑：颜色替换是按**值**走的，不认属性名 —— 定义块里
#   `--teal-deep: #1c4539;` 被改写成 `--teal-deep: var(--teal-deep);`（自引用，等于没值）。
#   规矩：**凡是按值替换，都必须把定义块摘出去。**
#   实现：把 :root 块整段挖出来换成占位符 → 全局替换 → 再把占位符填回。
root_span = re.search(r'(:root\s*\{.*?\n  \})', s, re.S)
assert root_span, '未找到 :root 块'
ROOT_TXT = root_span.group(1)
PH = '/*__V89105_ROOT_PLACEHOLDER__*/'
s = s[:root_span.start()] + PH + s[root_span.end():]

RGBA_RE = re.compile(r'rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,')

def in_style_spans(txt):
    """<style> 段的字符区间列表"""
    return [(mm.start(), mm.end()) for mm in re.finditer(r'<style>[\s\S]*?</style>', txt)]

spans = in_style_spans(s)
pieces, prev = [], 0
for a, b in spans:
    pieces.append(s[prev:a])            # style 之外：原样
    pieces.append(RGBA_RE.sub(wrap, s[a:b]))
    prev = b
pieces.append(s[prev:])
s = ''.join(pieces)

s = s.replace(PH, ROOT_TXT)              # 定义块原样填回
stats['root_protected'] = True
stats['newtok'] = len(added_rgb)

# ---------- 5. 补 -rgb 定义 ----------
if added_rgb:
    lines = []
    for nm in sorted(added_rgb):
        hx = None
        for k, v in hex2name.items():
            if v == nm:
                hx = k; break
        if hx:
            lines.append('    --%s-rgb: %s;' % (nm, hx))
    anchor2 = '    --gold-soft-rgb: 232,206,136;\n'
    assert anchor2 in s
    s = s.replace(anchor2, anchor2 + '    /* v89.105：以下三元组由上面的命名色自动派生（alpha 合成的唯一来源） */\n'
                  + '\n'.join(lines) + '\n', 1)

print('===== v89.105 第二轮（alpha 归名）%s =====' % ('【干跑】' if DRY else '【已写入】'))
print('  命中并归名的 rgba 字面量：%d 处' % stats['hit'])
print('  新派生 -rgb 三元组：%d 个 → %s' % (stats['newtok'], ' '.join(sorted(added_rgb))))
if not DRY:
    bak = os.path.join(R, '.workbuddy', 'backup', 'index.v89105-before-alias.html')
    if not os.path.exists(bak):
        io.open(bak, 'w', encoding='utf-8', newline='').write(orig)
        print('  已备份 → ' + bak)
    io.open(SRC, 'w', encoding='utf-8', newline='').write(s)
    bad = re.findall(r'var\(--[a-z0-9-]*\)-rgb\)|var\(--[a-z0-9-]+-rgb\)-rgb', s)
    print('  自检坏值：%d 处 %s · 花括号 %d/%d'
          % (len(bad), '✅' if not bad else '❌', s.count('{'), s.count('}')))
    print('已写入 ' + SRC)
else:
    print('（干跑）')
