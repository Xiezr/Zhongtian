# -*- coding: utf-8 -*-
"""v89.237b 侦察：素材元数据 + 白底结构（2×2 候选格检测）"""
import os
from PIL import Image

R = 'E:/Deepseekdb'


def meta(p):
    im = Image.open(p)
    info = dict(getattr(im, 'info', {}) or {})
    # 去掉大数据字段（icc_profile 等），只留描述类
    keep = {}
    for k, v in info.items():
        if k in ('icc_profile', 'exif'):
            continue
        s = str(v)
        keep[k] = s[:160]
    exif = {}
    try:
        ex = im.getexif()
        for k, v in dict(ex).items():
            exif[k] = str(v)[:120]
    except Exception:
        pass
    return im.format, keep, exif


print('=== A. 「兵种」元数据（前 4）===')
d = os.path.join(R, 'assets/icons/兵种')
for f in sorted(os.listdir(d))[:4]:
    fmt, info, exif = meta(os.path.join(d, f))
    print('--', f)
    print('   format:', fmt, '| info:', info)
    if exif:
        print('   exif:', list(exif.items())[:4])

print()
print('=== B. 「英雄及头像」元数据（前 3）===')
d2 = os.path.join(R, 'assets/icons/英雄及头像')
for f in sorted(os.listdir(d2))[:3]:
    fmt, info, exif = meta(os.path.join(d2, f))
    print('--', f)
    print('   format:', fmt, '| info:', info)
    if exif:
        print('   exif:', list(exif.items())[:4])

print()
print('=== C. 「兵种」白底结构检测（每张: 边缘白占比 + 中心内容占比）===')


def whiteish(px):
    return px[0] > 235 and px[1] > 235 and px[2] > 235


for f in sorted(os.listdir(d)):
    p = os.path.join(d, f)
    im = Image.open(p).convert('RGB').resize((64, 64))
    px = list(im.getdata())
    n = len(px)
    white = sum(1 for q in px if whiteish(q))
    # 四象限白占比
    quads = [0, 0, 0, 0]
    tot = [0, 0, 0, 0]
    for yy in range(64):
        for xx in range(64):
            qi = (1 if xx >= 32 else 0) + (2 if yy >= 32 else 0)
            tot[qi] += 1
            q = px[yy * 64 + xx]
            if whiteish(q):
                quads[qi] += 1
    qs = [int(quads[i] * 100 / tot[i]) for i in range(4)]
    print('%-22s 白底%3d%%  四象限白: TL%3d%% TR%3d%% BL%3d%% BR%3d%%' % (f[:22], white * 100 // n, qs[0], qs[1], qs[2], qs[3]))
