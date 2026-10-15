# -*- coding: utf-8 -*-
"""v89.226 复核：地块染色 4 主题 × 8 族 全量逐字节复验。

独立于 smoke 的实现路径（Python colorsys vs smoke 的 JS rgbOfHsl），
对 data.js 的 plot 默认 HSL 施加 v4 主题变换，与 index.html 实际值逐一比对。

v4 主题变换（由应用值反推 + 全量验证锁定）：
  default: (h, s,        l)                 —— 即 data.js plot 原值
  light:   (h, s * 0.95, min(85, l * 1.15)) —— 亮主题（silk）
  bamboo:  (h, s * 0.88, min(85, l * 1.19)) —— 青竹亮
  dark2:   (h, s * 1.00, l * 0.76)          —— 暗二（night）
用法：python .workbuddy/tools/patch/check_v89226_themes.py
"""
import io, re, colorsys

BASE = 'E:/Deepseekdb/'


def hsl2rgb(h, s, l):
    """与生成时同口径：colorsys + round（Python round = 银行家舍入）"""
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s / 100.0)
    return [round(r * 255), round(g * 255), round(b * 255)]


def hexs(c):
    return '#%02x%02x%02x' % tuple(c)


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


ds = io.open(BASE + 'js/data.js', encoding='utf-8', newline='').read()
html = io.open(BASE + 'index.html', encoding='utf-8', newline='').read()

blk = ds[ds.index('DATA.SERIES = {'):]
blk = blk[:blk.index('\n  };')]
KEYS = ['gov', 'live', 'store', 'edu', 'mil', 'biz', 'road', 'recruit']
PLOT = {}
for k in KEYS:
    m = re.search(r'^    %s:\s*\{.*?plot:\s*\{\s*h:\s*([\d.]+),\s*s:\s*([\d.]+),\s*l:\s*([\d.]+)' % k, blk, re.M)
    assert m, '解析不到 plot: %s' % k
    PLOT[k] = (float(m.group(1)), float(m.group(2)), float(m.group(3)))

# 提取 index.html 的 4 个 ser 变量块（块 = 连续两行含 --ser- 的行组）
lines = html.split('\n')
blocks = []
cur = {}
for i, ln in enumerate(lines, 1):
    found = re.findall(r'--ser-([a-z]+):\s*(#[0-9a-f]{6});', ln)
    for kk, hh in found:
        cur[kk] = hh
    if len(cur) == 8:
        blocks.append((i, dict(cur)))
        cur = {}
assert len(blocks) == 4, '期望 4 个主题块，实得 %d' % len(blocks)

THEMES = ['default', 'light', 'bamboo', 'dark2']
total_pass = total_fail = 0
for (endline, blk_map), theme in zip(blocks, THEMES):
    bad = []
    for k in KEYS:
        h, s, l = PLOT[k]
        expect = hexs(hsl2rgb(*variant(h, s, l, theme)))
        actual = blk_map.get(k, '(缺)')
        if expect != actual:
            bad.append('%s: 期望 %s 实得 %s' % (k, expect, actual))
    status = 'OK' if not bad else 'FAIL'
    print('%s  主题 %-8s（块止于 L%-4d）32 值中的 8 族' % (status, theme, endline))
    if bad:
        for b in bad:
            print('     ' + b)
    total_pass += (8 - len(bad))
    total_fail += len(bad)

print()
print('====== 合计 %d/32 对齐（%d fail）======' % (total_pass, total_fail))

# ---------- 舍入模式对比：Python round（生成时）vs JS Math.round（smoke 判据） ----------
# 若两种舍入在 32 值上有差，smoke §225③b 用 Math.round 会 ±1 假红。
import math as _math


def hsl2rgb_js(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s / 100.0)
    return [int(_math.floor(r * 255 + 0.5)), int(_math.floor(g * 255 + 0.5)), int(_math.floor(b * 255 + 0.5))]


diff_n = 0
for theme in THEMES:
    for k in KEYS:
        h, s, l = PLOT[k]
        py = hexs(hsl2rgb(*variant(h, s, l, theme)))
        js = hexs(hsl2rgb_js(*variant(h, s, l, theme)))
        if py != js:
            diff_n += 1
            print('  舍入差: %s/%s  py=%s js=%s' % (theme, k, py, js))
print('舍入模式对比：%d 处差异（0 = smoke 可用 Math.round 安全复现）' % diff_n)

if total_fail == 0:
    print('v4 变换逐值复现 → 4 主题锁定成立')
else:
    print('存在偏差 —— 需人工核')
