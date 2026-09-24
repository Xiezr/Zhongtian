# -*- coding: utf-8 -*-
"""v89121：产出渠道全扫描 —— 找出"任务/逸闻/奇遇/游历"等表里给了哪些物品 id，
并与"下架零引用"清单比对（哪些下架物品真的没有任何渠道）。"""
import re, io, glob, sys

# 全仓找 rw.item / item: 'x' / reward 里的物品名
files = sorted(glob.glob('js/*.js'))
code = {f: io.open(f, encoding='utf-8').read() for f in files}

print('== 所有 item: XXX 形态（任务/逸闻/奇遇奖励）==')
seen = {}
for f in files:
    for m in re.finditer(r"item:\s*'([a-zA-Z_0-9]+)'", code[f]):
        seen.setdefault(m.group(1), []).append(f.replace('js\\', ''))
for k in sorted(seen):
    print('  %-22s %s' % (k, ' '.join(sorted(set(seen[k])))))

print()
print('== 所有 "count:" 与 "item" 同现的奖励块（抽样）==')
for f in files:
    for m in re.finditer(r"\{[^{}]*item:\s*'([a-zA-Z_0-9]+)'[^{}]*\}", code[f]):
        print('  %s: %s' % (f.replace('js\\', ''), m.group(0)[:120]))

print()
print('== DATA.SEED_DROP / 种子掉落表 ==')
m = re.search(r'DATA\.SEED_DROP\s*=.*?\n  \};', code['js/data.js'], re.S) or \
    re.search(r'SEED_DROP\s*=.*?\n  \};', code['js/data.js'], re.S)
if m:
    print(m.group(0)[:800])
else:
    print('（未找到 SEED_DROP 表）')

print()
print('== LING_ACT 奖励里的物品（win.give / drop）==')
blk = code['js/data.js']
i = blk.find('DATA.LING_ACT = {')
if i >= 0:
    seg = blk[i:i+8000]
    for m in re.finditer(r"(give|item|drop|material|ess):\s*[^,\n}]+", seg):
        print('  ' + m.group(0)[:100])
sys.exit(0)
