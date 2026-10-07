# -*- coding: utf-8 -*-
# v89.229 批 a1：index.html —— 地块去族色（统一浅废土底）+ 名称/等级顶部色块 + 4 主题新色值
import io, os, sys
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'index.html'

def rd():
    return io.open(BASE + P, encoding='utf-8', newline='').read()

def rep(s, old, new, tag, cnt=1):
    c = s.count(old)
    assert c == cnt, '[%s] count=%d (expect %d)' % (tag, c, cnt)
    return s.replace(old, new)

s = rd()
s0 = s

# ---------- ① :root 地面 + 注释 ----------
s = rep(s,
"    --ground: #8b9a78;            /* 城内地面（一整片） */",
"    --ground: #a8a08b;            /* 城内地面（一整片）· v89.229 浅废土沙色（原灰绿 #8b9a78） */",
'root-ground')

# ---------- ② :root ser 注释 + 值 ----------
s = rep(s,
"""    /* v89.227：族色 8 → 4（官府/民生/军事/城务）+ 整体降饱和（老板：「族有点多了…其他限制在
       2族以内，官府单独一族」「太显眼，视觉负担大」）—— S 20~34 → 9~10 · 离地上限 45.9 → 27.0
       （全主题族间仍 ≥11.1）。旧 5 族（store/edu/biz/road/recruit）退役。 */
    --ser-gov: #9a9684; --ser-live: #83766d; --ser-mil: #6a7181; --ser-ops: #6f8582;""",
"""    /* v89.229（老板：「去掉城内地块颜色，统一废土底色（浅一点）…建筑名称的文字色块行高调高，
       并以此文字色块区分各系建筑。目前各系颜色晦暗，不好区分」）——**族色编码从"地块染色"
       迁到"名称文字色块"**：地块统一浅废土底（上方 --ground），色块 = 小面积高对比，
       因此回到鲜明档（S ≈ 40~55 / L ≈ 34~42；v89.227 的降饱和是为"大面积不刺眼"）。
       实测：族间 ΔE00 ≥23（门槛 15）· 与浅废土地面 ≥15（门槛 10）· 白字对比 ≥4.5（WCAG AA）。
       值 = data.js DATA.SERIES[].plot 在默认主题的渲染色（smoke §229 逐字节对齐）；
       其余三主题（silk/bamboo/night）各有对应一版（见下方主题块）。 */
    --ser-gov: #866f27; --ser-live: #914f3b; --ser-mil: #405a96; --ser-ops: #378172;""",
'root-ser')

# ---------- ③ 素绢 ----------
s = rep(s,
"    --ground: #c6cbb3; --ground-busy: #cdc3ae;",
"    --ground: #d3ccb6; --ground-busy: #cdc3ae;      /* v89.229：浅废土沙（原 #c6cbb3 绿灰） */",
'silk-ground')
s = rep(s,
"    --ser-gov: #ada99c; --ser-live: #948880; --ser-mil: #7b8292; --ser-ops: #839794;",
"    --ser-gov: #897024; --ser-live: #904c37; --ser-mil: #3d5794; --ser-ops: #347f70;",
'silk-ser')

# ---------- ④ 青竹 ----------
s = rep(s,
"    --ground: #c2ccbc; --ground-busy: #c9c4ad;",
"    --ground: #cfcab3; --ground-busy: #c9c4ad;      /* v89.229：浅废土沙（原 #c2ccbc 绿灰） */",
'bamboo-ground')
s = rep(s,
"    --ser-gov: #b1aea2; --ser-live: #988d86; --ser-mil: #818896; --ser-ops: #899a98;",
"    --ser-gov: #897024; --ser-live: #904c37; --ser-mil: #3d5794; --ser-ops: #347f70;",
'bamboo-ser')

# ---------- ⑤ 夜阑 ----------
s = rep(s,
"    --ground: #5c6b52; --ground-busy: #6a6352;",
"    --ground: #6f6957; --ground-busy: #6a6352;      /* v89.229：深废土土灰（原 #5c6b52 暗绿） */",
'night-ground')
s = rep(s,
"    --ser-gov: #777362; --ser-live: #635953; --ser-mil: #505662; --ser-ops: #556563;",
"    --ser-gov: #8c742c; --ser-live: #9a5642; --ser-mil: #47619e; --ser-ops: #397f71;",
'night-ser')

# ---------- ⑥ 族色规则：地块染色 → 名称文字色块 ----------
s = rep(s,
"""  /* v89.225：**建筑地块按"族"染色**（老板：「建筑前边的带颜色棋子好突兀，能否用
     地块颜色区分，同类型建筑地块颜色相同，比如酒馆和招募站，训练营和练兵场」）。
     族归属 = DATA.SERIES_OF（唯一来源）；色值 = --ser-*（4 主题；默认主题与 data.js
     plot 渲染色对齐，smoke §225 校验）。只作用于已建成格（.built）——空地/锁定/施工
     各有自己的既有样式；施工/升级中的格子不带 ser 类，天然让位给 .busy 土色。
     政务厅 4 格合并的宫殿台基由 .gov-palace 单独画（其格不渲染 ser 类）。 */
  .iso-tile.built.ser-gov  .tile-face { background: var(--ser-gov); }
  .iso-tile.built.ser-live .tile-face { background: var(--ser-live); }
  .iso-tile.built.ser-mil  .tile-face { background: var(--ser-mil); }
  .iso-tile.built.ser-ops  .tile-face { background: var(--ser-ops); }""",
"""  /* v89.229（老板）：「去掉城内地块颜色，统一废土底色（浅一点）…以此文字色块区分各系建筑」
     ——**地块染色整体退役**：已建成格地块 = 统一 --ground（浅废土底），与整片地面同色；
     族色编码改由 `.tile-label .nm`（名称文字色块）承载 —— 小面积高对比，
     实测族间 ΔE00 ≥23 · 白字对比 ≥4.5（smoke §229）。
     三次迁址的终点：族旗（v89.107·图标上小旗）→ 地块（v89.225）→ **名称色块（v89.229）**
     —— 编码要小面积、名称要居顶（大面积染 = 老板两次投诉"视觉负担/不好区分"的真身）。
     施工/升级中的格子不带 ser 类，名称自动落暗色 veil 底（与旧观感一致）。 */
  .iso-tile.built.ser-gov  .tile-label .nm { background: var(--ser-gov); }
  .iso-tile.built.ser-live .tile-label .nm { background: var(--ser-live); }
  .iso-tile.built.ser-mil  .tile-label .nm { background: var(--ser-mil); }
  .iso-tile.built.ser-ops  .tile-label .nm { background: var(--ser-ops); }""",
'ser-rules')

# ---------- ⑦ tile-label 块：底部 → 顶部 + 色块 + 行高 ----------
s = rep(s,
"""  /* 格内标签：名字 + 等级**同一行**（需求 1） */
  .tile-label {
    position: absolute; left: 5px; right: 5px; bottom: 4px;
    display: flex; align-items: baseline; justify-content: center; gap: var(--sp-1);
    padding: var(--sp-hair) 0; border-radius: var(--r-md);
    background: rgba(var(--tile-veil-rgb),.52);
    font-size: var(--fs-cap); font-weight: 700; line-height: var(--lh-body);
    white-space: nowrap; overflow: hidden;
  }
  .tile-label .nm { color: var(--text); overflow: hidden; text-overflow: ellipsis; }
  .tile-label .lv {
    flex: none; font-size: var(--fs-cap); font-weight: 700; font-variant-numeric: tabular-nums;
    color: var(--gold-light);
  }
  .tile-label .lv.max { color: var(--green-ok); }
  .iso-tile.empty .tile-label { display: none; }""",
"""  /* 格内标签：名称 + 等级**都放格顶、同一行**（v89.229 老板：「建筑名称和等级都放顶部，
     建筑名称的文字色块行高调高，并以此文字色块区分各系建筑」）。
     · 位置：底部 → **格顶**（等级角标自右上角并入本行右端 —— 见 .tile-badge）；
     · 名称 = **族色文字色块**（.nm 背景 = --ser-*，见上方四条族色规则）；
       施工/升级中格不带 ser 类 → 自动落暗色 veil 底（与旧观感一致）；
     · 行高调高：字号升一档（--fs-cap → --fs-sub）+ 上下 padding（--sp-1）——
       色块高 ≈23px（旧标签 ≈20px），更醒目；
     · 白字 + 描边（色块饱和 40~55，白字对比全部 ≥4.5，见 smoke §229）。 */
  .tile-label {
    position: absolute; left: var(--sp-1); right: var(--sp-1); top: var(--sp-0);
    display: flex; align-items: center; justify-content: center; gap: var(--sp-hair);
    background: transparent;
    font-size: var(--fs-sub); font-weight: 700; line-height: var(--lh-tight);
    white-space: nowrap; overflow: hidden;
  }
  .tile-label .nm {
    min-width: 0; color: #fff;
    background: rgba(var(--tile-veil-rgb),.62);
    padding: var(--sp-1) var(--sp-2); border-radius: var(--r-sm);
    overflow: hidden; text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(var(--sh-rgb),.6);
  }
  .iso-tile.empty .tile-label { display: none; }""",
'tile-label')

# ---------- ⑧ tile-badge：绝对定位 → 并入名称行 ----------
s = rep(s,
"""  /* ---- 等级角标（v23 · 需求 2/3）：格内右上，只显示数字 ---- */
  .tile-badge {
    position: absolute; right: 4px; top: 3px;
    min-width: 17px; height: 17px; line-height: 17px; padding: 0 var(--sp-1);
    border-radius: var(--r-lg); text-align: center;
    font-size: var(--fs-cap); font-weight: 800; font-variant-numeric: tabular-nums;
    color: var(--ink-on-gold);
    background: linear-gradient(180deg, var(--gold-light), var(--gold));
    box-shadow: 0 1px 3px rgba(var(--sh-rgb), .55);
  }
  .tile-badge.max { color: var(--ink-on-gold); background: linear-gradient(180deg, #a8e59a, var(--green-ok)); }
  /* 名字留在底部（等级不再挤在这一行） */
  .tile-label .lv { display: none; }""",
"""  /* ---- 等级角标（v23 立 · v89.229 改）：只显示数字，**排在名称色块右端（格顶同一行）** ----
     v23~v89.228：绝对定位在格内右上角的独立角标；v89.229 老板令「名称和等级都放顶部」
     —— 名称行移到格顶后，角标并入该行（flex 行内），与色块同排、随名称居中。 */
  .tile-badge {
    position: static; flex: none;
    min-width: 17px; height: 17px; line-height: 17px; padding: 0 var(--sp-1);
    border-radius: var(--r-lg); text-align: center;
    font-size: var(--fs-cap); font-weight: 800; font-variant-numeric: tabular-nums;
    color: var(--ink-on-gold);
    background: linear-gradient(180deg, var(--gold-light), var(--gold));
    box-shadow: 0 1px 3px rgba(var(--sh-rgb), .55);
  }
  .tile-badge.max { color: var(--ink-on-gold); background: linear-gradient(180deg, #a8e59a, var(--green-ok)); }""",
'tile-badge')

# ---------- ⑨ 沿革注释块（L1180-1201）更新 ----------
s = rep(s,
"   * 城内建筑按「系列」分色（v39 立；v45 素材固有色；v89.107 族旗；v89.225 **地块染色**；v89.227 **4 族降饱和**）",
"   * 城内建筑按「系列」分色（v39 立；v45 素材固有色；v89.107 族旗；v89.225 地块染色；v89.227 4 族降饱和；v89.229 **名称文字色块**）",
'heritage-title')
s = rep(s,
"""   * `ser-<系列>` 类在 v89.225 **重新驱动颜色**（v89.227 起 8→4 族）—— 选择器见上方「建筑地块按族染色」
   * 段（`.iso-tile.built.ser-x .tile-face`）；数据侧唯一来源仍是 DATA.SERIES
   * （族归属派生 SERIES_OF；色值为各主题 `--ser-*`，与 data.js `plot` 对齐）。""",
"""   * `ser-<系列>` 类现在驱动**名称文字色块**（v89.229）—— 选择器见上方
   * `.iso-tile.built.ser-x .tile-label .nm` 四条；数据侧唯一来源仍是 DATA.SERIES
   * （族归属派生 SERIES_OF；色值为各主题 `--ser-*`，与 data.js `plot` 对齐）。""",
'heritage-rules')

assert s != s0
if DRY:
    print('[DRY] index.html 9 处替换全部命中（未落盘）')
else:
    tmp = BASE + P + '.tmp229a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    # 写后自检
    t = rd()
    assert t.count('--ser-gov: #866f27;') == 1, 'root ser 未落盘'
    assert t.count('--ser-gov: #897024;') == 2, '浅主题 ser 计数错'
    assert t.count('--ser-gov: #8c742c;') == 1, '夜阑 ser 未落盘'
    assert t.count('--ground: #a8a08b;') == 1 and t.count('--ground: #d3ccb6;') == 1
    assert t.count('--ground: #cfcab3;') == 1 and t.count('--ground: #6f6957;') == 1
    assert t.count('.tile-label .nm { background: var(--ser-gov); }') == 1
    assert '.tile-face { background: var(--ser-' not in t, '地块染色残留'
    assert t.count('position: static; flex: none;') >= 1, 'badge 未改'
    print('[OK] index.html 9 处已落盘 + 自检通过')
print('A1 DONE%s' % ('（DRY）' if DRY else ''))
