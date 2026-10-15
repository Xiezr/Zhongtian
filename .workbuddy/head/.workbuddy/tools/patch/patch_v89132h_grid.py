# -*- coding: utf-8 -*-
"""v89.132 补丁 H：军务处两列被撑偏的修复（实机量测抓出）
实测（diag_v89132_grid.js / diag2.js）：
  · 列宽 1098 : 272（应为 685 : 685）；
  · 元凶 = camp-card 行内兵种图标 svg.ico **无尺寸约束** → res-line scroll=1072（撑爆）；
  · minmax(0,1fr) 是必要配套（防 min-content 撑列）。
修：
  ① grid-template-columns: minmax(0,1fr) ×2；
  ② .camp-card 行内图标定尺寸（同 .eq-ico .ico 的既有教训）；
  ③ .camp-card .res-line .lbl 可收缩（min-width:0 + nowrap+ellipsis 防溢出）。
跑：python .workbuddy/tools/patch/patch_v89132h_grid.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

html = rd('index.html')

old = (
    "  .camp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); align-items: start; }\n"
    "  .camp-card {\n"
    "    background: linear-gradient(180deg, rgba(var(--gold-rgb), .10), rgba(var(--sh-rgb), .18));\n"
    "    border: 1px solid rgba(var(--gold-rgb), .30);\n"
    "    border-radius: var(--r-lg);\n"
    "    padding: var(--sp-4);\n"
    "  }\n"
)
new = (
    "  /* ⚠️ 必须是 minmax(0,1fr) 而不是 1fr：1fr = minmax(auto,1fr)，列的 min-content\n"
    "     会把另一列挤扁（实测 1098:272）。实测根因见下条「行内图标定尺寸」。 */\n"
    "  .camp-cards { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--sp-4); align-items: start; }\n"
    "  .camp-card {\n"
    "    background: linear-gradient(180deg, rgba(var(--gold-rgb), .10), rgba(var(--sh-rgb), .18));\n"
    "    border: 1px solid rgba(var(--gold-rgb), .30);\n"
    "    border-radius: var(--r-lg);\n"
    "    padding: var(--sp-4);\n"
    "    min-width: 0;\n"
    "  }\n"
    "  /* v89.132（实测坑）：camp-card 行内兵种图标 svg.ico 无尺寸约束 → 按固有尺寸渲染，\n"
    "     把 res-line 撑到 1072px（两列被带成 1098:272）。与本仓既有教训同族\n"
    "     （index.html「`.eq-ico .ico{width/height:100%}` 尤其关键：少了它，位图会按固有尺寸」）。 */\n"
    "  .camp-card .res-line .lbl .ico { width: 1.15em; height: 1.15em; vertical-align: -0.18em; }\n"
    "  .camp-card .res-line .lbl { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n"
    "  .camp-card .res-line .val { flex: none; }\n"
)
html = rep1(html, old, new, '军务处 grid + 图标尺寸')
assert html.count('.camp-cards { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);') == 1
assert html.count('.camp-card .res-line .lbl .ico {') == 1
wr('index.html', html)
print('OK · index.html', len(html))
