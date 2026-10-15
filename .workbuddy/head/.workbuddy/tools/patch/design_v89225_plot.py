# -*- coding: utf-8 -*-
"""v89.225 地块色设计 · ΔE00 矩阵实测（**v1 草稿** —— 保留作迭代起点）
8 族 = gov/biz/store/live/edu/road/mil/recruit；4 主题各有一版渲染色。
先跑 v1 候选，看矩阵数值再调。

⛔ v89.226 复核标注：本文件停在 v1 候选（live 78° / store 28° 等）——
   **最终落地值不在本文件**。准绳 = js/data.js `DATA.SERIES[].plot`（默认主题 HSL）
   + index.html `--ser-*`（4 主题 hex）；主题变换 = light(s×0.95/l×1.15cap85) /
   bamboo(s×0.88/l×1.19cap85) / dark2(l×0.76)，已由 smoke §225③/③b 逐字节锁定
   （复核复现脚本：.workbuddy/tools/patch/check_v89226_themes.py · 32/32）。"""
import math, colorsys

# ---------- 颜色数学（与项目同口径：CIEDE2000，sRGB→Lab） ----------
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

# ---------- 4 主题地面 ----------
THEMES = {
    'default': [0x8b, 0x9a, 0x78],   # 暗（默认）
    'light':   [0xc6, 0xcb, 0xb3],   # 亮
    'bamboo':  [0xc2, 0xcc, 0xbc],   # 青竹亮
    'dark2':   [0x5c, 0x6b, 0x52],   # 暗二
}

# ---------- v1 候选：8 族"默认主题"目标 HSL ----------
# 设计意图：贴地柔和（S 20~34 / L 44~70），色相尽量散开、避开地面绿带（60~130）
CAND = {
    'gov':     (45,  32, 60),   # 政务 · 金
    'biz':     (12,  34, 50),   # 工商 · 朱
    'store':   (28,  30, 42),   # 仓储 · 赭（偏暗）
    'live':    (78,  16, 72),   # 居住 · 沙米（低饱和偏亮）——78° 贴绿带边缘，试
    'edu':     (165, 30, 45),   # 文教 · 青
    'road':    (198, 20, 62),   # 交通 · 青灰
    'mil':     (225, 34, 46),   # 军事 · 靛
    'recruit': (278, 28, 54),   # 招募 · 紫
}

# 主题变换规则（由默认主题派生；原型先跑，后校准）
def variant(h, s, l, theme):
    if theme == 'default':
        return (h, s, l)
    if theme == 'light':
        return (h, s * 0.72, min(86, l * 1.24))
    if theme == 'bamboo':
        return (h, s * 0.68, min(86, l * 1.26))
    if theme == 'dark2':
        return (h, s * 1.0, l * 0.74)
    return (h, s, l)

print('========== v1 候选矩阵 ==========')
for theme, ground in THEMES.items():
    print()
    print('### 主题 %s（地面 %s）###' % (theme, hexs(ground)))
    rendered = {}
    for k, (h, s, l) in CAND.items():
        h2, s2, l2 = variant(h, s, l, theme)
        rendered[k] = hsl2rgb(h2, s2, l2)
    # 族间矩阵
    ks = list(rendered.keys())
    mn, pair, bad = 999, '', []
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            d = de00(rendered[ks[i]], rendered[ks[j]])
            if d < mn:
                mn, pair = d, ks[i] + '/' + ks[j]
            if d < 8:
                bad.append('%s/%s=%.1f' % (ks[i], ks[j], d))
    print('  族间最小 ΔE00 = %.1f（%s）%s' % (mn, pair, ('  ⚠ ' + ' '.join(bad)) if bad else '  ✓'))
    # 离地
    mnG, who = 999, ''
    for k in ks:
        d = de00(rendered[k], ground)
        if d < mnG:
            mnG, who = d, k
    print('  离地最小 ΔE00 = %.1f（%s）' % (mnG, who))
    # 输出色值
    row = '  '
    for k in ks:
        h2, s2, l2 = variant(*CAND[k], theme=theme)
        row += '%s %s(%.0f/%0.f/%.0f)  ' % (k, hexs(rendered[k]), h2, s2, l2)
    print(row)

# 详细：默认主题两两矩阵
print()
print('### 默认主题 族间 ΔE00 全矩阵 ###')
ks = list(CAND.keys())
rm = {k: hsl2rgb(*variant(*CAND[k], theme='default')) for k in ks}
print('        ' + '  '.join('%-7s' % k for k in ks))
for a in ks:
    line = '%-7s ' % a
    for b in ks:
        line += '%-7.1f ' % (0 if a == b else de00(rm[a], rm[b]))
    print(line)
