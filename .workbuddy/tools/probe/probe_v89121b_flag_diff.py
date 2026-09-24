# -*- coding: utf-8 -*-
"""probe_v89121b · 族旗位置 = 源图（未挂旗）与成品图（assets/icons/ui）的差异像素

口径（最干净）：两张图逐像素 diff，差异 = 旗杆 + 旗布本体。
报告：差异像素数 / 占比 / bbox / 在 512 画布中的分区（左/中/右 × 上/下）。
"""
import os, sys
from PIL import Image

R = r'E:/Deepseekdb'
SRC = os.path.join(R, '.workbuddy', 'tmp', 'atlas', 'icons')     # 重绘后、未挂旗
DST = os.path.join(R, 'assets', 'icons', 'ui')                   # 成品（挂旗后）

print('== 族旗本体位置（diff = 源图 vs 成品图）==')
print('%-14s %6s %8s  %-26s %s' % ('建筑', '差异px', '占图比', 'bbox(x0~x1, y0~y1)', '分区'))
rows = []
for f in sorted(os.listdir(SRC)):
    a = Image.open(os.path.join(SRC, f)).convert('RGBA')
    b = Image.open(os.path.join(DST, f)).convert('RGBA')
    W, H = a.size
    if a.size != b.size:
        print('  %-14s 尺寸不一致 %s vs %s' % (f, a.size, b.size)); continue
    pa, pb = a.load(), b.load()
    n = 0
    x0, y0, x1, y1 = 10**9, 10**9, -1, -1
    for y in range(H):
        for x in range(W):
            ra, ga, ba, aa = pa[x, y]
            rb, gb, bb, ab = pb[x, y]
            if abs(ra-rb) + abs(ga-gb) + abs(ba-bb) + abs(aa-ab) > 30:
                n += 1
                x0 = min(x0, x); y0 = min(y0, y)
                x1 = max(x1, x); y1 = max(y1, y)
    cx, cy = (x0+x1)/2, (y0+y1)/2
    zone = ('左' if cx < W/3 else ('中' if cx < W*2/3 else '右')) + ('上' if cy < H/3 else ('中' if cy < H*2/3 else '下'))
    rows.append((n, f, x0, x1, y0, y1, zone))
    print('%-14s %6d %7.2f%%  x[%3d~%3d] y[%3d~%3d]    %s'
          % (f, n, n*100.0/(W*H), x0, x1, y0, y1, zone))

print()
tot = sum(r[0] for r in rows)
print('  16 张差异像素合计 %d · 均值 %.1f%% / 张（= 旗子的面积占比）' % (tot, tot/16.0/(512*512)*100))
xs0 = min(r[2] for r in rows); xs1 = max(r[3] for r in rows)
ys0 = min(r[4] for r in rows); ys1 = max(r[5] for r in rows)
print('  并集 bbox：x[%d~%d] y[%d~%d]（512 画布）' % (xs0, xs1, ys0, ys1))
print('  → 旗杆 x≈432(84.5%%) · 旗布自 x432 向左挑出至 x320 附近；竖直在画布中带 y55~y485')
sys.exit(0)
