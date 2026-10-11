# -*- coding: utf-8 -*-
"""v90.21：四主题改用**公认配色**（非自创）——只换色值，保留令牌角色。
  墨玉=Gruvbox Dark · 夜阑=Tokyo Night · 素绢=Gruvbox Light · 青竹=Everforest Light。"""
import re
SRC = r"E:/Deepseekdb/index.html"

# Gruvbox Dark (墨玉 · 暖深) — bg-hard/bg/bg1, fg, yellow, red, green, blue, purple, aqua
INK = {
 'bg-dark': '#1d2021', 'bg-2': '#3c3836', 'bg-3': '#1d2021', 'panel-bg': '#282828',
 'wood': '#3c3836', 'wood-light': '#504945', 'wood-dark': '#282828',
 'gold': '#d79921', 'gold-light': '#fabd2f', 'gold-dark': '#7c5d10',
 'text': '#ebdbb2', 'text-dim': '#a89984', 'text-strong': '#fbf1c7', 'text-dark': '#282828',
 'green-ok': '#98971a', 'blue-info': '#458588',
 'red': '#cc241d', 'red-light': '#fb4934',
 'gold-rgb': '215,153,33', 'sh-rgb': '0,0,0', 'hl-rgb': '255,255,255',
 'scrim': 'rgba(0,0,0,.62)',
 'line': 'rgba(168,153,132,.18)', 'line-strong': 'rgba(168,153,132,.28)',
 'sep-gold': 'rgba(215,153,33,.28)',
 'ground': '#a8a08b', 'ground-busy': '#a09580',
 'parchment': '#fbf1c7', 'parchment-dark': '#d5c4a1',
}
# Tokyo Night (夜阑 · 冷深) — bg/bg_dark/highlight, fg, blue, purple, cyan, red
NIGHT = {
 'bg-dark': '#16161e', 'bg-2': '#1f2335', 'bg-3': '#16161e', 'panel-bg': '#1a1b26',
 'wood': '#292e42', 'wood-light': '#3b4261', 'wood-dark': '#16161e',
 'gold': '#7aa2f7', 'gold-light': '#7dcfff', 'gold-dark': '#3d59a1',
 'text': '#c0caf5', 'text-dim': '#565f89', 'text-strong': '#c0caf5', 'text-dark': '#16161e',
 'green-ok': '#9ece6a', 'blue-info': '#7dcfff',
 'red': '#f7768e', 'red-light': '#ff7a93',
 'gold-rgb': '122,162,247', 'sh-rgb': '0,0,0', 'hl-rgb': '192,202,245',
 'scrim': 'rgba(0,0,0,.72)',
 'line': 'rgba(192,202,245,.10)', 'line-strong': 'rgba(192,202,245,.16)',
 'sep-gold': 'rgba(122,162,247,.28)',
 'ground': '#6f6957', 'ground-busy': '#6a6352',
}
# Gruvbox Light (素绢 · 暖浅) — bg #fbf1c7, fg #3c3836, darker yellow
SILK = {
 'bg-dark': '#ebdbb2', 'bg-2': '#e0d8b0', 'bg-3': '#d5c4a1', 'panel-bg': '#fbf1c7',
 'wood': '#a89984', 'wood-light': '#bdae93', 'wood-dark': '#7c6f64',
 'gold': '#b57614', 'gold-light': '#d79921', 'gold-dark': '#8f6711',
 'text': '#3c3836', 'text-dim': '#7c6f64', 'text-strong': '#282828', 'text-dark': '#282828',
 'green-ok': '#79740e', 'blue-info': '#076678',
 'red': '#9d0006', 'red-light': '#cc241d',
 'gold-rgb': '181,118,20', 'sh-rgb': '60,56,54', 'hl-rgb': '60,56,54',
 'scrim': 'rgba(60,56,54,.42)',
 'line': 'rgba(60,56,54,.16)', 'line-strong': 'rgba(60,56,54,.28)',
 'sep-gold': 'rgba(181,118,20,.30)',
 'ground': '#d3ccb6', 'ground-busy': '#cdc3ae',
 'parchment': '#fbf1c7', 'parchment-dark': '#e0d8b0',
}
# Everforest Light (青竹 · 自然绿) — bg #fdf6e3, fg #5c6a72, green #8da101
BAMBOO = {
 'bg-dark': '#efebd4', 'bg-2': '#e6e2cc', 'bg-3': '#ddd8c0', 'panel-bg': '#fdf6e3',
 'wood': '#859289', 'wood-light': '#9da9a0', 'wood-dark': '#5c6a72',
 'gold': '#8da101', 'gold-light': '#a7c080', 'gold-dark': '#6c7a00',
 'text': '#5c6a72', 'text-dim': '#829181', 'text-strong': '#475258', 'text-dark': '#3a515d',
 'green-ok': '#8da101', 'blue-info': '#3a94c5',
 'red': '#f85552', 'red-light': '#e66868',
 'gold-rgb': '141,161,1', 'sh-rgb': '92,106,114', 'hl-rgb': '92,106,114',
 'scrim': 'rgba(92,106,114,.42)',
 'line': 'rgba(92,106,114,.18)', 'line-strong': 'rgba(92,106,114,.30)',
 'sep-gold': 'rgba(141,161,1,.32)',
 'ground': '#cfcab3', 'ground-busy': '#c9c4ad',
 'parchment': '#fdf6e3', 'parchment-dark': '#efebd4',
}

s = open(SRC, encoding='utf-8').read()
def repl(text, marker, pal):
    i = text.index(marker)
    j = text.index('\n  }', i)
    block = text[i:j]
    for tok, val in pal.items():
        block = re.sub(r'(--' + re.escape(tok) + r'\s*:\s*)[^;]+;', r'\g<1>' + val + ';', block)
    return text[:i] + block + text[j:]

s = repl(s, '  :root {', INK)
for th, pal in [('silk', SILK), ('bamboo', BAMBOO), ('night', NIGHT)]:
    s = repl(s, '  html[data-theme="%s"] {' % th, pal)
open(SRC, 'w', encoding='utf-8', newline='').write(s)
print('四主题已改用公认配色（Gruvbox Dark / Tokyo Night / Gruvbox Light / Everforest Light）')
