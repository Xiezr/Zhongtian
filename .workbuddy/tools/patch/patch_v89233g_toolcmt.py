# -*- coding: utf-8 -*-
"""v89.233 批 4（工具面）：活工具 + 历史实机脚本的注释/输出文字旧词清理。

范围 = audit/gen/play/playtest/show/asset 六目录（.js/.py），行级替换（注释与输出文字一起）。
保留面（SKIP）：换代记录行（shot_v89228 的"黄金→旧币 · 人口→幸存者"）、
analyze_600 的迁移映射注、shot_v89132 的"义兵/长枪兵"组合断言（映射后重复 → 保留原貌）。
用法：python patch_v89233g_toolcmt.py [--apply]
"""
import io, os, sys

ROOT = 'E:/Deepseekdb/.workbuddy/tools/'
APPLY = '--apply' in sys.argv
DIRS = ['audit', 'gen', 'play', 'playtest', 'show', 'asset']
MAP = [
    ('人口', '幸存者'),
    ('民房', '居所'),
    ('客栈', '酒馆'),
    ('校场', '练兵场'),
    ('城墙', '围墙'),
    ('长枪→', '步行机→'),
    ('轻骑兵', '伏击车'),
    ('轻骑', '伏击车'),
    ('长枪兵', '步行机'),
    ('义兵', '步行机'),
    ('床弩', '无人轰炸机'),
    ('冲车', '自行火炮'),
    ('投石车', '自行火炮'),
    ('农田', '净化厂'),
    ('粮食', '净水'),
    ('黄金', '旧币'),
]
# 整文件保留（换代记录 / 迁移注 / 词表判据 / 生成器数据 / 造局素材）
SKIP_FILES = {
    'show/shot_v89228_rename.js',       # 换代验证记录（"黄金→旧币"对照行）
    'playtest/analyze_600.py',          # 入侵损失迁移注（映射记录）
    'audit/audit_v89214_namescan.py',   # 词表判据（扫描工具的数据面）
    'audit/check_v89214_risk.py',       # 风险词表（判据数据）
    'audit/verify_v66_edits.py',        # v66 时代的一次验证脚本（史档）
    'gen/gen_v8950_content.js',         # 生成器数据映射（RN 表）
    'show/diag_v89202_scout.js',        # 造局素材（假数据"兵种/建筑清单"）
    'show/shot_v89202_gates.js',        # 同上（造局素材）
}
# 行级保留（映射后重复的组合断言）
SKIP_LINE_MARKS = [
    "t.indexOf('义兵') >= 0 && t.indexOf('长枪兵') >= 0",
    "wRows:(h.match(/义兵|长枪兵|弓箭手/g)",
    "hasTroop:/义兵/.test(h)&&/长枪兵/.test(h)",
]

files = []
for d in DIRS:
    p = ROOT + d
    if not os.path.isdir(p):
        continue
    for f in sorted(os.listdir(p)):
        if f.endswith(('.js', '.py')):
            files.append(d + '/' + f)

changed_lines = 0
changed_files = 0
for rel in files:
    if rel in SKIP_FILES:
        continue
    p = ROOT + rel
    s = io.open(p, encoding='utf-8', newline='').read()
    lines = s.split('\n')
    out = []
    hit_any = False
    for ln in lines:
        if any(m in ln for m in SKIP_LINE_MARKS):
            out.append(ln)
            continue
        nln = ln
        for a, b in MAP:
            if a in nln:
                nln = nln.replace(a, b)
        if nln != ln:
            hit_any = True
            changed_lines += 1
            if not APPLY:
                print('%s' % rel)
                print('  - ' + ln.strip()[:150])
                print('  + ' + nln.strip()[:150])
        out.append(nln)
    if hit_any:
        changed_files += 1
        if APPLY:
            io.open(p, 'w', encoding='utf-8', newline='').write('\n'.join(out))

print('== %s：%d 文件 · %d 行 ==' % ('APPLY' if APPLY else 'DRY', changed_files, changed_lines))
