# AI 图标生成清单 · 废土版（废土·余烬纪元）

> **用途**：全量位图重绘的生成规格书。**本文件是 v89.222 起的新规格**；汉代版
> `docs/AI图标生成清单.md` 保留作**史料**，不再用于生成。
> 配套：`.workbuddy/tools/asset/wasteland_batches.json`（批次唯一真相源）·
> `docs/图标素材注册表.md`（落位台账）· `docs/图标适配流程.md`（接入流程）。
>
> **背景**：v89.214/216/217 已把**文案层**与**矢量回退层**换到「废土·余烬纪元」，
> 但**最高优先级的位图层**（UI 优先显示）仍是汉代风 —— 本规格即重绘这批 103 张位图。
> **同名原地覆盖**（不改文件名，零 JS 改动），驱动见 `gen/wasteland_batch.js`。

---

## 〇、生成总则（先读）

| 项 | 值 |
|---|---|
| 世界 | **废土·余烬纪元**：大崩坏后的废土上重建文明，旧世科技遗存 + 拼装改造 |
| 核心气质 | 锈蚀金属 · 水泥 · 帆布/拼接板 · 旧世电子遗物 · 荒草浑水；**残破但有生气** |
| 不做 | 不做纯灰暗废墟；**每张需有高饱和点缀**（信号布/告警灯/锈红/荒草绿）以保可辨性 |
| 位图优先 | UI 优先显示位图，矢量是回退层 —— 位图重绘后**玩家看到的即是新图** |
| 文件名 | **原地同名覆盖**，不改名；图集 id 见 `wasteland_batches.json` |

---

## 一、统一风格基线（每条 prompt 都必须带）

**品质锚点**（写进 prompt 才有游戏级质感）：
```
Refined realistic game art, post-apocalyptic wasteland strategy game aesthetic
(salvaged rusty steel, cracked concrete, tarp and scrap-metal, old-world tech ruins),
in the polish class of Rise of Kingdoms / high-end mobile strategy games
```

**废土形制词库**（按元素取用，**不要用笼统的 "post-apocalyptic" 一笔带过**）：
| 类别 | 必须点明的形制 |
|---|---|
| 屋顶 | **波纹锈铁顶**（corrugated rusted iron）/ **帆布棚顶**（tarp canopy）/ **拼接板房顶**（scrap-sheet roof）、压边条、铆钉 |
| 结构 | **裸露钢梁**（exposed steel I-beam）、**桁架**（truss）、**铆钉工字钢**、回收钢管支架、脚手架 |
| 墙体 | **水泥墙**（cracked concrete）、**波纹钢板**（corrugated steel）、**集装箱瓦楞**、旧砖、涂鸦/锈迹 |
| 台基 | 碎裂水泥台、钢板踏道、沙袋、废旧轮胎挡边 |
| 装甲 | **焊接废钢拼装甲**（welded scrap plates）、**铆钉护面**、破旧护目镜/防毒面具、战术背心、绑带 |
| 兵器 | **链锯剑**（chainsaw blade）、**动力刃**（powered blade）、**铁管长矛**（pipe spear）、**改装枪械**、撬棍 |
| 载具 | **摩托**（两轮+车架+油箱+车把+前灯）、**装甲车**（履带/车轮+铆钉装甲板）、牵引拖车 |
| 器物 | **电路板**（circuit board）、**燃油桶**（oil drum）、**报废芯片**（scrap chip）、**旧世遗物**（old-world relic）、电池、信号灯 |
| 点缀色 | **锈红** `#a8543a` · **告警黄** `#d8b23c` · **荒草绿** `#a8b06a` · **浑水青蓝** `#8fbcca` · **信号布红** `#b23b2e` |

**固定技术项**（每条都带，与汉代版**完全相同** —— 避免出图规格漂移）：
```
isolated on a plain solid pure white background (#ffffff), no text, no watermark,
no frame, no border, no ground shadow, centered composition, slight three-quarter
isometric view, warm golden light from upper left, soft ambient occlusion,
highly detailed material textures, crisp clean edges suitable for a small UI icon
```

**统一负面项**：`no people face, no logo, no signature, no anime, no cartoon, no glossy plastic`

---

## 二、生成参数

| 项 | 值 | 说明 |
|---|---|---|
| size | `1024x1024`（贴图 `256×256`） | 方图，缩放后用于 64~128px 图标 |
| quality | `high` | 必须，medium 细节不足 |
| background | 不设或 `opaque` | **`transparent` 实测不生效**（透底率 0），统一出白底再抠 |
| 图集 | **2×2 四格** | 一张图集出 4 个图标（省成本）；见 §十二 |
| 输出目录 | `assets/icons/raw/` | AI 原图 |
| 抠底输出 | `assets/icons/ui/` | 命名 `ai_<id>.png`（**同名覆盖**） |

**抠底流程**：
- 通用/兵种/材料/装备：`gen/atlas_split.js`（四角采样 `T=46` / 羽化 `SOFT=28`）
- **建筑**：`asset/split_atlas.py`（**连通域洪水填充**，只抠与边缘连通的白底 → **不伤内部浅色墙**）
- 复检：透底率 > 50%，且「主体占宽/占高」**不应为 100%**（= 没抠干净）。

---

## 三、建筑 16 座（**方式 = 图生图 i2i**；**逐座 ≥4 种材质**）

> ⚠ **坑区铁律**：历史上建筑图标被连投诉 4 轮「颜色不对劲」，根因是**单色剪影**
> （图内色散仅 7°），染任何色都像色块。**修法 = 材质自然（多材质）+ 贴族旗**。
> - **每座必须枚举 ≥4 种不同材质**（锈铁顶 + 水泥墙 + 木脚手架 + 高饱和信号/旗），
>   **用构造保证图内色散 ≥15°**（`smoke:10892` 判据）。
> - 生成后**必贴族旗**（`asset/flag_bldg_icons.py`，读 `DATA.SERIES[].flag`），
>   每张图须含自己族的旗色（`smoke:10944`）。
> - 走 **i2i**：用 `build_atlas_src.py` 把现有 16 张拼成 4 张白底图集，喂图生图
>   "**同角度同轮廓，只换材质**"，保引擎已调的机位。

| id | 现名 | 废土形制描述（核心句） |
|---|---|---|
| guanfu | 政务厅 | 混凝土主楼 + 波纹锈铁顶 + 裸露钢梁门廊 + **红布族旗与横幅**、旧世广播喇叭、沙袋工事、告警灯 |
| minfang | 居所 | 拼接板房/水泥小屋、帆布顶补丁、锈铁烟囱、晾衣绳、门前**彩色信号旗**、旧轮胎 |
| shuyuan | 研习所 | 水泥/砖混两层、钢窗、门内可见**黑板与旧书卷**、门口回收钢管旗杆挂信号布 |
| junying | 训练营 | 数顶帆布军帐 + 拼接板棚、铁管拒马、**军旗**、武器架（铁管矛/改装枪）、沙袋掩体 |
| xiaochang | 练兵场 | 靶标（锈铁人形靶）、武器架、水泥指挥台、沙地、**晨练场旗**、锈鼓/警钟 |
| shichang | 交易站 | 帆布摊位 + 拼接板棚、铁皮货箱、地秤、**招牌幌子**、粮食袋、油桶货堆 |
| cangku | 货仓 | 波纹铁皮大仓、集装箱门、**钢架货垛**、油桶、封条与挂锁、仓号牌 |
| chengqiang | 围墙 | 水泥/钢板墙断面、铁丝网与垛口、钢制闸门、岗楼、**探照灯与信号旗** |
| yizhan | 补给站 | 钢架门架、帆布顶棚、油桶与补给箱、**挂式前灯与木轮/旧轮**、草料/物资堆 |
| fenghuotai | 瞭望塔 | 钢结构高塔 + 水泥基座、顶部**信号火盆与浓烟**、天线/探照灯、爬梯、旗 |
| majiu | 车库 | 钢架敞棚、长工作台、油桶、**一架摩托剪影与挂墙工具**、轮胎堆 |
| kezhan | 酒馆 | 两层拼接板楼、**霓虹/灯箱招牌**、帆布遮阳棚、门前旧桌凳、串灯 |
| zhaoxianguan | 招募站 | 水泥门楼 + 张贴告示栏、钢梯、两侧**信号灯**、旧世牌匾、排队栏 |
| honglusi | 派系驻地 | 钢制门坊、演武/训练场、武器架、**派系旗帜**、水泥台阶、涂鸦墙 |
| tiejiangpu | 锻造间 | 通红炉火、铁砧、鼓风机、水槽、重锤与夹钳、悬挂的**动力刃半成品** |
| gongjiangzuofang | 机工坊 | 钢工作台、电锯/焊机/扳手、**半成品车轮与引擎件**、油污、堆放钢材 |

---

## 四、城外资源地 4 种（方式 = 文生图 t2i）

| id | 现名 | 废土形制描述 |
|---|---|---|
| farm | 集水场 | 旧世水塔底盘上的**集水槽与滤网**、滴灌管、作物苗床（荒草绿点缀）、铁皮水桶 |
| forest | 木料场 | 几株耐荒的枯树/再生林、树桩、堆放的**去皮圆木与树枝**、旧伐木锯、林间碎石径 |
| quarry | 碎石场 | 爆破采石坑、凿痕岩壁、**碎石堆与铁皮粉碎机**、钢钎与撬棍、临时钢管架 |
| mine | 废铁场 | 矿洞（钢支撑拱）、**矿石车与旧轨道**、铁镐/钻机、矿渣堆、头灯 |

## 五、资源 6 种

| id | 现名 | 废土形制描述 |
|---|---|---|
| grain | 净水/粮 | **铁皮水箱与净水桶**、封装粮袋、量斗、水滴点缀 |
| wood | 木料 | 数段去皮圆木与板材堆、旧锯、木屑、绑扎钢带 |
| stone | 建材 | 混凝土块/碎石堆、废弃路缘石、凿痕碎屑 |
| iron | 废铁 | 铁矿石块与**锈铁锭**、旧钢件、锈迹与金属反光 |
| gold | 货币 | **旧世硬币与军规代币**、金属弹药箱、结算用金属筹码 |
| pop | 人口 | 废土平民一家（拼接布衣 + 护目镜）、**背包与工具**（非深衣） |

## 六、兵种 18 种（方式 = 文生图 t2i）

统一基线：**焊接废钢拼装甲 + 护目镜/面罩 + 绑带 + 战靴**，差异体现在**武器、载具与姿态**。
（v89.216 调色板已定 **马 → 机车**。）

| id | 现名 | 差异点 |
|---|---|---|
| minfu | 搬运工 | 拼接布衣、扁担与铁皮箱、无甲 |
| yibing | 民兵 | 简易拼装钢甲、锈铁刀 + 木板盾 |
| chihou | 侦察兵 | 轻装 + 护目镜、**背负电台与望远镜**、疾行姿态 |
| changqiang | 长矛手 | 拼装甲、**铁管长矛**、直立持握 |
| daodun | 盾卫 | 拼装甲、锈铁刀 + **钢制防暴盾**（涂装警示条） |
| gongjian | 弩手 | 轻甲、**改装弩/撬棍弓**、箭袋 |
| qingji | 摩托游骑 | 轻装甲骑手 + **摩托**（两轮/车架/油箱/前灯）、短矛 |
| tieji | 装甲战车 | 重拼装甲 + **履带装甲车**（铆钉装甲板）、长枪管 |
| zhouche | 运输车 | **履带运输车** + 车斗物资、短刀 |
| chuangnu | 重弩车 | **车载大型重弩**（钢架 + 绞盘）、两名操作兵 |
| chongche | 破门车 | **钢制破门车**（撞木 + 装甲顶棚）、推车兵 |
| toudan | 迫击炮 | **迫击炮组**（炮管 + 底座 + 炮弹）、射手姿态 |
| qingzhoubing | 旧军残部 | 残存制式装甲、长枪、**褪色军旗披风**、队列感 |
| tengjiabing | 防暴甲兵 | 防暴拼装甲 + 面罩、警棍/链锯棍 |
| tuqibing | 突击摩托 | **快速摩托** + 骑手、长柄兵器 |
| hubaoqi | 王牌战车 | **重装战车** + 兽纹涂装、精甲、护目面罩带兽纹 |
| xiliangtieqi | 重甲战车 | 重装甲战车、长炮管、附加装甲板 |
| nanjiangxiangbing | 变异巨兽 | **披甲变异巨兽**（象/巨兽）+ 背上射手与弩 |

## 七、材料 24 种（6 系 × 4 品阶；方式 = 文生图 t2i）

**同系共用形状，品阶靠材质升级**（不是换色）。现名已换皮，形制随之：

| 系 | 形状基线 | 品阶递进（现名） |
|---|---|---|
| iron 铁 | 铁锭 / 矿石 | 粗铁(粗铸) → 精铁(细锻) → **钢锭**(流水纹) → 陨铁(暗银星纹) |
| wood 木 | 圆木段 / 板材 | 松木 → 硬木(细密) → 铁木(深褐) → **复合材**(科技层压纹) |
| leather 革 | 皮张卷 | 生皮 → 熟皮(硝制) → 硬甲皮(厚鳞) → **变异皮**(异色鳞光) |
| sinew 筋 | 盘绕筋束 | 兽筋 → 牛筋 → 巨兽筋(粗韧) → **泰坦筋**(暗金光泽) |
| jade 玉 | 玉璧 / 宝石 | 河石 → 青玉 → 羊脂玉(温润) → 昆山玉(内蕴光华) |
| silk 丝 | 布卷 | **帆布**(粗纤) → 细布(平滑) → 织锦(织纹) → 云缎(金线云纹) |

> id 与现名对照：`fatie 粗铁 · jingtie 精铁 · bintie 钢锭 · yuntie 陨铁 · songmu 松木 ·
> nanmu 硬木 · tanmu 铁木 · jianmu 复合材 · cuge 生皮 · xiaoge 熟皮 · xige 硬甲皮 ·
> jiaoge 变异皮 · shoujin 兽筋 · niujin 牛筋 · jiaojin 巨兽筋 · longjin 泰坦筋 ·
> heshi 河石 · qingyu 青玉 · yangzhi 羊脂玉 · kunshan 昆山玉 · mabu 帆布 · xijuan 细布 ·
> shujin 织锦 · yunjin 云缎`

## 八、装备 12 部位（现名见 `DATA.EQUIP_SLOT_NAMES`）

| id | 现名 | 废土形制描述 |
|---|---|---|
| weapon | 武器 | **链锯剑 / 动力刃**（机油与齿刃、旧世科技） |
| head | 头盔 | 焊接废钢护面 + **防毒面具/护目镜** + 警示涂装 |
| chest | 战铠 | 拼装钢板胸甲 + 铆钉 + 绑带 |
| shoulder | 肩铠 | 铆钉护肩板 + 破布垫衬 |
| arm | 臂甲 | 皮护臂 + 钢板条 + 腕部工具扣 |
| waist | 腰甲 | 战术腰带 + 弹匣袋/工具挂 + 金属扣 |
| feet | 战靴 | 加固战靴/旧世军靴 |
| back | 披风 | **褪色军旗披风**（旧世界标志） |
| neck | 坠饰 | 金属牌/旧世界信物挂链 |
| ring | 戒指 | 淬火钢环 / 旧世戒指 |
| pendant | 佩饰 | **战术铭牌/遗物坠**（旧世科技纹） |
| mount | 座驾 | **越野机车装备**（油箱、车把、前灯、加固件） |

## 九、物品 11 类（现名已换皮）

| id | 现名 | 废土形制描述 |
|---|---|---|
| jewel | 珠宝 | 珍珠/琥珀/**琉璃珠/夜光珠**串 |
| blueprint | 图纸 | **旧世工程蓝晒图 / 数据板** |
| prod_buff | 生产 | **集水塔 / 电锯组 / 破碎机**等装置件（图标取一组） |
| military_buff | 军事 | **冲锋号 / 掩体图 / 战地医典**（图标取一组） |
| boost | 加速 | **旧世计时器 / 加速模块** |
| exp | 经验 | **练兵数据卡 / 军官手记** |
| stamina | 体力 | **强效针剂 / 急救血清**（针管与药瓶） |
| perm | 永久 | **军规代币 / 指挥芯片** |
| mount_buff | 座驾 | **油门拉杆 / 强化底盘 / 动力核心组** |
| attr_buff | 属性 | **芯片 / 矩阵芯片**（电路板形态） |
| build_cost | 古籍 | **旧世施工档案 / 工程数据** |

## 十、新增槽位（"生成更多" · 阶段 6）

| 组 | 数量 | 说明 | 需改代码 |
|---|---|---|---|
| tech 科技 | 24 | `DATA.TECH`（`js/data.js:1170`）**无 icon 字段**，界面纯文字 → 补 `ai_tech_<id>.png` | `data.js` 加 icon + `icons.js` 加 `ICON.forTech` + 科技面板接线 |
| collect 收藏 | 18 | `DATA.COLLECT.series[].icon` 现 emoji → 换 `ai_collect_<seriesid>.png` | `data.js` 换 icon + 渲染处 |

科技图标形制：**旧世科技/工程符号化装置**（种植=集水/水培、冶炼=熔炉、侦察=雷达、城防=堡垒图…），统一废土材质 + 单色信号点缀。

---

## 十一、批次表（与 `wasteland_batches.json` 一一对应）

| 批次 | 内容 | 数量 | 图集数 | 方式 | 状态 |
|---|---|---|---|---|---|
| W-B1 | 建筑 16 | 16 | 4 | **i2i** + 贴旗 | 待办（试点） |
| W-B2 | 城外 4 + 资源 6 | 10 | 3 | t2i | 待办 |
| W-B3 | 兵种 18 | 18 | 5 | t2i | 待办（试点） |
| W-B4 | 材料 24 | 24 | 6 | t2i | 待办 |
| W-B5 | 装备 12 + 物品 11 | 23 | 6 | t2i | 待办 |
| W-T1 | 地形 7 | 7 | — | crop | 待办（需参考图） |
| W-T2 | 城池 4 | 4 | — | crop | 待办（需参考图） |
| W-T3 | 据点 1 | 1 | — | crop | 待办（需参考图） |
| — | **合计** | **103** | **24** | | |

**试点 = W-B1 + W-B3（建筑 16 + 兵种 18 = 34）**：跑通全环后再铺其余。

**成本估算**：每图集 5~10 积分 → 24 图集约 **120~240 积分**；贴图参考图另计。

---

## 十二、图集生成方式（怎么出 2×2）

**通用图集 prompt 模板**（t2i，四类材质/兵种拼一张）：
```
A 2x2 grid of four separate <类别> icons for a post-apocalyptic wasteland strategy game,
each centered in its own quadrant on a plain solid pure white background (#ffffff),
evenly spaced, no dividing lines, no text, no watermark, no border, no ground shadow,
slight three-quarter isometric view, warm golden light from upper left, soft ambient
occlusion, highly detailed material textures, crisp clean edges.
Top-left: <id1 描述>. Top-right: <id2 描述>. Bottom-left: <id3 描述>. Bottom-right: <id4 描述>.
```

**建筑图集**（i2i）：先用 `python .workbuddy/tools/asset/build_atlas_src.py` 拼出 4 张白底源图集
（`atlas_A/B/C/D_src.png`，源取 `_gold_backup/`），再喂 image-edit：
```
Keep the exact same camera angle, silhouette and composition of each building.
Convert ALL materials from Han-dynasty (grey tile roof, vermilion wood pillars, rammed
earth, bronze) to post-apocalyptic wasteland: corrugated rusted-iron roofs, exposed steel
I-beams and trusses, cracked concrete walls, weathered scrap-sheet paneling, oil drums,
salvaged old-world tech, warning-signal accents in rust-red / warning-yellow.
Use at least 4 clearly distinct materials per building so the color range is rich.
Plain pure white background (#ffffff), no text/watermark/frame, keep it as 4 icons in a
2x2 grid, same layout, crisply separated.
```

---

## 十三、抠底 → 切分 → 入库（可复跑管线）

```bash
# ① 通用/兵种/材料/装备/物品：四等分 + 四角采样抠底
node .workbuddy/tools/gen/atlas_split.js <图集.png> <id1,id2,id3,id4>

# ② 建筑：连通域洪水填充抠底（不伤内部浅色墙）+ 打印色散新旧对照
python .workbuddy/tools/asset/split_atlas.py <图集.png> A|B|C|D [--install]
# ③ 建筑：贴族旗（读 data.js 的 DATA.SERIES[].flag），当场验 7 色两两 ΔE00 ≥15
python .workbuddy/tools/asset/flag_bldg_icons.py

# ④ 批驱动：一次跑一批图集 + 装前门禁（见 §十四）
node .workbuddy/tools/gen/wasteland_batch.js --batch W-B1 --check   # 只体检
node .workbuddy/tools/gen/wasteland_batch.js --batch W-B1 --apply   # 体检过才装

# ⑤ 重生成登记表（文件名不变则应逐字节相同）
node .workbuddy/tools/gen/gen_bitmaps.js
```

**贴图**（地形/城池/据点，走 crop 非图集）：改 `crop_terrain.py` / `crop_city.py` 的
`SRC`/`SPEC` 表（只改数据），保持**零调色铁律**（禁色相/柔化），输出 **256×256**，
按**中心 45%×41% 条带**评分选坐标。

---

## 十四、校验判据（装配前必过）

| 判据 | 阈值 | 镜像的测试 |
|---|---|---|
| 建筑图内色散 | 平均 **≥15°** | `smoke:10892` |
| 每张建筑含族旗色 | ΔE00 **≤12** | `smoke:10944` |
| 每族均色离地色 `#8b9a78` | ΔE00 **≥12** | `smoke:10928` |
| 七旗色两两 | ΔE00 **≥15** | `smoke:10909` |
| 贴图尺寸 | **恰好 256×256** | `smoke:10535/10562/10575` |
| 7 地形两两不同 | md5 | `smoke:10548` |
| alpha 覆盖率 | 26%~95% | 装前体检 |
| 背景角 ΔE00 | <15 | 抠底质量 |
| `ICON.layerOf(type,id)` | **'bitmap'**（零 vector） | 回退完整性 |
| `GAME.map.artCount()` | **12** | 贴图落位 |

**全绿门禁**：`node audit.js`（0）· `node smoke-test.js` · `NODE_PATH=... node e2e-test.js`。

---

## 十五、进度

| 批次 | 状态 | 负责人 |
|---|---|---|
| W-B1 建筑 16 | 待生成 | 【外部】老板 → 切图入库 |
| W-B3 兵种 18 | 待生成 | 【外部】老板 → 切图入库 |
| W-B2/B4/B5 | 待办 | 试点通过后 |
| W-T1/T2/T3 贴图 | 待办（需参考图） | 试点通过后 |
| 阶段 6 新增（科技 24 / 收藏 18） | 待办 | 全量后 |

> **诚实缺口**：本文件**不含任何像素** —— 生成在外部工具（WorkBuddy image-edit / 即梦）。
> 本文件的价值是"喂什么 prompt + 出什么规格 + 怎么验"，把返工挡在装机之前。
