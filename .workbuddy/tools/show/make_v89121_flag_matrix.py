# -*- coding: utf-8 -*-
"""v89121 · 七族旗色对照图（回答"图标上的旗是什么"）

每族取一张代表建筑（挂旗后的成品图），缩放到 140 见方横排，
下方标注：族名 · 建筑名 · 旗色名 · 色值。顶部标题。
输出：.workbuddy/shots/v89121-族旗对照.png
"""
import io, os, re, sys
from PIL import Image, ImageDraw, ImageFont

R = r'E:/Deepseekdb'
UI = os.path.join(R, 'assets', 'icons', 'ui')
OUT = os.path.join(R, '.workbuddy', 'shots', 'v89121-族旗对照.png')

# 从 data.js 读族表（唯一来源）
src = io.open(os.path.join(R, 'js', 'data.js'), encoding='utf-8').read()
SB = src[src.index('DATA.SERIES = {'):]
SB = SB[:SB.index('\n  };')]
SER = {}
for line in SB.split('\n'):
    m = re.match(r"^    ([a-z]+):\s*\{ name: '([^']+)', tone: '([^']+)'.*?flag:\s*\{\s*h:\s*([\d.]+),\s*s:\s*([\d.]+),\s*l:\s*([\d.]+)", line)
    if m:
        SER[m.group(1)] = dict(name=m.group(2), tone=m.group(3),
                               h=float(m.group(4)), s=float(m.group(5)), l=float(m.group(6)))

import colorsys
def hsl_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s)
    return '#%02x%02x%02x' % (round(r*255), round(g*255), round(b*255))

# 每族代表建筑
REP = [('gov', 'guanfu', '官署·官府'), ('live', 'minfang', '民居·民房'),
       ('store', 'cangku', '仓廪·仓库'), ('edu', 'shuyuan', '文教·书院'),
       ('mil', 'junying', '军事·军营'), ('biz', 'shichang', '工商·市场'),
       ('road', 'yizhan', '驿传·驿站')]

CELL, PAD, TOP, BOT = 168, 14, 64, 84
W = PAD + len(REP) * (CELL + PAD)
H = TOP + CELL + BOT
im = Image.new('RGB', (W, H), (28, 32, 40))
d = ImageDraw.Draw(im)

FP = 'C:/Windows/Fonts/msyh.ttc'
F1 = ImageFont.truetype(FP, 26)
F2 = ImageFont.truetype(FP, 17)
F3 = ImageFont.truetype(FP, 15)
d.text((W/2, 22), '城内建筑图标上的“族旗”—— 七族七色，一眼分门别类', font=F1, fill=(232, 226, 210), anchor='mm')

for i, (sid, bid, label) in enumerate(REP):
    x = PAD + i * (CELL + PAD)
    src_img = os.path.join(UI, 'ai_%s.png' % bid)
    ic = Image.open(src_img).convert('RGBA').resize((CELL, CELL), Image.LANCZOS)
    im.paste(ic, (x, TOP), ic)
    d.rectangle([x, TOP, x + CELL - 1, TOP + CELL - 1], outline=(90, 96, 110), width=1)
    c = hsl_hex(SER[sid]['h'], SER[sid]['s'], SER[sid]['l'])
    cx = x + CELL // 2
    d.text((cx, TOP + CELL + 12), SER[sid]['name'], font=F2, fill=(235, 228, 210), anchor='mt')
    d.text((cx, TOP + CELL + 34), label.split('·')[1], font=F3, fill=(165, 170, 180), anchor='mt')
    d.rectangle([cx - 46, TOP + CELL + 54, cx - 32, TOP + CELL + 68], fill=c, outline=(120, 124, 134))
    d.text((cx - 24, TOP + CELL + 61), SER[sid]['tone'].split('·')[-1].strip(), font=F3, fill=(200, 204, 214), anchor='lm')

im.save(OUT)
print('已出图 → %s（%dx%d）' % (OUT, W, H))
for sid, bid, label in REP:
    f = SER[sid]
    print('  %-6s %-4s 旗 %s  h%3d s%.2f l%.0f' % (f['name'], label.split('·')[1], hsl_hex(f['h'], f['s'], f['l']), f['h'], f['s'], f['l']))
sys.exit(0)
