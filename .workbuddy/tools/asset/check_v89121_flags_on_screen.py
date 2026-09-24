# -*- coding: utf-8 -*-
"""v89121 · 实机截图里的族旗可见性：找高饱和像素簇（旗布）+ 报告颜色与位置"""
import os, sys, math
from PIL import Image
from collections import defaultdict

R = r'E:/Deepseekdb'
SHOTS = os.path.join(R, '.workbuddy', 'shots')

def scan(name):
    p = os.path.join(SHOTS, name)
    if not os.path.exists(p):
        print('缺 ' + name); return
    im = Image.open(p).convert('RGB')
    W, H = im.size
    px = im.load()
    buckets = defaultdict(lambda: [0, 10**9, 10**9, -1, -1])
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx - mn < 60 or mx < 90:
                continue
            # 粗分桶（色相 30° 一档）
            h = math.degrees(math.atan2(math.sqrt(3) * (g - b), 2 * r - g - b)) % 360
            k = int(h // 30) * 30
            bk = buckets[k]
            bk[0] += 1
            bk[1] = min(bk[1], x); bk[2] = min(bk[2], y)
            bk[3] = max(bk[3], x); bk[4] = max(bk[4], y)
    print('== %s（%dx%d）高饱和像素簇（旗布所在）==' % (name, W, H))
    tot = sum(v[0] for v in buckets.values())
    for k in sorted(buckets, key=lambda a: -buckets[a][0]):
        v = buckets[k]
        if v[0] < 40:
            continue
        print('  色相 %3d°~%3d°：%6d px  bbox x[%d~%d] y[%d~%d]' % (k, k + 30, v[0], v[1], v[3], v[2], v[4]))
    print('  合计 %d px（占图 %.2f%%）' % (tot, tot * 100.0 / (W * H)))

for n in ['v89121-city-closeup.png', 'v89121-city-all.png']:
    scan(n)
    print()
sys.exit(0)
