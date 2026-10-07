# -*- coding: utf-8 -*-
"""v89.233 批 1：货币「金」→「旧币」统一 —— dry-run / apply

策略：保护词先掩码（\x01P{i}\x01），再把货币义的「金」全域替换为「旧币」，最后解掩码。
保护词 = 非货币义的「金」组合（专名/成语/材质/颜色/地名）。
用法：
    python patch_v89233a_jin.py          # dry-run：只输出 diff 预览
    python patch_v89233a_jin.py --apply  # 落盘
"""
import io, os, re, sys

R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv

FILES = ['js/data.js', 'js/ui.js', 'js/main.js', 'js/systems.js', 'js/domain.js',
         'js/state.js', 'js/battle.js', 'js/story.js', 'js/questdata.js', 'js/map.js',
         'js/tactic.js', 'js/icons.js', 'index.html']

# ---- 保护词（非货币义的「金」）----
PROTECT = [
    # 专名 / 成语 / 实物
    '金蝉脱壳', '金殿', '金创', '金印', '金声', '金银', '千金', '金玉',
    '黄金', '鸣金', '金城',
    # 材质 / 其它
    '合金', '鎏金', '金属', '冶金', '古钱币', '金币', '金琉璃',
    # 颜色 / 视觉词
    '金色', '金光', '金鳞', '金框', '金边', '金叉', '金头', '金杆', '金匾',
    '金线', '金实', '亮金', '暖金', '暗金', '土金', '深金', '浅金', '柔金',
    '金点', '金方', '金底', '金甲', '金瓦', '金穗', '金饰', '金笔', '金增量',
    '悬停金', '琥珀金', '主题金', '点金', '城池金', 'info 金', '金/火',
    '（金）', '中枢 · 金',
    # 地名 / 人名
    '金滩', '金垒', '金刚',
    # 形容词 / 通用词（现代汉语复合词，不含货币单字）
    '金贵', '金额', '资金', '税金',
    # 视觉语境里的颜色单字「金」（括号内颜色对）
    ' / 金）', '金/青', '金/朱', '金/绿',
]

MAP = [
    ("gold: '金'", "gold: '币'"),     # RES_NAME 单字简称：金 → 币（两字排不下既定单字族）
    ("'</b> 金　·　现存旧币 <b>'", "'</b> 旧币　·　现存 <b>'"),   # 去重复（"旧币·现存旧币"）
    ("真金入账", "真币入账"),          # "真金"= 真钱 —— 术语对齐
    ("**玄金不入搬运**", "**旧币不入搬运**"),   # 陈年强调词，术语对齐
]


def mask(s):
    slots = []
    for i, w in enumerate(PROTECT):
        if w in s:
            tok = '\x01P%02d\x01' % i
            s = s.replace(w, tok)
            slots.append((tok, w))
    return s, slots


def unmask(s, slots):
    for tok, w in slots:
        s = s.replace(tok, w)
    return s


def run(p, dry):
    s = io.open(R + p, encoding='utf-8', newline='').read()
    s0 = s
    for a, b in MAP:
        s = s.replace(a, b)
    s, slots = mask(s)
    n = s.count('金')
    s = s.replace('金', '旧币')
    s = unmask(s, slots)
    if s == s0:
        print('%-22s [skip] 无替换' % p)
        return 0
    # 输出仅含变化行的 diff
    a = s0.split('\n')
    b = s.split('\n')
    changed = 0
    for i in range(max(len(a), len(b))):
        la = a[i] if i < len(a) else ''
        lb = b[i] if i < len(b) else ''
        if la != lb:
            changed += 1
            if dry:
                print('%s:%d' % (p, i + 1))
                print('  - ' + la.strip()[:160])
                print('  + ' + lb.strip()[:160])
    print('%-22s [%s] 金x%d → 变化行 %d' % (p, 'DRY' if dry else 'APPLY', n, changed))
    if not dry:
        io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
    return changed


tot = 0
for p in FILES:
    tot += run(p, not APPLY)
print('== 合计变化行 %d ==' % tot)
