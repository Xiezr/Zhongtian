# -*- coding: utf-8 -*-
"""v89.233 批 4（工具面·货币「金」）：活工具与历史脚本的叙述/输出层"金"→"旧币"。

含三类工具正确性修复（正则与产品日志对齐）：
  · analyze_600.py  '售出 X 得金 Y' 解析正则 （产品已是"得旧币"）→ 不换则市场分析假 0；
  · analyze_rush*.js 同款；
  · 各分析表头 | 金 |、'累计卖金' 等输出文字。
保护 = 颜色/专名语境（金像素/金带/金丹/改元金/金/面板/红金绿三态等）。
用法：python patch_v89233h_tooljin.py [--apply]
"""
import io, os, re, sys

ROOT = 'E:/Deepseekdb/.workbuddy/tools/'
APPLY = '--apply' in sys.argv
DIRS = ['audit', 'gen', 'play', 'playtest', 'show', 'asset']
SKIP_FILES = {'show/shot_v89228_rename.js'}   # 换代记录（"黄金→旧币"对照行）
# 前缀排除：asset/check_* 全系列为"像素体检"脚本（其"金"= 金色像素计数，非货币）
SKIP_PREFIX = ['asset/check_']

PROTECT = [
    '黄金', '旧币', '金蝉', '金殿', '金创', '金鳞', '金光', '金色', '金框', '金边', '金叉',
    '金印', '金头', '金杆', '金匾', '金线', '金实', '亮金', '暖金', '暗金', '土金', '深金',
    '浅金', '柔金', '金点', '金方', '金底', '金甲', '金瓦', '金穗', '金饰', '金笔', '金贵',
    '合金', '鎏金', '金属', '冶金', '金滩', '金垒', '金刚', '古钱币', '金币', '金琉璃',
    # 工具面特有（颜色 / 专名）
    '金像素', '金带', '金丹', '改元金', '金/面板', '金/绿', '红/金', '金 / 绿', '红 / 金',
    '主题金', '墨/金', '金/橙', '金/暖', '金=增量', '值、金',
]

files = []
for d in DIRS:
    p = ROOT + d
    if not os.path.isdir(p):
        continue
    for f in sorted(os.listdir(p)):
        if f.endswith(('.js', '.py')):
            files.append(d + '/' + f)

tot = 0
for rel in files:
    if rel in SKIP_FILES or any(rel.startswith(x) for x in SKIP_PREFIX):
        continue
    p = ROOT + rel
    s = io.open(p, encoding='utf-8', newline='').read()
    s0 = s
    # 掩码 → 全替 → 解掩码
    slots = []
    for i, w in enumerate(PROTECT):
        if w in s:
            tok = '\x01J%02d\x01' % i
            s = s.replace(w, tok)
            slots.append((tok, w))
    s = s.replace('金', '旧币')
    for tok, w in slots:
        s = s.replace(tok, w)
    if s == s0:
        continue
    a, b = s0.split('\n'), s.split('\n')
    n = 0
    for i in range(max(len(a), len(b))):
        la = a[i] if i < len(a) else ''
        lb = b[i] if i < len(b) else ''
        if la != lb:
            n += 1
            if not APPLY:
                print(rel)
                print('  - ' + la.strip()[:150])
                print('  + ' + lb.strip()[:150])
            tot += 1
    if APPLY and n:
        io.open(p, 'w', encoding='utf-8', newline='').write(s)

print('== %s：合计 %d 行 ==' % ('APPLY' if APPLY else 'DRY', tot))
