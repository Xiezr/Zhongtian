# 《我在废土有座城》项目交接文档

> 交接时点：**2026-10-26** · 版本：**v150.0 / BUILD 9387** · 面向**下一位接手的会话（人或 AI）**：
> 先读本文 → 再读 `docs/接力卡-星际战舰.md`（进度/下一步）→ 再动手。**不要从零探索。**

---

## 一、30 秒上手

- **形态**：纯前端单机网页游戏（废土换皮）。**零后端**；`index.html` 双击即玩（`file://`）。
- **跑起来**：直接开 `E:/Deepseekdb/index.html`；或
  `python -m http.server 8777 --directory E:/Deepseekdb` → `http://localhost:8777/`。
- **源码根**：`E:\Deepseekdb`（注意：当前会话的工作目录 `E:\app_projects\biztrip` 是**另一份无关项目**，别改错仓）。
- **目录**：`index.html`（全部 CSS）· `js/`（64 个源文件 + 3 个 bundle 产物）· `assets/` · `docs/` · `.workbuddy/`（门禁/工具/历史备份）。
- **门禁五件套**（改完必跑）：audit **0** · chain-audit **47/0** · invariants **40/0** · smoke **4230/0** · e2e **1106/0**。

---

## 二、架构速览

### 加载方式（v104 起**三包**）
`index.html` 只加载 4 个脚本，**顺序即求值顺序**：

```html
vendor/three.min.js → js/bundle-core.js → js/bundle-war.js → js/bundle-ui.js
```

- **bundle-core**：数据 + 状态 + 领域 + 全部玩法模块（开局就要）
- **bundle-war**：`gltf / battle / battlelog / strategy / tactic / icons / gicons / bitmaps / portraits`
- **bundle-ui**：`story / ui / map3d / scene3d / main`（必须最后，`main.js` 是入口）

> 分包只解决「单文件撞线」，**不改求值时机**（全项目 200+ 探针按顺序拼接求值，动态 import 会打破它）。
> 拆分依据在 `.workbuddy/tools/patch/build_bundle.py` 的 `ORDER / WAR / UI` 三张表。

> ⚠️ **改任何 `js/*.js` 后必须重建 bundle**：`python .workbuddy/tools/patch/build_bundle.py`
> （漏了会被 smoke 的陈旧守卫拦下）。校验：`build_bundle.py --check`（会报「三包与源码一致」）。
> **新增模块要同步四份静态清单**：`build_bundle.ORDER` + `smoke-test` SECTION 列表 + `audit.MODULES` + `audit.REF_MODULES`。
> （v144.5 刚因漏了后两份，audit 长期误报 `GAME.scene3d / GAME.battlelog`「引用了不存在的成员」。）

### 模块地图（64 个源文件，按层）

**地基 / 状态**
| 模块 | 职责 |
|---|---|
| `core.js` | `window.GAME` 单例 |
| `registry.js` | 模块注册表 `GAME.reg`：`tick`（月度）、`panel`（世界账本）、`actions`（动作分发） |
| `data.js` | **全部静态配置**（建筑/科技/装备/兵种/奇观/战舰/据点/遗迹/构想各系统的数值表）。改数值先来这 |
| `state.js` | 存档结构、`newGame`、`adoptState`（迁移链）、`tickOnce`（主循环）、`simulateBulk`（离线）、星球与世界归一、`GAME.res` |
| `items.js` / `generals.js` / `cities.js` | 三个归属出口：`GAME.items`（背包）/ `GAME.gen`（英雄 7 态状态机）/ `GAME.city`（城市资源·队列·城兵） |
| `ship.js` | 星际战舰/空间站 `GAME.ship`（12 舰种 · 蓝图门槛 · 部件/属性 · v142.4 modifier 管道） |
| `colony.js` | **星际投送 / 殖民** `GAME.colony`（v145 · 母舰跨星投人投兵 · `s.interstellar` 现实时间锚点 · 锚地 → 立城转正） |
| `fleet.js` | **舰队战 / 深空远征** `GAME.fleet`（v146 · 编成 1~5 舰 · 确定性回合战 · 战利品/折舰 · `s.ds` 现实时间锚点） |

**世界 / 地图**
| 模块 | 职责 |
|---|---|
| `sphere.js` | **球面世界内核**（纯 JS · 多实例工厂）→ 地形唯一事实源，`cells` 40962 格 |
| `map.js` | 地形/据点/名城/野地逻辑 + 平面投影视图（`MAP_W=MAP_H=500`） |
| `map3d.js` | Three.js 星球 3D 地图（只做渲染与拾取） |
| `scene3d.js` | 2.5D 场景运行时（10 场景 + 城内街区 · 正交相机 · 交互节点 · 时段光照 · 行人） |
| `fog.js` | 探明度 / 迷雾 |

**玩法模块（v92–v144 的「构想清单」落地）**
`camp` 幸存者营地 · `ruin` 旧世界遗迹 · `relic` 废墟科技 · `faction` 四方势力 · `rival` 竞争者 ·
`land` 领土连通 · `taint` 污染 · `climate` 温度 · `surge` 辐射云 · `village` 村社 · `convoy` 拓荒队 ·
`growth` 城市自长自朽 · `muster` 兵源 · `idle` 惰性 · `expose` 暴露 · `renown` 名声 · `memorial` 阵亡名录 ·
`goals` 作战目标 · `veteran` 老兵 · `setskill` 套装指令 · `deck` 指令牌 · `bond` 羁绊 · `tower` 城防工事 ·
`wonderwar` 奇观争夺 · `delve` 地下远征 · `unrest` 民怨 · `trooplv` 兵员等级 · `years` 年景 · `ending` 终局 ·
`founding` 开城 · `prologue` 前传 · `events` 路上遇到的事 · `market` 集市行情 · `risk` 危险梯度

**战斗 / 界面**
| 模块 | 职责 |
|---|---|
| `battle.js` | 行军 / 出征 / 战斗结算（`simOpts` 快照是重放同源的根） |
| `tactic.js` | 战斗引擎（`goalMod` 是所有战场加成的**唯一通道**） |
| `battlelog.js` | 回合推进转移表 + 操作日志（观测层，零行为变化） |
| `strategy.js` | NPC 侧策略层（默认关，`battleAI`） |
| `duel.js` | 斗将竞技场内核（v144.1 · 血=体力 / 每合双方各出手） |
| `systems.js` | 科技研究 / 装备穿戴 / 宝物使用 / 威望晋升 |
| `ui.js` | **全部界面**（视图 + 弹窗） |
| `main.js` | 启动 + 事件总派发（`data-action` → case → 注册表兜底）+ `GAME.doXxx` |

### 坐标 / 地形口径
- **地形 SSOT = 球面内核**：`GAME.sphere.cells` / `ciOfXY` / `terrainAt`。
- 平面 `(x,y)` 是存储/显示主键；界面显示经纬（`GAME.map.coordText`）。
- **`ci` 只在球内唯一** —— 跨星球实体一律带 `pid`（见 §三）。

---

## 三、最重要的结构性变化（v91.74 世界归一 · 至今有效）

- **世界数据全局一份**：`s.cities / s.wilds / s.forts / s.queues / s.marches / s.gathers / s.battles / s.sieges`，每条记录带 **`pid`**。
- **`s.mapSlices` 已退役**（老档 `migratePlanetWorld74` 一次性合并，幂等标记 `planetWorldMig74`）。
- **据点类字典键**：`p<pid>|c<ci>`；唯一出口 `GAME.fortKey / GAME.fk(pid) / GAME._fkGet`；老裸键 `c<ci>` 兼容读（= 当前星）。
- **`sliceOf(pid)` / `mapSliceOf(pid)` 只是过滤视图**（只读）；`_savePlanetSlice / _loadPlanetSlice` 已空实现。
- **`enterPlanet(id)` 只换球面 + 重建地图投影**，不换数据；每星球自己的开始圈 `planet.worldStart`。
- **全境推进**：`tickOnce` / `simulateBulk` / 自动升级·征兵·研究·基因研究·采集 / 外敌来犯 都遍历所有星球。
- ⚠️ **新增按格查表必须带 `pid`**：`map.wildAt(ci,pid)`、`gatherAt(ci,pid)`、`fortOwnAt(ci,pid)`、`fortAuraAt(ci,pid)`。
- 🔴 **血泪坑**：v144.5 之前 `expose / land / faction / rival / village / camp / ruin / taint / climate / surge / relic`
  等模块都写 `GAME.mapSphere || GAME.sphere` —— `mapSphere` 对象存在但**没 build**（没 cells），
  于是全部返回空、**"世界是空的"且零报错**。统一改走 **`GAME.sphereOf()`**（既有的「按 pid 取球面」出口）。
  **新模块一律用 `GAME.sphereOf()`，不要自己拼 `||` 兜底。**

---

## 四、本批大改（v91.71 → v146.0，按时间）

| 版本 | 内容 |
|---|---|
| **v150.0** | **P0 可玩性改造**：阶段门控（第一小时）+ 战场三选一（修托管假控制）；+§573/§574/§4.7 |
| **v149.2** | **全面复核**：新手引导死路（沿前置链指到最底一环）/ 投送人口不封顶 / 战利品取整 / 终局选项守卫；+3 守恒性质 · +5 真 DOM e2e |
| **v149.0** | **玩家视角视觉自检**：新手一条 / 账本「去办」/ 预览小眼睛 / 窄屏提示 / 修 `R` 白屏（smoke §571） |
| **v148.0** | **舰队阵位（5-B）**：前卫/中坚/后卫，对口舰种才生效；自动落位可轮换；预览与实战同数（smoke §570） |
| **v147.0** | **星际战舰 D 期：建造时的 3D 预览**：空地候选卡片「先看看」/ 已建面板「预览下一级」· `S.openBuildPreview`（独立 `buildPreviewScene` · 正交 55° · 配色与城内共用 · 邻格参照）· 无 WebGL 静态示意图兜底 · 不占格不扣费 · smoke §569 |
| **v146.0** | **星际战舰 F 期：舰队战 + 深空远征 + 终局第三条**：`js/fleet.js`（编成 · 确定性回合战 · 超时不损舰/沉船折僚舰 · 现实时间锚点 · 战报留档）· `DATA.DS` 四个深空目标（Boss 首通红母舰蓝图）· 终局第三选项「深空无响应」（打下 Boss 才出现）· 舰船三向互斥锁 · smoke §567+§568 · invariants §4.6 · **数值待老板复核** |
| **v145.1** | **投送实机修正**：航程单位（游戏秒→现实秒）· `carrierShips` 补回 · 锚地只由投送建立 · 出发城不要求在当前星球 |
| **v145.0** | **星际战舰 E 期：投送 + 殖民**：`js/colony.js`（母舰运人/兵过星 · 运力/燃料/航程唯一出口 · 在途进度与中止）· **新星球不再白送前哨城**（只留登陆点）· 抵达无城圈「星际锚地」→ 立城转正 · 殖民立城须补给线 · 跨星陆路调运拦截 · smoke §566 七条 + invariants §4.5 · **数值待老板复核** |
| **v144.5** | **构想补齐（能做的全做）**：羁绊进战场 · 战报「⚔ 战场修正」表 · A1 领土连通真生效 · B4 严寒折产 · F 污染变异 · A7 暴露逐队可见 · E 云内搬城入口 · B2 宣战真来犯 · C2 护送/斩首 |
| v144.2 | 战舰 C 期数值：母港共振 / 部件协同 / 编队共鸣（只长数据不改公式，`DATA.SHIP_SYNERGY`，**待老板复核**） |
| v144.1 | **斗将正式化**：`js/duel.js`（血=体力、每合双方各出手）+ 左右画像竞技场 + `DATA.DUEL_ARENA` |
| v143.x | 3D 最后一公里：正式阶段江湖动作进 2.5D 场景（双宿主唯一账本）· 城内行人 · 时段光照 · hash 换行归一 |
| v142.x | 战斗回合表白名单 + 守恒律属性测试（新增 `invariants-test.js` 进门禁）· 战舰 modifier 管道 · 城内街区 3D |
| v91.77–v91.84 | 出征界面：固定界面 + 7 方式 + 目标「其他目标」弹窗 + 自动出征/探索/研究系列（详见 `docs/出征界面汇总.md`） |
| v91.71–v91.76 | 星际战舰 A/B 期（空间站 + 卡牌船坞 + 12 舰种蓝图门槛）· 世界归一 · 本批十六条 |
| v91.61–v91.70 | 地基第 1 期（ES import + 单包）→ 第 2 期（items/inventory/generals/cities 归属化 + 7 条回潮守卫） |

---

## 五、门禁（改完必跑）

```bash
NODE=C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-6/node.exe
export NODE_PATH=C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules
$NODE audit.js            # 结构审计（含数据表卫生子审计）→ 全 0
$NODE chain-audit.js      # 链路走查（派队→落账）            → 47/0
$NODE invariants-test.js  # 守恒律属性测试（种子随机 + 收缩） → 32/0
$NODE smoke-test.js       # 逻辑冒烟                          → 4191/0
$NODE e2e-test.js         # 端到端（真实 DOM + HTTP）          → 1100/0
python .workbuddy/tools/patch/build_bundle.py   # 改 js 后必须重建
```

- **pre-commit 钩子**（`.workbuddy/tools/git/gate.py`）会再跑一遍五件套 + 表卫生；Windows 建议前缀
  `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 git commit ...`。**不要 `SKIP_GATE=1` 绕过。**
- **提交只 add 自己的文件**：`git add -A` 会卷进 `.workbuddy/eval_*/browser-profile/Cookies`（被锁 → fatal）。
- 工作区若有 `assets/icons/其他种族兵种/` 等**未跟踪目录**，可能是老板另放的素材，**别删**。
- 后端提交钩子偶尔因 `audit_v89134_tables.js` 撞名报红 —— 那是**真问题**（重复定义/孤儿表），按提示改数据。

---

## 六、必守约定 / 常见坑（都是踩过的）

1. **改 js 必须重建 bundle**（见 §二），否则 smoke 红。
2. **`js/*.js` 保 LF**：CRLF 会挂 smoke 的 `\n` 正则断言；`build_bundle` 与 smoke 两侧已做换行归一再算 hash，
   但**编辑器/脚本重存文件**仍可能污染工作树行尾 —— 用 `newline=''` 或 `newline='\n'` 显式写。
3. **禁止正则批量改「键名是变量」的代码**（v91.69：`army[k]` 被写成 `{ k: … }`，25 处静默错兵）。
4. **SSOT**：一个数/一处逻辑只有一个出口；**界面与执行端读同一出口**
   （例：`ui.expModeAvailOf` ↔ `battle.prepare`；`goalMod` 是所有战场加成的唯一通道）。
5. **设计令牌 lint**：`index.html` 样式表禁裸 px/hex/字号/圆角；网格/canvas 视图用**内联 style** + `var(--*)` 令牌。
6. **改规则就改断言口径，别删断言、别放宽到失去意义**。
7. **版本三连**：`bump_version.py --bump --version vX.YY`（改 `GAME.VERSION` + `index.html` BUILD/`?v=`）。
   **台账必须手补**：新增「逐轮明细」段 + 更新 `LATEST-BATCH: vNNN` 锚点（smoke §199⑥ 校验主版本一致）。
8. **性能护栏**：`100 城 tickOnce` 取三轮最小值 < 6ms（真回归 ≈10.5ms）；新增逐城逻辑别破坏它。
9. **并发会话**：本仓可能与别的会话同时在改；动手前看 `git status` / 文件 mtime，冲突先问老板。
10. **`GAME.city.add` 不吃负数**（内部 `n >= 0 ? … : 0`）—— 扣资源一律用 `GAME.city.sub`。
11. **「手写字段清单」的打包函数**（`snapUnits` / `simOpts`）必须逐字段核对，
    漏一个就是静默失真（v89.151 战报血量全 0 就是这么来的）。
12. **新增模块**：四份静态清单都要登记（见 §二末），否则 audit 误报或模块不参与扫描。

---

## 七、当前状态与下一步

**已完成**：地基两期 · 星际战舰 A/B/C · 斗将正式化 · 3D 化最后一公里 ·
构想清单 A/B/C/D/E/F/G 的**最小可运行 + 第二轮接活**（v144.5 把「引擎有但没接进玩法」的断点全部接通）。

**星际战舰后续分期**（见 `docs/接力卡-星际战舰.md`）：
- **C** 部件/属性深化 → 机制已落地（v144.2 三来源），**数值待复核**
- **D** ✅ 建造 3D 预览（v147.0）
- **E** ✅ 已落地（v145.0 · `js/colony.js`）；剩「落地后就地操作」与「殖民地自动补给线」
- **F** 舰队战 + 终局

**已知未修 / 待办**：
1. **`newGame` 球面时序**：`sphere.ensure()` 早于 `GAME.state` 赋值 → 全新会话首局球面按 seed 1 构建（种子错配）。
   修复会移动地形、波及布局断言，需单独一轮。
2. **旧 `transfer` 别名**：`DATA.EXPEDITION.modes` 里保留 `transfer`（内部/自动/脚本兼容），界面不展示。
3. **2D 兜底地图**（`map3d` 关闭时）不支持「地图看别星」，仍强制 map = active。
4. **运输返程**：按「去程耗时」返程，未做中途召回的特殊显示（沿用通用召回）。
5. **护送/斩首的细化**：当前「护送」近似为「撑满回合且还有兵」，「斩首」近似为「打崩守军三成」——
   没有真正的车队单位 / 守将个体目标（要做需要新兵种或改守将建模）。

**需要老板定夺**（我没擅自做）：
- **星际战舰 C 期数值**：母港共振 +2%/级封顶 30% · 部件协同 12% 两档 · 编队共鸣 6~8%（可玩初值，非定案）。
- **斗将数值**：`DATA.DUEL_ARENA`（rate 0.18 / critMul 1.6 / weakMul 0.6 / minStaPct 0.15 / maxRounds 12）
  与四招 `mul`/`taken`；对手等级 = 君主等级。
- **叫阵/挑衅要不要并入竞技场口径**：目前 `battle.duelPlay`（5 合比分制）与 `GAME.duel.play`（血量制）并存，相克表共用。
- **探索层级语义**：当前 = 挑战该层守卫；若要「层级 = 采集深度」需改口径。
- **G 科技树 → 废墟挖掘**：等于换掉整条主线，风险最高，未做。
- **C4 异步 PvP**：单机无对手；可做「本地影子防守」，需授权。

---

## 八、去哪找信息

| 想知道… | 看 |
|---|---|
| **当前进度 / 下一步** | `docs/接力卡-星际战舰.md`（最优先） |
| **逐条需求 + 落地状态** | `需求档案.md`（**唯一台账**，末尾「逐轮明细」；`LATEST-BATCH` 锚点） |
| **构想清单逐项判定** | `docs/构想实现审计.md`（已有/部分/真缺/不建议，25 项） |
| 玩法提案原文 | `docs/玩法提案-从进度条到选择.md` |
| **出征界面细节** | `docs/出征界面汇总.md` |
| 项目全貌 / 文件索引 | `docs/项目地图.md` |
| 踩坑教训 | `docs/AI工作备忘.md` |
| 数据表含义 | `docs/数值系统数据字典.md` · `docs/数据表索引.md` |
| 场景/3D | `docs/场景系统-v140.md` · `场景补完-v141.md` · `城内街区-v142.md` · `城随地形走-v139.md` |
| 门禁/工具 | `.workbuddy/tools/`（`git/gate.py`、`patch/build_bundle.py`、`patch/bump_version.py`、`show/` 实机脚本模板） |

**git**：`main` 分支；post-commit 自动 push。远程 `Xiezr/Zhongtian`（GitHub 偶尔不可达 → 提交仍落本地，恢复后再 push）。

---

## 九、工作方式（老板偏好）

- **别磨、果断执行**：先一次想全约束/依赖/可行解；探查并行一次到位；别增量试错、反复预览、过度拆分。
- **不清楚就问**：边界不明/多种可能时先问，且**一次问全**（用 AskUserQuestion）。
- **视觉/布局改动**：先截图或量尺寸定位，再改代码。
- **大改先落可验收子集**：每刀过门禁再下一刀，不把半成品留在工作区。
- **「能做的全做」= 按清单一次做完**，但**不擅自 invent 数值**；需要拍板的列清单交回。
- 改完立即跑五件套；报红先判断「口径该更新」还是「真回归」。
