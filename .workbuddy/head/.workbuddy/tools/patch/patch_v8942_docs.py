# -*- coding: utf-8 -*-
"""v89.42 补丁 4/4：文档同步（五处）
① 需求档案.md（CRLF）追加 v89.42 条目
② docs/设计规范.md（CRLF）追加 §55
③ docs/AI工作备忘.md（LF）追加 §63（工程视角）
④ docs/图标素材注册表.md（LF）地形行 / 覆盖率 / 待办
⑤ docs/项目地图.md（LF）ui 数量 · bitmaps 对应 · 工具计数 · 档案版本
"""
import io, os, sys

R = r'E:\Deepseekdb'
ARCH = R + r'\需求档案.md'
SPEC = R + r'\docs\设计规范.md'
MEMO = R + r'\docs\AI工作备忘.md'
REG = R + r'\docs\图标素材注册表.md'
MAP = R + r'\docs\项目地图.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8942d'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def append(p, text, tag, eol='\n'):
    src = read(p)
    marker = text.strip().split('\n')[0][:20]
    if marker in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    body = text.replace('\n', eol)
    if not src.endswith(eol):
        src += eol
    write(p, src + eol + body + eol)
    back = read(p)
    assert marker in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============ ① 需求档案 ============
append(ARCH, """### v89.42 · 野地贴图回归：即梦像素风裁切七地形（2026-09-19 · 老板「根据截图，进行截取，改善该项目的野地UI」）

**落地**
- 素材层：从三张即梦参考图（老三国复古像素风）裁切 **7 张地形贴图**（256×256）——
  平地/草原/沼泽/湖泊/森林/荒漠/山地 → `assets/icons/ui/ai_terrain_*.png`（81~122KB/张，
  比 v67 退役的写实版 1.4MB/张 缩小约九成）；`js/bitmaps.js` 重生成（91 → 98 项，缺失 0 / 孤儿 0）。
- 渲染层（`js/map.js`，三处）：
  ① ART_MAX 192 → 256（v85 自适应格距后 cell 上限 128，旧的"96 的 2 倍"口径过期；
     贴图 256px 与采样窗≈1:1，链路只经一次重采样）；
  ② 平地纳入贴图（"平地不放图形"的卫兵从"进函数即拦"下移到**矢量兜底之前** ——
     素材缺席时留白语义原样保留）；
  ③ 新增 `texVariant` 逐格镜像变体（4 种 · Math.imul 混合哈希 · 仅轴对齐变换，不引入旋转/仿射）。
- 裁切口径：只按**中心条带**选点（游戏侧 blitArtRect 只取素材中心 45%×41% 上屏，约 115×53px）；
  plain / zhaoze / lake 做轻度色相·明度适配（贴合地形底色，缝与侧壁不打架）；plain 另做 40% 柔化
  （保留"平地是视觉休息区"的设计语义）。
- 工程：裁切流水线固化为 `.workbuddy/tools/asset/crop_terrain.py`（SPEC 表＝唯一真相，可复跑核验）；
  新增 `tools/probe/probe_v8942_tex.js`（哈希/素材核验）· `tools/probe/probe_v8942_map_shot.js`
  （地图截图，改走内置 HTTP 通道）· `tools/show/shot_compare.py`（前后对比图 + 贴图一览）。

**验证**
- 三件套：audit 全 0 · smoke **2309/0**（v67 两条"地形位图一张都不剩/12 key 无素材"护栏
  随新决定退役 → 改写为 v89.42 新不变量六条：七张就位 / 两两不同 / 城池·据点 5 key 仍无素材 /
  登记表同步 / 变体函数轴对齐 / 平地卫兵位置；净增 4）· e2e **946/0**（无回归）。
- 真机截图（Edge + playwright，seed 锁定 4242，13×7@104）：贴图加载 **7/7**；
  前后对比（逐格两翼采样）—— 平地纹理梯度 0.67 → 3.90（6×）、森林 12.7 → 15.5、山地 13.2 → 14.7；
  湖泊由灰调 #6d8a8d → 深蓝 #446174；平原 #a3b49c → 浅绿 #7aa974。
- 逐格变体独立性（单地形铺满测试）：同变体两格逐像素几乎一致（宽窗平均差 0.03）；
  同变体相关 0.965 vs 异变体 0.933（相邻格不再逐像素相同）。
- 验收图：`.workbuddy/shots/v8942-terrain-compare.png`（前后对比 · 含湖区 2× 放大）、
  `v8942-terrain-tiles.png`（七张按显示尺度一览）。

**遗留（待老板拍板）**
- 平地上贴图（原 v41 口径为留白）——若嫌"野地不突出"，一例回退（把卫兵提回函数头即可）。
- 逐格镜像若觉不自然，可去掉 map.js 中那 3 行（退回"每格同图"）。
""", '需求档案 · v89.42', eol='\r\n')

# ============ ② 设计规范 ============
append(SPEC, """## 55. v89.42 野地贴图（即梦像素风裁切 · 地形贴图回归）（2026-09-19）

- **素材**：`assets/icons/ui/ai_terrain_{plain,caoyuan,zhaoze,lake,forest,desert,hill}.png` ——
  统一 **256×256**（与 ART_MAX 1:1）。来源＝三张即梦参考图裁切；
  SPEC（源图/中心/尺寸/调色）＝ `tools/asset/crop_terrain.py` 顶部表，**唯一可复跑入口**。
- **渲染管线（map.js · 与 v40/v50 同一条）**：`loadArt()` → 预缩放 ART_MAX(=256) →
  贴图阶段 `diaPath` 菱形裁切 → `blitArtRect`（cover · 源取中心 45%）→ ②b 顶棱 → 信息层。
  ⚠️ 口径：**真正上屏的是素材中心 45%×41% 的一条 2:1 带（约 115×53px）** ——
  裁切选点、调色、质检一律按这个窗口（"条带均色/纹理梯度"即指它）。
- **逐格镜像变体**：`texVariant(gx,gy)` → 0/1/2/3 = 原/横/竖/双镜像（Math.imul 混合哈希，确定性）。
  实现＝在 clip 之内、blitArtRect 之前做轴对齐镜像：
  `if (tv & 1) { ctx.translate(2*ab.x+ab.w, 0); ctx.scale(-1, 1); }`（竖向同理）。
  ⛔ 约束不变：**不得引入 rotate / setTransform**（v50 既定——真仿射会拧歪方向性纹理）。
- **平地口径变更**：v41"平地不放图形"的卫兵由"进函数即拦"下移为"矢量兜底前拦" ——
  平地现在也铺贴图；**素材缺席时仍留白**（语义原样）。回退＝把卫兵提回函数头。
- **回退链不变**：素材缺席 → `blitArtRect` 返回 false → `drawTerrainArt` 矢量兜底（白屏不可能）。
- **测试护栏（smoke §43）**：七张就位（256×256 PNG + 两两不同）/ 城池·据点 5 key 无素材 /
  `BITMAPS.fileOf('terrain', id)` 同步 / 变体函数存在且轴对齐 / 平地卫兵位置。
""", '设计规范 · §55', eol='\r\n')

# ============ ③ 工作备忘 ============
append(MEMO, """### 63. v89.42 · 野地贴图回归：从即梦参考图到七张上屏贴图（工程视角）

**背景**：v67 老板拍板删掉全部地形位图（12 张 · 写实风）→ 地形全程序化绘制。
v89.42 老板给出三张即梦图（老三国复古像素风）＋指令「根据截图，进行截取，改善野地 UI」——
路线回到位图（`map.js` 的 ART_KEYS 一直在请求 `ai_terrain_*`，补齐七张即自动回位）。

**流程（六步 · 可复跑）**
1. 侦察：读 map.js 贴图链路 + v67 清理记录 + smoke 护栏面 —— 先知道"接回来会撞哪几条断言"。
2. 选点：本环境无视觉通道 → 写扫描器（色彩谓词 + 积分图）按**中心条带纯净度**自动选窗口。
   条带＝素材中心 45%×41%（与 blitArtRect 同口径）—— 这是本批最关键的口径对齐：
   选点按"上屏的那块"选，而不是按整图观感选。
3. 裁切：统一 256×256；plain/zhaoze/lake 轻度调色；plain 另做 40% 柔化（设计语义：休息区）。
4. 落位：写 `assets/icons/ui/` → 重跑 `gen_bitmaps.js`（91→98）→ `node --check`。
5. 护栏改写：v67 两条旧断言（"一张都不剩"）**随新决定退役**，换六条新不变量（见设计规范 §55）。
6. 验收：真机截图 + 前后对比 + 单地形铺满测试（三重验证，见下）。

**踩坑四条（都值得记）**
- **file:// 下 canvas 被贴图"污染"**：`toDataURL` 抛 `SecurityError: Tainted canvases`——
  只要画过本地图片，读回像素就被拒。截图画布像素必须走**本地 HTTP 服务**（本仓 e2e 早有先例）。
- **静态服务的路径比较**：`path.join` 在 Windows 产出反斜杠，`fp.startsWith('E:/...')` 恒 false
  → 全 403、页面脚本全没加载（表现为 `GAME is not defined`）。比较前两边先 `path.resolve` 归一。
- **哈希要真混合**：首版 `(gx*A)^(gy*B)` 全局分布均匀（各 25%）但**空间上呈 4 周期对角规律**
  （3,2,1,0 循环）——"墙纸感"换成了"条纹感"。换 `Math.imul` 乘-异或-右移混合后，
  右邻同变体率才落回 25.0%（无周期）。
- **验收采样窗要避开 UI 叠层**：等级角标（顶部中）与名称条（下部中）会污染逐格取样 ——
  改"左右两翼"采样后，湖泊条带均色才从灰 #626462 归位为蓝 #446174（假数据全是这么来的）。

**基线（本批）**：audit 全 0 · smoke **2309/0** · e2e **946/0**；
`asset/crop_terrain.py --check` 输出与线上素材逐张同值（可复现性核验）；
变体独立性实测：同变体逐像素一致（宽窗平均差 0.03）、同变体相关 .965 vs 异变体 .933。
""", '工作备忘 · §63')

# ============ ④ 图标素材注册表 ============
edit(REG,
     r"""| 覆盖率 | **91/91**（建筑16 + 城外4 + 资源6 + 兵种18 + 材料24 + 装备12 + 物品11） |""",
     r"""| 覆盖率 | **98/98**（建筑16 + 城外4 + 资源6 + 兵种18 + 材料24 + 装备12 + 物品11 + **地形7**） |""",
     '注册表 · 覆盖率 91→98')

edit(REG,
     r"""| 地形 | `ai_terrain_` | 已出 2（城池/平原），其余保留矢量回退 | `ai_terrain_city.png` |""",
     r"""| 地形 | `ai_terrain_` | **7/7 就位**（v89.42 · 即梦像素风裁切 · 256×256）；城池/据点仍为绘图（无素材） | `ai_terrain_forest.png` |""",
     '注册表 · 地形行')

edit(REG,
     r"""- **地形 8 种**仅出了 2 个（城池/平原），其余 6 种（草原/沼泽/湖泊/森林/沙漠/山地）
  仍走矢量回退，需要时按 8.1 的 prompt 结构补 2 张图集""",
     r"""- ~~**地形 8 种**仅出了 2 个（城池/平原），其余 6 种仍走矢量回退~~ ✅ **v89.42 已完成**：
  七张地形贴图（平原/草原/沼泽/湖泊/森林/荒漠/山地 · 256×256）由**即梦像素风参考图裁切**就位
  （未走 8.1 图集路线）；城池/据点维持程序化绘图。裁切流水线＝`tools/asset/crop_terrain.py`（可复跑）。""",
     '注册表 · 待办销项')

# ============ ⑤ 项目地图 ============
edit(MAP, r"""├── assets\  （119.2MB）     素材：ui 91 张（运行时）· raw 33 + portraits/_raw 28（原料）""",
     r"""├── assets\  （119.2MB）     素材：ui 98 张（运行时 · 含 v89.42 地形贴图 7）· raw 33 + portraits/_raw 28（原料）""",
     '项目地图 · ui 91→98')
edit(MAP, r"""| **素材** | `assets/` | 119.2MB | `bitmaps.js` **91 ↔ 磁盘 91**，缺失 0 孤儿 0 |""",
     r"""| **素材** | `assets/` | 119.2MB | `bitmaps.js` **98 ↔ 磁盘 98**，缺失 0 孤儿 0 |""",
     '项目地图 · 登记表 98')
edit(MAP, r"""| `icons/ui` | 32.9MB | 91 | ✅ **运行时取图**（经 `bitmaps.js`）—— 不能动 |""",
     r"""| `icons/ui` | 33.6MB | 98 | ✅ **运行时取图**（经 `bitmaps.js`）—— 不能动 |""",
     '项目地图 · 素材拆解行')
edit(MAP, r"""├── 需求档案.md               老板的原始需求台账（v1→v89.41 · 含补录）""",
     r"""├── 需求档案.md               老板的原始需求台账（v1→v89.42 · 含补录）""",
     '项目地图 · 档案版本')
edit(MAP, r"""    ├── README_INDEX.md    ← 工具索引（81 个，自动生成）
    │   ├── patch\ 变更日志（12）· break\ 破坏测试（11）· probe\ 探针（17）
    │   ├── gen\ 生成器（4）    · asset\ 素材处理（8）· audit\ 审计核对（10）
    │   ├── mem\ 记忆维护（10） · show\ 展示校准（4）""",
     r"""    ├── README_INDEX.md    ← 工具索引（319 个，自动生成）
    │   ├── patch\ 变更日志（237）· break\ 破坏测试（17）· probe\ 探针（19）
    │   ├── gen\ 生成器（4）     · asset\ 素材处理（10）· audit\ 审计核对（12）
    │   ├── mem\ 记忆维护（10）  · show\ 展示校准（5）""",
     '项目地图 · 工具计数')

print('--- 校验 ---')
for p in (ARCH, SPEC, MEMO, REG, MAP):
    s = read(p)
    print('%-30s len=%d v89.42=%d' % (os.path.basename(p), len(s), s.count('v89.42')))
