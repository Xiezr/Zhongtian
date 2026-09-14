# -*- coding: utf-8 -*-
"""v67 记忆整理：MEMORY.md 压回注入上限内，明细下移到 docs/AI工作备忘.md。

触发原因：MEMORY.md 11761 字符 → 会话注入在 9668 字符处被截断（≈9.7k 上限），
§七 之后的内容（体力链、遗留、待拍板）根本进不了上下文。**过大的记忆 = 尾部规则失效。**

做法（沿用 v65/v66 的老规矩）：
  ① 把「单一出口全量清单 / 界面细目 / 待拍板积压」迁到 `docs/AI工作备忘.md`；
  ② MEMORY.md 只留"每次动手都要遵守"的规则 + 指向文档的指针；
  ③ 断言最终字符数 < 9600，否则报错。
"""
import io, os

MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\MEMORY.md'
DOC = r'E:\Deepseekdb\docs\AI工作备忘.md'

# ---------- ① 追加到工作备忘 ----------
ADD = '''

## 10.4 v67：清理脚本与"半截收尾"的教训（2026-09-14）

**事故**：`cleanup_v67.py` 的"保留清单"文件名写在 tmp 的**子目录**里，脚本只在顶层
`os.listdir` 里找它 → 白名单全落空 → 该保留的一并进了删除列表。**实际损失为零**
（搬运先于删除 + 脚本被重复执行），但这是一次真·侥幸。—— 由此定三条硬规矩（已进 MEMORY §二）：

1. **清理脚本先干跑**：只打印「将删 N / 将留 M + 逐条理由」，人工确认后才落盘。
2. **保留清单用"白名单路径集合"，且脚本里断言它非空** ——"清单没读进来"必须表现为**崩溃**，
   不能表现为"全都可删"。**"空集"是最危险的默认值。**
3. **删除前对候选集做引用 grep**：文档/技能/记忆里出现过的名字 → 降级为"搬移"。

**事故 2**：`finish_cleanup_v67.py` 在「合并旧文档」处被中断 —— 合并件写出了、**9 份原件没删**、
路径转接与文字订正全没跑。表现是"看起来做完了，其实半截"。
**对策**：长收尾脚本要拆成**每步可单独重跑 + 每步幂等 + 末尾打印做了什么**；
每步都带**锚点断言** —— 第二次执行时锚点已被替换，正好用来判断"这步做过了"而不是再改一遍。

**事故 3（复核手法）**：`re.search` 替换 HTML 时**先打印实际匹配到的原文**再替换，
别假设自己写对了边界。本次靠打印发现"匹配段比预期短"，逐字核对后确认 `<code>` 标签 5/5 配平。

**教训沉淀 · 清理的判据顺序**：
`先 grep 引用 → 再分"搬 / 留 / 删"三档 → 删之前复核（能逐行比对就逐行比对）→ 最后才是删`。
**"过程产物"里往往混着"下次还要用的工具"**，所以 v67 起可复用工具一律进 `.workbuddy/tools/`。

---

# 从 MEMORY.md 继续迁出（v67 · 2026-09-14）

## 十一、单一出口全量清单（"一个概念只允许一个取值口"）

判据：**同一份数据被复制两份、只改一处** 是本项目最常见的失效模式。
**新增出口必须登记到本清单**；新增属性同时要接消费点（写完先问「谁读它」）。

| 域 | 出口 |
|---|---|
| 资源/库存 | `GAME.res(city)`（城池库存，唯一口）· `resName` · `storeCapOf` · `U.amtHTML/amtText`（存量短写） |
| 城池派生 | `cityLabel` · `cityPlanOf`（满配布局，唯一来源）· `planPopCapOf` · `fortDefOf` · `planHTML`（布局呈现）· `totalPop` · `cityProdPerSec` · `foodPerSecOf` · `buildCapOf` |
| 未占据城池 | `npcCityRes` / `npcCityShadow` / `npcCityGuard`（全部派生，不入存档）· `npcBuildLvOf`（建筑等级）· `fortRaidedToday` / `markFortRaided`（每日掠夺） |
| 将领 | `genAttrs` · `genCityOf`（将领在哪座城）· `genSlotsOf` / `generalsIn` / `genFreeOf` / `genSlotsTotal`（席位按城）· `normalizeGenCities` · `expNeedOf` · `battleExp` · `expBlockOf` / `expBlocked`（经验道具能否用） |
| 加成链 | `mastery` / `masteryOf`（专精）· `setProgressOf` · `tacticOf` · `perkOf` / `perkNum`（名城档位优势）· `guardBonus(city)`（守将加成，**只认本城**）· `arrowTowerRange` · `towerCountOf` / `towersFromDef` / `towersBuiltOf`（箭塔）· `cityDefenseBase` |
| 体力（v66 收链） | `staBaseMax`（等级/资质/内政那一份）· `staEquipOf`（装备+套装那一份）· `staMax`（= 两者之和）· `staNow` / `setStaNow`（**体力收支**）· `staHpPct(pool)`（池子→全军生命，双曲唯一公式） |
| 野外/出征 | `releaseGuardsOf` · `wildAddOf` · `wildDefenseAt` · `expModeLockOf`（出征方式锁定） |
| 情报 | `intelTiersOf`（侦查分层）· `resReportOf` / `buildReportOf`（侦查报告） |
| 缺粮 | `mutinyOf`（哗变 20%/24h）· `starveStep`（在线离线共用） |
| 城墙/施工 | `wallPendingOf`（城墙是否在队列） |
| **v67 新增** | `cityRefsOf(cityId)`（**城池伴随数据登记表**）· `abandonCity(cityId)`（放弃城池单出口） |

⚠️ **不要写"出口包装"**（`genAtkVal(g) = genAttrs(g).atkVal`）—— audit 会报死函数。要出口就出**原子**。

## 十二、界面细目（尺寸 / 断点 / 位置）

- **将领页三块布局**：`.gp-body` 左＝六维/状态、右＝装备栏（`.92fr/1.08fr`），`.gp-head` 横贯全宽。
  断点按视口宽：≤1300 装备栏堆叠、≤1100 上下排、≤900 全单列。左清单**姓名一行、资质一行**（行高 ≈47px）。
- **装备栏人形**：槽位 54×54、人形框 300×380、**`min-width:230px` 是方槽不重叠的硬下限**；
  `ui.DOLL_POS` 5 行 × 3 列 —— **改槽位边长或框尺寸都要回来核**。
  **右侧只放「装备提供」的逐行清单**（`.eq-grow`），**没有带装总数行**（`.eq-sum` 已删）。
- **共享选择器**：标题 `.gold-heading,.m-title,.map-title`｜分区 `.q-sec-t,.bag-sec,.gd-sec,.forge-q,.m-sec,.side-title,.wb-t`｜
  页脚 `.m-foot,.modal-foot,.panel-foot`｜容器 `.ui-page`｜描边一律**发丝级半透明白 `--line`**。
- **列表列数**：商城整页 `.shop-rows` 4 列 / 铁匠铺弹窗 `.forge-rows` 3 列，**各有唯一来源，写死**。

## 十三、待拍板积压（按轮次，等老板一句话）

- **v66**：① **客栈面板滚动条**（非该轮引入）：12 位候选时超出弹窗 94~157px，`.inn-list` 还自带 46vh
  内部下拉条 —— 不砍内容/不改版式消不掉；② 装备体力是否也参与出征消耗（现为"常备额度"）；
  ③ 体力曲线是否重调（装备齐全者全军生命已顶到 +73%，`hpCap`/`hpK` 是唯一旋钮）；
  ④ 到上限后**战斗经验**是否也停发（该轮只停了经验道具）。
- **v63~v65**：名城人口量级与兵力倍数；据点一览每页 6 行是否够；0 级城墙在自动升级里最先被修；
  席位超编是否处理；**资源短写阈值**（我取 1 万/1 亿，老板原话写 1000）；野外城池是否也要"建筑默认满级"；
  侦查两页的切分方式。
- **旧积压**：装备攻防 ×10 是否压、防御侧 0.9 截断；一城一守将是否改全境单一守将位；
  器械是否要军营等级；将领每页席数；自动出征是否只在线驱动；`MARCH_UNIT` / `grow` /
  `gatherPowerCap` / 对冲常数 / `FORT.density`；**低级野地是否给保底经验**。
- **v67 新增**：资产第七节那批「拍板才能删的大件」（`icons/raw` 38MB、`portraits/_raw` 41MB、
  `pd_src` 2.9MB、12 张未接线图标 15.9MB）；是否补**存档导出/导入**（现在只有 localStorage，
  换机器/清缓存即丢）。
'''
doc = io.open(DOC, encoding='utf-8', newline='').read()
doc = doc.rstrip('\n') + '\n' + ADD
io.open(DOC, 'w', encoding='utf-8', newline='').write(doc)
print('① 工作备忘：+%d 字符（现 %d）' % (len(ADD), len(doc)))

# ---------- ② 重写 MEMORY.md ----------
MEM_NEW = '''# 项目长期记忆 · 热血三国复刻（E:\\Deepseekdb）

纯前端单机游戏，15 个 JS 模块 + index.html + localStorage，无后端无数据库。
数值来源：《热血三国数值系统检索报告》（`docs/`）。
模块链：data → questdata → state → systems → domain → map → battle → tactic →
icons → gicons → bitmaps → portraits → story → ui → main

> **这个文件只放"每次动手都要遵守"的规则。**
> 案例现场、实测数字、逐轮明细、**单一出口全量清单**、界面细目、待拍板积压
> → `docs/AI工作备忘.md`（§三/§八/§十一/§十二/§十三）· `docs/vNN改动说明.md` ·
> `docs/资产清理记录_v67.md` · 每日日志。
> ⚠️ 本文件**必须 < 9600 字符** —— 超出会在会话注入时被截断，尾部规则等于不存在。

## 一、强制约定

0. **⛔ 不主动承揽视觉/美术优化**（v50：「不能再相信你的图形设计能力了」）。
   根因是这个循环本身是坏的：我读不了图 → 靠像素指标反推"好不好看" → 老板当我的眼睛。
   **指标能量"均匀/可比/不重叠/不溢出"，量不出"好看"。** 只做三类：
   ① 程序正确性（不重叠、拾取命中、密铺无空洞、不越界、**弹窗不溢出不出滚动条**）；
   ② 可调系数暴露成一处常量表让老板拧；③ 忠实执行明确指令，不夹带审美判断。
   **要"砍内容/改版式"才能不溢出时 → 只交实测数字与选项**（v66 客栈面板即如此处理）。
1. **改动后必须跑三件套**（缺一不可）：`node audit.js` · `node smoke-test.js`（现 **1861**）·
   `NODE_PATH='…\\node\\workspace\\node_modules' node e2e-test.js`（真实 DOM，现 **652**）。
   ① smoke 的 DOM stub **不支持 querySelector** → 生产代码用 `$('#id')`；
   ② e2e 必须走内置 HTTP（jsdom 在 `file://` 下 localStorage 抛异常）；
   ③ **e2e 要连"是否中断"一起看** —— 顶层异常被 catch 后仍打"0 失败"，中断点之后没跑。
   audit 补"该写而没写"；几何探针补"jsdom 没有布局引擎"。
2. **JS 局部变量不跨文件共享**；`data.js` 早于 `state.js` 加载，不能用 `GAME.utils`。
3. **派生数据不入存档**（`map.grid`/`map.cities`/野外城池/NPC 库藏守将）→ 读档重建。
   判据：运行中从不被修改 = 纯派生。（曾入档致 9MB 超配额，`saveGame()` 静默失败。）
4. 存档失败必须 `console.warn`，不得静默 catch。
5. 时间倍率默认 120×（1/10/30/120/300/600）；建造最小现实 5 秒保底。
6. 数值显示两套：`U.fmt`（缩写）｜`U.numHTML/numText`（千分位精确值）｜增速统一 `U.rateHTML` 按 **/秒**。
7. **补丁守卫查「定义形态」**：`indexOf('GAME.foo = function')`，不能用 `indexOf('GAME.foo')`。
8. **一个概念只允许一个取值口**（最常见失效模式＝同一份数据复制两份、只改一处）。
   **全量清单 → 备忘「十一」**；新增出口必须登记。v67 新增：`cityRefsOf`（城池伴随数据登记表）·
   `abandonCity`（放弃城池单出口）。
9. **新增属性必须同时接消费点**：写完先问「谁读它」，否则就是死属性。
10. **加内容 = 加数据不改业务代码**：图标走 bitmaps 注册表、材料 `DATA.MATERIALS`、
    任务 `DATA.QUESTS`、出征方式 `DATA.EXPEDITION.modes`、名城优势 `DATA.CITY_PERK`、
    名城选项 `DATA.CITY_OPTS`、阵位 `DATA.STANCES`。

## 二、环境

- node `…\\node\\versions\\22.22.2-3\\node.exe`；python 隔离 venv `…\\python\\envs\\default`（PIL 12/numpy/webp）
- 隔离 workspace `…\\node\\workspace\\node_modules`（jsdom / playwright-core / pngjs，勿污染系统）
- **bash 必须补 PATH**：`export PATH="/c/Users/18811/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:$PATH"`
- 截图：playwright-core + 系统 Edge（`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`）
- **PowerShell 输出被吞** → 一律 Bash；**bash 的 grep 输出也不可信**（有缓存）→ 复核代码用 python 读盘
- 写文件用 Write/Edit，**不要 heredoc**；打补丁/破坏测试一律**写 .py 脚本再执行**
- ⛔ **同一条消息里对同一文件的多次 Edit 会互相覆盖**：一条消息只改一处；多处改动写 .py 补丁；
  改完**必须跑落盘核验脚本**（模板 `.workbuddy/tools/verify_v66_edits.py`），别信编辑工具的返回值。
- **Python 写项目文件一律 `newline=''`**（默认把 `\\n` 转 `\\r\\n`，毁掉依赖 `\\n` 的跨行正则）
- **工具与产物的家（v67 起）**：一次性探针 → `.workbuddy/tmp/`（**用完即清**）；可复用的
  （几何探针/破坏测试/生成器/落盘核验）→ `.workbuddy/tools/`（42 个），**文档引用一律写 tools 路径**；
  验收截图 → `.workbuddy/shots/`。
- ⛔ **清理脚本先干跑再落盘**：先打印「将删 N / 将留 M + 逐条理由」；**保留清单必须是白名单路径集合，
  且脚本里断言它非空**（空白名单要表现为**崩溃**，不能表现为"全都可删"）；删除前对候选集做**引用 grep**，
  被文档点名的降级为"搬移"。长收尾脚本要**每步幂等可单跑 + 末尾打印做了什么**（中断后能接着跑）。

## 三、核心机制 / 四、界面规范

「三、核心机制」与「八、界面与玩法约定」明细 → 备忘。这里只留 active 判据：

- 排版令牌**只准 7 档**（`--fs-h1/h2/h3/body/lead/sub/cap`），禁止裸 px（图标除外）。
- 弹窗一律 `ui.openShell({title,sub,body,foot,size})`，**四档真值**：`sm 440×420` / 默认 `660×620` /
  `lg 860×600` / `xl 960×min(700px,88vh)`；矮屏（`max-height:860px`）md/lg 78vh、**xl 90vh**。
  **关闭一律在弹窗底部，没有右上角 ×**；底部若无关闭动作则自动补「关闭」。
  **弹窗内禁止下拉条，一律分页**（`ui.modalPage`）；`.op-zone` 与 `.op-zone.danger` 必须分开。
  ⚠️ **弹窗正文高度是最稀缺资源**（720p 实测上限 550px）：**说明性文字一律进 `ui.help()`**。
- **列表列数写死、不做"变窄降列"断点**（v51 根因：老板 1366~1440 的屏正好落进降级档）。
  **列宽决定折行数、折行数决定卡片高** → "塞更多列"往往**反而更少件数**；**调列数前先量卡片高**。
- **公文分页**：战报 8（`ui.DOC_PER`）/ 消息 15（`ui.MSG_PER`）；分页条走独立 `ui.msgPager`，
  **绝不能塞进 `ui.msgLines`**（它被主循环每秒调用）。
- **界面像素尺寸必须固定**：`grid-template-columns` 禁 `vw`；可滚容器加 `scrollbar-gutter: stable`。
- **绝对定位「居中」不用 `left:50%+translateX(-50%)`**（shrink-to-fit 会挤窄）→
  ✅ `left:0; right:0; margin:0 auto; width:fit-content; max-width:...`。
- 分页 `ui.pageOf`+`ui.pagerHTML`；**绕过 renderView 的重绘必须走 `ui.repaintView(fn)`**。
- **全站不用下拉框** → `ui.chips/chipSet/genChips`，**点选后不重绘**（只切 class + 写隐藏域）；
  唯一例外：侧栏城池清单用原生 `<select class="city-select">`（smoke 锁死 1 处），
  click 委托必须对 SELECT 直接放行。
- **整屏棋盘禁止滚动条**（`.ui-page.city-pure { padding: 0 }`）；但**"该滚的地方要敢滚"**。
  判据：**长列表要么分页要么滚动 —— 不能既长又只露一点**。
- **重要功能入口不许放在面板末尾**（v45：官府改名按钮落到折叠线以下 → 老板认定"没有改名功能"）。
  **到上限/不可用时按钮转暗但不禁用**（v66 经验＋按钮）—— 点得开、看得到原因。
- **城池改名**：第一次改名把原名存 `city.origName`，**凡按名字认身份的地方一律读 `origName || name`**。
- **物品/宝物卡的备注是「两个出口」重灾区**：效果文案只留 `it.desc`，价格归 meta。
  **商城卡片不放分类名、不显示「可买 N」**。
- 布局：城内/城外棋盘**仍是正方形网格**（只有地图改菱形）；建筑图标**居中填满格子**；
  **暗色界面禁用 drop-shadow 表层级**；**`.main` 只允许一份规则**。
- 归属：城池视图「看的」占中央、「操作的」进侧栏；侧栏**只讲当前城池**；
  信息分层判据：**「怎么运作/怎么操作」= 备注删，「当前事实是什么」= 信息留**；
  呈现用**账册感**（`ui.lgSec/lgRow`），不要卡片网格。
- **资源/人口/将领都归属城池** —— 侧栏栏首写"本城"、将领页默认只列本城将领；
  **点地图上的自家城池弹「城池面板」**（进入/运输/派遣/改名），不直接进城。
- **地图 = 菱形等距**，四条硬约束（明细 → 备忘「九」）：几何**唯一来源** `gxy/diaPath/diaBox/sideSides`；
  **按 `gx+gy` 升序绘制**；密铺无垂直空隙（厚度感靠顶面内侧 AO）；拾取 = 反投影 + `Math.round`，
  用 `canvas.clientWidth` 并**扣掉 3px 边框**。
- 将领页三块布局 / 装备栏人形尺寸与断点 → 备忘「十二」。

### 配色（量化判据）

- **大面积底色用「色差绝对值」**：`max-min ≤ 38`。**不要用 HSL 的 S**（接近白时虚高）。
- 四套主题：正文对比度 ≥ 7:1、次要文字 ≥ 4.5:1、层级亮度单调递进（`.workbuddy/tools/audit_colors.js`）。
- 深色主题**不要用纯黑**；层级靠**亮度递进**，不靠阴影。
- **⛔ 绝不要「用 CSS 滤镜给位图染色」**（v39~v44 四轮返工的根因）→ ✅ **像素级 HSL 重映射写进 PNG 本身**
  （`.workbuddy/tools/recolor_buildings.py`，`restore` 可还原）。两条铁律：① 色相走**增量**
  `H_new = H_orig + Δ`；② 饱和度只微调（gain 夹 `[0.85,1.18]`、上限 0.50）。
- **建筑 7 族目标平均色相**：工商 12° · 仓廪 32° · 官署 46° · 民居 74° · 文教 132° · 军事 196° · 驿传 250°；
  饱和 36~40%、明度 24~43%。判据「色相≥18° **或** 明度≥6% **或** 饱和度≥8%」三选一。
- 城外资源图标**只做 brightness 提亮**；**回归护栏**：smoke 有「解码 PNG 像素」实测断言。

## 五、素材与图标（明细 → `docs/图标素材注册表.md` / `图标适配流程.md`）

**路线：AI 位图为主 → `gicons` 矢量 → `icons` 手绘兜底**（老板三次否决矢量路线）。
取图在 `ICON.get/forEquip/forItem` 三入口各加一行位图优先；**位图不套 `wrap()`**；
`js/bitmaps.js` 自动生成、**勿手改**。**新增图标只改台账 + 生成脚本，不碰业务代码。**

**生成 prompt 三条铁律**：① **锁纯白底**（写明 no gradient/sky/haze/ground plane）；
② `background:"transparent"` **不生效**，必须抠底后处理（四角采样 T=42、羽化 26）；
③ 复检**同时看透底率与主体占宽占高**（**≥99% 就是没抠净**）。降本：2×2 图集生成再切分。

- **换素材源前先 grep「绕过图标层的专属渲染器」**（官府走 `ui.govPalaceHTML()` 内联 SVG）。
- **分层断言必须锚在「层」上**（`ICON.raw` / `ICON.layerOf`），锚最终输出会假绿。
- **头像**：通用池 `assets/portraits/pool/{m,f}01-20.webp`（40 张）；`P.fileOf` 三层取图；
  分配按「将领名 seed 取模」；君主也走同池（`ruler.portraitSeed` 存存档）。
  **抠底必须用连通域洪水填充（BFS）**，不能用全局颜色距离。
- 回退层 `assets/portraits/hero_<key>.webp` + `P.HERO_FILE`，仅池子被清空时启用。

## 六、踩坑 · 验证手法（明细 → 备忘「六」「七」「十」）

- **改代码**：删函数按花括号配对定位（禁「找下一个 `};`」）；补丁必须幂等且守卫盯**插入物**而非锚点。
- **CSS 覆盖**：同权重更靠后的组合规则会静默盖掉你写的值（`.eq-cell` 的 padding 盖过 `.doll-slot`）；
  尺寸不对先查这个。
- **写测试的四条铁律**（同一个坑的四个面，已踩 10 次）：
  ① **计数/「不许出现」的断言必须先过 `stripComment`**（含 HTML 注释也要剥）；
  ② **位置型断言不许用写死的字符窗口** → 用 `fnBody(src,decl)` / `cssBlock(css,sel)` / `codeOf`，
     并断言「取到的段长 > N」防"空串静默通过"；
  ③ **禁恒真断言**；行为断言必须**能翻转**（破坏一处实现确认它会红 —— 红不了就是装饰）；
  ④ **分母为 0 的绿 = 什么都没测**：统计型判据要同时打分子分母。
- **夹具必须能区分被测对象**（v66 又栽一次）：e2e"体力主数字 = 上限"用满体力当夹具 →
  实现改回"取当前值"时**零反应**；改成"当前 ≠ 上限"立刻红。
- **断言别写死字面量**：`/gd-line">体力/` 在行里加 `title` 后失配 → 用 `/gd-line"[^>]*>体力/`。
- **业务函数断言要先装 state**：`G.newGame()` 只返回 state，**不装进 `GAME.state`**；
  不装就操作到上节残留的 state（"拒绝了"其实是"背包没有"）→ **同时校验拒绝理由**。
- **验证**：jsdom 无布局引擎 → 尺寸/重叠/溢出只能在**真浏览器**量（模板 `.workbuddy/tools/probe60_geom.js`，
  v66 的 `probe66_ui.js` 加了"逐行折行"量法）；`page.screenshot({clip})` 超过视口会**静默截断**；
  **视觉类结论必须出对照图交人眼，模型读不了图就不要自己下结论**。
- **破坏测试**：注入一律写 `.py` 脚本；跑之前**先校验断言确实在文件里**；
  注入后**连"是否中断"一起看**；收尾必须 md5 比对还原。
  ⚠️ **备份目录会把之后的修改一起还原掉**（v66 栽过）：改完夹具要删旧备份再跑。
- **清理/收尾脚本**（v67 新坑，详见备忘 10.4）：**先干跑**；白名单**非空断言**；
  被文档点名的只搬不删；长脚本**每步幂等可单跑**。

## 七、将领属性 → 军队加成

**换算链**：`1 勇武 = 10 攻击值` · `1 智谋 = 10 防御值` · `每 10 攻/防值 = 全军攻/防 +1%`。
不走 `1 + yw/100` 直接进乘区，而是「属性 → 攻防值 → 百分比」，**装备/套装的 atk/def 并入同一条链**。

- 常量 `GAME.ATK_PER_YW / DEF_PER_ZM / PCT_PER_ATK / PCT_PER_DEF`（都是 10）；
  **换算原子** `atkValOf / defValOf / pctOfVal`；`genAttrs` 内部调用它们产出
  `a.atkVal/defVal/atkPct/defPct`（**必须在符类 buff 之后算**）。
- **消费点只有两处**：`battle.js` 的 `atkMult = 1 + a.atkPct × cover`、`defBonus/atkDefBonus += a.defPct`。
- ⚠️ **不要写"出口包装"**（`genAtkVal(g)=genAttrs(g).atkVal`）—— audit 报死函数。要出口就出**原子**。

### 体力链（v29 立第六维 · v66 收成一条链）

```
体力上限 staMax = staBaseMax（100 + 等级×资质×内政） + staEquipOf（装备 sta + 套装件 + 套装档位）
全军生命加成 = staHpPct(体力) = 0.8 × 体力 / (体力 + 800)        ← 渐近 +80%
```

- ⛔ **装备体力只能走这一条链**：`battle.hpMultOf` 里那条并行的 `eqHp = min(0.25, 装备体力/10000)`
  **v66 已删**（同一个数两个出口 = 老板看到"体力没加上装备"的根因）。
- 装备/散件的体力字段是 **`sta`**（源数据表 3.6/3.7 的「体力」列；v66 前叫 `hp`，已全仓改名）；
  打造散件 `DATA.Q_STA = {1:80, 2:220, 3:420, 4:700}`。
- `g.stamina` 存的是**"等级那一份的余量"**：装备体力是**常备额度**（换装即得、卸装即失、
  不因出征消耗）→ 不会出现"刚穿上装备体力条只剩 8%"。
  要改成"一起消耗"只动 `staNow` / `setStaNow` 两处。
- **体力收支唯一口**：读 `staNow`、写 `setStaNow`（出征/侦查/采集/门槛/止血散全走它）。
- 弹性：满装倚天 12 件 → 体力 9,368、全军生命 +73.7%；空手天授 Lv240 → +58%。
  **装备齐全者都挤在 +73% 附近**，要拉开梯度就调 `DATA.STAMINA.hpCap / hpK`（唯一旋钮）。

## 八、遗留

- 未开发：**计谋 18 计、官职三职位、联盟、结拜/婚姻/迁都/称帝**；**联盟楼**是最后一座装饰建筑。
- 数值断层：官府 Lv10 满农田仅养义兵约 5.3 万，攻洛阳需约 20 万混编（单城路线封死）。
- **待拍板积压 → 备忘「十三」**（客栈面板滚动条；装备体力是否参与出征消耗；体力曲线是否重调；
  到上限后战斗经验是否停发；资源短写阈值；名城人口量级；野外城是否满级建筑；
  **是否补存档导出/导入**；v67 那批"拍板才能删的大件"）。
- **存档现状**：`localStorage` 键 `sanguo_save_v3`（主档）+ `sanguo_meta_v3`（首页轻量索引）；
  关网页/关浏览器都在，但**换浏览器、清缓存、换来源（`file://` vs http）即丢**；
  自动存档 5 分钟（`AUTO_SAVE_MS`）；**当前没有导出/导入**。
- 素材：地形剩 6 种走矢量回退；位图 38MB（分发需转 WebP）；**貂蝉/小乔公版画像已备未启用**。
- 工程卫生：smoke 缺第 3 节、e2e 有重复编号，章节编号需重排。
- v60 未做：陷阱/拒马/滚木/擂石（老板指示不做）；运输车队动画；每座城独有材料。
'''

io.open(MEM, 'w', encoding='utf-8', newline='').write(MEM_NEW)
n = len(MEM_NEW)
print('② MEMORY.md：11761 → %d 字符' % n)
assert n < 9600, '仍超注入上限（%d ≥ 9600），需要再压' % n

# 结构自检
import re
for k in ['## 一、强制约定', '## 二、环境', '## 五、素材与图标', '## 七、将领属性', '## 八、遗留']:
    assert k in MEM_NEW, k
print('③ 结构自检通过（5 个必需小节齐全）')
print('   余量：%d 字符' % (9600 - n))
