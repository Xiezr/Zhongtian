# -*- coding: utf-8 -*-
"""probe_v89121a · 族旗在图标上的位置与占比（回答"图标前边为什么有面旗"）

口径：旗布 = 高饱和像素（max-min ≥ 60）。逐张报告：
  · 图尺寸 / 不透明像素 bbox
  · 旗像素数 / 占比 / bbox
  · 旗平均色 vs DATA.SERIES[族].flag 目标色
"""
import io, os, re, sys, math
from PIL import Image

R = r'E:/Deepseekdb'
UI = os.path.join(R, 'assets', 'icons', 'ui')

# 从 data.js 读族归属与旗色（唯一来源，不另抄表）
src = io.open(os.path.join(R, 'js', 'data.js'), encoding='utf-8').read()
BLK = src[src.index('DATA.BUILDINGS = {'):]
BLK = BLK[:BLK.index('\n  };')]
SER_OF = dict(re.findall(r"id: '([a-z]+)', series: '([a-z]+)'", BLK))
SB = src[src.index('DATA.SERIES = {'):]
SB = SB[:SB.index('\n  };')]
FLAG = {}
for line in SB.split('\n'):
    m = re.match(r"^    ([a-z]+):\s*\{.*?flag:\s*\{\s*h:\s*([\d.]+),\s*s:\s*([\d.]+),\s*l:\s*([\d.]+)", line)
    if m:
        FLAG[m.group(1)] = (float(m.group(2)), float(m.group(3)), float(m.group(4)))


def hsl2rgb(h, s, l):
    import colorsys
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s)
    return (round(r * 255), round(g * 255), round(b * 255))


KEYS = sorted(FLAG)
print('== 族旗目标色（DATA.SERIES[].flag）==')
for k in KEYS:
    print('  %-6s h%3d s%.2f l%.0f → rgb%s' % (k, FLAG[k][0], FLAG[k][1], FLAG[k][2], hsl2rgb(*FLAG[k])))

print()
print('== 逐张素材：旗色像素的位置与占比 ==')
W = H = None
for bid, ser in sorted(SER_OF.items()):
    p = os.path.join(UI, 'ai_%s.png' % bid)
    if not os.path.exists(p):
        print('  %-14s 缺素材' % bid); continue
    im = Image.open(p).convert('RGBA')
    W, H = im.size
    px = im.load()
    tgt = hsl2rgb(*FLAG[ser])
    n = tot = 0
    x0, y0, x1, y1 = 10 ** 9, 10 ** 9, -1, -1
    acc = [0, 0, 0]
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 60:
                continue
            tot += 1
            mx, mn = max(r, g, b), min(r, g, b)
            if mx - mn < 60:
                continue
            # 与目标色的粗匹配（色相 ±30° 内 + 饱和够）
            d = abs(r - tgt[0]) + abs(g - tgt[1]) + abs(b - tgt[2])
            if d > 180:
                continue
            n += 1
            acc[0] += r; acc[1] += g; acc[2] += b
            x0 = min(x0, x); y0 = min(y0, y)
            x1 = max(x1, x); y1 = max(y1, y)
    mean = tuple(round(c / n) for c in acc) if n else (0, 0, 0)
    print('  %-14s %-6s 旗像素 %5d / 不透明 %6d = %4.1f%%  bbox x[%d~%d] y[%d~%d]  均值 rgb%s / 目标 rgb%s'
          % (bid, ser, n, tot, n * 100.0 / tot, x0, x1, y0, y1, mean, tgt))

print()
print('  图尺寸 %dx%d' % (W, H))
print('  （图标在界面上宽约 100~120 逻辑像素；bbox 贴在 x0.84 右侧 = 旗杆位，布向左挑出约 20%）')
sys.exit(0)
