# -*- coding: utf-8 -*-
"""v89.225 补丁 A：DATA.SERIES 地块色/recruit 族 + index.html 8 条染色 CSS + 版本号
段段 count 断言；一次写盘（原子）。"""
import io, os

BASE = 'E:/Deepseekdb/'

def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()

def wr(p, s):
    tmp = BASE + p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

# ================= data.js =================
s = rd('js/data.js')
edits = [
 # 1) 注释块更新（v89.107 定稿段 → v89.225 修订）
 ("""   * v89.107 定稿 = **材质自然 + 族旗编码**（两条腿）：
   *   ① 材质：按素材管线的图集流程**重绘** 16 张（同轮廓、同机位，
   *      只换材质与颜色：灰瓦/白墙/木构/石基/琉璃瓦/夯土/草顶…），
   *      图内色散从 7° 提到 8~57°（平均 20°+）—— 建筑不再是"色块"；
   *   ② 族旗：每座建筑挂一面**小面积、传统色**的旗（燕尾旗），
   *      族色编码靠它（`asset/flag_bldg_icons.py` 画，色值就是下面的 `flag`）。
   *      为什么不用大面积染色：小面积高饱和 = 自然可辨（红幌子挂灰墙上是常态）；
   *      大面积染 = 材质失真（前三轮的病根）。
   *
   * `flag` 是族旗颜色：h 色相(度) · s 饱和(0~1) · l 明度(%)。
   *   这七个色在**传统色带内**寻优，两两 CIEDE2000 最小 **24.8**（>18 一眼可辨）；
   *   生产者：`asset/flag_bldg_icons.py`（先重绘、再画旗）；校验者：smoke。
   *   ⚠️ 改 flag 必须重跑：`python .workbuddy/tools/asset/flag_bldg_icons.py`
   *      否则数据与素材不一致（smoke 有断言当场拦下）。""",
  """   * v89.107 定稿 = **材质自然 + 族旗编码**（两条腿）；
   *   v89.225 修订（老板：「建筑前边的带颜色棋子是什么，能否用地块颜色区分，
   *   不然好突兀。同类型建筑地块颜色相同，比如酒馆和招募站，训练营和练兵场」）——
   *   **族旗退役，族色编码落到"城内地块染色"**：
   *   ① 材质：不变（图集重绘，图内色散 8~57°）；16 张图标上的旗已清除；
   *   ② 族色：改由**建筑地块的底色**承担 —— 值在下面的 `plot`（默认主题 HSL），
   *      4 个主题各有一版渲染色（index.html 的 `--ser-*` 变量，smoke 对齐校验）。
   *
   * `plot` 是**地块染色目标色**（默认主题）：h 色相(度) · s 饱和(%) · l 明度(%)。
   *   八族色相刻意散开、避开地面绿带（60~130°）：与地面 ΔE00 ≥8.3、族间 ≥10.3
   *   （4 主题全量实测，见 docs/v89225-*）；校验者：smoke（§225：格式/对齐/色距矩阵）。
   *   ⚠️ 改 plot 必须同步改 index.html 的 `--ser-*`（smoke 有断言当场拦下）。"""),
 # 2) 表本体（flag → plot；新增 recruit 族）
 ("""  DATA.SERIES = {
    gov:   { name: '官署', tone: '金瓦朱柱 · 金旗',     flag: { h: 42,  s: 0.60, l: 51 } },
    live:  { name: '民居', tone: '白墙灰瓦 · 素旗',     flag: { h: 48,  s: 0.27, l: 87 } },
    store: { name: '仓廪', tone: '夯土褐瓦 · 赭旗',     flag: { h: 34,  s: 0.45, l: 28 } },
    edu:   { name: '文教', tone: '青碧琉璃 · 青旗',     flag: { h: 162, s: 0.48, l: 33 } },
    mil:   { name: '军事', tone: '黛蓝石构 · 靛旗',     flag: { h: 215, s: 0.52, l: 35 } },
    biz:   { name: '工商', tone: '赭红棚架 · 朱旗',     flag: { h: 5,   s: 0.54, l: 50 } },
    road:  { name: '驿传', tone: '米白青瓦 · 青灰旗',   flag: { h: 199, s: 0.29, l: 56 } }
  };""",
  """  DATA.SERIES = {
    gov:     { name: '官署', tone: '金瓦朱柱 · 金地',   plot: { h: 45,  s: 32, l: 60 } },
    live:    { name: '民居', tone: '白墙灰瓦 · 陶土地', plot: { h: 350, s: 26, l: 58 } },
    store:   { name: '仓廪', tone: '夯土褐瓦 · 赭褐地', plot: { h: 30,  s: 32, l: 40 } },
    edu:     { name: '文教', tone: '青碧琉璃 · 青地',   plot: { h: 165, s: 30, l: 48 } },
    mil:     { name: '军事', tone: '黛蓝石构 · 靛地',   plot: { h: 225, s: 34, l: 46 } },
    biz:     { name: '工商', tone: '赭红棚架 · 朱地',   plot: { h: 12,  s: 34, l: 50 } },
    road:    { name: '驿传', tone: '米白青瓦 · 青灰地', plot: { h: 198, s: 20, l: 62 } },
    recruit: { name: '招募', tone: '招揽英雄 · 紫地',   plot: { h: 278, s: 28, l: 54 } }
  };"""),
 # 3) 换族（老板示例①：酒馆 + 招募站 = 招募族）
 ("id: 'kezhan', series: 'live', name: '酒馆'",
  "id: 'kezhan', series: 'recruit', name: '酒馆'"),
 ("id: 'zhaoxianguan', series: 'edu', name: '招募站'",
  "id: 'zhaoxianguan', series: 'recruit', name: '招募站'"),
]
for old, new in edits:
    c = s.count(old)
    assert c == 1, 'data x%d: %r' % (c, old[:70])
    s = s.replace(old, new)
wr('js/data.js', s)
print('[data.js] 4 处已落盘')

# ================= index.html =================
h = rd('index.html')
edits2 = [
 # ---- 默认（暗金）主题：删 --ground-gov/--ground-sel（零消费死变量），加 8 族染色 ----
 ("""    --ground: #8b9a78;            /* 城内地面（一整片） */
    --ground-busy: #a09580;       /* 施工工地（土色） */
    --ground-gov: #a59b80;        /* 官署格 */
    --ground-sel: #9caa86;        /* 选中格 */
    --res-farm: #c2b45e;          /* 集水场 · 麦黄 */""",
  """    --ground: #8b9a78;            /* 城内地面（一整片） */
    --ground-busy: #a09580;       /* 施工工地（土色） */
    /* v89.225：建筑地块按"族"染色（族旗退役 → 族色编码落在地块底色上；同类型建筑同色）。
       值 = data.js DATA.SERIES[].plot 在默认主题的渲染色（smoke §225 逐值对齐）；
       其余三主题（silk / bamboo / night）各有对应一版（见下方主题块）。
       顺带清退两个零消费死变量：--ground-gov（v39 官署格，被族色取代）· --ground-sel。 */
    --ser-gov: #baa978; --ser-live: #b07881; --ser-store: #876645; --ser-edu: #569f8d;
    --ser-mil: #4d619d; --ser-biz: #ab6554; --ser-road: #8ba6b1; --ser-recruit: #9269ab;
    --res-farm: #c2b45e;          /* 集水场 · 麦黄 */"""),
 # ---- silk（浅色）----
 ("    --ground: #c6cbb3; --ground-busy: #cdc3ae; --ground-gov: #cbc5b2; --ground-sel: #c8cfb8;",
  """    --ground: #c6cbb3; --ground-busy: #cdc3ae;
    --ser-gov: #c8bc98; --ser-live: #bf959c; --ser-store: #997552; --ser-edu: #6cad9d;
    --ser-mil: #6073ae; --ser-biz: #b67e70; --ser-road: #a8bbc4; --ser-recruit: #a585b8;"""),
 # ---- bamboo ----
 ("    --ground: #c2ccbc; --ground-busy: #c9c4ad; --ground-gov: #c7c2ab; --ground-sel: #c6d0bf;",
  """    --ground: #c2ccbc; --ground-busy: #c9c4ad;
    --ser-gov: #cbc0a2; --ser-live: #c29ea4; --ser-store: #9c7957; --ser-edu: #75afa0;
    --ser-mil: #697aae; --ser-biz: #b78579; --ser-road: #b0c1c8; --ser-recruit: #aa8dba;"""),
 # ---- night ----
 ("    --ground: #5c6b52; --ground-busy: #6a6352; --ground-gov: #68614f; --ground-sel: #68765c;",
  """    --ground: #5c6b52; --ground-busy: #6a6352;
    --ser-gov: #99874f; --ser-live: #8e535d; --ser-store: #664e35; --ser-edu: #41796b;
    --ser-mil: #3b4a77; --ser-biz: #824d40; --ser-road: #608290; --ser-recruit: #704b86;"""),
 # ---- 死规则 → 8 条族染色规则（v89.225 主改）----
 ("""  /* 官署格：台基色（4 格合并的宫殿台基由 .gov-palace 单独画） */
  .iso-tile.gov .tile-face { background: var(--ground-gov); }""",
  """  /* v89.225：**建筑地块按"族"染色**（老板：「建筑前边的带颜色棋子好突兀，能否用
     地块颜色区分，同类型建筑地块颜色相同，比如酒馆和招募站，训练营和练兵场」）。
     族归属 = DATA.SERIES_OF（唯一来源）；色值 = --ser-*（4 主题；默认主题与 data.js
     plot 渲染色对齐，smoke §225 校验）。只作用于已建成格（.built）——空地/锁定/施工
     各有自己的既有样式；施工/升级中的格子不带 ser 类，天然让位给 .busy 土色。
     政务厅 4 格合并的宫殿台基由 .gov-palace 单独画（其格不渲染 ser 类）。 */
  .iso-tile.built.ser-gov     .tile-face { background: var(--ser-gov); }
  .iso-tile.built.ser-live    .tile-face { background: var(--ser-live); }
  .iso-tile.built.ser-store   .tile-face { background: var(--ser-store); }
  .iso-tile.built.ser-edu     .tile-face { background: var(--ser-edu); }
  .iso-tile.built.ser-mil     .tile-face { background: var(--ser-mil); }
  .iso-tile.built.ser-biz     .tile-face { background: var(--ser-biz); }
  .iso-tile.built.ser-road    .tile-face { background: var(--ser-road); }
  .iso-tile.built.ser-recruit .tile-face { background: var(--ser-recruit); }"""),
 # ---- v39 注释块更新（标题行 + 尾部 ser- 说明）----
 ("   * 城内建筑按「系列」分色（v39 · 需求 2/3；v45 改为**素材固有色**）",
  "   * 城内建筑按「系列」分色（v39 立；v45 素材固有色；v89.107 族旗；v89.225 **地块染色**）"),
 ("""   * `ser-<系列>` 类保留为**语义标记**（数据侧唯一来源 DATA.SERIES，供调试与
   * 后续按系列扩展），当前不再驱动颜色。""",
  """   * `ser-<系列>` 类在 v89.225 **重新驱动颜色** —— 选择器见上方「建筑地块按族染色」
   * 段（`.iso-tile.built.ser-x .tile-face`）；数据侧唯一来源仍是 DATA.SERIES
   * （族归属派生 SERIES_OF；色值为各主题 `--ser-*`，与 data.js `plot` 对齐）。"""),
]
for old, new in edits2:
    c = h.count(old)
    assert c == 1, 'html x%d: %r' % (c, old[:70])
    h = h.replace(old, new)
wr('index.html', h)
print('[index.html] 7 处已落盘')

# ================= main.js 版本号 =================
m = rd('js/main.js')
old = "GAME.VERSION = 'v89.224'"
assert m.count(old) == 1
m = m.replace(old, "GAME.VERSION = 'v89.225'")
wr('js/main.js', m)
print('[main.js] 版本 → v89.225')

print('=== 断言复核 ===')
d2 = rd('js/data.js')
print('data: flag 残留 =', d2.count('flag: { h:'))
print('data: plot 条数 =', d2.count('plot: { h:'))
print('data: recruit 在册 =', "recruit: { name: '招募'" in d2)
h2 = rd('index.html')
print('html: ser 规则 =', h2.count('.iso-tile.built.ser-'))
print('html: --ser- 定义 =', h2.count('--ser-gov:'))
print('html: ground-gov 残留 =', h2.count('--ground-gov'))
print('html: ground-sel 残留 =', h2.count('--ground-sel'))
print('html: iso-tile.gov 残留 =', h2.count('.iso-tile.gov '))
