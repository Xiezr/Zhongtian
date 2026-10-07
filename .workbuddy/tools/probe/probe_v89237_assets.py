# -*- coding: utf-8 -*-
"""v89.237 侦察：assets 素材内容程序化统计（本机读不了图，用像素统计当眼睛）"""
import os
from PIL import Image


def stat(p):
    im = Image.open(p)
    w, h = im.size
    im2 = im.convert('RGB').resize((40, 40))
    px = list(im2.getdata())
    n = len(px)
    r = sum(p2[0] for p2 in px) / n
    g = sum(p2[1] for p2 in px) / n
    b = sum(p2[2] for p2 in px) / n
    mid = sum(1 for p2 in px if 30 < (p2[0] + p2[1] + p2[2]) / 3 < 225)
    # 色散：主色相分布粗估（色相档计数）
    return w, h, (r, g, b), mid * 100 // n


R = 'E:/Deepseekdb'

print('=== A. 「英雄及头像」全量 38 张（前十 + 后五）===')
d = os.path.join(R, 'assets/icons/英雄及头像')
fs = sorted(os.listdir(d))
for f in fs[:10] + fs[-5:]:
    try:
        w, h, c, mid = stat(os.path.join(d, f))
        print('%-28s %5dx%-5d 均色(%3d,%3d,%3d) 中间调%2d%%' % (f[:28], w, h, c[0], c[1], c[2], mid))
    except Exception as e:
        print(f[:28], 'ERR', e)

print()
print('=== B. 「兵种」全量 13 张 ===')
d2 = os.path.join(R, 'assets/icons/兵种')
for f in sorted(os.listdir(d2)):
    try:
        w, h, c, mid = stat(os.path.join(d2, f))
        print('%-28s %5dx%-5d 均色(%3d,%3d,%3d) 中间调%2d%%' % (f[:28], w, h, c[0], c[1], c[2], mid))
    except Exception as e:
        print(f[:28], 'ERR', e)

print()
print('=== C. ui/ 新兵种图（16:39 产出）对照 ===')
for f in ['ai_dianci.png', 'ai_wuren.png', 'ai_banche.png', 'ai_buxingji.png']:
    p = os.path.join(R, 'assets/icons/ui', f)
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    al = im.split()[3].resize((40, 40))
    op = sum(1 for a in list(al.getdata()) if a > 128)
    print('%-16s %4dx%-4d 不透明占比%2d%%' % (f, w, h, op * 100 // 1600))

print()
print('=== D. raw/ 4 张现状 ===')
d3 = os.path.join(R, 'assets/icons/raw')
for f in sorted(os.listdir(d3)):
    try:
        w, h, c, mid = stat(os.path.join(d3, f))
        print('%-28s %5dx%-5d 均色(%3d,%3d,%3d) 中间调%2d%%' % (f[:28], w, h, c[0], c[1], c[2], mid))
    except Exception as e:
        print(f[:28], 'ERR', e)
