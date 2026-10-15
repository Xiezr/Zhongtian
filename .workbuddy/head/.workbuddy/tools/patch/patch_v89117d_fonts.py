# -*- coding: utf-8 -*-
"""v89.117 补丁 D —— 字体体系统一：字号 / 字重 / 行高 / 角色（老板需求 3）

老板令：「字体统一设计一下，不同类型文字大小，粗细，排布等与其内容，所在界面相称」。

先量（audit_v89117_fonts.js）：
  · font-size 323 处：308 处走 7 个令牌，**12 处裸值**（26px/22px/34px/2.2em/84px/40px/20px/17px/1.6em）；
  · line-height **26 种值**（含 1.05~2 的各种小数）——"排布"这一半是散的；
  · font-weight 只有 400/700/800 三档（这点是好的，本轮把它写进判据锁住）。

改法：
  ① 补**展示级字号**令牌（大数字/图标字号此前全是裸值）：--fs-num / --isz-*（图标尺寸族）；
  ② 12 处裸字号全部归令牌；
  ③ 行高收敛为**四档**（1 / tight 1.25 / body 1.6 / loose 1.85）——
     就近归并、**平局取小**（更紧凑，且不撑高弹窗）；定高徽标那 6 处 px 行高单列为特例；
  ④ 在 :root 写一段**排版规格说明**（这就是"统一设计"的成文口径，改字先读它）。
"""
import io, os, re, sys

R = 'E:/Deepseekdb/'
p = 'index.html'
s = io.open(R + p, encoding='utf-8').read()

# ---------------------------------------------------------------- 0. 前置核对
if s.count('line-height:') == 0:
    print('!! 没读到 line-height？'); sys.exit(1)
style_end = s.rindex('</style>')
after = s[style_end:]
if 'line-height:' in after:
    print('!! <style> 之外还有 line-height（内联样式）—— 本补丁只处理样式表'); sys.exit(1)
print('  前置核对：line-height 全部在 <style> 内 ✅')

# ---------------------------------------------------------------- 1. :root 令牌补档
OLD_ROOT = """    --fs-h1: 20px;
    --fs-h2: 16px;
    --fs-h3: 13px;
    --fs-body: 13px;
    --fs-lead: 14px;
    --fs-sub: 12px;
    --fs-cap: 11px;"""
NEW_ROOT = """    --fs-h1: 20px;          /* 一级标题：整页/大地图题名 */
    --fs-h2: 16px;          /* 二级标题：弹窗题名、界面主标题（.gold-heading/.m-title） */
    --fs-lead: 14px;        /* 导语 / 按钮字：比正文大一档，用于"要看清"的行 */
    --fs-h3: 13px;          /* 三级标题：分区标题（.q-sec-t/.bag-sec…）——与正文同字号、靠字重区分 */
    --fs-body: 13px;        /* 正文：默认文字 */
    --fs-sub: 12px;         /* 次要：说明/备注/表头（备注族共享定义读它） */
    --fs-cap: 11px;         /* 极小：角标/脚注（信息密度最高的那一档） */
    /* ---- v89.117（老板「字体统一设计一下」）：**展示级数值** ----
       此前是裸值（17px 倒计时、34px 兵种图标字号…），散在样式里没有名分。
       语义：--fs-num = 行内重点数字（倒计时/大数值）；--isz-* = **元素尺寸**（emoji/SVG
       图标、头像），不是排版字号 —— 单独立族，免得后人拿字号令牌去量图标。 */
    --fs-num: 17px;         /* 重点数字（战场倒计时等） */
    --isz-xs: 20px;         /* 行内小图标（客栈头像位） */
    --isz-sm: 22px;         /* 卡片小图标（空地块 +） */
    --isz-md: 26px;         /* 标准图标（背包格 / 地块装饰 / 头像导航箭头） */
    --isz-lg: 34px;         /* 大图标（兵种卡图标位） */
    --isz-av: 40px;         /* 头像（顶栏领主） */
    --isz-av-lg: 84px;      /* 大头像（创角预览） */
    --isz-em-lg: 2.2em;     /* em 族（随容器字号缩放）：农田/器物大图标 */
    --isz-em-md: 1.6em;     /* em 族：农田种子位 */
    /* ---- v89.117：**行高四档** ----
       收敛前 26 种值（1.05~2 之间几乎每个小数都有）。口径：
         --lh-1     单行元素（图标行/进度条内文字）：一行到底
         --lh-tight 标题、列表条目、标签（13px × 1.25 ≈ 16px）
         --lh-body  正文（默认，弹窗与视图正文都走它）
         --lh-loose 长说明 / 可读性优先的段落
       特例：`line-height: 0`（2 处，压 inline-block 缝隙）与**定高徽标**的 px 行高
       （.tab-badge 16px / .bag-worn 15px / .tile-badge 17px / .sigchip 17px /
        .tax-step 20px / .sd-chip 16px / .tac-k 22px）—— 那是"垂直居中手段"不是排版节奏。 */
    --lh-1: 1;
    --lh-tight: 1.25;
    --lh-body: 1.6;
    --lh-loose: 1.85;"""
if s.count(OLD_ROOT) != 1:
    print('!! :root 锚点命中 %d 次' % s.count(OLD_ROOT)); sys.exit(1)
s = s.replace(OLD_ROOT, NEW_ROOT, 1)
print('  ✓ :root 补令牌（展示级数值 / 图标尺寸族 / 行高四档 + 成文规格）')

# ---------------------------------------------------------------- 2. 行高收敛
LH_MAP = {
    '1': '--lh-1', '1.05': '--lh-1', '1.1': '--lh-1',
    '1.15': '--lh-tight', '1.2': '--lh-tight', '1.25': '--lh-tight', '1.3': '--lh-tight',
    '1.35': '--lh-tight', '1.4': '--lh-tight',
    '1.5': '--lh-body', '1.55': '--lh-body', '1.6': '--lh-body', '1.65': '--lh-body', '1.7': '--lh-body',
    '1.75': '--lh-loose', '1.8': '--lh-loose', '1.85': '--lh-loose', '1.9': '--lh-loose',
    '1.95': '--lh-loose', '2': '--lh-loose',
}
head, tail = s[:s.index('    --lh-body: 1.6;')], s[s.index('    --lh-body: 1.6;') + len('    --lh-body: 1.6;'):]


def lh_sub(m):
    v = m.group(1)
    if v == '0':
        return m.group(0)                       # 特例：压缝隙，保留
    tok = LH_MAP.get(v)
    if not tok:
        return m.group(0)                       # px 等其它值（定高徽标）保留
    return 'line-height: var(%s)' % tok


s, n = re.subn(r'line-height:\s*([0-9.]+)(?=\s*[;}])', lh_sub, s)
print('  ✓ line-height 归并：扫描 %d 处' % n)

# ---------------------------------------------------------------- 3. 裸字号归令牌
FS_MAP = [
    ('font-size: 40px;', 'font-size: var(--isz-av);'),
    ('font-size: 84px;', 'font-size: var(--isz-av-lg);'),
    ('font-size: 34px;', 'font-size: var(--isz-lg);'),
    ('font-size: 26px;', 'font-size: var(--isz-md);'),
    ('font-size: 22px;', 'font-size: var(--isz-sm);'),
    ('font-size: 20px;', 'font-size: var(--isz-xs);'),
    ('font-size: 17px;', 'font-size: var(--fs-num);'),
    ('font-size: 2.2em;', 'font-size: var(--isz-em-lg);'),
    ('font-size: 1.6em;', 'font-size: var(--isz-em-md);'),
]
for old, new in FS_MAP:
    c = s.count(old)
    if c == 0:
        print('  ! 未找到 %r（可能格式不同）' % old)
        continue
    s = s.replace(old, new)
    print('  ✓ %s → %s（%d 处）' % (old.replace('font-size: ', '').replace(';', ''), new.split('var(')[1].split(')')[0], c))

# ---------------------------------------------------------------- 4. 数值族共享规则（补一段）
ANCHOR = "  /* ---- 标题外观共享：三层界面的标题字重/字色/字距只有一处定义 ---- */"
NUMRULE = """  /* ---- v89.117 数值族共享：**所有要竖着对齐的数字**一处定义 ----
     语义：表格数字列 / 资源读数 / 兵力数 / 倒计时 —— 等宽数字 + 700 字重。
     （原先各自写 `font-variant-numeric: tabular-nums` 的散在 20 余处；
     这条给它们一个共同基线，新增数字列直接挂 .num 或加这条选择器。） */
  .num, .tbl .num, .res-line .val, .bt-castle, .sd-cnt, .bt-ric .bt-rn {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

""" + ANCHOR
if s.count(ANCHOR) != 1:
    print('!! 数值族锚点命中 %d 次' % s.count(ANCHOR)); sys.exit(1)
s = s.replace(ANCHOR, NUMRULE, 1)
print('  ✓ 数值族共享规则')

tmp = R + p + '.tmp117d'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, R + p)
print('补丁 D 完成')
