# -*- coding: utf-8 -*-
# v89.229 设计脚本：城内地块文字色块配色（4 族 × 4 主题）
# 目标：① 族色鲜明（老板：目前晦暗、不好区分）② 与"浅废土底色"对比够 ③ 白字可读（WCAG）
import math

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb2hsl(rgb):
    r, g, b = [v / 255 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn: return (0, 0, l)
    d = mx - mn
    s = d / (2 - mx - mn) if l > .5 else d / (mx + mn)
    if mx == r: h = (g - b) / d + (6 if g < b else 0)
    elif mx == g: h = (b - r) / d + 2
    else: h = (r - g) / d + 4
    return (h * 60, s, l)

def lum(rgb):
    def f(c):
        c = c / 255
        return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = rgb
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)

def contrast(rgb1, rgb2):
    l1, l2 = lum(rgb1), lum(rgb2)
    if l1 < l2: l1, l2 = l2, l1
    return (l1 + .05) / (l2 + .05)

# ---- CIEDE2000 ----
def de00(c1, c2):
    r1, g1, b1 = [v / 255 for v in c1]; r2, g2, b2 = [v / 255 for v in c2]
    def lin(c): return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    r1, g1, b1 = lin(r1), lin(g1), lin(b1); r2, g2, b2 = lin(r2), lin(g2), lin(b2)
    def xyz(r, g, b):
        x = r * .4124 + g * .3576 + b * .1805
        y = r * .2126 + g * .7152 + b * .0722
        z = r * .0193 + g * .1192 + b * .9505
        return x, y, z
    x1, y1, z1 = xyz(r1, g1, b1); x2, y2, z2 = xyz(r2, g2, b2)
    x1, y1, z1 = x1 / .95047, y1, z1 / 1.08883; x2, y2, z2 = x2 / .95047, y2, z2 / 1.08883
    def f(t): return t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx1, fy1, fz1 = f(x1), f(y1), f(z1); fx2, fy2, fz2 = f(x2), f(y2), f(z2)
    L1, a1, b1_ = 116 * fy1 - 16, 500 * (fx1 - fy1), 200 * (fy1 - fz1)
    L2, a2, b2_ = 116 * fy2 - 16, 500 * (fx2 - fy2), 200 * (fy2 - fz2)
    C1, C2 = math.hypot(a1, b1_), math.hypot(a2, b2_)
    Cb = (C1 + C2) / 2
    G = .5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else .5
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1_), math.hypot(a2p, b2_)
    h1p = math.degrees(math.atan2(b1_, a1p)) % 360 if (a1p or b1_) else 0
    h2p = math.degrees(math.atan2(b2_, a2p)) % 360 if (a2p or b2_) else 0
    dLp = L2 - L1
    dCp = C2p - C1p
    dhp = 0
    if C1p * C2p != 0:
        dhp = h2p - h1p
        if dhp > 180: dhp -= 360
        elif dhp < -180: dhp += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    hbp = h1p + h2p
    if C1p * C2p != 0:
        if abs(h1p - h2p) > 180: hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
        else: hbp = (h1p + h2p) / 2
    T = 1 - .17 * math.cos(math.radians(hbp - 30)) + .24 * math.cos(math.radians(2 * hbp)) + .32 * math.cos(math.radians(3 * hbp + 6)) - .20 * math.cos(math.radians(4 * hbp - 63))
    dTh = 30 * math.exp(-((hbp - 275) / 25) ** 2)
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + .015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + .045 * Cbp
    Sh = 1 + .015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))

THEMES = {
    '墨玉(默认深)': {
        'ground': '#a39b85',
        'gov': '#b18a3a', 'live': '#9c7350', 'mil': '#53679d', 'ops': '#3f8577',
    },
    '素绢(浅)': {
        'ground': '#d3ccb6',
        'gov': '#a3832e', 'live': '#8e6a46', 'mil': '#4a5c8e', 'ops': '#387368',
    },
    '青竹(浅)': {
        'ground': '#cfcab3',
        'gov': '#a5862f', 'live': '#916c48', 'mil': '#4c5f91', 'ops': '#3a776c',
    },
    '夜色(深)': {
        'ground': '#6f6957',
        'gov': '#c09b4b', 'live': '#a9825e', 'mil': '#657cae', 'ops': '#4c9486',
    },
}

KS = ['gov', 'live', 'mil', 'ops']
W = (255, 255, 255)
for th, tab in THEMES.items():
    print('### ' + th)
    g = hex2rgb(tab['ground'])
    print('  地面 %s  HSL=%s' % (tab['ground'], tuple(round(x, 2) for x in rgb2hsl(g))))
    mn, pair = 999, ''
    for i in range(len(KS)):
        for j in range(i + 1, len(KS)):
            d = de00(hex2rgb(tab[KS[i]]), hex2rgb(tab[KS[j]]))
            if d < mn: mn, pair = d, KS[i] + '/' + KS[j]
    for k in KS:
        c = hex2rgb(tab[k])
        dG = de00(c, g)
        cw = contrast(W, c)
        print('  %-5s %s  HSL=%-28s 族间min=%.1f(%s) 离地=%.1f 白字对比=%.2f' % (
            k, tab[k], tuple(round(x, 2) for x in rgb2hsl(c)), mn, pair, dG, cw))
    print('  族间最小 = %.1f (%s)' % (mn, pair))
    print()
