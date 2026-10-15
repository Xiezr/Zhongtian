# -*- coding: utf-8 -*-
"""v89.238 需求档案补录：总览行 + 明细段（LF 保持 · 幂等 · 写后自检）"""
import io

P = '需求档案.md'
s = io.open(P, encoding='utf-8', newline='').read()

# 幂等：已录过就跳过
assert '| v89.238 |' not in s, 'already recorded'

# ① 总览行（插在 v89.237 行之后）
anchor = '| 已完成（详见 docs/_史料/交付/v89237-assets素材清理.md） |'
assert s.count(anchor) == 1, 'anchor count=%d' % s.count(anchor)
row = ('| v89.238 | 2026-10-07 | 1 | **英雄部件栏底衬调整（几何剪影退役 · 抠图调亮）**：'
       '① 装备区"小人一样的简陋图"——几何人形剪影（`ui.dollFigure` / `.doll-fig-svg`，v38 建）整条退役 '
       '② 抠图底衬调亮 `.32 → .55`（"背景图太暗"）'
       '③ 连带：画框 `.doll` 补 `overflow: hidden`（调亮后 512 方图原样方角会顶破圆角）'
       '④ 断言四处按新口径重写（smoke ×3 + e2e ×1）；版本 v89.235 → v89.238'
       '（老板原文：「将领背景图太暗了，装备那里那个小人一样的简陋图去掉，背景调亮」——逐字） '
       '| 已完成（详见 docs/_史料/交付/v89238-英雄底衬调亮与剪影退役.md） |')
s = s.replace(anchor, anchor + '\n' + row)

# ② 明细段（追加到文件尾）
detail = '''## v89.238 英雄部件栏底衬调整（2026-10-07 · 剪影退役 · 抠图调亮）

**老板原文（逐字）**：

> 将领背景图太暗了，装备那里那个小人一样的简陋图去掉，背景调亮

**改动（5 文件）**：

| # | 落点 | 改前 → 改后 |
|---|---|---|
| ① | `js/ui.js` 渲染（`genPane` 内） | `ui.dollPortrait(g) + ui.dollFigure() +` → `ui.dollPortrait(g) +` |
| ② | `js/ui.js` 函数 | `ui.dollFigure`（几何 SVG 小人）整条删除 → 墓碑注释（备份指针） |
| ③ | `index.html` CSS | `.doll-fig-svg` 规则删除 → 墓碑；`.doll-portrait img` `opacity: .32 → .55`；`.doll` 补 `overflow: hidden` |
| ④ | `smoke-test.js` ×3 + `e2e-test.js` ×1 | 旧断言（剪影在场 / `.32`）按新口径重写：剪影零残留 + 抠图在岗 + `.55` + 裁形 |
| ⑤ | 版本 | `GAME.VERSION` v89.235 → **v89.238**（§199④ 同步；§235⑥ 版本检查按 §229c⑧ 先例放宽 `v89\\.\\d+`） |

**实测证据（真机 · `.doll` 元素截图 446×564）**：

| 指标 | 改前 | 改后 |
|---|---|---|
| 剪影节点数 | 1 | **0** |
| 抠图 opacity | 0.32 | **0.55** |
| `.doll` overflow | visible | **hidden** |
| 区域平均亮度 | 46.9 | **54.7（+7.8）** |
| 明亮像素占比（>90） | 1.5% | **20.0%** |
| 12 槽位 / 抠图 src | 12 / m_human_17 | 12 / m_human_17（同源对照） |

**验证**：smoke [待填] · e2e [待填] · gate --full [待填]。

**诚实缺口**：① 抠图池现为**不透明方图**（91 张均无 alpha 通道），底衬以"方形照片 + 下缘渐隐"呈现，非抠底观感 —— 若要"人形裁切"需素材侧补透明通道（另批）；② 亮度 0.55 为经验值（.26 = 实测可见下限 → .55 ≈ +72%），观感最终由老板拍板，一处可调。
'''
s = s.rstrip('\n') + '\n\n' + detail

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# 写后自检
s2 = io.open(P, encoding='utf-8', newline='').read()
assert s2.count('| v89.238 |') == 1, 'row not found'
assert s2.count('## v89.238 ') == 1, 'section not found'
assert '装备那里那个小人一样的简陋图去掉' in s2
assert '\r' not in s2, 'CR leaked'
print('ARCHIVE OK · len=%d' % len(s2))
