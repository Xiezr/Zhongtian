# -*- coding: utf-8 -*-
"""最后一次瘦身：把「素材与图标」「配色细则」整段迁到 docs/AI工作备忘.md，
MEMORY.md 只留**每次动手都要遵守的硬规则 + 指针**，压回 9600 字符以内。"""
import io, os

MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\MEMORY.md'
DOC = r'E:\Deepseekdb\docs\AI工作备忘.md'

s = io.open(MEM, encoding='utf-8', newline='').read()
n0 = len(s)


def cut(start_key, end_key, replacement, label):
    """把 [start_key, end_key) 之间整段替换为 replacement（长段搬迁用）。"""
    global s
    i = s.index(start_key)
    j = s.index(end_key, i)
    seg = s[i:j]
    assert len(seg) > 200, '%s：取到的段只有 %d 字符，锚点可能不对' % (label, len(seg))
    s = s[:i] + replacement + s[j:]
    return seg


# ---------- ① 素材与图标：整段迁出 ----------
seg_mat = cut(
    '## 五、素材与图标',
    '## 六、踩坑',
    """## 五、素材与图标（细则 → `docs/AI工作备忘.md`「十四」）

**路线：AI 位图为主 → `gicons` 矢量 → `icons` 手绘兜底**（老板三次否决矢量路线）。
取图在 `ICON.get/forEquip/forItem` 三入口各加一行位图优先；**位图不套 `wrap()`**；
`js/bitmaps.js` 由脚本扫描目录自动生成、**勿手改**；**新增图标只改台账 + 生成脚本，不碰业务代码**。

**生成 prompt 三铁律**：① **锁纯白底**（写明 no gradient/sky/haze/ground plane）；
② `background:"transparent"` **不生效**，必须抠底后处理；③ 复检**同时看透底率与主体占宽占高**
（**≥99% 未抠净**）。降本：2×2 图集生成再切分。

- **换素材源前先 grep「绕过图标层的专属渲染器」**（官府走 `ui.govPalaceHTML()` 内联 SVG）。
- **分层断言必须锚在「层」上**（`ICON.raw` / `ICON.layerOf`），锚最终输出会假绿。
- **头像**：池 `assets/portraits/pool/{m,f}01-20.webp`；`P.fileOf` 三层取图；抠底**必须连通域洪水填充**。

""", '素材与图标')

# ---------- ② 配色：只留判据 ----------
seg_col = cut(
    '### 配色（量化判据）',
    '## 五、素材与图标',
    """### 配色（量化判据，细则 → 备忘「十四」）

- **大面积底色用「色差绝对值」**：`max-min ≤ 38`。**不要用 HSL 的 S**（接近白时虚高）。
- 四套主题：正文 ≥ 7:1、次要文字 ≥ 4.5:1、层级亮度单调递进（`.workbuddy/tools/audit_colors.js`）。
- 深色主题**不要用纯黑**；层级靠**亮度递进**，不靠阴影。
- **⛔ 绝不要「用 CSS 滤镜给位图染色」**（v39~v44 四轮返工的根因）→ ✅ **像素级 HSL 重映射写进 PNG
  本身**（`.workbuddy/tools/recolor_buildings.py`）。两条铁律：① 色相走**增量**；② 饱和度只微调。
- 建筑 7 族目标色相 / 饱和 / 明度档位、城外资源提亮口径 → 备忘「十四」。

""", '配色')

# ---------- ③ 追加到工作备忘 ----------
ADD = """

## 十四、素材与配色细则（v67 从 MEMORY.md 迁出）

### 14.1 图标路线与取图

**路线：AI 位图为主 → `gicons` 矢量 → `icons` 手绘兜底**（老板三次否决矢量路线）。
取图在 `ICON.get / forEquip / forItem` 三入口各加一行位图优先；**位图不套 `wrap()`**；
`js/bitmaps.js` 由 `.workbuddy/tools/gen_bitmaps.js` **扫描 `assets/icons/ui/` 自动生成**（勿手改），
命名分组靠前缀表 `PREFIX`（`terrain→ai_terrain_`、`mat→ai_mat_`、`slot→ai_slot_`、
`item→ai_item_`，其余 `ai_`）。**新增图标只改台账 + 生成脚本，不碰业务代码。**

**生成 prompt 三条铁律**：
① **锁纯白底**（写明 no gradient/sky/haze/ground plane）；
② `background:"transparent"` **不生效**，必须抠底后处理（四角采样 T=42、羽化 26）；
③ 复检**同时看透底率与主体占宽占高**（**≥99% 就是没抠净**）。降本：2×2 图集生成再切分。

- **换素材源前先 grep「绕过图标层的专属渲染器」**（官府走 `ui.govPalaceHTML()` 内联 SVG）。
- **分层断言必须锚在「层」上**（`ICON.raw` / `ICON.layerOf`），锚最终输出会假绿。
- **头像**：通用池 `assets/portraits/pool/{m,f}01-20.webp`（40 张）；`P.fileOf` 三层取图；
  分配按「将领名 seed 取模」；君主也走同池（`ruler.portraitSeed` 存存档）。
  **抠底必须用连通域洪水填充（BFS）**，不能用全局颜色距离。
- 回退层 `assets/portraits/hero_<key>.webp` + `P.HERO_FILE`（28 人），仅池子被清空时启用。

**v67 状态**：`assets/icons/ui/` 91 张 ↔ `bitmaps.js` 91 项（**缺失 0、孤儿 0**）；
**地图地形位图已全部退役**（21 项进回收站），地形改**全程序化绘制**（`drawTerrainArt`）；
原料仍在 `assets/icons/raw`（33 张图集原图）。

### 14.2 配色量化判据

- **建筑 7 族目标平均色相**：工商 12° · 仓廪 32° · 官署 46° · 民居 74° · 文教 132° ·
  军事 196° · 驿传 250°；饱和 36~40%、明度 24~43%。
  判据「色相 ≥18° **或** 明度 ≥6% **或** 饱和度 ≥8%」三选一。
- 城外资源图标**只做 brightness 提亮**；**回归护栏**：smoke 有「解码 PNG 像素」的实测断言。
- **⛔ 绝不要「用 CSS 滤镜给位图染色」**（v39~v44 四轮返工的根因）→
  ✅ **像素级 HSL 重映射写进 PNG 本身**（`.workbuddy/tools/recolor_buildings.py`，`restore` 可还原）。
  两条铁律：① 色相走**增量** `H_new = H_orig + Δ`；② 饱和度只微调
  （gain 夹 `[0.85,1.18]`、上限 0.50）。
- ⚠️ v67：`_gold_backup`（recolor 的备份目录）已删 → **`restore` 暂时无备份**，
  下次跑调色时脚本会自行 `makedirs` 重建。
- 四套主题：正文对比度 ≥ 7:1、次要文字 ≥ 4.5:1、层级亮度单调递进
  （跑 `.workbuddy/tools/audit_colors.js`）。深色主题不用纯黑，层级靠亮度递进不靠阴影。
"""
doc = io.open(DOC, encoding='utf-8', newline='').read()
io.open(DOC, 'w', encoding='utf-8', newline='').write(doc.rstrip('\n') + ADD)
print('① 工作备忘 +%d 字符（迁出 %d + %d 字符）' % (len(ADD), len(seg_mat), len(seg_col)))

io.open(MEM, 'w', encoding='utf-8', newline='').write(s)
print('② MEMORY.md：%d → %d 字符（上限 9600，余量 %d）' % (n0, len(s), 9600 - len(s)))
assert len(s) < 9600, '仍超：%d' % len(s)
for k in ['## 一、强制约定', '## 二、环境', '## 五、素材与图标', '## 七、将领属性', '## 八、遗留']:
    assert k in s, k
print('结构自检通过')
