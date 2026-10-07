# -*- coding: utf-8 -*-
# v89.229 批 a2：data.js —— SERIES plot 更新（新色块色）+ 注释沿革
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'js/data.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()
def rep(s, old, new, tag, cnt=1):
    c = s.count(old)
    assert c == cnt, '[%s] count=%d' % (tag, c)
    return s.replace(old, new)

s = rd(); s0 = s

# ---------- ① 注释块：v89.227 段之后补 v89.229 ----------
s = rep(s,
"""   *   v89.227 修订（老板：「族有点多了…其他限制在2族以内，官府单独一族」「太显眼，
   *   视觉负担大」）：**8 族 → 4 族**（官府/民生/军事/城务）+ 整体降饱和 ——
   *   S 20~34 → 9~10 · 离地上限 45.9 → 27.0（全主题族间仍 ≥11.1 · 见 docs/v89227-*）。
   *   色相刻意避开地面绿带（60~130°）；校验者：smoke（§225：格式/对齐/色距矩阵）。
   *   ⚠️ 改 plot 必须同步改 index.html 的 `--ser-*`（smoke 有断言当场拦下）。""",
"""   *   v89.227 修订（老板：「族有点多了…其他限制在2族以内，官府单独一族」「太显眼，
   *   视觉负担大」）：**8 族 → 4 族**（官府/民生/军事/城务）+ 整体降饱和 ——
   *   S 20~34 → 9~10 · 离地上限 45.9 → 27.0（全主题族间仍 ≥11.1 · 见 docs/v89227-*）。
   *   色相刻意避开地面绿带（60~130°）；校验者：smoke（§225：格式/对齐/色距矩阵）。
   *   ⚠️ 改 plot 必须同步改 index.html 的 `--ser-*`（smoke 有断言当场拦下）。
   *
   *   v89.229 修订（老板：「去掉城内地块颜色，统一废土底色（浅一点）…建筑名称的文字
   *   色块行高调高，并以此文字色块区分各系建筑。目前各系颜色晦暗，不好区分」）：
   *   **族色编码从"地块染色"迁到"名称文字色块"** —— `plot` 现在是**名称色块的渲染目标色**
   *   （默认主题）：小面积高对比 → 回到鲜明档（S ≈ 40~55 / L ≈ 34~42）。
   *   实测：族间 ΔE00 ≥23（门槛 15）· 与浅废土地面 ≥15（门槛 10）· 白字对比 ≥4.5（WCAG AA）。
   *   地面同步浅废土化（--ground：默认 #8b9a78 → #a8a08b）。""",
'comment')

# ---------- ② 组内注释（plot 行上方） ----------
s = rep(s,
"""    /* v89.227：8 族 → 4 族（老板：「族有点多了…其他限制在 2 族以内，官府单独一族」）——
       官府（政务厅/基因实验室）· 民生（居所/货仓/车库/补给站 —— "无特定菜单操作"类）·
       军事（训练营/练兵场/围墙/瞭望塔）· 城务（酒馆/招募站/研习所/交易站/锻造间/机工坊）。
       旧 5 族 key 退役：store / edu / biz / road / recruit。
       整体降饱和：S 20~34 → 9~10；离地 ΔE00 上限 45.9 → 27.0（族间全主题 ≥11.1）。 */
    gov:  { name: '官府', tone: '行政中枢 · 褪金地', plot: { h: 48,  s: 10, l: 56 } },
    live: { name: '民生', tone: '基础生计 · 沙土地', plot: { h: 24,  s: 9,  l: 47 } },
    mil:  { name: '军事', tone: '训练防御 · 灰靛地', plot: { h: 222, s: 10, l: 46 } },
    ops:  { name: '城务', tone: '百业运营 · 灰青地', plot: { h: 172, s: 9,  l: 48 } }""",
"""    /* v89.227：8 族 → 4 族（老板：「族有点多了…其他限制在 2 族以内，官府单独一族」）——
       官府（政务厅/基因实验室）· 民生（居所/货仓/车库/补给站 —— "无特定菜单操作"类）·
       军事（训练营/练兵场/围墙/瞭望塔）· 城务（酒馆/招募站/研习所/交易站/锻造间/机工坊）。
       旧 5 族 key 退役：store / edu / biz / road / recruit。
       v89.229：plot 语义 = **名称文字色块**的目标色（鲜明档，白字可读 ≥4.5）。
       HSL 值经"渲染复现"求解 —— smoke 逐字节对齐（rgbOfHsl 舍入往返零误差）。 */
    gov:  { name: '官府', tone: '行政中枢 · 金 ', plot: { h: 45,   s: 54.9, l: 34   } },
    live: { name: '民生', tone: '基础生计 · 砖陶', plot: { h: 13.4, s: 41.9, l: 40.1 } },
    mil:  { name: '军事', tone: '训练防御 · 钢蓝', plot: { h: 221.4, s: 40.3, l: 41.9 } },
    ops:  { name: '城务', tone: '百业运营 · 铜青', plot: { h: 167.1, s: 40.3, l: 36.2 } }""",
'series-block')

assert s != s0
if DRY:
    print('[DRY] data.js 2 处命中')
else:
    tmp = BASE + P + '.tmp229a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    assert t.count('plot: { h: 45,   s: 54.9, l: 34   }') == 1
    assert t.count('plot: { h: 221.4') == 1 and t.count('plot: { h: 167.1') == 1
    print('[OK] data.js SERIES plot 已更新 + 自检通过')
print('A2 DONE%s' % ('（DRY）' if DRY else ''))
