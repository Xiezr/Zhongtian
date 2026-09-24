# -*- coding: utf-8 -*-
"""v89121 清点辅助：noShop 物品的"额外引用"审查（找真断链嫌疑）

口径：下架物品（noShop: true）若全仓出现 <=1 次（只有定义行），
则它既不在商城、也不在任何数据表里 —— 产出渠道嫌疑。
"""
import re, io, glob, sys

s = io.open('js/data.js', encoding='utf-8').read()
pat = re.compile(r"id:\s*'([a-z_0-9]+)'[^{}]*?noShop:\s*true", re.S)
rest = []
for m in pat.finditer(s):
    seg = m.group(0)
    if len(seg) < 400:
        rest.append(m.group(1))
rest = sorted(set(rest))
print('noShop 物品共 %d 个' % len(rest))
print()

files = sorted(glob.glob('js/*.js'))
code = {f: io.open(f, encoding='utf-8').read() for f in files}

zero, some = [], []
for k in rest:
    tot = 0
    where = []
    for f in files:
        n = len(re.findall(r'(^|[^A-Za-z0-9_])' + re.escape(k) + r'($|[^A-Za-z0-9_])', code[f]))
        if n:
            tot += n
            where.append(f.replace('js\\', '') + 'x' + str(n))
    if tot <= 1:
        zero.append(k)
        print('  [零额外引用] %-24s 出现%d' % (k, tot))
    else:
        some.append(k)
        print('  %-14s 出现%-3d %s' % (k, tot, ' '.join(where)))

print()
print('零额外引用（真断链嫌疑）= %d：' % len(zero))
for k in zero:
    print('   ', k)
print()
print('有额外引用（需人工看在哪）= %d' % len(some))
sys.exit(0)
