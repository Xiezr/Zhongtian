# -*- coding: utf-8 -*-
"""
v89.105 基调统一 · CSS 令牌迁移
============================================================
老板两条令：① 全功能链路复核 ② 基调统一（界面/弹窗好看、内容紧凑有序、
间隔尽量固定而内容有序填充）。这是第 ② 条的**工程实现**。

设计原则（三条，按优先级）
------------------------------------------------------------
1. **零视觉变化优先**：字面值恰好等于某一档令牌时，只把字面值换成令牌引用
   （`padding: 8px` → `padding: var(--sp-3)`）—— 同一个数，但从此只有一个来源。
2. **同族归并**：同一语义（列表条目）若用了 5/7/8 三种纵向内缩，就是"间隔不固定"
   的病根；按**就近并档（平局取小）**归到标尺上。
3. **不碰既有令牌的值**：`--sp-1..6`（4/6/8/10/14/18）与 `--r-sm..xl`（4/6/8/10）
   的**值**一律不动（smoke 有断言锁死，且它们的引用面很大）——
   只**补**标尺缺的档（1/2/12/24px、2px 圆角），于是并档时不必牺牲任何高频值。

标尺（迁移后）
------------------------------------------------------------
间距 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 18 / 24
圆角 2 / 4 / 6 / 8 / 10
"""
import io, os, re, sys, json

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(R, 'index.html')
DRY = '--apply' not in sys.argv

s = io.open(SRC, encoding='utf-8').read()
orig = s
report = {}

# ============================================================
# 0. 新令牌（补标尺缺档 + 色彩/渐变单一来源）
# ============================================================
NEW_TOKENS = """
    /* ============================================================
     * v89.105（老板「基调统一 · 间隔尽量固定」）—— 标尺补档
     * ------------------------------------------------------------
     * 改前实测：间距在 26 种 px 值上分叉（3/5/7/9/11px 共 117 处）、
     * 圆角 13 种（3/4/5/6/7/8/9/10/11/12px）——同一层级的留白与转角各写各的，
     * 整屏看起来"间隔不固定"。
     * 本段**只补缺档、不动既有值**：--sp-1..6（4/6/8/10/14/18）与
     * --r-sm..xl（4/6/8/10）保持原值（引用面大、且被测试锁死）。
     *   · --sp-hair 1px / --sp-0 2px：发丝级内缩（角标、极紧凑芯片）
     *   · --sp-mid 12px：10↔14 之间的中档 —— 它是实装里**第四高频**的间距
     *     （字面 12px 出现 38 次），此前没有令牌，所以各处自己写 12px
     *   · --sp-7 24px：段落级（区块之间）
     *   · --r-xs 2px：微圆角（小标签/进度条）
     * ============================================================ */
    --sp-hair: 1px; --sp-0: 2px; --sp-mid: 12px; --sp-7: 24px;
    --r-xs: 2px;

    /* 浅金/柔金（与 --gold-light 同族的 alpha 合成基色）：
       实装里 rgba(232,206,136,α) 出现 9 处的裸值，集中到一处 */
    --gold-soft-rgb: 232,206,136;

    /* 彩底上的字：唯一一处纯白（按钮文字压在青/红/紫底上时才用） */
    --on-accent: #fff;

    /* 渐变（同类渐变只此一份；各处此前各写一份字面量） */
    --grad-progress: linear-gradient(90deg, #7ee08a, #4fbf6a);   /* 进度条（绿） */
    --grad-exp: linear-gradient(90deg, #6f8f3e, #c9d96a);        /* 经验条（黄绿） */
    --grad-gold: linear-gradient(180deg, #e8ce88, #c9a24b);      /* 金色选中面 */
    --grad-gold-deep: linear-gradient(180deg,#e8c878,#9a7430);   /* 金色加号钮 */
    --grad-dim: linear-gradient(180deg, #5a5648, #454236);       /* 灰化按钮面 */

    /* 青钮的暗部（边框 / 底部投影）——与 --teal 同族的两个固定档 */
    --teal-deep: #1c4539; --teal-shade: #15332a;
    /* 深底阶：近黑衬底（头像底 / 浮层底 / 小地图底） */
    --slab-0: #10141a;
    /* 深红（红钮的底与边） */
    --red-deep: #5c1a10;
"""

anchor = "    /* 圆角阶梯 */\n    --r-sm: 4px; --r-md: 6px; --r-lg: 8px; --r-xl: 10px;\n"
assert anchor in s, '锚点：圆角阶梯未找到'
s = s.replace(anchor, anchor + NEW_TOKENS, 1)
report['newTokens'] = 'inserted'

# ============================================================
# 1. 间距并档表（就近，平局取小）
# ============================================================
SP_SNAP = {
    '1': '--sp-hair', '2': '--sp-0',
    '3': '--sp-1', '4': '--sp-1', '5': '--sp-1',
    '6': '--sp-2', '7': '--sp-2',
    '8': '--sp-3', '9': '--sp-3',
    '10': '--sp-4', '11': '--sp-4',
    '12': '--sp-mid', '13': '--sp-mid',
    '14': '--sp-5', '15': '--sp-5', '16': '--sp-5', '17': '--sp-6',
    '18': '--sp-6', '19': '--sp-6', '20': '--sp-6',
    '21': '--sp-7', '22': '--sp-7', '23': '--sp-7', '24': '--sp-7',
    '25': '--sp-7', '26': '--sp-7', '27': '--sp-7', '28': '--sp-7',
}
RD_SNAP = {
    '1': '--r-xs', '2': '--r-xs', '3': '--r-sm', '4': '--r-sm',
    '5': '--r-md', '6': '--r-md', '7': '--r-md',
    '8': '--r-lg', '9': '--r-lg',
    '10': '--r-xl', '11': '--r-xl', '12': '--r-xl',
}
SP_PROPS = ('padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
            'gap', 'row-gap', 'column-gap')
RD_PROPS = ('border-radius', 'border-top-left-radius', 'border-top-right-radius',
            'border-bottom-left-radius', 'border-bottom-right-radius')

def snap_val(prop, val, table, val_re):
    """把一个声明的值按 table 并档；返回 (新值, 改动数)"""
    n = [0]
    if 'var(' in val or 'calc(' in val:
        return val, 0
    def rep(mm):
        num = mm.group(1)
        if num in table:
            n[0] += 1
            return 'var(' + table[num] + ')'
        return mm.group(0)
    new = re.sub(val_re, rep, val)
    return new, n[0]

PX_RE = re.compile(r'(-?[\d.]+)px')

# 逐声明替换（CSS 一行一条规则；属性名以 -- 开头的自定义属性不在白名单内，天然跳过）
DECL_RE = re.compile(r'([a-zA-Z-]+)\s*:\s*([^;}]+)([;}])')

def fix_line(line, stats):
    def fix(mm):
        prop, val, tail = mm.group(1), mm.group(2), mm.group(3)
        if prop in SP_PROPS:
            nv, c = snap_val(prop, val, SP_SNAP, PX_RE)
            if c:
                stats['sp'] += c
                stats['sp_sites'] += 1
                stats['sp_map'][prop] = stats['sp_map'].get(prop, 0) + c
                return prop + ': ' + nv + tail
        elif prop in RD_PROPS:
            nv, c = snap_val(prop, val, RD_SNAP, PX_RE)
            if c:
                stats['rd'] += c
                stats['rd_sites'] += 1
                return prop + ': ' + nv + tail
        return mm.group(0)
    return DECL_RE.sub(fix, line)

# ============================================================
# 2. 颜色映射
# ============================================================
TRIPLET = [
    (r'rgba\(\s*201\s*,\s*162\s*,\s*75\s*,', 'rgba(var(--gold-rgb),'),
    (r'rgba\(\s*232\s*,\s*206\s*,\s*136\s*,', 'rgba(var(--gold-soft-rgb),'),
    (r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,', 'rgba(var(--hl-rgb),'),
    (r'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,', 'rgba(var(--sh-rgb),'),
]
STRMAP = [
    # 长串优先（渐变里含 hex，必须先替）
    ('linear-gradient(90deg, #7ee08a, #4fbf6a)', 'var(--grad-progress)'),
    ('linear-gradient(90deg,#7ee08a,#4fbf6a)', 'var(--grad-progress)'),
    ('linear-gradient(180deg, #e8ce88, #c9a24b)', 'var(--grad-gold)'),
    ('linear-gradient(180deg,#e8c878,#9a7430)', 'var(--grad-gold-deep)'),
    ('linear-gradient(90deg, #6f8f3e, #c9d96a)', 'var(--grad-exp)'),
    ('linear-gradient(90deg,#6f8f3e,#c9d96a)', 'var(--grad-exp)'),
    ('linear-gradient(180deg, #5a5648, #454236)', 'var(--grad-dim)'),
]
# 单色：**必须带边界**替换 —— 实测 #fff 会吃掉 #fff3cf（暖米色）的尾巴，
# 生成 `var(--on-accent)3cf` 这种语法正确的垃圾。8 位 hex 同理。
SUFFIX_HEX = [('#c9a24b', 'rgb(var(--gold-rgb))'),
              ('#fff', 'var(--on-accent)'),
              ('#ffffff', 'var(--on-accent)'),
              ('#1c4539', 'var(--teal-deep)'),
              ('#15332a', 'var(--teal-shade)'),
              ('#b8412f', 'var(--tag-war)'),
              ('#10160c', 'var(--slab-0)'),
              ('#0b0e12', 'var(--slab-0)'),
              ('#12110c', 'var(--slab-0)'),
              ('#2b2b20', 'var(--slab-1)'),
              ('#2f2c23', 'var(--slab-1)'),
              ('#5c1a10', 'var(--red-deep)'),
              ('#000', 'rgb(var(--sh-rgb))')]

def fix_color_line(line, stats):
    before = line
    for pat, to in TRIPLET:
        line, k = re.subn(pat, to, line)
        stats['c'] += k
        stats['c_trip'] += k
    for a, b in STRMAP:
        if a in line:
            k = line.count(a)
            line = line.replace(a, b)
            stats['c'] += k
            stats['c_str'] += k
    for a, b in SUFFIX_HEX:
        pat = re.escape(a) + r'(?![0-9a-fA-F])'
        line, k = re.subn(pat, b.replace('\\', '\\\\'), line)
        if k:
            stats['c'] += k
            stats['c_str'] += k
    if line != before:
        stats['c_sites'] += 1
    return line

# ============================================================
# 3. 只处理 <style> 段
# ============================================================
stats = {'sp': 0, 'sp_sites': 0, 'sp_map': {}, 'rd': 0, 'rd_sites': 0,
         'c': 0, 'c_trip': 0, 'c_str': 0, 'c_sites': 0}
parts = re.split(r'(<style>|</style>)', s)
out = []
in_style = False
for p in parts:
    if p == '<style>':
        in_style = True
        out.append(p)
        continue
    if p == '</style>':
        in_style = False
        out.append(p)
        continue
    if in_style:
        lines = p.split('\n')
        out.append('\n'.join(fix_color_line(fix_line(ln, stats), stats) for ln in lines))
    else:
        out.append(p)
s = ''.join(out)
report['style_touched'] = True

# ============================================================
# 4. 报告
# ============================================================
print('===== v89.105 令牌迁移 %s =====' % ('【干跑】' if DRY else '【已写入】'))
print('  间距：改 %d 处（涉及 %d 条声明）' % (stats['sp'], stats['sp_sites']))
print('    按属性：' + json.dumps(stats['sp_map'], ensure_ascii=False))
print('  圆角：改 %d 处（%d 条声明）' % (stats['rd'], stats['rd_sites']))
print('  颜色：改 %d 处（%d 条声明；三元组 %d · 映射表 %d）'
      % (stats['c'], stats['c_sites'], stats['c_trip'], stats['c_str']))

# 残余裸色（未覆盖的）
resid = []
for ln in re.findall(r'[^;{}]+:[^;{}]+[;}]', s):
    if re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d', ln) and 'var(' not in ln:
        resid.append(ln.strip()[:88])
print('  残余裸色声明：%d 条' % len(resid))
for r0 in resid[:12]:
    print('    ' + r0)

if DRY:
    print('\n（干跑：未写盘。加 --apply 落地）')
else:
    # ① 备份原档（可回滚；本项目规矩：老东西备份不删）
    bak_dir = os.path.join(R, '.workbuddy', 'backup')
    if not os.path.isdir(bak_dir):
        os.makedirs(bak_dir)
    bak = os.path.join(bak_dir, 'index.v89105-before-tokens.html')
    if not os.path.exists(bak):
        io.open(bak, 'w', encoding='utf-8', newline='').write(orig)
        print('\n已备份原档 → ' + bak)
    io.open(SRC, 'w', encoding='utf-8', newline='').write(s)

    # ② 自检：坏值模式（替换吃掉 hex 尾巴的痕迹）+ 括号配平
    bad = []
    for pat in [r'var\(--on-accent\)[0-9a-fA-F]', r'var\(--[a-z-]+\)[0-9a-fA-F]{2,}',
                r'rgb\(var\(--[a-z-]+\)\)[0-9a-fA-F]', r'var\(--sp-[a-z0-9]+\)\d+px',
                r'var\(--r-[a-z]+\)\d+px']:
        for mm in re.finditer(pat, s):
            bad.append(mm.group(0))
    ob, cb = s.count('{'), s.count('}')
    print('  自检：坏值 %d 处 · 花括号 %d/%d %s'
          % (len(bad), ob, cb, '✅' if (not bad and ob == cb) else '❌'))
    for b0 in bad[:8]:
        print('    ' + b0)
    print('已写入 ' + SRC)
