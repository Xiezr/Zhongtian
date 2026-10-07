# -*- coding: utf-8 -*-
"""v89.227 探针 H：tone 消费 + 离地逐族值 + 测试内材料/专名占用。"""
import io, re, math, colorsys

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


# ---------- 1) tone 消费 ----------
print('========== 1) SERIES[].tone 消费面 ==========')
for f in ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/map.js', 'js/state.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if '.tone' in ln:
            print('  %s:%d  %s' % (f, i, ln.strip()[:170]))
print()

# ---------- 2) 默认主题逐族离地 ΔE00 ----------
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


print('========== 2) 默认主题逐族离地（新 4 族 vs 老 8 族）==========')
G = [0x8b, 0x9a, 0x78]
NEW = {'gov': (48, 10, 56), 'live': (24, 9, 47), 'mil': (222, 10, 46), 'ops': (172, 9, 48)}
OLD = {'gov': (45, 32, 60), 'live': (350, 26, 58), 'store': (30, 32, 40), 'edu': (165, 30, 48),
       'mil': (225, 34, 46), 'biz': (12, 34, 50), 'road': (198, 20, 62), 'recruit': (278, 28, 54)}
for tag, M in [('新', NEW), ('老', OLD)]:
    vals = []
    for k, v in M.items():
        d = de00(hsl2rgb(*v), G)
        vals.append((k, d))
    vals.sort(key=lambda x: x[1])
    print('  %s: ' % tag + '  '.join('%s=%.1f' % (k, d) for k, d in vals))
print()

# ---------- 3) 测试/工具里材料名与专名占用 ----------
print('========== 3) 测试与工具中的旧材料名/专名 ==========')
WORDS = ['羊脂玉', '昆山玉', '青玉', '织锦', '云缎', '泰坦筋', '龙筋', '蛟', '犀', '蜀', '王侯', '河石', '建木',
         '名将套', '神武套', '百炼', '藏珍阁']
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    hits = {}
    for w in WORDS:
        c = t.count(w)
        if c:
            hits[w] = c
    print('  %s: %s' % (f, hits))
print()
print('（工具目录另扫）')
import os
for root, dirs, files in os.walk(BASE + '.workbuddy/tools'):
    if 'backup' in root or 'node_modules' in root:
        continue
    for fn in files:
        if not (fn.endswith('.js') or fn.endswith('.py')):
            continue
        p = os.path.join(root, fn)
        try:
            t = io.open(p, encoding='utf-8', errors='ignore').read()
        except Exception:
            continue
        for w in ['羊脂玉', '昆山玉', '云缎', '泰坦筋']:
            if w in t and 'probe_' not in fn and 'patch_' not in fn and 'design_' not in fn and 'check_' not in fn:
                print('  %s: %s' % (p.replace(BASE, ''), w))
