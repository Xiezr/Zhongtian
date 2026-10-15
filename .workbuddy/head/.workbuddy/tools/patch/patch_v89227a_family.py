# -*- coding: utf-8 -*-
"""v89.227 P1：城内族色 8→4 + 降饱和（data.js + index.html + main.js 版本）。"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    if DRY:
        return
    tmp = BASE + p + '.tmp227'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)


def rep(p, old, new, cnt=1, tag=''):
    s = rd(p)
    c = s.count(old)
    assert c == cnt, '%s: [%s] x%d (expect %d)' % (p, tag or old[:50], c, cnt)
    wr(p, s.replace(old, new))
    print('  [ok] %s %s' % (p, tag or ''))


# ================= data.js =================
# ---- 1) SERIES 上方注释（plot 段）----
rep('js/data.js',
    """   * `plot` 是**地块染色目标色**（默认主题）：h 色相(度) · s 饱和(%) · l 明度(%)。
   *   八族色相刻意散开、避开地面绿带（60~130°）：与地面 ΔE00 ≥8.3、族间 ≥10.3
   *   （4 主题全量实测，见 docs/v89225-*）；校验者：smoke（§225：格式/对齐/色距矩阵）。
   *   ⚠️ 改 plot 必须同步改 index.html 的 `--ser-*`（smoke 有断言当场拦下）。""",
    """   * `plot` 是**地块染色目标色**（默认主题）：h 色相(度) · s 饱和(%) · l 明度(%)。
   *   v89.227 修订（老板：「族有点多了…其他限制在2族以内，官府单独一族」「太显眼，
   *   视觉负担大」）：**8 族 → 4 族**（官府/民生/军事/城务）+ 整体降饱和 ——
   *   S 20~34 → 9~10 · 离地上限 45.9 → 27.0（全主题族间仍 ≥11.1 · 见 docs/v89227-*）。
   *   色相刻意避开地面绿带（60~130°）；校验者：smoke（§225：格式/对齐/色距矩阵）。
   *   ⚠️ 改 plot 必须同步改 index.html 的 `--ser-*`（smoke 有断言当场拦下）。""",
    tag='SERIES 注释')

# ---- 2) SERIES 表体 ----
rep('js/data.js',
    """DATA.SERIES = {
    gov:     { name: '官署', tone: '金瓦朱柱 · 金地',   plot: { h: 45,  s: 32, l: 60 } },
    live:    { name: '民居', tone: '白墙灰瓦 · 陶土地', plot: { h: 350, s: 26, l: 58 } },
    store:   { name: '仓廪', tone: '夯土褐瓦 · 赭褐地', plot: { h: 30,  s: 32, l: 40 } },
    edu:     { name: '文教', tone: '青碧琉璃 · 青地',   plot: { h: 165, s: 30, l: 48 } },
    mil:     { name: '军事', tone: '黛蓝石构 · 靛地',   plot: { h: 225, s: 34, l: 46 } },
    biz:     { name: '工商', tone: '赭红棚架 · 朱地',   plot: { h: 12,  s: 34, l: 50 } },
    road:    { name: '驿传', tone: '米白青瓦 · 青灰地', plot: { h: 198, s: 20, l: 62 } },
    recruit: { name: '招募', tone: '招揽英雄 · 紫地',   plot: { h: 278, s: 28, l: 54 } }
  };""",
    """DATA.SERIES = {
    /* v89.227：8 族 → 4 族（老板：「族有点多了…其他限制在 2 族以内，官府单独一族」）——
       官府（政务厅/基因实验室）· 民生（居所/货仓/车库/补给站 —— "无特定菜单操作"类）·
       军事（训练营/练兵场/围墙/瞭望塔）· 城务（酒馆/招募站/研习所/交易站/锻造间/机工坊）。
       旧 5 族 key 退役：store / edu / biz / road / recruit。
       整体降饱和：S 20~34 → 9~10；离地 ΔE00 上限 45.9 → 27.0（族间全主题 ≥11.1）。 */
    gov:  { name: '官府', tone: '行政中枢 · 褪金地', plot: { h: 48,  s: 10, l: 56 } },
    live: { name: '民生', tone: '基础生计 · 沙土地', plot: { h: 24,  s: 9,  l: 47 } },
    mil:  { name: '军事', tone: '训练防御 · 灰靛地', plot: { h: 222, s: 10, l: 46 } },
    ops:  { name: '城务', tone: '百业运营 · 灰青地', plot: { h: 172, s: 9,  l: 48 } }
  };""",
    tag='SERIES 表体')

# ---- 3) 16 建筑 series 字段迁移（唯一改法是字段值）----
rep('js/data.js', "series: 'store'", "series: 'live'", 2, tag='store→live')
rep('js/data.js', "series: 'road'", "series: 'live'", 1, tag='road→live')
rep('js/data.js', "series: 'recruit'", "series: 'ops'", 2, tag='recruit→ops')
rep('js/data.js', "series: 'edu'", "series: 'ops'", 1, tag='edu→ops')
rep('js/data.js', "series: 'biz'", "series: 'ops'", 3, tag='biz→ops')

# ================= index.html =================
# ---- 4) 注释：v89.225 段后追加 v89.227 注 ----
rep('index.html',
    """       顺带清退两个零消费死变量：--ground-gov（v39 官署格，被族色取代）· --ground-sel。 */
    --ser-gov: #baa978; --ser-live: #b07881; --ser-store: #876645; --ser-edu: #569f8d;
    --ser-mil: #4d619d; --ser-biz: #ab6554; --ser-road: #8ba6b1; --ser-recruit: #9269ab;""",
    """       顺带清退两个零消费死变量：--ground-gov（v39 官署格，被族色取代）· --ground-sel。 */
    /* v89.227：族色 8 → 4（官府/民生/军事/城务）+ 整体降饱和（老板：「族有点多了…其他限制在
       2族以内，官府单独一族」「太显眼，视觉负担大」）—— S 20~34 → 9~10 · 离地上限 45.9 → 27.0
       （全主题族间仍 ≥11.1）。旧 5 族（store/edu/biz/road/recruit）退役。 */
    --ser-gov: #9a9684; --ser-live: #83766d; --ser-mil: #6a7181; --ser-ops: #6f8582;""",
    tag='默认主题变量+注')

# ---- 5) light 主题 ----
rep('index.html',
    """    --ser-gov: #c8bc98; --ser-live: #bf959c; --ser-store: #997552; --ser-edu: #6cad9d;
    --ser-mil: #6073ae; --ser-biz: #b67e70; --ser-road: #a8bbc4; --ser-recruit: #a585b8;""",
    """    --ser-gov: #ada99c; --ser-live: #948880; --ser-mil: #7b8292; --ser-ops: #839794;""",
    tag='light 变量')

# ---- 6) bamboo 主题 ----
rep('index.html',
    """    --ser-gov: #cbc0a2; --ser-live: #c29ea4; --ser-store: #9c7957; --ser-edu: #75afa0;
    --ser-mil: #697aae; --ser-biz: #b78579; --ser-road: #b0c1c8; --ser-recruit: #aa8dba;""",
    """    --ser-gov: #b1aea2; --ser-live: #988d86; --ser-mil: #818896; --ser-ops: #899a98;""",
    tag='bamboo 变量')

# ---- 7) dark2 主题 ----
rep('index.html',
    """    --ser-gov: #99874f; --ser-live: #8e535d; --ser-store: #664e35; --ser-edu: #41796b;
    --ser-mil: #3b4a77; --ser-biz: #824d40; --ser-road: #608290; --ser-recruit: #704b86;""",
    """    --ser-gov: #777362; --ser-live: #635953; --ser-mil: #505662; --ser-ops: #556563;""",
    tag='dark2 变量')

# ---- 8) 规则 8 → 4 ----
rep('index.html',
    """  .iso-tile.built.ser-gov     .tile-face { background: var(--ser-gov); }
  .iso-tile.built.ser-live    .tile-face { background: var(--ser-live); }
  .iso-tile.built.ser-store   .tile-face { background: var(--ser-store); }
  .iso-tile.built.ser-edu     .tile-face { background: var(--ser-edu); }
  .iso-tile.built.ser-mil     .tile-face { background: var(--ser-mil); }
  .iso-tile.built.ser-biz     .tile-face { background: var(--ser-biz); }
  .iso-tile.built.ser-road    .tile-face { background: var(--ser-road); }
  .iso-tile.built.ser-recruit .tile-face { background: var(--ser-recruit); }""",
    """  .iso-tile.built.ser-gov  .tile-face { background: var(--ser-gov); }
  .iso-tile.built.ser-live .tile-face { background: var(--ser-live); }
  .iso-tile.built.ser-mil  .tile-face { background: var(--ser-mil); }
  .iso-tile.built.ser-ops  .tile-face { background: var(--ser-ops); }""",
    tag='规则 8→4')

# ---- 9) 语义注释段（v89.227 标注）----
rep('index.html',
    " * 城内建筑按「系列」分色（v39 立；v45 素材固有色；v89.107 族旗；v89.225 **地块染色**）",
    " * 城内建筑按「系列」分色（v39 立；v45 素材固有色；v89.107 族旗；v89.225 **地块染色**；v89.227 **4 族降饱和**）",
    tag='语义注释')

rep('index.html',
    """   *   七族目标色：军事铁青 208° · 文教竹青 152° · 驿传赭黄 28° · 工商朱红 2°
   *              仓廪绛褐 340° · 民居麦黄 70° · 官署暖金 42°""",
    """   *   （v45 时代历史）七族目标色：军事铁青 208° · 文教竹青 152° · 驿传赭黄 28° · 工商朱红 2°
   *              仓廪绛褐 340° · 民居麦黄 70° · 官署暖金 42°""",
    tag='v45 历史标注')

rep('index.html',
    " * `ser-<系列>` 类在 v89.225 **重新驱动颜色** —— 选择器见上方「建筑地块按族染色」",
    " * `ser-<系列>` 类在 v89.225 **重新驱动颜色**（v89.227 起 8→4 族）—— 选择器见上方「建筑地块按族染色」",
    tag='ser- 注释')

# ================= main.js 版本 =================
rep('js/main.js', "GAME.VERSION = 'v89.225';", "GAME.VERSION = 'v89.227';", 1, tag='版本号')

# ---- 写后自检 ----
if not DRY:
    d = rd('js/data.js')
    h = rd('index.html')
    assert d.count("series: 'store'") == 0 and d.count("series: 'ops'") == 6, 'series 迁移核验失败'
    assert d.count("series: 'live'") == 4, 'live x%d' % d.count("series: 'live'")
    assert 'ser-ops' in h and 'ser-store' not in h and 'ser-recruit' not in h, 'CSS 核验失败'
    assert h.count('--ser-ops:') == 4, 'ops 变量 x%d' % h.count('--ser-ops:')
    assert "GAME.VERSION = 'v89.227'" in rd('js/main.js')
    print('P1 自检通过：series 迁移 6 处 · CSS 4 规则 · 变量 4×4 · 版本 v89.227')
else:
    print('P1 DRY 完成')
print('P1 DONE')
