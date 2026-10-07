# -*- coding: utf-8 -*-
"""v89.227 色值调优：多候选批量评估。
目标：族间（全主题 min）≥10 · 离地（默认主题）压进 10~17 带 · S ≤ 12。
"""
import math, colorsys

def srgb2lab(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = f(c[0]), f(c[1]), f(c[2])
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    def h(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = h(x), h(y), h(z)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]

def de00(c1, c2):
    A, B = srgb2lab(c1), srgb2lab(c2)
    L1, a1, b1, L2, a2, b2 = A + B
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p + 180) % 360 - 180
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hbp = (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else ((h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))

def hsl2rgb(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s / 100.0)
    return [round(r * 255), round(g * 255), round(b * 255)]

def hexs(c):
    return '#%02x%02x%02x' % tuple(c)

THEMES = {'default': [0x8b, 0x9a, 0x78], 'light': [0xc6, 0xcb, 0xb3], 'bamboo': [0xc2, 0xcc, 0xbc], 'dark2': [0x5c, 0x6b, 0x52]}

def variant(h, s, l, theme):
    if theme == 'default':
        return (h, s, l)
    if theme == 'light':
        return (h, s * 0.95, min(85, l * 1.15))
    if theme == 'bamboo':
        return (h, s * 0.88, min(85, l * 1.19))
    if theme == 'dark2':
        return (h, s * 1.0, l * 0.76)
    return (h, s, l)

def eval_cand(name, CAND):
    mn_all = 999
    detail = []
    for theme, ground in THEMES.items():
        rendered = {k: hsl2rgb(*variant(*CAND[k], theme=theme)) for k in CAND}
        ks = list(rendered.keys())
        mn, pair = 999, ''
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                d = de00(rendered[ks[i]], rendered[ks[j]])
                if d < mn:
                    mn, pair = d, ks[i] + '/' + ks[j]
        mn_all = min(mn_all, mn)
        detail.append('%s 族间%.1f' % (theme[:3], mn))
    # 默认主题逐族离地
    g = THEMES['default']
    offs = {k: round(de00(hsl2rgb(*CAND[k]), g), 1) for k in CAND}
    print('== %s ==  全主题族间min=%.1f  %s' % (name, mn_all, ' · '.join(detail)))
    print('   默认离地: ' + '  '.join('%s=%.1f' % (k, v) for k, v in offs.items())
          + '   离地带 %.1f~%.1f' % (min(offs.values()), max(offs.values())))
    print('   默认 hex: ' + '  '.join('%s %s' % (k, hexs(hsl2rgb(*CAND[k]))) for k in CAND))

# ---- 候选表 ----
eval_cand('v4（当前冻结）', {'gov': (48, 10, 56), 'live': (24, 9, 47), 'mil': (222, 10, 46), 'ops': (172, 9, 48)})
eval_cand('v6（live 48 / mil 50）', {'gov': (48, 10, 56), 'live': (24, 9, 48), 'mil': (222, 9, 50), 'ops': (172, 9, 50)})
eval_cand('v7（live 49 / mil 51 / ops 51）', {'gov': (48, 10, 56), 'live': (24, 9, 49), 'mil': (222, 9, 51), 'ops': (172, 9, 51)})
eval_cand('v8（gov 拉亮 58 · 分离换挡）', {'gov': (50, 10, 58), 'live': (22, 9, 49), 'mil': (222, 9, 50), 'ops': (172, 9, 49)})
eval_cand('v9（gov 58 / live 48 / mil 50 / ops 50）', {'gov': (50, 10, 58), 'live': (22, 9, 48), 'mil': (222, 9, 50), 'ops': (172, 9, 50)})
eval_cand('v10（保守：只压 mil）', {'gov': (48, 10, 56), 'live': (24, 9, 47), 'mil': (222, 9, 51), 'ops': (172, 9, 48)})
