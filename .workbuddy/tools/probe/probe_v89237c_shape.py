# -*- coding: utf-8 -*-
"""v89.237c 证据：素材（兵种/）与成品（ui/）的形体对应验证"""
import os
from PIL import Image


def bbox_nonwhite(p, thr=235):
    im = Image.open(p).convert('RGB')
    w, h = im.size
    im = im.resize((128, 128))
    px = list(im.getdata())
    xs, ys = [], []
    for y in range(128):
        for x in range(128):
            q = px[y * 128 + x]
            if not (q[0] > thr and q[1] > thr and q[2] > thr):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def bbox_alpha(p):
    im = Image.open(p).convert('RGBA')
    im = im.resize((128, 128))
    al = list(im.split()[3].getdata())
    xs, ys = [], []
    for y in range(128):
        for x in range(128):
            if al[y * 128 + x] > 96:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


R = 'E:/Deepseekdb'
print('=== 素材（兵种/）主体 bbox 比例 vs 成品（ui/）不透明 bbox 比例 ===')
PAIRS = [
    ('11 电磁盾卫.jpeg', 'ai_dianci.png'),
    ('13 轰炸机.png', 'ai_wuren.png'),
]
for src, dst in PAIRS:
    b1 = bbox_nonwhite(os.path.join(R, 'assets/icons/兵种', src))
    b2 = bbox_alpha(os.path.join(R, 'assets/icons/ui', dst))
    if b1 and b2:
        w1, h1 = b1[2] - b1[0], b1[3] - b1[1]
        w2, h2 = b2[2] - b2[0], b2[3] - b2[1]
        print('%-20s 主体 %dx%d (宽高比 %.2f)  ←→  %-14s %dx%d (宽高比 %.2f)'
              % (src, w1, h1, w1 / max(1, h1), dst, w2, h2, w2 / max(1, h2)))
    else:
        print(src, '→ bbox 失败', b1, b2)

print()
print('=== 全部 14 成品在册复核 ===')
IDS = ['banche', 'fujiche', 'zhencha', 'yunshu', 'buxingji', 'dunwei', 'daodanche',
       'wuzhi', 'zhuzhan', 'kuanglie', 'dianci', 'huopao', 'wuren', 'taitan']
ok = 0
for i in IDS:
    if os.path.exists(os.path.join(R, 'assets/icons/ui', 'ai_%s.png' % i)):
        ok += 1
print('成品 %d/14 在 ui/' % ok)
