# 《我在废土有座城》项目交接文档

> 交接时点：**2026-10-14** · 版本：**BUILD 9175**（v90.96）· 面向**下一位接手的会话（人或 AI）**：先读本文，再动手。

---

## 一、30 秒上手

- **形态**：纯前端单机游戏（**废土换皮**）。零构建、零外链依赖；`index.html` 双击即玩（`file://` 或本地 http server）。
- **跑起来**：`python -m http.server 8777 --directory E:/Deepseekdb` → 浏览器开 `http://localhost:8777/`。
- **目录**：`index.html`（~4500 行，含全部 CSS）· `js/`（15 模块）· `assets/`（754MB 素材）· `docs/`（活文档）· `tools/`（素材标准化脚本）· `.workbuddy/`（门禁/工具/记忆，见 §五）。
- **门禁三件套**（改完必跑，见 §三）：`audit` 全 0 · `smoke 3568/0` · `e2e 1094/0`。

---

## 二、架构速览

**加载序**（`index.html` 底部 `<script>`，顺序不可乱）：
`data → state → systems → domain → map → sphere → map3d → battle → tactic → icons → gicons → bitmaps → portraits → story → ui → main`
> ⚠️ v90.92「任务系统」退役 —— **`questdata.js` 已删**（勿再 require）。

| 模块 | 职责 |
|---|---|
| `data.js` | **全部静态配置**（建筑/科技/装备/兵种/地图常量/名城表/派系已删…）。改数值先来这里。 |
| `state.js` | 存档结构、`newGame`、`adoptState`（读档迁移链）、`tickOnce`（主循环）、**星球分片**（`mapSlices`）、资源出口 `GAME.res`。 |
| `systems.js` | 玩法系统（装备/科技/招募/研究…）。 |
| `domain.js` | 领域逻辑（城建/出征入口/弃城/装备详情/`genCityOf`…）。 |
| `map.js` | **平面投影视图**（由球面投影而来）+ 据点/名城/野地逻辑 + `pick`。`DATA.MAP_W=MAP_H=500`。 |
| `sphere.js` | **球面世界内核**（纯 JS · 无 THREE · **可多实例工厂** `GAME.createSphere()`）。拓扑 + 六边 `cells` + 球面原生地形。**地形判据唯一出口** `GAME.sphere.terrainAt(x,y)`。 |
| `map3d.js` | **3D 星球地图**（Three.js，`vendor/three.min.js`）：只做**渲染** + 拾取。**当前主地图**（`GAME.map3d.enabled`）。 |
| `battle.js` / `tactic.js` | 战斗引擎 / 战术。 |
| `icons.js` / `gicons.js` / `bitmaps.js` | 图标出口（矢量兜底 / game-icons / **AI 位图注册表**）。 |
| `ui.js` | **全部界面**（视图 + 弹窗）。`ui.*`。 |
| `main.js` | 启动 + **点击事件总派发**（`data-action` → `case`）+ `GAME.doXxx`。 |

### 坐标/地形口径（球系化 · v90.75+）
- **地形 SSOT = 球面内核** `GAME.sphere`：`cells[]`（40962 六边格，含 `type/level/ci`）+ `terrainAt(x,y)` / `ciOfXY` / `hexDist` / `hopsWithin`。
- **平面 `(x,y)`** 仍作**存储/主键/显示**，但**由球面投影而来**（`s.map.grid` 每格 terrain = `sphere.ciOfXY(x,y).type`）。**界面显示球系经纬**（`GAME.map.coordText(x,y)` → `N°E M°N`）。
- **据点/前哨/距离**全在球面：据点=六边格哈希+环邻接；距离=六边环数（`GAME.cityDist`/`sphere.distOf`）；前哨覆盖=`GAME.cellsToRings`。
- ⚠️ **别读 `s.map.grid` 判地形/距离** —— 它只是投影视图；判地形走 `sphere.terrainAt`、判距离走 `GAME.cityDist`。

### 多星球（v90.73+ · 帝国口径）
- **帝国（全局共享）**：英雄 `s.generals`、资源、科技、背包、任务、统计。
- **星球（独有分片 `s.mapSlices[pid]`）**：城 `cities` / 野地 `wilds` / 据点 `forts` / 占领·掠夺·毁记录 / 采集 `gathers` / 行军 `marches` / 队列 `queues` / 围攻 / 主城 / 出生点 / 岁贡。
- `s.planets = [{id,name,seed,params}]` + `s.activePlanet`（**id，非下标**）。`GAME.enterPlanet(id)` = 存旧片→载新片→载球面→重投影。
- **老档迁移**：`GAME._planetsMigrate84`（读档链）—— 确保**老家(id 0)存在**（缺则补）；把误归到别处的城搬回 0 号。
- ⚠️ **双球面（进行中）**：`GAME.sphere`=逻辑球面（当前城所在星球）；`GAME.mapSphere`=地图球面（地图在看/渲染/出征选星的星球）。目标：**切地图星球不碰城市界面**（见 §六 未完项）。

**设计画布**：1440×900，整体 `transform: scale(0.8533)` 适配窗口。布局锁死在这张画布上——**改尺寸前先量边界**（见 §四）。

---

## 三、门禁（改完必跑）

```bash
node audit.js                    # 结构审计：死函数/孤儿按钮/重复定义/零引用 → 目标全 0
node smoke-test.js               # 逻辑冒烟（无 DOM）→ 目标 3568 通过 / 0 失败
NODE_PATH='C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules' node e2e-test.js
                                 # 端到端（真实 DOM + HTTP）→ 目标 1094 通过 / 0 失败
```
- **pre-commit 钩子**自动跑 `.workbuddy/tools/git/gate.py`（三件套 + 数据表卫生）。Windows 下 **GBK 会让 gate.py 崩**（打印 ✅ 失败）→ 提交前缀 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8 git commit ...`。**不要 `SKIP_GATE=1` 绕过**。
- **并发在制品**（重要）：本机历史上有**多个会话同时改同一仓库**。跑门禁前若见红点，先判断是不是**别人的在制品**（看 `git status`、文件 mtime、`.workbuddy/backup/v90.xx/` 是否刚生成）。**别把别人的半成品当自己的回归**，也别 `git add -A` 卷走别人的改动。**冲突时先问老板、必要时请其终止并发会话。**

---

## 四、必守约定 / 常见坑

1. **改 `js/**` 或 `assets/**` 后必须 bump 版本**：`index.html` 顶部 `<!-- BUILD NNNN -->` **与全部** `?v=NNNN` **同值**（smoke 有守卫）。一条命令：
   `N=$(( $(grep -oE 'BUILD [0-9]+' index.html|head -1|grep -oE '[0-9]+') + 1 )); sed -i "s/BUILD [0-9]*/BUILD $N/; s/?v=[0-9]*/?v=$N/g" index.html`
   （另有发版脚本 `.workbuddy/tools/patch/bump_version.py`）。验收用 `index.html?cb=<随机>` 强刷。
2. **改 `js/*.js` 保 LF**：CRLF 会挂 smoke 的 `\n` 正则断言。
3. **单一事实来源（SSOT）**：一个数/一处逻辑只有一个出口，界面/测试都读它。改一处别忘了消费点。
4. **布局固定画布 + 零余量**：改尺寸前**一次量全约束**，纸面求可行解，别"改一版跑一遍"。
5. **门禁是验收不是探路**：想清楚再改，一次成型。
6. **素材标准化**：原始图入 `_raw` → `tools/normalize_*.py` 产出标准件 → 改完**重跑脚本 + `gen_bitmaps.js`**。注册表 `js/bitmaps.js` **勿手改**。
7. **测试口径改判据不删**：规则变更时**改断言口径**（别删断言、别放宽到失去意义）。审计/门禁报的红，先看是不是口径该更新。

---

## 五、去哪找信息

| 想知道… | 看 |
|---|---|
| **最近在做什么**（逐条需求 + 落地状态） | `docs/需求台账-v9012-13.md`（最新在末尾 §v90.xx） |
| 项目全貌 / 文件索引 / 历史 | `docs/项目地图.md` |
| **踩坑教训**（很值钱，改前扫一眼） | `docs/AI工作备忘.md` |
| 数据表含义 | `docs/数值系统数据字典.md` · `docs/数据表索引.md` |
| 素材规格 / 出图 / 换皮 | `docs/图标适配流程.md` · `docs/废土地形生成规格.md` · `docs/美术换皮方法论.md` |
| 门禁/工具脚本 | `.workbuddy/tools/`（`git/gate.py`、`gen/gen_bitmaps.js`、`patch/`…） |

**git**：`main` 分支；**post-commit 钩子自动 `git push`**（GitHub 偶不可达，push 偶失败 → `git ls-remote origin main` 核验）。远程 `Xiezr/Zhongtian`。

---

## 六、当前状态（v90.96）与未完项

**近期已收口**：
- **改名**：《我在废土有座城》（v90.71，全仓清「热血/三国/名将」旧字样）。
- **3D 星球主地图**（`map3d.js`）：球面原生地形 + 六边格浮起成球壳 + 细节纹理 + 地形高亮（选中提亮/其余调暗）+ 定位光束（远端红光脉动）+ 星球切换读条屏。
- **球系化**：地形/距离/据点/前哨全走球面；平面网格由球面投影而来（`sphere.terrainAt` 唯一地形出口）。
- **多星球**：帝国全局（英雄/资源/科技）+ 星球分片（城/野地/据点…）；星球生成器（L0~L4 要素 + 生态 + 体检 + 奇观）；换星球后球面/下拉/城一致（`activePlanet` 按 id 取）。
- **UI**：地图导航改**球系坐标输入**（去方向键）；君主左侧**三清单**（城池/据点/野地 · 星球分组+下拉）；附属野地从资源区**移入君主左侧**；名称开关只管城内/外建筑。
- **系统退役**：天下大势缩略图、奇遇系统、**门派/派系整删**、**任务 + 全屏剧本 + 年号纪元**整删；突破改**爵位门槛制**；威望称呼统一（「爵位」旧称退役）。
- **修复**：将领跨星球泄漏（`genCityOf` 不再回退当前城）；老档「老家消失」（`_planetsMigrate84` 确保 id 0 存在）；星球切换不稳定（`activePlanetOf` 按 id 取 + 读档载入当前球面）。

**⛔ 进行中 · 双球面（城市/地图解耦）—— 老板拍板方案**：
> 老板令：「同一帝国下管理多个星球；**城市和地图应当是区分又联系的** —— 在地图上切星球/切城，**进入某城**才改变城市界面（城市保持）；增加「派出城」选项（选定地块由哪座城操作）。」

**目标架构**：
```
帝国（玩家层：全部星球 / 英雄池 / 资源 / 科技）
 └ 星球（独有：地形 / 地块 / NPC城 / 据点 / 该星的城与野地）
    └ 城市（独有：城内建设 / 科技 / 募兵 / 将领）
   · 城市管理（城池 tab）  = 当前城内部（资源/建设/科技/募兵/将领）
   · 地图管理（地图 tab）  = 星球上野地/据点/城池 ⇒ 出征，与城市**有归属但不强相关**
```
**已落地的基础**（本会话）：
- ✅ `sphere.js` 改**可多实例工厂**（`GAME.createSphere()`）：`GAME.sphere`（逻辑）+ `GAME.mapSphere`（地图）两份实例，各带全套可变态、互不干扰。
- ✅ `GAME._planetsMigrate84` 确保老家(id 0)存在；`GAME.genCityOf` 不跨星球泄漏。

**待做（按顺序）**：
1. **map3d 改用 `GAME.mapSphere`**（当前仍读 `GAME.sphere`）：其 `SP.*` 引用（~17 处）改指地图球面。
2. **地图星球上下文**：加 `s.mapPlanetId`（地图在看哪颗星球，默认 = `activePlanet`）。地图星球 = `mapSphere`，其城/野地/据点取**该星球分片**（当前 map3d 标记读 `GAME.state.cities`/`fortAt` 是**当前星球**的 → 需改为**读 mapPlanet 分片**）。
3. **地图上「切星球」下拉**（已有 `#adm-planet`）→ 改为切 **mapPlanet**（只重载 `mapSphere` + 重渲染地图），**不动** `GAME.sphere`/`activePlanet`/当前城 → 城市界面保持。
4. **进入某城**（君主城列表 / 城池面板 / 地图点己方城）→ 切 `GAME.sphere` 到该城星球 + `activePlanet` = 该星 + 重载分片 → 城市界面才变。
5. **据点生成参数化**：据点/前哨生成（`map.js _fortActive/_fortCandidate/_fortLevelTable`、`_fortBlockSet`）现在隐式用 `GAME.sphere` + `s.map.seed` → 需按**指定星球**（mapSphere + mapPlanet.seed + 该星 startPos）算，否则地图星球的据点与地形不符。
6. **#4 出征弹窗「派出城」选择**：出征/占领/采集弹窗里加一个**城下拉**（当前星球的所有城），选定后由该城执行（出征 `from` = 该城）。
7. 测试口径同步 + 门禁 + 实机验收（切地图星球 → 城市不变；进他城 → 城市变；选出征城 → 从该城出征）。

**已知未决 / 待老板定夺**：
- **球系地形**：现为程序生成的细节纹理（噪声颗粒）。要"照片级"需**美术出地形贴图**（丢 `assets/` 接 UV/材质）。
- **`gate.py`**：Windows 提交需 `PYTHONUTF8=1`。
- **并发会话**：本仓常有多个会话同时改（见 §三）。**动手前先确认工作区干净、无他人在制品。**

---

## 七、工作方式（老板偏好）

- **别磨、果断执行**：先一次想全约束/依赖/可行解再动手；探查**并行一次到位**；别增量试错、反复预览、过度拆分。
- **不清楚就问**（边界不明/多种可能时先问，别自己锚定着做）；问了就一次问全。
- **视觉/布局改动**：先截图/量尺寸定位，再改；一个脚手架够用不写第二个。
- **改了就跑门禁**；素材改了记得 bump 版本 + 重生成注册表。
- **大改先落可验收子集**（哪怕分几次提交），别把半成品留在工作区。
