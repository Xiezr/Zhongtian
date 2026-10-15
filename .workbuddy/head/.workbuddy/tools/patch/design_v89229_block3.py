# -*- coding: utf-8 -*-
# v89.229 设计脚本 v3：色块最终矩阵（族间 ΔE00 / 离地 / 白字对比）
import math, colorsys

def hsl_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lum(rgb):
    def f(c):
        c = c / 255
        return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = rgb
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)

def contrast(c1, c2):
    l1, l2 = lum(c1), lum(c2)
    if l1 < l2: l1, l2 = l2, l1
    return (l1 + .05) / (l2 + .05)

exec(open('E:/Deepseekdb/.workbuddy/tools/patch/design_v89229_block.py', encoding='utf-8').read().split('# ---- CIEDE2000 ----')[1].split('THEMES = {')[0].replace('def de00', 'def de00', 1)) if False else None

# 复用 de00（从 v1 脚本取）
src = open('E:/Deepseekdb/.workbuddy/tools/patch/design_v89229_block.py', encoding='utf-8').read()
i = src.find('def de00')
j = src.find('THEMES = {')
ns = {'math': math}
exec(src[i:j], ns)
de00 = ns['de00']

CAND = {
    '墨玉(默认深)': {'ground': '#a39b85', 'gov': hsl_hex(45, 55, 36), 'live': hsl_hex(14, 42, 40),
                    'mil': hsl_hex(222, 40, 42), 'ops': hsl_hex(168, 40, 36)},
    '素绢(浅)':    {'ground': '#d3ccb6', 'gov': hsl_hex(45, 58, 35), 'live': hsl_hex(14, 45, 39),
                    'mil': hsl_hex(222, 42, 41), 'ops': hsl_hex(168, 42, 35)},
    '青竹(浅)':    {'ground': '#cfcab3', 'gov': hsl_hex(45, 58, 35), 'live': hsl_hex(14, 45, 39),
                    'mil': hsl_hex(222, 42, 41), 'ops': hsl_hex(168, 42, 35)},
    '夜色(深)':    {'ground': '#6f6957', 'gov': hsl_hex(45, 52, 40), 'live': hsl_hex(14, 40, 44),
                    'mil': hsl_hex(222, 38, 46), 'ops': hsl_hex(168, 38, 40)},
}
KS = ['gov', 'live', 'mil', 'ops']
for th, tab in CAND.items():
    g = hex2rgb(tab['ground'])
    print('### %s  (地面 %s)' % (th, tab['ground']))
    mn, pair = 999, ''
    for i in range(len(KS)):
        for j in range(i + 1, len(KS)):
            d = de00(hex2rgb(tab[KS[i]]), hex2rgb(tab[KS[j]]))
            if d < mn: mn, pair = d, KS[i] + '/' + KS[j]
    ok = True
    for k in KS:
        c = hex2rgb(tab[k])
        cw = contrast((255, 255, 255), c)
        dG = de00(c, g)
        bad = '' if (cw >= 4.0 and dG >= 10) else '  ← 不达标'
        if bad: ok = False
        print('  %-5s %s  白字=%.2f  离地=%.1f%s' % (k, tab[k], cw, dG, bad))
    print('  族间最小 = %.1f (%s)  %s' % (mn, pair, '✓' if (mn >= 12 and ok) else '✗'))
    print()
