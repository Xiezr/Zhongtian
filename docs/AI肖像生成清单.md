# AI 肖像生成清单与 prompt 模板（将领半身像 · 100 张）

> 用途：**将领半身像的生成规格书**。批量出 100 张新肖像时照此执行，确保彼此一致、且与现有资产同族。
> 配套：`docs/AI图标生成清单.md`（图标版同族文档）· `.workbuddy/tools/asset/avatar_atlas.py`（切分抠底管线）
> · `.workbuddy/shots/ui-review/sheet-pool.png`（现有池拼图，**验收比对基准**）。

**怎么用（30 秒）**：
① 【实际工具 = 单文本框 + ≤6 参考图】传固定 6 张「风格尺」（`.workbuddy/tmp/avatars/refs/ref-*.png`）→ 粘贴 §2.5 单框模板 → 出图。
② 其他工具：复制 §2.2 图集模板（一张出 4 个，成本 ÷4）或 §2.1 单张模板。
③ 过 §6 管线（切分 → 抠底 → 紧裁 → 512 WebP），按 §7 与 `sheet-pool.png` 并排验收。

---

## 一、统一风格基线（从现有资产提炼）

**提炼依据**（口径不是拍脑袋，全部可复核）：

| 依据 | 内容 |
|---|---|
| 现有 40 张池实测 | 色相 H 10°–68°（均值 31°，**暖琥珀族**）· 饱和 S 6%–33%（均值 16%，**低饱和**）· 明度 L 23%–74%（均值 38%，**中低调**）；透明底；人物外接框约占画幅 90%（上下留白 4–6%） |
| 管线约束（avatar_atlas.py） | 胸像**纵向近满格**、**横向不许触边**；背景必须浅色平整（min ≥ 222）才能连通域抠底 |
| 项目口径（UI设计交接.md / portraits.js） | 头像池 = **写实古风人物**（半身、脸居中）；侧光方向 = **左上方单光源**；与图标同属「暗金木质」家族 |

### 1.1 品质锚点（每条 prompt 必须带）

```
refined semi-realistic game art, in the style of Rise of Kingdoms /
Three Kingdoms strategy games — painterly and matte, NOT anime, NOT cartoon,
NOT glossy 3D render
```

### 1.2 固定技术项（每条必须带，防规格漂移）

```
half-body bust portrait (head to mid-chest, cut cleanly at the chest),
face centered, small margin above the head, slight three-quarter view,
warm golden key light from the upper left, warm earthy muted palette
(bronze / oxblood / jade / antique gold), one perfectly flat uniform
light warm-grey background (#f2f0ee) with no gradient / no scenery /
no ground shadow / no vignette, no text, no watermark, no signature,
no frame, no border, no dividing lines
```

### 1.3 统一负面项

```
no anime, no cartoon, no 3D render look, no cold blue cast, no neon,
no fantasy armor, no samurai / European medieval elements, no modern objects,
no text, no watermark, no signature
```

### 1.4 汉代形制词库（按角色取用；**不要写笼统的 “ancient Chinese”**）

| 类别 | 必须点明的形制 |
|---|---|
| 甲胄 | **札甲 lamellar armor**（漆皮/铁甲片 + 绑绳）、披膊/护肩 pauldron、**兜鍪** iron helmet with neck guard、红缨 red tassel |
| 服饰 | 曲裾深衣 quju shenyi robe、交领右衽 crossed collar、腰束革带 leather belt、玉佩 jade pendant |
| 冠巾 | 进贤冠 civil official's cap、纶巾 black silk head wrap、束发 topknot、皮弁 |
| 道具（限框内） | 环首刀 ring-pommel sword、羽扇、竹简 bamboo scroll |
| 配色 | 朱红 oxblood、赭石 ochre、青铜 bronze、苍绿 grey-green、黛蓝 dark blue-grey（少用）、象牙 ivory |

---

## 二、主提示词模板

> **实际工具是「单文本框 + ≤6 参考图」→ 直接用 §2.5**；§2.1–2.4 为通用备用模板。

### 2.1 单张版（直接复制，替换 `<…>`）

```
A half-body bust portrait of <角色描述：一句话，如 a rugged warrior general in his mid-30s>,
a historical figure from China's Three Kingdoms period in Han-dynasty costume.

STYLE: refined semi-realistic game art in the style of Rise of Kingdoms / Three
Kingdoms strategy games — painterly brushwork, matte finish, highly detailed
materials (armor plates, fabric weave, hair strands, weathered skin); NOT anime,
NOT cartoon, NOT glossy 3D render.

COMPOSITION: head to mid-chest only, cut cleanly at the chest; face centered with
a small margin above the head; head turned slightly for a gentle three-quarter
view, eyes toward the viewer; exactly one person; nothing cropped at the frame
edges and no props crossing them.

LIGHTING: warm golden key light from the upper left, soft ambient fill from the
lower right; the left side of the face is brighter.

PALETTE: warm earthy harmony — warm amber skin, deep bronze, oxblood red, jade
green, antique gold; muted and dignified; no cold blue cast, no neon, no
oversaturated colors.

BACKGROUND: one perfectly flat, uniform light warm-grey (#f2f0ee); absolutely
plain — no gradient, no texture, no scenery, no sky, no cast shadow, no vignette.

FORBIDDEN: text, watermark, signature, frame, border, UI elements; no fantasy
armor, no samurai or European medieval elements, no modern objects.
```

### 2.2 图集版 2×2（**推荐**：一张出 4 张，成本 ÷4）

```
A 2x2 grid of 4 separate half-body bust portraits of four DIFFERENT historical
figures from China's Three Kingdoms period (Han-dynasty costume), arranged in a
perfect square grid with wide flat uniform light warm-grey gaps; each portrait
centered within its own quadrant, head to mid-chest, spanning nearly the full
height of its quadrant, not touching the left or right edges of its quadrant.

Top-left: <角色 1>
Top-right: <角色 2>
Bottom-left: <角色 3>
Bottom-right: <角色 4>

All four portraits share one identical art style: refined semi-realistic game art
in the style of Rise of Kingdoms / Three Kingdoms strategy games — painterly,
matte finish, warm golden key light from the upper left, warm earthy muted
palette (bronze / oxblood / jade / antique gold), highly detailed materials;
NOT anime, NOT cartoon, NOT glossy 3D render.

IMPORTANT: the entire background including all the gaps must be one perfectly
flat uniform light warm-grey (#f2f0ee) — no gradient, no scenery, no sky,
no shadows, no vignette. No text, no labels, no borders, no frames, no dividing
lines, no watermark, no signature.
```

### 2.3 填写示例（三个角色槽，可直接使用）

| 角色 | 槽位文本（英文） |
|---|---|
| 猛将（男·壮年） | a rugged warrior general in his mid-30s, battle-hardened, wearing dark lamellar armor with oxblood-red lacquered plates and bronze clasps, an iron lamellar helmet with a red tassel, short bristling beard, thick brows, a faint scar on one cheekbone, fierce resolute gaze |
| 谋士（男·中年） | a slender middle-aged strategist, calm and shrewd, wearing a dark grey-green robe over a white inner collar with a black silk head wrap, thin mustache and goatee, holding a bamboo scroll, faint knowing expression |
| 女将（女·青年） | a young woman commander in her early 20s, valiant and composed, wearing light lamellar armor over an oxblood under-robe with a fur-trimmed shoulder cape, black hair in a high warrior's knot with a red ribbon, clear determined eyes |

### 2.4 中文锚定块（备选：仅当工具吃中文时）

```
中国三国时期历史人物半身胸像：头至胸口、胸口处干净截断，面部居中、头顶留一线空隙；
半写实游戏原画风（三国策略游戏同族质感），细腻笔触、哑光质感，非动漫、非卡通透亮 3D；
暖金色主光自左上方来，面部左侧更亮；暖调大地色系（青铜/朱红/苍绿/古金），低饱和、沉稳；
纯平浅暖灰背景 (#f2f0ee)，无渐变、无场景、无投影；无文字、无水印、无边框；画中仅一人。
```

### 2.5 单文本框 + ≤6 参考图（**实际工具 · 用这个**）

> 工具约束：**只有一个文本框 + 最多 6 张参考图**（无独立负面框、无参数面板）。
> 分工据此调整：**风格一致性交给参考图（「风格尺」），文本只写「画什么 + 硬约束」**。

#### ① 六张参考图 = 一套固定的「风格尺」（整批 100 张不换）

- **推荐 6 张**（从池 40 张定量筛出）：`m06 · m08 · m09 · f06 · f08 · f10`（男 3 + 女 3）
- 备选（可随时替换）：`m05 · m12 · f05 · f20`
- 筛选口径：标准度（与全池色相/饱和/明度均值的归一化距离最小）＋ 锐度（≥ 全池 25 分位，防糊图）＋ 边缘无抠底残留（防脏边）。
- **上传前处理**：透明底 → 铺浅暖灰 `#f2f0ee` 导出（防工具把透明区域渲染成黑底，同时暗示目标底色）。
  **已备好**：`.workbuddy/tmp/avatars/refs/ref-*.png`（铺底版 512×512，直接上传）；复核用全池一览 `pool-refsheet.png`（金框 = 推荐）。
- ⚠️ **整批只用这一套，中途不换** —— 换参考图 = 风格漂移。

#### ② 单框精简模板（无独立负面框，负面写进正文）

中文（首选）：
```
中国三国时期<角色一句话>半身像：头至胸口、胸口干净截断，面部居中、头顶留一线空隙；
画风严格参考所给参考图（半写实游戏原画、暖金色左上方光、暖调低饱和），
参考图只用于画风与光影、不要照搬其中人物长相；
纯浅暖灰背景、无场景无渐变；画中仅一人，无文字、无水印、无边框。
```

英文（工具吃英文时）：
```
Half-body bust portrait of <character>, a Three Kingdoms period Chinese general.
Match the art style of the reference images (semi-realistic game art, warm golden
light from the upper left, warm muted palette) — STYLE reference only, do NOT copy
the faces. Head to chest, face centered, cleanly cut at the chest; plain light
warm-grey background, no scenery; one person only, no text, no watermark, no border.
```

#### ③ 两个小试（决定 100 张的出图节奏）

1. **单张试**：6 张参考图 + ② 模板填一个角色 → 看是否「贴池」（光影/色温/背景干净）。
2. **四格试**（关键）：用下面这段，看能否稳定输出 2×2 四格（不裁切、不跨格）——
   成了 → 100 张 = **25 次生成**；不成就退回单张（100 次）。

```
四格拼图：4 张不同的中国三国人物半身像，2×2 均匀排布、格间留宽缝，
每格一人（头至胸口、不裁切、不跨格、横不触边）。
左上：<角色1>
右上：<角色2>
左下：<角色3>
右下：<角色4>
画风严格参考所给参考图（半写实游戏原画、暖金色左上方光、暖调低饱和），
只参考画风与光影、不照搬人物长相；
整图背景（含缝隙）为纯浅暖灰 #f2f0ee，无渐变无场景；无文字、无水印、无边框、无分隔线。
```

#### ④ 单框 + 参考图专属风险与对策

| 风险 | 对策 |
|---|---|
| 工具把参考图当「人物参考」（照搬参考人物长相） | 文本保留「只参考画风、不照搬长相」；必要时把参考图减到 3 张 |
| 透明底参考图被渲染成黑底、色调被带偏 | 用铺底版 `ref-*.png` 上传（已备好） |
| 无独立负面框、负面词被忽略 | 负面已写进正文末句；仍出现则把该负面词前置到第 2 句 |
| 四格与参考图冲突（出不来格子 / 被裁） | 先做 ③-2 的四格试；不成就退回单张模式 |

**换参考图 / 重生成**：改 `.workbuddy/tools/asset/make_portrait_refs.py` 顶部 `REC/ALT` 名单后重跑。

---

## 三、角色槽位词库（差异只从这四轴来）

### 3.1 身份原型 → 服饰/甲胄（可直接粘贴）

| 原型 | 英文槽 |
|---|---|
| 猛将 | rugged warrior general, dark lamellar armor with lacquered plates, iron helmet with red tassel |
| 统帅 | commanding general in ornate lamellar armor with shoulder pauldrons, crimson war cloak |
| 谋士 | slender strategist, grey-green scholar's robe, black silk head wrap, bamboo scroll |
| 文臣 | dignified civil official, civil official's cap, layered quju robe, jade belt and pendant |
| 君主 | lordly ruler, layered ceremonial robe with gold trim, ornate headdress, calm authority |
| 宿将/老将 | veteran general in his 60s, white beard, weathered face, well-used but solid armor |
| 少年武将 | young warrior around 18, topknot, clean-shaven, light armor, bright fearless eyes |
| 女将 | woman commander, light lamellar armor over an oxblood robe, high warrior's knot with red ribbon |
| 美人 | elegant beauty, elaborate updo with hairpins, flowing quju robe, delicate features |
| 少女 | young girl, simple hanfu, twin buns, lively eyes |
| 文士女子 | scholarly woman, plain robe, book scroll, serene expression |

### 3.2 年龄

`around 17–18` · `in his/her early 20s` · `late 20s` · `mid-30s` · `mid-40s` · `in his/her 50s` · `in his 60s`

### 3.3 面容与须发

- 须：`clean-shaven` / `thin mustache` / `short beard` / `long flowing beard` / `full beard` / `white-streaked beard`
- 眉：`sharp brows` / `thick brows` / `gentle brows`
- 脸型：`round face` / `angular face` / `high cheekbones`
- 肤色：`warm amber skin` / `slightly tanned` / `fair`

### 3.4 神态

`stern and resolute` · `calm and shrewd` · `commanding` · `benevolent` · `proud` · `weary but steady` · `faint knowing smile` · `fierce`

### 3.5（可选）语义编码——让图自带信息

游戏立绘层有两条语义规则（`portraits.js`）：**甲胄主色 = 四维最高项**（勇武赤 / 智谋青 / 统率金 / 内政绿）、**冠帽等级 = 资质**（布巾 → 束发 → 皮冠 → 银冠 → 金冠）。
- **通用池不需要**（随机分配，与属性无关）；
- 若这批图用于**名将专属层**（`hero_*`），可按此编码，但饱和度须压在 30% 以内以免破坏暖调一致性。

---

## 四、100 张编成方案（默认：男 50 + 女 50 = 25 张图集）

### 4.1 图集分配表（默认建议，可整表调整）

**男 12 图集（48 张）+ 女 12 图集（48 张）+ 混合 1 图集（2男2女）= 100 张**

| # | 性别 | 原型族 | 四格变化要点 |
|---|---|---|---|
| M1 | 男 | 猛将·青年 | 脸型 / 须（无·短髭）/ 甲色深浅 / 神情 —— **至少三项拉开** |
| M2 | 男 | 猛将·壮年 | 同上 |
| M3 | 男 | 统帅·披甲 | 披膊 · 披风 · 沉稳气质 |
| M4 | 男 | 统帅·中年 | 同上 |
| M5 | 男 | 谋士·清瘦 | 纶巾 · 竹简/羽扇 |
| M6 | 男 | 谋士·中年 | 同上 |
| M7 | 男 | 文臣·端方 | 进贤冠 · 曲裾深衣 |
| M8 | 男 | 文臣·瘦峭 | 同上 |
| M9 | 男 | 宿将·老将 | 白须 · 旧甲 · 苍劲 |
| M10 | 男 | 宗室·君主 | 华丽绛袍 · 威仪 |
| M11 | 男 | 边地武人 | 皮裘 · 风霜色 |
| M12 | 男 | 少年武将 | 束发 · 清俊 |
| F1 | 女 | 女将·重甲 | 轻札甲 · 披风 |
| F2 | 女 | 女将·轻装 | 高髻束发 · 短甲 |
| F3 | 女 | 智谋女子 | 纶巾/素袍 · 军师气 |
| F4 | 女 | 文士女子 | 曲裾 · 书卷 |
| F5 | 女 | 美人·华贵 | 步摇 · 高髻 · 华服 |
| F6 | 女 | 美人·清雅 | 素衣淡妆 |
| F7 | 女 | 少女 | 双髻 · 灵动 |
| F8 | 女 | 夫人·端庄 | 贵妇仪态 |
| F9 | 女 | 女侠·劲装 | 短打 · 干练 |
| F10 | 女 | 医女/术士 | 素巾 · 药具 |
| F11 | 女 | 胡女/异域 | 异域发饰 |
| F12 | 女 | 宫装女子 | 宫装华饰 |
| X1 | 混 | 补边缘档（2男2女） | 任意组合，补齐总数 |

> 男女比例可调（现有池即 50/50）；若想整图集单一性别，可改 男 13 + 女 12。

### 4.2 命名与落位

| 方案 | 文件名 | 代码同步 |
|---|---|---|
| **A · 扩充**（接在现有 20 位后） | `m21–m70` / `f21–f70` | `js/portraits.js` 中 `for (var i = 1; i <= 20; i++)` → `<= 70`（**一处**） |
| **B · 新池替换** | `m01–m50` / `f01–f50` | 同上，`<= 20` → `<= 50` |

- 产物落位：`assets/portraits/pool/{m,f}NN.webp`（512×512 WebP）。
- 图集原图（过程产物）：`.workbuddy/tmp/avatars/`，用完即清。

### 4.3 同一图集内防重脸（重要）

四格必须是**四个不同的人**：脸型 / 须发 / 神情 / 甲色深浅 —— 至少三项拉开；年龄可在原型族内 ±5 岁浮动。

### 4.4 示例：一张图集的完整填写（M1 猛将·青年）

```
A 2x2 grid of 4 separate half-body bust portraits of four DIFFERENT historical
figures from China's Three Kingdoms period (Han-dynasty costume), arranged in a
perfect square grid with wide flat uniform light warm-grey gaps; each portrait
centered within its own quadrant, head to mid-chest, spanning nearly the full
height of its quadrant, not touching the left or right edges of its quadrant.

Top-left: a young warrior general around 17, round face, clean-shaven, light
lamellar armor with ochre plates, topknot, bright fearless eyes
Top-right: a young warrior general around 22, angular face, thin mustache, dark
iron lamellar armor, short hair under a simple leather cap, piercing gaze
Bottom-left: a young warrior general around 25, high cheekbones, short beard,
ochre-brown lamellar armor with bronze clasps, faint scar, calm expression
Bottom-right: a young warrior general around 20, broad face, clean-shaven, dark
red lacquered lamellar armor, iron helmet, confident slight smile

All four portraits share one identical art style: refined semi-realistic game art
in the style of Rise of Kingdoms / Three Kingdoms strategy games — painterly,
matte finish, warm golden key light from the upper left, warm earthy muted
palette (bronze / oxblood / jade / antique gold), highly detailed materials;
NOT anime, NOT cartoon, NOT glossy 3D render.

IMPORTANT: the entire background including all the gaps must be one perfectly
flat uniform light warm-grey (#f2f0ee) — no gradient, no scenery, no sky,
no shadows, no vignette. No text, no labels, no borders, no frames, no dividing
lines, no watermark, no signature.
```

---

## 五、生成参数

| 项 | 值 | 说明 |
|---|---|---|
| size（图集） | `1024x1024` | 切分后每格 512×512 |
| size（单张） | `1024x1024` | 重采样到 512 |
| quality | `high` | 必须；medium 细节不足 |
| background | **不设 `transparent`**（项目实测不生效） | 出浅暖灰底再抠 |
| 工具 | **单文本框 + ≤6 参考图 → 见 §2.5**；其他工具照本文口径 | 本项目管线按"浅底 + 2×2 图集"假设 |

---

## 六、后处理管线（复用 `avatar_atlas.py`，勿新写）

```
# ① 体检（不通过不切）
 python E:/Deepseekdb/.workbuddy/tools/asset/avatar_atlas.py check <图集1.png> <图集2.png> ...
# ② 切分 + 抠底 + 紧裁 + 落库（男/女、起始编号）
 python E:/Deepseekdb/.workbuddy/tools/asset/avatar_atlas.py split <图集.png> m 21
```

- 机理：象限均分（内缩 2%）→ **连通域洪水填充抠底**（TOL 46，护住白衣玉饰）→ 按 alpha 收紧居中（pad 3.5%，**全池脸大小统一的关键**）→ 512×512 WebP q90。
- 脚本内置体检判据：背景 min≥222 / 人物占格≥26% / 横向触边警告。
- ⚠️ 首次全量前**先备份 `pool/`**；或把脚本 `POOL` 常量临时指向 staging 目录试跑一张图集。
- 依赖：`C:\Users\18811\.workbuddy\binaries\python\envs\default`（Pillow + numpy）。

---

## 七、验收判据

### 7.1 数值带（对 512 终产物跑；参照现有 40 张实测）

| 指标 | 合格带 | 说明 |
|---|---|---|
| 抠后不透明占比 | 40%–86%（均 ~55%） | 太低 = 主体小；太高 = 没抠净 |
| 人物外接框 | 约占画幅 90%，上下留白 4–6% | 紧裁后应自动达标 |
| 色相 H | 10°–70°，批均值 28°–34° | 暖琥珀族 |
| 饱和 S | 6%–33%，批均值 ≤ 20% | 低饱和雅致 |
| 明度 L | 23%–74%，批均值 35%–45% | 中低调 |
| 格式 | 512×512 WebP · 带 alpha | 与现有池一致 |

### 7.2 人工比对（不可省）

每出一批（4–8 张）拼一张总览（`tile_show.js` 同款做法，数据源换 `pool/` 目录），与 `.workbuddy/shots/ui-review/sheet-pool.png` 并排看四项：**光影方向 · 色温 · 脸的大小 · 切胸位置**。

### 7.3 首批校准动作

出第一批 1 张图集（4 张；参考图模式按 §2.5③ 先做单张试 + 四格试）→ 过管线 → 与 `sheet-pool.png` 并排比对 → 若色温/光影有偏：参考图模式**先换候选参考图**（§2.5① 备选），文本模式微调 §1.2 锚定块（不动 §1.1 品质锚点）。

---

## 八、常见漂移与修法

| 症状 | 修法（加到对应 prompt 段） |
|---|---|
| 画面发冷 / 偏蓝 | 强化 `warm golden light, no cold blue cast` |
| 背景有渐变 / 阴影 | 强化 §2 模板的 IMPORTANT 段；体检偏差 >30 直接拒收 |
| 脸被裁 / 太满 | `small margin above the head; nothing cropped at the top` |
| 动漫脸 / 塑料 3D 感 | 强化 `NOT anime, NOT cartoon, NOT glossy 3D render` |
| 图集里多人合体 / 串格 | 四格描述逐格写清；加 `four separate individuals` |
| 出框残肢 / 兵器 | `nothing cropped at the frame edges; props stay fully inside` |
| 甲胄混入日式 / 欧式 | 用 §1.4 形制词库点名（lamellar armor / 兜鍪 / 曲裾…） |

---

## 九、与既有资产的关系（出图前先知道）

1. 现有 70 张分两批：**池 40**（透明底、胸像，v43 批次）+ **名将 30**（不透明方图，更早批次）——本就不是同一批，自带风格差。
2. 新 100 张按本文口径出 = **第三个批次**。建议新批与旧池 40 张做拼图对比；若差异肉眼可见，二选一：
   ① 用同一套 prompt 重出旧池 40 张（彻底统一）；② 新旧共存（优先保新批内部一致）。
3. 名将 30 张若也要统一，同口径另起一轮（数量小，可用 §2.1 单张模式逐张出）。

---

## 十、批次与进度

| 批次 | 内容 | 图集数 | 张数 | 状态 |
|---|---|---|---|---|
| B0 | 校准双试（§2.5③：单张试 + 四格试） | 1 | 2~4 | 待办 |
| B1 | 男 12 图集 | 12 | 48 | 待办 |
| B2 | 女 12 图集 | 12 | 48 | 待办 |
| B3 | 混合 1 图集 | 1 | 4 | 待办 |
| — | **合计** | **25** | **100** | |

**成本估算**：图集模式 25 次生成（vs 单张 100 次），按每张 5~10 积分 ≈ **125~250 积分**，比逐张出省约 75%。
