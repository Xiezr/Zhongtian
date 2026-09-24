# -*- coding: utf-8 -*-
"""
v89.105 修复（v2）：令牌自引用 —— 含**第一轮新加的令牌**
============================================================
v1 只认"原档已有的令牌"，而 `--on-accent` / `--grad-*` / `--teal-deep` /
`--teal-shade` / `--red-deep` 是第一轮**新加**的，不在原档表里 → 漏修。
本版用显式修复表（值就是第一轮 NEW_TOKENS 里写的原值）补齐。
"""
import io, os, re

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(R, 'index.html')
cur = io.open(SRC, encoding='utf-8').read()

FIX = {
    'on-accent': '#fff',
    'grad-progress': 'linear-gradient(90deg, #7ee08a, #4fbf6a)',
    'grad-exp': 'linear-gradient(90deg, #6f8f3e, #c9d96a)',
    'grad-gold': 'linear-gradient(180deg, #e8ce88, #c9a24b)',
    'grad-gold-deep': 'linear-gradient(180deg,#e8c878,#9a7430)',
    'grad-dim': 'linear-gradient(180deg, #5a5648, #454236)',
    'teal-deep': '#1c4539',
    'teal-shade': '#15332a',
    'red-deep': '#5c1a10',
    'slab-0': '#10141a',
}
done = []
def fix(mm):
    name = mm.group(1)
    v = FIX.get(name)
    if v is not None and mm.group(0).find('var(--%s)' % name) >= 0:
        done.append(name)
        return '    --%s: %s;' % (name, v)
    return mm.group(0)

cur2 = re.sub(r'[ \t]*--([a-z0-9-]+)\s*:\s*var\(--\1\)\s*;', fix, cur)
print('修复 %d 处：%s' % (len(done), ' '.join(done)))

# 复查：还有没有自引用（含未列入 FIX 的）
left = re.findall(r'--([a-z0-9-]+)\s*:\s*var\(--\1\)', cur2)
print('残留自引用：%d 处 %s' % (len(left), ' '.join(left)))

# 顺带查"前向/环形引用"：A 引用 B，B 引用 A（一轮替换可能造出来）
tok = dict(re.findall(r'--([a-z0-9-]+)\s*:\s*([^;]+);', cur2))
cyc = []
for k, v in tok.items():
    mm = re.search(r'var\(--([a-z0-9-]+)\)', v)
    if mm and mm.group(1) in tok:
        v2 = tok[mm.group(1)]
        mm2 = re.search(r'var\(--([a-z0-9-]+)\)', v2)
        if mm2 and mm2.group(1) == k:
            cyc.append('%s ⇄ %s' % (k, mm.group(1)))
print('环形引用：%d 处 %s' % (len(cyc), ' '.join(cyc)))

if done and cur2.count('{') == cur2.count('}'):
    io.open(SRC, 'w', encoding='utf-8', newline='').write(cur2)
    print('已写入（括号配平 ✅）')
else:
    print('未写入')
