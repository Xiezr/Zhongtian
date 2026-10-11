# -*- coding: utf-8 -*-
"""v90.19：四主题重设计 —— 保留令牌角色，只换色值（每主题一套完整调色板）。"""
import re

SRC = r"E:/Deepseekdb/index.html"

# 墨玉（:root）= 玄墨青玉：深青玉底 + 暖金
INK = {
 'bg-dark': '#1c2126', 'panel-bg': '#232a30', 'bg-2': '#252c33', 'bg-3': '#181d22',
 'wood': '#333c43', 'wood-light': '#46525a', 'wood-dark': '#1f262c',
 'gold': '#c9ab66', 'gold-light': '#e4d29c', 'gold-dark': '#786034',
 'text': '#dae4e6', 'text-dim': '#8a969a', 'text-strong': '#eef4f4', 'text-dark': '#1a2024',
 'green-ok': '#7fb08a', 'blue-info': '#86a8c0',
 'parchment': '#ece6d6', 'parchment-dark': '#d0c6ac',
 'teal': '#3e6b5e', 'teal-light': '#4f8574',
 'red': '#b05a4c', 'red-light': '#c68a80',
 'gold-rgb': '201,171,102', 'sh-rgb': '0,0,0', 'hl-rgb': '214,228,230',
 'scrim': 'rgba(0,0,0,.62)',
 'line': 'rgba(var(--hl-rgb),.10)', 'line-strong': 'rgba(var(--hl-rgb),.16)',
 'sep-gold': 'rgba(var(--gold-rgb),.28)',
 'ground': '#a8a08b', 'ground-busy': '#a09580',
 'hero-tag': '#d8b45c', 'beauty-tag': '#d88aa8', 'beauty': '#d88aa8',
 'wonder': '#9a7ad0', 'wonder-rgb': '154,122,208',
}
# 素绢 = 暖绢：暖米白底 + 铜金
SILK = {
 'bg-dark': '#e6e0d3', 'bg-2': '#ded8c9', 'bg-3': '#d6cfbe', 'panel-bg': '#f4efe4',
 'wood': '#9a7f56', 'wood-light': '#b89a70', 'wood-dark': '#6f5a3c',
 'gold': '#8a6f2a', 'gold-light': '#a8863c', 'gold-dark': '#5e4a1e',
 'text': '#3a342c', 'text-dim': '#726a5c', 'text-strong': '#2a251e', 'text-dark': '#2a251e',
 'green-ok': '#4e7a48', 'blue-info': '#4e6f80',
 'parchment': '#faf6ec', 'parchment-dark': '#e4dac4',
 'red': '#9c4a38', 'red-light': '#843e30',
 'gold-rgb': '138,111,42', 'sh-rgb': '92,76,48', 'hl-rgb': '88,72,44',
 'scrim': 'rgba(70,58,36,.42)',
 'line': 'rgba(var(--hl-rgb),.16)', 'line-strong': 'rgba(var(--hl-rgb),.28)',
 'sep-gold': 'rgba(var(--gold-rgb),.30)',
 'ground': '#d8ccb0', 'ground-busy': '#d0c3a4',
 'hero-tag': '#966c00', 'beauty-tag': '#96436a', 'beauty': '#96436a',
 'wonder': '#7a53b8', 'wonder-rgb': '122,83,184',
}
# 青竹 = 竹青：冷青绿浅底 + 竹绿
BAMBOO = {
 'bg-dark': '#dfe4d7', 'bg-2': '#d7ddcd', 'bg-3': '#ccd3c1', 'panel-bg': '#eff3e7',
 'wood': '#7f6f52', 'wood-light': '#9a8a6c', 'wood-dark': '#5c4f38',
 'gold': '#6f7a2e', 'gold-light': '#8a9440', 'gold-dark': '#4c5420',
 'text': '#2e3828', 'text-dim': '#586450', 'text-strong': '#1f281a', 'text-dark': '#1f281a',
 'green-ok': '#3e7a3a', 'blue-info': '#3e6f74',
 'parchment': '#f4f7ec', 'parchment-dark': '#dce4cf',
 'red': '#944237', 'red-light': '#7e3a30',
 'gold-rgb': '111,122,46', 'sh-rgb': '72,80,58', 'hl-rgb': '64,76,52',
 'scrim': 'rgba(60,70,48,.42)',
 'line': 'rgba(var(--hl-rgb),.18)', 'line-strong': 'rgba(var(--hl-rgb),.30)',
 'sep-gold': 'rgba(var(--gold-rgb),.32)',
 'ground': '#d0d8bc', 'ground-busy': '#c8d0b2',
 'hero-tag': '#7d6c14', 'beauty-tag': '#96436a', 'beauty': '#96436a',
 'wonder': '#6f4aa8', 'wonder-rgb': '111,74,168',
}
# 夜阑 = 夜阑深蓝：靛蓝近黑 + 冷蓝
NIGHT = {
 'bg-dark': '#0a0e14', 'bg-2': '#0e131b', 'bg-3': '#080b10', 'panel-bg': '#141a22',
 'wood': '#1e2832', 'wood-light': '#2c3a48', 'wood-dark': '#131a22',
 'gold': '#7ea6d8', 'gold-light': '#a6c6ec', 'gold-dark': '#3d5a80',
 'text': '#d0dae4', 'text-dim': '#7a8894', 'text-strong': '#e4ecf4', 'text-dark': '#0e131b',
 'green-ok': '#6aa88a', 'blue-info': '#6a9ad0',
 'parchment': '#d8e0ea', 'parchment-dark': '#b0bccb',
 'red': '#a05848', 'red-light': '#b88078',
 'gold-rgb': '126,166,216', 'sh-rgb': '0,0,0', 'hl-rgb': '180,200,220',
 'scrim': 'rgba(0,0,0,.72)',
 'line': 'rgba(var(--hl-rgb),.07)', 'line-strong': 'rgba(var(--hl-rgb),.12)',
 'sep-gold': 'rgba(var(--gold-rgb),.24)',
 'ground': '#5a6270', 'ground-busy': '#545c6a',
 'hero-tag': '#9ac0e8', 'beauty-tag': '#c08ab8', 'beauty': '#c08ab8',
 'wonder': '#8a7ad0', 'wonder-rgb': '138,122,208',
}

s = open(SRC, encoding='utf-8').read()

def replace_in_range(text, start_marker, end_marker, pal):
    i = text.index(start_marker)
    j = text.index('\n  }', i)
    block = text[i:j]
    for tok, val in pal.items():
        block = re.sub(r'(--' + re.escape(tok) + r'\s*:\s*)[^;]+;', r'\g<1>' + val + ';', block)
    return text[:i] + block + text[j:]

# :root (墨玉) — 从 ':root {' 到其结尾 '}'
s = replace_in_range(s, '  :root {', None, INK)
for theme, pal in [('silk', SILK), ('bamboo', BAMBOO), ('night', NIGHT)]:
    marker = '  html[data-theme="%s"] {' % theme
    s = replace_in_range(s, marker, None, pal)

open(SRC, 'w', encoding='utf-8', newline='').write(s)
print('四主题调色板已重设计')
